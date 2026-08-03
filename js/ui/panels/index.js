// The dispatcher: one ordered table, one lookup.
//
// InfoPanel.open() used to decide the entity kind with seven inline booleans and
// then fall through to a location template if none matched — which is how houses
// ended up rendered by the location branch. Order is significant and stated once
// here: the catch-all is last and explicit.

import { characterSummary } from './characterSummary.js';
import { eventSummary } from './eventSummary.js';
import { catalogSummary } from './catalogSummary.js';
import { houseSummary } from './houseSummary.js';
import { locationSummary } from './locationSummary.js';

export const SUMMARY_PANELS = [
  characterSummary,
  eventSummary,
  catalogSummary,
  houseSummary,
  locationSummary
];

// The runtime `type` each panel owns. DataManager assigns one to every entity it
// loads, so in the application this is what decides — see resolveSummaryPanel.
const PANEL_TYPES = new Map([
  ['character', characterSummary],
  ['event', eventSummary],
  ['object', catalogSummary],
  ['title', catalogSummary],
  ['house', houseSummary],
  ['faction', houseSummary],
  ['institution', houseSummary],
  ['castle', locationSummary],
  ['city', locationSummary],
  ['landmark', locationSummary]
]);

/**
 * An explicit type wins; collection membership is only the fallback.
 *
 * Ids are not unique across collections: 15 house ids are also character ids
 * (`dustin`, `piper`, `brax`, …), 22 location ids are also house ids. Resolving
 * by "is this id in the characters array" therefore renders House Dustin as a
 * person. The raw records carry `type: null` and get one assigned at load, so
 * the membership tests still matter for anything handed over unnormalised.
 *
 * @returns {object} always a panel: `locationSummary` is the documented
 *   fallback, so an unrecognised entity still gets a name, a kicker and a button
 *   rather than a blank container.
 */
export function resolveSummaryPanel(entity, data) {
  const byType = PANEL_TYPES.get(entity?.type);
  if (byType) return byType;

  return SUMMARY_PANELS.find(panel => {
    try {
      return panel.matches(entity, data);
    } catch (error) {
      // A predicate that throws is a data-shape bug, not a reason to show
      // nothing; tests/panels.mjs asserts that none of them does.
      console.error(`[InfoPanel] ${panel.id}.matches failed for ${entity?.id}:`, error);
      return false;
    }
  }) || locationSummary;
}
