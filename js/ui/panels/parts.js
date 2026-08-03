// DOM primitives shared by every summary panel.
//
// InfoPanel.js used to carry these as methods alongside four full renderers, so
// every panel type reached into the same 1200-line file. They are functions here
// because none of them needs panel state — they take values and return nodes.

import { createElement, stripEntityPrefix } from '../../utils/helpers.js';
import { matchesInternId } from '../../utils/entities.js';
import { t, displayName } from '../../i18n/index.js';
import { createSourceCite } from '../SourceCite.js';
import { navigateToEntity, entityHref } from '../../router/links.js';

// How much of a long value list a summary row shows before folding. The panel is
// 420px wide and must not scroll, so this is deliberately tight; the full list is
// on the entity's page.
const SUMMARY_LIST_SHOWN = 3;

export function createDivider() {
  const divider = createElement('div', 'decorative-divider');
  divider.innerHTML = '<span>♦</span>';
  return divider;
}

function createConfidenceBadge(confidence) {
  const badge = createElement('span', `canon-badge ${confidence}`, confidence === 'canon' ? '✓' : confidence === 'inferred' ? '◇' : '?');
  badge.title = `Confidence: ${confidence}`;
  return badge;
}

export function createValueBadge(confidence = 'canon') {
  const badge = createElement('span', `canon-badge value-badge ${confidence}`, confidence === 'canon' ? '🟢' : confidence === 'inferred' ? '🟡' : '🔴');
  badge.title = `${String(confidence).toUpperCase()} source value`;
  return badge;
}

/** Resolve an id against every loaded collection, prefixed or not. */
function getEntityById(id) {
  if (!id) return null;
  const cleanId = stripEntityPrefix(id);
  const data = window.atlasDataManager?.data;
  const matches = item => item.id === id || matchesInternId(item, id) || item.id === cleanId;
  return window.atlasDataManager?.getAllLocations?.().find(matches)
    || data?.houses?.find(matches)
    || data?.characters?.find(matches)
    || null;
}

function openLinkedEntity(entity) {
  const location = ['castle', 'city', 'landmark'].includes(entity.type) ? entity : null;
  window.atlasApp?.selectEntity(entity, location);
}

export function createMetaRow(label, value, confidence = 'canon', sources = null) {
  const row = createElement('div', 'info-row');
  row.appendChild(createElement('span', 'info-label', label));
  const values = createElement('div', 'info-value');
  values.appendChild(createElement('span', 'info-value-text', String(value)));
  values.appendChild(createValueBadge(confidence));
  const cite = createSourceCite(sources);
  if (cite) values.appendChild(cite);
  row.appendChild(values);
  return row;
}

export function createLinkedMetaRow(label, entityId, confidence = 'canon') {
  const row = createElement('div', 'info-row');
  row.appendChild(createElement('span', 'info-label', label));
  const target = getEntityById(entityId);
  const link = createElement(target ? 'button' : 'span', target ? 'info-entity-link' : '', (target && displayName(target)) || String(entityId));
  if (target) link.addEventListener('click', () => openLinkedEntity(target));
  const values = createElement('div', 'info-value');
  values.appendChild(link);
  values.appendChild(createConfidenceBadge(confidence));
  row.appendChild(values);
  return row;
}

/**
 * The head of a long list, with the tail one click away. Nothing is dropped —
 * see the comment on SUMMARY_LIST_SHOWN for why the head is short.
 */
function appendFolded(host, nodes, visible, options = {}) {
  nodes.forEach((node, index) => {
    if (options.inline) node.classList.add('info-item');
    if (index >= visible) node.hidden = true;
    host.appendChild(node);
  });
  const foldedCount = nodes.length - visible;
  if (foldedCount <= 0) return;

  const button = createElement('button', 'info-more', t('info.showMore', { count: foldedCount }));
  button.type = 'button';
  // A bare button is invalid as a child of <ul>, so a stacked list gets an item.
  const holder = options.inline ? button : createElement('li', 'info-more-item');
  if (holder !== button) holder.appendChild(button);
  button.addEventListener('click', event => {
    event.stopPropagation();
    nodes.forEach(node => { node.hidden = false; });
    holder.remove();
  });
  host.appendChild(holder);
}

/** A row whose values are a list of entity links. */
export function createListRow(label, ids, confidence = 'canon', separator = 'dot') {
  const row = createElement('div', 'info-row');
  row.appendChild(createElement('span', 'info-label', label));
  const values = createElement('div', `info-value info-inline-list${separator === 'comma' ? ' info-list-comma' : ''}`);
  const nodes = ids.map(id => {
    const target = getEntityById(id);
    const node = createElement(target ? 'button' : 'span', target ? 'info-entity-link' : '', (target && displayName(target)) || String(id));
    if (target) node.addEventListener('click', () => openLinkedEntity(target));
    return node;
  });
  appendFolded(values, nodes, SUMMARY_LIST_SHOWN, { inline: true });
  values.appendChild(createConfidenceBadge(confidence));
  row.appendChild(values);
  return row;
}

export function formatRegionName(regionId) {
  if (!regionId) return null;
  return String(regionId).replace(/_/g, ' ').toUpperCase();
}

export function formatStatus(status) {
  if (!status) return null;
  return String(status).replace(/_/g, ' ').toUpperCase();
}

/**
 * The one action the summary panel offers: go read the whole record.
 *
 * An `<a>` to /wiki/:kind/:id rather than a button, so the address it leads to
 * is visible before the click and the page it opens is shareable after it.
 */
export function createFullPageButton(entity) {
  const href = entityHref(entity);
  const button = createElement(href ? 'a' : 'button', 'info-panel-full-page', t('info.fullPageButton'));
  if (href) button.href = href; else button.type = 'button';
  button.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
    event.preventDefault();
    if (!navigateToEntity(entity)) window.atlasApp?.wikiPage?.open(entity, { fromCompact: true });
  });
  return button;
}
