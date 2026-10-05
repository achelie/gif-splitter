import test from 'node:test';
import assert from 'node:assert/strict';
import { ADSENSE_CLIENT, createAdPolicy, adPolicyFromEnv } from '../src/site/ad-policy.js';
import { initializeAdvertising, permitsPersonalizedAds } from '../src/advertising.js';

const labels = {
  privacySettings: 'Privacy and cookie settings',
  privacyUnavailable: 'Privacy settings are unavailable.',
  privacyPending: 'Waiting for privacy settings.',
  privacyUpdated: 'Privacy settings updated.',
};
const liveConfig = {
  mode: 'live', client: ADSENSE_CLIENT, articleSlotId: '1234567890', articleEligible: true, ...labels,
};
const readyPolicy = {
  mode: 'live', articleSlotId: '1234567890', siteReady: true,
  cmpPublished: true, cmpVerified: true, autoAdsDisabled: true,
};

function consent(overrides = {}) {
  return {
    cmpStatus: 'loaded', eventStatus: 'tcloaded', gdprApplies: true, listenerId: 42, tcString: 'test-tcf-string',
    purpose: {
      consents: { 1: true, 3: true, 4: true },
      legitimateInterests: { 2: true, 7: true, 9: true, 10: true },
    },
    vendor: { consents: { 755: true }, legitimateInterests: { 755: true } },
    ...overrides,
  };
}

class Element extends EventTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.children = [];
  }
  appendChild(element) { this.children.push(element); return element; }
  querySelector(selector) {
    if (selector === 'ins.adsbygoogle') return this.children.find(element => element.tagName === 'INS');
    return null;
  }
}

function harness({ config = liveConfig, page = 'guide', url = 'https://www.gifsplitter.com/how-to-extract-gif-frames/', nonce = 'request-nonce', hasRegion = true, initiallyReady = false, unitSlot } = {}) {
  const elements = {
    'advertising-config': new Element('script'),
    'privacy-settings': new Element('button'),
    'privacy-status': new Element('p'),
  };
  elements['advertising-config'].textContent = JSON.stringify(config);
  if (hasRegion) {
    elements['article-ad-region'] = new Element('aside');
    const unit = new Element('ins');
    unit.dataset = { adClient: config?.client, adSlot: unitSlot ?? config?.articleSlotId };
    elements['article-ad-region'].appendChild(unit);
  }
  const meta = new Element('meta');
  meta.nonce = nonce;
  const head = new Element('head');
  let window;
  const appendChild = head.appendChild.bind(head);
  head.appendChild = element => {
    assert.equal(window.adsbygoogle.pauseAdRequests, 1, 'ad tag must be attached while requests are paused');
    return appendChild(element);
  };
  const document = {
    head,
    body: { dataset: { page } },
    getElementById: id => elements[id] ?? head.children.find(element => element.id === id) ?? null,
    querySelector: selector => selector === 'meta[property="csp-nonce"]' ? meta : null,
    createElement: tag => new Element(tag),
  };
  let callback;
  let apiReady = initiallyReady;
  let revocations = 0;
  const apiCalls = [];
  const pending = [];
  const googlefc = {
    callbackQueue: {
      push(entry) {
        if (apiReady) entry.CONSENT_API_READY?.();
        else pending.push(entry);
      },
    },
    showRevocationMessage: () => { revocations += 1; },
  };
  window = {
    location: new URL(url),
    googlefc,
    __tcfapi: (command, version, fn, listenerId) => {
      apiCalls.push({ command, version, listenerId });
      if (command === 'addEventListener') callback = fn;
    },
  };
  const timers = new Map();
  let nextTimer = 1;
  const initialize = () => initializeAdvertising({
    document, window,
    setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const controller = initialize();
  return {
    document, window, elements, head, meta, apiCalls, controller, timers, initialize,
    ready() {
      apiReady = true;
      for (const entry of pending.splice(0)) entry.CONSENT_API_READY?.();
    },
    send(data, success = true) { assert.equal(typeof callback, 'function'); callback(data, success); },
    timeout() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    get revocations() { return revocations; },
  };
}

test('advertising policy defaults off and preserves the existing public publisher', () => {
  assert.deepEqual(createAdPolicy(), {
    mode: 'off', client: ADSENSE_CLIENT, articleSlotId: '', siteReady: false,
    cmpPublished: false, cmpVerified: false, autoAdsDisabled: false,
  });
  assert.ok(Object.isFrozen(createAdPolicy()));
  assert.equal(createAdPolicy({ mode: 'consent' }).mode, 'consent');
  assert.throws(() => createAdPolicy({ mode: 'automatic' }), /Unknown AdSense mode/);
  assert.throws(() => createAdPolicy({ client: 'pub-123' }), /ca-pub/);
  assert.throws(() => createAdPolicy({ articleSlotId: 'placeholder' }), /only digits/);
});

test('live build policy requires every verified activation prerequisite', () => {
  assert.equal(createAdPolicy(readyPolicy).mode, 'live');
  for (const key of ['siteReady', 'cmpPublished', 'cmpVerified', 'autoAdsDisabled']) {
    assert.throws(() => createAdPolicy({ ...readyPolicy, [key]: false }), new RegExp(key));
    assert.throws(() => createAdPolicy({ ...readyPolicy, [key]: 'true' }), new RegExp(key));
  }
  assert.throws(() => createAdPolicy({ ...readyPolicy, articleSlotId: '' }), /articleSlotId/);
});

test('environment activation requires explicit true values', () => {
  assert.equal(adPolicyFromEnv({}).mode, 'off');
  const env = {
    ADSENSE_MODE: 'live', ADSENSE_ARTICLE_SLOT_ID: '1234567890',
    ADSENSE_SITE_READY: 'true', ADSENSE_CMP_PUBLISHED: 'true',
    ADSENSE_CMP_VERIFIED: 'true', ADSENSE_AUTO_ADS_DISABLED: 'true',
  };
  assert.deepEqual(adPolicyFromEnv(env), createAdPolicy(readyPolicy));
  for (const value of ['false', '1', 'TRUE', undefined]) {
    assert.throws(() => adPolicyFromEnv({ ...env, ADSENSE_SITE_READY: value }), /siteReady/);
  }
});

test('the consent gate requires settled success, GDPR applicability, Google and all necessary purposes', () => {
  assert.equal(permitsPersonalizedAds(consent(), true), true);
  for (const eventStatus of ['cmpuishown', undefined, 'unknown']) {
    assert.equal(permitsPersonalizedAds(consent({ eventStatus }), true), false);
  }
  assert.equal(permitsPersonalizedAds(consent(), false), false);
  assert.equal(permitsPersonalizedAds(consent({ gdprApplies: undefined }), true), false);
  assert.equal(permitsPersonalizedAds(consent({ tcString: undefined }), true), false);
  assert.equal(permitsPersonalizedAds(consent({ tcString: '' }), true), false);
  assert.equal(permitsPersonalizedAds(consent({ cmpStatus: 'loading' }), true), false);
  assert.equal(permitsPersonalizedAds(consent({ vendor: { consents: { 755: false } } }), true), false);
  for (const purpose of [1, 3, 4]) {
    const data = consent();
    data.purpose.consents[purpose] = false;
    assert.equal(permitsPersonalizedAds(data, true), false, `Purpose ${purpose}`);
  }
  for (const purpose of [2, 7, 9, 10]) {
    const data = consent();
    data.purpose.legitimateInterests[purpose] = false;
    assert.equal(permitsPersonalizedAds(data, true), false, `Purpose ${purpose}`);
    data.purpose.consents[purpose] = true;
    assert.equal(permitsPersonalizedAds(data, true), true, `Consent basis for purpose ${purpose}`);
  }
  assert.equal(permitsPersonalizedAds(consent({ vendor: { consents: { 755: true }, legitimateInterests: { 755: false } } }), true), false);
  assert.equal(permitsPersonalizedAds(consent({ gdprApplies: false, vendor: undefined, purpose: undefined }), true), true);
});

test('off mode, privacy pages and preview origins never create Google scripts or queues', () => {
  for (const options of [
    { config: { ...liveConfig, mode: 'off' } },
    { page: 'privacy' },
    { url: 'http://localhost:5173/' },
    { url: 'https://gifframeextractor.pages.dev/' },
    { url: 'https://test.gifframeextractor.pages.dev/' },
    { url: 'https://www.gifsplitter.com.evil.example/' },
  ]) {
    const h = harness(options);
    assert.equal(h.head.children.length, 0);
    assert.equal(h.window.adsbygoogle, undefined);
    assert.equal(h.controller.getState().active, false);
    assert.equal(h.elements['privacy-settings'].disabled, true);
    assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable);
  }
});

test('invalid configuration or slot never creates a Google request', () => {
  for (const config of [null, { ...liveConfig, client: 'invalid' }, { ...liveConfig, articleSlotId: '' }]) {
    const h = harness({ config });
    assert.equal(h.head.children.length, 0);
    assert.equal(h.window.adsbygoogle, undefined);
  }
});

test('bootstrap pauses requests before attaching the tag and carries the response nonce', () => {
  const h = harness();
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.window.adsbygoogle.length, 0);
  assert.equal(h.head.children.length, 1);
  const script = h.head.children[0];
  assert.equal(script.nonce, 'request-nonce');
  assert.equal(script.async, true);
  assert.equal(script.crossOrigin, 'anonymous');
  assert.equal(script.src, `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`);
  assert.equal(h.elements['privacy-settings'].disabled, true);
  h.ready();
  assert.equal(h.timers.size, 1);
  assert.deepEqual(h.apiCalls[0], { command: 'addEventListener', version: 0, listenerId: undefined });
  assert.equal(h.elements['privacy-settings'].disabled, false);
  h.send(consent());
  assert.equal(h.timers.size, 0);
  assert.equal(h.elements['privacy-status'].textContent, '');
});

test('missing or unreplaced CSP nonce prevents the Google tag from loading', () => {
  for (const nonce of ['', '__CSP_NONCE__']) {
    const h = harness({ nonce });
    assert.equal(h.head.children.length, 0);
    assert.equal(h.window.adsbygoogle, undefined);
    assert.equal(h.controller.getState().reason, 'nonce-unavailable');
    assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable);
  }
});

test('an already ready CMP clears the watchdog only after settled consent data', () => {
  const h = harness({ initiallyReady: true });
  assert.equal(h.controller.getState().apiReady, true);
  assert.equal(h.timers.size, 1);
  h.send(consent());
  assert.equal(h.timers.size, 0);
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.controller.getState().failed, false);
});

test('an available CMP API without settled data fails closed when the watchdog expires', () => {
  const h = harness({ initiallyReady: true });
  h.timeout();
  h.send(consent());
  assert.equal(h.window.adsbygoogle.length, 0);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.controller.getState().failed, true);
  assert.equal(h.elements['article-ad-region'].hidden, true);
});

test('a missing revocation API hides the unavailable settings button with a visible explanation', () => {
  const h = harness();
  delete h.window.googlefc.showRevocationMessage;
  h.ready();
  assert.equal(h.elements['privacy-settings'].disabled, true);
  assert.equal(h.elements['privacy-settings'].hidden, true);
  assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable);
  assert.equal(h.controller.requestPrivacySettings(), false);
  assert.equal(h.controller.getState().failed, true);
  assert.equal(h.window.adsbygoogle.length, 0);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.apiCalls.length, 0);
});

test('a healthy visible CMP waits for a slow visitor without expiring or granting consent', () => {
  const h = harness();
  h.ready();
  h.send(consent({ eventStatus: 'cmpuishown' }));
  assert.equal(h.timers.size, 0);
  h.timeout();
  assert.equal(h.controller.getState().failed, false);
  assert.equal(h.window.adsbygoogle.length, 0);
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.window.adsbygoogle.length, 1);
});

test('losing the revocation API after an ad request fails closed when settings are clicked', () => {
  const h = harness();
  h.ready();
  h.send(consent());
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 0);
  delete h.window.googlefc.showRevocationMessage;
  h.elements['privacy-settings'].dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(h.controller.getState().failed, true);
  assert.equal(h.controller.getState().reason, 'revocation-api-unavailable');
  assert.equal(h.controller.getState().retired, true);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
  assert.equal(h.elements['privacy-settings'].disabled, true);
  assert.equal(h.elements['privacy-settings'].hidden, true);
  assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable);
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
  assert.equal(h.revocations, 0);
});

test('an inconsistent rendered slot cannot trigger a request', () => {
  const h = harness({ unitSlot: 'other-slot' });
  h.ready();
  h.send(consent());
  assert.equal(h.window.adsbygoogle.length, 0);
});

test('consent mode and homepages keep every advertisement paused even with permission', () => {
  for (const options of [{ config: { ...liveConfig, mode: 'consent' } }, { page: 'home' }, { page: 'about' }, { page: 'terms' }, { hasRegion: false }]) {
    const h = harness(options);
    h.ready();
    h.send(consent());
    assert.equal(h.window.adsbygoogle.length, 0);
    assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
    if (h.elements['article-ad-region']) assert.equal(h.elements['article-ad-region'].hidden, true);
  }
});

test('initial unknown, denied and partial consent do not request NPA or any advertisement', () => {
  const h = harness();
  h.ready();
  h.send(consent({ gdprApplies: undefined }));
  h.send(consent({ eventStatus: 'cmpuishown' }));
  const partial = consent({ eventStatus: 'useractioncomplete' });
  partial.purpose.consents[3] = false;
  h.send(partial);
  const denied = consent({ eventStatus: 'useractioncomplete' });
  denied.purpose.consents[1] = false;
  h.send(denied);
  assert.equal(h.window.adsbygoogle.length, 0);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.window.adsbygoogle.requestNonPersonalizedAds, undefined);
  assert.equal(h.elements['article-ad-region'].hidden, true);
});

test('only one article request is made across repeated allowed callbacks and repeated initialization', () => {
  const h = harness();
  h.ready();
  h.send(consent());
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 0);
  assert.equal(h.elements['article-ad-region'].hidden, false);
  assert.equal(h.initialize(), h.controller);
  assert.equal(h.head.children.length, 1);
});

test('explicitly outside GDPR can request one article ad after settled data', () => {
  const h = harness();
  h.ready();
  h.send(consent({ gdprApplies: false, purpose: undefined, vendor: undefined }));
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.elements['privacy-settings'].disabled, true);
  assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable);
});

test('opening preferences pauses and retires an existing ad without refresh or another request', () => {
  const h = harness();
  h.ready();
  h.send(consent());
  h.elements['privacy-settings'].dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(h.revocations, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
  assert.equal(h.controller.getState().retired, true);
  h.send(consent()); // Stale stored choices must not resume the view.
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
  assert.equal(h.elements['privacy-status'].textContent, labels.privacyUpdated);
  assert.equal(h.window.location.href, 'https://www.gifsplitter.com/how-to-extract-gif-frames/');
});

test('consent withdrawal from CMP callbacks retires the previous ad', () => {
  const h = harness();
  h.ready();
  h.send(consent());
  h.send(consent({ eventStatus: 'cmpuishown' }));
  const denied = consent({ eventStatus: 'useractioncomplete' });
  denied.purpose.consents[1] = false;
  h.send(denied);
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.window.adsbygoogle.length, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
});

test('the privacy-page destination query opens preferences without consuming stored consent', () => {
  const h = harness({ url: 'https://www.gifsplitter.com/?privacy-settings=1', page: 'home' });
  h.ready();
  assert.equal(h.revocations, 1);
  h.send(consent());
  assert.equal(h.controller.getState().consentAllowed, false);
  assert.equal(h.window.adsbygoogle.length, 0);
  h.send(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(h.elements['privacy-status'].textContent, labels.privacyUpdated);
});

test('ad blocking, missing API, failed consent and timeouts stay closed despite late success', () => {
  for (const failure of ['tag-error', 'timeout', 'missing-api', 'consent-error']) {
    const h = harness();
    if (failure === 'tag-error') h.head.children[0].dispatchEvent(new Event('error'));
    if (failure === 'timeout') h.timeout();
    if (failure === 'missing-api') { delete h.window.__tcfapi; h.ready(); }
    if (failure === 'consent-error') { h.ready(); h.send(consent(), false); h.send(consent()); }
    if (failure === 'tag-error' || failure === 'timeout') h.ready();
    assert.equal(h.controller.getState().failed, true, failure);
    assert.equal(h.window.adsbygoogle.length, 0, failure);
    assert.equal(h.window.adsbygoogle.pauseAdRequests, 1, failure);
    assert.equal(h.elements['article-ad-region'].hidden, true, failure);
    assert.equal(h.elements['privacy-settings'].disabled, true, failure);
    assert.equal(h.elements['privacy-status'].textContent, labels.privacyUnavailable, failure);
  }
});

test('a failed ad push is terminal and later callbacks cannot retry it', () => {
  const h = harness();
  let attempts = 0;
  h.window.adsbygoogle.push = () => { attempts += 1; throw new Error('blocked'); };
  h.ready();
  h.send(consent());
  h.send(consent());
  assert.equal(attempts, 1);
  assert.equal(h.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(h.elements['article-ad-region'].hidden, true);
  assert.equal(h.controller.getState().failed, true);
});

test('disposal unregisters its TCF listener and prevents future requests', () => {
  const h = harness();
  h.ready();
  h.send(consent({ eventStatus: 'cmpuishown' }));
  h.controller.destroy();
  h.send(consent());
  assert.equal(h.window.adsbygoogle.length, 0);
  assert.deepEqual(h.apiCalls.at(-1), { command: 'removeEventListener', version: 0, listenerId: 42 });
  assert.equal(h.elements['article-ad-region'].hidden, true);
});
