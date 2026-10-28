import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, webkit } from 'playwright';
import { encodeExample } from './make-guide-examples.mjs';
import { LOCALES, TOOL_TYPES, ORIGIN, pagePath } from '../src/site/config.js';

// Exercise all published tool locales against the built site and real browser.
const root = resolve('.');
const engine = process.env.BROWSER_ENGINE || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const listener = createServer();
await new Promise(done => listener.listen(0, '127.0.0.1', done));
const { port } = listener.address();
await new Promise(done => listener.close(done));
const output = resolve(root, 'output/localized-browser');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', resolve(output, 'wrangler-state'), '--log-level', 'warn'], { cwd: root, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } });
let logs = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-30000); });
let browser;
try {
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Pages server exited: ${logs}`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error(`Pages server failed to start: ${logs}`);
    await delay(200);
  }
  browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, ...(engine === 'chromium' && process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ baseURL: origin, acceptDownloads: true, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  const errors = [], posts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) posts.push(request.method()); });
  const fixture = Buffer.from(encodeExample({ width: 2, height: 1, frames: [
    { pixels: [1, 0], transparent: true, disposal: 2, delay: 5 },
    { pixels: [0, 2], transparent: true, disposal: 2, delay: 5 },
  ] }));
  const upload = { name: 'source.gif', mimeType: 'image/gif', buffer: fixture };
  const invalid = { name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('not a GIF') };
  const interpolate = (value, params) => value.replace(/\{(\w+)\}/g, (whole, key) => params[key] ?? whole);
  async function textIs(selector, value) {
    try {
      await page.waitForFunction(([selector, value]) => document.querySelector(selector)?.textContent.trim() === value, [selector, value], { timeout: 10000 });
    } catch (error) {
      throw new Error(`${page.url()} ${selector}: expected ${JSON.stringify(value)}, got ${JSON.stringify(await page.locator(selector).textContent())}`, { cause: error });
    }
  }
  async function noUntranslatedLiterals(group, dict, path) {
    const originals = Object.keys(dict).filter(key => !key.includes('{') && key !== dict[key]);
    const leftovers = await page.evaluate(({ group, originals }) => {
      const root = document.getElementById(`${group}-app`);
      const english = new Set(originals);
      const matches = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.TEXT_NODE && english.has(node.nodeValue.trim())) matches.push(node.nodeValue.trim());
        if (node.nodeType === Node.ELEMENT_NODE) for (const name of ['aria-label', 'alt']) {
          const value = node.getAttribute(name);
          if (english.has(value)) matches.push(`${name}: ${value}`);
        }
      }
      return matches;
    }, { group, originals });
    assert.deepEqual(leftovers, [], `${path}: untranslated tool strings`);
  }
  for (const locale of LOCALES) {
    const translations = JSON.parse(await readFile(resolve(root, `src/locales/tools/${locale}.json`), 'utf8'));
    for (const type of TOOL_TYPES) {
      const path = pagePath(locale, type);
      const group = type === 'merger' ? 'merger' : ['jpg', 'webp'].includes(type) ? 'converter' : 'editor';
      const dict = translations.ui[group];
      const response = await page.goto(path, { waitUntil: 'load' });
      assert.equal(response.status(), 200, path);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), ORIGIN + path, path);
      assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(), LOCALES.length + 1, path);
      const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(size[0] <= size[1] + 1, `${path}: mobile overflow ${size}`);
      assert.equal(await page.locator(`#${group}-input`).getAttribute('aria-label'), dict[group === 'merger' ? 'Choose GIF files' : 'Choose a GIF file'], `${path}: localized input label`);
      await noUntranslatedLiterals(group, dict, path);
      if (group === 'merger') {
        await page.locator('#merger-input').setInputFiles([upload, { ...upload, name: 'second.gif' }]);
        await textIs('#merger-status', interpolate(dict['{count} GIFs ready. Arrange them, then select Merge GIFs.'], { count: 2 }));
        await page.waitForFunction(value => document.querySelector('#merger-list li:nth-child(2) [data-action="up"]')?.getAttribute('aria-label') === value, interpolate(dict['Move up {name}'], { name: 'second.gif' }));
        await page.locator('#merger-start').click();
        await page.locator('#merger-result').waitFor({ state: 'visible', timeout: 30000 });
        await textIs('#merger-status', dict['Your merged GIF is ready.']);
        const downloadEvent = page.waitForEvent('download');
        await page.locator('#merger-download').click();
        assert.equal(await (await downloadEvent).failure(), null, path);
      } else {
        await page.locator(`#${group}-input`).setInputFiles(upload);
        await page.locator(`#${group}-results`).waitFor({ state: 'visible', timeout: 30000 });
        const key = group === 'converter' ? '{count} frames ready. Choose a frame or select several.' : type === 'resize' ? '{count} frames ready. Choose the dimensions.' : '{count} frames ready. Select the area to keep.';
        await textIs(`#${group}-status`, interpolate(dict[key], { count: 2 }));
        if (group === 'converter') {
          await page.locator('#converter-frame-grid [data-frame="0"] input').check();
          await textIs('#converter-selection-count', interpolate(dict['{count} selected'], { count: 1 }));
          await page.locator('#converter-download-frame').click();
          await page.locator('#converter-output').waitFor({ state: 'visible', timeout: 30000 });
          const downloadEvent = page.waitForEvent('download');
          await page.locator('#converter-save').click();
          assert.equal(await (await downloadEvent).failure(), null, path);
        } else {
          await page.locator('#editor-next').click();
          await page.locator('#editor-apply').click();
          await page.locator('#editor-output').waitFor({ state: 'visible', timeout: 30000 });
          const downloadEvent = page.waitForEvent('download');
          await page.locator('#editor-save').click();
          assert.equal(await (await downloadEvent).failure(), null, path);
        }
        await page.waitForFunction(group => !document.getElementById(`${group}-input`).disabled, group);
        await page.locator(`#${group}-input`).setInputFiles(invalid);
        const errorKey = group === 'editor' ? 'This GIF is incomplete or damaged. Try another file.' : 'This file is not a GIF. Choose a valid GIF file.';
        await textIs(`#${group}-status`, dict[errorKey]);
      }
      const after = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(after[0] <= after[1] + 1, `${path}: mobile overflow after processing ${after}`);
      await noUntranslatedLiterals(group, dict, path);
      console.log(`PASS ${path}`);
    }
  }
  assert.deepEqual(posts, [], 'all processing is local');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(`PASS ${engine}: all localized tool routes, metadata, mobile layouts, localized dynamic status, real processing and downloads.`);
} finally {
  await browser?.close().catch(() => {});
  if (server.pid && server.exitCode === null) {
    if (process.platform === 'win32') await new Promise(done => { const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.once('error', done); killer.once('exit', done); });
    else try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
