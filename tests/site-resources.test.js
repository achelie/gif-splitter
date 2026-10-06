import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createSiteResourceChecker } from '../scripts/site-resources.mjs';

const origin = 'https://www.gifsplitter.com';

async function fixture(t) {
  const temporary = await mkdtemp(join(tmpdir(), 'gif-site-resources-'));
  t.after(async () => {
    // Only remove the temporary directory created by this test.
    const target = resolve(temporary);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('gif-site-resources-'));
    await rm(target, { recursive: true, force: true });
  });
  const distDir = join(temporary, 'dist');
  for (const folder of ['assets', 'examples', 'guide']) await mkdir(join(distDir, folder), { recursive: true });
  const pages = new Map([
    ['/', '<main id="content">Home</main>'],
    ['/guide/', '<h1 id="content">Guide</h1><section id="part:one"></section><a name="legacy"></a>'],
  ]);
  const files = {
    'index.html': pages.get('/'),
    'guide/index.html': pages.get('/guide/'),
    '404.html': '<a href="/guide/#content">Guide</a>',
    'examples/disposal-comparison.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'og.png': 'image',
    'assets/app.js': 'const example = "/missing.gif"; const markup = "<img src=\'/also-missing.png\'>";',
    'assets/site.js': 'export const site = true;',
    'assets/decoder-worker.js': 'self.onmessage = () => {};',
    'assets/shared.js': 'export const shared = true;',
    'assets/site.css': 'body { color: black; }',
    'assets/palette.json': '[]',
  };
  await Promise.all(Object.entries(files).map(([path, body]) => writeFile(join(distDir, path), body)));
  const manifest = {
    'src/main.js': { file: 'assets/app.js', isEntry: true, imports: ['src/site.js'], dynamicImports: ['src/decoder-worker.js'] },
    'src/site.js': { file: 'assets/site.js', isEntry: true, css: ['assets/site.css'] },
    'src/decoder-worker.js': { file: 'assets/decoder-worker.js', imports: ['_shared.js'], assets: ['assets/palette.json'] },
    '_shared.js': { file: 'assets/shared.js' },
  };
  const checker = createSiteResourceChecker({ distDir, origin, pages, contactEmail: 'contact@gifsplitter.com' });
  return { checker, distDir, temporary, manifest };
}

test('local, absolute same-origin, encoded anchors, social images and the complete Vite graph pass', async t => {
  const { checker, manifest } = await fixture(t);
  await checker.checkHtml(`
    <link href="/assets/site.css" rel="stylesheet">
    <script src="${origin}/assets/app.js"></script>
    <img src='/examples/disposal-comparison.svg' alt="Example">
    <meta content="${origin}/og.png" property="og:image">
    <meta name='twitter:image' content='/og.png'>
    <a href="${origin}/guide/#part%3Aone">Encoded anchor</a>
    <a href="/guide/#legacy">Legacy anchor</a>
    <a href="#content">This page</a>
    <a href="mailto:contact@gifsplitter.com">Contact</a>
    <a href="https://external.example/missing.html">External</a>
    <img src="https://external.example/missing.png">
    <img src="data:image/png;base64,AA==">
    <a href="/guide/?one=1&amp;two=2#content">Query</a>
  `, '/');
  await checker.checkManifest(manifest, '/.vite/manifest.json', { requiredEntries: ['src/main.js', 'src/site.js'] });
});

test('missing article SVG fails with the page and resource in the error', async t => {
  const { checker, distDir } = await fixture(t);
  await rm(join(distDir, 'examples/disposal-comparison.svg'));
  await assert.rejects(checker.checkHtml('<img src="/examples/disposal-comparison.svg">', '/guide/'),
    /\/guide\/: <img> src="\/examples\/disposal-comparison\.svg": Missing file in dist/);
});

for (const property of ['og:image', 'twitter:image']) {
  test(`missing ${property} image fails even when its URL is absolute`, async t => {
    const { checker, distDir } = await fixture(t);
    await rm(join(distDir, 'og.png'));
    await assert.rejects(checker.checkHtml(`<meta name="${property}" content="${origin}/og.png">`, '/guide/'),
      /\/guide\/: <meta> content="https:\/\/www\.gifsplitter\.com\/og\.png": Missing file in dist/);
  });
}

test('absolute same-origin links cannot skip missing destinations or anchors', async t => {
  const { checker } = await fixture(t);
  await assert.rejects(checker.checkHtml(`<a href="${origin}/missing/">Missing</a>`, '/guide/'),
    /\/guide\/: <a> href="https:\/\/www\.gifsplitter\.com\/missing\/": Missing file in dist/);
  await assert.rejects(checker.checkHtml(`<a href="${origin}/guide/#missing">Missing</a>`, '/'),
    /\/: <a> href="https:\/\/www\.gifsplitter\.com\/guide\/#missing": Broken anchor: #missing/);
});

test('404 references use the same image, URL and anchor checks', async t => {
  const { checker } = await fixture(t);
  await checker.checkHtml('<img src="/og.png"><a href="/guide/#content">Guide</a>', '/404.html');
  await assert.rejects(checker.checkHtml('<img src="/missing.png">', '/404.html'), /\/404\.html: <img>.*Missing file in dist/);
  await assert.rejects(checker.checkHtml('<a href="/guide/#missing">Guide</a>', '/404.html'), /\/404\.html: <a>.*Broken anchor/);
});

test('tag parsing ignores comments and JavaScript HTML strings, and decodes attributes', async t => {
  const { checker } = await fixture(t);
  await checker.checkHtml(`<!-- <img src="/missing.png"> -->
    <script>const snippet = '<img src="/missing.png">'; const url = '/missing.gif';</script>
    <style>.example::after { content: '<img src="/missing.png">'; }</style>
    <img alt="a > b" src=&#47;og.png>
    <a href="/guide/#part&#58;one">Guide</a>
  `, '/');
});

for (const field of ['imports', 'dynamicImports']) {
  test(`a missing manifest ${field} entry fails with its importer`, async t => {
    const { checker, manifest } = await fixture(t);
    manifest['src/main.js'][field] = ['src/missing.js'];
    await assert.rejects(checker.checkManifest(manifest),
      new RegExp(`manifest\\.json: entry "src/main\\.js" ${field} "src/missing\\.js": Missing Vite manifest import`));
  });
}

for (const [file, field] of [['assets/site.css', 'css'], ['assets/palette.json', 'assets'], ['assets/decoder-worker.js', 'file']]) {
  test(`missing emitted ${field} asset ${file} fails, including decoder workers`, async t => {
    const { checker, manifest, distDir } = await fixture(t);
    await rm(join(distDir, file));
    await assert.rejects(checker.checkManifest(manifest), error => {
      assert.ok(error.message.startsWith('/.vite/manifest.json: entry '));
      assert.ok(error.message.includes(`${field}`));
      assert.ok(error.message.includes(`Missing file in dist: ${file}`));
      return true;
    });
  });
}

test('unreferenced worker chunks and required initial entries are also checked', async t => {
  const { checker, manifest } = await fixture(t);
  manifest['src/orphan-worker.js'] = { file: 'assets/missing-worker.js' };
  await assert.rejects(checker.checkManifest(manifest), /entry "src\/orphan-worker\.js" file: Missing file in dist/);
  await assert.rejects(checker.checkManifest({}, '/.vite/manifest.json', { requiredEntries: ['src/main.js'] }), /entry "src\/main\.js": Missing Vite entry/);
});

test('references must name a file rather than an existing directory', async t => {
  const { checker, manifest, distDir } = await fixture(t);
  await mkdir(join(distDir, 'empty'));
  await assert.rejects(checker.checkHtml('<a href="/empty/">Empty</a>', '/'), /Missing file in dist: empty\//);
  manifest['src/site.js'].file = 'assets';
  await assert.rejects(checker.checkManifest(manifest), /Expected a file in dist: assets/);
});

test('decoded URL and manifest traversal cannot read a file outside dist', async t => {
  const { checker, manifest, temporary } = await fixture(t);
  await writeFile(join(temporary, 'outside.txt'), 'outside');
  await assert.rejects(checker.checkHtml('<img src="/assets/%2e%2e%2f%2e%2e%2foutside.txt">', '/'), /Path escapes dist or is invalid/);
  manifest['src/main.js'].file = '../outside.txt';
  await assert.rejects(checker.checkManifest(manifest), /Path escapes dist or is invalid: \.\.\/outside\.txt/);
  manifest['src/main.js'].file = 'C:/outside.txt';
  await assert.rejects(checker.checkManifest(manifest), /Path escapes dist or is invalid: C:\/outside\.txt/);
});

test('symbolic links cannot extend resource checks outside dist', async t => {
  const { checker, distDir, temporary } = await fixture(t);
  const outside = join(temporary, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'image.png'), 'outside');
  try { await symlink(outside, join(distDir, 'assets/external'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Symbolic links are unavailable on this host');
    throw error;
  }
  await assert.rejects(checker.checkHtml('<img src="/assets/external/image.png">', '/'), /Path escapes dist through a symbolic link/);
});

test('malformed URLs, unsupported protocols and unexpected contact addresses include their source', async t => {
  const { checker } = await fixture(t);
  await assert.rejects(checker.checkHtml('<img src="">', '/guide/'), /\/guide\/: <img>.*Empty resource URL/);
  await assert.rejects(checker.checkHtml('<img src="/%ZZ.png">', '/guide/'), /\/guide\/: <img>.*Invalid URL encoding/);
  await assert.rejects(checker.checkHtml('<a href="javascript:alert(1)">Bad</a>', '/guide/'), /\/guide\/: <a>.*Unsupported external URL/);
  await assert.rejects(checker.checkHtml('<a href="mailto:wrong@example.com">Bad</a>', '/guide/'), /\/guide\/: <a>.*Unexpected contact address/);
});
