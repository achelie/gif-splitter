import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, ROUTES } from '../src/site/config.js';
import { loadLocales } from '../src/site/content.js';
import { renderPage } from '../src/site/render.js';

const production = process.argv.includes('--production-domain');
const locales = await loadLocales();
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
function assetsFor(entry) {
  const styles = new Set();
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing Vite entry: ${key}`);
    chunk.imports?.forEach(visit);
    chunk.css?.forEach(file => styles.add(`/${file}`));
  }
  visit(entry);
  return { scripts: [`/${manifest[entry].file}`], styles: [...styles] };
}
const appAssets = assetsFor('src/main.js');
const siteAssets = assetsFor('src/site.js');
for (const route of ROUTES) {
  const dir = join('dist', route.path.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), renderPage(locales, route, route.type === 'home' ? appAssets : siteAssets, { production }));
}
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map(({ path }) => `  <url><loc>${ORIGIN}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('dist/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clarity.ms https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.clarity.ms https://c.bing.com; connect-src 'self' https://*.clarity.ms https://c.bing.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
${production ? '' : '  X-Robots-Tag: noindex, follow\n'}
${production ? `https://gifframeextractor.pages.dev/*
  X-Robots-Tag: noindex, follow

https://:version.gifframeextractor.pages.dev/*
  X-Robots-Tag: noindex, follow
` : ''}
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);
console.log(`Generated ${ROUTES.length} static pages in ${Object.keys(locales).length} languages; ${production ? 'production domain (indexable)' : 'temporary Cloudflare address (noindex)'}; canonical ${ORIGIN}`);
