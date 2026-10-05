import { ORIGIN, ROUTES, GUIDE_TYPES } from './site/config.js';

const host = new URL(ORIGIN).hostname;
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function contentSecurityPolicy(nonce, googleEnabled) {
  const scripts = googleEnabled
    ? `'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`
    : `'nonce-${nonce}' 'strict-dynamic' 'self' https:`;
  return [
    "default-src 'self'", `script-src ${scripts}`,
    `style-src 'self' 'unsafe-inline'${googleEnabled ? ' https:' : ''}`,
    `img-src 'self' blob: data: ${googleEnabled ? 'https:' : 'https://*.clarity.ms https://c.bing.com'}`,
    `connect-src 'self' ${googleEnabled ? 'https:' : 'https://*.clarity.ms https://c.bing.com https://cloudflareinsights.com'}`,
    `frame-src ${googleEnabled ? 'https:' : "'none'"}`,
    `font-src 'self'${googleEnabled ? ' https: data:' : ''}`,
    "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
  ].join('; ');
}

export function createEdgeWorker({ advertisingEnabled = false, HTMLRewriterClass = globalThis.HTMLRewriter, random = () => crypto.getRandomValues(new Uint8Array(18)) } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const htmlPath = !/\.[a-z0-9]+$/i.test(url.pathname) || url.pathname.endsWith('.html');
      let assetRequest = request;
      if (htmlPath) {
        const headers = new Headers(request.headers);
        headers.delete('If-None-Match');
        headers.delete('If-Modified-Since');
        assetRequest = new Request(request, { headers });
      }
      const asset = await env.ASSETS.fetch(assetRequest);
      if (!asset.headers.get('Content-Type')?.includes('text/html') || (asset.status !== 200 && asset.status !== 404)) return asset;
      const nonce = btoa(String.fromCharCode(...random()));
      const route = ROUTES.find(item => item.path === url.pathname);
      const google = advertisingEnabled && url.hostname === host && route && (route.type === 'home' || GUIDE_TYPES.includes(route.type));
      const headers = new Headers(asset.headers);
      for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
      headers.set('Content-Security-Policy', contentSecurityPolicy(nonce, Boolean(google)));
      headers.set('Cache-Control', 'no-store, no-transform');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.delete('ETag'); headers.delete('Last-Modified'); headers.delete('Content-Length');
      if (url.hostname !== host || asset.status === 404) headers.set('X-Robots-Tag', 'noindex, follow');
      else headers.delete('X-Robots-Tag');
      const response = new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
      if (request.method === 'HEAD') return response;
      return new HTMLRewriterClass()
        .on('script, style, link[rel="stylesheet"], link[rel="modulepreload"], meta[property="csp-nonce"]', {
          element(element) { element.setAttribute('nonce', nonce); },
        }).transform(response);
    },
  };
}

export default createEdgeWorker({ advertisingEnabled: typeof __ADSENSE_ENABLED__ !== 'undefined' && __ADSENSE_ENABLED__ });
