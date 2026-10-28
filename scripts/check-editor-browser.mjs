import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit } from 'playwright';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { encodeExample } from './make-guide-examples.mjs';

const root = resolve('.');
const engine = process.env.BROWSER_ENGINE || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const browserType = engine === 'webkit' ? webkit : chromium;
const browserPath = engine === 'chromium' ? process.env.BROWSER_EXECUTABLE_PATH : undefined;
const listener = createServer();
await new Promise(resolveListen => listener.listen(0, '127.0.0.1', resolveListen));
const { port } = listener.address();
await new Promise(resolveClose => listener.close(resolveClose));
await access(resolve(root, 'dist/resize-gif/index.html'));
await access(resolve(root, 'dist/crop-gif/index.html'));
const out = resolve(root, 'output/editor-browser');
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
  const context = await browser.newContext({ baseURL: origin, acceptDownloads: true, hasTouch: true, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  const errors = [], posts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) posts.push(request.method()); });
  const basic = Buffer.from(encodeExample({ width: 4, height: 3, frames: [
    { pixels: [0,1,0,0, 0,3,1,0, 0,0,0,0], transparent: true, disposal: 2, delay: 5 },
    { pixels: [0,0,1,0, 0,2,3,0, 0,0,0,0], transparent: true, disposal: 2, delay: 11 },
  ] }));
  const loopBlock = Buffer.concat([Buffer.from([0x21, 0xff, 11]), Buffer.from('NETSCAPE2.0'), Buffer.from([3, 1, 3, 0, 0])]);
  const fixture = Buffer.concat([basic.subarray(0, 25), loopBlock, basic.subarray(25)]);
  const upload = { name: 'source.gif', mimeType: 'image/gif', buffer: fixture };
  async function load(mode) {
    const response = await page.goto(`/${mode}-gif/`, { waitUntil: 'load' });
    assert.equal(response.status(), 200);
    assert.ok(response.headers()['content-security-policy']?.includes("worker-src 'self' blob:"));
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.ok(size[0] <= size[1] + 1, `${mode}: mobile page must not overflow`);
    await page.locator('#editor-input').setInputFiles(upload);
    await page.locator('#editor-results').waitFor({ state: 'visible', timeout: 30000 });
  }
  async function save(mode) {
    await page.locator('#editor-apply').click();
    await page.locator('#editor-output').waitFor({ state: 'visible', timeout: 60000 });
    const downloading = page.waitForEvent('download');
    await page.locator('#editor-save').click();
    const download = await downloading;
    assert.equal(await download.failure(), null);
    const bytes = await readFile(await download.path());
    await writeFile(resolve(out, `${engine}-${mode}.gif`), bytes);
    const parsed = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const frames = decompressFrames(parsed, true);
    assert.equal(frames.length, 2, 'all source frames retained');
    assert.deepEqual(parsed.frames.filter(frame => frame.image).map(frame => frame.gce.delay), [5, 11], 'original frame delays retained');
    const netscape = bytes.indexOf(Buffer.from('NETSCAPE2.0'));
    assert.ok(netscape >= 0 && bytes.subarray(netscape + 11, netscape + 16).equals(Buffer.from([3, 1, 3, 0, 0])), 'finite loop count retained');
    return { parsed, frames };
  }

  await load('resize');
  await page.locator('#editor-width').fill('8');
  await page.locator('#editor-width').press('Tab');
  assert.equal(await page.locator('#editor-height').inputValue(), '6', 'aspect ratio updates height');
  const resized = await save('resize');
  assert.deepEqual([resized.parsed.lsd.width, resized.parsed.lsd.height], [8, 6]);
  assert.deepEqual(resized.frames.map(frame => frame.disposalType), [2, 2]);
  for (const [index, frame] of resized.frames.entries()) {
    const values = Array.from({ length: frame.patch.length / 4 }, (_, pixel) => [...frame.patch.slice(pixel * 4, pixel * 4 + 4)]);
    assert.ok(values.some(pixel => pixel[3] === 0), `resized frame ${index + 1} retains transparent pixels`);
    assert.ok(values.some(pixel => pixel[3] === 255 && Math.max(...pixel.slice(0, 3)) > 180), `resized frame ${index + 1} retains opaque content`);
  }

  await load('crop');
  for (const [name, value] of [['x', '1'], ['y', '0'], ['width', '2'], ['height', '2']]) {
    await page.locator(`#editor-${name}`).fill(value);
    await page.locator(`#editor-${name}`).press('Tab');
  }
  const cropped = await save('crop');
  assert.deepEqual([cropped.parsed.lsd.width, cropped.parsed.lsd.height], [2, 2]);
  const expected = [
    [[255, 0, 0, 255], [0, 0, 0, 0], [0, 0, 255, 255], [255, 0, 0, 255]],
    [[0, 0, 0, 0], [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]],
  ];
  for (const [i, frame] of cropped.frames.entries()) {
    assert.equal(frame.disposalType, 2, 'clear each frame to avoid transparency ghosts');
    assert.deepEqual([frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height], [0, 0, 2, 2]);
    for (let pixel = 0; pixel < 4; pixel++) {
      const actual = [...frame.patch.slice(pixel * 4, pixel * 4 + 4)];
      assert.equal(actual[3], expected[i][pixel][3], `frame ${i + 1} pixel ${pixel} alpha`);
      if (actual[3]) for (let c = 0; c < 3; c++) assert.ok(Math.abs(actual[c] - expected[i][pixel][c]) <= 10, `frame ${i + 1} pixel ${pixel} color`);
    }
  }
  // Draw a crop on the actual image and verify the resulting source-pixel
  // coordinates; numeric inputs remain available for precise keyboard access.
  const sample = await readFile(resolve(root, 'public/sample.gif'));
  await page.locator('#editor-input').setInputFiles({ name: 'sample.gif', mimeType: 'image/gif', buffer: sample });
  await page.waitForFunction(() => document.getElementById('editor-file-name').textContent === 'sample.gif', null, { timeout: 30000 });
  await page.locator('#editor-image-wrap').scrollIntoViewIfNeeded();
  await page.locator('#editor-preview').evaluate(image => image.decode());
  const bounds = await page.locator('#editor-image-wrap').boundingBox();
  assert.ok(bounds && bounds.width > 10 && bounds.height > 10);
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.75, { steps: 4 });
  await page.mouse.up();
  for (const [id, expectedValue] of [['x', 120], ['y', 75], ['width', 240], ['height', 150]]) {
    const actual = Number(await page.locator(`#editor-${id}`).inputValue());
    assert.ok(Math.abs(actual - expectedValue) <= 2, `drag ${id}: expected approximately ${expectedValue}, got ${actual}`);
  }
  if (engine === 'chromium') {
    await page.locator('#editor-image-wrap').scrollIntoViewIfNeeded();
    const touchBounds = await page.locator('#editor-image-wrap').boundingBox();
    const start = { x: touchBounds.x + touchBounds.width * 0.1, y: touchBounds.y + touchBounds.height * 0.1, id: 1 };
    const end = { x: touchBounds.x + touchBounds.width * 0.6, y: touchBounds.y + touchBounds.height * 0.6, id: 1 };
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    for (const [id, expectedValue] of [['x', 48], ['y', 30], ['width', 240], ['height', 150]]) {
      const actual = Number(await page.locator(`#editor-${id}`).inputValue());
      assert.ok(Math.abs(actual - expectedValue) <= 2, `touch ${id}: expected approximately ${expectedValue}, got ${actual}`);
    }
  }
  await page.locator('#editor-x').fill('479');
  await page.locator('#editor-apply').click();
  await page.waitForFunction(() => document.getElementById('editor-status').classList.contains('error'));
  assert.equal(await page.locator('#editor-output').isHidden(), true, 'invalid crop cannot produce a download');

  const excessive = Buffer.from(encodeExample({ width: 1, height: 1, frames: Array.from({ length: 401 }, () => ({ pixels: [1], delay: 5 })) }));
  await page.locator('#editor-input').setInputFiles({ name: 'too-many.gif', mimeType: 'image/gif', buffer: excessive });
  await page.waitForFunction(() => /400 frames/i.test(document.getElementById('editor-status').textContent), null, { timeout: 30000 });
  assert.equal(await page.locator('#editor-results').isHidden(), true);
  const many = Buffer.from(encodeExample({ width: 2, height: 1, frames: Array.from({ length: 120 }, (_, index) => ({ pixels: [1, index % 3 + 1], delay: 5 })) }));
  await page.locator('#editor-input').setInputFiles({ name: 'many.gif', mimeType: 'image/gif', buffer: many });
  await page.waitForFunction(() => document.getElementById('editor-file-name').textContent === 'many.gif', null, { timeout: 30000 });
  await page.evaluate(() => {
    const label = document.getElementById('editor-progress-label');
    const observer = new MutationObserver(() => {
      if (/Encoding frame [1-9]/.test(label.textContent) && !document.getElementById('editor-progress-panel').hidden) {
        observer.disconnect();
        document.getElementById('editor-cancel').click();
      }
    });
    observer.observe(label, { childList: true, characterData: true, subtree: true });
  });
  await page.locator('#editor-apply').click();
  await page.waitForFunction(() => /cancelled/i.test(document.getElementById('editor-status').textContent), null, { timeout: 30000 });
  assert.equal(await page.locator('#editor-output').isHidden(), true, 'cancelled edit must not offer a download');
  await page.locator('#editor-input').setInputFiles(upload);
  await page.waitForFunction(() => document.getElementById('editor-file-name').textContent === 'source.gif', null, { timeout: 30000 });
  await page.locator('#editor-apply').click();
  await page.locator('#editor-output').waitFor({ state: 'visible', timeout: 60000 });
  assert.deepEqual(posts, [], 'local editing must not POST selected files');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  await context.close();
  console.log(`PASS: ${engine} ${browser.version()}: mobile resize and crop, ratio, visual drag and bounds${engine === 'chromium' ? ', simulated touch' : ''}, GIF output, pixels/transparency, timing/loop, limits, cancellation and recovery; no uploads or runtime errors.`);
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
