import './site.js';
import { localizeTool } from './tool-i18n.js';
import './converter.css';
import { extractGif } from './gif-engine.js';
import { convertFrame, createConvertedZip } from './gif-converter.js';

const app = document.getElementById('converter-app');
if (app) {
  const format = app.dataset.format;
  if (!['jpg', 'webp'].includes(format)) throw new Error('Invalid output format');
  const label = format === 'jpg' ? 'JPG' : 'WebP';
  app.innerHTML = `
    <div id="converter-upload" class="converter-upload">
      <div id="converter-dropzone" class="dropzone">
        <h2>Choose a GIF to convert</h2><p>Drop a GIF here or choose a file from your device.</p>
        <button id="converter-choose" class="button primary" type="button">Choose GIF</button>
        <p class="file-hint">One GIF · Up to 30 MiB · 1,000 frames<span>Free · No account needed</span></p>
      </div>
      <div class="below-drop"><span>Your GIF stays on your device.</span><button class="text-button" id="converter-sample" type="button">Try a sample GIF →</button></div>
    </div>
    <input id="converter-input" class="sr-only" type="file" accept="image/gif,.gif" tabindex="-1" aria-label="Choose a GIF file">
    <div id="converter-status" class="status-message" role="status" aria-live="polite"></div>
    <div id="converter-progress-panel" class="progress-panel" hidden><div class="progress-heading"><span id="converter-progress-label">Preparing…</span><button id="converter-cancel" class="text-button" type="button">Cancel</button></div><progress id="converter-progress" value="0" max="100" aria-label="Conversion progress"></progress><p>Keep this page open while your images are prepared.</p></div>
    <section id="converter-results" class="converter-results" aria-labelledby="converter-results-title" hidden>
      <div class="results-toolbar"><div><p class="section-label">YOUR GIF</p><h2 id="converter-results-title" tabindex="-1">Choose your frames</h2></div><button type="button" class="button" id="converter-reset">Choose another GIF</button></div>
      <div class="converter-workspace">
        <div class="converter-preview-panel"><div id="converter-stage" class="converter-stage checkerboard"><img id="converter-preview" alt="Current GIF frame"></div><div class="converter-frame-controls"><button id="converter-previous" type="button" class="icon-button" aria-label="Previous frame">←</button><label for="converter-frame-slider" id="converter-frame-label"></label><button id="converter-next" type="button" class="icon-button" aria-label="Next frame">→</button></div><input id="converter-frame-slider" type="range" min="1" value="1" max="1" aria-label="Choose a frame"></div>
        <div class="converter-options"><h3 id="converter-file-name"></h3><p class="muted" id="converter-file-info"></p><label class="converter-option" for="converter-quality">${label} quality <span id="converter-quality-value">90%</span></label><input id="converter-quality" type="range" min="10" max="100" value="90" step="1"><p class="converter-note">Higher quality can produce a larger file. GIF color detail already lost cannot be recovered.</p>${format === 'jpg' ? '<label class="converter-option" for="converter-background">Background color <input id="converter-background" type="color" value="#ffffff"></label><p class="converter-note">JPG cannot store transparency. Transparent areas use this color.</p>' : '<p class="converter-note">WebP frames retain transparent areas where supported. This tool creates static WebP images, not an animated WebP.</p>'}<button type="button" class="button primary converter-download" id="converter-download-frame">Prepare current ${label}</button></div>
      </div>
      <div class="grid-toolbar"><div><h3>Frames</h3><span id="converter-selection-count">0 selected</span></div><div class="grid-actions"><button class="text-button" id="converter-select-all" type="button">Select all</button><button class="button small" id="converter-download-selected" type="button" disabled>Prepare selected ZIP</button></div></div>
      <p class="grid-hint">Click a thumbnail to preview it. Check the boxes to choose images for a ZIP.</p>
      <div class="frame-grid" id="converter-frame-grid"></div><button class="button show-more" id="converter-more" type="button" hidden>Show more frames</button>
      <button class="button converter-download" id="converter-download-all" type="button">Prepare all frames as ZIP</button>
      <div id="converter-output" class="converter-output" hidden><p id="converter-output-message"></p><a id="converter-save" class="button primary">Download</a></div>
    </section>`;
  localizeTool(app, 'converter');

  const $ = id => document.getElementById(id);
  let gif, sourceName = '', urls = [], selected = new Set(), current = 0, visible = 0;
  let controller, resultUrl, job = 0, busy = false;
  const batchSize = 60;

  function status(message = '', error = false) {
    $('converter-status').textContent = message;
    $('converter-status').classList.toggle('error', error);
  }
  function clearOutput() {
    $('converter-output').hidden = true;
    $('converter-save').removeAttribute('href');
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = undefined;
  }
  function releaseFrames() {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    gif = undefined;
    selected.clear();
    current = visible = 0;
    $('converter-frame-grid').replaceChildren();
    $('converter-preview').removeAttribute('src');
    $('converter-results').hidden = true;
    $('converter-upload').hidden = false;
    document.body.classList.remove('has-converter-results');
    clearOutput();
  }
  function reset() {
    job++;
    controller?.abort();
    controller = undefined;
    busy = false;
    releaseFrames();
    $('converter-progress-panel').hidden = true;
    $('converter-input').value = '';
    $('converter-choose').disabled = false;
    $('converter-sample').disabled = false;
    status();
  }
  function updateControls() {
    $('converter-results').querySelectorAll('button, input').forEach(element => { element.disabled = busy; });
    $('converter-choose').disabled = busy;
    $('converter-sample').disabled = busy;
    $('converter-input').disabled = busy;
    $('converter-previous').disabled = busy || !gif || gif.frames.length < 2;
    $('converter-next').disabled = busy || !gif || gif.frames.length < 2;
    $('converter-download-selected').disabled = busy || selected.size === 0;
    $('converter-selection-count').textContent = `${selected.size} selected`;
    $('converter-select-all').textContent = gif && selected.size === gif.frames.length ? 'Deselect all' : 'Select all';
  }
  function updatePreview(index) {
    if (!gif) return;
    current = (index + gif.frames.length) % gif.frames.length;
    $('converter-preview').src = urls[current];
    $('converter-preview').alt = `Frame ${current + 1} of ${gif.frames.length}`;
    $('converter-frame-slider').value = String(current + 1);
    $('converter-frame-label').textContent = `Frame ${current + 1} / ${gif.frames.length}`;
    $('converter-frame-grid').querySelectorAll('.is-current').forEach(card => card.classList.remove('is-current'));
    $('converter-frame-grid').querySelector(`[data-frame="${current}"]`)?.classList.add('is-current');
  }
  function appendFrames() {
    if (!gif) return;
    const end = Math.min(visible + batchSize, gif.frames.length);
    const fragment = document.createDocumentFragment();
    for (let index = visible; index < end; index++) {
      const card = document.createElement('article');
      card.className = 'frame-card';
      card.dataset.frame = String(index);
      card.classList.toggle('is-selected', selected.has(index));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'frame-thumbnail checkerboard';
      button.setAttribute('aria-label', `Preview frame ${index + 1}`);
      const img = document.createElement('img');
      img.src = urls[index];
      img.alt = '';
      img.width = gif.width;
      img.height = gif.height;
      img.loading = 'lazy';
      button.append(img);
      button.addEventListener('click', () => { clearOutput(); updatePreview(index); });
      const caption = document.createElement('div');
      caption.className = 'frame-caption';
      const labelNode = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selected.has(index);
      check.setAttribute('aria-label', `Select frame ${index + 1}`);
      check.addEventListener('change', () => {
        check.checked ? selected.add(index) : selected.delete(index);
        card.classList.toggle('is-selected', check.checked);
        clearOutput();
        updateControls();
      });
      labelNode.append(check, ` ${String(index + 1).padStart(3, '0')}`);
      const time = document.createElement('span');
      time.textContent = `${gif.frames[index].delay} ms`;
      caption.append(labelNode, time);
      card.append(button, caption);
      fragment.append(card);
    }
    $('converter-frame-grid').append(fragment);
    visible = end;
    $('converter-more').hidden = visible >= gif.frames.length;
    $('converter-more').textContent = `Show more frames (${visible} of ${gif.frames.length})`;
    updatePreview(current);
    updateControls();
  }
  function messageFor(error) {
    const errors = {
      EMPTY_FILE: 'Choose a non-empty GIF file.', FILE_SIZE: 'This GIF exceeds 30 MiB. Choose a smaller file.',
      NOT_GIF: 'This file is not a GIF. Choose a valid GIF file.', INVALID_GIF: 'This GIF is incomplete or damaged. Try another file.',
      NO_FRAMES: 'This GIF has no image frames. Try another file.', FRAME_LIMIT: 'This GIF exceeds 1,000 frames. Try a shorter GIF.',
      DIMENSIONS: 'This GIF exceeds the image size limit. Try a smaller GIF.', MEMORY_LIMIT: 'This GIF needs too much browser memory. Try a shorter or smaller GIF.',
      UNSUPPORTED_TEXT: 'This GIF contains an unsupported text rendering block. Try an image-only GIF.',
      CANVAS: 'Your browser could not create an image canvas. Try a current browser or a smaller GIF.',
      PNG_EXPORT: 'A frame could not be prepared. Try a smaller GIF.',
      FORMAT_UNSUPPORTED: `${label} export is not supported by this browser. Try a current browser.`,
      CONVERT_OPTIONS: 'Check the output settings and try again.', CONVERT_FAILED: `The ${label} image could not be created. Try a smaller GIF.`,
      ZIP_LIMIT: `The prepared ${label} images exceed the 128 MiB ZIP limit. Select fewer frames and download in batches.`,
      ZIP_CREATE: 'The ZIP could not be created. Try selecting fewer frames.',
    };
    return errors[error?.code] || 'The GIF could not be processed. Try another file or a current browser.';
  }
  async function openFile(file) {
    if (!file || busy) return;
    const currentJob = ++job;
    controller?.abort();
    controller = new AbortController();
    releaseFrames();
    busy = true;
    updateControls();
    $('converter-upload').hidden = true;
    $('converter-progress-panel').hidden = false;
    $('converter-progress').value = 0;
    $('converter-progress-label').textContent = 'Reading GIF…';
    status();
    try {
      const result = await extractGif(file, { signal: controller.signal, onProgress: ({ completed, total, percent }) => {
        if (currentJob !== job) return;
        $('converter-progress-label').textContent = `Extracting frame ${completed} of ${total}`;
        $('converter-progress').value = percent;
      } });
      if (currentJob !== job) return;
      gif = result;
      sourceName = file.name || 'animation.gif';
      urls = gif.frames.map(frame => URL.createObjectURL(frame.blob));
      $('converter-file-name').textContent = sourceName;
      $('converter-file-info').textContent = `${gif.frames.length} frames · ${gif.width} × ${gif.height} pixels`;
      $('converter-frame-slider').max = String(gif.frames.length);
      $('converter-results').hidden = false;
      document.body.classList.add('has-converter-results');
      appendFrames();
      status(`${gif.frames.length} frames ready. Choose a frame or select several.`);
      $('converter-results-title').focus({ preventScroll: true });
    } catch (error) {
      if (currentJob !== job) return;
      $('converter-upload').hidden = false;
      status(error?.name === 'AbortError' ? 'Processing cancelled. Choose a GIF to try again.' : messageFor(error), error?.name !== 'AbortError');
    } finally {
      if (currentJob === job) {
        busy = false;
        controller = undefined;
        $('converter-progress-panel').hidden = true;
        $('converter-input').value = '';
        updateControls();
      }
    }
  }
  function outputName() {
    return sourceName.replace(/\.gif$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'gif';
  }
  async function prepare(indices, single) {
    if (!gif || busy || !indices.length) return;
    const currentJob = ++job;
    controller = new AbortController();
    busy = true;
    clearOutput();
    updateControls();
    $('converter-progress-panel').hidden = false;
    $('converter-progress').value = 0;
    $('converter-progress-label').textContent = `Preparing ${label} images…`;
    $('converter-cancel').focus();
    status();
    const options = { format, quality: Number($('converter-quality').value) / 100, background: $('converter-background')?.value || '#ffffff', signal: controller.signal };
    try {
      const blob = single ? await convertFrame(gif.frames[indices[0]].blob, options) : await createConvertedZip(gif.frames, indices, {
        ...options, sourceName, onProgress: ({ completed, total }) => {
          if (currentJob !== job) return;
          $('converter-progress-label').textContent = `Preparing image ${completed} of ${total}`;
          $('converter-progress').value = total ? Math.round(completed / total * 100) : 0;
        },
      });
      if (currentJob !== job) return;
      resultUrl = URL.createObjectURL(blob);
      const name = single ? `${outputName()}-frame-${String(indices[0] + 1).padStart(4, '0')}.${format}` : `${outputName()}-${format}-frames.zip`;
      const link = $('converter-save');
      link.href = resultUrl;
      link.download = name;
      link.textContent = single ? `Download ${label}` : 'Download ZIP';
      $('converter-output-message').textContent = single ? `Your ${label} image is ready.` : `Your ZIP with ${indices.length} ${label} ${indices.length === 1 ? 'image is' : 'images is'} ready.`;
      $('converter-output').hidden = false;
      status('Your download is ready.');
      link.focus();
    } catch (error) {
      if (currentJob !== job) return;
      status(error?.name === 'AbortError' ? 'Preparation cancelled. Your GIF is still available.' : messageFor(error), error?.name !== 'AbortError');
    } finally {
      if (currentJob === job) {
        busy = false;
        controller = undefined;
        $('converter-progress-panel').hidden = true;
        updateControls();
      }
    }
  }

  $('converter-choose').addEventListener('click', () => $('converter-input').click());
  $('converter-input').addEventListener('change', event => openFile(event.target.files[0]));
  $('converter-reset').addEventListener('click', () => { reset(); $('converter-input').click(); });
  $('converter-cancel').addEventListener('click', () => controller?.abort());
  $('converter-sample').addEventListener('click', async () => {
    if (busy) return;
    const sampleJob = ++job;
    $('converter-sample').disabled = true;
    status('Opening sample…');
    try {
      const response = await fetch('/sample.gif');
      if (!response.ok) throw new Error('Sample unavailable');
      const data = await response.blob();
      if (job === sampleJob) await openFile(new File([data], 'little-orbit.gif', { type: 'image/gif' }));
    } catch { if (job === sampleJob) status('The sample could not be loaded. You can choose your own GIF.', true); }
    finally { if (!busy) $('converter-sample').disabled = false; }
  });
  const dropzone = $('converter-dropzone');
  for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, event => { event.preventDefault(); if (!busy) dropzone.classList.add('is-dragging'); });
  dropzone.addEventListener('dragleave', event => { if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging'); });
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    if (event.dataTransfer.files.length !== 1) { status('Choose one GIF at a time.', true); return; }
    openFile(event.dataTransfer.files[0]);
  });
  document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
  document.addEventListener('drop', event => { if (event.dataTransfer?.files.length) event.preventDefault(); });
  $('converter-previous').addEventListener('click', () => { clearOutput(); updatePreview(current - 1); });
  $('converter-next').addEventListener('click', () => { clearOutput(); updatePreview(current + 1); });
  $('converter-frame-slider').addEventListener('input', event => { clearOutput(); updatePreview(Number(event.target.value) - 1); });
  $('converter-quality').addEventListener('input', event => { $('converter-quality-value').textContent = `${event.target.value}%`; clearOutput(); });
  $('converter-background')?.addEventListener('input', event => { $('converter-stage').style.background = event.target.value; clearOutput(); });
  if (format === 'jpg') $('converter-stage').style.background = $('converter-background').value;
  $('converter-select-all').addEventListener('click', () => {
    if (!gif) return;
    selected = selected.size === gif.frames.length ? new Set() : new Set(gif.frames.map((_, index) => index));
    $('converter-frame-grid').querySelectorAll('.frame-card').forEach(card => {
      const checked = selected.has(Number(card.dataset.frame));
      card.querySelector('input').checked = checked;
      card.classList.toggle('is-selected', checked);
    });
    clearOutput();
    updateControls();
  });
  $('converter-more').addEventListener('click', appendFrames);
  $('converter-download-frame').addEventListener('click', () => prepare([current], true));
  $('converter-download-selected').addEventListener('click', () => prepare([...selected].sort((a, b) => a - b), false));
  $('converter-download-all').addEventListener('click', () => prepare(gif.frames.map((_, index) => index), false));
  window.addEventListener('pagehide', () => { controller?.abort(); urls.forEach(url => URL.revokeObjectURL(url)); if (resultUrl) URL.revokeObjectURL(resultUrl); });
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  updateControls();
}
