// Summary panel for places (castle / city / landmark).
//
// Coverage over the 1041 location records: `type` 1041, `subtip` 866, `region`
// 333. Neither `house` nor `status` exists at the root on a single record — both
// come from the timeline entry in force at the displayed year, which is why they
// are resolved here rather than read.

import { t } from '../../i18n/index.js';
import { createLinkedMetaRow, createMetaRow, formatRegionName, formatStatus } from './parts.js';

/** The timeline entry in force at `year`, if any. */
export function activeState(entity, year) {
  const timeline = Array.isArray(entity.timeline) ? entity.timeline : [];
  const matches = timeline.filter(entry => entry.year <= year);
  return matches.length ? matches[matches.length - 1] : null;
}

export function rulingHouseId(entity, year) {
  const state = activeState(entity, year);
  return state?.house || state?.faction || entity.house || entity.faction || null;
}

export const locationSummary = {
  id: 'location',
  matches: entity => ['castle', 'city', 'landmark'].includes(entity.type),
  kicker: entity => formatStatus(entity.type) || t('info.kind.location'),
  crest: (entity, context) => rulingHouseId(entity, context.worldState?.year),

  facts(entity, context) {
    const year = context.worldState?.year;
    const state = activeState(entity, year);
    const rows = [];

    if (entity.region) {
      rows.push(createMetaRow(t('info.region'), formatRegionName(entity.region), 'canon'));
    }
    if (entity.subtip || entity.subtype) {
      rows.push(createMetaRow(t('info.subtype'), entity.subtip || entity.subtype, 'canon'));
    }
    const houseId = rulingHouseId(entity, year);
    if (houseId) {
      rows.push(createLinkedMetaRow(t('info.rulerHouse'), houseId, state?.canon || 'inferred'));
    }
    if (state?.lord) {
      rows.push(createMetaRow(t('info.rulerLord'), state.lord, state.lord_canon || 'inferred'));
    } else if (state?.status) {
      rows.push(createMetaRow(t('info.status'), formatStatus(state.status), state.status_canon || 'inferred'));
    }
    return rows;
  }
};
