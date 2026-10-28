import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGIF } from 'gifuct-js';
import { encodeExample } from '../scripts/make-guide-examples.mjs';
import { createMergeEncoder } from '../src/gif-merger-encoder.js';
import { EDIT_LIMITS, editGif, inspectEditableGif, inspectEditorBytes, validateEdit } from '../src/gif-editor.js';

function makeExample(frames = 2, repeat) {
  const bytes = encodeExample({ width: 3, height: 2, frames: Array.from({ length: frames }, (_, i) => ({
    width: 1, height: 1, pixels: [i % 3 + 1], transparent: true, delay: i ? 9 : 0,
  })) });
  if (repeat === undefined) return bytes;
  const ext = [0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, repeat & 255, repeat >> 8, 0];
  return Uint8Array.from([...bytes.subarray(0, 25), ...ext, ...bytes.subarray(25)]);
}

test('preflight preserves absent, infinite, and finite GIF loop settings', async () => {
  for (const [input, expected] of [[undefined, -1], [0, 0], [7, 7], [65535, 65535]]) {
    const bytes = makeExample(2, input);
    assert.deepEqual(inspectEditorBytes(bytes), { width: 3, height: 2, frameCount: 2, repeat: expected });
    assert.deepEqual(await inspectEditableGif(new Blob([bytes])), { width: 3, height: 2, frameCount: 2, repeat: expected });
  }
  const damaged = makeExample(1, 0);
  assert.throws(() => inspectEditorBytes(damaged.subarray(0, damaged.length - 1)), { code: 'INVALID_GIF' });
});

test('editor preflight rejects oversized files, frames, dimensions and already cancelled input', async () => {
  await assert.rejects(inspectEditableGif(new Blob([])), { code: 'EMPTY_FILE' });
  await assert.rejects(inspectEditableGif({ size: 30 * 1024 * 1024 + 1, arrayBuffer() { throw new Error('must not read'); } }), { code: 'FILE_SIZE' });
  assert.throws(() => inspectEditorBytes(makeExample(EDIT_LIMITS.maxFrames + 1)), { code: 'EDIT_FRAMES' });
  const oversized = makeExample(1);
  oversized[6] = 0xff; oversized[7] = 0xff;
  assert.throws(() => inspectEditorBytes(oversized), { code: 'DIMENSIONS' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(inspectEditableGif(new Blob([makeExample()]), { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(editGif(new Blob([makeExample()]), {}, { signal: controller.signal }), { name: 'AbortError' });
});

test('crop and resize reject noninteger, out-of-bounds, and resource-heavy output', () => {
  const gif = { width: 10, height: 8, frames: Array(2).fill({}) };
  assert.deepEqual(validateEdit(gif, { mode: 'crop', x: 7, y: 5, width: 3, height: 3 }), { mode: 'crop', x: 7, y: 5, width: 3, height: 3 });
  assert.deepEqual(validateEdit(gif, { mode: 'resize', width: 10, height: 8 }), { mode: 'resize', x: 0, y: 0, width: 10, height: 8 });
  for (const options of [
    { mode: 'crop', x: 8, y: 5, width: 3, height: 3 },
    { mode: 'crop', x: -1, y: 0, width: 1, height: 1 },
    { mode: 'crop', x: 0.5, y: 0, width: 1, height: 1 },
    { mode: 'resize', width: 0, height: 1 },
    { mode: 'bad', width: 1, height: 1 },
  ]) assert.throws(() => validateEdit(gif, options), { code: 'EDIT_OPTIONS' });
  assert.throws(() => validateEdit(gif, { mode: 'resize', width: 4097, height: 1 }), { code: 'EDIT_DIMENSIONS' });
  assert.throws(() => validateEdit({ ...gif, frames: Array(6).fill({}) }, { mode: 'resize', width: 2000, height: 2000 }), { code: 'EDIT_MEMORY' });
});

test('GIF encoder emits exact loop semantics and delays while preserving merger default', () => {
  for (const repeat of [-1, 0, 3]) {
    const encoder = createMergeEncoder(1, 1, repeat);
    encoder.write(Uint8Array.from([255, 0, 0, 255]), 0);
    encoder.write(Uint8Array.from([0, 0, 0, 0]), 70);
    const bytes = Buffer.from(encoder.finish());
    const at = bytes.indexOf(Buffer.from('NETSCAPE2.0'));
    if (repeat === -1) assert.equal(at, -1);
    else assert.deepEqual([...bytes.subarray(at + 11, at + 16)], [3, 1, repeat, 0, 0]);
    const parsed = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.deepEqual(parsed.frames.filter(frame => frame.image).map(frame => frame.gce.delay), [0, 7]);
  }
  const defaultEncoder = createMergeEncoder(1, 1);
  defaultEncoder.write(Uint8Array.from([1, 2, 3, 255]), 10);
  const bytes = Buffer.from(defaultEncoder.finish());
  const at = bytes.indexOf(Buffer.from('NETSCAPE2.0'));
  assert.ok(at >= 0);
  assert.deepEqual([...bytes.subarray(at + 11, at + 16)], [3, 1, 0, 0, 0]);
});
