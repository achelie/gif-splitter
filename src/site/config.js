export const ORIGIN = 'https://www.gifsplitter.com';
export const BRAND_NAME = 'GIF Splitter';
export const PUBLIC_CONTACT_EMAIL = 'contact@gifsplitter.com';
export const LOCALES = ['en', 'ja', 'es', 'fr', 'de', 'it', 'ko', 'pt-br', 'ru', 'zh-hant'];
export const PAGE_TYPES = ['home', 'guide', 'about', 'privacy'];
export const PAGE_SUFFIXES = { home: '', guide: 'how-to-extract-gif-frames/', about: 'about/', privacy: 'privacy/' };
export function pagePath(locale, type = 'home') {
  if (!LOCALES.includes(locale) || !PAGE_TYPES.includes(type)) throw new Error('Unknown site route');
  return `/${locale === 'en' ? '' : `${locale}/`}${PAGE_SUFFIXES[type]}`;
}
export const ROUTES = LOCALES.flatMap(locale => PAGE_TYPES.map(type => ({ locale, type, path: pagePath(locale, type) })));
