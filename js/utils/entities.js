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

export function matchesInternId(entity, id) {
  if (!id) return false;
  return toInternIds(entity?.id_intern).includes(id);
}
