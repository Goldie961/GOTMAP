export class TimelineEngine {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  getWorldState(year) {
    // 1. Check if we have a hardcoded snapshot for this year
    const snapshot = this.dataManager.getTimeline(year);
    if (snapshot) {
      return snapshot;
    }

    // 2. Otherwise, dynamically resolve the world state for any arbitrary year
    // This allows the engine to support the entire 1-300 AC range dynamically
    const state = {
      year: year,
      king: this.resolveKing(year),
      regions: {},
      dragons: this.resolveDragons(year),
      events: this.resolveEvents(year)
    };

    // Resolve regions based on their major castles' ruling houses
    const regions = [
      'the_north', 'the_vale', 'the_riverlands', 'the_westerlands',
      'the_reach', 'the_stormlands', 'the_iron_islands', 'dorne', 'the_crownlands'
    ];

    regions.forEach(regId => {
      state.regions[regId] = this.resolveRegionState(regId, year);
    });

    return state;
  }

  resolveKing(year) {
    // Standard succession chronology for fallback
    if (year < 37) return { character: 'aegon_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
    if (year < 42) return { character: 'aenys_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
    if (year < 48) return { character: 'maegor_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
    if (year < 103) return { character: 'jaehaerys_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
    if (year < 129) return { character: 'viserys_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
    if (year < 131) return { character: 'rhaenyra_targaryen', title: 'Queen of the Seven Kingdoms', seat: 'kings_landing' }; // Dance of the Dragons
    // 300 AC is Robert Baratheon / Joffrey Baratheon
    return { character: 'robert_baratheon', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
  }

  resolveRegionState(regionId, year) {
    // Find paramount seat for region
    const seats = {
      the_north: 'winterfell',
      the_vale: 'the_eyrie',
      the_westerlands: 'casterly_rock',
      the_reach: 'highgarden',
      the_riverlands: 'riverrun',
      the_stormlands: 'storm_end',
      the_iron_islands: 'pyke',
      dorne: 'sunspear',
      the_crownlands: 'kings_landing'
    };

    const seatId = seats[regionId];
    const castle = this.dataManager.getCastle(seatId);
    
    if (castle && castle.timeline) {
      const matches = castle.timeline.filter(t => t.year <= year);
      if (matches.length > 0) {
        const active = matches[matches.length - 1];
        return {
          house: active.house,
          lord: active.lord,
          title: active.title || 'Warden',
          status: active.status || 'sworn'
        };
      }
    }

    // Default Fallback
    return { house: 'unknown', lord: 'Unknown Lord', title: 'Lord', status: 'unknown' };
  }

  resolveDragons(year) {
    return this.dataManager.data.dragons.filter(d => d.born <= year && d.died >= year).map(d => d.id);
  }

  resolveEvents(year) {
    return this.dataManager.data.events.filter(e => e.year <= year).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.sequence - b.sequence;
    });
  }
}
