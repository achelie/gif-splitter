import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../src/i18n.js';
import { loadLocales, validateLocale } from '../src/site/content.js';
import { LOCALES } from '../src/site/config.js';

const locales = await loadLocales();
const expectedLocales = {
  en: ['English', 'en', 'en_US'],
  ja: ['日本語', 'ja', 'ja_JP'],
  es: ['Español', 'es', 'es_ES'],
  fr: ['Français', 'fr', 'fr_FR'],
  de: ['Deutsch', 'de', 'de_DE'],
  it: ['Italiano', 'it', 'it_IT'],
  ko: ['한국어', 'ko', 'ko_KR'],
  'pt-br': ['Português', 'pt-BR', 'pt_BR'],
  ru: ['Русский', 'ru', 'ru_RU'],
  'zh-hant': ['繁體中文', 'zh-Hant', 'zh_TW'],
};

test('all ten requested languages load with consistent route and language identifiers', () => {
  assert.deepEqual(LOCALES, Object.keys(expectedLocales));
  assert.deepEqual(Object.keys(locales), Object.keys(expectedLocales));
  for (const [locale, [label, htmlLang, ogLocale]] of Object.entries(expectedLocales)) {
    assert.equal(locales[locale].locale, locale);
    assert.equal(locales[locale].label, label);
    assert.equal(locales[locale].htmlLang, htmlLang);
    assert.equal(locales[locale].ogLocale, ogLocale);
  }
});

for (const locale of Object.keys(expectedLocales)) {
  test(`${locale}: the complete dictionary validates and runtime numbers use the locale`, () => {
    const dictionary = locales[locale];
    assert.doesNotThrow(() => validateLocale(dictionary, locales.en, locale));
    const { t, number } = createTranslator(dictionary.htmlLang, dictionary);
    const format = new Intl.NumberFormat(dictionary.htmlLang, { maximumFractionDigits: 3 });
    assert.equal(number(12345.6789), format.format(12345.6789));
    const progress = t('runtime.extracting', { completed: 1234, total: 2345 });
    assert.ok(progress.includes(format.format(1234)), 'completed count must be localized');
    assert.ok(progress.includes(format.format(2345)), 'total count must be localized');
    assert.doesNotMatch(progress, /\{\w+\}/, 'runtime parameters must be resolved');
    assert.equal(t('errors.FILE_SIZE'), dictionary.errors.FILE_SIZE);
    assert.ok(t('runtime.frameAlt', { current: 1, name: '001-my-file.gif' }).includes('001-my-file.gif'));
  });
}

const invalidDictionaries = [
  {
    name: 'a missing runtime translation', locale: 'en',
    change: (dictionary) => { delete dictionary.runtime.frameLabel; },
    error: /Missing translation: en\.runtime\.frameLabel/,
  },
  {
    name: 'a missing support-page section', locale: 'en',
    change: (dictionary) => { dictionary.pages.guide.sections.pop(); },
    error: /Translation array differs: en\.pages\.guide\.sections/,
  },
  {
    name: 'an empty user-facing error', locale: 'en',
    change: (dictionary) => { dictionary.errors.NOT_GIF = '  '; },
    error: /Missing translation: en\.errors\.NOT_GIF/,
  },
  {
    name: 'a renamed interpolation parameter', locale: 'en',
    change: (dictionary) => { dictionary.runtime.frameLabel = 'Frame {index} of {total}'; },
    error: /Translation parameters differ: en\.runtime\.frameLabel/,
  },
  {
    name: 'an omitted interpolation parameter', locale: 'en',
    change: (dictionary) => { dictionary.runtime.frameLabel = 'Frame {current}'; },
    error: /Translation parameters differ: en\.runtime\.frameLabel/,
  },
  {
    name: 'duplicated interpolation parameters', locale: 'en',
    change: (dictionary) => { dictionary.runtime.frameLabel += ' {current}'; },
    error: /Translation parameters differ: en\.runtime\.frameLabel/,
  },
  {
    name: 'HTML in a translated heading', locale: 'en',
    change: (dictionary) => { dictionary.home.h1 = '<strong>GIF</strong>'; },
    error: /Translations must be plain text: en\.home\.h1/,
  },
  {
    name: 'a misspelled extra key', locale: 'en',
    change: (dictionary) => { dictionary.ui.downlodAll = 'Download'; },
    error: /Unknown translation key: en\.ui\.downlodAll/,
  },
  {
    name: 'a mismatched locale identifier', locale: 'en',
    change: (dictionary) => { dictionary.locale = 'ja'; },
    error: /Wrong locale identifier: en/,
  },
];

for (const { name, locale, change, error } of invalidDictionaries) {
  test(`dictionary validation rejects ${name}`, () => {
    const dictionary = structuredClone(locales[locale]);
    change(dictionary);
    assert.throws(() => validateLocale(dictionary, locales.en, locale), error);
  });
}

for (const category of ['one', 'few', 'many', 'other']) {
  test(`Russian validation requires the ${category} plural form`, () => {
    const dictionary = structuredClone(locales.ru);
    delete dictionary.runtime.selected[category];
    assert.throws(
      () => validateLocale(dictionary, locales.en, 'ru'),
      new RegExp(`Missing translation: ru\\.runtime\\.selected\\.${category}`),
    );
  });
}

test('every Russian plural form must retain the count parameter', () => {
  const dictionary = structuredClone(locales.ru);
  dictionary.runtime.selected.few = 'Выбрано несколько кадров';
  assert.throws(() => validateLocale(dictionary, locales.en, 'ru'), /Translation parameters differ: ru\.runtime\.selected\.few/);
});

test('Russian selection messages use correct forms for 1, 2, 5 and 21 frames', () => {
  const { t } = createTranslator('ru', locales.ru);
  assert.equal(t('runtime.selected', { count: 1 }), 'Выбран 1 кадр');
  assert.equal(t('runtime.selected', { count: 2 }), 'Выбрано 2 кадра');
  assert.equal(t('runtime.selected', { count: 5 }), 'Выбрано 5 кадров');
  assert.equal(t('runtime.selected', { count: 21 }), 'Выбран 21 кадр');
});

test('decimal formatting and string parameters remain distinct', () => {
  const { t, number } = createTranslator('de', { value: '{value}', named: '{name}: {value}' });
  assert.equal(number(1234.5), '1.234,5');
  assert.equal(t('value', { value: 1234.5 }), '1.234,5');
  assert.equal(t('value', { value: '001234.5' }), '001234.5');
  assert.equal(t('named', { name: 'a{value}.gif', value: 2 }), 'a{value}.gif: 2');
});

test('missing translation keys and parameters fail instead of silently displaying broken UI', () => {
  const { t } = createTranslator('en', locales.en);
  assert.throws(() => t('runtime.notPresent'), /Missing translation: en\.runtime\.notPresent/);
  assert.throws(() => t('runtime.frameLabel', { current: 1 }), /Missing translation parameter: runtime\.frameLabel\.total/);
});
