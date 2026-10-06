// GIF image data uses at most 12-bit LZW codes. Keep both the dictionary and
// expansion stack fixed-size so malformed codes cannot grow JS arrays.
const DICTIONARY_SIZE = 4096;
const MAX_FRAME_PIXELS = 16_000_000;
const MAX_DIMENSION = 8192;

function invalidData(message) {
  const error = new Error(message);
  error.name = 'GifDecodeError';
  error.code = 'INVALID_GIF';
  return error;
}

function colorBytes(table) {
  if (!Array.isArray(table) || table.length < 2 || table.length > 256) {
    throw invalidData('The image has no valid color table.');
  }
  const colors = new Uint8Array(table.length * 3);
  for (let i = 0; i < table.length; i += 1) {
    const color = table[i];
    if (!color || color.length !== 3) throw invalidData('The color table is incomplete.');
    for (let channel = 0; channel < 3; channel += 1) {
      const value = color[channel];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw invalidData('The color table contains an invalid color.');
      }
      colors[i * 3 + channel] = value;
    }
  }
  return colors;
}

function interlaceRows(height) {
  const rows = new Uint16Array(height);
  let position = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let row = start; row < height; row += step) rows[position++] = row;
  }
  return rows;
}

/** Decode one parsed image frame, with a bounded LZW dictionary. */
export function decodeGifFrame(source, gct) {
  const image = source?.image;
  const descriptor = image?.descriptor;
  if (!descriptor) throw invalidData('The image descriptor is missing.');
  const { left, top, width, height } = descriptor;
  if (![left, top, width, height].every(Number.isInteger)
    || left < 0 || top < 0 || left > 65535 || top > 65535
    || width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION
    || width * height > MAX_FRAME_PIXELS) {
    throw invalidData('The image dimensions are invalid.');
  }
  const minCodeSize = image.data?.minCodeSize;
  const data = image.data?.blocks;
  if (!Number.isInteger(minCodeSize) || minCodeSize < 2 || minCodeSize > 8
    || !(data instanceof Uint8Array) || !data.length) {
    throw invalidData('The image compression data is invalid.');
  }
  const colors = colorBytes(descriptor.lct?.exists ? image.lct : gct);
  const colorCount = colors.length / 3;
  const transparentIndex = source.gce?.extras?.transparentColorGiven
    ? source.gce.transparentColorIndex : undefined;
  if (transparentIndex !== undefined
    && (!Number.isInteger(transparentIndex) || transparentIndex < 0 || transparentIndex > 255)) {
    throw invalidData('The transparency index is invalid.');
  }

  const pixelCount = width * height;
  const patch = new Uint8ClampedArray(pixelCount * 4);
  const rows = descriptor.lct?.interlaced ? interlaceRows(height) : null;
  const prefix = new Uint16Array(DICTIONARY_SIZE);
  const suffix = new Uint8Array(DICTIONARY_SIZE);
  const stack = new Uint8Array(DICTIONARY_SIZE);
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let available = clearCode + 2;
  let codeSize = minCodeSize + 1;
  let previous = -1;
  let first = 0;
  let bytePosition = 0;
  let bits = 0;
  let bitCount = 0;
  let completed = 0;

  const nextCode = () => {
    while (bitCount < codeSize) {
      if (bytePosition === data.length) throw invalidData('The image has no end-of-information code.');
      bits |= data[bytePosition++] << bitCount;
      bitCount += 8;
    }
    const code = bits & ((1 << codeSize) - 1);
    bits >>>= codeSize;
    bitCount -= codeSize;
    return code;
  };
  const emit = (index) => {
    if (completed === pixelCount) throw invalidData('The image contains more pixels than declared.');
    if (index >= colorCount) throw invalidData('The image references a missing palette color.');
    const pixel = rows
      ? rows[Math.floor(completed / width)] * width + completed % width
      : completed;
    const offset = pixel * 4;
    const color = index * 3;
    patch[offset] = colors[color];
    patch[offset + 1] = colors[color + 1];
    patch[offset + 2] = colors[color + 2];
    patch[offset + 3] = index === transparentIndex ? 0 : 255;
    completed += 1;
  };

  for (;;) {
    const code = nextCode();
    if (code === clearCode) {
      available = clearCode + 2;
      codeSize = minCodeSize + 1;
      previous = -1;
      continue;
    }
    if (code === endCode) {
      if (completed !== pixelCount) throw invalidData('The image contains fewer pixels than declared.');
      return {
        dims: { left, top, width, height },
        patch,
        disposalType: source.gce?.extras?.disposal,
        transparentIndex,
      };
    }
    if (previous === -1) {
      // The first data code after a clear must be a literal. Accepting the
      // first unassigned dictionary code can create a self-referencing prefix.
      if (code >= clearCode) throw invalidData('The first image code is not a literal.');
      emit(code);
      previous = first = code;
      continue;
    }

    let current = code;
    let stackSize = 0;
    if (code === available) {
      // KwKwK: the new string is the preceding string plus its first pixel.
      stack[stackSize++] = first;
      current = previous;
    } else if (code > available) {
      throw invalidData('The image references an unassigned dictionary code.');
    }
    while (current >= clearCode) {
      if (current < clearCode + 2 || current >= available || stackSize === stack.length) {
        throw invalidData('The image dictionary chain is invalid.');
      }
      stack[stackSize++] = suffix[current];
      current = prefix[current];
    }
    first = current;
    if (stackSize === stack.length) throw invalidData('The image dictionary string is too long.');
    stack[stackSize++] = first;
    while (stackSize) emit(stack[--stackSize]);

    if (available < DICTIONARY_SIZE) {
      prefix[available] = previous;
      suffix[available] = first;
      available += 1;
      if (available === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    // At 4096 entries, GIF permits reusing the full dictionary until a later
    // clear code. Keep decoding 12-bit codes without adding or resetting it.
    previous = code;
  }
}
