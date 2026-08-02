import { getPolygonBounds, isPointInPolygon } from '../map/RegionSelector.js';
import { normalizeInternIds, toInternIds } from '../utils/entities.js';

// bringing it into the 1500 × 1000 world canvas. Reviewed calibration files
// replace these seeds by supplying a normal `path` with no seed method.
export class DataManager {
  constructor(options = {}) {
    this.basePath = options.basePath || '';
    this.data = {
      castles: null,
      cities: null,
      landmarks: null,
      houses: null,
      characters: null,
      dragons: null,
      events: null,
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
      objects: 'data/objects/objects.json',
      titles: 'data/titles/titles.json',
      distances: 'data/locations/distances.json',
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

    // characters.json predates the shared entity discriminator used by the UI.
    // Keep source data untouched while making its runtime entity type explicit.
    this.data.characters = temp.characters.map(character => normalizeInternIds({
      ...character,
      type: character.type || 'character'
    }));
    this.data.dragons = temp.dragons.map(normalizeInternIds);
    this.data.events = temp.events.map(normalizeInternIds);
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
      return mapped;
    };

    this.data.castles = temp.locations
      .filter(l => l.type === 'castle' || l.type === 'fortress')
      .map(mapCompatibility);

    this.data.cities = temp.locations
      .filter(l => l.type === 'city' || l.type === 'town')
      .map(mapCompatibility);

    this.data.landmarks = temp.locations
      .filter(l => l.type === 'landmark' || l.type === 'ruins')
      .map(mapCompatibility);

    this.data.houses = temp.houses.map(mapCompatibility);
    // Unlike the location, house, character, and event schemas, objects and
    // titles contain neither `id_intern` nor `_afirmatii_pe_predicat` fields.
    // mapCompatibility preserves that absence, so no schema fields are invented.
    this.data.objects = temp.objects.map(mapCompatibility);
    this.data.titles = temp.titles.map(mapCompatibility);

    this.buildLocationIndex();

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

  getLocation(id) {
    if (!id) return undefined;
    return this.locationIndex?.get(id);
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
}
