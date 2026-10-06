import test from 'node:test';
import assert from 'node:assert/strict';
import { createGifDecoder } from '../src/gif-decoder-client.js';

class WorkerStub extends EventTarget {
  terminated = 0;
  messages = [];
  postMessage(data) { this.messages.push(data); }
  terminate() { this.terminated++; }
  reply(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

test('abort rejects the pending frame and terminates its worker immediately', async () => {
  const worker = new WorkerStub();
  const controller = new AbortController();
  const decoder = createGifDecoder({ signal: controller.signal, workerFactory: () => worker });
  const frame = decoder.decode({ image: {} }, []);
  const rejected = assert.rejects(frame, { name: 'AbortError' });
  controller.abort();
  await rejected;
  assert.equal(worker.terminated, 1);
  worker.reply({ frame: { patch: new Uint8ClampedArray(4) } });
  await assert.rejects(decoder.decode({}, []), { name: 'AbortError' });
  decoder.close();
  assert.equal(worker.terminated, 1);
});

test('a decoder reuses one worker for sequential frames and closes after extraction', async () => {
  const worker = new WorkerStub();
  const decoder = createGifDecoder({ workerFactory: () => worker });
  for (let index = 0; index < 2; index++) {
    const output = { patch: new Uint8ClampedArray([index, 0, 0, 255]) };
    const result = decoder.decode({ index }, []);
    worker.reply({ frame: output });
    assert.equal(await result, output);
  }
  assert.equal(worker.messages.length, 2);
  decoder.close();
  assert.equal(worker.terminated, 1);
});

test('invalid input and worker transport errors reject rather than leave extraction pending', async () => {
  const worker = new WorkerStub();
  const decoder = createGifDecoder({ workerFactory: () => worker });
  const invalid = decoder.decode({}, []);
  worker.reply({ error: { code: 'INVALID_GIF', message: 'Damaged GIF' } });
  await assert.rejects(invalid, { code: 'INVALID_GIF' });
  const interrupted = decoder.decode({}, []);
  worker.dispatchEvent(new Event('messageerror'));
  await assert.rejects(interrupted, { code: 'UNKNOWN' });
  assert.equal(worker.terminated, 1);
});

test('a pre-aborted extraction never creates a worker', async () => {
  const controller = new AbortController();
  controller.abort();
  const decoder = createGifDecoder({ signal: controller.signal, workerFactory: () => { throw new Error('Must not start'); } });
  await assert.rejects(decoder.decode({}, []), { name: 'AbortError' });
  decoder.close();
});

test('Worker construction failures reject with a recoverable error', async () => {
  const decoder = createGifDecoder({ workerFactory: () => { throw new DOMException('Blocked', 'SecurityError'); } });
  await assert.rejects(decoder.decode({}, []), { code: 'UNKNOWN' });
  decoder.close();
});

test('postMessage clone failures terminate the worker and reject the frame', async () => {
  const worker = new WorkerStub();
  worker.postMessage = () => { throw new DOMException('Cannot clone', 'DataCloneError'); };
  const decoder = createGifDecoder({ workerFactory: () => worker });
  await assert.rejects(decoder.decode({}, []), { code: 'UNKNOWN' });
  assert.equal(worker.terminated, 1);
});

test('a Worker runtime error terminates the worker and rejects its pending frame', async () => {
  const worker = new WorkerStub();
  const decoder = createGifDecoder({ workerFactory: () => worker });
  const result = decoder.decode({}, []);
  worker.dispatchEvent(new Event('error'));
  await assert.rejects(result, { code: 'UNKNOWN' });
  assert.equal(worker.terminated, 1);
});
