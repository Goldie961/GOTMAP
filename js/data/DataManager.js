import { getPolygonBounds, isPointInPolygon } from '../map/RegionSelector.js';
import { normalizeInternIds, toInternIds } from '../utils/entities.js';

const MAPPABLE_TYPES = ['castle', 'city', 'town', 'landmark', 'ruins', 'fortress'];

// The predicate behind getAllLocations(). Extracted because the anchor resolver
// below has to ask the same question about an arbitrary ancestor, and two copies
// of this rule would drift the moment a type is added.
export function isMappableLocation(location) {
  if (!location) return false;
  return location.mappable === true
    || (location.mappable !== false && MAPPABLE_TYPES.includes(location.type));
}

// Guards a malformed `parent_id` cycle in the data from hanging the renderer.
// The deepest real chain today is 2 (room → castle); 8 is slack, not a limit.
const MAX_PARENT_DEPTH = 8;

// bringing it into the 1500 × 1000 world canvas. Reviewed calibration files
// replace these seeds by supplying a normal `path` with no seed method.
export class DataManager {
  constructor(options = {}) {
    // Root-relative by default: the app is served from '/harta/winterfell' and
    // '/wiki/character/eddard_stark' as well as from '/', and a relative
    // 'data/...' would be resolved against the route (P6.1). admin/map-editor.js
    // still passes '../' explicitly and is unaffected.
    this.basePath = options.basePath || '/';
    this.data = {
      castles: null,
      cities: null,
      landmarks: null,
      houses: null,
      characters: null,
      dragons: null,
      events: null,
      eras: [],
      objects: null,
      titles: null,
      timeline: {},
      distances: []
    };
  }

  async loadAll() {
    const urls = {
      locations: 'data/locations/locations.json',
      houses: 'data/houses/houses.json',
      characters: 'data/characters/characters.json',
      dragons: 'data/dragons/dragons.json',
      events: 'data/events/events.json',
      eras: 'data/timeline/eras.json',
      objects: 'data/objects/objects.json',
      titles: 'data/titles/titles.json',
      distances: 'data/locations/distances.json',
      canonicalDistances: 'data/locations/canonical_distances.json',
      essosLocations: 'data/essos/free_cities.json',
      essosFactions: 'data/essos/free_cities_factions.json',
      essosEvents: 'data/essos/free_cities_events.json',
      farLands: 'data/essos/far_lands.json',
      mapCatalog: 'data/map/catalog.json',
      worldFeatures: 'data/map/world_features.json'
    };

    // Load static datasets concurrently
    const entries = Object.entries(urls);
    const results = await Promise.all(
      entries.map(async ([key, url]) => {
        const response = await fetch(`${this.basePath}${url}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return [key, data];
      })
    );

    const temp = Object.fromEntries(results);

    // Merge Essos and Far Lands datasets
    temp.locations = [...temp.locations, ...temp.essosLocations, ...temp.farLands];
    temp.houses = [...temp.houses, ...temp.essosFactions];
    temp.events = [...temp.events, ...temp.essosEvents];

    this.data.distances = temp.distances || [];
    this.data.canonicalDistances = temp.canonicalDistances?.pairs || [];

    // characters.json predates the shared entity discriminator used by the UI.
    // Keep source data untouched while making its runtime entity type explicit.
    this.data.characters = temp.characters.map(character => normalizeInternIds({
      ...character,
      type: character.type || 'character'
    }));
    // Dragon records use the sourced bilingual schema. These aliases preserve
    // the small legacy surface consumed by the generic wiki and timeline code;
    // the JSON remains authoritative through `birth` / `death`.
    this.data.dragons = temp.dragons.map(dragon => normalizeInternIds({
      ...dragon,
      name: dragon.name || dragon.name_ro || dragon.name_en || dragon.id,
      born: Number.isFinite(dragon.birth?.year) ? dragon.birth.year : null,
      died: Number.isFinite(dragon.death?.year) ? dragon.death.year : null
    }));
    this.data.events = temp.events.map(normalizeInternIds);
    this.data.eras = Array.isArray(temp.eras) ? temp.eras : [];
    // The catalog is the single authoritative registry for world-space
    // coordinates. Keeping a second coordinate export here would silently
    // override reviewed placements and make map calibration non-deterministic.
    this.data.mapCatalog = temp.mapCatalog;
    this.data.worldFeatures = temp.worldFeatures.features || [];
    this.data.activeMapId = 'world';
    const worldMap = temp.mapCatalog.maps?.[this.data.activeMapId] || {};
    const coordinateSpace = temp.mapCatalog.coordinateSpaces?.[worldMap.coordinateSpace] || {};
    this.data.worldCoordinates = worldMap.coordinates || {};
    // River paths are only valid when explicitly digitized in this same
    // world-space. The legacy vector file must never be mixed with these points.
    this.data.calibratedRivers = Array.isArray(worldMap.rivers) ? worldMap.rivers : [];
    this.data.calibratedRegionPolygons = {};
    this.data.missingCoordinates = [];
    this.data.worldMilesPerUnit = coordinateSpace.milesPerUnit ?? null;
    this.validateWorldCoordinates(coordinateSpace);

    // Compatibility Layer: Reconstruct castles, cities, landmarks, and houses/factions
    // to expose all metadata/timeline/crest properties at the root level.
    const mapLabel = name => String(name || '').split('(')[0].trim() || String(name || '');
    const mapCompatibility = (entity) => {
      const mapped = {
        ...entity,
        ...entity.metadata,
        // Three locations store `id_intern` as an array. Normalizing here means
        // no consumer has to test the type before calling a string method on it.
        ...(Object.hasOwn(entity, 'id_intern') ? { id_intern: toInternIds(entity.id_intern) } : {}),
        // `metadata.region` may contain imported evidence rather than the
        // normalized region id used by the UI. Keep the top-level string.
        region: entity.region,
        timeline: (entity.type === 'house' && entity.metadata)
          ? (entity.metadata.timeline || [])
          : (entity.type === 'faction' || entity.type === 'institution')
            ? (entity.history || [])
            : (entity.ownership_history || [])
      };
      // The map needs a short, cartographic label.  Keep `name` intact: it is
      // still the canonical full name used by search and the information panel.
      if (typeof mapped.name === 'string') mapped.map_label = mapLabel(mapped.name);
      return mapped;
    };

    this.data.castles = temp.locations
      .filter(l => l.type === 'stronghold' || l.type === 'castle' || l.type === 'fortress')
      .map(mapCompatibility);

    this.data.cities = temp.locations
      .filter(l => l.type === 'settlement' || l.type === 'city' || l.type === 'town')
      .map(mapCompatibility);

    this.data.landmarks = temp.locations
      .filter(l => l.type !== 'non_place' && l.type !== 'stronghold' && l.type !== 'castle' && l.type !== 'fortress' && l.type !== 'settlement' && l.type !== 'city' && l.type !== 'town' && l.type !== 'location')
      .map(mapCompatibility);

    this.data.houses = temp.houses.map(mapCompatibility);
    // Unlike the location, house, character, and event schemas, objects and
    // titles contain neither `id_intern` nor `_afirmatii_pe_predicat` fields.
    // mapCompatibility preserves that absence, so no schema fields are invented.
    this.data.objects = temp.objects.map(mapCompatibility);
    this.data.titles = temp.titles.map(mapCompatibility);

    // Every place in the datasets, including the 217 still carrying the
    // untriaged `type: "location"` and the 16 `non_place` records that the
    // castle/city/landmark split drops. The map must not draw these, and
    // getAllLocations() rightly excludes them — but a distance endpoint is a
    // different question from a marker. All 237 endpoint ids in distances.json
    // exist in the data, and 31 of them are reachable only through this index.
    this.data.allLocations = temp.locations.map(mapCompatibility);
    this.buildLocationIndex();
    this.buildAllLocationIndex();

    // Load timeline snapshots (Year 1 AC for milestone 1)
    const timelineYears = [1]; // Extensible array
    for (const yr of timelineYears) {
      const response = await fetch(`${this.basePath}data/timeline/year_${yr}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load data/timeline/year_${yr}.json: ${response.status} ${response.statusText}`);
      }
      this.data.timeline[yr] = await response.json();
    }

    // Expose DataManager globally for components to access
    window.atlasDataManager = this;
    this.validateRegionLocationMembership();
  }

  // Location lookup by id used to be a three-way linear scan repeated at every
  // call site: castle, then city, then a linear scan over landmarks. The index
  // makes it O(1) and keeps that precedence: castle wins over city over landmark.
  buildLocationIndex() {
    this.locationIndex = new Map();
    for (const list of [this.data.landmarks, this.data.cities, this.data.castles]) {
      for (const location of list) {
        if (location?.id) this.locationIndex.set(location.id, location);
      }
    }
    return this.locationIndex;
  }

  /**
   * A second index over every place in the data, kept separate from
   * `locationIndex` on purpose. `locationIndex` answers "what can the map and
   * the encyclopedia show", and narrowing it is what keeps 217 untriaged
   * records out of search results. This one answers "what places does the
   * project know about at all", which is the right question for a distance
   * endpoint. Precedence matches locationIndex so a duplicated id resolves the
   * same way in both.
   */
  buildAllLocationIndex() {
    this.allLocationIndex = new Map();
    for (const location of this.data.allLocations || []) {
      if (location?.id) this.allLocationIndex.set(location.id, location);
    }
    for (const [id, location] of this.locationIndex || []) {
      this.allLocationIndex.set(id, location);
    }
    return this.allLocationIndex;
  }

  getLocation(id) {
    if (!id) return undefined;
    return this.locationIndex?.get(id);
  }

  /**
   * Resolve an id against every known place, not only the mappable ones.
   * Callers that position something on the map must keep using getLocation();
   * this exists for the distance tool, whose endpoints are legitimately wider
   * than the set of places that carry a marker.
   */
  getAnyLocation(id) {
    if (!id) return undefined;
    return this.allLocationIndex?.get(id) || this.locationIndex?.get(id);
  }

  /** Candidate endpoints for the distance tool's two search fields. */
  getDistanceEndpointCandidates() {
    return this.data.allLocations || [];
  }

  getCastle(id) {
    return this.data.castles.find(c => c.id === id);
  }

  getCity(id) {
    return this.data.cities.find(c => c.id === id);
  }

  getHouse(id) {
    return this.data.houses.find(h => h.id === id);
  }

  getFaction(id) {
    return this.data.houses.find(h => h.id === id && h.type === 'faction');
  }

  getInstitution(id) {
    return this.data.houses.find(h => h.id === id && h.type === 'institution');
  }

  getCharacter(id) {
    return this.data.characters.find(c => c.id === id);
  }

  getDragon(id) {
    return this.data.dragons.find(d => d.id === id);
  }

  getEvent(id) {
    return this.data.events.find(e => e.id === id);
  }

  getObject(id) {
    return this.data.objects.find(object => object.id === id);
  }

  getTitle(id) {
    return this.data.titles.find(title => title.id === id);
  }

  getTimeline(year) {
    return this.data.timeline[year];
  }

  getWorldCoordinate(id) {
    const coordinate = this.data.worldCoordinates[id];
    if (!this.isValidWorldCoordinate(coordinate)) return null;
    return coordinate;
  }

  isValidWorldCoordinate(coordinate) {
    const space = this.getMapCoordinateSpace('world');
    return Boolean(coordinate)
      && coordinate.status !== 'needsRecalibration'
      && !coordinate.needsCalibration
      && Number.isFinite(coordinate.x) && Number.isFinite(coordinate.y)
      && coordinate.x >= 0 && coordinate.x <= space.width
      && coordinate.y >= 0 && coordinate.y <= space.height;
  }

  validateWorldCoordinates(space) {
    Object.entries(this.data.worldCoordinates).forEach(([id, coordinate]) => {
      if (!Number.isFinite(coordinate?.x) || !Number.isFinite(coordinate?.y)
        || coordinate.x < 0 || coordinate.x > space.width || coordinate.y < 0 || coordinate.y > space.height) {
        console.warn(`[atlas] Invalid world coordinate for ${id}; expected 0..${space.width}, 0..${space.height}.`, coordinate);
      }
    });
  }

  getLocationsInRegion(regionId) {
    return this.getAllLocations().filter(location => location.region === regionId);
  }

  getRegionBounds(regionId) {
    return getPolygonBounds(this.data.calibratedRegionPolygons[regionId]?.path);
  }

  isPointInPolygon(point, polygonPath) {
    return isPointInPolygon(point, polygonPath);
  }

  validateRegionLocationMembership() {
    Object.entries(this.data.calibratedRegionPolygons).forEach(([regionId, region]) => {
      this.getLocationsInRegion(regionId).forEach(location => {
        const point = this.getWorldCoordinate(location.id);
        if (point && !isPointInPolygon(point, region.path)) {
          console.warn(`[atlas] ${location.id} is outside calibrated polygon ${regionId}; region assignment remains authoritative.`, point);
        }
      });
    });
  }

  getMapDefinition(mapId = this.data.activeMapId) {
    return this.data.mapCatalog?.maps?.[mapId] || null;
  }

  getMapCoordinateSpace(mapId = this.data.activeMapId) {
    const map = this.getMapDefinition(mapId);
    return map ? this.data.mapCatalog?.coordinateSpaces?.[map.coordinateSpace] || null : null;
  }

  getWorldMilesPerUnit() {
    return this.data.worldMilesPerUnit;
  }

  getAllLocations() {
    return this.getAllLocationsIncludingSubLocations().filter(isMappableLocation);
  }

  /**
   * The location that should carry a map position on behalf of `idOrLocation`.
   *
   * A sub-location is a real place with real provenance, but it has no business
   * owning a marker of its own: the Hightower sits inside Oldtown, Winterfell's
   * kitchen inside Winterfell. Rendering both puts two pins on one place —
   * `oldtown` and `oldtown_city` are 27 units apart on a 1500×1000 canvas, which
   * the declutter pass then pushes further apart into a false separation.
   *
   * So anything that needs to *position* an entity — a house seat, an event, a
   * distance endpoint, a marker — resolves through here first, walking
   * `parent_id` up to the first mappable ancestor. Anything that needs to
   * *identify* or *describe* an entity must NOT: the sub-location keeps its own
   * page, its own search entry and its own sourced history.
   *
   * Returns the location itself when it is already mappable, and null when
   * neither it nor any ancestor is.
   */
  getMappableAnchor(idOrLocation) {
    let location = typeof idOrLocation === 'string'
      ? this.getLocation(idOrLocation)
      : idOrLocation;
    const seen = new Set();
    let anchor = null;

    // The *highest* mappable ancestor wins, not the first one found. `oldtown`
    // is itself mappable — it is a castle and belongs in search — so stopping at
    // the first match would return the very location that carries no marker.
    // Containment is transitive: if the tower sits in the city, the city holds
    // the pin, and anything below the city defers to it.
    for (let depth = 0; location && depth <= MAX_PARENT_DEPTH; depth++) {
      if (isMappableLocation(location)) anchor = location;
      if (!location.parent_id || seen.has(location.id)) break;
      seen.add(location.id);
      location = this.getLocation(location.parent_id);
    }
    return anchor;
  }

  /**
   * True when this location's marker is drawn by an ancestor instead. Distinct
   * from "not mappable": `oldtown` stays in getAllLocations(), and so stays in
   * search, the wiki and the filter facets — it just does not get a pin.
   */
  isRenderedByAncestor(location) {
    if (!location?.parent_id) return false;
    const anchor = this.getMappableAnchor(location);
    return Boolean(anchor) && anchor.id !== location.id;
  }

  getAllLocationsIncludingSubLocations() {
    return [
      ...this.data.castles,
      ...this.data.cities,
      ...this.data.landmarks
    ];
  }

  getNarrativeDistances(loc1, loc2) {
    if (!this.data.distances || !loc1 || !loc2) return [];

    const id1 = typeof loc1 === 'object' ? loc1.id : loc1;
    const id2 = typeof loc2 === 'object' ? loc2.id : loc2;
    // `id_intern` is normalized to an array at load time, so an `===` comparison
    // against the distance record's single intern id can never match.
    const intern1 = typeof loc1 === 'object' ? toInternIds(loc1.id_intern) : [];
    const intern2 = typeof loc2 === 'object' ? toInternIds(loc2.id_intern) : [];

    return this.data.distances.filter(d => {
      const matchA1 = d.location_a_id === id1 || intern1.includes(d.location_a_intern);
      const matchB2 = d.location_b_id === id2 || intern2.includes(d.location_b_intern);

      const matchA2 = d.location_a_id === id2 || intern2.includes(d.location_a_intern);
      const matchB1 = d.location_b_id === id1 || intern1.includes(d.location_b_intern);

      return (matchA1 && matchB2) || (matchA2 && matchB1);
    });
  }

  /**
   * The curated distance for a pair, or null.
   *
   * This is the only figure the distance tool is allowed to present as a result,
   * and the only one travel times may be derived from. A record with
   * `distanta_canonica_leghe: null` is a pair that has been *scheduled* for
   * curation, not a pair with a value — returning it as a hit would put an empty
   * headline back where the calibration notice used to be, so it does not count.
   */
  getCanonicalDistance(loc1, loc2) {
    const id1 = typeof loc1 === 'object' ? loc1?.id : loc1;
    const id2 = typeof loc2 === 'object' ? loc2?.id : loc2;
    if (!id1 || !id2) return null;

    const record = (this.data.canonicalDistances || []).find(entry => {
      const [a, b] = entry.pair || [];
      return (a === id1 && b === id2) || (a === id2 && b === id1);
    });
    return Number.isFinite(record?.distanta_canonica_leghe) ? record : null;
  }
}
