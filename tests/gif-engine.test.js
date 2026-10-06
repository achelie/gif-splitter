import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGif, GIF_LIMITS } from '../src/gif-engine.js';
import { readFile } from 'node:fs/promises';

const colors = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];
const rgba = (index) => index === null ? [0, 0, 0, 0] : [...colors[index], 255];

// A small GIF writer with clear codes between pixels keeps code width fixed.
// This feeds actual encoded bytes through the parser and bounded decoder.
function makeGif({ width = 2, height = 1, frames, background = 0 }) {
  const word = (n) => [n & 255, n >> 8];
  const bytes = [...Buffer.from('GIF89a'), ...word(width), ...word(height), 0x81, background, 0, ...colors.flat()];
  for (const frame of frames) {
    if (frame.gce !== false) {
      bytes.push(0x21, 0xf9, 4, ((frame.disposal ?? 1) << 2) | (frame.transparent ? 1 : 0), ...word(frame.delay ?? 5), 0, 0);
    }
    for (let i = 0; i < (frame.comments ?? 0); i += 1) bytes.push(0x21, 0xfe, 1, 65, 0);
    const codes = frame.pixels.flatMap((pixel) => [4, pixel]);
    codes.push(5);
    const compressed = [];
    let bits = 0;
    let count = 0;
    for (const code of codes) {
      bits |= code << count;
      count += 3;
      while (count >= 8) {
        compressed.push(bits & 255);
        bits >>= 8;
        count -= 8;
      }
    }
    if (count) compressed.push(bits & 255);
    bytes.push(0x2c, ...word(frame.left ?? 0), ...word(frame.top ?? 0), ...word(frame.width ?? width), ...word(frame.height ?? height), 0, 2);
    for (let i = 0; i < compressed.length; i += 255) {
      const block = compressed.slice(i, i + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  }
  bytes.push(0x3b);
  return new Blob([Uint8Array.from(bytes)], { type: 'image/gif' });
}

// Canvas is replaced only at the raster/PNG boundary. GIF parsing, decompression,
// metadata, patch composition and disposal all run through the production code.
class RasterCanvas {
  #width = 0;
  #height = 0;
  data = new Uint8ClampedArray();
  get width() { return this.#width; }
  set width(value) { this.#width = value; this.data = new Uint8ClampedArray(this.#width * this.#height * 4); }
  get height() { return this.#height; }
  set height(value) { this.#height = value; this.data = new Uint8ClampedArray(this.#width * this.#height * 4); }
  getContext() {
    const canvas = this;
    return {
      fillStyle: 'rgb(0, 0, 0)',
      createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      getImageData(left, top, width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          const from = ((top + y) * canvas.width + left + x) * 4;
          data.set(canvas.data.subarray(from, from + 4), (y * width + x) * 4);
        }
        return { width, height, data };
      },
      putImageData(image, left, top) {
        for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
          const from = (y * image.width + x) * 4;
          canvas.data.set(image.data.subarray(from, from + 4), ((top + y) * canvas.width + left + x) * 4);
        }
      },
      drawImage(source, left, top) {
        for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
          const from = (y * source.width + x) * 4;
          if (source.data[from + 3]) canvas.data.set(source.data.subarray(from, from + 4), ((top + y) * canvas.width + left + x) * 4);
        }
      },
      clearRect(left, top, width, height) {
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          canvas.data.fill(0, ((top + y) * canvas.width + left + x) * 4, ((top + y) * canvas.width + left + x) * 4 + 4);
        }
      },
      fillRect(left, top, width, height) {
        const color = [...this.fillStyle.match(/\d+/g).map(Number), 255];
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          canvas.data.set(color, ((top + y) * canvas.width + left + x) * 4);
        }
      },
    };
  }
  toBlob(callback, type) { callback(new Blob([this.data], { type })); }
}

globalThis.document = { createElement: () => new RasterCanvas() };
const pixelsOf = async (frame) => Array.from(new Uint8Array(await frame.blob.arrayBuffer()));

test('extracts a GIF whose only palette is local to its image frame', async () => {
  const bytes = new Uint8Array(await makeGif({ frames: [{ pixels: [1, 3] }] }).arrayBuffer());
  const header = bytes.slice(0, 13);
  header[10] &= 0x7f;
  // Move the four-color GCT after the image descriptor and set its LCT flag.
  const image = bytes.indexOf(0x2c, 25);
  const file = new Blob([header, bytes.subarray(25, image + 9), Uint8Array.of(0x81),
    bytes.subarray(13, 25), bytes.subarray(image + 10)]);
  const result = await extractGif(file);
  assert.deepEqual(await pixelsOf(result.frames[0]), [...rgba(1), ...rgba(3)]);
});

test('extracts every known pixel of the independently encoded interlaced fixture', async () => {
  const bytes = await readFile(new URL('./fixtures/pillow-interlaced.gif', import.meta.url));
  const result = await extractGif(new Blob([bytes]));
  assert.deepEqual([result.width, result.height, result.frames.length], [96, 96, 1]);
  const expected = new Uint8Array(96 * 96 * 4);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const index = ((x * 73 + y * 151 + ((x * y * 17) >> 3)) ^ (x * 11 + y * 31)) & 255;
    expected.set([index, (index * 73) & 255, (index * 151) & 255, 255], (y * 96 + x) * 4);
  }
  assert.deepEqual(new Uint8Array(await result.frames[0].blob.arrayBuffer()), expected);
});

test('composites transparent pixels over earlier frames and preserves raw delays', async () => {
  const progress = [];
  const result = await extractGif(makeGif({ frames: [
    { pixels: [1, 1], transparent: true, delay: 0 },
    { pixels: [0, 2], transparent: true, delay: 7 },
  ] }), { onProgress: (value) => progress.push(value) });
  assert.equal(result.width, 2);
  assert.equal(result.height, 1);
  assert.equal(result.duration, 70);
  assert.deepEqual(result.frames.map(({ delay, index }) => ({ delay, index })), [{ delay: 0, index: 1 }, { delay: 70, index: 2 }]);
  assert.deepEqual(await pixelsOf(result.frames[1]), [...rgba(1), ...rgba(2)]);
  assert.equal(result.frames[1].blob.type, 'image/png');
  assert.deepEqual(progress, [{ completed: 0, total: 2, percent: 0 }, { completed: 1, total: 2, percent: 50 }, { completed: 2, total: 2, percent: 100 }]);
});

test('disposal 2 clears only the preceding patch, retaining transparent background', async () => {
  const result = await extractGif(makeGif({ width: 3, frames: [
    { pixels: [1, 1, 1], transparent: true },
    { pixels: [2], width: 1, left: 1, disposal: 2, transparent: true },
    { pixels: [3], width: 1, left: 2, transparent: true },
  ] }));
  assert.deepEqual(await pixelsOf(result.frames[1]), [...rgba(1), ...rgba(2), ...rgba(1)]);
  assert.deepEqual(await pixelsOf(result.frames[2]), [...rgba(1), ...rgba(null), ...rgba(3)]);
});

test('opaque disposal 2 restores the logical background color', async () => {
  const result = await extractGif(makeGif({ background: 2, frames: [
    { pixels: [1], width: 1, disposal: 2 },
    { pixels: [3], width: 1, left: 1 },
  ] }));
  assert.deepEqual(await pixelsOf(result.frames[0]), [...rgba(1), ...rgba(2)]);
  assert.deepEqual(await pixelsOf(result.frames[1]), [...rgba(2), ...rgba(3)]);
});

test('disposal 3 restores canvas contents from before a temporary overlay', async () => {
  const result = await extractGif(makeGif({ frames: [
    { pixels: [1, 1] },
    { pixels: [2], width: 1, disposal: 3 },
    { pixels: [3], width: 1, left: 1 },
  ] }));
  assert.deepEqual(await pixelsOf(result.frames[1]), [...rgba(2), ...rgba(1)]);
  assert.deepEqual(await pixelsOf(result.frames[2]), [...rgba(1), ...rgba(3)]);
});

test('preserves graphic control data across multiple comment blocks', async () => {
  const result = await extractGif(makeGif({ frames: [{ pixels: [1, 0], transparent: true, delay: 3, comments: 2 }] }));
  assert.equal(result.duration, 30);
  assert.deepEqual(await pixelsOf(result.frames[0]), [...rgba(1), ...rgba(null)]);
});

test('rejects non-GIF input, truncated data and zero dimensions before rendering', async () => {
  await assert.rejects(extractGif(new Blob(['not a gif'])), { name: 'GifError', code: 'NOT_GIF' });
  const valid = await makeGif({ frames: [{ pixels: [1, 2] }] }).arrayBuffer();
  await assert.rejects(extractGif(new Blob([valid.slice(0, -2)])), { name: 'GifError', code: 'INVALID_GIF' });
  const zero = new Uint8Array(valid);
  zero[6] = 0;
  await assert.rejects(extractGif(new Blob([zero])), /incomplete or damaged/);
});

test('rejects dictionary cycles and incomplete LZW pixels through the extraction API', async () => {
  const container = [71, 73, 70, 56, 57, 97, 5, 0, 1, 0, 129, 0, 0,
    0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    44, 0, 0, 0, 0, 5, 0, 1, 0, 0, 2, 2];
  for (const compressed of [[182, 11], [76, 1]]) {
    const file = new Blob([Uint8Array.from([...container, ...compressed, 0, 59])]);
    await assert.rejects(extractGif(file), { name: 'GifError', code: 'INVALID_GIF' });
  }
});

test('rejects oversized files, dimensions, frame counts and total pixel budgets', async () => {
  await assert.rejects(extractGif({ size: GIF_LIMITS.maxBytes + 1, arrayBuffer() { throw new Error('Must not read'); } }), { name: 'GifError', code: 'FILE_SIZE' });
  await assert.rejects(extractGif(makeGif({ width: 9000, frames: [{ width: 1, pixels: [1] }] })), /dimensions are too large/);
  const tooMany = Array.from({ length: GIF_LIMITS.maxFrames + 1 }, () => ({ width: 1, pixels: [1] }));
  await assert.rejects(extractGif(makeGif({ width: 1, frames: tooMany })), /1,000 frames/);
  const huge = Array.from({ length: 6 }, () => ({ width: 1, height: 1, pixels: [1] }));
  await assert.rejects(extractGif(makeGif({ width: 4000, height: 4000, frames: huge })), /browser memory/);
});

test('supports cancellation before loading and between frames', async () => {
  const file = makeGif({ frames: [{ pixels: [1, 2] }, { pixels: [2, 3] }] });
  const before = new AbortController();
  before.abort();
  await assert.rejects(extractGif(file, { signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController();
  await assert.rejects(extractGif(file, {
    signal: during.signal,
    onProgress({ completed }) { if (completed === 1) during.abort(); },
  }), { name: 'AbortError' });
});

test('published timing example preserves 110 ms metadata independently of preview normalization', async () => {
  const bytes = await readFile(new URL('../public/examples/timing.gif', import.meta.url));
  const result = await extractGif(new Blob([bytes]));
  assert.deepEqual(result.frames.map(frame => frame.delay), [0, 10, 20, 80]);
  assert.equal(result.duration, 110);
  assert.equal(result.frames.reduce((sum, frame) => sum + (frame.delay < 20 ? 100 : frame.delay), 0), 300);
});

for (const [disposal, expected] of [[2, [1, null, 3]], [3, [1, 1, 3]]]) {
  test(`published disposal ${disposal} example matches the documented complete canvas`, async () => {
    const bytes = await readFile(new URL(`../public/examples/disposal-${disposal}.gif`, import.meta.url));
    const result = await extractGif(new Blob([bytes]));
    assert.deepEqual([result.width, result.height, result.frames.length], [3, 1, 3]);
    assert.deepEqual(await pixelsOf(result.frames[1]), [...rgba(1), ...rgba(2), ...rgba(1)]);
    assert.deepEqual(await pixelsOf(result.frames[2]), expected.flatMap(rgba));
  });
}

test('published small memory example fails the output pixel budget before raster allocation', async () => {
  const bytes = await readFile(new URL('../public/examples/memory-limit.gif', import.meta.url));
  assert.ok(bytes.length < 1024);
  await assert.rejects(extractGif(new Blob([bytes])), { code: 'MEMORY_LIMIT' });
});
