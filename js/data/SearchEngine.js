import { isLowCompletenessEntity } from '../utils/config.js';
import { stripEntityPrefix } from '../utils/helpers.js';
import { displayName, normalizeForSearch, allAliases } from '../i18n/entityName.js';

/**
 * INV-S1 — the index never depends on the interface language. It is built once,
 * with every term from every language, and `setLanguage` neither rebuilds nor
 * filters it: "King's Landing" must find the entity on the Romanian interface
 * and "Debarcaderul Regelui" must find it on the English one.
 *
 * The only language-dependent part is `name`, which is a projection used for
 * sorting and display and is refreshed in place by `refreshDisplayNames()`.
 */
export class SearchEngine {
  constructor(options = {}) {
    this.index = [];
    this.dataManager = null;
    this.language = options.language || 'ro';
  }

  buildIndex(dataManager, language = this.language) {
    this.index = [];
    this.dataManager = dataManager;
    this.language = language;
    const locations = dataManager.getAllLocations();

    locations.forEach(loc => {
      if (isLowCompletenessEntity(loc)) return;
      // Map region human name for readability
      const regionId = this.normalizeSearchField(loc.region, 'location region', loc.id);
      this.addEntry(loc, {
        type: loc.type,
        regionId,
        regionName: this.formatRegionName(regionId),
        coordinates: loc.coordinates
      });
    });

    // Index houses, factions, and institutions
    if (dataManager.data.houses) {
      dataManager.data.houses.forEach(house => {
        if (isLowCompletenessEntity(house)) return;
        const regionId = this.normalizeSearchField(house.region, 'house region', house.id);
        this.addEntry(house, {
          type: house.type || 'house',
          regionId,
          regionName: this.formatRegionName(regionId),
          seat: house.seat || house.city || null
        });
      });
    }

    // Index characters
    if (dataManager.data.characters) {
      dataManager.data.characters.forEach(char => {
        if (isLowCompletenessEntity(char)) return;
        const rawHouseId = this.normalizeSearchField(char.house || char.membru_al || '', 'character house', char.id);
        const houseId = stripEntityPrefix(rawHouseId);
        this.addEntry(char, {
          type: 'character',
          regionId: '',
          regionName: this.formatRegionName(houseId),
          house: houseId || null,
          timeline: char.timeline || []
        });
      });
    }

    // Index dragons
    if (dataManager.data.dragons) {
      dataManager.data.dragons.forEach(dragon => {
        if (isLowCompletenessEntity(dragon)) return;
        this.addEntry(dragon, {
          type: 'dragon',
          regionId: '',
          regionName: dragon.epithet || 'Dragon',
          epithet: dragon.epithet || null,
          timeline: dragon.timeline || []
        });
      });
    }

    // Index events
    if (dataManager.data.events) {
      dataManager.data.events.forEach(event => {
        if (isLowCompletenessEntity(event)) return;
        this.addEntry(event, { type: 'event', regionId: '', regionName: 'Event' });
      });
    }

    // Index objects if present
    if (dataManager.data.objects) {
      dataManager.data.objects.forEach(obj => {
        if (isLowCompletenessEntity(obj)) return;
        this.addEntry(obj, { type: 'object', regionId: '', regionName: 'Object' });
      });
    }

    // Index titles if present
    if (dataManager.data.titles) {
      dataManager.data.titles.forEach(title => {
        if (isLowCompletenessEntity(title)) return;
        this.addEntry(title, { type: 'title', regionId: '', regionName: 'Title' });
      });
    }
  }

  /**
   * One index entry. `searchTerms` is the language-independent half and is
   * computed once; `name` is the language-dependent projection.
   *
   * `searchTermsFolded` is precomputed because folding is the hot path: every
   * keystroke otherwise re-normalizes ~25.000 strings.
   */
  addEntry(entity, fields) {
    const searchTerms = this.extractSearchTerms(entity);
    this.index.push({
      id: entity.id,
      ...fields,
      entity,
      name: this.resolveEntryName(entity, fields),
      searchTerms,
      searchTermsFolded: searchTerms.map(normalizeForSearch)
    });
  }

  resolveEntryName(entity, fields) {
    const base = displayName(entity, this.language) || entity.id;
    return fields.epithet ? `${base} (${fields.epithet})` : base;
  }

  /**
   * Re-project display names after a language switch. INV-S1: `searchTerms` and
   * `searchTermsFolded` are deliberately left untouched, so the index length and
   * every match stay identical across the switch.
   */
  refreshDisplayNames(language) {
    if (language) this.language = language;
    this.index.forEach(entry => {
      if (entry.entity) entry.name = this.resolveEntryName(entry.entity, entry);
    });
    return this.index.length;
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

    // Every name field, in every language, unconditionally. Which of them the
    // interface happens to be showing is irrelevant here (INV-S1).
    addTerm(entity.name);
    addTerm(entity.name_ro);
    addTerm(entity.name_en);
    addTerm(entity.nume_canonic);
    addTerm(entity.nume);
    addTerm(entity.nume_generat);
    addTerm(entity.id);

    // `id_intern` carries the normalized Romanian form for 887 locations
    // (`LOCATION_DEBARCADERUL_REGELUI`). Part of bilingual search already works
    // through it, by accident of provenance; indexing it is intentional and is
    // covered by an assertion so a future cleanup does not drop it as "internal".
    if (Array.isArray(entity.id_intern)) {
      entity.id_intern.forEach(addTerm);
    } else if (typeof entity.id_intern === 'string') {
      addTerm(entity.id_intern);
    }

    // aliasuri + aliases_ro + aliases_en + aliases_unclassified. The
    // unclassified bucket is indexed but never displayed (§4.1).
    allAliases(entity).forEach(addTerm);

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

  /**
   * @param {string} cleanQuery  already lowercased and diacritic-folded
   * @param {string} tLower      likewise — see `normalizeForSearch`
   *
   * Folding happens before this function, on both sides, which is why all six
   * matching branches below inherit it from one place (INV-S2, §7.2).
   */
  scoreTerm(cleanQuery, tLower) {
    if (!tLower || typeof tLower !== 'string') return 0;

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
    // Folded once, then compared against terms folded at index time.
    const cleanQuery = normalizeForSearch(query);
    if (!cleanQuery) return [];

    const bestMatches = new Map();

    this.index.forEach(item => {
      let bestScore = 0;
      let bestMatchedAlias = null;
      const nameFolded = normalizeForSearch(item.name);

      // The displayed name is itself one of the indexed terms, so scoring the
      // term list covers it; scoring it separately would only double the work.
      const terms = item.searchTerms || [];
      const folded = item.searchTermsFolded || terms.map(normalizeForSearch);

      for (let i = 0; i < folded.length; i += 1) {
        const termScore = this.scoreTerm(cleanQuery, folded[i]);
        if (termScore <= bestScore) continue;
        bestScore = termScore;

        // The alias note only makes sense when what matched is not what is
        // displayed, and never for an internal id.
        const term = terms[i];
        bestMatchedAlias = (folded[i] !== nameFolded && !/^(LOCATION|PERSON|HOUSE|EVENT|OBJECT|TITLE)_/.test(term))
          ? term
          : null;
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
