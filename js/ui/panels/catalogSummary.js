// Summary panel for the two catalogue collections, objects and titles.
//
// They share a shape and neither is reachable from the map, only from search:
// DataManager does not load them into any layer. Coverage — objects 276 records,
// `categorie` on 256, `descrieri` on 202; titles 94 records, 80 and 66.

import { t } from '../../i18n/index.js';
import { collectSources } from '../../utils/sources.js';
import { createMetaRow } from './parts.js';

// The loaded collections come from the dispatcher rather than from `window`:
// reaching for a global here made `matches` throw outside a browser, which is
// exactly where tests/panels.mjs exercises it.
function isIn(collection, entity, data) {
  return Boolean(entity?.id) && Boolean(data?.[collection]?.some(item => item.id === entity.id));
}

export const catalogSummary = {
  id: 'catalog',
  matches: (entity, data) => entity.type === 'object' || entity.type === 'title'
    || isIn('objects', entity, data) || isIn('titles', entity, data),
  kicker: (entity, context) => (entity.type === 'title' || isIn('titles', entity, context?.data))
    ? t('info.kind.title')
    : t('info.kind.object'),
  crest: () => null,

  facts(entity) {
    const rows = [];
    const category = entity.categorie || entity.category || entity.type;
    if (category) rows.push(createMetaRow(t('info.type'), category, 'canon'));

    const sources = collectSources(entity);
    if (sources.length) {
      rows.push(createMetaRow(t('info.catalogSources'), String(sources.length), 'canon', sources));
    }
    return rows;
  }
};
