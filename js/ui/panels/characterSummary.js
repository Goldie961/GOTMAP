// Summary panel for characters.
//
// Field coverage decides the order, not editorial taste. Measured over the 2288
// records: `titlu_curent` 1322, `membru_al` 631, `locatie_asociata` 456, and a
// numeric year on 24 (`born`) / 29 (`died`). `region` is null on all 2288, which
// is why this panel shows a house where the location panels show a region.

import { createElement, formatYear } from '../../utils/helpers.js';
import { isCharacterEntity } from '../../utils/entityKind.js';
import { t } from '../../i18n/index.js';
import { createLinkedMetaRow, createMetaRow } from './parts.js';

// `born` is an array on 2204 of 2288 records — and on the 14 that are non-empty
// it holds prose, not a year. Only the 24 integers are dates, so anything else
// must not reach formatYear(): it rendered as a bare " AC".
function numericYear(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const characterSummary = {
  id: 'character',
  matches: (entity, data) => isCharacterEntity(entity, data?.characters),
  kicker: () => t('info.kind.character'),
  crest: entity => entity.house || entity.membru_al || null,

  facts(entity) {
    const confidence = entity.confidence || entity.canon || entity.canon_status || 'unknown';
    const rows = [];

    if (entity.titlu_curent) {
      rows.push(createMetaRow(t('info.charCurrentTitle'), entity.titlu_curent, confidence));
    }
    if (entity.membru_al || entity.house) {
      rows.push(createLinkedMetaRow(t('info.charMemberOf'), entity.membru_al || entity.house, confidence));
    }
    if (entity.locatie_asociata) {
      rows.push(createLinkedMetaRow(t('info.charAssociatedLoc'), entity.locatie_asociata, confidence));
    }

    const born = numericYear(entity.born);
    const died = numericYear(entity.died);
    if (born !== null || died !== null) {
      const span = born !== null && died !== null
        ? `${formatYear(born)} – ${formatYear(died)}`
        : formatYear(born !== null ? born : died);
      rows.push(createMetaRow(born !== null && died !== null ? t('info.charYears') : (born !== null ? t('info.charBorn') : t('info.charDied')), span, confidence));
    }
    return rows;
  },

  /** Shown under the name when nothing else identifies the record. */
  fallbackNote(entity) {
    const aliases = entity.aliasuri;
    if (!aliases) return null;
    const list = Array.isArray(aliases) ? aliases : [aliases];
    return list.length ? createElement('div', 'info-panel-note', list.join(' · ')) : null;
  }
};
