export class TimelineEngine {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.eventsByYear = new Map();
    for (const event of this.dataManager.data.events || []) {
      // Undated events deliberately have no timeline bucket: they remain
      // searchable in the Wiki but must never appear on the timeline.
      if (!Number.isFinite(event.year)) continue;
      const events = this.eventsByYear.get(event.year) || [];
      events.push(event);
      this.eventsByYear.set(event.year, events);
    }
    for (const events of this.eventsByYear.values()) {
      events.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || (a.name || '').localeCompare(b.name || ''));
    }
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
      'the_reach', 'the_stormlands', 'the_iron_islands', 'dorne', 'the_crownlands',
      'free_cities', 'far_lands'
    ];

    regions.forEach(regId => {
      state.regions[regId] = this.resolveRegionState(regId, year);
    });

    return state;
  }

  resolveKing(year) {
    // Lord name -> character.id mapping
    const lordToCharacter = {
      'Aegon I Targaryen': 'aegon_i',
      'Aenys I Targaryen': 'aenys_i',
      'Maegor I Targaryen': 'maegor_i',
      'Jaehaerys I Targaryen': 'jaehaerys_i',
      'Viserys I Targaryen': 'viserys_i',
      'Aegon II Targaryen': 'aegon_ii',
      'Aegon III Targaryen': 'aegon_iii',
      'Daeron I Targaryen': 'daeron_i',
      'Baelor I Targaryen': 'baelor_i',
      'Viserys II Targaryen': 'viserys_ii',
      'Aegon IV Targaryen': 'aegon_iv',
      'Daeron II Targaryen': 'daeron_ii',
      'Aerys I Targaryen': 'aerys_i',
      'Maekar I Targaryen': 'maekar_i',
      'Aegon V Targaryen': 'aegon_v',
      'Jaehaerys II Targaryen': 'jaehaerys_ii',
      'Aerys II Targaryen': 'aerys_ii',
      'Robert Baratheon': 'robert_baratheon',
      'Joffrey Baratheon': 'joffrey_baratheon'
    };

    // After Robert's Rebellion (283 AC), the Baratheons rule
    if (year >= 283) {
      const baratheon = this.dataManager.getHouse('baratheon');
      if (baratheon && baratheon.timeline) {
        const matches = baratheon.timeline.filter(t => t.year <= year && t.title && t.title.toLowerCase().includes('king'));
        if (matches.length > 0) {
          const active = matches[matches.length - 1];
          const charId = lordToCharacter[active.lord] || active.lord.toLowerCase().replace(/\s+/g, '_');
          return { character: charId, title: active.title, seat: 'kings_landing' };
        }
      }
    }

    // Before 283 AC, the Targaryens rule
    const targaryen = this.dataManager.getHouse('targaryen');
    if (targaryen && targaryen.timeline) {
      const matches = targaryen.timeline.filter(t => t.year <= year);
      if (matches.length > 0) {
        const active = matches[matches.length - 1];
        const charId = lordToCharacter[active.lord] || active.lord.toLowerCase().replace(/\s+/g, '_');
        return { character: charId, title: active.title, seat: 'kings_landing' };
      }
    }

    // Ultimate fallback
    return { character: 'aegon_i', title: 'King of the Seven Kingdoms', seat: 'kings_landing' };
  }

  resolveRegionState(regionId, year) {
    // STEP 0: Far Lands are independent/faction-controlled territories with no feudal seat.
    // They do not participate in the Westerosi political system and should never
    // be resolved via the seat-lookup below. Return a stable "independent" state.
    if (regionId === 'far_lands') {
      return {
        house: 'unknown',
        lord: 'Various Factions',
        title: 'Independent / Unknown',
        status: 'independent',
        canon_status: 'inferred',
        note: 'Far Lands: Essos east of Slaver\'s Bay, Sothoryos, Yi Ti, Asshai, Ulthos — largely unmapped and politically fragmented.'
      };
    }

    // STEP 1: Check for a battle/conquest event at exactly this year in this region.
    // Events must have a "region" field and "factions" field (added in Phase 0).
    // Source: data/events/events.json — contested status derived solely from existing event data.
    const battleTypes = ['battle', 'conquest'];
    const eventsInRegion = this.dataManager.data.events.filter(ev =>
      battleTypes.includes(ev.type) && ev.region === regionId && Array.isArray(ev.factions)
    );

    const exactMatch = eventsInRegion.find(ev => ev.year === year);
    if (exactMatch) {
      return {
        house: 'contested',
        lord: 'Unknown',
        title: 'Unknown',
        status: 'contested',
        factions: exactMatch.factions,
        event_id: exactMatch.id,
        event_source: exactMatch.source || null
      };
    }

    // STEP 2: Check if there is any battle/conquest event for this region within ±2 years.
    // If yes, lordship is ambiguous — return "unknown" rather than confidently claiming control.
    const nearbyConflict = eventsInRegion.find(ev => Math.abs(ev.year - year) <= 2);
    if (nearbyConflict) {
      return {
        house: 'unknown',
        lord: 'Unknown',
        title: 'Unknown',
        status: 'unknown',
        reason: `Active conflict nearby (${nearbyConflict.id} at ${nearbyConflict.year} AC)`,
        event_id: nearbyConflict.id,
        event_source: nearbyConflict.source || null
      };
    }

    // STEP 3: Fallback — resolve from ALL castles & cities in the region, not just the paramount seat.
    // Source: data/locations/locations.json — timeline (ownership_history) fields across ALL entities
    // in this region. The paramount seat is checked first; if it agrees with all others we return its
    // value as before. If multiple entities disagree on controlling house, we mark "unknown" per the
    // strict rule: do NOT invent "contested" without a sourced conflict event (already handled above).
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
    const allLocations = this.dataManager.getAllLocations();

    // Helper: resolve a single location's controlling house at a given year from its timeline.
    const resolveLocHouse = (loc) => {
      if (!loc.timeline || loc.timeline.length === 0) return null;
      const matches = loc.timeline.filter(t => t.year <= year);
      if (matches.length === 0) return null;
      const active = matches[matches.length - 1];
      return {
        house: active.house || null,
        lord: active.lord || null,
        title: active.title || 'Warden',
        status: active.status || 'sworn',
        sourceLocId: loc.id,
        sourceFile: 'data/locations/locations.json'
      };
    };

    // Resolve paramount seat first — this is the canonical anchor.
    const paramountCastle = this.dataManager.getCastle(seatId);
    const paramountState = paramountCastle ? resolveLocHouse(paramountCastle) : null;

    // Gather all other castles + cities in this region (excluding the paramount seat).
    const regionEntities = allLocations.filter(loc =>
      loc.region === regionId && loc.id !== seatId
    );

    // Resolve each entity's house at this year.
    const entityStates = regionEntities
      .map(loc => resolveLocHouse(loc))
      .filter(s => s !== null && s.house !== null);

    // If paramount seat has a definitive state, check for inter-entity consensus.
    // IMPORTANT: In feudal Westeros, vassal locations naturally have their own house IDs
    // (e.g. Dreadfort = house "bolton", sworn to house "stark"). This is NOT a contradiction
    // of the paramount. We only flag a TRUE contradiction when another entity in the region is
    // controlled by a DIFFERENT PARAMOUNT house (not a sub-house/vassal of the same overlord).
    // To detect this, we check whether the disagreeing house is itself a paramount of another region.
    const paramountHouses = new Set(Object.values(seats).map(sId => {
      const c = this.dataManager.getCastle(sId);
      if (!c || !c.timeline) return null;
      const m = c.timeline.filter(t => t.year <= year);
      return m.length > 0 ? m[m.length - 1].house : null;
    }).filter(Boolean));

    if (paramountState && paramountState.house) {
      // A disagreement is only meaningful if the other house is ALSO a regional paramount.
      // Vassal houses (bolton, manderly, etc.) being in the same region is expected and correct.
      const trueDisagreements = entityStates.filter(s =>
        s.house !== paramountState.house &&
        s.house !== 'unknown' &&
        s.house !== 'contested' &&
        paramountHouses.has(s.house) // Only count disagreements from other paramount rulers
      );

      if (trueDisagreements.length > 0) {
        // Another paramount house is holding a castle in this region — genuinely ambiguous.
        return {
          house: 'unknown',
          lord: 'Unknown',
          title: 'Unknown',
          status: 'unknown',
          reason: `Rival paramount house in region at ${year} AC (paramount: ${paramountState.house}, rival: ${[...new Set(trueDisagreements.map(d => d.house))].join(', ')})`,
          sourceLocId: paramountState.sourceLocId,
          sourceFile: paramountState.sourceFile
        };
      }

      // All in-region entities are either vassal houses or agree with the paramount. Return paramount state.
      return {
        house: paramountState.house,
        lord: paramountState.lord,
        title: paramountState.title,
        status: paramountState.status,
        sourceLocId: paramountState.sourceLocId,
        sourceFile: paramountState.sourceFile
      };
    }

    // Paramount seat has no data. Try to derive consensus from other region entities.
    if (entityStates.length > 0) {
      const paramHouses = entityStates.filter(s => paramountHouses.has(s.house));
      if (paramHouses.length === 1) {
        // Exactly one paramount house in the region — it's the controller.
        const rep = paramHouses[0];
        return {
          house: rep.house, lord: rep.lord,
          title: rep.title, status: rep.status,
          sourceLocId: rep.sourceLocId, sourceFile: rep.sourceFile
        };
      } else if (paramHouses.length > 1) {
        return {
          house: 'unknown', lord: 'Unknown', title: 'Unknown', status: 'unknown',
          reason: `Multiple rival paramounts found at ${year} AC: ${paramHouses.map(p => p.house).join(', ')}`,
          sourceFile: 'data/locations/locations.json'
        };
      }
      // Only vassal houses — fall through to ultimate fallback
    }

    // Ultimate fallback when no data at all.
    return { house: 'unknown', lord: 'Unknown Lord', title: 'Lord', status: 'unknown' };
  }


  resolveDragons(year) {
    return this.dataManager.data.dragons
      .filter(dragon => {
        const born = dragon.birth?.year;
        const died = dragon.death?.year;
        return Number.isFinite(born) && born <= year && (!Number.isFinite(died) || died >= year);
      })
      .map(dragon => dragon.id);
  }

  resolveEvents(year) {
    // Timeline selection means "events in this exact year", not a cumulative
    // historical log.  The pre-built index avoids scanning thousands of events
    // on every slider input and explicitly excludes records whose year is null.
    return [...(this.eventsByYear.get(year) || [])];
  }
}
