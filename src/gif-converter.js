import { zip } from 'fflate';
import { GifError } from './gif-engine.js';

// This bounds the encoded data retained before creating an archive. The GIF
// decoder separately enforces input, pixel and frame budgets.
export const CONVERT_LIMITS = Object.freeze({ maxZipBytes: 128 * 1024 * 1024 });

const abortError = () => new DOMException('Conversion was cancelled.', 'AbortError');
const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
const error = (code, message) => new GifError(code, message);

function abortable(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (cause, result) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (cause) reject(cause);
      else resolve(result);
    };
    const onAbort = () => finish(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    Promise.resolve(promise).then(value => finish(null, value), finish);
  });
}

function optionsFor({ format, quality = 0.92, background = '#ffffff', signal } = {}) {
  if (!['jpg', 'webp'].includes(format) || !Number.isFinite(quality) || quality < 0 || quality > 1 || !/^#[0-9a-f]{6}$/i.test(background)) {
    throw error('CONVERT_OPTIONS', 'Choose a valid output format, quality, and background color.');
  }
  return { format, quality, background, signal, mime: format === 'jpg' ? 'image/jpeg' : 'image/webp' };
}

async function supportedImage(blob, mime, signal) {
  if (!blob || blob.type.toLowerCase() !== mime || blob.size < 12) return false;
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  checkAbort(signal);
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

/** Convert one complete PNG frame, preserving dimensions. JPG uses an opaque background. */
export async function convertFrame(pngBlob, settings) {
  const { format, quality, background, signal, mime } = optionsFor(settings);
  checkAbort(signal);
  if (!(pngBlob instanceof Blob) || !pngBlob.size) throw error('CONVERT_FAILED', 'The source frame is unavailable.');
  const url = URL.createObjectURL(pngBlob);
  let canvas;
  let image;
  try {
    canvas = document.createElement('canvas');
    image = new Image();
    image.src = url;
    await abortable(image.decode(), signal);
    checkAbort(signal);
    if (!image.naturalWidth || !image.naturalHeight) throw error('CONVERT_FAILED', 'The source frame could not be read.');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw error('CONVERT_FAILED', 'Your browser could not create an image canvas.');
    if (format === 'jpg') {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    const converted = await abortable(new Promise((resolve, reject) => {
      try { canvas.toBlob(resolve, mime, quality); }
      catch (cause) { reject(cause); }
    }), signal);
    checkAbort(signal);
    if (!converted) throw error('CONVERT_FAILED', 'The frame could not be encoded. Try a smaller GIF or a current browser.');
    if (!await supportedImage(converted, mime, signal)) throw error('FORMAT_UNSUPPORTED', `Your browser cannot export ${format.toUpperCase()} images.`);
    return converted;
  } catch (cause) {
    if (cause?.name === 'AbortError' || cause instanceof GifError) throw cause;
    throw error('CONVERT_FAILED', 'The frame could not be converted. Try a smaller GIF or a current browser.');
  } finally {
    URL.revokeObjectURL(url);
    if (image && signal?.aborted) image.src = '';
    if (canvas) canvas.width = canvas.height = 0;
  }
}

function safeName(name) {
  return String(name || 'gif').replace(/\.gif$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'gif';
}

/** Convert selected frames in source order and return a numbered ZIP blob. */
export async function createConvertedZip(frames, indices, settings) {
  const { format, quality, background, signal } = optionsFor(settings);
  checkAbort(signal);
  if (!Array.isArray(frames) || !Array.isArray(indices) || !indices.length ||
      indices.some(index => !Number.isInteger(index) || index < 0 || index >= frames.length)) {
    throw error('CONVERT_OPTIONS', 'Choose one or more valid frames to export.');
  }
  const selected = [...new Set(indices)].sort((a, b) => a - b);
  const files = {};
  const prefix = safeName(settings?.sourceName);
  let totalBytes = 0;
  for (const [position, index] of selected.entries()) {
    checkAbort(signal);
    const frame = await convertFrame(frames[index]?.blob, { format, quality, background, signal });
    totalBytes += frame.size;
    if (totalBytes > CONVERT_LIMITS.maxZipBytes) throw error('ZIP_LIMIT', 'The selected images exceed the 128 MiB ZIP limit. Export fewer frames at a time.');
    const bytes = new Uint8Array(await frame.arrayBuffer());
    checkAbort(signal);
    files[`${prefix}-frame-${String(index + 1).padStart(4, '0')}.${format}`] = bytes;
    settings?.onProgress?.({ completed: position + 1, total: selected.length });
    // Allow the cancel button and progress updates to run between frames.
    if (position + 1 < selected.length) await new Promise(resolve => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  const archive = await new Promise((resolve, reject) => {
    let finished = false;
    let terminate = () => {};
    const finish = (cause, bytes) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener('abort', onAbort);
      if (cause) reject(cause);
      else resolve(bytes);
    };
    const onAbort = () => { terminate(); finish(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      terminate = zip(files, { level: 0 }, (cause, bytes) => finish(cause ? error('ZIP_CREATE', 'The ZIP could not be created. Export fewer frames at a time.') : null, bytes));
      if (signal?.aborted) onAbort();
    } catch { finish(error('ZIP_CREATE', 'The ZIP could not be created. Export fewer frames at a time.')); }
  });
  checkAbort(signal);
  return new Blob([archive], { type: 'application/zip' });
}
