/**
 * Surface entities — areas, not points.
 *
 * docs/TAXONOMIE_v2.md §4.3: water / landform / island / region are extents, not
 * positions, and get no marker. §4.4 is the interim rule until their polygons are
 * digitized: render them as a LABEL placed at the coordinate that already exists,
 * because a bay name written across the bay reads correctly and a lozenge in the
 * middle of the sea never does.
 *
 * Extracted from MapRenderer because the filter registry needs the same
 * classification to build the Geography category. It is the only closed
 * vocabulary that covers these entities: `subtip` is 572 values of free text and
 * `subtype` has not reached a single pinned location.
 */

export const SURFACE_TYPES = new Set(['water', 'watercourse', 'landform', 'island', 'region', 'route']);

// Keyed by id rather than by `type` because the F2 retyping has not reached the
// data. Measured on the working tree: all seven bays are still `type: "landmark"`,
// four islands and Yi Ti are still `castle`, Valyria is `ruins`. Reading `type`
// alone would put a castle silhouette on Leng and on the Doom of Valyria.
// The `type` test wins where it is already correct, so this list dissolves on its
// own as the retyping lands. Inventory: TAXONOMIE_v2 §4.1, 26 of the 78 pins.
export const SURFACE_KIND_BY_ID = new Map([
  ['sea_of_dorne', 'water'], ['the_bite', 'water'], ['blackwater_bay', 'water'],
  ['bay_of_ice', 'water'], ['ironman_s_bay', 'water'], ['bay_of_crabs', 'water'],
  ['gods_eye', 'water'],
  ['rainwood', 'landform'], ['wolfswood', 'landform'], ['kingswood', 'landform'],
  ['mountains_of_the_moon', 'landform'],
  ['tarth', 'island'], ['stepstones', 'island'], ['skagos', 'island'],
  ['three_sisters', 'island'], ['driftmark', 'island'], ['claw_isle', 'island'],
  ['naath', 'island'], ['leng', 'island'],
  ['rills', 'region'], ['lhazar', 'region'], ['yi_ti', 'region'],
  ['valyria', 'region'], ['sothoryos_continent', 'region'], ['ulthos_continent', 'region'],
  // `the_wall` is linear; §4.3 wants a polyline, which needs geometry that does
  // not exist yet. Until then it follows the same rule: a name, not a lozenge.
  ['the_wall', 'linear']
]);

// `red_watch` is deliberately absent: TAXONOMIE_v2 §4.1 leaves it undecided
// (`subtip: null`, no physical description) and sends it to manual triage.
// Classifying it here would be inventing canon.
export function getSurfaceKind(location) {
  if (SURFACE_TYPES.has(location?.type)) return location.type;
  return SURFACE_KIND_BY_ID.get(location?.id) || null;
}
