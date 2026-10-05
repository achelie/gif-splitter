import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXAMPLE_DEFINITIONS } from '../src/site/examples.js';

const palette = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];
export function encodeExample({ width, height, frames }) {
  const word = value => [value & 255, value >> 8];
  const bytes = [...Buffer.from('GIF89a'), ...word(width), ...word(height), 0x81, 0, 0, ...palette.flat()];
  for (const frame of frames) {
    bytes.push(0x21, 0xf9, 4, ((frame.disposal ?? 1) << 2) | (frame.transparent ? 1 : 0), ...word(frame.delay ?? 5), 0, 0);
    const codes = frame.pixels.flatMap(pixel => [4, pixel]);
    codes.push(5);
    let buffer = 0, size = 0;
    const compressed = [];
    for (const code of codes) {
      buffer |= code << size;
      size += 3;
      while (size >= 8) { compressed.push(buffer & 255); buffer >>= 8; size -= 8; }
    }
    if (size) compressed.push(buffer & 255);
    bytes.push(0x2c, ...word(frame.left ?? 0), ...word(frame.top ?? 0), ...word(frame.width ?? width), ...word(frame.height ?? height), 0, 2);
    for (let at = 0; at < compressed.length; at += 255) {
      const block = compressed.slice(at, at + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  }
  return Uint8Array.from([...bytes, 0x3b]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await mkdir('public/examples', { recursive: true });
  for (const [name, definition] of Object.entries(EXAMPLE_DEFINITIONS)) await writeFile(`public/examples/${name}.gif`, encodeExample(definition));
  const colors = ['url(#checker)', '#f00', '#0f0', '#00f'];
  const rows = [[[1, 1, 1], [1, 2, 1], [1, 0, 3]], [[1, 1, 1], [1, 2, 1], [1, 1, 3]]];
  const cells = rows.map((frames, row) => `<text x="16" y="${row * 130 + 73}" font-size="30" fill="#54544d">${row + 2}</text>${frames.map((pixels, frame) => pixels.map((color, pixel) => `<rect x="${60 + frame * 220 + pixel * 60}" y="${row * 130 + 24}" width="60" height="80" fill="${colors[color]}" stroke="#e5e5df"/>`).join('')).join('')}`).join('');
  await writeFile('public/examples/disposal-comparison.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 280"><defs><pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"/><path d="M0 0h8v8H0zM8 8h8v8H8z" fill="#ddd"/></pattern></defs><rect width="720" height="280" fill="#fafaf9"/>${cells}</svg>\n`);
  console.log('Generated four original GIF fixtures and a disposal comparison.');
}
