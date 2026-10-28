import './site.js';
import { localizeTool } from './tool-i18n.js';
import './merger.css';
import { mergeGifs, MERGE_LIMITS } from './gif-merger.js';

const app = document.getElementById('merger-app');

if (app) {
  // All source files and generated previews remain in this tab's memory.
  app.innerHTML = `
    <div class="merger-dropzone" id="merger-dropzone">
      <div class="merger-drop-icon" aria-hidden="true">+</div>
      <h2>Choose GIFs to merge</h2>
      <p>Drop your GIFs here or choose files from your device.</p>
      <button class="button primary" id="merger-choose" type="button">Choose GIFs</button>
      <p class="merger-hint">2–10 GIFs · 30 MiB total · Up to 400 frames</p>
      <input class="sr-only" type="file" id="merger-input" accept="image/gif,.gif" multiple tabindex="-1" aria-label="Choose GIF files">
    </div>
    <p class="merger-local">Your files are processed in your browser and stay on your device.</p>
    <div id="merger-status" class="status-message" role="status" aria-live="polite"></div>
    <div class="merger-workspace" id="merger-workspace" hidden>
      <div class="merger-list-heading"><div><p class="merger-overline">YOUR SEQUENCE</p><h2>Arrange your GIFs</h2><p>They will play one after another, in this order.</p></div><button class="button small" id="merger-add" type="button">Add GIFs</button></div>
      <ol class="merger-list" id="merger-list" aria-label="GIF playback order"></ol>
      <div class="merger-controls"><button class="button primary" id="merger-start" type="button">Merge GIFs</button><button class="text-button" id="merger-clear" type="button">Clear all</button></div>
      <p class="merger-details">Different sizes keep their original dimensions and are centered on a transparent canvas. Frame timing is kept; the result loops. GIF color reduction can change colors.</p>
    </div>
    <div class="progress-panel" id="merger-progress-panel" hidden><div class="progress-heading"><span id="merger-progress-label">Preparing GIFs…</span><button id="merger-cancel" type="button" class="text-button">Cancel</button></div><progress id="merger-progress" max="100" value="0" aria-label="Current file progress"></progress><p>Keep this tab open while your GIF is being prepared.</p></div>
    <section class="merger-result" id="merger-result" aria-labelledby="merger-result-title" hidden>
      <div><p class="merger-overline">READY TO DOWNLOAD</p><h2 id="merger-result-title" tabindex="-1">Your merged GIF</h2><p id="merger-result-summary"></p><a class="button primary" id="merger-download" download="merged.gif">Download merged GIF</a><p class="merger-details">Check the result before closing this page. Your original files are unchanged.</p></div>
      <div class="merger-preview checkerboard"><img id="merger-preview" alt="Preview of the merged GIF"></div>
    </section>`;
  localizeTool(app, 'merger');

  const $ = id => document.getElementById(id);
  const list = $('merger-list');
  let entries = [];
  let nextId = 0;
  let controller;
  let resultUrl;
  let activeJob = 0;
  let busy = false;

  function showStatus(message = '', error = false) {
    const node = $('merger-status');
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  function releaseResult() {
    $('merger-result').hidden = true;
    $('merger-preview').removeAttribute('src');
    $('merger-download').removeAttribute('href');
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = undefined;
  }

  function sizeLabel(bytes) {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
  }

  function renderList(focusId, focusAction) {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'merger-file';
      const order = document.createElement('span');
      order.className = 'merger-file-order';
      order.textContent = String(index + 1).padStart(2, '0');
      order.setAttribute('aria-hidden', 'true');
      const details = document.createElement('div');
      details.className = 'merger-file-details';
      const name = document.createElement('strong');
      name.textContent = entry.file.name || 'GIF file';
      const meta = document.createElement('span');
      meta.textContent = sizeLabel(entry.file.size);
      details.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'merger-file-actions';
      for (const [action, label, symbol] of [['up', 'Move up', '↑'], ['down', 'Move down', '↓'], ['remove', 'Remove', 'Remove']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = action === 'remove' ? 'button small merger-remove' : 'button small merger-move';
        button.textContent = symbol;
        button.setAttribute('aria-label', `${label} ${entry.file.name || `GIF ${index + 1}`}`);
        button.dataset.id = String(entry.id);
        button.dataset.action = action;
        button.disabled = busy || (action === 'up' && index === 0) || (action === 'down' && index === entries.length - 1);
        actions.append(button);
      }
      item.append(order, details, actions);
      list.append(item);
    });
    $('merger-workspace').hidden = entries.length === 0;
    $('merger-start').disabled = busy || entries.length < MERGE_LIMITS.minFiles;
    $('merger-add').disabled = busy || entries.length >= MERGE_LIMITS.maxFiles;
    $('merger-choose').disabled = busy || entries.length >= MERGE_LIMITS.maxFiles;
    $('merger-input').disabled = busy;
    $('merger-clear').disabled = busy;
    if (focusId !== undefined) {
      const target = list.querySelector(`[data-id="${focusId}"][data-action="${focusAction}"]`);
      if (target && !target.disabled) target.focus();
      else (list.querySelector(`[data-id="${focusId}"][data-action="remove"]`) || $('merger-add')).focus();
    }
  }

  function addFiles(files) {
    if (busy || !files.length) return;
    if (entries.length + files.length > MERGE_LIMITS.maxFiles) {
      showStatus(`Choose up to ${MERGE_LIMITS.maxFiles} GIFs at a time. Remove a file to add another.`, true);
      return;
    }
    if (files.some(file => !file.size)) {
      showStatus('One of the files is empty. Choose non-empty GIF files.', true);
      return;
    }
    const total = [...entries.map(entry => entry.file), ...files].reduce((sum, file) => sum + file.size, 0);
    if (total > MERGE_LIMITS.maxInputBytes) {
      showStatus('These files exceed the 30 MiB total input limit. Choose smaller GIFs or fewer files.', true);
      return;
    }
    entries.push(...files.map(file => ({ file, id: nextId++ })));
    releaseResult();
    renderList();
    showStatus(entries.length < MERGE_LIMITS.minFiles ? 'Add at least one more GIF to merge.' : `${entries.length} GIFs ready. Arrange them, then select Merge GIFs.`);
  }

  function errorMessage(error) {
    const messages = {
      MERGE_FILES: 'Choose between 2 and 10 GIFs to merge.',
      MERGE_SIZE: 'The GIFs exceed the 30 MiB total input limit. Choose smaller GIFs or fewer files.',
      MERGE_FRAMES: 'These GIFs contain more than 400 frames in total. Try shorter GIFs.',
      MERGE_DIMENSIONS: 'The output canvas is too large. Use GIFs up to 4,096 pixels per side and 4 million pixels per frame.',
      MERGE_MEMORY: 'These GIFs need too much browser memory to merge safely. Try fewer, shorter, or smaller GIFs.',
      FILE_SIZE: 'A GIF is too large. The total input limit is 30 MiB.',
      FRAME_LIMIT: 'A GIF contains too many frames. The combined limit is 400 frames.',
      MEMORY_LIMIT: 'A GIF needs too much browser memory to decode. Try a shorter or smaller GIF.',
      DIMENSIONS: 'A GIF has dimensions that are too large. Try a smaller GIF.',
      EMPTY_FILE: 'One of the files is empty. Choose non-empty GIF files.',
      NOT_GIF: 'One of the files is not a valid GIF. Choose GIF files.',
      INVALID_GIF: 'One of the GIFs is incomplete or damaged. Try another file.',
      NO_FRAMES: 'One of the GIFs does not contain image frames. Try another file.',
      UNSUPPORTED_TEXT: 'One GIF contains an unsupported text rendering block. Try an image-only GIF.',
      CANVAS: 'Your browser could not create an image canvas. Try a current browser or smaller GIFs.',
      PNG_EXPORT: 'A frame could not be prepared. Try a smaller GIF.',
      MERGE_ENCODER: 'Your browser could not create the merged GIF. Try a current browser or fewer, smaller GIFs.',
    };
    return messages[error?.code] || 'The GIFs could not be merged. Try fewer or smaller files, or a current browser.';
  }

  async function startMerge() {
    if (busy || entries.length < MERGE_LIMITS.minFiles) return;
    releaseResult();
    showStatus();
    busy = true;
    const job = ++activeJob;
    controller = new AbortController();
    renderList();
    $('merger-progress-panel').hidden = false;
    $('merger-progress').value = 0;
    $('merger-progress-label').textContent = 'Preparing GIFs…';
    $('merger-cancel').focus();
    let restoreFocus = false;
    try {
      const result = await mergeGifs(entries.map(entry => entry.file), {
        signal: controller.signal,
        onProgress({ stage, fileIndex, fileCount, completed, total }) {
          if (job !== activeJob) return;
          const verb = stage === 'encoding' ? 'Encoding' : 'Reading';
          $('merger-progress-label').textContent = `${verb} GIF ${fileIndex} of ${fileCount}: frame ${completed} of ${total}`;
          $('merger-progress').value = total ? Math.round(completed / total * 100) : 0;
        },
      });
      if (job !== activeJob) return;
      resultUrl = URL.createObjectURL(result.blob);
      $('merger-preview').src = resultUrl;
      $('merger-download').href = resultUrl;
      $('merger-result-summary').textContent = `${result.width} × ${result.height} pixels · ${result.frameCount} frames · ${sizeLabel(result.blob.size)}`;
      $('merger-result').hidden = false;
      showStatus('Your merged GIF is ready.');
      $('merger-result-title').focus();
    } catch (error) {
      if (job !== activeJob) return;
      showStatus(error.name === 'AbortError' ? 'Merging cancelled. Your original GIFs are still here.' : errorMessage(error), error.name !== 'AbortError');
      restoreFocus = true;
    } finally {
      if (job === activeJob) {
        busy = false;
        controller = undefined;
        $('merger-progress-panel').hidden = true;
        renderList();
        if (restoreFocus) $('merger-start').focus();
      }
    }
  }

  $('merger-choose').addEventListener('click', () => $('merger-input').click());
  $('merger-add').addEventListener('click', () => $('merger-input').click());
  $('merger-input').addEventListener('change', event => {
    addFiles([...event.target.files]);
    event.target.value = '';
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || busy) return;
    const index = entries.findIndex(entry => entry.id === Number(button.dataset.id));
    if (index < 0) return;
    const entry = entries[index];
    const action = button.dataset.action;
    if (action === 'remove') entries.splice(index, 1);
    else {
      const next = index + (action === 'up' ? -1 : 1);
      if (next < 0 || next >= entries.length) return;
      [entries[index], entries[next]] = [entries[next], entries[index]];
    }
    releaseResult();
    renderList(action === 'remove' ? undefined : entry.id, action);
    showStatus(action === 'remove' ? `${entry.file.name || 'GIF'} removed.` : `${entry.file.name || 'GIF'} moved to position ${entries.indexOf(entry) + 1}.`);
    if (action === 'remove') (entries.length ? $('merger-add') : $('merger-choose')).focus();
  });
  $('merger-clear').addEventListener('click', () => {
    if (busy) return;
    entries = [];
    releaseResult();
    renderList();
    showStatus('GIFs cleared.');
    $('merger-choose').focus();
  });
  $('merger-start').addEventListener('click', startMerge);
  $('merger-cancel').addEventListener('click', () => controller?.abort());
  const dropzone = $('merger-dropzone');
  for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    if (!busy) dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', event => {
    if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging');
  });
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    addFiles([...event.dataTransfer.files]);
  });
  document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
  document.addEventListener('drop', event => { if (event.dataTransfer?.files.length) event.preventDefault(); });
  window.addEventListener('pagehide', event => {
    controller?.abort();
    if (!event.persisted && resultUrl) URL.revokeObjectURL(resultUrl);
  });
  renderList();
}
