import * as gifenc from 'gifenc';
// Vite resolves gifenc's ESM build; Node resolves its CommonJS build.
const { GIFEncoder, quantize, applyPalette } = gifenc.GIFEncoder ? gifenc : gifenc.default;

// Each image is a complete composited frame. Palette index zero is always
// transparent, including for opaque frames: disposal 2 then clears the prior
// full canvas before the next frame, so transparent pixels never show ghosts.
export function createMergeEncoder(width, height, repeat = 0) {
  const encoder = GIFEncoder();
  return {
    write(rgba, delay) {
      if (rgba.length !== width * height * 4) throw new Error('Invalid frame size');
      const colors = quantize(rgba, 255);
      if (!colors.length) colors.push([0, 0, 0]);
      const mapped = applyPalette(rgba, colors);
      const indices = new Uint8Array(mapped.length);
      for (let i = 0; i < mapped.length; i++) indices[i] = rgba[i * 4 + 3] < 128 ? 0 : mapped[i] + 1;
      encoder.writeFrame(indices, width, height, {
        palette: [[0, 0, 0], ...colors], transparent: true, transparentIndex: 0,
        dispose: 2, delay, repeat,
      });
    },
    finish() { encoder.finish(); return encoder.bytes(); },
  };
}
