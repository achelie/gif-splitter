import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const decodeHtml = value => value.replace(/&(?:#(x[\da-f]+|\d+)|([a-z]+));/gi, (entity, numeric, name) => {
  if (numeric) {
    const point = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[name.toLowerCase()] ?? entity;
});

// Read actual opening tags, ignoring comments and raw-text element bodies. In
// particular, strings containing URLs or HTML inside JavaScript are not assets.
function* tags(html) {
  const pattern = /<!--[^]*?-->|<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    if (!match[1]) continue;
    const name = match[1].toLowerCase();
    const attributes = Object.fromEntries([...match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map((attribute) => [attribute[1].toLowerCase(), decodeHtml(attribute[2] ?? attribute[3] ?? attribute[4] ?? '')]));
    yield { name, attributes };
    if (['script', 'style', 'textarea', 'title'].includes(name)) {
      const closing = new RegExp(`</${name}\\s*>`, 'gi');
      closing.lastIndex = pattern.lastIndex;
      const end = closing.exec(html);
      pattern.lastIndex = end ? closing.lastIndex : html.length;
    }
  }
}

const within = (root, path) => {
  const displacement = relative(root, path);
  return displacement !== '..' && !displacement.startsWith(`..${sep}`) && !isAbsolute(displacement);
};

export function createSiteResourceChecker({ distDir, origin, pages = new Map(), contactEmail }) {
  const root = resolve(distDir);
  const siteOrigin = new URL(origin).origin;
  let realRoot;
  const pageIds = new Map();
  const fail = (source, reference, message, cause) => {
    throw new Error(`${source}: ${reference}: ${message}`, cause ? { cause } : undefined);
  };

  async function file(relativePath, source, reference, { htmlRoute = false } = {}) {
    if (typeof relativePath !== 'string' || !relativePath || isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)
        || /[\\\0]/.test(relativePath) || relativePath.split('/').includes('..')) {
      fail(source, reference, `Path escapes dist or is invalid: ${relativePath}`);
    }
    let target = resolve(root, relativePath);
    if (!within(root, target)) fail(source, reference, `Path escapes dist: ${relativePath}`);
    try {
      let details = await stat(target);
      if (htmlRoute && details.isDirectory()) {
        target = resolve(target, 'index.html');
        details = await stat(target);
      }
      if (!details.isFile()) fail(source, reference, `Expected a file in dist: ${relativePath}`);
      realRoot ??= await realpath(root);
      if (!within(realRoot, await realpath(target))) fail(source, reference, `Path escapes dist through a symbolic link: ${relativePath}`);
      return target;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail(source, reference, `Missing file in dist: ${relativePath}`, error);
      throw error;
    }
  }

  async function checkHtml(html, source) {
    for (const { name, attributes } of tags(html)) {
      let attribute;
      if (['script', 'img'].includes(name) && 'src' in attributes) attribute = 'src';
      else if (['link', 'a'].includes(name) && 'href' in attributes) attribute = 'href';
      else if (name === 'meta' && ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']
        .includes((attributes.property ?? attributes.name ?? '').toLowerCase()) && 'content' in attributes) attribute = 'content';
      if (!attribute) continue;
      const target = attributes[attribute];
      const reference = `<${name}> ${attribute}="${target}"`;
      if (!target.trim()) fail(source, reference, 'Empty resource URL');
      let url;
      try { url = new URL(target, siteOrigin + source); }
      catch (error) { fail(source, reference, 'Invalid resource URL', error); }
      if (url.protocol === 'mailto:') {
        if (name !== 'a' || (contactEmail && target !== `mailto:${contactEmail}`)) fail(source, reference, 'Unexpected contact address');
        continue;
      }
      if (['data:', 'blob:'].includes(url.protocol) && name === 'img') continue;
      if (url.origin !== siteOrigin) {
        if (url.protocol === 'https:') continue;
        fail(source, reference, 'Unsupported external URL');
      }
      let pathname, anchor;
      try {
        pathname = decodeURIComponent(url.pathname);
        anchor = decodeURIComponent(url.hash.slice(1));
      } catch (error) { fail(source, reference, 'Invalid URL encoding', error); }
      const relativePath = pathname.slice(1) || 'index.html';
      const destination = await file(relativePath, source, reference, { htmlRoute: true });
      if (anchor && ['a', 'link'].includes(name)) {
        if (!pageIds.has(destination)) {
          const markup = pages.get(url.pathname) ?? await readFile(destination, 'utf8');
          pageIds.set(destination, new Set([...tags(markup)].flatMap(({ name: tag, attributes: attrs }) =>
            [attrs.id, tag === 'a' ? attrs.name : undefined].filter(value => value !== undefined))));
        }
        if (!pageIds.get(destination).has(anchor)) fail(source, reference, `Broken anchor: #${anchor}`);
      }
    }
  }

  async function checkManifest(manifest, source = '/.vite/manifest.json', { requiredEntries = [] } = {}) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail(source, 'manifest', 'Expected a Vite manifest object');
    for (const entry of requiredEntries) {
      if (!Object.hasOwn(manifest, entry)) fail(source, `entry "${entry}"`, 'Missing Vite entry');
    }
    const visited = new Set();
    async function visit(key, importer) {
      if (!Object.hasOwn(manifest, key)) fail(source, importer ?? `entry "${key}"`, `Missing Vite manifest import: ${key}`);
      if (visited.has(key)) return;
      visited.add(key);
      const chunk = manifest[key];
      const reference = `entry "${key}"`;
      if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) fail(source, reference, 'Expected a Vite chunk object');
      await file(chunk.file, source, `${reference} file`);
      for (const field of ['css', 'assets', 'imports', 'dynamicImports']) {
        if (chunk[field] === undefined) continue;
        if (!Array.isArray(chunk[field]) || chunk[field].some(value => typeof value !== 'string' || !value)) fail(source, `${reference} ${field}`, 'Expected non-empty file or import names');
        for (const target of chunk[field]) {
          if (['imports', 'dynamicImports'].includes(field)) await visit(target, `${reference} ${field} "${target}"`);
          else await file(target, source, `${reference} ${field} "${target}"`);
        }
      }
    }
    // Include every emitted chunk and asset, including workers and dynamic
    // entries that are not directly referenced by the initial HTML document.
    for (const key of Object.keys(manifest)) await visit(key);
  }

  return { checkHtml, checkManifest };
}
