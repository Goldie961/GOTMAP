import { createElement, debounce } from '../utils/helpers.js';
import { t, displayName } from '../i18n/index.js';
import { ENTITY_KINDS, entityKind } from '../router/routes.js';
import { navigateToEntity, entityHref } from '../router/links.js';

/**
 * The /wiki landing page: an encyclopedic index with a search of its own.
 *
 * Distinct from the map's search bar on purpose. That one answers "where is
 * this place" and its results move a camera; this one answers "what does the
 * project hold about X" and its results are pages. They share the index —
 * bilingual and diacritic-folded, INV-S1 — and nothing else.
 *
 * With no query it browses rather than sitting empty: 5280 indexed records are
 * only useful if you can see what kinds of thing are in there before you know
 * what to type.
 */

/** Results shown per query. The map's dropdown shows ten; a full page can afford more. */
const RESULT_LIMIT = 60;

/** Records listed per kind when browsing with no query. */
const BROWSE_LIMIT = 24;

export class WikiIndex {
  constructor() {
    this.host = null;
    this.searchEngine = null;
    this.dataManager = null;
    this.query = '';
    this.kindFilter = null;
    this.input = null;
    this.results = null;
  }

  init() {
    this.host = createElement('div', 'wiki-index');
    this.host.setAttribute('aria-hidden', 'true');
    document.getElementById('app').appendChild(this.host);
  }

  setSources({ searchEngine, dataManager }) {
    this.searchEngine = searchEngine;
    this.dataManager = dataManager;
  }

  get isOpen() {
    return this.host?.classList.contains('open') ?? false;
  }

  open() {
    this.render();
    this.host.classList.add('open');
    this.host.setAttribute('aria-hidden', 'false');
    // Deferred: focusing an element inside a container that is still
    // transitioning in scrolls it into view in the middle of the animation.
    requestAnimationFrame(() => this.input?.focus());
  }

  close() {
    this.host.classList.remove('open');
    this.host.setAttribute('aria-hidden', 'true');
  }

  render() {
    this.host.innerHTML = '';
    const page = createElement('article', 'wiki-index-document');

    const toolbar = createElement('div', 'wiki-toolbar');
    const close = createElement('button', 'wiki-close', t('wiki.close'));
    close.addEventListener('click', () => {
      const router = window.atlasApp?.router;
      if (router) router.back({ name: 'map', params: {} });
      else this.close();
    });
    toolbar.appendChild(close);
    page.appendChild(toolbar);

    const header = createElement('header', 'wiki-index-header');
    header.appendChild(createElement('p', 'wiki-kicker', t('wikiIndex.kicker')));
    header.appendChild(createElement('h1', '', t('wikiIndex.title')));
    header.appendChild(createElement('p', 'wiki-index-lede', t('wikiIndex.lede')));
    page.appendChild(header);

    this.input = createElement('input', 'wiki-index-search');
    this.input.type = 'search';
    this.input.value = this.query;
    this.input.placeholder = t('wikiIndex.searchPlaceholder');
    this.input.setAttribute('aria-label', t('wikiIndex.searchPlaceholder'));
    this.input.addEventListener('input', debounce(() => {
      this.query = this.input.value.trim();
      this.renderResults();
    }, 200));
    page.appendChild(this.input);

    page.appendChild(this.buildKindFilter());

    this.results = createElement('div', 'wiki-index-results');
    page.appendChild(this.results);

    this.host.appendChild(page);
    this.renderResults();
  }

  /** All kinds, plus an "everything" chip. Kinds the dataset has none of are omitted. */
  buildKindFilter() {
    const bar = createElement('div', 'wiki-index-kinds');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', t('wikiIndex.filterLabel'));

    const chip = (kind, label, count) => {
      const button = createElement('button', 'wiki-index-kind', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(this.kindFilter === kind));
      if (count !== null) button.appendChild(createElement('span', 'wiki-index-kind-count', String(count)));
      button.addEventListener('click', () => {
        this.kindFilter = kind;
        this.render();
      });
      return button;
    };

    bar.appendChild(chip(null, t('wikiIndex.allKinds'), null));
    for (const kind of ENTITY_KINDS) {
      const total = this.collectionFor(kind).length;
      if (total) bar.appendChild(chip(kind, t(`wikiIndex.kind.${kind}`), total));
    }
    return bar;
  }

  /**
   * The records of one kind.
   *
   * Locations come from the list that includes sub-locations: the Hightower
   * carries no pin but carries a sourced page, and an encyclopedia that hid it
   * would be hiding a record, not a marker.
   */
  collectionFor(kind) {
    const data = this.dataManager?.data || {};
    switch (kind) {
      case 'location': return this.dataManager?.getAllLocationsIncludingSubLocations?.() || [];
      case 'house': return data.houses || [];
      case 'character': return data.characters || [];
      case 'event': return data.events || [];
      case 'object': return data.objects || [];
      case 'title': return data.titles || [];
      case 'dragon': return data.dragons || [];
      default: return [];
    }
  }

  renderResults() {
    if (!this.results) return;
    this.results.innerHTML = '';
    if (this.query) this.renderSearchResults();
    else this.renderBrowse();
  }

  renderSearchResults() {
    // Over-fetch, then filter by kind: the engine scores across the whole index
    // and narrowing afterwards is what keeps a kind chip from starving a query
    // that has few matches of that kind near the top.
    const raw = this.searchEngine?.search(this.query, { limit: RESULT_LIMIT * 4 }) || [];
    const matches = raw
      .map(result => result.entity)
      .filter(Boolean)
      .filter(entity => !this.kindFilter || entityKind(entity, this.dataManager) === this.kindFilter);

    if (!matches.length) {
      this.results.appendChild(createElement('p', 'wiki-index-empty', t('wikiIndex.noResults', { query: this.query })));
      return;
    }

    const shown = matches.slice(0, RESULT_LIMIT);
    this.results.appendChild(createElement('p', 'wiki-index-count', t('wikiIndex.resultCount', {
      shown: shown.length,
      total: matches.length
    })));
    this.results.appendChild(this.buildList(shown));
  }

  /**
   * No query: show what is in here, by kind, alphabetically.
   *
   * The counts are the honest ones — the whole collection — while the list is a
   * window onto it. Saying "2288" and showing 24 is more useful than showing 24
   * and implying that is all there is.
   */
  renderBrowse() {
    const kinds = this.kindFilter ? [this.kindFilter] : ENTITY_KINDS;
    let rendered = 0;

    for (const kind of kinds) {
      const collection = this.collectionFor(kind);
      if (!collection.length) continue;
      rendered += 1;

      const section = createElement('section', 'wiki-index-section');
      const heading = createElement('h2', '', t(`wikiIndex.kind.${kind}`));
      heading.appendChild(createElement('span', 'wiki-index-kind-count', String(collection.length)));
      section.appendChild(heading);

      const sorted = [...collection]
        .sort((a, b) => displayName(a).localeCompare(displayName(b), 'ro'))
        .slice(0, this.kindFilter ? BROWSE_LIMIT * 6 : BROWSE_LIMIT);
      section.appendChild(this.buildList(sorted));

      if (sorted.length < collection.length) {
        section.appendChild(createElement('p', 'wiki-index-more', t('wikiIndex.andMore', {
          count: collection.length - sorted.length
        })));
      }
      this.results.appendChild(section);
    }

    if (!rendered) this.results.appendChild(createElement('p', 'wiki-index-empty', t('wikiIndex.emptyDataset')));
  }

  buildList(entities) {
    const list = createElement('ul', 'wiki-index-list');
    for (const entity of entities) {
      const item = createElement('li');
      const href = entityHref(entity);
      const link = createElement(href ? 'a' : 'button', 'wiki-entity-link', displayName(entity) || entity.id);
      if (href) link.href = href; else link.type = 'button';
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
        event.preventDefault();
        navigateToEntity(entity);
      });
      item.appendChild(link);

      const kind = entityKind(entity, this.dataManager);
      if (kind) item.appendChild(createElement('span', 'wiki-index-badge', t(`wikiIndex.kind.${kind}`)));
      list.appendChild(item);
    }
    return list;
  }
}
