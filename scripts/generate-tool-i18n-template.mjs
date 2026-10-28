import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MERGER_SEO, mergerPage } from '../src/site/merger-page.js';
import { CONVERTER_SEO, converterPage } from '../src/site/converter-page.js';
import { EDITOR_SEO, editorPage } from '../src/site/editor-page.js';

const pages = {};
for (const [type, html, seo] of [
  ['merger', mergerPage(), MERGER_SEO],
  ['jpg', converterPage('jpg'), CONVERTER_SEO.jpg],
  ['webp', converterPage('webp'), CONVERTER_SEO.webp],
  ['resize', editorPage('resize'), EDITOR_SEO.resize],
  ['crop', editorPage('crop'), EDITOR_SEO.crop],
]) {
  const anchorLabels = [];
  const markup = html.replace(/<p>([\s\S]*?)<\/p>/g, (full, inner) => {
    if (!inner.includes('<a ')) return full;
    let i = 0;
    const whole = inner.replace(/<a href="[^"]+">([^<]+)<\/a>/g, (_, label) => {
      anchorLabels.push(label);
      return `{link${i++}}`;
    });
    return `<p>${whole}</p>`;
  });
  const texts = [...markup.matchAll(/>([^<>]+)(?=<)/g)].map(m => m[1].trim())
    .filter(value => value && !/^[\d\s.+–—-]+$/.test(value));
  const labels = [...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1]);
  pages[type] = { seo, strings: Object.fromEntries([...new Set([...texts, ...labels, ...anchorLabels])].map(text => [text, text])) };
}
const nav = [
  'GIF Merger', 'GIF to JPG', 'GIF to WebP', 'Resize GIF', 'Crop GIF',
  'Combine GIFs in sequence into one animation.', 'Save GIF frames as JPEG images with a chosen background.',
  'Save GIF frames as static WebP images.', 'Change the dimensions of an animated GIF.', 'Keep a selected area across every frame.',
];
await mkdir(new URL('../src/locales/tools/', import.meta.url), { recursive: true });
const target = new URL('../src/locales/tools/en.json', import.meta.url);
const existing = await readFile(target, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return {};
  throw error;
});
await writeFile(target, JSON.stringify({ pages, navigation: Object.fromEntries(nav.map(text => [text, text])), ui: existing.ui || {} }, null, 2) + '\n');
console.log(`Generated ${Object.values(pages).reduce((sum, page) => sum + Object.keys(page.strings).length, 0)} page strings.`);
