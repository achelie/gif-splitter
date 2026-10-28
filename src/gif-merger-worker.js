import { createMergeEncoder } from './gif-merger-encoder.js';

let encoder;
self.addEventListener('message', ({ data }) => {
  try {
    if (data.type === 'init') encoder = createMergeEncoder(data.width, data.height);
    else if (data.type === 'frame') encoder.write(new Uint8Array(data.rgba), data.delay);
    else if (data.type === 'finish') {
      const bytes = encoder.finish();
      self.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
      return;
    } else throw new Error('Unknown encoder operation');
    self.postMessage({ ok: true });
  } catch {
    self.postMessage({ error: true });
  }
});
