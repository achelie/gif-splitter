import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { createMergeEncoder } from '../src/gif-merger-encoder.js';
import { inspectMergeGif, mergeGifs, MERGE_LIMITS } from '../src/gif-merger.js';
import { encodeExample } from '../scripts/make-guide-examples.mjs';

const example = (width, height, frames = 1) => new Blob([encodeExample({
  width, height, frames: Array.from({ length: frames }, () => ({ width: 1, height: 1, pixels: [1], delay: 5 })),
})], { type: 'image/gif' });

test('encoder writes full frames with independent palette, delays, transparent disposal and infinite loop', () => {
  const encoder = createMergeEncoder(2, 1);
  encoder.write(Uint8Array.from([255, 0, 0, 255, 0, 0, 0, 0]), 30);
  encoder.write(Uint8Array.from([0, 0, 0, 0, 0, 255, 0, 255]), 50);
  encoder.write(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]), 0);
  const bytes = encoder.finish();
  const parsed = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const frames = decompressFrames(parsed, true);
  assert.equal(frames.length, 3);
  // gifuct normalizes 0 delay to 100ms; check exact raw GCE delay separately.
  assert.deepEqual(parsed.frames.filter(frame => frame.image).map(frame => frame.gce.delay), [3, 5, 0]);
  assert.deepEqual(frames.map(frame => frame.disposalType), [2, 2, 2]);
  assert.deepEqual(frames.map(frame => [...frame.patch]), [
    [255, 0, 0, 255, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 255, 0, 255],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ]);
  assert.ok(Buffer.from(bytes).includes(Buffer.from('NETSCAPE2.0')));
  const loop = Buffer.from(bytes).indexOf(Buffer.from('NETSCAPE2.0'));
  assert.deepEqual([...bytes.slice(loop + 11, loop + 16)], [3, 1, 0, 0, 0]);
});

test('metadata scanner checks complete container and counts image frames', async () => {
  const blob = example(3, 2, 4);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(inspectMergeGif(bytes), { width: 3, height: 2, frames: 4 });
  assert.throws(() => inspectMergeGif(bytes.subarray(0, bytes.length - 1)), { code: 'INVALID_GIF' });
  const invalid = bytes.slice(); invalid[0] = 0;
  assert.throws(() => inspectMergeGif(invalid), { code: 'NOT_GIF' });
});

test('rejects input count and combined budgets before allocating canvas', async () => {
  const file = example(1, 1);
  await assert.rejects(mergeGifs([file]), { code: 'MERGE_FILES' });
  await assert.rejects(mergeGifs(Array(11).fill(file)), { code: 'MERGE_FILES' });
  await assert.rejects(mergeGifs([new Blob([new Uint8Array(MERGE_LIMITS.maxInputBytes)]), file]), { code: 'MERGE_SIZE' });
  await assert.rejects(mergeGifs([example(1, 1, 400), file]), { code: 'MERGE_FRAMES' });
  await assert.rejects(mergeGifs([example(4000, 1), example(1, 4000)]), { code: 'MERGE_DIMENSIONS' });
  await assert.rejects(mergeGifs([example(1000, 1000, 20), example(1000, 1000)]), { code: 'MERGE_MEMORY' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(mergeGifs([file, file], { signal: controller.signal }), { name: 'AbortError' });
});
