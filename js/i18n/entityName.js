// L2 — entity names. Resolves which string to *show* for an entity in a given
// interface language, and says whether that string needs a language badge.
//
// Deliberately free of DOM and of any import from index.js: SearchEngine runs
// this module under Node in tests/smoke.mjs, and index.js imports it back.

/**
 * Strip Romanian diacritics for comparison only — never for display.
 *
 * NFD decomposition covers the whole set: ă/â → a + combining breve/circumflex,
 * î → i, and both the comma-below (ș U+0219) and the cedilla (ş U+015F) spellings
 * of s/t decompose to a bare letter plus a combining mark. 2282 of 5298 named
 * entities carry at least one of these, so an English keyboard cannot reach them
 * without this (INV-S2, §7.1).
 */
export function foldDiacritics(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Lowercase + fold + collapse whitespace. The only form search ever compares. */
export function normalizeForSearch(value) {
  return foldDiacritics(String(value ?? '')).toLowerCase().trim().replace(/\s+/g, ' ');
}

// The diacritic test alone under-counts Romanian by roughly 60% (§11.3):
// "Adăpostul Pietruit" has one, "Bătrânul Flint" has one, but "Casele Slate" and
// "Aegon al III-lea" do not. Definite-article morphology and connectives are what
// catch the rest.
const RO_DIACRITICS = /[ăâîșțşţ]/i;
const RO_ARTICLE = /\b[a-zăâîșțşţ]{3,}(ul|ului|ilor|ele|elor|urile|urilor|uri)\b/i;
const RO_CONNECTIVE = /\b(al|ale|ai|din|dintre|de|lui|cel|cea|cei|cele|celor|și|si|către|catre|fără|fara|pentru|asupra|peste)\b/i;

// Kept narrow on purpose. A false "en" reading puts a badge on a Romanian name;
// a false "neutral" reading only omits one.
const EN_MARKER = /(\b(the|of|and|house|upon|at|by)\b|['’]s\b)/i;

/**
 * @returns {'ro'|'en'|'mixed'|'neutral'}
 *
 * `neutral` is the important bucket: 2012 of 5668 names — Winterfell,
 * Casterly Rock, Arya Stark — are identical in both languages and must render
 * with no badge in either interface (§1.1).
 */
export function detectLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) return 'neutral';
  const hasRo = RO_DIACRITICS.test(text) || RO_ARTICLE.test(text) || RO_CONNECTIVE.test(text);
  const hasEn = EN_MARKER.test(text);
  if (hasRo && hasEn) return 'mixed';
  if (hasRo) return 'ro';
  if (hasEn) return 'en';
  return 'neutral';
}

/**
 * The verbatim string as extracted, before any language resolution.
 * `objects.json` and `titles.json` use `nume` rather than `name`; masking that
 * here is what lets every call site read one function instead of a `||` chain.
 */
export function rawName(entity) {
  if (!entity || typeof entity !== 'object') return '';
  const candidates = [entity.name, entity.nume_canonic, entity.nume, entity.nume_generat];
  return candidates.find(value => typeof value === 'string' && value.trim()) || '';
}

function localizedField(entity, prefix, lang) {
  const value = entity?.[`${prefix}_${lang}`];
  return (typeof value === 'string' && value.trim()) ? value.trim() : null;
}

/**
 * §4.2 — the fallback ladder, in order. Never transliterates, never hides an
 * entity for lacking a name in the active language, never returns empty.
 *
 * @returns {{ text: string, lang: string, badgeLang: string|null, source: string }}
 *   `badgeLang` is non-null exactly when the string shown is not in the
 *   interface language — that badge is the unit in which translation progress
 *   is measured (§4.2), so it must not be suppressed.
 */
export function resolveName(entity, lang) {
  if (!entity || typeof entity !== 'object') {
    return { text: '', lang: 'neutral', badgeLang: null, source: 'none' };
  }
  const other = lang === 'ro' ? 'en' : 'ro';

  // 1. Written for this language.
  const own = localizedField(entity, 'name', lang);
  if (own) return { text: own, lang, badgeLang: null, source: 'field' };

  const raw = rawName(entity);
  const rawLang = detectLanguage(raw);

  // 2. Same string in both languages — no translation was ever needed.
  if (raw && rawLang === 'neutral') {
    return { text: raw, lang: 'neutral', badgeLang: null, source: 'neutral' };
  }

  // 3. Written for the other language: show it verbatim, badged. A reader on the
  //    EN interface can look that exact string up in the Romanian edition on
  //    their shelf; an invented equivalent matches no edition at all.
  const foreign = localizedField(entity, 'name', other);
  if (foreign) return { text: foreign, lang: other, badgeLang: other, source: 'field' };

  // 4. The raw extracted string.
  if (raw) {
    return {
      text: raw,
      lang: rawLang,
      badgeLang: rawLang === lang || rawLang === 'neutral' ? null : rawLang,
      source: 'raw'
    };
  }

  // 5. Never empty.
  return { text: String(entity.id ?? ''), lang: 'unknown', badgeLang: 'unknown', source: 'id' };
}

/** The string alone. This is what replaces every bare `entity.name` read. */
export function displayName(entity, lang) {
  return resolveName(entity, lang).text;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

/**
 * Aliases for display in the active language. Falls back to the frozen
 * `aliasuri` source field, which is what every entity still has today.
 * `aliases_unclassified` is indexed for search but never displayed (§4.1).
 */
export function resolveAliases(entity, lang) {
  if (!entity || typeof entity !== 'object') return [];
  const own = toArray(entity[`aliases_${lang}`]);
  if (own.length) return own;
  const other = toArray(entity[`aliases_${lang === 'ro' ? 'en' : 'ro'}`]);
  if (other.length) return other;
  return toArray(entity.aliasuri).filter(alias => typeof alias === 'string' && alias.trim());
}

/** Every alias-ish string, all languages, for the search index (INV-S1). */
export function allAliases(entity) {
  if (!entity || typeof entity !== 'object') return [];
  return [
    ...toArray(entity.aliasuri),
    ...toArray(entity.aliases),
    ...toArray(entity.aliases_ro),
    ...toArray(entity.aliases_en),
    ...toArray(entity.aliases_unclassified)
  ];
}
