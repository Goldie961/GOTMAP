// Summary panel for events.
//
// Coverage over the 1682 records: a year on 1561, `participanti` on 1416, a
// location on 875 — and a `description` on 20. The panel therefore leads with
// when and where, and never promises prose.

import { formatYear, stripEntityPrefix } from '../../utils/helpers.js';
import { isEventEntity } from '../../utils/entityKind.js';
import { t } from '../../i18n/index.js';
import { createListRow, createLinkedMetaRow, createMetaRow } from './parts.js';

/** Participants, deduplicated on the prefix-stripped id. */
export function uniqueParticipantIds(entity) {
  const raw = [...(entity.participanti || []), ...(entity.participants || [])];
  const seen = new Set();
  const ids = [];
  for (const participant of raw) {
    const id = typeof participant === 'object' ? (participant?.id || participant?.valoare) : participant;
    const key = id ? stripEntityPrefix(id) : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  return ids;
}

export const eventSummary = {
  id: 'event',
  matches: (entity, data) => isEventEntity(entity, data?.events),
  kicker: entity => t('info.eventSubtype', { type: entity.type || 'historical' }),
  crest: () => null,

  facts(entity) {
    const confidence = entity.confidence || entity.canon || entity.canon_status || 'canon';
    const rows = [];

    const year = entity.year ?? entity.an ?? entity.an_aproximativ;
    if (year !== undefined && year !== null && year !== '') {
      rows.push(createMetaRow(t('info.eventYear'), formatYear(year), confidence));
    }
    const locationId = entity.location || entity.locatie_id;
    if (locationId) {
      rows.push(createLinkedMetaRow(t('info.eventLocation'), locationId, confidence));
    }
    const participants = uniqueParticipantIds(entity);
    if (participants.length) {
      rows.push(createListRow(t('info.eventParticipants'), participants, confidence, 'comma'));
    }
    return rows;
  }
};
