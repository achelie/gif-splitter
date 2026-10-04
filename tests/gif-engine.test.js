import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGif, GIF_LIMITS } from '../src/gif-engine.js';

const colors = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];
const rgba = (index) => index === null ? [0, 0, 0, 0] : [...colors[index], 255];

// A small GIF writer with clear codes between pixels keeps code width fixed.
// This feeds actual encoded bytes through gifuct-js rather than mocking decoding.
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
  await assert.rejects(extractGif(new Blob(['not a gif'])), /valid GIF/);
  const valid = await makeGif({ frames: [{ pixels: [1, 2] }] }).arrayBuffer();
  await assert.rejects(extractGif(new Blob([valid.slice(0, -2)])), /incomplete or damaged/);
  const zero = new Uint8Array(valid);
  zero[6] = 0;
  await assert.rejects(extractGif(new Blob([zero])), /incomplete or damaged/);
});

test('rejects oversized files, dimensions, frame counts and total pixel budgets', async () => {
  await assert.rejects(extractGif({ size: GIF_LIMITS.maxBytes + 1, arrayBuffer() { throw new Error('Must not read'); } }), /30 MB/);
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
