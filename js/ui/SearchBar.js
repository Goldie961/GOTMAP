import { createElement, debounce } from '../utils/helpers.js';
import { t, nameDescriptor } from '../i18n/index.js';

/**
 * How many matches to score before splitting them.
 *
 * The dropdown shows a handful, but it now shows a handful *of each kind*, and
 * the engine returns results in score order without regard for the split. Ten
 * would routinely be ten events, leaving the map section empty on a query that
 * had places further down.
 */
const FETCH_LIMIT = 60;

/** Rows shown per section. Two short lists read faster than one long one. */
const SECTION_LIMIT = 6;

export class SearchBar {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.input = null;
    this.dropdown = null;
    this.searchEngine = null;
    this.onSelectCallback = null;
    this.mapTargetResolver = null;
    /** The selectable rows of the last render, across both sections. */
    this.items = [];
    this.selectedIndex = -1;
    this.shortcutBound = false;
  }

  init() {
    // The Toolbar owns this container and recreates it on every language
    // switch, so the reference captured at construction is stale by then.
    this.container = document.getElementById(this.containerId) || this.container;
    this.container.innerHTML = '';

    // Construct HTML structure
    this.input = createElement('input');
    this.input.type = 'text';
    this.input.placeholder = t('search.placeholder');
    this.input.style.width = '100%';
    this.input.style.padding = '0.4rem 1rem';
    this.input.style.border = '1px solid var(--parchment-dark)';
    this.input.style.background = 'var(--parchment-light)';
    this.input.style.fontFamily = 'Crimson Text, serif';
    this.input.style.fontSize = '0.95rem';
    this.input.style.borderRadius = '3px';
    this.input.style.outline = 'none';

    this.input.addEventListener('focus', () => {
      this.input.style.borderColor = 'var(--gold)';
      this.input.style.boxShadow = '0 0 5px var(--gold)';
    });

    this.input.addEventListener('blur', () => {
      this.input.style.borderColor = 'var(--parchment-dark)';
      this.input.style.boxShadow = 'none';
      // Delay closing to allow clicking the dropdown results
      setTimeout(() => this.closeDropdown(), 200);
    });

    this.dropdown = createElement('div');
    this.dropdown.style.position = 'absolute';
    this.dropdown.style.top = '100%';
    this.dropdown.style.left = '0';
    this.dropdown.style.width = '100%';
    this.dropdown.style.background = 'radial-gradient(circle, var(--parchment-light) 0%, var(--parchment) 100%)';
    this.dropdown.style.border = '1px solid var(--gold)';
    this.dropdown.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
    this.dropdown.style.borderRadius = '3px';
    this.dropdown.style.maxHeight = '280px';
    this.dropdown.style.overflowY = 'auto';
    this.dropdown.style.display = 'none';
    this.dropdown.style.zIndex = '300';

    this.container.appendChild(this.input);
    this.container.appendChild(this.dropdown);

    // Event listeners
    this.input.addEventListener('input', debounce(this.onInput.bind(this), 250));
    this.input.addEventListener('keydown', this.onKeyDown.bind(this));

    // Shortcut '/' to focus. Bound to the window, so it must not be re-bound
    // when init() runs again for a language switch.
    if (!this.shortcutBound) {
      this.shortcutBound = true;
      window.addEventListener('keydown', (e) => {
        const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        if ((e.key === '/' || isCtrlK) && document.activeElement !== this.input) {
          e.preventDefault();
          this.input.focus();
          this.input.select();
        }
      });
    }
  }

  setSearchEngine(engine) {
    this.searchEngine = engine;
  }

  /**
   * Supply the predicate that decides which section a result belongs in.
   *
   * Injected rather than imported so that this component keeps knowing nothing
   * about the catalog, the year or the anchor rule — and so that the label a
   * reader clicks is produced by the very function that will handle the click.
   *
   * @param {(entity: object) => object|null} resolver
   */
  setMapTargetResolver(resolver) {
    this.mapTargetResolver = resolver;
  }

  onSelect(callback) {
    this.onSelectCallback = callback;
  }

  onInput() {
    const query = this.input.value.trim();
    if (!query) {
      this.closeDropdown();
      return;
    }

    if (this.searchEngine) {
      this.renderResults(this.searchEngine.search(query, { limit: FETCH_LIMIT }));
    }
  }

  /**
   * Two sections, because the map's search answers two different questions.
   *
   * "On the map" is a promise: every row in it flies the camera. "In the
   * encyclopedia" is the honest home for everything else — events, characters,
   * objects, titles, and the 614 places the project has catalogued but not yet
   * calibrated. Castle Black is a castle and appears here, not because it is
   * not a place but because the map cannot yet say where it is; clicking it
   * opens its page rather than pretending to zoom.
   *
   * The split is recomputed per query from the catalog, so calibrating a castle
   * moves it between the sections with no code change.
   */
  renderResults(results) {
    this.dropdown.innerHTML = '';
    this.selectedIndex = -1;
    this.items = [];

    const onMap = [];
    const encyclopedia = [];
    for (const res of results) {
      const entity = res.entity || res;
      (this.mapTargetResolver?.(entity) ? onMap : encyclopedia).push(res);
    }

    if (!onMap.length && !encyclopedia.length) {
      const empty = createElement('div', 'search-empty', t('search.noResults'));
      this.dropdown.appendChild(empty);
      this.dropdown.style.display = 'block';
      return;
    }

    this.appendSection(t('search.section.onMap'), onMap.slice(0, SECTION_LIMIT), 'map');
    this.appendSection(t('search.section.encyclopedia'), encyclopedia.slice(0, SECTION_LIMIT), 'encyclopedia');
    this.dropdown.style.display = 'block';
  }

  appendSection(title, results, kind) {
    if (!results.length) return;
    const header = createElement('div', `search-section-title search-section-${kind}`, title);
    this.dropdown.appendChild(header);
    for (const res of results) this.dropdown.appendChild(this.buildResultItem(res, kind));
  }

  /** Icon by indexed type. Unchanged from the flat list; only the home moved. */
  iconFor(type) {
    if (type === 'castle' || type === 'fortress' || type === 'stronghold') return '🏰';
    if (type === 'city') return '🏘';
    if (type === 'town' || type === 'port') return '⛵';
    if (type === 'landmark' || type === 'natural' || type === 'ruins') return '🌲';
    if (type === 'house' || type === 'faction' || type === 'institution') return '🛡️';
    if (type === 'character') return '👤';
    if (type === 'dragon') return '🐉';
    if (type === 'event') return '⚔️';
    if (type === 'object') return '🗡️';
    if (type === 'title') return '👑';
    return '📍';
  }

  buildResultItem(res, kind) {
    const item = createElement('div', `search-result search-result-${kind}`);
    const index = this.items.length;
    this.items.push(item);

    // Avoid showing empty parentheses if regionName is empty
    const regionSpan = res.regionName ? ` <span class="search-result-region">(${res.regionName})</span>` : '';
    // INV-S3: the result is shown in the interface language but declares the
    // term that actually matched, so a Romanian query on the English
    // interface explains itself. Independent of which section it landed in —
    // both stay bilingual because both read the same index (INV-S1).
    const aliasSpan = res.matchedAlias ? ` <span class="search-result-alias">${t('search.matchedAlias', { alias: res.matchedAlias })}</span>` : '';
    const descriptor = nameDescriptor(res.entity || res);
    const badgeCode = descriptor.badgeLang === 'ro' || descriptor.badgeLang === 'en' ? descriptor.badgeLang : descriptor.badgeLang ? 'unknown' : null;
    const badgeSpan = badgeCode
      ? ` <span class="lang-badge lang-badge-${badgeCode}" title="${t('lang.untranslated')}">${t(`lang.badge.${badgeCode}`)}</span>`
      : '';
    item.innerHTML = `<span>${this.iconFor(res.type)}</span> <strong class="search-result-name">${res.name}</strong>${badgeSpan}${regionSpan}${aliasSpan}`;

    item.addEventListener('mouseenter', () => this.highlightItem(index));
    item.addEventListener('click', () => this.selectResult(res));
    return item;
  }

  highlightItem(idx) {
    // Indexes the selectable rows, not the dropdown's children: the section
    // headings are children too, and arrowing onto one would look like a dead
    // keypress.
    const items = this.items || [];
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].classList.remove('active');
    }
    this.selectedIndex = idx;
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].classList.add('active');
    }
  }

  selectResult(res) {
    this.input.value = res.name;
    this.closeDropdown();
    if (this.onSelectCallback) {
      this.onSelectCallback(res);
    }
  }

  onKeyDown(e) {
    const items = this.items || [];
    if (this.dropdown.style.display === 'none' || !items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = this.selectedIndex + 1;
      if (next >= items.length) next = 0;
      this.highlightItem(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = this.selectedIndex - 1;
      if (prev < 0) prev = items.length - 1;
      this.highlightItem(prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
        items[this.selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      this.closeDropdown();
    }
  }

  closeDropdown() {
    this.dropdown.style.display = 'none';
    this.selectedIndex = -1;
  }
}
