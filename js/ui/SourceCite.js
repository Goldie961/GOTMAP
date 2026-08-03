// The visible half of the provenance fix (see js/utils/sources.js for the data
// half): a citation collapses to one discreet chip next to the claim it
// supports, and expands on click into one line per book.
//
// Second occurrence rule (§8): InfoPanel and WikiPage both needed this, so it
// lives here rather than being written twice.

import { createElement } from '../utils/helpers.js';
import { t } from '../i18n/index.js';
import { collectSources, groupSourcesByBook } from '../utils/sources.js';

// Enough pages to show the citation is real, few enough that the detail does not
// become the wall it replaced. The remainder stays one click further in — the
// page list is never truncated away, only folded.
const VISIBLE_PAGES = 8;

let citeSequence = 0;

function appendPageList(host, pages) {
  if (!pages.length) return;
  const visible = pages.slice(0, VISIBLE_PAGES);
  const hidden = pages.slice(VISIBLE_PAGES);
  const list = createElement('span', 'source-cite-pages', t('source.pages', { pages: visible.join(', ') }));
  host.appendChild(list);
  if (!hidden.length) return;

  const more = createElement('button', 'source-cite-more', t('source.morePages', { count: hidden.length }));
  more.type = 'button';
  more.addEventListener('click', event => {
    event.stopPropagation();
    list.textContent = t('source.pages', { pages: pages.join(', ') });
    more.remove();
  });
  host.appendChild(more);
}

function buildGroupLine(group) {
  const line = createElement('div', 'source-cite-line');
  line.appendChild(createElement('span', 'source-cite-book', group.book || t('source.unknownBook')));
  if (group.fragments.length) {
    line.appendChild(createElement('span', 'source-cite-fragment', t('source.fragments', { fragments: group.fragments.join(', ') })));
  }
  appendPageList(line, group.pages);
  for (const url of group.urls) {
    const link = createElement('a', 'source-cite-link', t('source.externalLink'));
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    line.appendChild(link);
  }
  return line;
}

/**
 * @param {object[]} sources normalized records from collectSources()
 * @returns {HTMLElement|null} null when there is nothing to cite, so callers can
 *   append unconditionally without producing an empty chip.
 */
export function createSourceCite(sources) {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (!list.length) return null;

  const groups = groupSourcesByBook(list);
  const wrapper = createElement('span', 'source-cite');
  const detailId = `source-cite-${++citeSequence}`;

  const toggle = createElement('button', 'source-cite-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', detailId);
  toggle.title = t('source.toggleTitle', { count: list.length });
  toggle.appendChild(createElement('span', 'source-cite-icon', '📖'));
  toggle.appendChild(createElement('span', 'source-cite-count', String(list.length)));

  const detail = createElement('div', 'source-cite-detail');
  detail.id = detailId;
  detail.hidden = true;
  groups.forEach(group => detail.appendChild(buildGroupLine(group)));

  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const open = detail.hidden;
    detail.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    wrapper.classList.toggle('open', open);
  });

  wrapper.appendChild(toggle);
  wrapper.appendChild(detail);
  return wrapper;
}

/** Convenience for the common case: read a record's provenance, then cite it. */
export function createRecordCite(record, fallback) {
  return createSourceCite(collectSources(record, fallback));
}

/** Sources laid out in full, for the page section whose subject *is* provenance. */
export function createSourceList(sources) {
  const groups = groupSourcesByBook(Array.isArray(sources) ? sources.filter(Boolean) : []);
  if (!groups.length) return null;
  const box = createElement('div', 'source-list');
  groups.forEach(group => box.appendChild(buildGroupLine(group)));
  return box;
}
