import { isLowCompletenessEntity } from '../utils/config.js';
import { stripEntityPrefix } from '../utils/helpers.js';

export class SearchEngine {
  constructor() {
    this.index = [];
    this.dataManager = null;
  }

  buildIndex(dataManager) {
    this.index = [];
    this.dataManager = dataManager;
    const locations = dataManager.getAllLocations();
    
    locations.forEach(loc => {
      if (isLowCompletenessEntity(loc)) return;
      // Map region human name for readability
      const regionId = this.normalizeSearchField(loc.region, 'location region', loc.id);
      const regionName = this.formatRegionName(regionId);
      const primaryName = loc.name || loc.nume_canonic || loc.nume || loc.id;

      this.index.push({
        id: loc.id,
        name: primaryName,
        type: loc.type,
        regionId,
        regionName: regionName,
        coordinates: loc.coordinates,
        searchTerms: this.extractSearchTerms(loc)
      });
    });

    // Index houses, factions, and institutions
    if (dataManager.data.houses) {
      dataManager.data.houses.forEach(house => {
        if (isLowCompletenessEntity(house)) return;
        const regionId = this.normalizeSearchField(house.region, 'house region', house.id);
        const primaryName = house.name || house.nume_canonic || house.nume || house.id;
        this.index.push({
          id: house.id,
          name: primaryName,
          type: house.type || 'house',
          regionId,
          regionName: this.formatRegionName(regionId),
          seat: house.seat || house.city || null,
          searchTerms: this.extractSearchTerms(house)
        });
      });
    }

    // Index characters
    if (dataManager.data.characters) {
      dataManager.data.characters.forEach(char => {
        if (isLowCompletenessEntity(char)) return;
        const rawHouseId = this.normalizeSearchField(char.house || char.membru_al || '', 'character house', char.id);
        const houseId = stripEntityPrefix(rawHouseId);
        const primaryName = char.name || char.nume_canonic || char.nume || char.id;
        this.index.push({
          id: char.id,
          name: primaryName,
          type: 'character',
          regionId: '',
          regionName: this.formatRegionName(houseId),
          house: houseId || null,
          timeline: char.timeline || [],
          searchTerms: this.extractSearchTerms(char)
        });
      });
    }

    // Index dragons
    if (dataManager.data.dragons) {
      dataManager.data.dragons.forEach(dragon => {
        if (isLowCompletenessEntity(dragon)) return;
        const primaryName = dragon.name || dragon.nume || dragon.id;
        const displayName = dragon.epithet ? `${primaryName} (${dragon.epithet})` : primaryName;
        this.index.push({
          id: dragon.id,
          name: displayName,
          type: 'dragon',
          regionId: '',
          regionName: dragon.epithet || 'Dragon',
          timeline: dragon.timeline || [],
          searchTerms: this.extractSearchTerms(dragon)
        });
      });
    }

    // Index events
    if (dataManager.data.events) {
      dataManager.data.events.forEach(event => {
        if (isLowCompletenessEntity(event)) return;
        const primaryName = event.name || event.nume_generat || event.nume || event.id;
        this.index.push({
          id: event.id,
          name: primaryName,
          type: 'event',
          regionId: '',
          regionName: 'Event',
          searchTerms: this.extractSearchTerms(event)
        });
      });
    }

    // Index objects if present
    if (dataManager.data.objects) {
      dataManager.data.objects.forEach(obj => {
        if (isLowCompletenessEntity(obj)) return;
        const primaryName = obj.name || obj.nume || obj.id;
        this.index.push({
          id: obj.id,
          name: primaryName,
          type: 'object',
          regionId: '',
          regionName: 'Object',
          searchTerms: this.extractSearchTerms(obj)
        });
      });
    }

    // Index titles if present
    if (dataManager.data.titles) {
      dataManager.data.titles.forEach(title => {
        if (isLowCompletenessEntity(title)) return;
        const primaryName = title.name || title.nume || title.id;
        this.index.push({
          id: title.id,
          name: primaryName,
          type: 'title',
          regionId: '',
          regionName: 'Title',
          searchTerms: this.extractSearchTerms(title)
        });
      });
    }
  }

  extractSearchTerms(entity) {
    const terms = [];
    const seen = new Set();
    
    const addTerm = (val) => {
      if (val && typeof val === 'string' && val.trim()) {
        const clean = val.trim();
        if (!seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          terms.push(clean);
        }
      }
    };

    addTerm(entity.name);
    addTerm(entity.nume_canonic);
    addTerm(entity.nume);
    addTerm(entity.nume_generat);
    addTerm(entity.id);

    if (Array.isArray(entity.id_intern)) {
      entity.id_intern.forEach(addTerm);
    } else if (typeof entity.id_intern === 'string') {
      addTerm(entity.id_intern);
    }

    if (Array.isArray(entity.aliasuri)) {
      entity.aliasuri.forEach(addTerm);
    } else if (typeof entity.aliasuri === 'string') {
      addTerm(entity.aliasuri);
    }

    return terms;
  }

  normalizeSearchField(value, fieldName, entityId) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    console.warn(`Search index: invalid ${fieldName} for ${entityId}; using "unknown".`, value);
    return 'unknown';
  }

  formatRegionName(regionId) {
    return regionId.replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Compute Levenshtein distance between two strings.
   * Uses an optimized single-row DP approach.
   */
  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    // Use shorter string as column to minimize memory
    if (a.length > b.length) [a, b] = [b, a];

    const aLen = a.length;
    const bLen = b.length;
    let prevRow = new Array(aLen + 1);

    for (let i = 0; i <= aLen; i++) prevRow[i] = i;

    for (let j = 1; j <= bLen; j++) {
      let prev = j;
      for (let i = 1; i <= aLen; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const val = Math.min(
          prevRow[i] + 1,       // deletion
          prev + 1,             // insertion
          prevRow[i - 1] + cost // substitution
        );
        prevRow[i - 1] = prev;
        prev = val;
      }
      prevRow[aLen] = prev;
    }

    return prevRow[aLen];
  }

  scoreTerm(cleanQuery, termStr) {
    if (!termStr || typeof termStr !== 'string') return 0;
    const tLower = termStr.toLowerCase();

    // Exact match
    if (tLower === cleanQuery) {
      return 100;
    }
    // Prefix match
    if (tLower.startsWith(cleanQuery)) {
      return 80;
    }
    // Query starts with term
    if (cleanQuery.startsWith(tLower)) {
      return 70;
    }

    // All query words match in term
    const qWords = cleanQuery.split(/\s+/).filter(w => w.length > 1);
    if (qWords.length > 1 && qWords.every(w => tLower.includes(w))) {
      return 90;
    }

    // Substring match
    if (tLower.includes(cleanQuery)) {
      return 60;
    }

    // Fuzzy Levenshtein match
    const queryLen = cleanQuery.length;
    const maxDist = queryLen <= 3 ? 1 : queryLen <= 6 ? 2 : 3;

    const dist = this.levenshtein(cleanQuery, tLower);
    if (dist <= maxDist) {
      return Math.max(1, 40 - dist * 10);
    }

    // Word-level fuzzy match
    const tWords = tLower.split(/\s+/);
    for (const tw of tWords) {
      const wd = this.levenshtein(cleanQuery, tw);
      if (wd <= maxDist) {
        return Math.max(1, 35 - wd * 10);
      }
    }

    return 0;
  }

  search(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    const bestMatches = new Map();

    this.index.forEach(item => {
      let bestScore = 0;
      let bestMatchedAlias = null;
      const nameLower = item.name.toLowerCase();

      // Primary name score
      const primaryScore = this.scoreTerm(cleanQuery, item.name);
      bestScore = primaryScore;

      // Check all search terms (aliases, id_intern, etc.)
      if (item.searchTerms) {
        item.searchTerms.forEach(term => {
          const tLower = term.toLowerCase();
          if (tLower === nameLower) return;

          const termScore = this.scoreTerm(cleanQuery, term);
          if (termScore > bestScore) {
            bestScore = termScore;
            // Only set matchedAlias if term is a human readable alias (not internal ID)
            if (!term.startsWith('LOCATION_') && !term.startsWith('PERSON_') && 
                !term.startsWith('HOUSE_') && !term.startsWith('EVENT_')) {
              bestMatchedAlias = term;
            }
          }
        });
      }

      if (bestScore > 0) {
        const itemId = item.id;
        const existing = bestMatches.get(itemId);
        if (!existing || existing.score < bestScore) {
          bestMatches.set(itemId, {
            ...item,
            score: bestScore,
            matchedAlias: bestMatchedAlias
          });
        }
      }
    });

    return Array.from(bestMatches.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}
