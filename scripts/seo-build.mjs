import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, ROUTES } from '../src/site/config.js';
import { loadLocales } from '../src/site/content.js';
import { renderPage } from '../src/site/render.js';
import { adPolicyFromEnv } from '../src/site/ad-policy.js';
import { build } from 'vite';
import { prepareStaticHtml, staticContentSecurityPolicy } from './static-security.mjs';

const production = process.argv.includes('--production-domain');
const adPolicy = adPolicyFromEnv();
const useEdgeWorker = adPolicy.mode !== 'off';
const staticScriptHashes = new Set();
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
  let html = renderPage(locales, route, route.type === 'home' ? appAssets : siteAssets, { production, adPolicy });
  if (!useEdgeWorker) {
    const prepared = prepareStaticHtml(html);
    html = prepared.html;
    prepared.hashes.forEach(hash => staticScriptHashes.add(hash));
  }
  await writeFile(join(dir, 'index.html'), html);
}
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map(({ path }) => `  <url><loc>${ORIGIN}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('dist/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${useEdgeWorker ? '' : `  Content-Security-Policy: ${staticContentSecurityPolicy(staticScriptHashes)}\n  Cache-Control: no-transform\n`}
${production ? '' : '  X-Robots-Tag: noindex, follow\n'}
${production ? `https://gifframeextractor.pages.dev/*
  X-Robots-Tag: noindex, follow

https://:version.gifframeextractor.pages.dev/*
  X-Robots-Tag: noindex, follow
` : ''}
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);
if (useEdgeWorker) {
  await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/examples/*', '/robots.txt', '/sitemap.xml', '/ads.txt', '/sample.gif', '/og.png', '/favicon.svg', '/favicon.png', '/favicon.ico'] }, null, 2));
  await build({
  configFile: false,
  publicDir: false,
  define: { __ADSENSE_ENABLED__: JSON.stringify(production && adPolicy.mode !== 'off') },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: false, minify: false,
    lib: { entry: 'src/edge-worker.js', formats: ['es'], fileName: () => '_worker.js' } },
  });
} else {
  // A direct generator run after a Google-enabled build must not retain a Worker.
  await rm('dist/_worker.js', { force: true });
  await rm('dist/_routes.json', { force: true });
  await rm('dist/_worker.js.map', { force: true });
}
console.log(`Generated ${ROUTES.length} static pages in ${Object.keys(locales).length} languages; ${production ? 'production domain (indexable)' : 'temporary Cloudflare address (noindex)'}; ${useEdgeWorker ? 'nonce edge worker' : 'static Pages, no Functions'}; canonical ${ORIGIN}`);
