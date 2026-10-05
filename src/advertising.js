const PRODUCTION_ORIGIN = 'https://www.gifsplitter.com';
const GOOGLE_VENDOR = 755;
const PERSONALIZED_PURPOSES = [1, 3, 4];
const OTHER_AD_PURPOSES = [2, 7, 9, 10];
const SETTLED_EVENTS = new Set(['tcloaded', 'useractioncomplete']);
const PAGE_WITHOUT_ADS = new Set(['home', 'about', 'terms', 'privacy', '404']);
const initializedDocuments = new WeakMap();

/** A conservative publisher gate; Google's tag still evaluates the full TC string. */
export function permitsPersonalizedAds(data, success) {
  if (success !== true || !data || data.cmpStatus !== 'loaded' || !SETTLED_EVENTS.has(data.eventStatus)) return false;
  if (data.gdprApplies === false) return true;
  if (data.gdprApplies !== true || typeof data.tcString !== 'string' || !data.tcString.trim() ||
      data.vendor?.consents?.[GOOGLE_VENDOR] !== true) return false;
  if (!PERSONALIZED_PURPOSES.every(id => data.purpose?.consents?.[id] === true)) return false;
  return OTHER_AD_PURPOSES.every(id =>
    data.purpose?.consents?.[id] === true || (
      data.purpose?.legitimateInterests?.[id] === true &&
      data.vendor?.legitimateInterests?.[GOOGLE_VENDOR] === true
    ));
}

function readConfiguration(document) {
  const element = document.getElementById('advertising-config');
  if (!element) return null;
  try {
    const config = JSON.parse(element.textContent);
    return config && typeof config === 'object' && !Array.isArray(config) ? config : null;
  } catch {
    return null;
  }
}

/**
 * Boots Google's published CMP using the standard, paused AdSense tag.
 * Dependencies are injectable so consent and failure behavior can be tested without Google requests.
 */
export function initializeAdvertising({
  document = globalThis.document,
  window = globalThis.window,
  config,
  setTimeout: schedule,
  clearTimeout: unschedule,
  timeoutMs = 15000,
} = {}) {
  if (!document || !window) return null;
  if (initializedDocuments.has(document)) return initializedDocuments.get(document);

  const configuration = config ?? readConfiguration(document);
  const button = document.getElementById('privacy-settings');
  const status = document.getElementById('privacy-status');
  const region = document.getElementById('article-ad-region');
  const state = {
    active: false,
    apiReady: false,
    consentAllowed: false,
    requestMade: false,
    retired: false,
    failed: false,
    reason: 'off',
  };
  let watchdog;
  let script;
  let listenerId;
  let disposed = false;
  let waitingForNewChoice = false;
  let tcfListener;
  const timer = schedule ?? window.setTimeout?.bind(window) ?? globalThis.setTimeout;
  const cancelTimer = unschedule ?? window.clearTimeout?.bind(window) ?? globalThis.clearTimeout;
  const showStatus = key => {
    if (status) status.textContent = typeof configuration?.[key] === 'string' ? configuration[key] : '';
  };
  const setButtonAvailable = available => {
    if (!button) return;
    button.disabled = !available;
    button.hidden = !available;
    if (typeof configuration?.privacySettings === 'string') button.textContent = configuration.privacySettings;
  };
  const pause = reason => {
    if (state.active) window.adsbygoogle.pauseAdRequests = 1;
    if (region) region.hidden = true;
    if (state.requestMade) state.retired = true;
    state.consentAllowed = false;
    state.reason = reason;
  };
  const clearWatchdog = () => {
    if (watchdog !== undefined) cancelTimer(watchdog);
    watchdog = undefined;
  };
  const failClosed = reason => {
    if (disposed) return;
    state.failed = true;
    pause(reason);
    clearWatchdog();
    setButtonAvailable(false);
    showStatus('privacyUnavailable');
  };

  const requestPrivacySettings = () => {
    if (!state.active || !state.apiReady || state.failed || disposed) {
      setButtonAvailable(false);
      showStatus('privacyUnavailable');
      return false;
    }
    if (typeof window.googlefc?.showRevocationMessage !== 'function') {
      failClosed('revocation-api-unavailable');
      return false;
    }
    // Stop future requests before opening the preferences UI; an existing request is never refreshed.
    waitingForNewChoice = true;
    pause('revoking');
    showStatus('privacyPending');
    try {
      window.googlefc.callbackQueue.push({
        CONSENT_API_READY: () => {
          if (disposed || state.failed) return;
          try {
            window.googlefc.showRevocationMessage();
          } catch {
            failClosed('revocation-error');
          }
        },
      });
    } catch {
      failClosed('revocation-error');
      return false;
    }
    return true;
  };
  const onSettingsClick = event => {
    event.preventDefault();
    requestPrivacySettings();
  };

  const controller = Object.freeze({
    getState: () => ({ ...state }),
    requestPrivacySettings,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      clearWatchdog();
      button?.removeEventListener('click', onSettingsClick);
      script?.removeEventListener('error', onTagError);
      if (listenerId !== undefined && typeof window.__tcfapi === 'function') {
        try { window.__tcfapi('removeEventListener', 0, () => {}, listenerId); } catch { /* Already unavailable. */ }
      }
      pause('disposed');
    },
  });
  initializedDocuments.set(document, controller);
  if (region) region.hidden = true;

  let url;
  try { url = new URL(window.location.href); } catch { /* Invalid environments remain inactive. */ }
  const page = document.body?.dataset?.page;
  const validConfig = configuration && ['off', 'consent', 'live'].includes(configuration.mode) &&
    /^ca-pub-\d{16}$/.test(configuration.client);
  if (!validConfig || configuration.mode === 'off' || url?.origin !== PRODUCTION_ORIGIN || page === 'privacy') {
    state.reason = !validConfig ? 'invalid-config' : page === 'privacy' ? 'privacy-page' :
      url?.origin !== PRODUCTION_ORIGIN ? 'preview-origin' : 'off';
    setButtonAvailable(false);
    showStatus('privacyUnavailable');
    return controller;
  }
  if (configuration.mode === 'live' && !/^\d+$/.test(configuration.articleSlotId ?? '')) {
    state.reason = 'invalid-slot';
    setButtonAvailable(false);
    showStatus('privacyUnavailable');
    return controller;
  }
  const nonce = document.querySelector('meta[property="csp-nonce"]')?.nonce;
  if (!nonce || nonce === '__CSP_NONCE__') {
    failClosed('nonce-unavailable');
    return controller;
  }

  state.active = true;
  state.reason = 'loading';
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 1;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  setButtonAvailable(false);
  showStatus('privacyPending');
  button?.addEventListener('click', onSettingsClick);
  const wantsPrivacySettings = url.searchParams.get('privacy-settings') === '1';
  const unit = region?.querySelector('ins.adsbygoogle');
  const articleEligible = configuration.mode === 'live' && configuration.articleEligible === true &&
    !PAGE_WITHOUT_ADS.has(page) && unit?.dataset?.adClient === configuration.client &&
    unit?.dataset?.adSlot === configuration.articleSlotId;

  const requestArticleAd = () => {
    if (!articleEligible || state.failed || disposed || state.retired || state.requestMade) return;
    state.requestMade = true;
    region.hidden = false;
    try {
      // Keep the request paused while registering the only permitted unit.
      window.adsbygoogle.push({});
      window.adsbygoogle.pauseAdRequests = 0;
      state.reason = 'requested';
    } catch {
      failClosed('ad-request-error');
    }
  };

  tcfListener = (data, success) => {
    if (disposed || state.failed) return;
    if (data?.listenerId !== undefined) listenerId = data.listenerId;
    if (success !== true || data?.cmpStatus === 'error') {
      failClosed('consent-error');
      return;
    }
    // A visible, healthy CMP can wait for the visitor indefinitely; this timer
    // detects a missing API response, not a deadline for deciding consent.
    if (data?.cmpStatus === 'loaded' && (SETTLED_EVENTS.has(data?.eventStatus) || data?.eventStatus === 'cmpuishown') && typeof data?.gdprApplies === 'boolean') clearWatchdog();
    if (data?.gdprApplies === false) {
      setButtonAvailable(false);
      showStatus('privacyUnavailable');
    } else if (data?.gdprApplies === true) {
      if (typeof window.googlefc.showRevocationMessage !== 'function') {
        failClosed('revocation-api-unavailable');
        return;
      }
      setButtonAvailable(true);
    }
    if (waitingForNewChoice && data?.eventStatus !== 'useractioncomplete') {
      pause('revoking');
      return;
    }
    if (data?.eventStatus === 'useractioncomplete') {
      waitingForNewChoice = false;
      showStatus('privacyUpdated');
    } else if (data?.eventStatus === 'tcloaded' && data?.gdprApplies === true) {
      showStatus();
    }
    if (!permitsPersonalizedAds(data, success)) {
      pause(data?.eventStatus === 'cmpuishown' ? 'awaiting-consent' : 'consent-denied');
      return;
    }
    state.consentAllowed = true;
    state.reason = state.retired ? 'retired' : 'consent-allowed';
    requestArticleAd();
  };

  watchdog = timer(() => failClosed('consent-api-timeout'), timeoutMs);
  function onTagError() { failClosed('ad-tag-unavailable'); }
  script = document.createElement('script');
  script.id = 'adsense-loader';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(configuration.client)}`;
  script.nonce = nonce;
  script.addEventListener('error', onTagError);
  try {
    document.head.appendChild(script);
  } catch {
    failClosed('ad-tag-unavailable');
  }
  if (state.failed) return controller;

  try {
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        if (disposed || state.failed || state.apiReady) return;
        if (typeof window.__tcfapi !== 'function') {
          failClosed('consent-api-unavailable');
          return;
        }
        if (typeof window.googlefc.showRevocationMessage !== 'function') {
          failClosed('revocation-api-unavailable');
          return;
        }
        state.apiReady = true;
        state.reason = 'awaiting-consent';
        setButtonAvailable(true);
        if (wantsPrivacySettings) waitingForNewChoice = true;
        try {
          // Version 0 selects the latest supported TCF API. getTCData is deprecated.
          window.__tcfapi('addEventListener', 0, tcfListener);
          if (wantsPrivacySettings) requestPrivacySettings();
        } catch {
          failClosed('consent-api-error');
        }
      },
    });
  } catch {
    failClosed('consent-api-error');
  }
  return controller;
}

if (typeof globalThis.document !== 'undefined' && typeof globalThis.window !== 'undefined') {
  initializeAdvertising();
}
