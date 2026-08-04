// Data-driven smoke test: run with `node tests/smoke.mjs`.
// It deliberately reads the same datasets as DataManager, but from disk so it
// remains useful before a browser or local server has been started.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMappableLocation } from '../js/data/DataManager.js';
import { SearchEngine } from '../js/data/SearchEngine.js';
import { normalizeInternIds, resolveSeat, toInternIds } from '../js/utils/entities.js';
import { assessPair, parseDistanceClaim, MILES_PER_LEAGUE } from '../js/data/DistanceClaims.js';
import { travelTime } from '../js/utils/coordinates.js';
import { isCharacterEntity, isEventEntity } from '../js/utils/entityKind.js';
import { stripEntityPrefix } from '../js/utils/helpers.js';
import {
  setDictionaries, setLanguage, getLanguage, t, displayName,
  getMissingKeys, resetMissingKeys, compareKeySets, LANGUAGES
} from '../js/i18n/index.js';
import { isTranslated } from '../js/i18n/dictionary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));

const temp = {
  locations: readJson('data/locations/locations.json'),
  houses: readJson('data/houses/houses.json'),
  characters: readJson('data/characters/characters.json'),
  dragons: readJson('data/dragons/dragons.json'),
  events: readJson('data/events/events.json'),
  objects: readJson('data/objects/objects.json'),
  titles: readJson('data/titles/titles.json'),
  distances: readJson('data/locations/distances.json'),
  essosLocations: readJson('data/essos/free_cities.json'),
  essosFactions: readJson('data/essos/free_cities_factions.json'),
  essosEvents: readJson('data/essos/free_cities_events.json'),
  farLands: readJson('data/essos/far_lands.json'),
  mapCatalog: readJson('data/map/catalog.json'),
  worldFeatures: readJson('data/map/world_features.json'),
  timeline: readJson('data/timeline/year_1.json'),
  // Read here rather than only where it is asserted: DataManager.loadAll fetches
  // this file alongside the other sixteen, so a missing or untracked eras.json
  // has to fail the test the same way it fails a fresh clone in the browser.
  eras: readJson('data/timeline/eras.json')
};

// P1.3's 875-event milestone refers to the core event export; Essos adds its
// own seven records later in the runtime merge.
const coreEvents = temp.events;
temp.locations = [...temp.locations, ...temp.essosLocations, ...temp.farLands];
temp.houses = [...temp.houses, ...temp.essosFactions];
temp.events = [...temp.events, ...temp.essosEvents];

// Keep this in lockstep with DataManager.mapCompatibility. It is intentionally
// local to make the test exercise the runtime shape rather than raw JSON only.
const seatFields = entity => {
  const raw = entity?.seat ?? entity?.metadata?.seat;
  if (raw === undefined) return {};
  const { id, sources } = resolveSeat(raw);
  return { seat: id, seat_sources: sources };
};
const mapCompatibility = entity => ({
  ...entity,
  ...entity.metadata,
  ...(Object.hasOwn(entity, 'id_intern') ? { id_intern: toInternIds(entity.id_intern) } : {}),
  ...seatFields(entity),
  region: entity.region,
  timeline: (entity.type === 'house' && entity.metadata)
    ? (entity.metadata.timeline || [])
    : (entity.type === 'faction' || entity.type === 'institution')
      ? (entity.history || [])
      : (entity.ownership_history || [])
});

const data = {
  castles: temp.locations.filter(l => l.type === 'stronghold' || l.type === 'castle' || l.type === 'fortress').map(mapCompatibility),
  cities: temp.locations.filter(l => l.type === 'settlement' || l.type === 'city' || l.type === 'town').map(mapCompatibility),
  landmarks: temp.locations.filter(l => l.type !== 'non_place' && l.type !== 'stronghold' && l.type !== 'castle' && l.type !== 'fortress' && l.type !== 'settlement' && l.type !== 'city' && l.type !== 'town' && l.type !== 'location').map(mapCompatibility),
  houses: temp.houses.map(mapCompatibility),
  characters: temp.characters.map(character => normalizeInternIds({ ...character, type: character.type || 'character' })),
  dragons: temp.dragons.map(normalizeInternIds),
  events: temp.events.map(normalizeInternIds),
  objects: temp.objects.map(mapCompatibility),
  titles: temp.titles.map(mapCompatibility),
  mapCatalog: temp.mapCatalog,
  worldFeatures: temp.worldFeatures.features || [],
  distances: temp.distances,
  timeline: { 1: temp.timeline }
};

// Imported rather than re-stated: this predicate now also decides which
// locations the anchor resolver treats as marker-bearing, and a local copy that
// drifted would make the test agree with itself and disagree with the app.
const getAllLocations = () => [...data.castles, ...data.cities, ...data.landmarks].filter(isMappableLocation);
const allLocationIds = new Set(temp.locations.map(location => location.id));

// Mirrors DataManager.getMappableAnchor / isRenderedByAncestor against the same
// index the app builds, so the containment rule is exercised without a browser.
const locationIndex = new Map();
for (const list of [data.landmarks, data.cities, data.castles]) {
  for (const location of list) if (location?.id) locationIndex.set(location.id, location);
}
const mappableAnchor = idOrLocation => {
  let location = typeof idOrLocation === 'string' ? locationIndex.get(idOrLocation) : idOrLocation;
  const seen = new Set();
  let anchor = null;
  for (let depth = 0; location && depth <= 8; depth++) {
    if (isMappableLocation(location)) anchor = location;
    if (!location.parent_id || seen.has(location.id)) break;
    seen.add(location.id);
    location = locationIndex.get(location.parent_id);
  }
  return anchor;
};
const isRenderedByAncestor = location =>
  Boolean(location?.parent_id) && mappableAnchor(location)?.id !== location.id;
const houseIds = new Set(data.houses.map(house => house.id));

const predicateFailures = [];
const entityGroups = [
  ['location', getAllLocations()],
  ['character', data.characters],
  ['house', data.houses],
  ['event', data.events],
  ['object', data.objects],
  ['title', data.titles]
];

for (const [kind, entities] of entityGroups) {
  for (const entity of entities) {
    const failedPredicates = [];
    for (const [name, predicate] of [
      ['InfoPanel.isCharacter', () => isCharacterEntity(entity, data.characters)],
      ['InfoPanel.isEvent', () => isEventEntity(entity, data.events)],
      ['WikiPage.render.isCharacter', () => isCharacterEntity(entity, data.characters)]
    ]) {
      try {
        predicate();
      } catch (error) {
        failedPredicates.push(`${name}: ${error.message}`);
      }
    }
    if (failedPredicates.length) {
      predicateFailures.push({
        kind,
        id: entity.id || '(missing id)',
        predicates: failedPredicates.join(' | ')
      });
    }
  }
}

// ── i18n (docs/I18N_ARHITECTURA.md §7.4) ───────────────────────────────────
// The dictionaries are read from disk rather than over fetch; everything else
// exercises the same code paths the browser runs.
const dictionaries = Object.fromEntries(LANGUAGES.map(lang => [lang, readJson(`i18n/${lang}.json`)]));
setDictionaries(dictionaries, 'ro');

const i18nFailures = [];

// S6 — the two dictionaries are the same key set by construction (§3.1).
const keySets = compareKeySets();
if (keySets.onlyInRo.length || keySets.onlyInEn.length) {
  i18nFailures.push({
    check: 'S6 dictionary key sets',
    detail: `only in ro: ${keySets.onlyInRo.join(', ') || '—'} | only in en: ${keySets.onlyInEn.join(', ') || '—'}`
  });
}

// S8 — every key the *source* asks for exists in the dictionaries.
//
// S7 below walks the dictionary and checks each key resolves, which can only
// find keys that are already there. It cannot see a key the code calls and the
// dictionary lacks — and that is the direction the bug actually goes: a renamed
// key shipped `t('distance.selectBoth')` against a dictionary that had
// `distance.selectLocations`, and the panel rendered the raw key. Scanning the
// call sites is what closes that gap.
const sourceFiles = [];
const collectSources = directory => {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collectSources(relative);
    else if (entry.name.endsWith('.js')) sourceFiles.push(relative);
  }
};
collectSources('js');

const referencedKeys = new Map();
for (const relative of sourceFiles) {
  const source = readFileSync(join(root, relative), 'utf8');
  // Literal keys only. A computed key — t(`distance.unit.${claim.unit}`) — is
  // checked by expanding its known suffixes below rather than guessed at here.
  for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!referencedKeys.has(match[1])) referencedKeys.set(match[1], relative);
  }
}
// Template-literal keys whose suffixes are enumerable from the data model.
for (const prefix of ['distance.unit.', 'distance.emphasis.', 'distance.conflictReason.', 'distance.endpoint.']) {
  for (const key of Object.keys(dictionaries.ro).filter(candidate => candidate.startsWith(prefix))) {
    if (!referencedKeys.has(key)) referencedKeys.set(key, '(computed)');
  }
}
for (const [key, where] of referencedKeys) {
  for (const lang of LANGUAGES) {
    if (!isTranslated(dictionaries[lang][key])) {
      i18nFailures.push({ check: `S8 key used in source is missing (${lang})`, detail: `${key} — ${where}` });
    }
  }
}

// S7 — every key the application renders resolves in both languages. admin/ is
// excluded on purpose: it stays Romanian-only (§3.4).
const appKeys = Object.keys(dictionaries.ro).filter(key => !key.startsWith('editor.'));
for (const lang of LANGUAGES) {
  resetMissingKeys();
  setLanguage(lang);
  appKeys.forEach(key => t(key));
  const missing = getMissingKeys();
  if (missing.length) {
    i18nFailures.push({
      check: `S7 missing L1 keys (${lang})`,
      detail: `${missing.length}: ${missing.slice(0, 5).map(entry => entry.key).join(', ')}`
    });
  }
}
resetMissingKeys();
setLanguage('ro');

const search = new SearchEngine();
search.buildIndex({ data, getAllLocations });
const searchByType = search.index.reduce((counts, entry) => {
  counts[entry.type] = (counts[entry.type] || 0) + 1;
  return counts;
}, {});

// S1–S3 — the index is bilingual and diacritic-insensitive in both interface
// languages. INV-S1: the same queries must succeed whatever the UI language is.
const findsKingsLanding = query => search.search(query).some(result => result.id === 'kings_landing');
const searchProbes = [
  ['S1 search("King\'s Landing")', "King's Landing"],
  // Reaches the entity only through `id_intern`, which carries the Romanian
  // form; §7.3 documents that as intentional rather than accidental.
  ['S2 search("Debarcaderul Regelui")', 'Debarcaderul Regelui'],
  // INV-S2: typed on an English keyboard, no diacritics — "Fortăreața Roșie".
  ['S3 search("Fortareata Rosie")', 'Fortareata Rosie']
];
for (const lang of LANGUAGES) {
  setLanguage(lang);
  search.refreshDisplayNames(lang);
  for (const [label, query] of searchProbes) {
    if (!findsKingsLanding(query)) i18nFailures.push({ check: `${label} @${lang}`, detail: 'kings_landing not in results' });
  }
}

// S4 — switching language changes no term and no entry, only the projection.
const termCountBefore = search.index.reduce((sum, entry) => sum + entry.searchTerms.length, 0);
const lengthBefore = search.index.length;
setLanguage('en');
search.refreshDisplayNames('en');
const namesEn = search.index.map(entry => entry.name);
setLanguage('ro');
search.refreshDisplayNames('ro');
const namesRo = search.index.map(entry => entry.name);
const termCountAfter = search.index.reduce((sum, entry) => sum + entry.searchTerms.length, 0);
if (search.index.length !== lengthBefore || termCountAfter !== termCountBefore) {
  i18nFailures.push({
    check: 'S4 index invariance across setLanguage',
    detail: `entries ${lengthBefore}→${search.index.length}, terms ${termCountBefore}→${termCountAfter}`
  });
}

// S5 — the fallback ladder never yields an empty name, in either language.
const emptyNames = [];
for (const lang of LANGUAGES) {
  for (const [kind, entities] of entityGroups) {
    for (const entity of entities) {
      if (!displayName(entity, lang)) emptyNames.push(`${lang}/${kind}/${entity.id}`);
    }
  }
}
if (emptyNames.length) {
  i18nFailures.push({ check: 'S5 empty display names', detail: `${emptyNames.length}: ${emptyNames.slice(0, 5).join(', ')}` });
}

const localizedNames = namesEn.reduce((count, name, index) => count + (name === namesRo[index] ? 0 : 1), 0);

const worldCoordinates = data.mapCatalog.maps?.world?.coordinates || {};
const resolvesLocation = event => [event.location, event.locatie_id]
  .some(location => allLocationIds.has(stripEntityPrefix(location || '')));
const resolvedCoreEventLocations = coreEvents.filter(resolvesLocation).length;
const resolvedEventLocations = data.events.filter(resolvesLocation).length;
const resolvedHouseMemberships = data.characters.filter(character =>
  houseIds.has(stripEntityPrefix(character.membru_al || ''))
).length;

// Anchor invariants. Unlike the milestone counts below these are assertions: a
// sub-location that resolves nowhere, or to something that is itself hidden,
// would silently drop a place off the map with no error anywhere.
const anchorFailures = [];
const childLocations = temp.locations.filter(location => location.parent_id);
for (const child of childLocations) {
  const anchor = mappableAnchor(child.id);
  if (!locationIndex.has(child.parent_id)) {
    anchorFailures.push({ check: 'parent_id does not resolve', id: child.id, detail: child.parent_id });
  } else if (isMappableLocation(child) && !anchor) {
    anchorFailures.push({ check: 'mappable child with no anchor', id: child.id, detail: child.parent_id });
  } else if (anchor && isRenderedByAncestor(anchor)) {
    anchorFailures.push({ check: 'anchor is itself hidden', id: child.id, detail: anchor.id });
  }
}
// Every capital must reach a pin, whether on its own id or through its anchor.
const capitalIds = ['kings_landing', 'winterfell', 'casterly_rock', 'highgarden', 'sunspear',
  'storm_end', 'the_eyrie', 'riverrun', 'pyke', 'dragonstone', 'oldtown',
  'harrenhal', 'the_wall', 'moat_cailin'];
const capitalsWithoutPin = capitalIds.filter(id => !worldCoordinates[mappableAnchor(id)?.id]);
for (const id of capitalsWithoutPin) {
  anchorFailures.push({ check: 'capital anchor has no pin', id, detail: mappableAnchor(id)?.id || 'no anchor' });
}
const suppressedMarkers = getAllLocations().filter(isRenderedByAncestor);

// ── house seats ────────────────────────────────────────────────────────────
// Assertions. `seat` is string-or-array on disk for the same reason `id_intern`
// was, and the array form reached the interface as "[OBJECT OBJECT]" and cost 26
// houses their map position. After mapCompatibility the root field must be a
// plain id or null, with nothing left that a String() would mangle.
const seatFailures = [];
let seatsResolvingToLocation = 0;
let seatsCarryingSources = 0;
for (const house of data.houses) {
  if (!Object.hasOwn(house, 'seat')) continue;
  if (house.seat !== null && typeof house.seat !== 'string') {
    seatFailures.push({ check: 'seat is neither string nor null', id: house.id, detail: Array.isArray(house.seat) ? 'array' : typeof house.seat });
  }
  if (typeof house.seat === 'string' && /\[object object\]/i.test(house.seat)) {
    seatFailures.push({ check: 'seat stringified an object', id: house.id, detail: house.seat });
  }
  if (!Array.isArray(house.seat_sources)) {
    seatFailures.push({ check: 'seat_sources is not an array', id: house.id, detail: typeof house.seat_sources });
  } else if (house.seat_sources.length) {
    seatsCarryingSources++;
  }
  if (house.seat && allLocationIds.has(house.seat)) seatsResolvingToLocation++;
}
// The one case the audit names by id: House Blacktyde's seat is an array of two
// provenance records, and `LOCATION_BLACKTYDE` has to reach the location.
const blacktyde = data.houses.find(house => house.id === 'blacktyde');
if (!blacktyde) {
  seatFailures.push({ check: 'house blacktyde is missing', id: 'blacktyde', detail: 'expected by the seat regression probe' });
} else {
  if (blacktyde.seat !== 'blacktyde') {
    seatFailures.push({ check: 'blacktyde seat did not normalize', id: 'blacktyde', detail: JSON.stringify(blacktyde.seat) });
  }
  if (!locationIndex.has(String(blacktyde.seat))) {
    seatFailures.push({ check: 'blacktyde seat does not resolve to a location', id: 'blacktyde', detail: JSON.stringify(blacktyde.seat) });
  }
  if (!blacktyde.seat_sources?.length) {
    seatFailures.push({ check: 'blacktyde seat provenance was dropped', id: 'blacktyde', detail: 'expected the extraction records' });
  }
}

// ── timeline eras ──────────────────────────────────────────────────────────
// Assertions, not milestone counts. Timeline.setEras silently drops any era
// whose bounds are not finite, so a malformed record does not throw — it just
// disappears from the selector. The failure is invisible in the browser and has
// to be caught here.
const eraFailures = [];
if (!Array.isArray(temp.eras)) {
  eraFailures.push({ check: 'eras.json is not an array', id: '(file)', detail: typeof temp.eras });
} else if (temp.eras.length < 1) {
  eraFailures.push({ check: 'eras.json declares no era', id: '(file)', detail: '0 records' });
}
const seenEraIds = new Set();
for (const era of Array.isArray(temp.eras) ? temp.eras : []) {
  const id = typeof era?.id === 'string' && era.id ? era.id : null;
  if (!id) {
    eraFailures.push({ check: 'era has no string id', id: '(missing id)', detail: JSON.stringify(era?.id ?? null) });
  } else if (seenEraIds.has(id)) {
    eraFailures.push({ check: 'duplicate era id', id, detail: 'ids address eras in the selector' });
  } else {
    seenEraIds.add(id);
  }
  const label = id || '(missing id)';
  if (!Number.isFinite(era?.start_year)) {
    eraFailures.push({ check: 'start_year is not a finite number', id: label, detail: JSON.stringify(era?.start_year ?? null) });
  }
  if (!Number.isFinite(era?.end_year)) {
    eraFailures.push({ check: 'end_year is not a finite number', id: label, detail: JSON.stringify(era?.end_year ?? null) });
  }
  if (Number.isFinite(era?.start_year) && Number.isFinite(era?.end_year) && era.start_year > era.end_year) {
    eraFailures.push({ check: 'start_year is after end_year', id: label, detail: `${era.start_year} > ${era.end_year}` });
  }
}

// ── distance tool (P7) ─────────────────────────────────────────────────────
// These are assertions, not milestone counts. The tool makes three promises the
// data can break silently: that both endpoints of a pair can be *selected* even
// with no marker, that a pair with contradictory statements is reported as
// contradictory rather than reconciled, and that no travel time is ever derived
// from anything but a curated value.
const distanceFailures = [];

// The wide index the distance pickers search: every place, including the 217
// `type: "location"` and 16 `non_place` records the map split discards.
const allLocationIndex = new Map(temp.locations.filter(l => l?.id).map(l => [l.id, mapCompatibility(l)]));
for (const [id, location] of locationIndex) allLocationIndex.set(id, location);

const internToId = new Map();
for (const location of allLocationIndex.values()) {
  for (const intern of toInternIds(location.id_intern)) if (!internToId.has(intern)) internToId.set(intern, location.id);
}
const resolveEndpoint = (id, intern) => allLocationIndex.has(id) ? id : (internToId.get(intern) || null);

const endpointIds = new Set();
for (const statement of data.distances) {
  endpointIds.add(statement.location_a_id);
  endpointIds.add(statement.location_b_id);
}
const unreachableEndpoints = [...endpointIds].filter(id => !allLocationIndex.has(id));
for (const id of unreachableEndpoints) {
  distanceFailures.push({ check: 'distance endpoint not selectable', id, detail: 'absent from the wide location index' });
}

// getNarrativeDistances, mirrored against the same records the app filters.
const narrativeFor = (id1, id2) => {
  const a = allLocationIndex.get(id1);
  const b = allLocationIndex.get(id2);
  const intern1 = toInternIds(a?.id_intern);
  const intern2 = toInternIds(b?.id_intern);
  return data.distances.filter(statement => {
    const matchA1 = statement.location_a_id === id1 || intern1.includes(statement.location_a_intern);
    const matchB2 = statement.location_b_id === id2 || intern2.includes(statement.location_b_intern);
    const matchA2 = statement.location_a_id === id2 || intern2.includes(statement.location_a_intern);
    const matchB1 = statement.location_b_id === id1 || intern1.includes(statement.location_b_intern);
    return (matchA1 && matchB2) || (matchA2 && matchB1);
  });
};

// The acceptance case. Harrenhal ↔ King's Landing carries four statements from
// three books: "sute de leghe", "mii de kilometri", "se ajunge repede și
// direct", and one that gives no figure at all. All four must survive to the
// panel and the set must be reported as conflicting.
const harrenhalStatements = narrativeFor('harrenhal', 'kings_landing');
const harrenhalAssessment = assessPair(harrenhalStatements);
if (harrenhalStatements.length !== 4) {
  distanceFailures.push({ check: 'harrenhal↔kings_landing statement count', id: 'harrenhal|kings_landing', detail: `expected 4, got ${harrenhalStatements.length}` });
}
if (!harrenhalAssessment.conflict) {
  distanceFailures.push({ check: 'harrenhal↔kings_landing not flagged as conflicting', id: 'harrenhal|kings_landing', detail: JSON.stringify(harrenhalAssessment.reasons) });
}
for (const reason of ['magnitude', 'emphasis']) {
  if (!harrenhalAssessment.reasons.includes(reason)) {
    distanceFailures.push({ check: `harrenhal↔kings_landing missing conflict reason "${reason}"`, id: 'harrenhal|kings_landing', detail: JSON.stringify(harrenhalAssessment.reasons) });
  }
}
if (harrenhalAssessment.claims.length !== harrenhalStatements.length) {
  distanceFailures.push({ check: 'assessPair dropped a statement', id: 'harrenhal|kings_landing', detail: `${harrenhalStatements.length} in, ${harrenhalAssessment.claims.length} out` });
}

// A pair neither of whose ends has a pin must still be comparable end to end.
const unpinnedPairs = [['castle_black', 'shadow_tower'], ['coldmoat', 'standfast'], ['duskendale', 'maidenpool']];
for (const [id1, id2] of unpinnedPairs) {
  if (worldCoordinates[id1] || worldCoordinates[id2]) {
    distanceFailures.push({ check: 'expected an unpinned pair', id: `${id1}|${id2}`, detail: 'one end now has a pin; pick another probe' });
    continue;
  }
  if (!allLocationIndex.has(id1) || !allLocationIndex.has(id2)) {
    distanceFailures.push({ check: 'unpinned pair not selectable', id: `${id1}|${id2}`, detail: 'missing from the wide index' });
  } else if (!narrativeFor(id1, id2).length) {
    distanceFailures.push({ check: 'unpinned pair yields no statements', id: `${id1}|${id2}`, detail: 'expected at least one' });
  }
}

// Travel times come from the canonical value alone. With every value still null
// the tool must derive nothing; injecting one must make all four modes resolve.
const canonical = readJson('data/locations/canonical_distances.json');
const canonicalHit = (pairs, id1, id2) => {
  const record = pairs.find(entry => {
    const [a, b] = entry.pair || [];
    return (a === id1 && b === id2) || (a === id2 && b === id1);
  });
  return Number.isFinite(record?.distanta_canonica_leghe) ? record : null;
};
const filledCanonical = canonical.pairs.filter(entry => Number.isFinite(entry.distanta_canonica_leghe));
if (canonicalHit(canonical.pairs, 'harrenhal', 'kings_landing') && filledCanonical.length === 0) {
  distanceFailures.push({ check: 'canonical lookup returned a null value as a hit', id: 'harrenhal|kings_landing', detail: 'null must not count as a value' });
}
const injected = canonicalHit([{ pair: ['harrenhal', 'kings_landing'], distanta_canonica_leghe: 100 }], 'kings_landing', 'harrenhal');
if (!injected) {
  distanceFailures.push({ check: 'canonical lookup is not order-independent', id: 'harrenhal|kings_landing', detail: 'reversed pair did not match' });
} else {
  const miles = injected.distanta_canonica_leghe * MILES_PER_LEAGUE;
  for (const mode of ['walking', 'horse', 'ship', 'dragon']) {
    const days = travelTime(miles, mode);
    if (!Number.isFinite(days) || days <= 0) {
      distanceFailures.push({ check: `travelTime(${mode}) not derivable from canonical value`, id: 'harrenhal|kings_landing', detail: String(days) });
    }
  }
}

// Every pair scheduled for curation must name two ids that actually exist,
// otherwise a filled-in value would never be found by the lookup.
for (const entry of canonical.pairs) {
  const [a, b] = entry.pair || [];
  if (!allLocationIndex.has(a) || !allLocationIndex.has(b)) {
    distanceFailures.push({ check: 'canonical pair references an unknown id', id: `${a}|${b}`, detail: 'not in the wide index' });
  }
}

// Parser coverage, reported rather than asserted: it will move as the corpus
// grows, and the panel degrades to "no measurable value" rather than breaking.
const parsedClaims = data.distances.map(parseDistanceClaim);
const lengthClaims = parsedClaims.filter(claim => claim.axis === 'length').length;
const durationClaims = parsedClaims.filter(claim => claim.axis === 'duration').length;
const statementsWithDigit = data.distances.filter(statement => /\d/.test(statement.distance_value || '')).length;

// No claim may carry an inverted or non-finite interval — that would make the
// disjointness test silently meaningless.
for (let i = 0; i < parsedClaims.length; i++) {
  const claim = parsedClaims[i];
  if (claim.axis === 'length' && !(claim.leagueMin <= claim.leagueMax)) {
    distanceFailures.push({ check: 'inverted length interval', id: data.distances[i].id, detail: `${claim.leagueMin}..${claim.leagueMax}` });
  }
  if (claim.axis === 'duration' && !(claim.dayMin <= claim.dayMax)) {
    distanceFailures.push({ check: 'inverted duration interval', id: data.distances[i].id, detail: `${claim.dayMin}..${claim.dayMax}` });
  }
}

const distancePairs = new Map();
for (const statement of data.distances) {
  const a = resolveEndpoint(statement.location_a_id, statement.location_a_intern);
  const b = resolveEndpoint(statement.location_b_id, statement.location_b_intern);
  if (!a || !b || a === b) continue;
  const key = [a, b].sort().join('|');
  if (!distancePairs.has(key)) distancePairs.set(key, []);
  distancePairs.get(key).push(statement);
}
const conflictingPairs = [...distancePairs.values()].filter(list => assessPair(list).conflict).length;
const pairsNeedingSearch = [...distancePairs.keys()]
  .filter(key => key.split('|').some(id => !worldCoordinates[mappableAnchor(id)?.id || id])).length;

// The expected values are phase milestones, not hard assertions: later import
// phases legitimately grow the dataset. Predicate exceptions are the smoke
// test's only failure condition.
const metrics = [
  { check: 'Predicate exceptions', expected: '0', actual: predicateFailures.length },
  { check: 'getAllLocations()', expected: '391 before Phase 2', actual: getAllLocations().length },
  { check: 'Catalog coordinates', expected: '77', actual: Object.keys(worldCoordinates).length },
  { check: 'Core events resolving to a location', expected: '875 after P1.3', actual: resolvedCoreEventLocations },
  { check: 'All runtime events resolving to a location', expected: 'core + Essos', actual: resolvedEventLocations },
  { check: 'membru_al resolving to a house', expected: '631 after P1.4', actual: resolvedHouseMemberships },
  { check: 'Search index total', expected: 'reported by type', actual: search.index.length },
  ...Object.entries(searchByType).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({
    check: `Search index: ${type}`,
    expected: 'reported by type',
    actual: count
  })),
  { check: 'Locations with parent_id', expected: 'reported', actual: childLocations.length },
  { check: 'Markers suppressed by anchor rule', expected: 'reported', actual: suppressedMarkers.length },
  { check: 'Anchor invariants', expected: '0 failures', actual: anchorFailures.length },
  { check: 'House seat assertions', expected: '0 failures', actual: seatFailures.length },
  { check: 'House seats resolving to a location', expected: 'reported', actual: `${seatsResolvingToLocation} / ${data.houses.filter(h => h.seat).length}` },
  { check: 'House seats carrying provenance', expected: '26 after normalization', actual: seatsCarryingSources },
  { check: 'Timeline eras loaded', expected: '>= 1', actual: Array.isArray(temp.eras) ? temp.eras.length : 'not an array' },
  { check: 'Timeline era assertions', expected: '0 failures', actual: eraFailures.length },
  { check: 'Distance tool assertions', expected: '0 failures', actual: distanceFailures.length },
  { check: 'Distance endpoints selectable', expected: 'all 237', actual: `${endpointIds.size - unreachableEndpoints.length} / ${endpointIds.size}` },
  { check: 'Distance pairs (resolved, distinct)', expected: 'reported', actual: distancePairs.size },
  { check: 'Distance pairs needing a search field', expected: 'reported', actual: pairsNeedingSearch },
  { check: 'Distance pairs flagged as conflicting', expected: 'reported', actual: conflictingPairs },
  { check: 'Statements parsed as a length claim', expected: 'reported', actual: lengthClaims },
  { check: 'Statements parsed as a duration claim', expected: 'reported', actual: durationClaims },
  { check: 'Statements containing an Arabic digit', expected: 'for comparison', actual: statementsWithDigit },
  { check: 'harrenhal↔kings_landing statements', expected: '4, conflicting', actual: `${harrenhalStatements.length}, ${harrenhalAssessment.reasons.join('+') || 'no conflict'}` },
  { check: 'Canonical pairs scheduled / filled in', expected: 'filled in by hand', actual: `${canonical.pairs.length} / ${filledCanonical.length}` },
  { check: 'i18n assertions S1-S7', expected: '0 failures', actual: i18nFailures.length },
  { check: 'L1 keys (ro / en)', expected: 'identical sets', actual: Object.keys(dictionaries.ro).length },
  { check: 'Index names differing between ro and en', expected: 'display projection only', actual: localizedNames },
  { check: 'Interface language after test', expected: 'ro', actual: getLanguage() }
];

console.table(metrics);
if (i18nFailures.length) {
  console.error(`\ni18n assertions failed (${i18nFailures.length}):`);
  console.table(i18nFailures);
}
if (predicateFailures.length) {
  console.error(`\nPredicate exceptions (${predicateFailures.length} entities):`);
  console.table(predicateFailures);
}
if (anchorFailures.length) {
  console.error(`\nAnchor invariants failed (${anchorFailures.length}):`);
  console.table(anchorFailures);
}
if (seatFailures.length) {
  console.error(`\nHouse seat assertions failed (${seatFailures.length}):`);
  console.table(seatFailures);
}
if (eraFailures.length) {
  console.error(`\nTimeline era assertions failed (${eraFailures.length}):`);
  console.table(eraFailures);
}
if (distanceFailures.length) {
  console.error(`\nDistance tool assertions failed (${distanceFailures.length}):`);
  console.table(distanceFailures);
}
if (predicateFailures.length || i18nFailures.length || anchorFailures.length || seatFailures.length || eraFailures.length || distanceFailures.length) {
  process.exitCode = 1;
} else {
  console.log(`\nSmoke test passed: ${entityGroups.reduce((sum, [, entities]) => sum + entities.length, 0)} entities exercised.`);
}
