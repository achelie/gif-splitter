import './site.js';
import { localizeTool } from './tool-i18n.js';
import './editor.css';
import { extractGif } from './gif-engine.js';
import { editGif, inspectEditableGif, EDIT_LIMITS } from './gif-editor.js';

const app = document.getElementById('editor-app');
if (app) {
  const mode = app.dataset.mode;
  if (!['resize', 'crop'].includes(mode)) throw new Error('Unknown GIF editor mode');
  const resize = mode === 'resize';
  const action = resize ? 'Resize' : 'Crop';
  app.innerHTML = `
    <div id="editor-upload">
      <div class="dropzone" id="editor-dropzone">
        <h2>Choose a GIF to ${mode}</h2><p>Drop a GIF here or choose a file from your device.</p>
        <button type="button" class="button primary" id="editor-choose">Choose GIF</button>
        <p class="file-hint">One GIF · Up to 30 MiB · 400 frames<span>Free · No account needed</span></p>
      </div>
      <div class="below-drop"><span>Your GIF stays on your device.</span><button type="button" class="text-button" id="editor-sample">Try a sample GIF →</button></div>
    </div>
    <input id="editor-input" type="file" class="sr-only" accept="image/gif,.gif" tabindex="-1" aria-label="Choose a GIF file">
    <div id="editor-status" class="status-message" role="status" aria-live="polite"></div>
    <div class="progress-panel" id="editor-progress-panel" hidden><div class="progress-heading"><span id="editor-progress-label">Preparing…</span><button type="button" class="text-button" id="editor-cancel">Cancel</button></div><progress id="editor-progress" max="100" value="0" aria-label="GIF processing progress"></progress><p>Keep this page open while your GIF is processed.</p></div>
    <section id="editor-results" class="editor-results" aria-labelledby="editor-results-title" hidden>
      <div class="results-toolbar"><div><p class="section-label">YOUR GIF</p><h2 id="editor-results-title" tabindex="-1">${resize ? 'Choose output dimensions' : 'Choose a crop area'}</h2></div><button type="button" class="button" id="editor-reset">Choose another GIF</button></div>
      <div class="editor-workspace">
        <div class="editor-preview-panel">
          <div id="editor-stage" class="editor-stage checkerboard"><div id="editor-image-wrap" class="editor-image-wrap"><img id="editor-preview" alt="Current frame of the GIF">${resize ? '' : '<div id="editor-crop-box" class="editor-crop-box" aria-hidden="true"></div>'}</div></div>
          <div class="editor-frame-controls"><button type="button" class="icon-button" id="editor-previous" aria-label="Previous frame">←</button><label for="editor-frame-slider" id="editor-frame-label"></label><button type="button" class="icon-button" id="editor-next" aria-label="Next frame">→</button></div>
          <input type="range" id="editor-frame-slider" min="1" value="1" max="1" aria-label="Choose a frame to preview">
          <p class="editor-note">${resize ? 'Preview a source frame before resizing the full animation.' : 'Drag on the image to select a crop. Use the fields for precise coordinates; the same area is used on every frame.'}</p>
        </div>
        <div class="editor-options">
          <h3 id="editor-file-name"></h3><p class="muted" id="editor-file-info"></p>
          ${resize ? '<label class="editor-lock"><input type="checkbox" id="editor-lock" checked> Keep aspect ratio</label>' : '<p class="editor-note">Coordinates start at the upper-left corner of the original GIF.</p><div class="editor-fields"><label for="editor-x">Left (px)<input id="editor-x" type="number" min="0" step="1" inputmode="numeric" required></label><label for="editor-y">Top (px)<input id="editor-y" type="number" min="0" step="1" inputmode="numeric" required></label></div>'}
          <div class="editor-fields"><label for="editor-width">Width (px)<input id="editor-width" type="number" min="1" step="1" inputmode="numeric" required></label><label for="editor-height">Height (px)<input id="editor-height" type="number" min="1" step="1" inputmode="numeric" required></label></div>
          <p class="editor-note" id="editor-limits">Up to 4,096 pixels per side, 4 million pixels per frame and 20 million output pixels in total.</p>
          <p class="editor-note">The result is re-encoded as GIF, so colors can change. Original frame delays and loop behavior are retained.</p>
          <button type="button" class="button primary editor-apply" id="editor-apply">${action} GIF</button>
        </div>
      </div>
      <div id="editor-output" class="editor-output" aria-labelledby="editor-output-title" hidden><div><h2 id="editor-output-title" tabindex="-1">Your ${resize ? 'resized' : 'cropped'} GIF</h2><p id="editor-output-message"></p><a id="editor-save" class="button primary">Download GIF</a><p class="editor-note">Check the animation before closing this page. Your original file is unchanged.</p></div><div class="editor-output-stage checkerboard"><img id="editor-output-preview" alt="Preview of the edited GIF"></div></div>
    </section>`;
  localizeTool(app, 'editor');

  const $ = id => document.getElementById(id);
  let gif, sourceFile, previewUrl, resultUrl, current = 0, job = 0, busy = false, controller;
  let dragStart;

  function status(message = '', isError = false) {
    $('editor-status').textContent = message;
    $('editor-status').classList.toggle('error', isError);
  }
  function clearOutput() {
    $('editor-output').hidden = true;
    $('editor-save').removeAttribute('href');
    $('editor-output-preview').removeAttribute('src');
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = undefined;
  }
  function release() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
    $('editor-preview').removeAttribute('src');
    gif = sourceFile = undefined;
    current = 0;
    dragStart = undefined;
    $('editor-results').hidden = true;
    $('editor-upload').hidden = false;
    document.body.classList.remove('has-editor-results');
    clearOutput();
  }
  function reset() {
    job++;
    controller?.abort();
    controller = undefined;
    busy = false;
    release();
    $('editor-input').value = '';
    $('editor-progress-panel').hidden = true;
    updateControls();
    status();
  }
  function updateControls() {
    $('editor-results').querySelectorAll('button, input').forEach(element => { element.disabled = busy; });
    $('editor-choose').disabled = busy;
    $('editor-sample').disabled = busy;
    $('editor-input').disabled = busy;
    $('editor-previous').disabled = busy || !gif || gif.frames.length < 2;
    $('editor-next').disabled = busy || !gif || gif.frames.length < 2;
  }
  function updatePreview(index) {
    if (!gif) return;
    current = (index + gif.frames.length) % gif.frames.length;
    const previous = previewUrl;
    previewUrl = URL.createObjectURL(gif.frames[current].blob);
    $('editor-preview').src = previewUrl;
    $('editor-preview').alt = `Frame ${current + 1} of ${gif.frames.length}`;
    $('editor-frame-slider').value = String(current + 1);
    $('editor-frame-label').textContent = `Frame ${current + 1} / ${gif.frames.length}`;
    if (previous) URL.revokeObjectURL(previous);
  }
  function readNumber(id) {
    const value = $(id).value;
    return value === '' ? NaN : Number(value);
  }
  function options() {
    if (!gif) return null;
    const width = readNumber('editor-width'), height = readNumber('editor-height');
    const x = resize ? 0 : readNumber('editor-x'), y = resize ? 0 : readNumber('editor-y');
    if (![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || width < 1 || height < 1) return null;
    if (!resize && (x + width > gif.width || y + height > gif.height)) return null;
    return { mode, x, y, width, height };
  }
  function syncCropBox() {
    if (resize || !gif) return;
    const rect = options();
    const box = $('editor-crop-box');
    box.hidden = !rect;
    if (!rect) return;
    box.style.left = `${rect.x / gif.width * 100}%`;
    box.style.top = `${rect.y / gif.height * 100}%`;
    box.style.width = `${rect.width / gif.width * 100}%`;
    box.style.height = `${rect.height / gif.height * 100}%`;
  }
  function messageFor(error) {
    const errors = {
      EMPTY_FILE: 'Choose a non-empty GIF file.', FILE_SIZE: 'This GIF exceeds 30 MiB. Choose a smaller file.',
      NOT_GIF: 'This file is not a GIF. Choose a valid GIF file.', INVALID_GIF: 'This GIF is incomplete or damaged. Try another file.',
      NO_FRAMES: 'This GIF has no image frames. Try another file.', FRAME_LIMIT: 'This GIF has too many frames.',
      DIMENSIONS: 'This GIF exceeds the image size limit. Try a smaller GIF.', MEMORY_LIMIT: 'This GIF needs too much browser memory. Try a shorter or smaller GIF.',
      UNSUPPORTED_TEXT: 'This GIF contains an unsupported text rendering block. Try an image-only GIF.',
      CANVAS: 'Your browser could not create an image canvas. Try a current browser or a smaller GIF.',
      PNG_EXPORT: 'A frame could not be prepared. Try a smaller GIF.',
      EDIT_OPTIONS: 'Check the dimensions and make sure the crop area stays inside the GIF.',
      EDIT_DIMENSIONS: 'The output is too large. Use dimensions up to 4,096 pixels per side and 4 million pixels per frame.',
      EDIT_FRAMES: 'This GIF has more than 400 frames. Choose a shorter GIF.',
      EDIT_MEMORY: 'The output needs too much browser memory. Use a smaller area or a shorter GIF.',
      EDIT_ENCODER: 'The GIF encoder could not run. Try a current browser or a smaller GIF.',
    };
    return errors[error?.code] || 'The GIF could not be processed. Try another file or a current browser.';
  }
  async function openFile(file) {
    if (!file || busy) return;
    const currentJob = ++job;
    controller?.abort();
    controller = new AbortController();
    release();
    busy = true;
    updateControls();
    $('editor-upload').hidden = true;
    $('editor-progress-panel').hidden = false;
    $('editor-progress').value = 0;
    $('editor-progress-label').textContent = 'Checking GIF…';
    status();
    try {
      await inspectEditableGif(file, { signal: controller.signal });
      const result = await extractGif(file, { signal: controller.signal, onProgress: ({ completed, total, percent }) => {
        if (currentJob !== job) return;
        $('editor-progress-label').textContent = `Reading frame ${completed} of ${total}`;
        $('editor-progress').value = percent;
      } });
      if (currentJob !== job) return;
      gif = result;
      sourceFile = file;
      $('editor-file-name').textContent = file.name || 'animation.gif';
      $('editor-file-info').textContent = `${gif.frames.length} frames · ${gif.width} × ${gif.height} pixels`;
      $('editor-width').value = String(gif.width);
      $('editor-height').value = String(gif.height);
      if (!resize) { $('editor-x').value = '0'; $('editor-y').value = '0'; }
      else $('editor-lock').checked = true;
      $('editor-frame-slider').max = String(gif.frames.length);
      const wrap = $('editor-image-wrap');
      wrap.style.aspectRatio = `${gif.width} / ${gif.height}`;
      wrap.style.maxWidth = `${Math.max(1, 300 * gif.width / gif.height)}px`;
      $('editor-results').hidden = false;
      document.body.classList.add('has-editor-results');
      updatePreview(0);
      syncCropBox();
      status(`${gif.frames.length} frames ready. ${resize ? 'Choose the dimensions.' : 'Select the area to keep.'}`);
      $('editor-results-title').focus({ preventScroll: true });
    } catch (error) {
      if (currentJob !== job) return;
      $('editor-upload').hidden = false;
      status(error?.name === 'AbortError' ? 'Processing cancelled. Choose a GIF to try again.' : messageFor(error), error?.name !== 'AbortError');
    } finally {
      if (currentJob === job) {
        busy = false;
        controller = undefined;
        $('editor-progress-panel').hidden = true;
        $('editor-input').value = '';
        updateControls();
      }
    }
  }
  async function apply() {
    if (!gif || busy) return;
    const settings = options();
    if (!settings) { status(resize ? 'Enter positive whole-number dimensions.' : 'Enter a crop area inside the GIF using whole numbers.', true); return; }
    if (settings.width > EDIT_LIMITS.maxDimension || settings.height > EDIT_LIMITS.maxDimension || settings.width * settings.height > EDIT_LIMITS.maxFramePixels) {
      status(messageFor({ code: 'EDIT_DIMENSIONS' }), true); return;
    }
    if (settings.width * settings.height * gif.frames.length > EDIT_LIMITS.maxOutputPixels) {
      status(messageFor({ code: 'EDIT_MEMORY' }), true); return;
    }
    const currentJob = ++job;
    controller = new AbortController();
    busy = true;
    clearOutput();
    updateControls();
    $('editor-progress-panel').hidden = false;
    $('editor-progress').value = 0;
    $('editor-progress-label').textContent = 'Preparing animation…';
    $('editor-cancel').focus();
    status();
    try {
      const result = await editGif(sourceFile, gif, { ...settings, signal: controller.signal, onProgress: ({ completed, total, percent }) => {
        if (currentJob !== job) return;
        $('editor-progress-label').textContent = `Encoding frame ${completed} of ${total}`;
        $('editor-progress').value = percent ?? (total ? Math.round(completed / total * 100) : 0);
      } });
      if (currentJob !== job) return;
      resultUrl = URL.createObjectURL(result.blob);
      $('editor-output-preview').src = resultUrl;
      $('editor-output-message').textContent = `${result.width} × ${result.height} pixels · ${result.frameCount} frames`;
      $('editor-save').href = resultUrl;
      const name = (sourceFile.name || 'animation').replace(/\.gif$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'gif';
      $('editor-save').download = `${name}-${resize ? 'resized' : 'cropped'}.gif`;
      $('editor-output').hidden = false;
      status('Your GIF is ready.');
      $('editor-save').focus();
    } catch (error) {
      if (currentJob !== job) return;
      status(error?.name === 'AbortError' ? 'Processing cancelled. Your GIF is still available.' : messageFor(error), error?.name !== 'AbortError');
    } finally {
      if (currentJob === job) {
        busy = false;
        controller = undefined;
        $('editor-progress-panel').hidden = true;
        updateControls();
      }
    }
  }

  $('editor-choose').addEventListener('click', () => $('editor-input').click());
  $('editor-input').addEventListener('change', event => openFile(event.target.files[0]));
  $('editor-reset').addEventListener('click', () => { reset(); $('editor-input').click(); });
  $('editor-cancel').addEventListener('click', () => controller?.abort());
  $('editor-sample').addEventListener('click', async () => {
    if (busy) return;
    const sampleJob = ++job;
    $('editor-sample').disabled = true;
    status('Opening sample…');
    try {
      const response = await fetch('/sample.gif');
      if (!response.ok) throw new Error('Sample unavailable');
      const data = await response.blob();
      if (job === sampleJob) await openFile(new File([data], 'little-orbit.gif', { type: 'image/gif' }));
    } catch { if (job === sampleJob) status('The sample could not be loaded. You can choose your own GIF.', true); }
    finally { if (!busy) $('editor-sample').disabled = false; }
  });
  const dropzone = $('editor-dropzone');
  for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, event => { event.preventDefault(); if (!busy) dropzone.classList.add('is-dragging'); });
  dropzone.addEventListener('dragleave', event => { if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging'); });
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    if (event.dataTransfer.files.length !== 1) { status('Choose one GIF at a time.', true); return; }
    openFile(event.dataTransfer.files[0]);
  });
  document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
  document.addEventListener('drop', event => { if (event.dataTransfer?.files.length) event.preventDefault(); });
  $('editor-previous').addEventListener('click', () => updatePreview(current - 1));
  $('editor-next').addEventListener('click', () => updatePreview(current + 1));
  $('editor-frame-slider').addEventListener('input', event => updatePreview(Number(event.target.value) - 1));
  for (const id of resize ? ['editor-width', 'editor-height'] : ['editor-x', 'editor-y', 'editor-width', 'editor-height']) {
    $(id).addEventListener('input', event => {
      clearOutput();
      status();
      if (resize && gif && $('editor-lock').checked) {
        const value = Number(event.target.value);
        if (Number.isSafeInteger(value) && value > 0) {
          if (id === 'editor-width') $('editor-height').value = String(Math.max(1, Math.round(value * gif.height / gif.width)));
          else $('editor-width').value = String(Math.max(1, Math.round(value * gif.width / gif.height)));
        }
      }
      syncCropBox();
    });
  }
  if (!resize) {
    const wrap = $('editor-image-wrap');
    const point = event => {
      const bounds = wrap.getBoundingClientRect();
      return { x: Math.max(0, Math.min(gif.width, Math.round((event.clientX - bounds.left) * gif.width / bounds.width))), y: Math.max(0, Math.min(gif.height, Math.round((event.clientY - bounds.top) * gif.height / bounds.height))) };
    };
    const draw = event => {
      if (!gif || !dragStart || busy) return;
      const end = point(event);
      const x = Math.min(dragStart.x, end.x, gif.width - 1), y = Math.min(dragStart.y, end.y, gif.height - 1);
      const width = Math.max(1, Math.min(gif.width - x, Math.abs(end.x - dragStart.x)));
      const height = Math.max(1, Math.min(gif.height - y, Math.abs(end.y - dragStart.y)));
      $('editor-x').value = String(x); $('editor-y').value = String(y);
      $('editor-width').value = String(width); $('editor-height').value = String(height);
      // Keep the status region's height unchanged while dragging: hiding it
      // would shift the image under the pointer and change the coordinates.
      clearOutput(); syncCropBox();
    };
    wrap.addEventListener('pointerdown', event => {
      if (!gif || busy || event.button !== 0) return;
      event.preventDefault();
      dragStart = point(event);
      wrap.setPointerCapture(event.pointerId);
      draw(event);
    });
    wrap.addEventListener('pointermove', event => { if (dragStart) { event.preventDefault(); draw(event); } });
    wrap.addEventListener('pointerup', event => { if (dragStart) { draw(event); dragStart = undefined; status('Crop selection updated.'); } });
    wrap.addEventListener('pointercancel', () => { dragStart = undefined; });
  }
  $('editor-apply').addEventListener('click', apply);
  window.addEventListener('pagehide', () => { controller?.abort(); if (previewUrl) URL.revokeObjectURL(previewUrl); if (resultUrl) URL.revokeObjectURL(resultUrl); });
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  updateControls();
}
