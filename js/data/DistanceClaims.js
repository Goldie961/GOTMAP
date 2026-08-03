/**
 * Reading a claim out of a narrative distance statement.
 *
 * `distances.json` holds 467 statements extracted from the Romanian
 * translations. `distance_value` is free text written by the extraction pass,
 * not a measurement: "trei mii de kilometri", "sute de leghe depărtare",
 * "nespecificată numeric", "se ajunge repede și direct". Only 20 of the 467
 * contain an Arabic digit, which is why a `\d` test badly under-reports the
 * data — Romanian spells its numerals out.
 *
 * This module turns each statement into a *claim* — an interval, a duration, a
 * direction of emphasis, or nothing — so that the panel can say whether a pair's
 * statements agree. It exists to answer one question: do these sentences make
 * the same claim about the same span? It deliberately does NOT produce the
 * number the reader is shown, and nothing here ever feeds a travel time. Those
 * come from `distanta_canonica_leghe`, which a human fills in. A parse of a POV
 * character's impression is evidence, not a measurement.
 *
 * Everything is a pure function of the statement, so tests/smoke.mjs can drive
 * it over all 467 records with no DOM.
 */

export const MILES_PER_LEAGUE = 3;
export const MILES_PER_KM = 0.621371;

/**
 * Editorial thresholds, used for one purpose only: deciding whether a statement
 * emphasises nearness or remoteness, which decides whether a badge appears.
 * They never alter a displayed figure. Stated as constants rather than buried
 * in a condition because they are judgements, not facts from the books.
 */
const FAR_LEAGUES = 100;   // 300 miles: travel measured in weeks
const NEAR_LEAGUES = 3;    // 9 miles: inside a day's ride
const FAR_DAYS = 14;
const NEAR_DAYS = 1;

const LEAGUE = 'league';
const KM = 'km';
const MILE = 'mile';

/** Diacritic folding, so "şase"/"șase" and "depărtare"/"departare" match once. */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .toLowerCase()
    .replace(/[„”"'’‘]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple numerals, folded. Only the forms that actually occur in the corpus.
const UNITS = {
  jumatate: 0.5, un: 1, unu: 1, o: 1, doi: 2, doua: 2, trei: 3, patru: 4,
  cinci: 5, sase: 6, sapte: 7, opt: 8, noua: 9, zece: 10,
  unsprezece: 11, doisprezece: 12, douasprezece: 12, treisprezece: 13,
  paisprezece: 14, cincisprezece: 15, saisprezece: 16, saptesprezece: 17,
  optsprezece: 18, nouasprezece: 19,
  douazeci: 20, treizeci: 30, patruzeci: 40, cincizeci: 50, saizeci: 60,
  saptezeci: 70, optzeci: 80, nouazeci: 90
};

const SCALES = { suta: 100, sute: 100, mie: 1000, mii: 1000 };

const LENGTH_UNITS = [
  [/\b(leghe|leghi|legha|leghea|leghelor)\b/, LEAGUE],
  [/\b(kilometri|kilometru|kilometrii|km)\b/, KM],
  [/\b(mile|mila|milelor)\b/, MILE]
];

const DURATION_UNITS = [
  [/\b(saptamani|saptamana|saptamanile)\b/, 7],
  [/\b(luni|luna|lunile)\b/, 30],
  [/\b(zile|zi|ziua)\b/, 1],
  [/\b(ore|ora|ceasuri|ceas)\b/, 1 / 24]
];

/**
 * Contexts in which a length or time unit is not the span between the two
 * places. The corpus measures the Wall's height in metres, a wall's thickness in
 * metres, a column's marching rate in kilometres per day, the spacing of
 * crucified children at one per kilometre, and the patrol interval at "din trei
 * în trei zile". Reading any of those as a distance between two settlements
 * would be a fabrication, so the match is refused outright.
 *
 * Metres need no entry: they are absent from LENGTH_UNITS, because nothing in
 * this corpus measures the span between two places in metres.
 */
const NOT_A_SPAN = /\b(inaltime|inalt|grosime|adancime|vertical|verticali|pe zi|la fiecare|proportie|latime|latimea)\b/;
const FREQUENCY = /\bdin (\w+) in \1\b|\bde \w+ ori\b/;

const NEAR_WORDS = /\b(repede|direct|degraba|imediat|proximitate|alaturi|invecinat|nu departe|floare la ureche|la o aruncatura)\b/;
const FAR_WORDS = /\b(cale lunga|drum lung|calatorie lunga|departe|indepartat|multe zile|zile in sir|mult mai lunga)\b/;

/**
 * `aproape` is two different words: "near" ("aproape de porti") and "almost"
 * ("aproape cinci sute de kilometri"). Only the first is a nearness claim, so
 * the numeral form is excluded before the lexicon is consulted.
 */
const ALMOST = /\baproape (de )?(un|o|doi|doua|trei|patru|cinci|sase|sapte|opt|noua|zece|\d|suta|sute|mie|mii)/;
const NEAR_APROAPE = /\baproape\b/;

/**
 * Read a numeral immediately to the left of `index`, composing the forms the
 * corpus actually uses: "o mie cinci sute" (1500), "doua sute cincizeci" (250),
 * "o suta saizeci" (160), "treizeci" (30), "sute" (a vague hundreds).
 *
 * Returns `{ value, scale, bound }` where `scale` is set only when the text
 * gives a bare plural — "sute de leghe" asserts a magnitude, not a number.
 */
function readNumeral(text, index) {
  // A numeral only counts when it is adjacent to the unit. Clause boundaries end
  // the search, so "zece zile; viteza — 6 kilometri" cannot lend its "zece" to
  // the kilometres in the next clause.
  const before = text.slice(0, index);
  const clause = before.slice(before.search(/[^;()—–,][^;()—–,]*$/));
  const tail = clause.trim().split(' ').filter(Boolean).slice(-6);

  // Arabic digits win outright: "163 km", "16 kilometri", "250 de kilometri".
  for (let i = tail.length - 1; i >= 0 && i >= tail.length - 3; i--) {
    const digits = tail[i].match(/^(\d+(?:[.,]\d+)?)$/);
    if (digits) return { value: Number(digits[1].replace(',', '.')), scale: null };
  }

  const FILLER = new Set(['de', 'si', 'la', 'cam', 'vreo', 'circa', 'peste', 'aproximativ', 'aproape', 'cel', 'putin', 'mai', 'mult', 'sub', 'pana']);
  let total = 0;
  let pending = null;
  let matched = false;
  let bareScale = null;

  for (const word of tail) {
    if (Object.hasOwn(UNITS, word)) {
      // "o jumătate de zi" is half a day, not one and a half: the article
      // belongs to "jumătate" rather than counting alongside it.
      if (UNITS[word] === 0.5 && pending === 1) pending = 0.5;
      else {
        if (pending !== null) total += pending;
        pending = UNITS[word];
      }
      matched = true;
      continue;
    }
    if (Object.hasOwn(SCALES, word)) {
      const scale = SCALES[word];
      if (pending === null) bareScale = scale;   // "sute de leghe": a magnitude, no count
      else { total += pending * scale; pending = null; }
      matched = true;
      continue;
    }
    if (FILLER.has(word)) continue;
    // Any other word breaks the numeral group: what came before it belongs to a
    // different phrase and must not be summed into this one.
    total = 0;
    pending = null;
    bareScale = null;
    matched = false;
  }
  if (pending !== null) total += pending;

  if (total === 0 && bareScale) return { value: null, scale: bareScale };
  if (!matched || total === 0) return { value: null, scale: null };
  return { value: total, scale: null };
}

function toLeagues(value, unit) {
  if (unit === LEAGUE) return value;
  if (unit === MILE) return value / MILES_PER_LEAGUE;
  return (value * MILES_PER_KM) / MILES_PER_LEAGUE;
}

/**
 * Parse one statement into a claim.
 *
 * @returns {{axis: 'length'|'duration'|null, unit: string|null,
 *   leagueMin: number|null, leagueMax: number|null, dayMin: number|null,
 *   dayMax: number|null, emphasis: 'near'|'far'|null, vague: boolean,
 *   bound: 'exact'|'atLeast'|'atMost'|'magnitude'|null, text: string}}
 */
export function parseDistanceClaim(statement) {
  const raw = [statement?.distance_value, statement?.travel_method]
    .filter(value => typeof value === 'string' && value.trim())
    .join(' ');
  const text = fold(raw);
  const claim = {
    axis: null, unit: null, leagueMin: null, leagueMax: null,
    dayMin: null, dayMax: null, emphasis: null, vague: false,
    bound: null, text: statement?.distance_value || ''
  };
  if (!text) return claim;

  const atLeast = /\b(peste|cel putin|mai mult de)\b/.test(text);
  const atMost = /\b(mai putin de|cel mult|sub|pana la)\b/.test(text);
  const approx = /\b(aproximativ|vreo|circa|cam|in jur de)\b/.test(text);

  // --- length ---
  for (const [pattern, unit] of LENGTH_UNITS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const window = text.slice(Math.max(0, match.index - 80), match.index + 40);
    if (NOT_A_SPAN.test(window) || FREQUENCY.test(window)) continue;
    const { value, scale } = readNumeral(text, match.index);
    if (value === null && scale === null) continue;

    claim.axis = 'length';
    claim.unit = unit;
    if (scale) {
      // "sute de leghe" is a decade-wide band, not a number. Its own bounds are
      // what the sentence asserts: at least one hundred, fewer than a thousand.
      claim.leagueMin = toLeagues(scale, unit);
      claim.leagueMax = toLeagues(scale * 10 - 1, unit);
      claim.vague = true;
      claim.bound = 'magnitude';
    } else {
      let extra = 0;
      // "un kilometru si jumatate" puts the half after the unit.
      if (/\bsi jumatate\b/.test(text.slice(match.index, match.index + 24))) extra = 0.5;
      const leagues = toLeagues(value + extra, unit);
      claim.leagueMin = atMost ? 0 : leagues;
      claim.leagueMax = atLeast ? Infinity : leagues;
      claim.bound = atLeast ? 'atLeast' : atMost ? 'atMost' : 'exact';
      claim.vague = approx;
    }
    break;
  }

  // --- duration ---
  if (!claim.axis) {
    for (const [pattern, days] of DURATION_UNITS) {
      const match = pattern.exec(text);
      if (!match) continue;
      const window = text.slice(Math.max(0, match.index - 80), match.index + 40);
      if (NOT_A_SPAN.test(window) || FREQUENCY.test(window)) continue;
      const { value, scale } = readNumeral(text, match.index);
      if (value === null && scale === null) continue;
      const half = /\bsi jumatate\b/.test(text.slice(match.index, match.index + 24)) ? 0.5 : 0;
      const count = scale ? scale : value + half;
      claim.axis = 'duration';
      claim.dayMin = atMost ? 0 : count * days;
      claim.dayMax = atLeast ? Infinity : count * days;
      claim.bound = atLeast ? 'atLeast' : atMost ? 'atMost' : scale ? 'magnitude' : 'exact';
      claim.vague = approx || Boolean(scale);
      break;
    }
  }

  // --- emphasis ---
  // Derived from the claim where one exists, from the lexicon otherwise. A
  // statement with no measurable content can still assert that the road is
  // short, which is exactly what makes it worth showing beside one that says
  // the span is hundreds of leagues.
  if (claim.axis === 'length') {
    if (claim.leagueMin >= FAR_LEAGUES) claim.emphasis = 'far';
    else if (claim.leagueMax <= NEAR_LEAGUES) claim.emphasis = 'near';
  } else if (claim.axis === 'duration') {
    if (claim.dayMin >= FAR_DAYS) claim.emphasis = 'far';
    else if (claim.dayMax <= NEAR_DAYS) claim.emphasis = 'near';
  }
  if (!claim.emphasis) {
    const nearWord = NEAR_WORDS.test(text) || (NEAR_APROAPE.test(text) && !ALMOST.test(text));
    if (nearWord && !FAR_WORDS.test(text)) claim.emphasis = 'near';
    else if (FAR_WORDS.test(text) && !nearWord) claim.emphasis = 'far';
  }

  return claim;
}

/** Two intervals describe the same claim when both ends agree within 10%. */
function sameInterval(a, b) {
  const close = (x, y) => (x === y) || (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 0.1 * Math.max(x, y, 1));
  return close(a.leagueMin, b.leagueMin) && close(a.leagueMax, b.leagueMax);
}

function disjoint(a, b) {
  return a.leagueMax < b.leagueMin || b.leagueMax < a.leagueMin;
}

/**
 * Assess a pair's statements together.
 *
 * The one thing this must never do is pick a winner or average the claims: the
 * Harrenhal–King's Landing pair carries "sute de leghe", "mii de kilometri" and
 * "se ajunge repede și direct" from three different books, and the disagreement
 * between three POV characters is itself the finding. So the return value
 * describes the disagreement and leaves every statement standing.
 *
 * @returns {{claims: Array, conflict: boolean, reasons: string[],
 *   quantified: number, measurable: boolean}}
 */
export function assessPair(statements) {
  const claims = (statements || []).map(statement => ({ statement, claim: parseDistanceClaim(statement) }));
  const lengths = claims.filter(entry => entry.claim.axis === 'length').map(entry => entry.claim);
  const durations = claims.filter(entry => entry.claim.axis === 'duration').map(entry => entry.claim);
  const reasons = [];

  for (let i = 0; i < lengths.length; i++) {
    for (let j = i + 1; j < lengths.length; j++) {
      if (disjoint(lengths[i], lengths[j])) {
        if (!reasons.includes('disjoint')) reasons.push('disjoint');
      } else if (!sameInterval(lengths[i], lengths[j])) {
        if (!reasons.includes('magnitude')) reasons.push('magnitude');
      }
    }
  }

  for (let i = 0; i < durations.length; i++) {
    for (let j = i + 1; j < durations.length; j++) {
      const a = durations[i];
      const b = durations[j];
      const ratio = Math.max(a.dayMin, b.dayMin, 0.01) / Math.max(Math.min(a.dayMax, b.dayMax), 0.01);
      if ((a.dayMax < b.dayMin || b.dayMax < a.dayMin) && ratio > 1 && !reasons.includes('duration')) {
        reasons.push('duration');
      }
    }
  }

  const hasNear = claims.some(entry => entry.claim.emphasis === 'near');
  const hasFar = claims.some(entry => entry.claim.emphasis === 'far');
  if (hasNear && hasFar) reasons.push('emphasis');

  // The extraction pass's own uncertainty markers are part of the picture, but
  // they are not a disagreement between statements and must not be reported as
  // one — they are surfaced per card instead.
  return {
    claims,
    conflict: reasons.length > 0,
    reasons,
    quantified: lengths.length + durations.length,
    measurable: lengths.length > 0
  };
}
