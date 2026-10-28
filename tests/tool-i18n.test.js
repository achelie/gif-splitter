import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiTranslator } from '../src/tool-i18n.js';

test('translates exact text and dynamic placeholders without changing inserted values', () => {
  const translate = createUiTranslator({
    'Choose GIF': '選擇 GIF',
    'Frame {current} of {total}': '共 {total} 格，第 {current} 格',
    'Show more frames ({visible} of {total})': '顯示更多（{visible}/{total}）',
    'Move up {name}': '上移 {name}',
  });
  assert.equal(translate(' Choose GIF '), ' 選擇 GIF ');
  assert.equal(translate('Frame 2 of 24'), '共 24 格，第 2 格');
  assert.equal(translate('Show more frames (60 of 100)'), '顯示更多（60/100）');
  assert.equal(translate('Move up <script>'), '上移 <script>');
  assert.equal(translate('not a known message'), 'not a known message');
});
