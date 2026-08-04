import { stripEntityPrefix } from './helpers.js';

// `id_intern` is a provenance field carried over from the extraction pipeline.
// It is a string for almost every entity, but three locations (kings_landing,
// oldtown_city, storm_end) carry several extraction ids and store them as an
// array. Call sites that used `id_intern?.startsWith(...)` threw a TypeError for
// exactly those three — `?.` guards against null, not against "not a function" —
// and the exception aborted InfoPanel.open() before the panel was ever shown.
//
// The fix is normalization at load time (see DataManager.loadAll) so the rest of
// the code can assume an array, plus these predicates for the remaining reads.
// The predicates re-normalize defensively so they are also correct when handed a
// raw record that never passed through DataManager.

export function toInternIds(value) {
  if (Array.isArray(value)) return value.filter(id => typeof id === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function normalizeInternIds(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  return { ...entity, id_intern: toInternIds(entity.id_intern) };
}

export function hasInternPrefix(entity, prefix) {
  return toInternIds(entity?.id_intern).some(id => id.startsWith(prefix));
}

// `seat` is the same string-or-array defect as `id_intern`, one field over, and
// unlike that one it reached the interface: `formatStatus` printed the literal
// "[OBJECT OBJECT],[OBJECT OBJECT]" for the 26 houses whose seat is an array,
// and `getLocation` returned undefined for all 26, so those houses also lost the
// "show on map" button and the camera never flew to their seat.
//
// The array form is not a list of seats. It is a list of *provenance records*
// for one seat, each carrying `valoare` alongside the book it was read from.
// All 26 agree with themselves — the 5 that hold more than one record cite the
// same place from two books — so the id is the first non-null `valoare`, and the
// records are provenance the panel can now cite instead of discarding.
//
// The two shapes also disagree on notation: the 126 string seats are bare ids
// ("winterfell"), while the 26 array seats are prefixed ("LOCATION_BLACKTYDE").
// Normalizing means agreeing on one of them, so the value goes through the same
// prefix strip the rest of the project uses. Returning the raw `valoare` would
// leave `seat` carrying two conventions and `getLocation` still missing on 26 —
// which is the bug restated, not the fix.
//
// 7 of the 26 do not resolve even after stripping, because the extraction wrote
// a Romanian id where the location's id is English (CLAUDE.md §4.5). That is a
// data defect, not a code one, and is left to triage: this function does not
// guess at a mapping it has no source for.
//
// @returns {{id: string|null, sources: object[]}}
export function resolveSeat(value) {
  if (typeof value === 'string') {
    const id = stripEntityPrefix(value);
    return { id: id || null, sources: [] };
  }
  if (Array.isArray(value)) {
    const records = value.filter(record => record && typeof record === 'object');
    const raw = records.map(record => record.valoare).find(entry => typeof entry === 'string' && entry.trim());
    return { id: raw ? stripEntityPrefix(raw) || null : null, sources: records };
  }
  return { id: null, sources: [] };
}

export function matchesInternId(entity, id) {
  if (!id) return false;
  return toInternIds(entity?.id_intern).includes(id);
}
