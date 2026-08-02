// Data-driven smoke test: run with `node tests/smoke.mjs`.
// It deliberately reads the same datasets as DataManager, but from disk so it
// remains useful before a browser or local server has been started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SearchEngine } from '../js/data/SearchEngine.js';
import { normalizeInternIds, toInternIds } from '../js/utils/entities.js';
import { isCharacterEntity, isEventEntity } from '../js/utils/entityKind.js';
import { stripEntityPrefix } from '../js/utils/helpers.js';

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
  castles: temp.locations.filter(location => location.type === 'castle' || location.type === 'fortress').map(mapCompatibility),
  cities: temp.locations.filter(location => location.type === 'city' || location.type === 'town').map(mapCompatibility),
  landmarks: temp.locations.filter(location => location.type === 'landmark' || location.type === 'ruins').map(mapCompatibility),
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

const getAllLocations = () => [...data.castles, ...data.cities, ...data.landmarks];
const allLocationIds = new Set(temp.locations.map(location => location.id));
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

const search = new SearchEngine();
search.buildIndex({ data, getAllLocations });
const searchByType = search.index.reduce((counts, entry) => {
  counts[entry.type] = (counts[entry.type] || 0) + 1;
  return counts;
}, {});

const worldCoordinates = data.mapCatalog.maps?.world?.coordinates || {};
const resolvesLocation = event => [event.location, event.locatie_id]
  .some(location => allLocationIds.has(stripEntityPrefix(location || '')));
const resolvedCoreEventLocations = coreEvents.filter(resolvesLocation).length;
const resolvedEventLocations = data.events.filter(resolvesLocation).length;
const resolvedHouseMemberships = data.characters.filter(character =>
  houseIds.has(stripEntityPrefix(character.membru_al || ''))
).length;

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
  }))
];

console.table(metrics);
if (predicateFailures.length) {
  console.error(`\nPredicate exceptions (${predicateFailures.length} entities):`);
  console.table(predicateFailures);
  process.exitCode = 1;
} else {
  console.log(`\nSmoke test passed: ${entityGroups.reduce((sum, [, entities]) => sum + entities.length, 0)} entities exercised.`);
}
