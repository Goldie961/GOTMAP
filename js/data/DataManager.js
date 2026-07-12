import { getPolygonBounds, isPointInPolygon } from '../map/RegionSelector.js';

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
      timeline: {}
    };
  }

  async loadAll() {
    const urls = {
      locations: 'data/locations/locations.json',
      houses: 'data/houses/houses.json',
      characters: 'data/characters/characters.json',
      dragons: 'data/dragons/dragons.json',
      events: 'data/events/events.json',
      essosLocations: 'data/essos/free_cities.json',
      essosFactions: 'data/essos/free_cities_factions.json',
      essosEvents: 'data/essos/free_cities_events.json',
      farLands: 'data/essos/far_lands.json',
      mapCatalog: 'data/map/catalog.json',
      worldFeatures: 'data/map/world_features.json'
    };

    // Load static datasets
    const temp = {};
    for (const [key, url] of Object.entries(urls)) {
      const response = await fetch(`${this.basePath}${url}`);
      temp[key] = await response.json();
    }

    // Merge Essos and Far Lands datasets
    temp.locations = [...temp.locations, ...temp.essosLocations, ...temp.farLands];
    temp.houses = [...temp.houses, ...temp.essosFactions];
    temp.events = [...temp.events, ...temp.essosEvents];

    this.data.characters = temp.characters;
    this.data.dragons = temp.dragons;
    this.data.events = temp.events;
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
        timeline: (entity.type === 'house' && entity.metadata)
          ? (entity.metadata.timeline || [])
          : (entity.type === 'faction' || entity.type === 'institution')
            ? (entity.history || [])
            : (entity.ownership_history || [])
      };
      return mapped;
    };

    this.data.castles = temp.locations
      .filter(l => l.type === 'castle')
      .map(mapCompatibility);

    this.data.cities = temp.locations
      .filter(l => l.type === 'city')
      .map(mapCompatibility);

    this.data.landmarks = temp.locations
      .filter(l => l.type === 'landmark')
      .map(mapCompatibility);

    this.data.houses = temp.houses.map(mapCompatibility);

    // Load timeline snapshots (Year 1 AC for milestone 1)
    const timelineYears = [1]; // Extensible array
    for (const yr of timelineYears) {
      const response = await fetch(`${this.basePath}data/timeline/year_${yr}.json`);
      this.data.timeline[yr] = await response.json();
    }

    // Expose DataManager globally for components to access
    window.atlasDataManager = this;
    this.validateRegionLocationMembership();
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
}
