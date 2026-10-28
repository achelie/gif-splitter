import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { convertFrame, createConvertedZip } from '../src/gif-converter.js';

const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 8, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const input = new Blob(['png frame'], { type: 'image/png' });
let operations = [];
let fallback = false;
let mislabeled = false;

// These tests exercise browser interactions and failure paths with controlled
// canvas responses. Actual JPEG/WebP pixels and file decoding are covered by
// browser integration tests rather than claiming a mock is a real encoder.
globalThis.Image = class {
  naturalWidth = 3;
  naturalHeight = 2;
  async decode() {}
};
globalThis.document = {
  createElement(type) {
    assert.equal(type, 'canvas');
    const context = {
      set fillStyle(value) { operations.push(['color', value]); },
      fillRect(...args) { operations.push(['fill', ...args]); },
      drawImage(...args) { operations.push(['draw', args[1], args[2]]); },
    };
    return {
      width: 0, height: 0,
      getContext() { return context; },
      toBlob(callback, type, quality) {
        operations.push(['encode', type, quality]);
        if (fallback) callback(new Blob([new Uint8Array(12)], { type: mislabeled ? type : 'image/png' }));
        else callback(new Blob([type === 'image/jpeg' ? jpg : webp], { type }));
      },
    };
  },
};

test('JPG paints the chosen background before the image; WebP leaves transparent pixels unfilled', async () => {
  operations = [];
  const result = await convertFrame(input, { format: 'jpg', quality: 0.8, background: '#12aBcD' });
  assert.equal(result.type, 'image/jpeg');
  assert.deepEqual(operations, [['color', '#12aBcD'], ['fill', 0, 0, 3, 2], ['draw', 0, 0], ['encode', 'image/jpeg', 0.8]]);
  operations = [];
  const transparent = await convertFrame(input, { format: 'webp', quality: 0.9 });
  assert.equal(transparent.type, 'image/webp');
  assert.deepEqual(operations, [['draw', 0, 0], ['encode', 'image/webp', 0.9]]);
});

test('rejects browser fallback instead of saving a PNG with a WebP extension', async () => {
  fallback = true;
  try { await assert.rejects(convertFrame(input, { format: 'webp' }), { code: 'FORMAT_UNSUPPORTED' }); }
  finally { fallback = false; }
  fallback = true; mislabeled = true;
  try { await assert.rejects(convertFrame(input, { format: 'webp' }), { code: 'FORMAT_UNSUPPORTED' }); }
  finally { fallback = false; mislabeled = false; }
  await assert.rejects(convertFrame(input, { format: 'webp', quality: 1.1 }), { code: 'CONVERT_OPTIONS' });
  await assert.rejects(convertFrame(input, { format: 'jpg', background: 'transparent' }), { code: 'CONVERT_OPTIONS' });
});

test('cancels promptly even if a browser frame decode remains pending', async () => {
  const previous = globalThis.Image;
  globalThis.Image = class { decode() { return new Promise(() => {}); } };
  const controller = new AbortController();
  try {
    const operation = convertFrame(input, { format: 'webp', signal: controller.signal });
    controller.abort();
    await assert.rejects(operation, { name: 'AbortError' });
  } finally { globalThis.Image = previous; }
});

test('ZIP sorts and deduplicates selected frame numbers and is cancellable', async () => {
  const frames = Array.from({ length: 6 }, () => ({ blob: input }));
  const progress = [];
  const result = await createConvertedZip(frames, [4, 0, 4], { format: 'jpg', sourceName: 'my animation.gif', onProgress: value => progress.push(value.completed) });
  const entries = unzipSync(new Uint8Array(await result.arrayBuffer()));
  assert.deepEqual(Object.keys(entries), ['my-animation-frame-0001.jpg', 'my-animation-frame-0005.jpg']);
  assert.deepEqual(progress, [1, 2]);
  assert.deepEqual(entries['my-animation-frame-0005.jpg'], jpg);
  const controller = new AbortController();
  await assert.rejects(createConvertedZip(frames, [0, 1, 2], {
    format: 'webp', signal: controller.signal, onProgress: () => controller.abort(),
  }), { name: 'AbortError' });
  await assert.rejects(createConvertedZip(frames, [6], { format: 'webp' }), { code: 'CONVERT_OPTIONS' });
});
