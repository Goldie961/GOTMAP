// How much is actually known about an entity, stated honestly.
//
// The dataset is uneven by construction: 1530 of the 2227 scored characters sit
// below 0.3 and only 40 reach 0.8. A reader who opens a sparse record should be
// told that up front, not left to infer it from six empty headings.
//
// Two independent measures, because they answer different questions:
//   - `scor_total` is the extraction pass's own judgement of the record. It is
//     not a character-only field: at runtime it is present on 2227 of 2288
//     characters, 1662 of 1689 events, 482 of 694 mappable locations and 213 of
//     236 houses.
//   - the section count is what this particular page could actually render.
// They disagree often and legitimately — `edmyn_tully` scores 0.00 and still
// fills three sections — so both are reported rather than reconciled.

// Boundaries taken from the distribution rather than picked round: 0.3 is where
// the 1530-record bulk ends, 0.8 is where the 40 well-covered records begin.
const RICH_THRESHOLD = 0.8;
const SPARSE_THRESHOLD = 0.3;

/** @returns {number|null} null when the record was never scored. */
export function readCompletenessScore(entity) {
  const score = entity?._completitudine?.scor_total;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

/** @returns {'rich'|'partial'|'sparse'|null} */
export function completenessBand(score) {
  if (typeof score !== 'number') return null;
  if (score >= RICH_THRESHOLD) return 'rich';
  if (score >= SPARSE_THRESHOLD) return 'partial';
  return 'sparse';
}

/**
 * The band implied by how much of the page could be built. Used for the entity
 * types that carry no `_completitudine` of their own.
 */
export function coverageBand(filled, total) {
  if (!total) return null;
  return completenessBand(filled / total);
}
