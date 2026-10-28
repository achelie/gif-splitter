export function createUiTranslator(dictionary) {
  const patterns = Object.entries(dictionary).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => {
    const names = [];
    let position = 0;
    let source = '^';
    for (const match of key.matchAll(/\{(\w+)\}/g)) {
      source += key.slice(position, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s\\S]+?)';
      names.push(match[1]);
      position = match.index + match[0].length;
    }
    source += key.slice(position).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
    return { regex: new RegExp(source), names, value, score: key.replace(/\{\w+\}/g, '').length };
  }).sort((a, b) => b.score - a.score);
  return function translate(value) {
    if (!value || !value.trim()) return value;
    const leading = value.match(/^\s*/)[0];
    const trailing = value.match(/\s*$/)[0];
    const text = value.trim();
    if (Object.hasOwn(dictionary, text)) return leading + dictionary[text] + trailing;
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (!match) continue;
      const values = Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]]));
      return leading + pattern.value.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder) + trailing;
    }
    return value;
  };
}

// Localize only text and accessibility attributes, never HTML. This keeps
// translated strings and user-supplied filenames out of markup injection.
export function localizeTool(root, group) {
  const node = document.getElementById('tool-messages');
  if (!node) return;
  const dictionary = JSON.parse(node.textContent)[group];
  if (!dictionary) return;
  const translate = createUiTranslator(dictionary);
  function updateText(text) {
    if (text.parentElement?.closest('#converter-file-name, #editor-file-name, .merger-file-details strong')) return;
    const result = translate(text.nodeValue);
    if (result !== text.nodeValue) text.nodeValue = result;
  }
  function updateAttributes(element) {
    for (const name of ['aria-label', 'alt']) if (element.hasAttribute(name)) {
      const oldValue = element.getAttribute(name);
      const result = translate(oldValue);
      if (result !== oldValue) element.setAttribute(name, result);
    }
  }
  function updateTree(start) {
    if (start.nodeType === Node.TEXT_NODE) { updateText(start); return; }
    if (start.nodeType !== Node.ELEMENT_NODE) return;
    updateAttributes(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) updateText(walker.currentNode);
      else updateAttributes(walker.currentNode);
    }
  }
  updateTree(root);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') updateText(record.target);
      else if (record.type === 'attributes') updateAttributes(record.target);
      else for (const child of record.addedNodes) updateTree(child);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'alt'] });
}
