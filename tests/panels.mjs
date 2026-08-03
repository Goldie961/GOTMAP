// Regression checks for the summary-panel dispatcher and the completeness
// measure. Run with: node tests/panels.mjs
//
// The layout half (does the panel fit one screen) needs a browser. This covers
// what does not: that every entity resolves to exactly one panel, that the
// panels never offer more facts than the shell will render, and that the field
// shapes the summaries read are the shapes the data actually has.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUMMARY_PANELS, resolveSummaryPanel } from '../js/ui/panels/index.js';
import { completenessBand, coverageBand, readCompletenessScore } from '../js/utils/completeness.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const fail = message => { throw new Error(message); };

const characters = readJson('data/characters/characters.json');
const locations = readJson('data/locations/locations.json');
const houses = readJson('data/houses/houses.json');
const events = readJson('data/events/events.json');

// The shell renders at most four; a panel offering more would silently drop them.
const MAX_FACTS = 4;

// ── The dispatcher is total and unambiguous ────────────────────────────────
// `matches` runs against real records in Node, where `window` does not exist —
// which is the point: a predicate that reaches for globals would throw here
// rather than in front of a reader.
const data = { characters, events };
// Mirrors DataManager: every record gets a runtime type before it reaches a panel.
const typed = (rows, fallbackType) => rows.map(row => ({ ...row, type: row.type || fallbackType }));

for (const [label, rows, expected] of [
  ['character', typed(characters.slice(0, 400), 'character'), 'character'],
  ['event', typed(events.slice(0, 400), 'event'), 'event'],
  ['house', typed(houses, 'house'), 'house'],
  ['location', locations.filter(l => ['castle', 'city', 'landmark'].includes(l.type)).slice(0, 300), 'location']
]) {
  for (const entity of rows) {
    const resolved = resolveSummaryPanel(entity, data);
    if (resolved.id !== expected) fail(`${label} ${entity.id} resolved to "${resolved.id}", expected "${expected}"`);
  }
}

// Ids are not unique across collections, so the type must outrank membership.
// These 15 houses share an id with a character and used to render as people.
const collidingIds = new Set(characters.map(character => character.id));
const collidingHouses = houses.filter(house => collidingIds.has(house.id));
if (collidingHouses.length < 10) fail(`expected the known id collisions, found ${collidingHouses.length}`);
for (const house of collidingHouses) {
  const resolved = resolveSummaryPanel({ ...house, type: house.type || 'house' }, data);
  if (resolved.id !== 'house') fail(`house ${house.id} still resolves to "${resolved.id}"`);
}

// An entity that arrives without a type still resolves, via membership.
const untyped = resolveSummaryPanel({ ...characters[0], type: null }, data);
if (untyped.id !== 'character') fail(`an untyped character resolved to "${untyped.id}"`);
if (resolveSummaryPanel({ id: 'nothing-known' }, data).id !== 'location') {
  fail('the documented fallback panel changed');
}

// ── Panels declare the hooks the shell calls ───────────────────────────────
for (const panel of SUMMARY_PANELS) {
  for (const hook of ['id', 'matches', 'kicker', 'crest', 'facts']) {
    if (panel[hook] === undefined) fail(`panel "${panel.id}" is missing ${hook}`);
  }
}

// ── The fields the summaries read are the shapes the data has ──────────────
// `born` is an array on 2204 of 2288 records; only integers are years. A summary
// that formats anything else prints a bare " AC" and makes an empty panel look
// populated.
const bornArrays = characters.filter(character => Array.isArray(character.born)).length;
const bornNumbers = characters.filter(character => typeof character.born === 'number').length;
if (bornArrays < bornNumbers) fail('`born` is no longer predominantly an array; re-check characterSummary.numericYear');

// `region` is null on every character, which is why that panel shows a house.
if (characters.some(character => character.region)) {
  fail('a character now carries a region; characterSummary can show it');
}
// `seat` and `words` live under metadata on every house that has them.
if (houses.some(house => house.seat || house.words)) {
  fail('a house now carries seat/words at the root; houseSummary reads metadata first');
}

// ── Completeness ───────────────────────────────────────────────────────────
if (completenessBand(0.85) !== 'rich') fail('0.85 must band as rich');
if (completenessBand(0.5) !== 'partial') fail('0.5 must band as partial');
if (completenessBand(0.1) !== 'sparse') fail('0.1 must band as sparse');
if (completenessBand(null) !== null) fail('an unscored record must not be given a band');
if (readCompletenessScore({}) !== null) fail('a record with no _completitudine must score null');
if (coverageBand(0, 6) !== 'sparse') fail('a page with no sections must band as sparse');
if (coverageBand(6, 6) !== 'rich') fail('a full page must band as rich');

const scored = characters.map(readCompletenessScore).filter(score => score !== null);
const below = scored.filter(score => score < 0.3).length;
const rich = scored.filter(score => score >= 0.8).length;

console.table([
  { check: 'Characters with a completeness score', actual: scored.length },
  { check: 'Scored characters below 0.3', actual: below },
  { check: 'Scored characters at or above 0.8', actual: rich },
  { check: 'Summary panels registered', actual: SUMMARY_PANELS.length },
  { check: 'Max facts the shell renders', actual: MAX_FACTS },
  { check: 'Characters whose `born` is an array', actual: bornArrays },
  { check: 'Characters whose `born` is a year', actual: bornNumbers },
  { check: 'House ids that are also character ids', actual: collidingHouses.length }
]);
console.log('\nPanel dispatcher tests passed.');
