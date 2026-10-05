export const ORIGIN = 'https://www.gifsplitter.com';
export const BRAND_NAME = 'GIF Splitter';
export const PUBLIC_CONTACT_EMAIL = 'contact@gifsplitter.com';
export const LOCALES = ['en', 'ja', 'es', 'fr', 'de', 'it', 'ko', 'pt-br', 'ru', 'zh-hant'];
export const GUIDE_TYPES = ['guide', 'transparency', 'timing', 'troubleshooting'];
export const PAGE_TYPES = ['home', ...GUIDE_TYPES, 'about', 'privacy', 'terms'];
export const PAGE_SUFFIXES = {
  home: '', guide: 'how-to-extract-gif-frames/',
  transparency: 'gif-transparency-and-disposal/', timing: 'gif-frame-timing/',
  troubleshooting: 'large-gif-extraction-troubleshooting/',
  about: 'about/', privacy: 'privacy/', terms: 'terms/',
};
export const PAGE_DATES = Object.fromEntries(PAGE_TYPES.filter(type => type !== 'home').map(type => [type, {
  published: ['guide', 'about', 'privacy'].includes(type) ? '2026-10-04' : '2026-10-05',
  modified: '2026-10-05',
}]));
export const CLOUDFLARE_BEACON_TOKEN = '57f19dd6f8204ae1bbe6c2e5a0ce64c3';
export function pagePath(locale, type = 'home') {
  if (!LOCALES.includes(locale) || !PAGE_TYPES.includes(type)) throw new Error('Unknown site route');
  return `/${locale === 'en' ? '' : `${locale}/`}${PAGE_SUFFIXES[type]}`;
}
export const ROUTES = LOCALES.flatMap(locale => PAGE_TYPES.map(type => ({ locale, type, path: pagePath(locale, type) })));
