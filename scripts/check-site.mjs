import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, PUBLIC_CONTACT_EMAIL, ROUTES, LOCALES, pagePath } from '../src/site/config.js';
import { loadLocales } from '../src/site/content.js';
import { escapeHtml } from '../src/site/render.js';
import { adPolicyFromEnv } from '../src/site/ad-policy.js';
import { prepareStaticHtml } from './static-security.mjs';

const locales = await loadLocales();
const production = process.argv.includes('--production-domain');
const useEdgeWorker = adPolicyFromEnv().mode !== 'off';
const pages = new Map(await Promise.all(ROUTES.map(async route => [route.path, await readFile(join('dist', route.path.slice(1), 'index.html'), 'utf8')])));
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(sitemapUrls.length, ROUTES.length);
assert.equal(new Set(sitemapUrls).size, ROUTES.length);
assert.deepEqual(new Set(sitemapUrls), new Set(ROUTES.map(route => ORIGIN + route.path)));
const titles = new Set();
for (const route of ROUTES) {
  const html = pages.get(route.path);
  const l = locales[route.locale];
  const title = escapeHtml(l.seo[route.type].title);
  assert.ok(!titles.has(title), `Duplicate title: ${route.path}`);
  titles.add(title);
  assert.ok(html.includes(`<title>${title}</title>`), route.path);
  assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1, route.path);
  assert.ok(html.includes(`<html lang="${l.htmlLang}">`), route.path);
  assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}${route.path}">`), route.path);
  assert.ok(!html.includes('gifframeextractor.com'), `Previous production domain: ${route.path}`);
  assert.ok(!html.includes('https://gifsplitter.com'), `Redirecting apex URL: ${route.path}`);
  assert.ok(html.includes('<meta property="og:site_name" content="GIF Splitter">'), route.path);
  assert.ok(html.includes(`<meta name="robots" content="${production ? 'index' : 'noindex'}, follow">`), route.path);
  assert.ok(sitemap.includes(`<loc>${ORIGIN}${route.path}</loc>`), route.path);
  for (const id of LOCALES) assert.ok(html.includes(`hreflang="${locales[id].htmlLang}" href="${ORIGIN}${pagePath(id, route.type)}"`), route.path);
  assert.ok(html.includes(`hreflang="x-default" href="${ORIGIN}${pagePath('en', route.type)}"`), route.path);
  for (const match of html.matchAll(/<(?:script|link|a)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('https://')) continue;
    if (target.startsWith('mailto:')) {
      assert.equal(target, `mailto:${PUBLIC_CONTACT_EMAIL}`, `Unexpected contact address: ${route.path}`);
      continue;
    }
    const resolved = new URL(target, ORIGIN + route.path);
    const path = resolved.pathname;
    const anchor = resolved.hash.slice(1);
    if (pages.has(path)) {
      const destination = pages.get(path);
      if (anchor) assert.ok(destination.includes(`id="${anchor}"`), `Broken anchor: ${route.path} → ${target}`);
    } else {
      assert.ok(path.startsWith('/'), `Unexpected relative URL: ${target}`);
      await access(join('dist', path.slice(1)));
    }
  }
  const ld = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  assert.equal(JSON.parse(ld[1]).inLanguage, l.htmlLang);
}
const headers = await readFile('dist/_headers', 'utf8');
// Rules are scoped by hostname. A preview-only noindex must never fail the
// production check, while a noindex on /* would block the real domain.
const headerRules = new Map();
let pattern;
for (const line of headers.split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (/^\S/.test(line)) {
    pattern = line.trim();
    assert.ok(!headerRules.has(pattern), `Duplicate header rule: ${pattern}`);
    headerRules.set(pattern, []);
  } else {
    assert.ok(pattern, 'Header without a URL pattern');
    headerRules.get(pattern).push(line.trim());
  }
}
const robotsHeaders = rule => (headerRules.get(rule) || []).filter(line => /^X-Robots-Tag:/i.test(line));
assert.deepEqual(robotsHeaders('/*'), production ? [] : ['X-Robots-Tag: noindex, follow']);
const previewPatterns = ['https://gifframeextractor.pages.dev/*', 'https://:version.gifframeextractor.pages.dev/*'];
for (const pattern of previewPatterns) {
  assert.deepEqual(robotsHeaders(pattern), production ? ['X-Robots-Tag: noindex, follow'] : []);
}
for (const [pattern] of headerRules) {
  if (robotsHeaders(pattern).length) assert.ok(production ? previewPatterns.includes(pattern) : pattern === '/*', `Unexpected indexing rule: ${pattern}`);
}
const robots = await readFile('dist/robots.txt', 'utf8');
assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
assert.ok(!robots.includes('Disallow: /'));
await access('dist/404.html');
const notFound = await readFile('dist/404.html', 'utf8');
assert.ok(notFound.includes('GIF Splitter'));
assert.ok(!notFound.includes('GIF Frame Extractor'));
assert.ok(/<meta\s+name="robots"\s+content="noindex"\s*>/.test(notFound), '404 must remain noindex');
for (const line of headers.split(/\r?\n/)) assert.ok(line.length <= 2000, 'Pages header line exceeds 2000 characters');
assert.ok(headerRules.size <= 100, 'Pages header rule limit exceeded');
if (useEdgeWorker) {
  await access('dist/_worker.js');
  const workerRoutes = JSON.parse(await readFile('dist/_routes.json', 'utf8'));
  assert.ok(workerRoutes.exclude.includes('/assets/*'));
  assert.ok(workerRoutes.exclude.includes('/ads.txt'));
} else {
  for (const file of ['dist/_worker.js', 'dist/_routes.json']) {
    await assert.rejects(access(file), error => error.code === 'ENOENT', `Static off build must not contain ${file}`);
  }
  const cspLines = (headerRules.get('/*') || []).filter(line => line.startsWith('Content-Security-Policy:'));
  assert.equal(cspLines.length, 1, 'Static pages need one CSP');
  assert.ok(cspLines[0].includes("script-src 'self'"));
  assert.ok(!cspLines[0].includes("'strict-dynamic'") && !cspLines[0].includes("'nonce-"));
  for (const [path, html] of pages) {
    assert.ok(!html.includes('__CSP_NONCE__'), `Static nonce placeholder: ${path}`);
    assert.ok(!html.includes('id="advertising-config"'), `Google configuration in off build: ${path}`);
    for (const hash of prepareStaticHtml(html).hashes) assert.ok(cspLines[0].includes(hash), `Unapproved inline script: ${path}`);
  }
}
console.log(`PASS: ${ROUTES.length} built pages, unique titles/H1, canonical, reciprocal hreflang, language attributes, static links, bundled assets, sitemap, ${useEdgeWorker ? 'nonce edge worker' : 'static CSP without Functions'} and indexing mode.`);
