// Search-split assertions (P6.2): run with `node tests/search.mjs`.
//
// The question this file answers is the acceptance criterion, not a proxy for
// it: given a real query against the real index, does anything reach the camera
// that has nowhere to go?
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMappableLocation } from '../js/data/DataManager.js';
import { SearchEngine } from '../js/data/SearchEngine.js';
import { resolveMapTarget, isMapKind } from '../js/map/mapTarget.js';
import { entityKind } from '../js/router/routes.js';
import { normalizeInternIds, toInternIds } from '../js/utils/entities.js';
import { setDictionaries, setLanguage, LANGUAGES } from '../js/i18n/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));

const raw = {
  locations: [
    ...readJson('data/locations/locations.json'),
    ...readJson('data/essos/free_cities.json'),
    ...readJson('data/essos/far_lands.json')
  ],
  houses: [...readJson('data/houses/houses.json'), ...readJson('data/essos/free_cities_factions.json')],
  characters: readJson('data/characters/characters.json'),
  dragons: readJson('data/dragons/dragons.json'),
  events: [...readJson('data/events/events.json'), ...readJson('data/essos/free_cities_events.json')],
  objects: readJson('data/objects/objects.json'),
  titles: readJson('data/titles/titles.json'),
  catalog: readJson('data/map/catalog.json')
};

// Same compatibility pass DataManager performs, kept local so the test exercises
// the runtime shape rather than raw JSON (identical to tests/smoke.mjs).
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
  castles: raw.locations.filter(l => ['stronghold', 'castle', 'fortress'].includes(l.type)).map(mapCompatibility),
  cities: raw.locations.filter(l => ['settlement', 'city', 'town'].includes(l.type)).map(mapCompatibility),
  landmarks: raw.locations.filter(l => !['non_place', 'stronghold', 'castle', 'fortress', 'settlement', 'city', 'town', 'location'].includes(l.type)).map(mapCompatibility),
  houses: raw.houses.map(mapCompatibility),
  characters: raw.characters.map(c => normalizeInternIds({ ...c, type: c.type || 'character' })),
  dragons: raw.dragons.map(normalizeInternIds),
  events: raw.events.map(normalizeInternIds),
  objects: raw.objects.map(mapCompatibility),
  titles: raw.titles.map(mapCompatibility)
};

const worldCoordinates = raw.catalog.maps?.world?.coordinates || {};
const space = raw.catalog.coordinateSpaces?.[raw.catalog.maps?.world?.coordinateSpace] || {};

const locationIndex = new Map();
for (const list of [data.landmarks, data.cities, data.castles]) {
  for (const location of list) if (location?.id) locationIndex.set(location.id, location);
}

// A DataManager-shaped stand-in. Only the three methods resolveMapTarget calls
// are implemented, and each mirrors the real one exactly.
const manager = {
  data,
  getLocation: id => locationIndex.get(id),
  getHouse: id => data.houses.find(h => h.id === id),
  getMappableAnchor(idOrLocation) {
    let location = typeof idOrLocation === 'string' ? locationIndex.get(idOrLocation) : idOrLocation;
    const seen = new Set();
    let anchor = null;
    for (let depth = 0; location && depth <= 8; depth += 1) {
      if (isMappableLocation(location)) anchor = location;
      if (!location.parent_id || seen.has(location.id)) break;
      seen.add(location.id);
      location = locationIndex.get(location.parent_id);
    }
    return anchor;
  },
  getWorldCoordinate(id) {
    const c = worldCoordinates[id];
    if (!c || c.status === 'needsRecalibration' || c.needsCalibration) return null;
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
    if (c.x < 0 || c.x > space.width || c.y < 0 || c.y > space.height) return null;
    return c;
  },
  getAllLocations: () => [...data.castles, ...data.cities, ...data.landmarks].filter(isMappableLocation)
};

setDictionaries(Object.fromEntries(LANGUAGES.map(l => [l, readJson(`i18n/${l}.json`)])), 'ro');
const search = new SearchEngine();
search.buildIndex(manager);

const failures = [];
const fail = (check, detail) => failures.push({ check, detail });

// The dropdown's split, reproduced exactly: the same predicate, the same input.
const splitOf = query => {
  const results = search.search(query, { limit: 60 });
  const onMap = [], encyclopedia = [];
  for (const r of results) (resolveMapTarget(r.entity, manager) ? onMap : encyclopedia).push(r);
  return { onMap, encyclopedia, total: results.length };
};

// ── P1 · nothing in the map section lacks a position ───────────────────────
// Swept over the whole index, not over a sample: this is the promise the
// section heading makes, and one exception breaks it.
let mapSectionEntries = 0;
for (const entry of search.index) {
  const target = resolveMapTarget(entry.entity, manager);
  if (!target) continue;
  mapSectionEntries += 1;
  const anchor = manager.getMappableAnchor(target);
  if (!manager.getWorldCoordinate(anchor?.id)) {
    fail('P1 map-section entry without a coordinate', `${entry.id} → ${anchor?.id ?? 'no anchor'}`);
  }
}

// ── P2 · only places and houses can be in the map section ──────────────────
const offenders = search.index
  .filter(entry => resolveMapTarget(entry.entity, manager))
  .filter(entry => !isMapKind(entityKind(entry.entity, manager)));
if (offenders.length) fail('P2 non-place in the map section', offenders.slice(0, 5).map(e => e.id).join(', '));

// ── P3 · the acceptance criterion, run ─────────────────────────────────────
// "Searching a character from /harta no longer causes any zoom."
const characterProbes = ['Eddard Stark', 'Tyrion Lannister', 'Daenerys', 'Jon Snow', 'Cersei'];
for (const probe of characterProbes) {
  const { onMap } = splitOf(probe);
  const characters = onMap.filter(r => entityKind(r.entity, manager) === 'character');
  if (characters.length) fail(`P3 character reached the map section ("${probe}")`, characters.map(r => r.id).join(', '));
}

// "Searching an event from /harta leads to its wiki page." An event is never in
// the map section, and it always has a /wiki/event/:id to lead to.
const sampleEvents = data.events.slice(0, 200);
const eventsInMapSection = sampleEvents.filter(e => resolveMapTarget(e, manager));
if (eventsInMapSection.length) fail('P4 event in the map section', eventsInMapSection.slice(0, 5).map(e => e.id).join(', '));
const eventsWithoutRoute = sampleEvents.filter(e => entityKind(e, manager) !== 'event');
if (eventsWithoutRoute.length) fail('P4 event with no wiki route', eventsWithoutRoute.slice(0, 5).map(e => e.id).join(', '));

// ── P5 · both sections stay bilingual (INV-S1, requirement 4) ──────────────
// The split must be a property of the catalog, not of the interface language.
const bilingualProbes = ["King's Landing", 'Debarcaderul Regelui', 'Winterfell', 'Casa Stark', 'Fortareata Rosie'];
for (const probe of bilingualProbes) {
  const shape = {};
  for (const lang of LANGUAGES) {
    setLanguage(lang);
    search.refreshDisplayNames(lang);
    const { onMap, encyclopedia } = splitOf(probe);
    shape[lang] = `${onMap.map(r => r.id).join('|')}##${encyclopedia.map(r => r.id).join('|')}`;
  }
  if (shape.ro !== shape.en) fail(`P5 split differs by language ("${probe}")`, `ro≠en`);
}
setLanguage('ro');
search.refreshDisplayNames('ro');

// ── P6 · the calibration boundary, on named records ────────────────────────
// These are the cases that made the task's premise wrong: `mappable: true` and
// no coordinate anywhere. They must be in the encyclopedia section, and they
// must move to the map section the moment a coordinate is added — which is why
// the check is derived from the catalog rather than from a hard-coded list.
const boundary = [
  ['winterfell', true], ['kings_landing', true],
  ['castle_black', false], ['white_harbor', false], ['the_twins', false]
];
for (const [id, expected] of boundary) {
  const location = manager.getLocation(id);
  if (!location) { fail('P6 fixture missing', id); continue; }
  const actual = Boolean(resolveMapTarget(location, manager));
  const pinned = Boolean(manager.getWorldCoordinate(manager.getMappableAnchor(location)?.id));
  if (actual !== pinned) fail('P6 classification disagrees with the catalog', `${id}: split=${actual} catalog=${pinned}`);
  if (actual !== expected) fail('P6 classification changed', `${id}: expected ${expected}, got ${actual} (catalog may have grown — update the fixture)`);
}

// ── Counts, reported not asserted ──────────────────────────────────────────
const mappable = manager.getAllLocations();
const pinnedLocations = mappable.filter(l => manager.getWorldCoordinate(manager.getMappableAnchor(l)?.id));
const housesWithSeat = data.houses.filter(h => h.seat || h.city || h.metadata?.seat);
const housesOnMap = data.houses.filter(h => resolveMapTarget(h, manager));

// Requirement 5: alias coverage is the reason search feels like it misses
// things. Reported every run so nothing is built on the assumption it improved.
const hasAlias = e => (Array.isArray(e.aliasuri) ? e.aliasuri.length > 0 : Boolean(e.aliasuri));
const coverage = (rows) => `${rows.filter(hasAlias).length}/${rows.length} = ${Math.round(100 * rows.filter(hasAlias).length / rows.length)}%`;

console.table([
  { check: 'Search index total', value: search.index.length },
  { check: 'Entries reaching the map section', value: mapSectionEntries },
  { check: 'Locations: isMappableLocation', value: mappable.length },
  { check: 'Locations: with a catalog pin', value: pinnedLocations.length },
  { check: 'Locations: mappable but uncalibrated', value: mappable.length - pinnedLocations.length },
  { check: 'Houses: total / with a seat / on map', value: `${data.houses.length} / ${housesWithSeat.length} / ${housesOnMap.length}` },
  { check: 'aliasuri coverage: locations', value: coverage(raw.locations) },
  { check: 'aliasuri coverage: characters', value: coverage(raw.characters) },
  { check: 'aliasuri coverage: events', value: coverage(raw.events) },
  { check: 'aliasuri coverage: houses', value: coverage(raw.houses) },
  { check: 'Assertions failed', value: failures.length }
]);

// The acceptance criterion, spelled out as output rather than claimed.
// "Burning of Harrenhal" is one of the 460 events with a real title
// (`nume_generat: false`); the other 1229 carry a generated sentence, which is
// requirement 5's problem and not something this split can fix.
for (const probe of ['Eddard Stark', 'Burning of Harrenhal', 'Winterfell', 'Castle Black']) {
  const { onMap, encyclopedia } = splitOf(probe);
  console.log(`search("${probe}") → on map: ${onMap.length} [${onMap.slice(0, 3).map(r => r.id).join(', ')}] · encyclopedia: ${encyclopedia.length} [${encyclopedia.slice(0, 3).map(r => r.id).join(', ')}]`);
}

if (failures.length) {
  console.error(`\nSearch assertions failed (${failures.length}):`);
  console.table(failures);
  process.exitCode = 1;
} else {
  console.log(`\nSearch test passed: ${search.index.length} indexed entries swept.`);
}
