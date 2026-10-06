import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const setup = `
  import assert from 'node:assert/strict';
  import { extractGif } from './src/gif-engine.js';
  globalThis.document = { createElement: () => ({
    getContext: () => ({ fillRect() {}, clearRect() {}, putImageData() {}, drawImage() {},
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) }),
    toBlob: callback => callback(new Blob([new Uint8Array(4)], { type: 'image/png' })),
  }) };
  const header = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,129,0,0,
    0,0,0,255,0,0,0,255,0,0,0,255]);
  const descriptor = Uint8Array.from([44,0,0,0,0,1,0,1,0,0,2]);
`;

async function boundedExtraction(body) {
  const result = await run(process.execPath, ['--max-old-space-size=32', '--input-type=module', '--eval', setup + body], {
    cwd: root, timeout: 10_000, windowsHide: true, maxBuffer: 4096,
  });
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.trim(), 'PASS');
}

test('half a million metadata extensions extract under a 32 MB heap without retaining objects', async () => {
  await boundedExtraction(`
    const count = 500_000;
    const bytes = new Uint8Array(header.length + count * 3 + descriptor.length + 5);
    bytes.set(header);
    let offset = header.length;
    for (let i = 0; i < count; i++) { bytes[offset++] = 0x21; bytes[offset++] = 0xfe; bytes[offset++] = 0; }
    bytes.set(descriptor, offset); offset += descriptor.length;
    bytes.set([2, 76, 1, 0, 59], offset);
    const result = await extractGif(new Blob([bytes]));
    assert.equal(result.frames.length, 1);
    assert.equal(result.width, 1);
    console.log('PASS');
  `);
});

test('hundreds of thousands of compressed sub-blocks extract under a 32 MB heap', async () => {
  await boundedExtraction(`
    // 800,000 clear codes followed by literal red and EOI, at constant 3 bits.
    // Split every encoded byte into its own sub-block: the decoded image is 1x1.
    const codeCount = 800_002;
    const compressed = new Uint8Array(Math.ceil(codeCount * 3 / 8));
    let bits = 0, bitCount = 0, at = 0;
    for (let i = 0; i < codeCount; i++) {
      const code = i < codeCount - 2 ? 4 : i === codeCount - 2 ? 1 : 5;
      bits |= code << bitCount; bitCount += 3;
      while (bitCount >= 8) { compressed[at++] = bits & 255; bits >>>= 8; bitCount -= 8; }
    }
    if (bitCount) compressed[at] = bits & 255;
    const bytes = new Uint8Array(header.length + descriptor.length + compressed.length * 2 + 2);
    bytes.set(header); bytes.set(descriptor, header.length);
    let offset = header.length + descriptor.length;
    for (const byte of compressed) { bytes[offset++] = 1; bytes[offset++] = byte; }
    bytes.set([0, 59], offset);
    const result = await extractGif(new Blob([bytes]));
    assert.equal(result.frames.length, 1);
    assert.equal(result.height, 1);
    console.log('PASS');
  `);
});
