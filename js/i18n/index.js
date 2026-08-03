// Public i18n API. `t()` is synchronous and pure: no promise, no await at any
// call site. The price is an ordering constraint — the dictionaries must be
// loaded before anything renders — and it is paid once, in app.init().

import {
  LANGUAGES,
  SOURCE_LANGUAGE,
  lookup,
  setDictionary,
  hasDictionary,
  getMissingKeyCount,
  getMissingKeys,
  resetMissingKeys,
  compareKeySets
} from './dictionary.js';
import { resolveName, resolveAliases as resolveEntityAliases, detectLanguage, foldDiacritics, normalizeForSearch } from './entityName.js';

export { LANGUAGES, SOURCE_LANGUAGE, getMissingKeyCount, getMissingKeys, resetMissingKeys, compareKeySets };
export { detectLanguage, foldDiacritics, normalizeForSearch };

// Prefixed because admin/map-editor.html shares the localhost origin.
const STORAGE_KEY = 'atlas.lang';
const CHANGE_EVENT = 'atlas:languagechange';

let currentLanguage = SOURCE_LANGUAGE;
const listeners = new Set();

export function getLanguage() {
  return currentLanguage;
}

export function isSupported(lang) {
  return LANGUAGES.includes(lang);
}

/**
 * Translate an L1 key. Missing keys fall back to the other language and are
 * counted; see dictionary.js for the chain.
 *
 * Interpolation is `{name}` only — no ICU, no plural morphology. None of the
 * measured interface strings depend on grammatical number (§6.2).
 */
export function t(key, params) {
  const { value } = lookup(key, currentLanguage);
  if (!params || typeof params !== 'object') return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

/** The name to show for an entity, in the active language (§4.2). */
export function displayName(entity, lang = currentLanguage) {
  return resolveName(entity, lang).text;
}

/** The same resolution, with the badge information the UI needs. */
export function nameDescriptor(entity, lang = currentLanguage) {
  return resolveName(entity, lang);
}

/** Aliases to display, in the active language (§4.1). */
export function resolveAliases(entity, lang = currentLanguage) {
  return resolveEntityAliases(entity, lang);
}

/**
 * Startup order (§6.3): an explicit URL parameter wins so links stay shareable,
 * then the stored choice, then the browser, then the project's source language.
 */
export function detectInitialLanguage() {
  if (typeof window !== 'undefined') {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('lang');
      if (isSupported(fromUrl)) return fromUrl;
    } catch { /* malformed query string is not a reason to fail startup */ }
  }
  const stored = readStoredLanguage();
  if (isSupported(stored)) return stored;
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('ro') ? 'ro' : 'en';
  }
  return SOURCE_LANGUAGE;
}

function readStoredLanguage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(lang) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* private browsing: the choice simply does not survive the session */ }
}

/**
 * Load both dictionaries and fix the starting language.
 *
 * Both are loaded, not just the active one, because the fallback chain reads the
 * other language on every missing key. A failure here throws: a missing en.json
 * must be a visible, fatal error rather than a console line under a loading
 * screen that never ends (§6.4).
 */
export async function init(options = {}) {
  const basePath = options.basePath || '';
  const dictionaries = await Promise.all(LANGUAGES.map(async lang => {
    const url = `${basePath}i18n/${lang}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return [lang, await response.json()];
  }));
  dictionaries.forEach(([lang, dict]) => setDictionary(lang, dict));

  const lang = isSupported(options.lang) ? options.lang : detectInitialLanguage();
  applyLanguage(lang, { persist: false, notify: false });
  return currentLanguage;
}

/**
 * Synchronous injection for Node and for tests, which read the JSON off disk
 * rather than over fetch.
 */
export function setDictionaries(dictionaries = {}, lang = currentLanguage) {
  LANGUAGES.forEach(code => {
    if (dictionaries[code]) setDictionary(code, dictionaries[code]);
  });
  if (isSupported(lang)) applyLanguage(lang, { persist: false, notify: false });
}

/**
 * Switch language: persist the choice, update `<html lang>`, notify subscribers.
 * Re-rendering is the subscriber's job — see AtlasApp.applyLanguage.
 */
export function setLanguage(lang) {
  if (!isSupported(lang)) {
    console.warn(`[i18n] Unsupported language "${lang}"; keeping ${currentLanguage}.`);
    return currentLanguage;
  }
  if (lang === currentLanguage) return currentLanguage;
  applyLanguage(lang, { persist: true, notify: true });
  return currentLanguage;
}

function applyLanguage(lang, { persist, notify }) {
  currentLanguage = lang;

  // Hyphenation, screen-reader pronunciation and font fallback all key off this.
  // index.html ships `lang="ro"`; this keeps it honest after every switch (§6.6).
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  if (persist) writeStoredLanguage(lang);
  if (!notify) return;

  listeners.forEach(listener => {
    try {
      listener(lang);
    } catch (error) {
      console.error('[i18n] Language change listener failed:', error);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { lang } }));
  }
}

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLanguageChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isReady() {
  return LANGUAGES.every(hasDictionary);
}

if (typeof window !== 'undefined') {
  window.atlasI18n = { t, getLanguage, setLanguage, displayName, getMissingKeys };
}
