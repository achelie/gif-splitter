export function createTranslator(locale, messages) {
  const plural = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  function t(key, values = {}) {
    let message = key.split('.').reduce((value, part) => value?.[part], messages);
    if (message && typeof message === 'object') {
      const category = plural.select(Number(values.count));
      message = message[category] ?? message.other;
    }
    if (typeof message !== 'string') throw new Error(`Missing translation: ${locale}.${key}`);
    return message.replace(/\{(\w+)\}/g, (_, name) => {
      if (!(name in values)) throw new Error(`Missing translation parameter: ${key}.${name}`);
      return typeof values[name] === 'number' ? numbers.format(values[name]) : String(values[name]);
    });
  }
  return { t, number: (value) => numbers.format(value) };
}
