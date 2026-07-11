export class DataManager {
  constructor() {
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
      castles: 'data/locations/castles.json',
      cities: 'data/locations/cities.json',
      landmarks: 'data/locations/landmarks.json',
      houses: 'data/houses/houses.json',
      characters: 'data/characters/characters.json',
      dragons: 'data/dragons/dragons.json',
      events: 'data/events/events.json'
    };

    // Load static datasets
    for (const [key, url] of Object.entries(urls)) {
      const response = await fetch(url);
      this.data[key] = await response.json();
    }

    // Load timeline snapshots (Year 1 AC for milestone 1)
    const timelineYears = [1]; // Extensible array
    for (const yr of timelineYears) {
      const response = await fetch(`data/timeline/year_${yr}.json`);
      this.data.timeline[yr] = await response.json();
    }

    // Expose DataManager globally for components to access
    window.atlasDataManager = this;
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

  getAllLocations() {
    return [
      ...this.data.castles,
      ...this.data.cities,
      ...this.data.landmarks
    ];
  }
}
