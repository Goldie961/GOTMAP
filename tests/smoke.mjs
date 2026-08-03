// Data-driven smoke test: run with `node tests/smoke.mjs`.
// It deliberately reads the same datasets as DataManager, but from disk so it
// remains useful before a browser or local server has been started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMappableLocation } from '../js/data/DataManager.js';
import { SearchEngine } from '../js/data/SearchEngine.js';
import { normalizeInternIds, toInternIds } from '../js/utils/entities.js';
import { isCharacterEntity, isEventEntity } from '../js/utils/entityKind.js';
import { stripEntityPrefix } from '../js/utils/helpers.js';
import {
  setDictionaries, setLanguage, getLanguage, t, displayName,
  getMissingKeys, resetMissingKeys, compareKeySets, LANGUAGES
} from '../js/i18n/index.js';

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
  timeline: readJson('data/timeline/year_1.json')
};

// P1.3's 875-event milestone refers to the core event export; Essos adds its
// own seven records later in the runtime merge.
const coreEvents = temp.events;
temp.locations = [...temp.locations, ...temp.essosLocations, ...temp.farLands];
temp.houses = [...temp.houses, ...temp.essosFactions];
temp.events = [...temp.events, ...temp.essosEvents];

// Keep this in lockstep with DataManager.mapCompatibility. It is intentionally
// local to make the test exercise the runtime shape rather than raw JSON only.
const mapCompatibility = entity => ({
  ...entity,
  ...entity.metadata,
  ...(Object.hasOwn(entity, 'id_intern') ? { id_intern: toInternIds(entity.id_intern) } : {}),
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
if (predicateFailures.length || i18nFailures.length || anchorFailures.length) {
  process.exitCode = 1;
} else {
  console.log(`\nSmoke test passed: ${entityGroups.reduce((sum, [, entities]) => sum + entities.length, 0)} entities exercised.`);
}
