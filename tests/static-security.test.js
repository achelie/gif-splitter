import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareStaticHtml, staticContentSecurityPolicy } from '../scripts/static-security.mjs';

test('static CSP authorizes exact executable bytes while JSON data does not inflate the header', () => {
  const code = '\n  window.example = true;\n';
  const result = prepareStaticHtml(`<meta property="csp-nonce" nonce="__CSP_NONCE__"><script nonce="__CSP_NONCE__">${code}</script><script type="module" src="/assets/app.js" nonce="__CSP_NONCE__"></script><script type="application/ld+json">{"title":"data"}</script><script type="application/json">{"labels":[]}</script>`);
  assert.ok(!result.html.includes('__CSP_NONCE__'));
  assert.ok(result.html.includes('<meta property="csp-nonce">'));
  assert.deepEqual(result.hashes, [`'sha256-${createHash('sha256').update(code).digest('base64')}'`]);
  const changed = prepareStaticHtml(`<script>${code} </script>`);
  assert.notDeepEqual(changed.hashes, result.hashes);
  const windows = prepareStaticHtml(`<script>${code.replaceAll('\n', '\r\n')}</script>`);
  assert.deepEqual(windows.hashes, result.hashes, 'Browser newline normalization must preserve the allowed hash');
  const csp = staticContentSecurityPolicy([...result.hashes, ...result.hashes]);
  assert.equal(csp.split(result.hashes[0]).length - 1, 1);
  assert.ok(csp.includes("script-src 'self'"));
  assert.ok(!csp.includes('strict-dynamic') && !csp.includes('nonce-'));
  assert.ok(csp.includes('https://static.cloudflareinsights.com'));
});
