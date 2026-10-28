import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit } from 'playwright';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { encodeExample } from './make-guide-examples.mjs';

// Run against a built Pages site, with its actual CSP. The sample inputs are
// deterministic GIFs; gifuct-js independently parses the downloaded output.
const root = resolve('.');
const engine = process.env.BROWSER_ENGINE || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const browserType = engine === 'webkit' ? webkit : chromium;
const browserPath = engine === 'chromium' ? process.env.BROWSER_EXECUTABLE_PATH : undefined;
const listener = createServer();
await new Promise(resolveListen => listener.listen(0, '127.0.0.1', resolveListen));
const { port } = listener.address();
await new Promise(resolveClose => listener.close(resolveClose));
await access(resolve(root, 'dist/gif-merger/index.html'));
const out = resolve(root, 'output/merger-browser');
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
  const errors = [];
  const posts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET' && request.method() !== 'HEAD') posts.push(request.method()); });
  const response = await page.goto('/gif-merger/', { waitUntil: 'load' });
  assert.equal(response.status(), 200);
  assert.ok(response.headers()['content-security-policy']?.includes("worker-src 'self' blob:"));
  const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(dimensions[0] <= dimensions[1] + 1, 'mobile page must not overflow');

  const a = Buffer.from(encodeExample({ width: 2, height: 1, frames: [
    { pixels: [1, 0], transparent: true, disposal: 2, delay: 7 },
    { pixels: [0, 2], transparent: true, disposal: 2, delay: 11 },
  ] }));
  const b = Buffer.from(encodeExample({ width: 3, height: 2, frames: [
    { pixels: [3, 0, 0, 0, 0, 0], transparent: true, disposal: 2, delay: 5 },
  ] }));
  await page.locator('#merger-input').setInputFiles([
    { name: 'a.gif', mimeType: 'image/gif', buffer: a },
    { name: 'b.gif', mimeType: 'image/gif', buffer: b },
  ]);
  assert.equal(await page.locator('#merger-list li').count(), 2);
  await page.locator('#merger-list li').nth(1).locator('[data-action="up"]').click();
  assert.deepEqual(await page.locator('#merger-list li strong').allTextContents(), ['b.gif', 'a.gif']);
  await page.locator('#merger-start').click();
  await page.locator('#merger-result').waitFor({ state: 'visible', timeout: 60000 });
  const downloading = page.waitForEvent('download');
  await page.locator('#merger-download').click();
  const download = await downloading;
  assert.equal(download.suggestedFilename(), 'merged.gif');
  assert.equal(await download.failure(), null);
  const bytes = await readFile(await download.path());
  await writeFile(resolve(out, `${engine}-merged.gif`), bytes);
  const gif = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const frames = decompressFrames(gif, true);
  assert.deepEqual([gif.lsd.width, gif.lsd.height, frames.length], [3, 2, 3]);
  assert.deepEqual(frames.map(frame => frame.delay), [50, 70, 110], 'frame delay and reordered sequence');
  const netscape = bytes.indexOf(Buffer.from('NETSCAPE2.0'));
  assert.ok(netscape >= 0 && bytes.subarray(netscape + 11, netscape + 16).equals(Buffer.from([3, 1, 0, 0, 0])), 'loop must be infinite');
  const expected = [[0, [0, 0, 255]], [0, [255, 0, 0]], [1, [0, 255, 0]]];
  for (const [index, frame] of frames.entries()) {
    assert.deepEqual([frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height], [0, 0, 3, 2]);
    assert.equal(frame.disposalType, 2, 'transparent frames must clear before the next frame');
    for (let pixel = 0; pixel < 6; pixel++) {
      const actual = [...frame.patch.slice(pixel * 4, pixel * 4 + 4)];
      if (pixel === expected[index][0]) {
        assert.equal(actual[3], 255);
        for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(actual[channel] - expected[index][1][channel]) <= 10, `frame ${index + 1} color`);
      } else assert.equal(actual[3], 0, `frame ${index + 1} pixel ${pixel} must be transparent`);
    }
  }
  // Changing the sequence invalidates the previous download and keeps one-file
  // selection from being submitted as a merge.
  await page.locator('#merger-list li').first().locator('[data-action="remove"]').click();
  assert.equal(await page.locator('#merger-result').isHidden(), true);
  assert.equal(await page.locator('#merger-start').isDisabled(), true);
  await page.locator('#merger-input').setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('not a GIF') });
  await page.locator('#merger-start').click();
  await page.waitForFunction(() => document.getElementById('merger-status').classList.contains('error'), null, { timeout: 30000 });
  assert.match(await page.locator('#merger-status').textContent(), /not a valid GIF|damaged/i);
  assert.equal(await page.locator('#merger-result').isHidden(), true);

  await page.locator('#merger-clear').click();
  const many = Buffer.from(encodeExample({ width: 2, height: 1, frames: Array.from({ length: 250 }, (_, index) => ({ pixels: [1, index % 3 + 1], delay: 5 })) }));
  await page.locator('#merger-input').setInputFiles([
    { name: 'many.gif', mimeType: 'image/gif', buffer: many },
    { name: 'b.gif', mimeType: 'image/gif', buffer: b },
  ]);
  await page.evaluate(() => {
    const label = document.getElementById('merger-progress-label');
    const observer = new MutationObserver(() => {
      if (/frame [1-9]/.test(label.textContent) && !document.getElementById('merger-progress-panel').hidden) {
        observer.disconnect();
        document.getElementById('merger-cancel').click();
      }
    });
    observer.observe(label, { childList: true, characterData: true, subtree: true });
  });
  await page.locator('#merger-start').click();
  await page.waitForFunction(() => /cancelled/i.test(document.getElementById('merger-status').textContent), null, { timeout: 30000 });
  assert.equal(await page.locator('#merger-result').isHidden(), true);
  await page.locator('#merger-clear').click();
  await page.locator('#merger-input').setInputFiles([
    { name: 'a.gif', mimeType: 'image/gif', buffer: a },
    { name: 'b.gif', mimeType: 'image/gif', buffer: b },
  ]);
  await page.locator('#merger-start').click();
  await page.locator('#merger-result').waitFor({ state: 'visible', timeout: 60000 });
  assert.deepEqual(posts, [], 'local processing must not POST selected files');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  await context.close();
  console.log(`PASS: ${engine} ${browser.version()}: mobile merger, reorder, real download, independent GIF dimensions/pixels/transparency/delays/loop, remove, invalid file, cancel and recovery; no uploads or runtime errors.`);
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
