export const EXAMPLE_FILES = Object.freeze({
  sample: '/sample.gif', timing: '/examples/timing.gif',
  'disposal-2': '/examples/disposal-2.gif', 'disposal-3': '/examples/disposal-3.gif',
  'memory-limit': '/examples/memory-limit.gif',
});

export const EXAMPLE_DEFINITIONS = {
  timing: { width: 3, height: 1, frames: [0, 1, 2, 8].map((delay, index) => ({ pixels: [index % 3 + 1, 1, 1], delay, transparent: true })) },
  'disposal-2': { width: 3, height: 1, frames: [
    { pixels: [1, 1, 1], transparent: true },
    { pixels: [2], width: 1, left: 1, disposal: 2, transparent: true },
    { pixels: [3], width: 1, left: 2, transparent: true },
  ] },
  'disposal-3': { width: 3, height: 1, frames: [
    { pixels: [1, 1, 1], transparent: true },
    { pixels: [2], width: 1, left: 1, disposal: 3, transparent: true },
    { pixels: [3], width: 1, left: 2, transparent: true },
  ] },
  'memory-limit': { width: 4000, height: 4000, frames: Array.from({ length: 6 }, () => ({ width: 1, height: 1, pixels: [1] })) },
};
