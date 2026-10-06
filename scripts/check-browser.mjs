import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';
import { encodeExample } from './make-guide-examples.mjs';
import { LOCALES, pagePath } from '../src/site/config.js';

// Run against an existing build: Wrangler applies the actual Pages headers and,
// when present, the nonce Worker/HTMLRewriter. This never deploys the site.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(root, 'output', 'playwright');
const english = JSON.parse(await readFile(join(root, 'src', 'locales', 'en.json'), 'utf8'));
const sample = await readFile(join(root, 'public', 'sample.gif'));
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const failures = [];
const checks = [];
let server;
let serverError;
let serverOutput = '';
let browserInstaller;
let browser;
let context;
let page;
let cleanupPromise;

await mkdir(artifacts, { recursive: true });
await access(join(root, 'dist', 'index.html')).catch(() => {
  throw new Error('Build dist first with npm run build:production.');
});

function command(executable, args, options = {}) {
  return spawn(executable, args, {
    cwd: root, windowsHide: true, detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'], ...options,
  });
}

async function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const exited = new Promise(resolveExit => child.once('exit', resolveExit));
  if (process.platform === 'win32') {
    // Wrangler starts workerd as a child; kill the entire tree without a shell.
    await new Promise(resolveKill => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', resolveKill);
      killer.once('exit', resolveKill);
    });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  let timeout;
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolveTimeout => { timeout = setTimeout(() => resolveTimeout(false), 5000); }),
  ]);
  clearTimeout(timeout);
  if (!stopped && process.platform !== 'win32') {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}

async function cleanup() {
  cleanupPromise ??= (async () => {
    await browser?.close().catch(() => {});
    await stopProcess(browserInstaller);
    await stopProcess(server);
    await writeFile(join(artifacts, 'wrangler.log'), serverOutput);
  })();
  return cleanupPromise;
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => { cleanup().finally(() => process.exit(code)); });
}

async function freePort() {
  const listener = createServer();
  await new Promise((resolveListen, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = listener.address();
  await new Promise((resolveClose, reject) => listener.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function ensureChromium() {
  if (process.env.BROWSER_EXECUTABLE_PATH) {
    await access(process.env.BROWSER_EXECUTABLE_PATH);
    return process.env.BROWSER_EXECUTABLE_PATH;
  }
  try { await access(chromium.executablePath()); } catch {
    // CI installs Chromium (and its Linux dependencies) explicitly. This also
    // makes a fresh local checkout runnable without a separate browser command.
    browserInstaller = command(process.execPath, [join(root, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium']);
    let output = '';
    browserInstaller.stdout.on('data', chunk => { output += chunk; });
    browserInstaller.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise((resolveExit, reject) => {
      browserInstaller.once('error', reject);
      browserInstaller.once('exit', resolveExit);
    });
    assert.equal(code, 0, `Chromium installation failed:\n${output.slice(-8000)}`);
  }
  return undefined;
}

async function startServer() {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  server = command(process.execPath, [
    join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'pages', 'dev', 'dist',
    '--ip', '127.0.0.1', '--port', String(port),
    '--persist-to', join(artifacts, 'wrangler-state'), '--log-level', 'warn',
  ], { env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } });
  server.once('error', error => { serverError = error; });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-100_000); });
  }
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Wrangler exited (${server.exitCode}):\n${serverOutput}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok && response.headers.has('content-security-policy')) return origin;
    } catch { /* Startup is not complete yet. */ }
    await delay(200);
  }
  throw new Error(`Wrangler did not serve the built Pages headers within 60 seconds:\n${serverOutput}`);
}

async function waitForFrames(count = 24) {
  await page.waitForFunction(expected => {
    const results = document.getElementById('results');
    return results && !results.hidden && document.querySelectorAll('.frame-card').length === expected;
  }, count, { timeout: 30_000 });
  await page.locator('#frame-preview').evaluate(image => image.decode());
}

function checkPng(bytes, label) {
  const png = Buffer.from(bytes);
  assert.deepEqual(png.subarray(0, 8), pngSignature, `${label}: PNG signature`);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR', `${label}: PNG header`);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [sample.readUInt16LE(6), sample.readUInt16LE(8)], `${label}: full-frame dimensions`);
}

async function download(button, artifactName) {
  const downloadEvent = page.waitForEvent('download');
  await page.locator(button).click();
  const result = await downloadEvent;
  const path = join(artifacts, artifactName);
  await result.saveAs(path);
  assert.equal(await result.failure(), null, `Download ${artifactName} failed`);
  return { name: result.suggestedFilename(), bytes: await readFile(path) };
}

async function assertNoOverflow(label) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  assert.ok(size.document <= size.viewport + 1, `${label}: horizontal overflow ${size.document}px > ${size.viewport}px`);
}

async function visit(path, expectedStatus = 200) {
  const response = await page.goto(path, { waitUntil: 'load' });
  assert.equal(response.status(), expectedStatus, `${path}: HTTP status`);
  const csp = response.headers()['content-security-policy'];
  assert.ok(csp?.includes("worker-src 'self' blob:"), `${path}: Pages CSP must allow the real decoder Worker`);
  assert.equal(response.headers()['x-content-type-options'], 'nosniff', `${path}: security headers`);
  assert.ok(!(await response.text()).includes('__CSP_NONCE__'), `${path}: unresolved nonce placeholder`);
  return response;
}

try {
  const executablePath = await ensureChromium();
  const origin = await startServer();
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  context = await browser.newContext({ baseURL: origin, acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await context.exposeBinding('__recordCspViolation', (_, violation) => failures.push(`CSP: ${JSON.stringify(violation)}`));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      window.__recordCspViolation({ page: location.href, directive: event.effectiveDirective, blocked: event.blockedURI });
    });
    // Observe the native Worker lifecycle without replacing its execution,
    // messages, or decoding. Cancellation must terminate a started Worker.
    const NativeWorker = window.Worker;
    window.__workerActivity = { started: 0, terminated: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); window.__workerActivity.started++; }
      terminate() { window.__workerActivity.terminated++; return super.terminate(); }
    };
  });
  context.on('page', currentPage => {
    currentPage.on('pageerror', error => failures.push(`Runtime: ${error.stack || error.message}`));
  });
  page = await context.newPage();
  page.setDefaultTimeout(15_000);

  const firstResponse = await visit('/');
  const firstCsp = firstResponse.headers()['content-security-policy'];
  if (firstCsp.includes("'nonce-")) {
    const secondResponse = await page.reload({ waitUntil: 'load' });
    assert.notEqual(secondResponse.headers()['content-security-policy'], firstCsp, 'Nonce Worker must generate a fresh nonce on reload');
  }
  await page.locator('#sample-button').click();
  await waitForFrames();
  assert.equal(await page.locator('#stat-frames').textContent(), '24');
  assert.ok((await page.evaluate(() => window.__workerActivity.started)) >= 1, 'Sample must use the decoder Worker under the deployed CSP');
  await page.screenshot({ path: join(artifacts, 'sample-desktop.png'), fullPage: true });
  checks.push('24-frame sample and real Worker');

  const png = await download('#download-frame', 'single-frame.png');
  assert.equal(png.name, 'little-orbit-frame-0001.png');
  checkPng(png.bytes, png.name);
  await page.locator('[data-frame="0"] input').check();
  await page.locator('[data-frame="4"] input').check();
  const archive = await download('#download-selected', 'selected-frames.zip');
  assert.equal(archive.name, 'little-orbit-frames.zip');
  const entries = unzipSync(archive.bytes);
  assert.deepEqual(Object.keys(entries), ['little-orbit-frame-0001.png', 'little-orbit-frame-0005.png']);
  for (const [name, bytes] of Object.entries(entries)) checkPng(bytes, name);
  checks.push('single PNG and selected ZIP frame numbers');

  const initialFrame = await page.locator('#frame-slider').inputValue();
  await page.locator('#play-button').click();
  await page.waitForFunction(initial => document.getElementById('frame-slider').value !== initial, initialFrame);
  await page.locator('#play-button').click();
  assert.equal(await page.locator('#play-button').textContent(), english.ui.play);
  checks.push('playback advances and pauses');

  const corrupt = [71, 73, 70, 56, 57, 97, 5, 0, 1, 0, 129, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 44, 0, 0, 0, 0, 5, 0, 1, 0, 0, 2, 2, 182, 11, 0, 59];
  for (const [name, codes] of [['invalid-lzw.gif', [182, 11]], ['missing-pixels.gif', [76, 1]]]) {
    const bytes = Buffer.from(corrupt);
    bytes.set(codes, 37);
    assert.equal(bytes.length, 41);
    await page.locator('#file-input').setInputFiles({ name, mimeType: 'image/gif', buffer: bytes });
    await page.waitForFunction(expected => {
      const status = document.getElementById('status');
      return status.classList.contains('error') && status.textContent === expected && document.getElementById('progress-panel').hidden;
    }, english.errors.INVALID_GIF);
    assert.equal(await page.locator('#results').evaluate(element => element.hidden), true);
    assert.equal(await page.locator('#file-input').inputValue(), '');
  }
  await page.locator('#file-input').setInputFiles({ name: 'recovered.gif', mimeType: 'image/gif', buffer: sample });
  await waitForFrames();
  assert.equal(await page.locator('#file-name').textContent(), 'recovered.gif');
  checks.push('both corrupt 41-byte GIFs reject and re-upload recovers');

  const beforeCancel = await page.evaluate(() => ({ ...window.__workerActivity }));
  await page.evaluate(() => {
    window.__cancelAtProgress = null;
    const progress = document.getElementById('progress');
    const observer = new MutationObserver(() => {
      if (progress.value > 0 && progress.value < progress.max && !document.getElementById('progress-panel').hidden) {
        window.__cancelAtProgress = progress.value;
        observer.disconnect();
        document.getElementById('cancel-button').click();
      }
    });
    observer.observe(document.getElementById('progress-panel'), { attributes: true, subtree: true, childList: true });
  });
  const manyFrames = Buffer.from(encodeExample({
    width: 2, height: 1,
    frames: Array.from({ length: 1000 }, (_, index) => ({ pixels: [1, index % 3 + 1], delay: 5 })),
  }));
  await page.locator('#file-input').setInputFiles({ name: 'cancel-test.gif', mimeType: 'image/gif', buffer: manyFrames });
  await page.waitForFunction(expected => document.getElementById('status').textContent === expected && document.getElementById('progress-panel').hidden, english.runtime.cancelled);
  const cancellation = await page.evaluate(() => ({ progress: window.__cancelAtProgress, ...window.__workerActivity }));
  assert.ok(cancellation.progress > 0 && cancellation.progress < 100, 'Cancel must run during decoded frame progress');
  assert.equal(cancellation.started, beforeCancel.started + 1, 'Cancellation starts a real decoder Worker');
  assert.ok(cancellation.terminated >= beforeCancel.terminated + 1, 'Cancellation terminates the decoder Worker');
  assert.equal(await page.locator('#upload-area').evaluate(element => element.hidden), false);
  assert.equal(await page.locator('#results').evaluate(element => element.hidden), true);
  await page.locator('#file-input').setInputFiles({ name: 'after-cancel.gif', mimeType: 'image/gif', buffer: sample });
  await waitForFrames();
  assert.equal(await page.locator('#file-name').textContent(), 'after-cancel.gif');
  checks.push('cancel during decoding terminates Worker and next upload succeeds');

  await page.setViewportSize({ width: 320, height: 900 });
  for (const locale of LOCALES) {
    await visit(pagePath(locale));
    await assertNoOverflow(`${locale} upload page at 320px`);
    await page.locator('#sample-button').click();
    await waitForFrames();
    await assertNoOverflow(`${locale} extracted sample at 320px`);
    await page.locator('.language-menu summary').click();
    await assertNoOverflow(`${locale} language menu at 320px`);
    await page.locator('.language-menu summary').click();
    if (locale === 'zh-hant') await page.screenshot({ path: join(artifacts, 'sample-mobile-zh-hant.png'), fullPage: true });
  }
  checks.push('all 10 languages at 320px without horizontal overflow');

  await visit(pagePath('en', 'guide'));
  assert.equal(await page.locator('h1').count(), 1);
  assert.ok(await page.locator('.article-toc').isVisible());
  await assertNoOverflow('guide at 320px');
  await visit('/browser-regression-missing-page/', 404);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
  assert.equal(await page.locator('h1').count(), 1);
  checks.push('guide and real 404 with Pages security headers');

  assert.deepEqual(failures, [], 'Browser runtime errors or CSP violations');
  await writeFile(join(artifacts, 'summary.json'), JSON.stringify({ status: 'PASS', checks, failures }, null, 2));
  console.log(`PASS: ${checks.length} browser checks; sample, PNG/ZIP, corrupt GIFs, playback/cancel, 10 mobile languages, guide/404; no runtime or CSP errors. Artifacts: output/playwright/`);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, 'summary.json'), JSON.stringify({ status: 'FAIL', checks, error: error.stack || String(error), failures }, null, 2));
  console.error(`FAIL: ${error.stack || error}\nArtifacts: output/playwright/`);
  process.exitCode = 1;
} finally {
  await context?.tracing.stop({ path: join(artifacts, 'trace.zip') }).catch(() => {});
  await cleanup();
}
