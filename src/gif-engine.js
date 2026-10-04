import { parseGIF, decompressFrames } from 'gifuct-js';

export const GIF_LIMITS = Object.freeze({
  maxBytes: 30 * 1024 * 1024,
  maxFrames: 1000,
  maxDimension: 8192,
  maxFramePixels: 16_000_000,
  maxDecodedPixels: 128_000_000,
  maxOutputPixels: 80_000_000,
});

export class GifError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GifError';
    this.code = code;
  }
}

const invalidGif = () => new GifError('INVALID_GIF', 'This GIF is incomplete or damaged. Please try another GIF file.');

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Extraction was cancelled.', 'AbortError');
}

// Check the container and budgets before a decoder allocates arrays from dimensions
// supplied by the file. Also retain GCE metadata across comment/application blocks.
function inspectGif(bytes) {
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    throw new GifError('NOT_GIF', 'Please choose a valid GIF file. Other image formats are not supported.');
  }
  if (bytes.length < 14) throw invalidGif();
  const word = (at) => bytes[at] | (bytes[at + 1] << 8);
  const width = word(6);
  const height = word(8);
  const pixels = width * height;
  if (!width || !height) throw invalidGif();
  if (width > GIF_LIMITS.maxDimension || height > GIF_LIMITS.maxDimension || pixels > GIF_LIMITS.maxFramePixels) {
    throw new GifError('DIMENSIONS', 'This GIF’s dimensions are too large. Please use a GIF with at most 16 million pixels and sides up to 8,192 pixels.');
  }

  const hasGlobalPalette = Boolean(bytes[10] & 0x80);
  let cursor = 13 + (hasGlobalPalette ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let decodedPixels = 0;
  let control;
  const frames = [];
  const requireBytes = (count) => {
    if (cursor + count > bytes.length) throw invalidGif();
  };
  const skipBlocks = () => {
    let dataLength = 0;
    for (;;) {
      requireBytes(1);
      const length = bytes[cursor++];
      if (!length) return dataLength;
      requireBytes(length);
      cursor += length;
      dataLength += length;
    }
  };

  for (;;) {
    requireBytes(1);
    const marker = bytes[cursor++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      requireBytes(1);
      const label = bytes[cursor++];
      if (label === 0xf9) {
        requireBytes(6);
        if (bytes[cursor] !== 4 || bytes[cursor + 5] !== 0) throw invalidGif();
        const packed = bytes[cursor + 1];
        control = {
          delay: word(cursor + 2),
          transparentColorIndex: bytes[cursor + 4],
          extras: { disposal: (packed >> 2) & 7, transparentColorGiven: Boolean(packed & 1) },
        };
        cursor += 6;
      } else if (label === 0xfe || label === 0xff) {
        skipBlocks();
      } else if (label === 0x01) {
        throw new GifError('UNSUPPORTED_TEXT', 'This GIF contains a plain-text rendering block that is not supported. Please use an image-only GIF.');
      } else {
        throw invalidGif();
      }
      continue;
    }
    if (marker !== 0x2c) throw invalidGif();
    requireBytes(9);
    const left = word(cursor);
    const top = word(cursor + 2);
    const frameWidth = word(cursor + 4);
    const frameHeight = word(cursor + 6);
    const packed = bytes[cursor + 8];
    cursor += 9;
    if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) throw invalidGif();
    const hasLocalPalette = Boolean(packed & 0x80);
    if (!hasGlobalPalette && !hasLocalPalette) throw invalidGif();
    if (hasLocalPalette) {
      const paletteLength = 3 * 2 ** ((packed & 7) + 1);
      requireBytes(paletteLength);
      cursor += paletteLength;
    }
    requireBytes(1);
    const codeSize = bytes[cursor++];
    if (codeSize < 2 || codeSize > 8 || !skipBlocks()) throw invalidGif();
    frames.push({ gce: control });
    control = undefined;
    decodedPixels += frameWidth * frameHeight;
    if (frames.length > GIF_LIMITS.maxFrames) {
      throw new GifError('FRAME_LIMIT', 'This GIF has more than 1,000 frames. Please choose a shorter GIF.');
    }
    if (decodedPixels > GIF_LIMITS.maxDecodedPixels || pixels * frames.length > GIF_LIMITS.maxOutputPixels) {
      throw new GifError('MEMORY_LIMIT', 'This GIF needs too much browser memory to extract safely. Please choose a shorter GIF or reduce its dimensions.');
    }
  }
  if (!frames.length) throw new GifError('NO_FRAMES', 'This GIF does not contain any image frames. Please choose another GIF.');
  return { width, height, frames };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new GifError('CANVAS', 'Your browser could not create an image canvas. Please try a current browser.');
  return { canvas, context };
}

function encodePng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new GifError('PNG_EXPORT', 'Your browser could not export this frame. Please try a smaller GIF.'));
    }, 'image/png');
  });
}

/**
 * Decode complete, composited PNG frames locally. The caller owns object URLs.
 * Delays and duration are the original GIF milliseconds (including zero).
 * onProgress receives { completed, total, percent }. Indices are one-based.
 */
export async function extractGif(file, { onProgress, signal } = {}) {
  checkAbort(signal);
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) {
    throw new GifError('EMPTY_FILE', 'Please choose a non-empty GIF file.');
  }
  if (file.size > GIF_LIMITS.maxBytes) throw new GifError('FILE_SIZE', 'This file is larger than 30 MB. Please choose a smaller GIF.');
  const buffer = await file.arrayBuffer();
  checkAbort(signal);
  if (buffer.byteLength > GIF_LIMITS.maxBytes) throw new GifError('FILE_SIZE', 'This file is larger than 30 MB. Please choose a smaller GIF.');
  const metadata = inspectGif(new Uint8Array(buffer));
  let gif;
  try {
    gif = parseGIF(buffer);
  } catch {
    throw invalidGif();
  }
  const sourceFrames = gif.frames.filter((frame) => frame.image);
  if (sourceFrames.length !== metadata.frames.length) throw invalidGif();
  const { width, height } = metadata;
  const { canvas, context } = makeCanvas(width, height);
  const { canvas: patchCanvas, context: patchContext } = makeCanvas(1, 1);
  const output = [];
  let duration = 0;
  // Transparent animations start clear. Opaque animations use their logical
  // background, which also matters when an opaque frame uses disposal method 2.
  const transparentBackground = metadata.frames[0].gce?.extras.transparentColorGiven;
  const background = !transparentBackground && gif.gct?.[gif.lsd.backgroundColorIndex];
  if (background) {
    context.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
    context.fillRect(0, 0, width, height);
  }
  onProgress?.({ completed: 0, total: sourceFrames.length, percent: 0 });

  try {
    for (let i = 0; i < sourceFrames.length; i += 1) {
      checkAbort(signal);
      // Decode one patch at a time: decompressFrames(all) retains every expanded
      // pixel array simultaneously, even when the source GIF is very small.
      let frame;
      const source = { ...sourceFrames[i], gce: metadata.frames[i].gce };
      try {
        [frame] = decompressFrames({ ...gif, frames: [source] }, true);
      } catch {
        throw invalidGif();
      }
      const { left, top, width: patchWidth, height: patchHeight } = frame.dims;
      const restore = frame.disposalType === 3 ? context.getImageData(left, top, patchWidth, patchHeight) : null;
      patchCanvas.width = patchWidth;
      patchCanvas.height = patchHeight;
      const patch = patchContext.createImageData(patchWidth, patchHeight);
      patch.data.set(frame.patch);
      patchContext.putImageData(patch, 0, 0);
      // drawImage composites transparent patch pixels over previous contents.
      // putImageData on the output canvas would incorrectly erase those pixels.
      context.drawImage(patchCanvas, left, top);
      const blob = await encodePng(canvas);
      checkAbort(signal);
      const delay = (source.gce?.delay ?? 0) * 10;
      output.push({ blob, delay, index: i + 1 });
      duration += delay;

      if (frame.disposalType === 2) {
        context.clearRect(left, top, patchWidth, patchHeight);
        if (background && frame.transparentIndex === undefined) {
          context.fillRect(left, top, patchWidth, patchHeight);
        }
      } else if (restore) {
        context.putImageData(restore, left, top);
      }
      onProgress?.({ completed: i + 1, total: sourceFrames.length, percent: Math.round(((i + 1) / sourceFrames.length) * 100) });
      // Let progress paint, and let a new upload or cancel interrupt extraction.
      if (i + 1 < sourceFrames.length) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { width, height, frames: output, duration };
  } finally {
    // Release the canvas backing stores, including when the job was cancelled.
    canvas.width = canvas.height = 0;
    patchCanvas.width = patchCanvas.height = 0;
  }
}
