import { extractGif, GifError } from './gif-engine.js';

export const MERGE_LIMITS = Object.freeze({
  minFiles: 2, maxFiles: 10, maxInputBytes: 30 * 1024 * 1024,
  maxFrames: 400, maxDimension: 4096, maxFramePixels: 4_000_000, maxOutputPixels: 20_000_000,
});

const fail = (code, message) => { throw new GifError(code, message); };
const abort = () => new DOMException('Merging was cancelled.', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw abort(); };
const badGif = () => fail('INVALID_GIF', 'This GIF is incomplete or damaged.');

// Bound the combined work before allocating canvases or producing PNG frames.
// The extraction engine independently performs full container and LZW validation.
export function inspectMergeGif(bytes) {
  if (bytes.length < 14) badGif();
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') fail('NOT_GIF', 'Please choose GIF files.');
  const word = at => bytes[at] | bytes[at + 1] << 8;
  const width = word(6), height = word(8);
  if (!width || !height) badGif();
  let cursor = 13, frames = 0;
  const requireBytes = n => { if (cursor + n > bytes.length) badGif(); };
  const skipBlocks = () => {
    for (;;) {
      requireBytes(1);
      const n = bytes[cursor++];
      if (!n) break;
      requireBytes(n);
      cursor += n;
    }
  };
  if (bytes[10] & 0x80) { const n = 3 * 2 ** ((bytes[10] & 7) + 1); requireBytes(n); cursor += n; }
  for (;;) {
    requireBytes(1);
    const marker = bytes[cursor++];
    if (marker === 0x3b) break;
    if (marker === 0x21) { requireBytes(1); cursor++; skipBlocks(); continue; }
    if (marker !== 0x2c) badGif();
    requireBytes(9);
    const packed = bytes[cursor + 8];
    cursor += 9;
    if (packed & 0x80) { const n = 3 * 2 ** ((packed & 7) + 1); requireBytes(n); cursor += n; }
    requireBytes(1); cursor++;
    skipBlocks();
    if (++frames > MERGE_LIMITS.maxFrames) fail('MERGE_FRAMES', 'The selected GIFs have too many frames.');
  }
  if (!frames) fail('NO_FRAMES', 'This GIF does not contain any image frames.');
  return { width, height, frames };
}

function createEncoderWorker(signal) {
  if (typeof Worker !== 'function') fail('MERGE_ENCODER', 'Your browser cannot start the GIF encoder.');
  let worker;
  try { worker = new Worker(new URL('./gif-merger-worker.js', import.meta.url), { type: 'module' }); }
  catch { fail('MERGE_ENCODER', 'Your browser cannot start the GIF encoder.'); }
  let pending;
  let closed = false;
  const close = (reason = abort()) => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener('abort', onAbort);
    worker.terminate();
    pending?.reject(reason);
    pending = undefined;
  };
  const onAbort = () => close();
  signal?.addEventListener('abort', onAbort, { once: true });
  worker.addEventListener('message', ({ data }) => {
    const task = pending;
    pending = undefined;
    if (!task) return;
    if (data.error) task.reject(new GifError('MERGE_ENCODER', 'The GIF could not be encoded.'));
    else task.resolve(data);
  });
  worker.addEventListener('error', () => close(new GifError('MERGE_ENCODER', 'The GIF encoder could not run.')));
  worker.addEventListener('messageerror', () => close(new GifError('MERGE_ENCODER', 'The GIF encoder could not run.')));
  return {
    request(data, transfer = []) {
      checkAbort(signal);
      if (closed) return Promise.reject(new GifError('MERGE_ENCODER', 'The GIF encoder is unavailable.'));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        try { worker.postMessage(data, transfer); } catch { pending = undefined; reject(new GifError('MERGE_ENCODER', 'The GIF encoder could not run.')); }
      });
    }, close,
  };
}

async function loadPng(blob, signal) {
  checkAbort(signal);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    checkAbort(signal);
    return image;
  } finally { URL.revokeObjectURL(url); }
}

/** Merge GIFs sequentially, entirely locally. Input order is output order. */
export async function mergeGifs(input, { signal, onProgress } = {}) {
  checkAbort(signal);
  const files = Array.from(input ?? []);
  if (files.length < MERGE_LIMITS.minFiles || files.length > MERGE_LIMITS.maxFiles) fail('MERGE_FILES', 'Choose between 2 and 10 GIFs.');
  if (files.some(file => !file || !file.size || typeof file.arrayBuffer !== 'function')) fail('EMPTY_FILE', 'Please choose non-empty GIF files.');
  if (files.reduce((total, file) => total + file.size, 0) > MERGE_LIMITS.maxInputBytes) fail('MERGE_SIZE', 'The selected GIFs exceed 30 MiB in total.');
  const metadata = [];
  let width = 0, height = 0, frameCount = 0;
  for (const file of files) {
    checkAbort(signal);
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkAbort(signal);
    const info = inspectMergeGif(bytes);
    metadata.push(info);
    width = Math.max(width, info.width); height = Math.max(height, info.height); frameCount += info.frames;
    if (frameCount > MERGE_LIMITS.maxFrames) fail('MERGE_FRAMES', 'The selected GIFs have more than 400 frames in total.');
  }
  if (width > MERGE_LIMITS.maxDimension || height > MERGE_LIMITS.maxDimension || width * height > MERGE_LIMITS.maxFramePixels) {
    fail('MERGE_DIMENSIONS', 'The output canvas is too large. Use smaller GIFs.');
  }
  if (width * height * frameCount > MERGE_LIMITS.maxOutputPixels) fail('MERGE_MEMORY', 'The combined GIF needs too much memory. Use smaller or shorter GIFs.');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { canvas.width = canvas.height = 0; fail('CANVAS', 'Your browser could not create an image canvas.'); }
  let encoder;
  let duration = 0;
  try {
    encoder = createEncoderWorker(signal);
    await encoder.request({ type: 'init', width, height });
    for (let index = 0; index < files.length; index++) {
      const fileIndex = index + 1, fileCount = files.length;
      const gif = await extractGif(files[index], { signal, onProgress: ({ completed, total }) => onProgress?.({ stage: 'decoding', fileIndex, fileCount, completed, total }) });
      for (let i = 0; i < gif.frames.length; i++) {
        checkAbort(signal);
        const frame = gif.frames[i];
        const image = await loadPng(frame.blob, signal);
        context.clearRect(0, 0, width, height);
        context.drawImage(image, Math.floor((width - gif.width) / 2), Math.floor((height - gif.height) / 2));
        const rgba = context.getImageData(0, 0, width, height).data;
        await encoder.request({ type: 'frame', rgba: rgba.buffer, delay: frame.delay }, [rgba.buffer]);
        duration += frame.delay;
        onProgress?.({ stage: 'encoding', fileIndex, fileCount, completed: i + 1, total: gif.frames.length });
      }
    }
    checkAbort(signal);
    const { bytes } = await encoder.request({ type: 'finish' });
    return { blob: new Blob([bytes], { type: 'image/gif' }), width, height, frameCount, duration };
  } finally {
    encoder?.close();
    canvas.width = canvas.height = 0;
  }
}
