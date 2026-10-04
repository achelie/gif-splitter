import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const production = process.argv.includes('--production-domain');
const origin = 'https://gifframeextractor.com';
async function setRobots(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await setRobots(path);
    else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      let html = await readFile(path, 'utf8');
      const tag = `<meta name="robots" content="${production ? 'index, follow' : 'noindex, follow'}">`;
      html = /<meta\s+name="robots"[^>]*>/i.test(html)
        ? html.replace(/<meta\s+name="robots"[^>]*>/i, tag)
        : html.replace('</head>', `${tag}</head>`);
      await writeFile(path, html);
    }
  }
}
await setRobots('dist');
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
const pages = ['/', '/how-to-extract-gif-frames/', '/about/', '/privacy/'];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('dist/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
${production ? '' : '  X-Robots-Tag: noindex, follow\n'}
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);
console.log(`SEO build: ${production ? 'production domain (indexable)' : 'temporary Cloudflare address (noindex)'}; canonical ${origin}`);
