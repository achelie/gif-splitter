import { createHash } from 'node:crypto';

/** Static off pages need no runtime nonce or Function invocation. */
export function prepareStaticHtml(html) {
  const prepared = html.replace(/\r\n?/g, '\n').replace(/ nonce="__CSP_NONCE__"/g, '');
  if (prepared.includes('__CSP_NONCE__')) throw new Error('Unresolved static CSP nonce');
  const hashes = new Set();
  for (const [, attributes, body] of prepared.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(attributes) || /\btype="application\/(?:ld\+json|json)"/.test(attributes)) continue;
    if (body.trim()) hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return { html: prepared, hashes: [...hashes] };
}

export function staticContentSecurityPolicy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(hashes)].join(' ')} https://*.clarity.ms https://c.bing.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.clarity.ms https://c.bing.com",
    "connect-src 'self' https://*.clarity.ms https://c.bing.com https://cloudflareinsights.com",
    "frame-src 'none'", "font-src 'self'", "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
  ].join('; ');
}
