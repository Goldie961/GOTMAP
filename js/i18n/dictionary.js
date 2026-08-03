// L1 dictionary store: holds both language tables, resolves a key through the
// fallback chain, and counts what it could not resolve.
//
// Kept separate from index.js because the fallback chain is the part that has to
// be assertable without a DOM: tests/smoke.mjs injects the two JSON files
// directly and checks that no key rendered by the app falls through (S6/S7 of
// docs/I18N_ARHITECTURA.md §7.4).

export const LANGUAGES = ['ro', 'en'];

// Romanian is the project's source language, so it is the safety net when a key
// is absent from the active language (I18N_ARHITECTURA §3.2).
export const SOURCE_LANGUAGE = 'ro';

// The extraction pass seeded every cell it could not translate with this marker.
// Treating a marked value as *absent* rather than as a value is what keeps
// "TODO:Distance Measurements" out of the interface: the key falls back to the
// other language and is counted as missing, which is the visible defect §3.2
// asks for.
const TODO_MARKER = 'TODO:';

const dictionaries = { ro: null, en: null };

// key -> { key, requestedLang, resolvedLang } for every key that did not resolve
// in the requested language. Warned once, counted forever.
const missingKeys = new Map();
const warnedKeys = new Set();

export function isTranslated(value) {
  return typeof value === 'string' && value !== '' && !value.startsWith(TODO_MARKER);
}

export function setDictionary(lang, dict) {
  dictionaries[lang] = dict || null;
}

export function getDictionary(lang) {
  return dictionaries[lang];
}

export function hasDictionary(lang) {
  return Boolean(dictionaries[lang]);
}

export function otherLanguage(lang) {
  return lang === 'ro' ? 'en' : 'ro';
}

/**
 * Resolve a key through the fallback chain.
 *
 *   dictionary[lang][key]
 *   → dictionary[other][key]   + warn once
 *   → key                      + warn once
 *
 * @returns {{ value: string, resolvedLang: string|null, missing: boolean }}
 */
export function lookup(key, lang) {
  const direct = dictionaries[lang]?.[key];
  if (isTranslated(direct)) {
    return { value: direct, resolvedLang: lang, missing: false };
  }

  const other = otherLanguage(lang);
  const fallback = dictionaries[other]?.[key];
  if (isTranslated(fallback)) {
    recordMissing(key, lang, other);
    return { value: fallback, resolvedLang: other, missing: true };
  }

  recordMissing(key, lang, null);
  return { value: key, resolvedLang: null, missing: true };
}

function recordMissing(key, requestedLang, resolvedLang) {
  const id = `${requestedLang}:${key}`;
  if (missingKeys.has(id)) return;
  missingKeys.set(id, { key, requestedLang, resolvedLang });

  if (warnedKeys.has(id)) return;
  warnedKeys.add(id);
  console.warn(
    resolvedLang
      ? `[i18n] Missing "${key}" in ${requestedLang}; fell back to ${resolvedLang}.`
      : `[i18n] Missing "${key}" in every language; rendering the raw key.`
  );
}

export function getMissingKeys() {
  return [...missingKeys.values()];
}

export function getMissingKeyCount() {
  return missingKeys.size;
}

export function resetMissingKeys() {
  missingKeys.clear();
  warnedKeys.clear();
}

/**
 * Symmetric-difference of the two key sets. Empty is the invariant asserted by
 * S6: en.json and ro.json are the same key set by construction (§3.1).
 */
export function compareKeySets() {
  const ro = new Set(Object.keys(dictionaries.ro || {}));
  const en = new Set(Object.keys(dictionaries.en || {}));
  return {
    onlyInRo: [...ro].filter(key => !en.has(key)),
    onlyInEn: [...en].filter(key => !ro.has(key))
  };
}

/** Keys still carrying the extraction marker, per language. */
export function getUntranslatedKeys(lang) {
  const dict = dictionaries[lang] || {};
  return Object.keys(dict).filter(key => !isTranslated(dict[key]));
}
