import { decodeGifFrame } from './gif-decoder.js';

self.addEventListener('message', ({ data: { source, gct } }) => {
  try {
    const frame = decodeGifFrame(source, gct);
    self.postMessage({ frame }, [frame.patch.buffer]);
  } catch (error) {
    self.postMessage({ error: { code: error.code || 'INVALID_GIF', message: error.message } });
  }
});
