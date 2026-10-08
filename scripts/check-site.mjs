import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, PUBLIC_CONTACT_EMAIL, ROUTES, LOCALES, pagePath } from '../src/site/config.js';
import { loadLocales } from '../src/site/content.js';
import { escapeHtml } from '../src/site/render.js';
import { adPolicyFromEnv } from '../src/site/ad-policy.js';
import { prepareStaticHtml } from './static-security.mjs';
import { createSiteResourceChecker } from './site-resources.mjs';

const locales = await loadLocales();
const production = process.argv.includes('--production-domain');
const useEdgeWorker = adPolicyFromEnv().mode !== 'off';
const pages = new Map(await Promise.all(ROUTES.map(async route => [route.path, await readFile(join('dist', route.path.slice(1), 'index.html'), 'utf8')])));
const resources = createSiteResourceChecker({ distDir: 'dist', origin: ORIGIN, pages, contactEmail: PUBLIC_CONTACT_EMAIL });
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
await resources.checkManifest(manifest, '/.vite/manifest.json', { requiredEntries: ['src/main.js', 'src/site.js'] });
const faviconLink = '<link rel="icon" href="/favicon.png" type="image/png" sizes="256x256">';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function checkIconPng(bytes, size) {
  assert.ok(bytes.subarray(0, 8).equals(pngSignature), 'Favicon must be a real PNG');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), size, 'Favicon width');
  assert.equal(bytes.readUInt32BE(20), size, 'Favicon height');
}
checkIconPng(await readFile('dist/favicon.png'), 256);
const ico = await readFile('dist/favicon.ico');
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1, 'Fallback must be a real ICO');
const iconSizes = [16, 32, 48, 64, 128, 256];
assert.equal(ico.readUInt16LE(4), iconSizes.length);
for (const [index, size] of iconSizes.entries()) {
  const entry = 6 + index * 16;
  assert.equal(ico[entry] || 256, size);
  assert.equal(ico[entry + 1] || 256, size);
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert.ok(offset >= 6 + iconSizes.length * 16 && offset + length <= ico.length);
  checkIconPng(ico.subarray(offset, offset + length), size);
}
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(sitemapUrls.length, ROUTES.length);
assert.equal(new Set(sitemapUrls).size, ROUTES.length);
assert.deepEqual(new Set(sitemapUrls), new Set(ROUTES.map(route => ORIGIN + route.path)));
const titles = new Set();
for (const route of ROUTES) {
  const html = pages.get(route.path);
  assert.ok(html.includes(faviconLink), `Missing supported favicon: ${route.path}`);
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
  await resources.checkHtml(html, route.path);
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
assert.ok(notFound.includes(faviconLink), '404 must use the same favicon');
await resources.checkHtml(notFound, '/404.html');
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
  for (const icon of ['/favicon.svg', '/favicon.png', '/favicon.ico']) {
    assert.ok(workerRoutes.exclude.includes(icon), `Favicon must bypass Functions: ${icon}`);
  }
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
console.log(`PASS: ${ROUTES.length} built pages and 404 resources, unique titles/H1, canonical, reciprocal hreflang, language attributes, links/anchors/images, Vite asset graph, sitemap, ${useEdgeWorker ? 'nonce edge worker' : 'static CSP without Functions'} and indexing mode.`);
