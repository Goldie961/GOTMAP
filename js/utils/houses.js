/**
 * Which house holds a location in a given year.
 *
 * Extracted because two callers must agree exactly: MapRenderer, which stamps
 * `data-house-id` on the crest badge it draws, and FilterPanel, which counts how
 * many badges a house filter would remove. When they disagreed, the panel
 * offered checkboxes for houses that held nothing on screen, reported wrong
 * counts, and left badges permanently hidden — a badge whose id the panel had
 * never heard of was absent from the "keep visible" set it emitted.
 *
 * The result is year-dependent. A house filter's count is only meaningful for
 * the year the map is currently showing.
 */
export function resolveRulingHouseId(location, year) {
  // An explicit `house` on the record wins outright: it is a stated fact, not an
  // inference from a timeline that may not reach the requested year.
  if (location?.house) return location.house;

  const timeline = Array.isArray(location?.timeline) ? location.timeline : [];
  const matches = timeline.filter(entry => entry?.year <= year);
  if (!matches.length) return 'unknown';

  const active = matches[matches.length - 1];
  return active?.house || active?.faction || 'unknown';
}
