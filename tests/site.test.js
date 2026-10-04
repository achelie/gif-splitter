import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocales } from '../src/site/content.js';
import { ORIGIN, LOCALES, PAGE_TYPES, ROUTES, pagePath } from '../src/site/config.js';
import { renderPage } from '../src/site/render.js';

const locales = await loadLocales();
const suffixes = { home: '', guide: 'how-to-extract-gif-frames/', about: 'about/', privacy: 'privacy/' };
const expectedPath = (locale, type) => `${locale === 'en' ? '/' : `/${locale}/`}${suffixes[type]}`;
const decodeHtml = (value) => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity]);
const textOf = (html) => decodeHtml(html.replace(/<[^>]*>/g, ''));
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], decodeHtml(match[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((match) => attributes(match[0]));
const links = (html) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({ ...attributes(match[1]), text: textOf(match[2]) }));
const scriptContents = (html, filter) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((match) => filter(attributes(match[1])))
  .map((match) => match[2]);
const assetPaths = { styles: ['/assets/site-test.css'], scripts: ['/assets/site-test.js'] };
const rendered = new Map(ROUTES.map((route) => [route.path, renderPage(locales, route, assetPaths)]));
const routesByPath = new Map(ROUTES.map((route) => [route.path, route]));

function languageMenu(html) {
  const match = html.match(/<nav class="language-options"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(match, 'the language switcher must be present in static HTML');
  return match[0];
}

function checkInternalLinks(html, route) {
  for (const link of links(html)) {
    if (!link.href.startsWith('/') && !link.href.startsWith('#')) continue;
    const destination = new URL(link.href, ORIGIN + route.path);
    assert.equal(destination.origin, ORIGIN, `unexpected internal origin: ${link.href}`);
    const target = rendered.get(destination.pathname);
    assert.ok(target, `internal route must exist: ${route.path} -> ${link.href}`);
    if (destination.hash) {
      const id = decodeURIComponent(destination.hash.slice(1));
      assert.ok(tags(target, '[a-z][a-z0-9]*').some((tag) => tag.id === id), `anchor must exist: ${route.path} -> ${link.href}`);
    }
  }

  // Ordinary navigation must remain in the current language; only the menu crosses locales.
  const withoutLanguageMenu = html.replace(languageMenu(html), '');
  for (const link of links(withoutLanguageMenu)) {
    if (!link.href.startsWith('/') && !link.href.startsWith('#')) continue;
    const path = new URL(link.href, ORIGIN + route.path).pathname;
    assert.equal(routesByPath.get(path)?.locale, route.locale, `navigation changed language: ${link.href}`);
  }
}

test('routes cover exactly ten languages and four page types without changing English URLs', () => {
  assert.equal(ORIGIN, 'https://gifframeextractor.com');
  assert.deepEqual(PAGE_TYPES, ['home', 'guide', 'about', 'privacy']);
  assert.equal(ROUTES.length, 40);
  assert.equal(new Set(ROUTES.map((route) => route.path)).size, 40);
  for (const locale of LOCALES) {
    for (const type of Object.keys(suffixes)) {
      const path = expectedPath(locale, type);
      assert.equal(pagePath(locale, type), path);
      assert.equal(ROUTES.filter((route) => route.locale === locale && route.type === type && route.path === path).length, 1);
    }
  }
  assert.equal(pagePath('en'), '/');
  assert.equal(pagePath('en', 'guide'), '/how-to-extract-gif-frames/');
  assert.throws(() => pagePath('xx', 'home'), /Unknown site route/);
  assert.throws(() => pagePath('ja', 'unknown'), /Unknown site route/);
});

test('all forty pages have their own localized title, description and H1', () => {
  for (const type of PAGE_TYPES) {
    const titles = new Set();
    const descriptions = new Set();
    const headings = new Set();
    for (const locale of LOCALES) {
      const dictionary = locales[locale];
      titles.add(dictionary.seo[type].title);
      descriptions.add(dictionary.seo[type].description);
      headings.add(type === 'home' ? dictionary.home.h1 : dictionary.pages[type].h1);
    }
    assert.equal(titles.size, 10, `${type} titles must not reuse an English fallback`);
    assert.equal(descriptions.size, 10, `${type} descriptions must not reuse an English fallback`);
    assert.equal(headings.size, 10, `${type} H1 headings must not reuse an English fallback`);
  }
  assert.equal(new Set(ROUTES.map(({ locale, type }) => locales[locale].seo[type].title)).size, 40);
});

for (const route of ROUTES) {
  test(`${route.path}: localized static content, SEO alternates, navigation and structured data`, () => {
    const { locale, type } = route;
    const dictionary = locales[locale];
    const html = rendered.get(route.path);
    const canonical = ORIGIN + expectedPath(locale, type);
    const seo = dictionary.seo[type];
    const meta = tags(html, 'meta');
    const documentLinks = tags(html, 'link');

    assert.equal(tags(html, 'html')[0].lang, dictionary.htmlLang);
    assert.deepEqual(tags(html, 'body')[0], { 'data-locale': locale, 'data-page': type });
    const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)];
    assert.equal(titles.length, 1);
    assert.equal(textOf(titles[0][1]), seo.title);
    assert.equal(meta.find((tag) => tag.name === 'description')?.content, seo.description);
    assert.equal(meta.find((tag) => tag.name === 'robots')?.content, 'noindex, follow');
    assert.deepEqual(documentLinks.filter((tag) => tag.rel === 'canonical'), [{ rel: 'canonical', href: canonical }]);
    assert.equal(meta.find((tag) => tag.property === 'og:url')?.content, canonical);
    assert.equal(meta.find((tag) => tag.property === 'og:locale')?.content, dictionary.ogLocale);
    assert.equal(meta.find((tag) => tag.property === 'og:title')?.content, seo.title);
    assert.equal(meta.find((tag) => tag.property === 'og:description')?.content, seo.description);
    assert.equal(meta.find((tag) => tag.name === 'twitter:title')?.content, seo.title);

    const alternates = documentLinks.filter((tag) => tag.rel === 'alternate');
    assert.equal(alternates.length, 11);
    assert.equal(new Set(alternates.map((tag) => tag.hreflang)).size, 11);
    for (const id of LOCALES) {
      assert.equal(alternates.find((tag) => tag.hreflang === locales[id].htmlLang)?.href, ORIGIN + expectedPath(id, type));
    }
    assert.equal(alternates.find((tag) => tag.hreflang === dictionary.htmlLang)?.href, canonical, 'hreflang must include itself');
    assert.equal(alternates.find((tag) => tag.hreflang === 'x-default')?.href, ORIGIN + expectedPath('en', type));

    const menuLinks = links(languageMenu(html));
    assert.equal(menuLinks.length, 10);
    assert.equal(menuLinks.filter((link) => link['aria-current'] === 'page').length, 1);
    for (const [index, id] of LOCALES.entries()) {
      const link = menuLinks[index];
      assert.equal(link.href, expectedPath(id, type), 'switching language must retain the page type');
      assert.equal(link.lang, locales[id].htmlLang);
      assert.equal(link.hreflang, locales[id].htmlLang);
      assert.equal(link.text, locales[id].label);
      assert.equal(link['aria-current'], id === locale ? 'page' : undefined);
    }
    checkInternalLinks(html, route);

    const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(h1.length, 1, 'a page must have a single H1');
    assert.equal(textOf(h1[0][1]), type === 'home' ? `${dictionary.home.h1}.` : dictionary.pages[type].h1);
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
    assert.ok(main, 'main content must be rendered before JavaScript runs');
    const content = textOf(main[1]);
    if (type === 'home') {
      assert.ok(content.includes(dictionary.home.description));
      assert.ok(content.includes(dictionary.home.how.intro));
      for (const item of [...dictionary.home.how.steps, ...dictionary.home.features.items]) {
        assert.ok(content.includes(item.title));
        assert.ok(content.includes(item.text));
      }
      assert.equal(dictionary.home.faq.items.length, 8);
      for (const item of dictionary.home.faq.items) {
        assert.ok(content.includes(item.q), 'FAQ question must be in static HTML');
        assert.ok(content.includes(item.a), 'FAQ answer must be in static HTML');
      }
      assert.ok(content.includes(dictionary.ui.choose));
      assert.ok(content.includes(dictionary.ui.downloadFrame));
      assert.ok(content.includes(dictionary.ui.downloadSelected));
      assert.ok(content.includes(dictionary.ui.downloadAll));
      assert.ok(html.includes('<noscript>'));
    } else {
      const page = dictionary.pages[type];
      assert.ok(content.includes(page.intro));
      for (const section of page.sections) {
        assert.ok(content.includes(section.heading));
        assert.equal(section.paragraphs.length, 2);
        for (const paragraph of section.paragraphs) assert.ok(content.includes(paragraph), 'support-page paragraphs must not require JavaScript');
      }
      assert.ok(content.includes(page.ctaTitle));
      assert.ok(content.includes(page.ctaText));
      const date = html.match(/<time datetime="2026-10-04">([^<]+)<\/time>/);
      assert.ok(date);
      assert.equal(textOf(date[1]), new Intl.DateTimeFormat(dictionary.htmlLang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date('2026-10-04T00:00:00Z')));
    }

    const structuredScripts = scriptContents(html, (tag) => tag.type === 'application/ld+json');
    assert.equal(structuredScripts.length, 1);
    const structured = JSON.parse(structuredScripts[0]);
    assert.equal(structured['@context'], 'https://schema.org');
    assert.equal(structured['@type'], type === 'home' ? 'WebApplication' : type === 'guide' ? 'Article' : 'WebPage');
    assert.equal(structured.url, canonical);
    assert.equal(structured.inLanguage, dictionary.htmlLang);
    assert.equal(structured.description, seo.description);
    if (type === 'home') {
      assert.equal(structured.isAccessibleForFree, true);
      assert.deepEqual(structured.featureList, dictionary.ui.capabilities);
      assert.equal(structured.offers.price, '0');
    } else {
      assert.equal(structured.name, seo.title);
      assert.equal(structured.headline, dictionary.pages[type].h1);
      assert.equal(structured.mainEntityOfPage, canonical);
      assert.equal(structured.publisher.url, ORIGIN);
    }

    const runtimeScripts = scriptContents(html, (tag) => tag.id === 'locale-messages' && tag.type === 'application/json');
    assert.equal(runtimeScripts.length, type === 'home' ? 1 : 0);
    if (type === 'home') {
      assert.deepEqual(JSON.parse(runtimeScripts[0]), {
        locale: dictionary.htmlLang,
        ui: dictionary.ui,
        runtime: dictionary.runtime,
        errors: dictionary.errors,
      }, 'the browser must receive this locale only, with all operational translations');
    }
  });
}

test('production indexing is explicit and leaves all production canonical URLs stable', () => {
  for (const route of ROUTES) {
    const html = renderPage(locales, route, assetPaths, { production: true });
    assert.equal(tags(html, 'meta').find((tag) => tag.name === 'robots')?.content, 'index, follow');
    assert.equal(tags(html, 'link').find((tag) => tag.rel === 'canonical')?.href, ORIGIN + expectedPath(route.locale, route.type));
    assert.ok(!html.includes('gifframeextractor.pages.dev'), 'temporary hosting must not leak into SEO URLs');
  }
});

test('rendered text, metadata and embedded locale JSON cannot break their HTML contexts', () => {
  const modified = structuredClone(locales);
  const unsafeText = 'GIF <img src=x onerror=alert(1)> & "quoted"';
  const unsafeJson = '</script><script>globalThis.injected = true</script>\u2028\u2029';
  modified.en.home.h1 = unsafeText;
  modified.en.seo.home.description = unsafeText;
  modified.en.ui.sample = unsafeJson;
  const html = renderPage(modified, { locale: 'en', type: 'home', path: '/' }, assetPaths);
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot;'));
  assert.equal(tags(html, 'meta').find((tag) => tag.name === 'description')?.content, unsafeText);
  assert.ok(!html.includes('<script>globalThis.injected'));
  const [payload] = scriptContents(html, (tag) => tag.id === 'locale-messages');
  assert.ok(payload.includes('\\u003c/script>'));
  assert.ok(payload.includes('\\u2028\\u2029'));
  assert.equal(JSON.parse(payload).ui.sample, unsafeJson);
  const [structured] = scriptContents(html, (tag) => tag.type === 'application/ld+json');
  assert.equal(JSON.parse(structured).description, unsafeText);
});
