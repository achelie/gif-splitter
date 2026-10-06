import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGIF } from 'gifuct-js';
import { decodeGifFrame } from '../src/gif-decoder.js';

const palette = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];

// Pack explicitly sized codes, independently of the decoder's dictionary or
// code-width decisions. This also allows deliberately invalid compressed data.
function packCodes(codes) {
  const bytes = [];
  let bits = 0;
  let count = 0;
  for (const [code, width] of codes) {
    bits |= code << count;
    count += width;
    while (count >= 8) {
      bytes.push(bits & 255);
      bits >>>= 8;
      count -= 8;
    }
  }
  if (count) bytes.push(bits & 255);
  return bytes;
}

function gifBytes({ width, height = 1, data, minCodeSize = 2, global = palette, local, interlaced = false, gce }) {
  const word = (value) => [value & 255, value >> 8];
  const size = (table) => Math.log2(table.length) - 1;
  const bytes = [
    ...Buffer.from('GIF89a'), ...word(width), ...word(height), 0x80 | size(global), 0, 0, ...global.flat(),
  ];
  if (gce) bytes.push(0x21, 0xf9, 4, (gce.disposal << 2) | 1, 0, 0, gce.transparentIndex, 0);
  bytes.push(0x2c, 0, 0, 0, 0, ...word(width), ...word(height),
    (interlaced ? 0x40 : 0) | (local ? 0x80 | size(local) : 0));
  if (local) bytes.push(...local.flat());
  bytes.push(minCodeSize);
  for (let offset = 0; offset < data.length; offset += 255) {
    const block = data.slice(offset, offset + 255);
    bytes.push(block.length, ...block);
  }
  bytes.push(0, 0x3b);
  return Uint8Array.from(bytes);
}

function parse(bytes) {
  return parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function decode(bytes) {
  const parsed = parse(bytes);
  return decodeGifFrame(parsed.frames.find(frame => frame.image), parsed.gct);
}

const codes3 = (codes) => packCodes(codes.map(code => [code, 3]));
const rgba = (indices, colors = palette, transparent) => indices.flatMap(index => [...colors[index], index === transparent ? 0 : 255]);
const rejects = (bytes, message) => assert.throws(() => decode(bytes), { name: 'GifDecodeError', code: 'INVALID_GIF', ...(message ? { message } : {}) });

test('rejects the 41-byte self-referencing LZW attack without an expandable stack', () => {
  const bytes = gifBytes({ width: 5, data: [182, 11] });
  assert.equal(bytes.length, 41);
  rejects(bytes, /first image code/);
  // The same invalid first dictionary code following an explicit clear is
  // equally unsafe; an initial clear alone does not validate the stream.
  rejects(gifBytes({ width: 5, data: codes3([4, 6, 6, 6, 5]) }), /first image code/);
});

test('rejects unassigned dictionary codes after a valid literal', () => {
  rejects(gifBytes({ width: 2, data: codes3([4, 0, 7, 5]) }), /unassigned dictionary/);
});

test('rejects early EOI instead of silently padding missing pixels with black', () => {
  const bytes = gifBytes({ width: 5, data: [76, 1] });
  assert.equal(bytes.length, 41);
  rejects(bytes, /fewer pixels/);
});

test('requires an EOI code even when all declared pixels have been decoded', () => {
  rejects(gifBytes({ width: 1, data: codes3([4, 1]) }), /no end-of-information/);
});

test('rejects extra pixels, including a dictionary string that overruns the image', () => {
  rejects(gifBytes({ width: 1, data: codes3([4, 1, 2, 5]) }), /more pixels/);
  rejects(gifBytes({ width: 2, data: codes3([4, 1, 6, 5]) }), /more pixels/);
});

test('rejects decoded indices outside the active color table', () => {
  rejects(gifBytes({ width: 1, minCodeSize: 3, data: [104, 9] }), /missing palette color/);
});

test('decodes the KwKwK special case into known pixels', () => {
  assert.deepEqual(Array.from(decode(gifBytes({ width: 3, data: codes3([4, 1, 6, 5]) })).patch), rgba([1, 1, 1]));
});

test('grows from 3-bit to 4-bit codes at the dictionary boundary', () => {
  const data = packCodes([[4, 3], [0, 3], [1, 3], [2, 3], [3, 4], [0, 4], [1, 4], [2, 4], [3, 4], [5, 4]]);
  assert.deepEqual(Array.from(decode(gifBytes({ width: 8, data })).patch), rgba([0, 1, 2, 3, 0, 1, 2, 3]));
});

test('keeps a full dictionary until a deferred clear and then resets code width', () => {
  const colors = Array.from({ length: 256 }, (_, index) => [index, 255 - index, index ^ 0x55]);
  // The GIF dictionary starts with 258 entries. These literal-only runs fill
  // the remaining slots at the four explicitly specified code widths.
  const codes = [[256, 9], [0, 9]];
  for (const [count, width] of [[254, 9], [512, 10], [1024, 11], [2048, 12], [100, 12]]) {
    for (let i = 0; i < count; i += 1) codes.push([0, width]);
  }
  // Entry 4095 is still available after the table fills, and expands to two
  // zero pixels in this literal-only stream.
  codes.push([4095, 12], [256, 12], [1, 9], [257, 9]);
  const decoded = decode(gifBytes({ width: 3942, global: colors, minCodeSize: 8, data: packCodes(codes) }));
  assert.deepEqual(Array.from(decoded.patch), rgba([...Array(3941).fill(0), 1], colors));
});

test('handles every code-width transition starting with the minimum 2-bit alphabet', () => {
  const codes = [[4, 3], [0, 3]];
  for (const [count, width] of [[2, 3], [8, 4], [16, 5], [32, 6], [64, 7], [128, 8], [256, 9], [512, 10], [1024, 11], [2048, 12]]) {
    for (let i = 0; i < count; i += 1) codes.push([0, width]);
  }
  codes.push([5, 12]);
  assert.deepEqual(Array.from(decode(gifBytes({ width: 4091, data: packCodes(codes) })).patch), rgba(Array(4091).fill(0)));
});

test('clears stale dictionary entries and accepts a literal start without a clear', () => {
  const data = codes3([4, 1, 2, 4, 3, 5]);
  assert.deepEqual(Array.from(decode(gifBytes({ width: 3, data })).patch), rgba([1, 2, 3]));
  assert.deepEqual(Array.from(decode(gifBytes({ width: 2, data: codes3([1, 2, 5]) })).patch), rgba([1, 2]));
});

test('uses the local color table and preserves disposal and transparency metadata', () => {
  const local = [[12, 34, 56], [78, 90, 12], [34, 56, 78], [90, 12, 34]];
  const frame = decode(gifBytes({ width: 2, local, data: codes3([4, 0, 1, 5]), gce: { disposal: 3, transparentIndex: 0 } }));
  assert.deepEqual(frame.dims, { left: 0, top: 0, width: 2, height: 1 });
  assert.equal(frame.disposalType, 3);
  assert.equal(frame.transparentIndex, 0);
  assert.deepEqual(Array.from(frame.patch), rgba([0, 1], local, 0));
});

test('deinterlaces short images with empty interlace passes', () => {
  const indices = [1, 1, 3, 3, 2, 2]; // Three input rows arrive in order 0, 2, 1.
  const data = codes3([...indices.flatMap(index => [4, index]), 5]);
  assert.deepEqual(Array.from(decode(gifBytes({ width: 2, height: 3, interlaced: true, data })).patch), rgba([1, 1, 2, 2, 3, 3]));
});

test('matches every known pixel in a real interlaced GIF encoded independently by Pillow', async () => {
  const bytes = await readFile(new URL('./fixtures/pillow-interlaced.gif', import.meta.url));
  const parsed = parse(bytes);
  const source = parsed.frames.find(frame => frame.image);
  assert.equal(source.image.data.minCodeSize, 8);
  assert.equal(source.image.descriptor.lct.interlaced, true);
  const result = decodeGifFrame(source, parsed.gct);
  assert.deepEqual(result.dims, { left: 0, top: 0, width: 96, height: 96 });
  const expected = new Uint8ClampedArray(96 * 96 * 4);
  for (let y = 0; y < 96; y += 1) for (let x = 0; x < 96; x += 1) {
    const index = ((x * 73 + y * 151 + ((x * y * 17) >> 3)) ^ (x * 11 + y * 31)) & 255;
    expected.set([index, (index * 73) & 255, (index * 151) & 255, 255], (y * 96 + x) * 4);
  }
  assert.deepEqual(result.patch, expected);
});

test('decodes all published example GIF frames with their declared dimensions', async () => {
  for (const filename of ['sample.gif', 'examples/timing.gif', 'examples/disposal-2.gif', 'examples/disposal-3.gif']) {
    const bytes = await readFile(new URL(`../public/${filename}`, import.meta.url));
    const parsed = parse(bytes);
    for (const source of parsed.frames.filter(frame => frame.image)) {
      const result = decodeGifFrame(source, parsed.gct);
      assert.equal(result.patch.length, source.image.descriptor.width * source.image.descriptor.height * 4, filename);
    }
  }
});

test('rejects invalid dimensions and code sizes before allocating a patch', () => {
  const parsed = parse(gifBytes({ width: 1, data: codes3([4, 1, 5]) }));
  const source = parsed.frames[0];
  assert.throws(() => decodeGifFrame({ image: { ...source.image, descriptor: { ...source.image.descriptor, width: 65535, height: 65535 } } }, parsed.gct), { code: 'INVALID_GIF' });
  assert.throws(() => decodeGifFrame({ image: { ...source.image, data: { ...source.image.data, minCodeSize: 9 } } }, parsed.gct), { code: 'INVALID_GIF' });
});
