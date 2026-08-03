// Provenance, folded.
//
// Every claim in the dataset carries the book, the fragment and the page range
// it was extracted from, and that is the project's actual asset. The defect was
// never that the citations exist — it is that each one was printed in full,
// inline, next to the claim it supports. A character page therefore repeated the
// same 300-character page list sixteen times, and because only 34 of 2288
// characters have a `description`, provenance was most of what the panel showed.
//
// This module is the pure half of the fix: it reads the several shapes a source
// record takes in the data, folds them per book, and splits the claims that the
// extraction pass concatenated into a single string. No DOM, no i18n — the
// wording lives in js/ui/SourceCite.js so this stays assertable from node.

// The extraction wrote provenance under both the English and the Romanian field
// names, and at two nesting levels; none of these is more canonical than another.
const BOOK_KEYS = ['source_book', 'book', 'carte'];
const FRAGMENT_KEYS = ['source_fragment', 'fragment'];
const PAGE_KEYS = ['source_page', 'page', 'pagina', 'pagini'];
const SOURCE_LIST_KEYS = ['surse', 'sources', 'surse_combinate'];

const URL_PATTERN = /^https?:\/\//i;

// `(din Fragment 4.3)` is the marker the extraction pass left behind when it
// merged several sourced readings of the same field into one string.
const FRAGMENT_MARKER = /\s*\(\s*din\s+Fragment\s+([^)]+?)\s*\)\s*$/i;
const HAS_FRAGMENT_MARKER = /\(\s*din\s+Fragment\s/i;

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/** Page ranges arrive as one comma-separated string: "380–381, 392–393, 402". */
export function parsePages(value) {
  if (value === null || value === undefined) return [];
  return String(value)
    .split(',')
    .map(page => page.trim())
    .filter(Boolean);
}

/** Numeric where it can be, lexical where it cannot ("nespecificată (Anexă)"). */
function comparePages(a, b) {
  const numberA = Number.parseInt(a, 10);
  const numberB = Number.parseInt(b, 10);
  if (Number.isNaN(numberA) && Number.isNaN(numberB)) return a.localeCompare(b);
  if (Number.isNaN(numberA)) return 1;
  if (Number.isNaN(numberB)) return -1;
  return numberA - numberB || a.localeCompare(b);
}

/**
 * @returns {{book: string|null, fragment: string|null, pages: string[], url: string|null,
 *            confidence: string|null}|null} null when the record cites nothing.
 */
export function normalizeSource(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    return URL_PATTERN.test(text)
      ? { book: null, fragment: null, pages: [], url: text, confidence: null }
      : { book: text, fragment: null, pages: [], url: null, confidence: null };
  }
  if (typeof raw !== 'object') return null;

  const book = firstValue(raw, BOOK_KEYS);
  const fragment = firstValue(raw, FRAGMENT_KEYS);
  const pages = parsePages(firstValue(raw, PAGE_KEYS));
  // `source` and `sursa` hold a wiki link on some records and a book title on
  // others; only the former is safe to render as a link.
  const loose = firstValue(raw, ['url', 'source', 'sursa']);
  const url = loose && URL_PATTERN.test(loose) ? loose : null;
  const looseBook = loose && !url ? loose : null;

  if (!book && !looseBook && !fragment && !pages.length && !url) return null;
  return {
    book: book || looseBook,
    fragment,
    pages,
    url,
    confidence: firstValue(raw, ['confidence', 'incredere'])
  };
}

function sourceKey(source) {
  return [source.book, source.fragment, source.pages.join('|'), source.url].join('§');
}

export function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    if (!source) continue;
    const key = sourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/**
 * Every citation attached to `record`, looking at the record's own provenance
 * fields and at each of the list fields that hold nested ones. `fallback` is
 * consulted only when the record cites nothing of its own, so an entity-level
 * source never silently masquerades as a per-claim one.
 */
export function collectSources(record, fallback) {
  const visit = holder => {
    if (!holder || typeof holder !== 'object' || Array.isArray(holder)) return [];
    const found = [normalizeSource(holder)];
    for (const key of SOURCE_LIST_KEYS) {
      const list = holder[key];
      if (!list) continue;
      (Array.isArray(list) ? list : [list]).forEach(entry => found.push(normalizeSource(entry)));
    }
    return found.filter(Boolean);
  };

  const own = dedupeSources(visit(record));
  return own.length ? own : dedupeSources(visit(fallback));
}

/**
 * One entry per book, so three claims out of the same volume read as
 * "Foc și Sânge — p. 120, 145, 200" instead of three identical paragraphs.
 * @returns {{book: string|null, fragments: string[], pages: string[], urls: string[], count: number}[]}
 */
export function groupSourcesByBook(sources) {
  const groups = new Map();
  for (const source of sources || []) {
    if (!source) continue;
    const key = source.book || '';
    if (!groups.has(key)) {
      groups.set(key, { book: source.book || null, fragments: [], pages: [], urls: [], count: 0 });
    }
    const group = groups.get(key);
    group.count += 1;
    if (source.fragment && !group.fragments.includes(source.fragment)) group.fragments.push(source.fragment);
    for (const page of source.pages) if (!group.pages.includes(page)) group.pages.push(page);
    if (source.url && !group.urls.includes(source.url)) group.urls.push(source.url);
  }
  return [...groups.values()].map(group => ({
    ...group,
    fragments: [...group.fragments].sort(comparePages),
    pages: [...group.pages].sort(comparePages)
  }));
}

/**
 * Split a field that the extraction pass concatenated from several sourced
 * readings. Splitting is attempted only when a `(din Fragment N)` marker is
 * present: without one a semicolon is ordinary punctuation inside a single
 * sentence, and splitting on it would mangle the text.
 * @returns {{text: string, fragment: string|null}[]}
 */
export function splitConcatenatedClaim(text) {
  if (typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!HAS_FRAGMENT_MARKER.test(trimmed)) return [{ text: trimmed, fragment: null }];

  return trimmed
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = part.match(FRAGMENT_MARKER);
      return match
        ? { text: part.replace(FRAGMENT_MARKER, '').trim(), fragment: match[1].trim() }
        : { text: part, fragment: null };
    })
    .filter(part => part.text);
}

/**
 * The readings of one claim, each with the sources that support it. `moarte` is
 * the field this exists for: it routinely holds contradictory readings — alive
 * at the end of one fragment, dead in another — which used to be rendered as a
 * single run-on paragraph that read as one incoherent statement.
 * @returns {{text: string, sources: object[], confidence: string|null}[]}
 */
export function collectClaimVariants(claim) {
  if (!claim || typeof claim !== 'object') return [];

  const claimSources = collectSources(claim);
  const claimBook = claimSources.find(source => source.book)?.book || null;
  const out = [];

  const add = (text, sources, confidence) => {
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value || out.some(variant => variant.text === value)) return;
    out.push({
      text: value,
      sources: dedupeSources((sources || []).filter(Boolean)),
      confidence: confidence || null
    });
  };

  const addReadings = (text, base, confidence) => {
    for (const part of splitConcatenatedClaim(text)) {
      // A fragment marker attributes that reading specifically; without one the
      // reading inherits whatever the surrounding record cites.
      const sources = part.fragment
        ? [{ book: base?.book || claimBook, fragment: part.fragment, pages: base?.pages || [], url: null, confidence: null }]
        : (base ? [base] : claimSources);
      add(part.text, sources, confidence);
    }
  };

  addReadings(claim.descriere ?? claim.description, null, claim.confidence);

  const alternatives = Array.isArray(claim.variante) ? claim.variante : [];
  for (const entry of alternatives) {
    if (typeof entry === 'string') {
      addReadings(entry, null, claim.confidence);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    addReadings(entry.descriere ?? entry.description, normalizeSource(entry), entry.confidence || claim.confidence);
  }

  return out;
}
