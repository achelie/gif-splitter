import test from 'node:test';
import assert from 'node:assert/strict';
import { createEdgeWorker } from '../src/edge-worker.js';

// The live Wrangler/browser check exercises Cloudflare's HTMLRewriter. This
// adapter lets unit tests inspect nonce/header/cache behavior without a service.
class HtmlRewriterAdapter {
  on(selector, handler) { this.handler = handler; return this; }
  async transform(response) {
    const body = await response.text();
    const html = body.replace(/<(script|style|link|meta)\b[^>]*>/g, (tag, name) => {
      if (name === 'link' && !/rel="(?:stylesheet|modulepreload)"/.test(tag)) return tag;
      if (name === 'meta' && !/property="csp-nonce"/.test(tag)) return tag;
      let result = tag;
      this.handler.element({ setAttribute(key, value) {
        result = result.replace(new RegExp(` ${key}="[^"]*"`, 'g'), '').replace(/>$/, ` ${key}="${value}">`);
      } });
      return result;
    });
    return new Response(html, response);
  }
}

const html = '<html><head><meta property="csp-nonce" nonce="__CSP_NONCE__"><link rel="canonical" href="https://www.gifsplitter.com/"><link rel="stylesheet" href="/assets/a.css"><script nonce="__CSP_NONCE__">a()</script></head><body><script type="module" src="/assets/a.js"></script></body></html>';
const assetResponse = (status = 200) => new Response(html, { status, headers: {
  'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'",
  'ETag': 'old', 'Last-Modified': 'yesterday', 'X-Robots-Tag': 'noindex, follow',
} });

test('each HTML response receives a fresh matching nonce and cannot reuse a conditional cached body', async () => {
  const requests = [];
  let sequence = 0;
  const worker = createEdgeWorker({ HTMLRewriterClass: HtmlRewriterAdapter, random: () => new Uint8Array(18).fill(++sequence) });
  const env = { ASSETS: { fetch(request) { requests.push(request); return assetResponse(); } } };
  const request = new Request('https://www.gifsplitter.com/', { headers: { 'If-None-Match': 'old', 'If-Modified-Since': 'yesterday' } });
  const responses = await Promise.all([worker.fetch(request, env), worker.fetch(request, env)]);
  const nonces = [];
  for (const response of responses) {
    const body = await response.text();
    const nonce = response.headers.get('Content-Security-Policy').match(/'nonce-([^']+)'/)[1];
    nonces.push(nonce);
    assert.ok(!body.includes('__CSP_NONCE__'));
    assert.equal([...body.matchAll(/nonce="([^"]+)"/g)].length, 4);
    assert.ok([...body.matchAll(/nonce="([^"]+)"/g)].every(match => match[1] === nonce));
    assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform');
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('ETag'), null);
    assert.equal(response.headers.get('Last-Modified'), null);
    assert.equal(response.headers.get('X-Robots-Tag'), null);
    assert.ok(!response.headers.get('Content-Security-Policy').includes("default-src 'none'"));
  }
  assert.notEqual(...nonces);
  assert.ok(requests.every(request => !request.headers.has('If-None-Match') && !request.headers.has('If-Modified-Since')));
});

test('Google CSP applies only to production CMP routes and keeps policy/error/preview frames disabled', async () => {
  const worker = createEdgeWorker({ advertisingEnabled: true, HTMLRewriterClass: HtmlRewriterAdapter });
  for (const [url, status, frames, noindex] of [
    ['https://www.gifsplitter.com/gif-frame-timing/', 200, 'https:', false],
    ['https://www.gifsplitter.com/', 200, 'https:', false],
    ['https://www.gifsplitter.com/zh-hant/privacy/', 200, "'none'", false],
    ['https://www.gifsplitter.com/about/', 200, "'none'", false],
    ['https://www.gifsplitter.com/missing/', 404, "'none'", true],
    ['https://test.gifframeextractor.pages.dev/gif-frame-timing/', 200, "'none'", true],
  ]) {
    const response = await worker.fetch(new Request(url), { ASSETS: { fetch: () => assetResponse(status) } });
    assert.ok(response.headers.get('Content-Security-Policy').includes(`frame-src ${frames}`), url);
    assert.equal(response.status, status);
    assert.equal(response.headers.has('X-Robots-Tag'), noindex, url);
    assert.ok(response.headers.get('Permissions-Policy').includes('geolocation=()'));
  }
});

test('non-HTML assets and redirects pass through with their cache behavior and status', async () => {
  const worker = createEdgeWorker({ HTMLRewriterClass: HtmlRewriterAdapter });
  const css = new Response('body{}', { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=31536000', 'ETag': 'css' } });
  const request = new Request('https://www.gifsplitter.com/assets/a.css', { headers: { 'If-None-Match': 'css' } });
  const response = await worker.fetch(request, { ASSETS: { fetch(received) { assert.equal(received.headers.get('If-None-Match'), 'css'); return css; } } });
  assert.equal(response, css);
  assert.ok(response.headers.get('Cache-Control').includes('31536000'));
  const redirect = new Response(null, { status: 301, headers: { Location: '/about/' } });
  assert.equal(await worker.fetch(new Request('https://www.gifsplitter.com/about'), { ASSETS: { fetch: () => redirect } }), redirect);
});
