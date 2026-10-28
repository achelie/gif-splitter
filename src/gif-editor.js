import { GIF_LIMITS, GifError } from './gif-engine.js';

export const EDIT_LIMITS = Object.freeze({ maxFrames: 400, maxDimension: 4096, maxFramePixels: 4_000_000, maxOutputPixels: 20_000_000 });
const fail = (code, message) => { throw new GifError(code, message); };
const abortError = () => new DOMException('Editing was cancelled.', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
const invalid = () => fail('INVALID_GIF', 'This GIF is incomplete or damaged.');

/** Safely inspect the container and its application loop extension.
 *  repeat = -1 means one playback, 0 means forever, positive values are repetitions.
 *  Full decoder validation still happens separately in extractGif. */
export function inspectEditorBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 14) invalid();
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') fail('NOT_GIF', 'Choose a GIF file.');
  const word = at => bytes[at] | (bytes[at + 1] << 8);
  const width = word(6), height = word(8);
  if (!width || !height) invalid();
  if (width > GIF_LIMITS.maxDimension || height > GIF_LIMITS.maxDimension || width * height > GIF_LIMITS.maxFramePixels) {
    fail('DIMENSIONS', 'This GIF has dimensions that are too large.');
  }
  let cursor = 13, frameCount = 0, repeat = -1, foundRepeat = false;
  const need = n => { if (cursor + n > bytes.length) invalid(); };
  function blocks(onBlock) {
    for (;;) {
      need(1);
      const n = bytes[cursor++];
      if (!n) return;
      need(n);
      onBlock?.(bytes.subarray(cursor, cursor + n));
      cursor += n;
    }
  }
  if (bytes[10] & 0x80) { const n = 3 * 2 ** ((bytes[10] & 7) + 1); need(n); cursor += n; }
  for (;;) {
    need(1);
    const marker = bytes[cursor++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      need(1);
      const label = bytes[cursor++];
      let recognized = false, first = true;
      blocks(block => {
        if (label !== 0xff) return;
        if (first) {
          first = false;
          const name = String.fromCharCode(...block);
          recognized = name === 'NETSCAPE2.0' || name === 'ANIMEXTS1.0';
        } else if (recognized && !foundRepeat && block.length === 3 && block[0] === 1) {
          repeat = block[1] | (block[2] << 8);
          foundRepeat = true;
        }
      });
      continue;
    }
    if (marker !== 0x2c) invalid();
    need(9);
    const packed = bytes[cursor + 8];
    cursor += 9;
    if (packed & 0x80) { const n = 3 * 2 ** ((packed & 7) + 1); need(n); cursor += n; }
    need(1); cursor++;
    blocks();
    if (++frameCount > EDIT_LIMITS.maxFrames) fail('EDIT_FRAMES', 'This GIF exceeds the editor frame limit.');
    if (width * height * frameCount > GIF_LIMITS.maxOutputPixels) fail('MEMORY_LIMIT', 'This GIF needs too much browser memory to decode.');
  }
  if (!frameCount) fail('NO_FRAMES', 'This GIF does not contain image frames.');
  return { width, height, frameCount, repeat };
}

export async function inspectEditableGif(file, { signal } = {}) {
  checkAbort(signal);
  if (!file || !file.size || typeof file.arrayBuffer !== 'function') fail('EMPTY_FILE', 'Choose a non-empty GIF.');
  if (file.size > GIF_LIMITS.maxBytes) fail('FILE_SIZE', 'This GIF exceeds 30 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkAbort(signal);
  if (bytes.length > GIF_LIMITS.maxBytes) fail('FILE_SIZE', 'This GIF exceeds 30 MiB.');
  return inspectEditorBytes(bytes);
}

/** Validate integer crop/resize dimensions and output budgets before canvas allocation. */
export function validateEdit(gif, { mode, width, height, x = 0, y = 0 } = {}) {
  const ints = [width, height, x, y].every(Number.isSafeInteger);
  if (!gif || !Number.isSafeInteger(gif.width) || !Number.isSafeInteger(gif.height) || gif.width <= 0 || gif.height <= 0 ||
      !Array.isArray(gif.frames) || !gif.frames.length || !['resize', 'crop'].includes(mode) || !ints || width <= 0 || height <= 0 || x < 0 || y < 0) {
    fail('EDIT_OPTIONS', 'Choose valid positive whole-number dimensions.');
  }
  if (gif.frames.length > EDIT_LIMITS.maxFrames) fail('EDIT_FRAMES', 'This GIF exceeds the editor frame limit.');
  if (mode === 'crop' && (x + width > gif.width || y + height > gif.height)) fail('EDIT_OPTIONS', 'The crop rectangle must fit inside the GIF.');
  if (width > EDIT_LIMITS.maxDimension || height > EDIT_LIMITS.maxDimension || width * height > EDIT_LIMITS.maxFramePixels) {
    fail('EDIT_DIMENSIONS', 'The output dimensions are too large.');
  }
  if (width * height * gif.frames.length > EDIT_LIMITS.maxOutputPixels) fail('EDIT_MEMORY', 'The result needs too much browser memory.');
  return { mode, width, height, x, y };
}

function createEncoderWorker(signal) {
  if (typeof Worker !== 'function') fail('EDIT_ENCODER', 'Your browser cannot start the GIF encoder.');
  let worker;
  try { worker = new Worker(new URL('./gif-editor-worker.js', import.meta.url), { type: 'module' }); }
  catch { fail('EDIT_ENCODER', 'Your browser cannot start the GIF encoder.'); }
  let pending, closed = false;
  const close = (reason = abortError()) => {
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
    if (data.error) task.reject(new GifError('EDIT_ENCODER', 'The GIF could not be encoded.'));
    else task.resolve(data);
  });
  worker.addEventListener('error', () => close(new GifError('EDIT_ENCODER', 'The GIF encoder could not run.')));
  worker.addEventListener('messageerror', () => close(new GifError('EDIT_ENCODER', 'The GIF encoder could not run.')));
  return {
    request(data, transfer = []) {
      checkAbort(signal);
      if (closed) return Promise.reject(new GifError('EDIT_ENCODER', 'The GIF encoder is unavailable.'));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        try { worker.postMessage(data, transfer); } catch { pending = undefined; reject(new GifError('EDIT_ENCODER', 'The GIF encoder could not run.')); }
      });
    }, close,
  };
}

async function loadPng(blob, signal) {
  checkAbort(signal);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  let onAbort;
  try {
    image.src = url;
    const decoding = image.decode();
    const cancelled = signal && new Promise((_, reject) => {
      onAbort = () => reject(abortError());
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    await (cancelled ? Promise.race([decoding, cancelled]) : decoding);
    checkAbort(signal);
    return image;
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
    if (signal?.aborted) image.src = '';
    URL.revokeObjectURL(url);
  }
}

/** Edit pre-decoded complete frames locally and return an animated GIF. */
export async function editGif(file, gif, options = {}) {
  const { signal, onProgress } = options;
  checkAbort(signal);
  const { mode, width, height, x, y } = validateEdit(gif, options);
  const metadata = await inspectEditableGif(file, { signal });
  if (metadata.width !== gif.width || metadata.height !== gif.height || metadata.frameCount !== gif.frames.length) {
    fail('EDIT_OPTIONS', 'The source file does not match the loaded frames.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { canvas.width = canvas.height = 0; fail('CANVAS', 'Your browser could not create an image canvas.'); }
  let encoder;
  try {
    encoder = createEncoderWorker(signal);
    await encoder.request({ type: 'init', width, height, repeat: metadata.repeat });
    for (let i = 0; i < gif.frames.length; i++) {
      checkAbort(signal);
      const frame = gif.frames[i];
      const image = await loadPng(frame.blob, signal);
      context.clearRect(0, 0, width, height);
      if (mode === 'crop') context.drawImage(image, x, y, width, height, 0, 0, width, height);
      else context.drawImage(image, 0, 0, gif.width, gif.height, 0, 0, width, height);
      const rgba = context.getImageData(0, 0, width, height).data;
      await encoder.request({ type: 'frame', rgba: rgba.buffer, delay: frame.delay }, [rgba.buffer]);
      onProgress?.({ completed: i + 1, total: gif.frames.length, percent: Math.round((i + 1) / gif.frames.length * 100) });
    }
    checkAbort(signal);
    const { bytes } = await encoder.request({ type: 'finish' });
    return { blob: new Blob([bytes], { type: 'image/gif' }), width, height, frameCount: gif.frames.length, duration: gif.duration, repeat: metadata.repeat };
  } finally {
    encoder?.close();
    canvas.width = canvas.height = 0;
  }
}
