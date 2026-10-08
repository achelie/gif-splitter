import { ORIGIN, BRAND_NAME, PUBLIC_CONTACT_EMAIL, LOCALES, PAGE_TYPES, GUIDE_TYPES, PAGE_DATES, CLOUDFLARE_BEACON_TOKEN, pagePath } from './config.js';
import { createAdPolicy } from './ad-policy.js';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const e = escapeHtml;
const privacyLinks = [
  'https://www.microsoft.com/en-us/privacy/privacystatement',
  'https://policies.google.com/technologies/partner-sites',
  'https://myadcenter.google.com/',
];
const paragraph = text => privacyLinks.reduce((html, url) => html.replaceAll(url, `<a href="${url}">${url}</a>`), e(text))
  .replaceAll(e(PUBLIC_CONTACT_EMAIL), `<!--email_off--><a href="mailto:${e(PUBLIC_CONTACT_EMAIL)}">${e(PUBLIC_CONTACT_EMAIL)}</a><!--/email_off-->`);
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const nonce = '__CSP_NONCE__';
const cmpTypes = ['home', ...GUIDE_TYPES];
const paths = {
  frames: '<rect x="7" y="7" width="14" height="14" rx="3"/><path d="M16 3H6a3 3 0 0 0-3 3v10m9-5 5 3-5 3z"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
const brand = (locale, label, withIcon = true) => `<a href="${pagePath(locale)}" class="wordmark" aria-label="${e(label)}">${withIcon ? icon('frames', 'brand-icon') : ''}<span>GIF <span class="brand-light">Splitter</span><span class="brand-dot">.</span></span></a>`;

function header(locales, locale, type) {
  const l = locales[locale];
  const u = l.ui;
  return `<a class="skip-link" href="#content">${e(u.skip)}</a>
<header class="site-header wrap">
  ${brand(locale, u.homeLabel)}
  <nav class="primary-nav" aria-label="${e(u.mainNav)}"><a ${type === 'home' ? 'class="nav-active"' : ''} href="${pagePath(locale)}#extractor">${e(u.extract)}</a><a href="${type === 'home' ? '#how-it-works' : pagePath(locale, 'guide')}">${e(u.how)}</a><a href="${pagePath(locale, 'privacy')}" class="nav-privacy">${e(u.privacy)} ${icon('lock')}</a></nav>
  <details class="language-menu"><summary aria-label="${e(u.languageNav)}: ${e(l.label)}"><span lang="${e(l.htmlLang)}">${e(l.label)}</span>${icon('chevron')}</summary><nav class="language-options" aria-label="${e(u.languageNav)}">${LOCALES.map(id => `<a href="${pagePath(id, type)}" lang="${e(locales[id].htmlLang)}" hreflang="${e(locales[id].htmlLang)}"${id === locale ? ' aria-current="page"' : ''}>${e(locales[id].label)}${id === locale ? '<span class="current-language-dot" aria-hidden="true"></span>' : ''}</a>`).join('')}</nav></details>
</header>`;
}

function footer(l, type, policy, production) {
  const settings = production && policy.mode !== 'off' ? (cmpTypes.includes(type)
    ? `<button type="button" class="text-button" id="privacy-settings" hidden>${e(l.ui.privacySettings)}</button>`
    : `<a href="${pagePath(l.locale)}?privacy-settings=1">${e(l.ui.privacySettings)}</a>`) : '';
  return `<footer class="site-footer wrap"><div class="footer-top">${brand(l.locale, l.ui.homeLabel, false)}<p>${e(l.footer.tagline)}</p></div><div class="footer-bottom"><span>${e(l.footer.copyright)}</span><nav aria-label="${e(l.ui.footerNav)}"><a href="${pagePath(l.locale, 'guide')}">${e(l.ui.guide)}</a><a href="${pagePath(l.locale, 'about')}">${e(l.ui.about)}</a><a href="${pagePath(l.locale, 'about')}#contact">${e(l.ui.contact)}</a><a href="${pagePath(l.locale, 'terms')}">${e(l.ui.terms)}</a><a href="${pagePath(l.locale, 'privacy')}">${e(l.ui.privacy)}</a>${settings}</nav></div>${production && policy.mode !== 'off' && cmpTypes.includes(type) ? `<p id="privacy-status" class="privacy-status" role="status" aria-live="polite"></p>` : ''}</footer>`;
}

function knowledge(l, current) {
  return `<section class="knowledge-section section-rule"><h2>${e(l.ui.knowledgeTitle)}</h2><p>${e(l.ui.knowledgeIntro)}</p><ul>${GUIDE_TYPES.filter(type => type !== current).map(type => `<li><a href="${pagePath(l.locale, type)}">${e(l.pages[type].h1)}</a><p>${e(l.seo[type].description)}</p></li>`).join('')}</ul></section>`;
}

function home(l) {
  const u = l.ui;
  const h = l.home;
  return `<main class="wrap" id="content">
  <section class="intro" aria-labelledby="main-title"><p class="eyebrow"><span class="status-dot"></span>${e(h.eyebrow)}</p><h1 id="main-title">${e(h.h1)}</h1><p class="lede">${e(h.lede)}</p><p class="intro-description">${e(h.description)}</p></section>
  <section id="extractor" aria-label="${e(u.toolLabel)}" data-clarity-mask="true">
    <div id="upload-area"><div class="dropzone" id="dropzone">
      <div class="drop-art" aria-hidden="true"><div class="art-card art-back"></div><div class="art-card art-mid"></div><div class="art-card art-front">${icon('image')}</div><span class="art-plus">+</span></div>
      <h2>${e(u.dropTitle)}</h2><p>${e(u.dropText)}</p><button type="button" id="choose-file" class="button primary">${icon('upload')}${e(u.choose)}</button><p class="file-hint">${e(u.fileHint)}<span>${e(u.outputHint)}</span></p>
    </div><div class="below-drop"><span>${icon('lock')}${e(u.local)}</span><button type="button" id="sample-button" class="text-button">${e(u.sample)}${icon('arrow')}</button></div></div>
    <input class="sr-only" type="file" id="file-input" accept="image/gif,.gif" aria-label="${e(u.inputLabel)}" tabindex="-1">
    <div id="status" class="status-message" role="status" aria-live="polite"></div>
    <div id="progress-panel" class="progress-panel" hidden><div class="progress-heading"><span id="progress-label">${e(l.runtime.reading)}</span><button id="cancel-button" type="button" class="text-button">${e(u.cancel)}</button></div><progress id="progress" value="0" max="100" aria-label="${e(u.progressLabel)}"></progress><p>${e(u.progressNote)}</p></div>
    <section id="results" class="results" aria-labelledby="results-title" hidden>
      <div class="results-toolbar"><div><p class="section-label">${e(u.resultsLabel)}</p><h2 id="results-title">${e(u.resultsTitle)}</h2></div><button type="button" class="button" id="start-over">${e(u.another)}</button></div>
      <div class="workspace"><div class="preview-panel">
        <div id="frame-preview-slot" class="frame-stage checkerboard"></div>
        <div class="playback-controls"><button id="previous-frame" type="button" class="icon-button" aria-label="${e(u.previous)}">←</button><button id="play-button" type="button" class="button small">${e(u.play)}</button><button id="next-frame" type="button" class="icon-button" aria-label="${e(u.next)}">→</button></div>
        <label class="scrubber-label" for="frame-slider"><span id="current-frame-label"></span><span id="current-frame-delay"></span></label><input id="frame-slider" type="range" min="1" value="1" max="1" aria-label="${e(u.slider)}">
        <button type="button" class="button download-frame" id="download-frame">${icon('download')}${e(u.downloadFrame)}<span class="format-label">PNG</span></button>
      </div><div class="file-panel"><h3 id="file-name"></h3><p id="file-summary" class="muted"></p><dl class="file-stats"><div><dt>${e(u.frames)}</dt><dd id="stat-frames"></dd></div><div><dt>${e(u.dimensions)}</dt><dd id="stat-size"></dd></div><div><dt>${e(u.duration)}</dt><dd id="stat-duration"></dd></div><div><dt>${e(u.output)}</dt><dd>PNG</dd></div></dl>
        <div class="download-block"><h3>${e(u.downloadTitle)}</h3><p>${e(u.downloadText)}</p><button type="button" id="download-all" class="button primary">${icon('download')}${e(u.downloadAll)}<span class="format-label">ZIP</span></button><span class="local-note">${icon('lock')}${e(u.localNote)}</span></div>
      </div></div>
      <div class="grid-toolbar"><div><h3>${e(u.allFrames)}</h3><span id="selection-count"></span></div><div class="grid-actions"><button class="text-button" id="select-all" type="button">${e(u.selectAll)}</button><button class="button small" id="download-selected" type="button" disabled>${icon('download')}${e(u.downloadSelected)}</button></div></div><p class="grid-hint">${e(u.gridHint)}</p><div class="frame-grid" id="frame-grid"></div><button id="show-more" class="button show-more" type="button" hidden>${e(u.showMore)}</button>
    </section>
    <noscript><p class="status-message">${e(u.noscript)} <a href="${pagePath(l.locale, 'guide')}">${e(u.guide)}</a></p></noscript>
  </section>
  <div class="capability-strip" id="capabilities">${u.capabilities.map((text, i) => `<span>${icon(['frames', 'image', 'download', 'check'][i])}${e(text)}</span>`).join('')}</div>
  <section class="how-section section-rule" id="how-it-works"><div><p class="section-label">${e(h.how.label)}</p><h2>${e(h.how.title)}</h2><p>${e(h.how.intro)}</p><a class="inline-link" href="${pagePath(l.locale, 'guide')}">${e(u.readGuide)}${icon('arrow')}</a></div><ol class="steps">${h.how.steps.map((step, i) => `<li><span>0${i + 1}</span><div><h3>${e(step.title)}</h3><p>${e(step.text)}</p></div></li>`).join('')}</ol></section>
  <section class="details-section section-rule"><div class="section-heading"><h2>${e(h.features.title)}</h2><p>${e(h.features.description)}</p></div><div class="feature-grid">${h.features.items.map((item, i) => `<article>${icon(['image', 'frames', 'lock'][i])}<h3>${e(item.title)}</h3><p>${e(item.text)}</p></article>`).join('')}</div></section>
  <section class="faq-section" id="faq"><div><p class="section-label">${e(h.faq.label)}</p><h2>${e(h.faq.title)}</h2><p>${e(h.faq.intro)}</p></div><div class="faqs">${h.faq.items.map(item => `<details><summary>${e(item.q)}<span aria-hidden="true">+</span></summary><p>${e(item.a)}</p></details>`).join('')}</div></section>
  ${knowledge(l, 'home')}
</main>`;
}

function article(l, type, policy, production) {
  const p = l.pages[type];
  const date = PAGE_DATES[type].modified;
  const isGuide = GUIDE_TYPES.includes(type);
  const sections = p.sections.map((section, index) => type === 'privacy' && index === 4 && policy.mode !== 'off'
    ? p[policy.mode === 'live' ? 'advertisingLive' : 'advertisingConsent'] : section);
  const ad = production && policy.mode === 'live' && isGuide ? `<aside id="article-ad-region" class="article-ad" hidden aria-label="${e(l.ui.advertisements)}"><p>${e(l.ui.advertisements)}</p><ins class="adsbygoogle" style="display:block" data-ad-client="${e(policy.client)}" data-ad-slot="${e(policy.articleSlotId)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>` : '';
  const samples = { guide: ['sample'], transparency: ['disposal-2', 'disposal-3'], timing: ['timing'], troubleshooting: ['memory-limit'] };
  const example = isGuide && p.example ? `<figure class="article-example">${type === 'transparency' ? `<img src="/examples/disposal-comparison.svg" width="720" height="280" loading="lazy" alt="${e(p.example.caption)}">` : ''}<figcaption>${e(p.example.caption)}</figcaption><div>${samples[type].map(sample => `<a class="inline-link" href="${pagePath(l.locale)}?example=${sample}">${e(p.example.label)}${samples[type].length > 1 ? ` (${sample === 'disposal-2' ? '2' : '3'})` : ''}</a>`).join(' ')}</div></figure>` : '';
  const updated = new Intl.DateTimeFormat(l.htmlLang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  return `<main class="article-main wrap" id="content"><article>
    <p class="section-label">${e(p.eyebrow)}</p><h1>${e(p.h1)}</h1><p class="article-lead">${e(p.intro)}</p><p class="article-meta">${e(l.ui.updated)}: <time datetime="${date}">${e(updated)}</time></p>
    ${isGuide ? `<nav class="article-toc" aria-label="${e(l.ui.onThisPage)}"><h2>${e(l.ui.onThisPage)}</h2><ol>${sections.map((section, i) => `<li><a href="#section-${i + 1}">${e(section.heading)}</a></li>`).join('')}</ol></nav>` : ''}
    ${sections.map((section, i) => `<section id="section-${i + 1}"><h2>${e(section.heading)}</h2>${section.paragraphs.map(text => `<p>${paragraph(text)}</p>`).join('')}</section>${i === 1 ? ad : ''}${i === 2 ? example : ''}`).join('')}
    ${type === 'about' ? `<section id="contact" aria-labelledby="contact-heading"><h2 id="contact-heading">${e(p.contact.heading)}</h2>${p.contact.paragraphs.map(text => `<p>${paragraph(text)}</p>`).join('')}<p><!--email_off--><a class="inline-link" href="mailto:${e(PUBLIC_CONTACT_EMAIL)}">${e(PUBLIC_CONTACT_EMAIL)}</a><!--/email_off--></p></section>` : ''}
    ${isGuide ? knowledge(l, type) : ''}
    <aside class="article-cta"><h2>${e(p.ctaTitle)}</h2><p>${e(p.ctaText)}</p><a class="button primary" href="${pagePath(l.locale)}">${e(l.ui.openTool)}${icon('arrow')}</a></aside>
    <nav class="article-related" aria-label="${e(l.ui.related)}">${PAGE_TYPES.filter(item => item !== type && item !== 'home').map(item => `<a href="${pagePath(l.locale, item)}">${e(l.ui[item])}</a>`).join('')}</nav>
  </article></main>`;
}

export function renderPage(locales, route, assets, { production = false, adPolicy = createAdPolicy() } = {}) {
  const { locale, type } = route;
  const l = locales[locale];
  const seo = l.seo[type];
  const canonical = ORIGIN + pagePath(locale, type);
  const structured = type === 'home' ? {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: BRAND_NAME, url: canonical, inLanguage: l.htmlLang,
    description: seo.description, applicationCategory: 'MultimediaApplication', operatingSystem: 'Any', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: l.ui.capabilities,
  } : {
    '@context': 'https://schema.org', '@type': GUIDE_TYPES.includes(type) ? 'Article' : 'WebPage', name: seo.title, headline: l.pages[type].h1,
    description: seo.description, inLanguage: l.htmlLang, url: canonical, mainEntityOfPage: canonical,
    datePublished: PAGE_DATES[type].published, dateModified: PAGE_DATES[type].modified, publisher: { '@type': 'Organization', name: BRAND_NAME, url: ORIGIN },
  };
  return `<!doctype html>
<html lang="${e(l.htmlLang)}"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#fafaf9">
  <meta property="csp-nonce" nonce="${nonce}">
  <title>${e(seo.title)}</title><meta name="description" content="${e(seo.description)}"><meta name="robots" content="${production ? 'index, follow' : 'noindex, follow'}">
  <link rel="canonical" href="${canonical}">
  ${LOCALES.map(id => `<link rel="alternate" hreflang="${e(locales[id].htmlLang)}" href="${ORIGIN}${pagePath(id, type)}">`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pagePath('en', type)}"><link rel="icon" href="/favicon.png" type="image/png" sizes="256x256">
  <meta property="og:type" content="${GUIDE_TYPES.includes(type) ? 'article' : 'website'}"><meta property="og:site_name" content="${BRAND_NAME}"><meta property="og:title" content="${e(seo.title)}"><meta property="og:description" content="${e(seo.description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="${e(l.ogLocale)}"><meta property="og:image" content="${ORIGIN}/og.png">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(seo.title)}"><meta name="twitter:description" content="${e(seo.description)}"><meta name="twitter:image" content="${ORIGIN}/og.png">
  ${assets.styles.map(path => `<link rel="stylesheet" nonce="${nonce}" href="${e(path)}">`).join('\n  ')}
  <script type="application/ld+json" nonce="${nonce}">${json(structured)}</script>
  ${production && type !== 'privacy' ? `<script id="clarity-tracking" type="text/javascript" nonce="${nonce}">
    if (window.location.origin === ${json(ORIGIN)}) {
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.nonce=l.querySelector('meta[property="csp-nonce"]').nonce;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "ysiz2atokr");
    }
  </script>` : ''}
</head><body data-locale="${e(locale)}" data-page="${e(type)}">
${header(locales, locale, type)}
${type === 'home' ? home(l) : article(l, type, adPolicy, production)}
${footer(l, type, adPolicy, production)}
${type === 'home' ? `<script id="locale-messages" type="application/json" nonce="${nonce}">${json({ locale: l.htmlLang, ui: l.ui, runtime: l.runtime, errors: l.errors })}</script>` : ''}
${production && adPolicy.mode !== 'off' && cmpTypes.includes(type) ? `<script id="advertising-config" type="application/json" nonce="${nonce}">${json({ mode: adPolicy.mode, client: adPolicy.client, articleSlotId: adPolicy.articleSlotId, articleEligible: GUIDE_TYPES.includes(type), privacySettings: l.ui.privacySettings, privacyUnavailable: l.ui.privacyUnavailable, privacyPending: l.ui.privacyPending, privacyUpdated: l.ui.privacyUpdated })}</script>` : ''}
${assets.scripts.map(path => `<script type="module" nonce="${nonce}" src="${e(path)}"></script>`).join('\n')}
${production ? `<script nonce="${nonce}">if(window.location.origin===${json(ORIGIN)}){const b=document.createElement('script');b.src='https://static.cloudflareinsights.com/beacon.min.js';b.defer=true;b.nonce=document.querySelector('meta[property="csp-nonce"]').nonce;b.setAttribute('data-cf-beacon',${json(JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN, spa: false, send: { to: '/cdn-cgi/rum' } }))});document.body.appendChild(b);}</script>` : ''}
</body></html>`;
}
