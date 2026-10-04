import { readFile } from 'node:fs/promises';
import { LOCALES } from './config.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');

export function validateLocale(data, reference, locale) {
  if (data.locale !== locale) throw new Error(`Wrong locale identifier: ${locale}`);
  const categories = new Intl.PluralRules(data.htmlLang).resolvedOptions().pluralCategories;
  function walk(value, sample, path) {
    if (typeof sample === 'string') {
      if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing translation: ${locale}.${path}`);
      if (placeholders(value) !== placeholders(sample)) throw new Error(`Translation parameters differ: ${locale}.${path}`);
      if (/[<>]/.test(value)) throw new Error(`Translations must be plain text: ${locale}.${path}`);
    } else if (Array.isArray(sample)) {
      if (!Array.isArray(value) || value.length !== sample.length) throw new Error(`Translation array differs: ${locale}.${path}`);
      sample.forEach((item, i) => walk(value[i], item, `${path}.${i}`));
    } else {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Missing translation group: ${locale}.${path}`);
      if (typeof sample.one === 'string' && typeof sample.other === 'string') {
        for (const category of new Set(['one', 'other', ...categories])) walk(value[category], sample.other, `${path}.${category}`);
      } else {
        for (const key of Object.keys(sample)) walk(value[key], sample[key], path ? `${path}.${key}` : key);
        for (const key of Object.keys(value)) if (!(key in sample)) throw new Error(`Unknown translation key: ${locale}.${path}.${key}`);
      }
    }
  }
  walk(data, reference, '');
}

export async function loadLocales() {
  const entries = await Promise.all(LOCALES.map(async locale => [locale, JSON.parse(await readFile(new URL(`../locales/${locale}.json`, import.meta.url), 'utf8'))]));
  const locales = Object.fromEntries(entries);
  for (const locale of LOCALES) validateLocale(locales[locale], locales.en, locale);
  return locales;
}
