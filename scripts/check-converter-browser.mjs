import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit } from 'playwright';
import { unzipSync } from 'fflate';
import { encodeExample } from './make-guide-examples.mjs';

// Verify the built Pages site and actual downloads in a real browser. The
// fixture has one transparent frame followed by red and green frames.
const root = resolve('.');
const engine = process.env.BROWSER_ENGINE || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const browserType = engine === 'webkit' ? webkit : chromium;
const browserPath = engine === 'chromium' ? process.env.BROWSER_EXECUTABLE_PATH : undefined;
const listener = createServer();
await new Promise(resolveListen => listener.listen(0, '127.0.0.1', resolveListen));
const { port } = listener.address();
await new Promise(resolveClose => listener.close(resolveClose));
await access(resolve(root, 'dist/gif-to-jpg/index.html'));
await access(resolve(root, 'dist/gif-to-webp/index.html'));
const out = resolve(root, 'output/converter-browser');
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', resolve(out, 'wrangler-state'), '--log-level', 'warn'], {
  cwd: root, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
});
let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-30000); });
let browser;
try {
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Pages server exited: ${serverOutput}`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* Wait for Wrangler. */ }
    if (Date.now() > deadline) throw new Error(`Pages server failed to start: ${serverOutput}`);
    await delay(200);
  }
  browser = await browserType.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
  const context = await browser.newContext({ baseURL: origin, acceptDownloads: true, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  const errors = [], posts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) posts.push(request.method()); });
  const fixture = Buffer.from(encodeExample({ width: 8, height: 8, frames: [
    { pixels: Array(64).fill(0), transparent: true, disposal: 2, delay: 5 },
    { pixels: Array(64).fill(1), transparent: true, disposal: 2, delay: 5 },
    { pixels: Array(64).fill(2), transparent: true, disposal: 2, delay: 5 },
  ] }));
  const upload = { name: 'source.gif', mimeType: 'image/gif', buffer: fixture };

  async function save(button) {
    await page.locator(button).click();
    await page.locator('#converter-output').waitFor({ state: 'visible', timeout: 30000 });
    const downloading = page.waitForEvent('download');
    await page.locator('#converter-save').click();
    const download = await downloading;
    assert.equal(await download.failure(), null);
    return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
  }
  function checkSignature(bytes, format) {
    if (format === 'jpg') assert.ok(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'real JPEG signature');
    else {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
  async function pixels(bytes, format) {
    return page.evaluate(async ({ base64, mime }) => {
      const binary = atob(base64);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: mime }));
      try {
        const img = new Image(); img.src = url; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        return { width: canvas.width, height: canvas.height, pixel: [...ctx.getImageData(4, 4, 1, 1).data] };
      } finally { URL.revokeObjectURL(url); }
    }, { base64: bytes.toString('base64'), mime: format === 'jpg' ? 'image/jpeg' : 'image/webp' });
  }
  for (const format of ['jpg', 'webp']) {
    const response = await page.goto(`/gif-to-${format}/`, { waitUntil: 'load' });
    assert.equal(response.status(), 200);
    assert.ok(response.headers()['content-security-policy']?.includes("worker-src 'self' blob:"));
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.ok(size[0] <= size[1] + 1, `${format}: mobile page must not overflow`);
    await page.locator('#converter-input').setInputFiles(upload);
    await page.locator('#converter-results').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.locator('#converter-frame-grid .frame-card').count(), 3);
    if (format === 'jpg') await page.locator('#converter-background').fill('#00ff00');
    const one = await save('#converter-download-frame');
    assert.equal(one.name, `source-frame-0001.${format}`);
    checkSignature(one.bytes, format);
    await writeFile(resolve(out, `${engine}-frame.${format}`), one.bytes);
    const first = await pixels(one.bytes, format);
    assert.deepEqual([first.width, first.height], [8, 8]);
    if (format === 'jpg') {
      assert.equal(first.pixel[3], 255, 'JPEG is opaque');
      assert.ok(first.pixel[0] < 15 && first.pixel[1] > 240 && first.pixel[2] < 15, 'JPEG transparent background uses selected green');
    } else assert.equal(first.pixel[3], 0, 'WebP preserves transparent pixels');
    await page.locator('#converter-frame-grid [data-frame="0"] input').check();
    await page.locator('#converter-frame-grid [data-frame="2"] input').check();
    const selected = await save('#converter-download-selected');
    const entries = unzipSync(selected.bytes);
    assert.deepEqual(Object.keys(entries), [`source-frame-0001.${format}`, `source-frame-0003.${format}`]);
    for (const entry of Object.values(entries)) checkSignature(Buffer.from(entry), format);
    const third = await pixels(Buffer.from(entries[`source-frame-0003.${format}`]), format);
    assert.ok(third.pixel[1] > 240 && third.pixel[3] === 255, `${format}: third frame remains green and opaque`);
    const all = await save('#converter-download-all');
    assert.deepEqual(Object.keys(unzipSync(all.bytes)), Array.from({ length: 3 }, (_, index) => `source-frame-${String(index + 1).padStart(4, '0')}.${format}`));
    await page.locator('#converter-input').setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('bad GIF') });
    await page.waitForFunction(() => document.getElementById('converter-status').classList.contains('error'), null, { timeout: 30000 });
    assert.equal(await page.locator('#converter-results').isHidden(), true);
    await page.locator('#converter-input').setInputFiles(upload);
    await page.locator('#converter-results').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.locator('#converter-frame-grid .frame-card').count(), 3, 'a valid GIF opens after an error');
    if (format === 'jpg') {
      const many = Buffer.from(encodeExample({ width: 2, height: 1, frames: Array.from({ length: 120 }, (_, index) => ({ pixels: [1, index % 3 + 1], delay: 5 })) }));
      await page.locator('#converter-input').setInputFiles({ name: 'many.gif', mimeType: 'image/gif', buffer: many });
      await page.waitForFunction(() => document.getElementById('converter-file-info').textContent.includes('120 frames'), null, { timeout: 30000 });
      await page.evaluate(() => {
        const label = document.getElementById('converter-progress-label');
        const observer = new MutationObserver(() => {
          if (/Preparing image [1-9]/.test(label.textContent) && !document.getElementById('converter-progress-panel').hidden) {
            observer.disconnect();
            document.getElementById('converter-cancel').click();
          }
        });
        observer.observe(label, { childList: true, characterData: true, subtree: true });
      });
      await page.locator('#converter-download-all').click();
      await page.waitForFunction(() => /cancelled/i.test(document.getElementById('converter-status').textContent), null, { timeout: 30000 });
      assert.equal(await page.locator('#converter-output').isHidden(), true, 'cancelled export must not offer a download');
      await page.locator('#converter-input').setInputFiles(upload);
      await page.waitForFunction(() => document.getElementById('converter-file-info').textContent.includes('3 frames'), null, { timeout: 30000 });
      const recovered = await save('#converter-download-frame');
      checkSignature(recovered.bytes, format);
    }
  }
  assert.deepEqual(posts, [], 'local conversion must not POST selected files');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  await context.close();

  // Simulate browsers that silently return PNG for unsupported WebP export.
  const fallbackContext = await browser.newContext({ baseURL: origin });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      return original.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  const fallback = await fallbackContext.newPage();
  await fallback.goto('/gif-to-webp/', { waitUntil: 'load' });
  await fallback.locator('#converter-input').setInputFiles(upload);
  await fallback.locator('#converter-results').waitFor({ state: 'visible' });
  await fallback.locator('#converter-download-frame').click();
  await fallback.waitForFunction(() => document.getElementById('converter-status').classList.contains('error'));
  assert.match(await fallback.locator('#converter-status').textContent(), /not supported/i);
  assert.equal(await fallback.locator('#converter-output').isHidden(), true, 'unsupported WebP must not produce a mislabeled PNG');
  await fallbackContext.close();
  console.log(`PASS: ${engine} ${browser.version()}: mobile JPG/WebP actual signatures, dimensions, backgrounds/transparency, selected/all ZIP, cancellation, recovery and unsupported-format handling; no uploads or runtime errors.`);
} finally {
  await browser?.close().catch(() => {});
  if (server.pid && server.exitCode === null) {
    if (process.platform === 'win32') {
      await new Promise(resolveKill => { const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.once('error', resolveKill); killer.once('exit', resolveKill); });
    } else {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
}
