import { decodeGifFrame } from './gif-decoder.js';

const aborted = () => new DOMException('Extraction was cancelled.', 'AbortError');
const workerError = () => Object.assign(new Error('The GIF decoder could not run.'), { code: 'UNKNOWN' });
const createBrowserWorker = () => new Worker(new URL('./gif-decoder-worker.js', import.meta.url), { type: 'module' });

/** One decoder per extraction; abort terminates even an in-flight frame. */
export function createGifDecoder({ signal, workerFactory = typeof Worker === 'function' ? createBrowserWorker : undefined } = {}) {
  let worker;
  let pending;
  let closed = false;

  function close(reason = aborted()) {
    closed = true;
    signal?.removeEventListener('abort', onAbort);
    worker?.terminate();
    worker = undefined;
    const request = pending;
    pending = undefined;
    request?.reject(reason);
  }
  const onAbort = () => close();
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    async decode(source, gct) {
      if (closed || signal?.aborted) throw aborted();
      // Non-Worker environments use the same bounded decoder. Yield first so
      // cancellation can run before decoding, including in the raster tests.
      if (!workerFactory) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (closed || signal?.aborted) throw aborted();
        return decodeGifFrame(source, gct);
      }
      if (pending) throw new Error('A GIF frame is already being decoded.');
      if (!worker) {
        try {
          worker = workerFactory();
          worker.addEventListener('message', ({ data }) => {
            const request = pending;
            if (!request) return;
            pending = undefined;
            if (data.error) request.reject(Object.assign(new Error(data.error.message), { code: data.error.code }));
            else request.resolve(data.frame);
          });
          worker.addEventListener('error', () => close(workerError()));
          worker.addEventListener('messageerror', () => close(workerError()));
        } catch {
          close(workerError());
          throw workerError();
        }
      }
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        try {
          worker.postMessage({ source, gct });
        } catch {
          close(workerError());
        }
      });
    },
    close,
  };
}
