import { PAGE_SUFFIXES, pagePath } from './config.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localHref = (href, locale) => {
  const match = Object.entries(PAGE_SUFFIXES).find(([, suffix]) => `/${suffix}` === href);
  return match ? pagePath(locale, match[0]) : href;
};

/** Translate a trusted English tool template using plain-text locale values. */
export function localizeToolMarkup(html, locale, type, tools) {
  const translations = tools.pages[type].strings;
  const translated = (source) => {
    if (!Object.hasOwn(translations, source)) throw new Error(`Missing ${type} source string: ${source}`);
    return translations[source];
  };
  const paragraphs = [];
  // Translate entire paragraphs around links as one sentence, so languages
  // may reorder link placeholders rather than being forced into English order.
  html = html.replace(/<p>([\s\S]*?)<\/p>/g, (full, inner) => {
    if (!inner.includes('<a ')) return full;
    const anchors = [];
    const source = inner.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, (_, href, text) => {
      anchors.push(`<a href="${escape(localHref(href, locale))}">${escape(translated(text))}</a>`);
      return `{link${anchors.length - 1}}`;
    });
    const body = escape(translated(source)).replace(/\{link(\d+)\}/g, (_, index) => {
      if (!anchors[Number(index)]) throw new Error(`Invalid link placeholder in ${type}`);
      return anchors[Number(index)];
    });
    const marker = `\u0001${paragraphs.length}\u0002`;
    paragraphs.push(`<p>${body}</p>`);
    return marker;
  });
  html = html.replace(/aria-label="([^"]+)"/g, (_, source) => `aria-label="${escape(translated(source))}"`);
  html = html.replace(/>([^<>]+)(?=<)/g, (full, text) => {
    const source = text.trim();
    if (!source || /^[\d\s.+–—-]+$/.test(source) || /^\u0001\d+\u0002$/.test(source)) return full;
    const leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
    return `>${leading}${escape(translated(source))}${trailing}`;
  });
  html = html.replace(/href="(\/[^"#?]*)"/g, (_, href) => `href="${escape(localHref(href, locale))}"`);
  return html.replace(/\u0001(\d+)\u0002/g, (_, index) => paragraphs[Number(index)]);
}
