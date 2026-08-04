// Summary panel for houses, factions and institutions.
//
// Coverage over the 229 house records: `region` and `type` 229, `seat` 152 and
// `words` 68 — and both of those live under `metadata`, never at the root. A
// lookup that read `entity.seat` resolved to undefined for every house.

import { t } from '../../i18n/index.js';
import { createMetaRow, formatRegionName, formatStatus } from './parts.js';
import { activeState } from './locationSummary.js';
import { resolveSeat } from '../../utils/entities.js';
import { dedupeSources, normalizeSource } from '../../utils/sources.js';

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
    // The root field first, because that is the normalized one. Reading
    // `metadata.seat` first is what put "[OBJECT OBJECT],[OBJECT OBJECT]" in
    // front of 26 houses: `formatStatus` stringifies whatever it is handed, and
    // for those the raw value is a list of provenance records.
    // `seat_sources` is what DataManager kept aside; re-deriving it from the
    // root `seat` would find nothing, because by then it is already a plain
    // string. resolveSeat is the fallback for a raw record that never passed
    // through the compatibility pass.
    const resolved = resolveSeat(entity.seat ?? entity.metadata?.seat);
    const seat = resolved.id;
    const seatSources = entity.seat_sources?.length ? entity.seat_sources : resolved.sources;
    const seatValue = seat || entity.city;
    if (seatValue) {
      // Those records are exactly the citation the row used to throw away: each
      // names the book the seat was read from. The green "canon" badge was
      // already claiming provenance — now it can show it.
      const cite = dedupeSources(seatSources.map(normalizeSource).filter(Boolean));
      rows.push(createMetaRow(t('info.seatCapital'), formatStatus(seatValue), 'canon', cite));
    }
    const leader = state?.lord || state?.leader;
    if (leader) {
      rows.push(createMetaRow(t('info.rulerLord'), leader, state.lord_canon || state.canon || 'inferred'));
    }
    return rows;
  }
};
