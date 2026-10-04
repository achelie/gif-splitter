import { zip } from 'fflate';
import { extractGif } from './gif-engine.js';

const $ = (id) => document.getElementById(id);
let gif = null;
let sourceName = '';
let urls = [];
let selected = new Set();
let current = 0;
let visibleCount = 0;
let controller = null;
let job = 0;
let playback = null;
let exporting = false;
const PAGE_SIZE = 60;

function status(message = '', error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

function stopPlayback() {
  clearTimeout(playback);
  playback = null;
  $('play-button').textContent = 'Play preview';
}

function clearFrames() {
  stopPlayback();
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
  gif = null;
  selected.clear();
  current = 0;
  visibleCount = 0;
  $('frame-grid').replaceChildren();
  $('frame-preview').removeAttribute('src');
  $('results').hidden = true;
  $('upload-area').hidden = false;
  $('capabilities').hidden = false;
  document.body.classList.remove('has-results');
}

function reset() {
  job++;
  controller?.abort();
  controller = null;
  clearFrames();
  $('progress-panel').hidden = true;
  $('file-input').value = '';
  status();
  $('choose-file').focus();
}

function showFrame(index) {
  if (!gif) return;
  current = (index + gif.frames.length) % gif.frames.length;
  const frame = gif.frames[current];
  $('frame-preview').src = urls[current];
  $('frame-preview').alt = `Frame ${current + 1} of ${sourceName}`;
  $('frame-slider').value = current + 1;
  $('current-frame-label').textContent = `Frame ${current + 1} of ${gif.frames.length}`;
  $('current-frame-delay').textContent = `${frame.delay} ms`;
  document.querySelectorAll('.frame-card.is-current').forEach((card) => card.classList.remove('is-current'));
  const card = document.querySelector(`[data-frame="${current}"]`);
  card?.classList.add('is-current');
}

function updateSelection() {
  $('selection-count').textContent = `${selected.size} selected`;
  $('download-selected').disabled = selected.size === 0 || exporting;
  $('select-all').textContent = selected.size === gif?.frames.length ? 'Deselect all' : 'Select all';
}

function appendCards() {
  if (!gif) return;
  const end = Math.min(visibleCount + PAGE_SIZE, gif.frames.length);
  const fragment = document.createDocumentFragment();
  for (let i = visibleCount; i < end; i++) {
    const card = document.createElement('article');
    card.className = 'frame-card';
    card.dataset.frame = i;
    card.classList.toggle('is-selected', selected.has(i));
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'frame-thumbnail checkerboard';
    preview.setAttribute('aria-label', `Preview frame ${i + 1}`);
    const img = document.createElement('img');
    img.src = urls[i];
    img.alt = `GIF frame ${i + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    preview.append(img);
    preview.addEventListener('click', () => { stopPlayback(); showFrame(i); });
    const caption = document.createElement('div');
    caption.className = 'frame-caption';
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.has(i);
    check.setAttribute('aria-label', `Select frame ${i + 1}`);
    check.addEventListener('change', () => {
      check.checked ? selected.add(i) : selected.delete(i);
      card.classList.toggle('is-selected', check.checked);
      updateSelection();
    });
    label.append(check, ` ${String(i + 1).padStart(3, '0')}`);
    const delay = document.createElement('span');
    delay.textContent = `${gif.frames[i].delay} ms`;
    caption.append(label, delay);
    card.append(preview, caption);
    fragment.append(card);
  }
  $('frame-grid').append(fragment);
  visibleCount = end;
  $('show-more').hidden = end >= gif.frames.length;
  $('show-more').textContent = `Show more frames (${end} of ${gif.frames.length})`;
  showFrame(current);
}

async function openFile(file) {
  if (!file) return;
  const myJob = ++job;
  controller?.abort();
  controller = new AbortController();
  clearFrames();
  status();
  $('progress-panel').hidden = false;
  $('upload-area').hidden = true;
  $('progress').value = 0;
  $('progress-label').textContent = 'Reading your GIF…';
  try {
    const extracted = await extractGif(file, {
      signal: controller.signal,
      onProgress: ({ completed, total, percent }) => {
        if (myJob !== job) return;
        $('progress').value = percent;
        $('progress-label').textContent = `Extracting frame ${completed} of ${total}…`;
      },
    });
    if (myJob !== job) return;
    gif = extracted;
    sourceName = file.name || 'animation.gif';
    urls = gif.frames.map((frame) => URL.createObjectURL(frame.blob));
    $('file-name').textContent = sourceName;
    $('file-summary').textContent = `${formatBytes(file.size)} · Animated GIF`;
    $('stat-frames').textContent = gif.frames.length;
    $('stat-size').textContent = `${gif.width} × ${gif.height}`;
    $('stat-duration').textContent = `${Number((gif.duration / 1000).toFixed(3))} s`;
    $('frame-slider').max = gif.frames.length;
    $('play-button').disabled = gif.frames.length < 2;
    $('results').hidden = false;
    $('capabilities').hidden = true;
    document.body.classList.add('has-results');
    appendCards();
    updateSelection();
    status(`${gif.frames.length} ${gif.frames.length === 1 ? 'frame is' : 'frames are'} ready. Your original GIF has not been changed.`);
    $('results-title').setAttribute('tabindex', '-1');
    $('results-title').focus({ preventScroll: true });
  } catch (error) {
    if (myJob !== job) return;
    $('upload-area').hidden = false;
    if (error.name === 'AbortError') status('Extraction cancelled. Choose a GIF to start again.');
    else status(error.message || 'This GIF could not be read. Please try a different file.', true);
  } finally {
    if (myJob === job) {
      $('progress-panel').hidden = true;
      $('file-input').value = '';
    }
  }
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function baseName(name) {
  return (name.replace(/\.gif$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'gif');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadZip(indices) {
  if (!gif || exporting || indices.length === 0) return;
  stopPlayback();
  const frames = gif.frames;
  const prefix = baseName(sourceName);
  const downloadJob = job;
  const totalBytes = indices.reduce((sum, index) => sum + frames[index].blob.size, 0);
  if (totalBytes > 128 * 1024 * 1024) {
    status('These PNGs exceed the 128 MB ZIP limit. Select fewer frames and download them in smaller batches.', true);
    return;
  }
  exporting = true;
  $('download-all').disabled = true;
  $('download-selected').disabled = true;
  $('start-over').disabled = true;
  status(`Preparing ${indices.length} frames for download…`);
  try {
    const files = {};
    for (const index of indices) {
      files[`${prefix}-frame-${String(index + 1).padStart(4, '0')}.png`] = new Uint8Array(await frames[index].blob.arrayBuffer());
    }
    const archive = await new Promise((resolve, reject) => zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(data)));
    downloadBlob(new Blob([archive], { type: 'application/zip' }), `${prefix}-frames.zip`);
    if (downloadJob === job) status(`Your ZIP with ${indices.length} PNG ${indices.length === 1 ? 'frame' : 'frames'} is ready. Check your browser's downloads.`);
  } catch {
    if (downloadJob === job) status('The ZIP could not be created. Try downloading fewer frames at a time.', true);
  } finally {
    exporting = false;
    $('download-all').disabled = false;
    $('start-over').disabled = false;
    updateSelection();
  }
}

$('choose-file').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (event) => openFile(event.target.files[0]));
$('start-over').addEventListener('click', () => { reset(); $('file-input').click(); });
$('cancel-button').addEventListener('click', reset);
$('sample-button').addEventListener('click', async () => {
  const sampleJob = ++job;
  $('sample-button').disabled = true;
  status('Opening the sample GIF…');
  try {
    const response = await fetch('/sample.gif');
    if (!response.ok) throw new Error('Sample unavailable');
    const blob = await response.blob();
    if (sampleJob === job) await openFile(new File([blob], 'little-orbit.gif', { type: 'image/gif' }));
  } catch {
    if (sampleJob === job) status('The sample could not be loaded. You can still choose your own GIF.', true);
  } finally {
    $('sample-button').disabled = false;
  }
});

let dragDepth = 0;
document.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
document.addEventListener('drop', (event) => { if (event.dataTransfer.files.length) event.preventDefault(); });
$('dropzone').addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth++; $('dropzone').classList.add('is-dragging'); });
$('dropzone').addEventListener('dragleave', () => { if (--dragDepth <= 0) $('dropzone').classList.remove('is-dragging'); });
$('dropzone').addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
$('dropzone').addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  $('dropzone').classList.remove('is-dragging');
  if (event.dataTransfer.files.length > 1) { status('Please choose one GIF at a time.', true); return; }
  openFile(event.dataTransfer.files[0]);
});
$('previous-frame').addEventListener('click', () => { stopPlayback(); showFrame(current - 1); });
$('next-frame').addEventListener('click', () => { stopPlayback(); showFrame(current + 1); });
$('frame-slider').addEventListener('input', (event) => { stopPlayback(); showFrame(Number(event.target.value) - 1); });
$('play-button').addEventListener('click', () => {
  if (playback !== null) { stopPlayback(); return; }
  if (!gif) return;
  $('play-button').textContent = 'Pause preview';
  function next() {
    // Extremely short GIF delays are slowed for a usable preview; metadata stays exact.
    const delay = gif.frames[current].delay < 20 ? 100 : gif.frames[current].delay;
    playback = setTimeout(() => { showFrame(current + 1); next(); }, delay);
  }
  next();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
$('download-frame').addEventListener('click', () => {
  if (!gif) return;
  downloadBlob(gif.frames[current].blob, `${baseName(sourceName)}-frame-${String(current + 1).padStart(4, '0')}.png`);
});
$('download-all').addEventListener('click', () => downloadZip(gif.frames.map((_, index) => index)));
$('download-selected').addEventListener('click', () => downloadZip([...selected].sort((a, b) => a - b)));
$('select-all').addEventListener('click', () => {
  if (!gif) return;
  selected = selected.size === gif.frames.length ? new Set() : new Set(gif.frames.map((_, index) => index));
  document.querySelectorAll('.frame-card').forEach((card) => {
    const checked = selected.has(Number(card.dataset.frame));
    card.querySelector('input').checked = checked;
    card.classList.toggle('is-selected', checked);
  });
  updateSelection();
});
$('show-more').addEventListener('click', appendCards);
