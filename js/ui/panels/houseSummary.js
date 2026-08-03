// Summary panel for houses, factions and institutions.
//
// Coverage over the 229 house records: `region` and `type` 229, `seat` 152 and
// `words` 68 — and both of those live under `metadata`, never at the root. A
// lookup that read `entity.seat` resolved to undefined for every house.

import { t } from '../../i18n/index.js';
import { createMetaRow, formatRegionName, formatStatus } from './parts.js';
import { activeState } from './locationSummary.js';

export const houseSummary = {
  id: 'house',
  matches: entity => ['house', 'faction', 'institution'].includes(entity.type),
  kicker: entity => formatStatus(entity.type) || t('info.kind.house'),
  crest: entity => entity.id,
  words: entity => entity.words || entity.metadata?.words || null,

  facts(entity, context) {
    const state = activeState(entity, context.worldState?.year);
    const rows = [];

    if (entity.region) {
      rows.push(createMetaRow(t('info.region'), formatRegionName(entity.region), 'canon'));
    }
    const seat = entity.metadata?.seat || entity.seat || entity.city;
    if (seat) {
      rows.push(createMetaRow(t('info.seatCapital'), formatStatus(seat), 'canon'));
    }
    const leader = state?.lord || state?.leader;
    if (leader) {
      rows.push(createMetaRow(t('info.rulerLord'), leader, state.lord_canon || state.canon || 'inferred'));
    }
    return rows;
  }
};
