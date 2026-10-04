import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, ROUTES, LOCALES, pagePath } from '../src/site/config.js';
import { loadLocales } from '../src/site/content.js';
import { escapeHtml } from '../src/site/render.js';

const locales = await loadLocales();
const production = process.argv.includes('--production-domain');
const pages = new Map(await Promise.all(ROUTES.map(async route => [route.path, await readFile(join('dist', route.path.slice(1), 'index.html'), 'utf8')])));
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
assert.equal([...sitemap.matchAll(/<loc>/g)].length, 40);
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
  assert.ok(html.includes(`<meta name="robots" content="${production ? 'index' : 'noindex'}, follow">`), route.path);
  assert.ok(sitemap.includes(`<loc>${ORIGIN}${route.path}</loc>`), route.path);
  for (const id of LOCALES) assert.ok(html.includes(`hreflang="${locales[id].htmlLang}" href="${ORIGIN}${pagePath(id, route.type)}"`), route.path);
  assert.ok(html.includes(`hreflang="x-default" href="${ORIGIN}${pagePath('en', route.type)}"`), route.path);
  for (const match of html.matchAll(/<(?:script|link|a)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('https://')) continue;
    const [path, anchor] = target.split('#');
    if (!path || pages.has(path)) {
      const destination = pages.get(path || route.path);
      if (anchor) assert.ok(destination.includes(`id="${anchor}"`), `Broken anchor: ${route.path} → ${target}`);
    } else {
      assert.ok(path.startsWith('/'), `Unexpected relative URL: ${target}`);
      await access(join('dist', path.slice(1)));
    }
  }
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.equal(JSON.parse(ld[1]).inLanguage, l.htmlLang);
}
const headers = await readFile('dist/_headers', 'utf8');
assert.equal(headers.includes('X-Robots-Tag: noindex, follow'), !production);
const robots = await readFile('dist/robots.txt', 'utf8');
assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
assert.ok(!robots.includes('Disallow: /'));
await access('dist/404.html');
console.log('PASS: 40 built pages, unique titles/H1, canonical, reciprocal hreflang, language attributes, static links, bundled assets, sitemap and indexing mode.');
