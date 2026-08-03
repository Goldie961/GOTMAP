import { createElement } from '../utils/helpers.js';
import { LAYER_REGISTRY, getLayerCategories, getLayerChildren } from '../map/MapLayers.js';
import { resolveRulingHouseId } from '../utils/houses.js';
import { displayName, t } from '../i18n/index.js';

/**
 * FilterPanel
 *
 * Renders the tree declared in LAYER_REGISTRY. It contains no category of its
 * own — adding a filter means adding a registry entry, never editing this file.
 *
 * Two rules govern what appears:
 *
 *   1. Counts are AFFECTED PINS, not dataset entities. A leaf is measured
 *      against the locations the map actually draws.
 *   2. A control that cannot change anything visible is not rendered. Leaves
 *      with a zero count are dropped, and a category left with no surviving
 *      leaf is dropped with them.
 *
 * Together those turned 316 checkboxes — 283 of which could not affect a single
 * pin — into a two-level tree that opens with fewer than a dozen controls.
 */
export class FilterPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isOpen = false;

    // Static SVG layers keep their old flat behaviour and their own callback.
    this.filters = Object.fromEntries(
      Object.entries(LAYER_REGISTRY)
        .filter(([, config]) => config.kind === 'svgLayer')
        .map(([id]) => [id, true])
    );

    this.onFilterChangeCallback = null;
    this.onLocationFilterChangeCallback = null;
    this.onHouseFilterChangeCallback = null;

    this.leafFilters = new Map();   // registry leaf id -> checked
    this.houseFilters = new Map();  // house id -> checked
    this.openCategories = new Set(
      getLayerCategories().filter(([, config]) => config.defaultOpen).map(([id]) => id)
    );

    this.renderable = [];    // everything the map draws
    this.pointMarkers = [];  // the subset that can carry a crest badge
    this.year = 1;
    this.houseEntries = [];  // { id, house, count } for houses drawing a crest
  }

  /**
   * Supply the locations the map actually draws, from
   * MapRenderer.getRenderableLocations(). Counting anything wider — the dataset,
   * or getAllLocations() — is what produced the unusable flat list.
   */
  setRenderableLocations({ points = [], surfaces = [] } = {}, year = 1, houseLookup = null) {
    // Location leaves are matched against everything drawn; house leaves only
    // against point markers, because a surface label carries no crest badge.
    this.renderable = [...points, ...surfaces];
    this.pointMarkers = points;
    // Crest badges are resolved per year, so the Houses category is rebuilt
    // whenever the timeline moves: a house that holds nothing in the displayed
    // year must not offer a checkbox that removes nothing.
    this.year = year;
    this.houseEntries = this.collectHouseEntries(houseLookup);

    for (const [categoryId] of getLayerCategories()) {
      for (const [leafId] of getLayerChildren(categoryId)) {
        if (!this.leafFilters.has(leafId)) this.leafFilters.set(leafId, true);
      }
    }
    for (const entry of this.houseEntries) {
      if (!this.houseFilters.has(entry.id)) this.houseFilters.set(entry.id, true);
    }

    if (this.container?.querySelector('.filter-tree')) this.renderTree();
  }

  /** Houses that actually draw a crest badge, with how many markers each affects. */
  collectHouseEntries(houseLookup) {
    const resolve = houseLookup || (id => window.atlasDataManager?.getHouse?.(id));
    const counts = new Map();
    for (const location of this.pointMarkers) {
      // Same resolver the renderer uses to stamp data-house-id on the badge.
      const houseId = resolveRulingHouseId(location, this.year);
      if (!houseId || houseId === 'unknown') continue;
      const house = resolve(houseId);
      // No crest means no badge is drawn, so the checkbox could not change
      // anything visible and the house does not belong in the panel.
      if (!house?.crest) continue;
      const existing = counts.get(house.id);
      if (existing) existing.count += 1;
      else counts.set(house.id, { id: house.id, house, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count
      || displayName(a.house).localeCompare(displayName(b.house), 'ro'));
  }

  /** Rendered locations a registry leaf governs. */
  affectedBy(leafId) {
    const config = LAYER_REGISTRY[leafId];
    if (typeof config?.matches !== 'function') return [];
    return this.renderable.filter(location => {
      try {
        return config.matches(location);
      } catch {
        // A predicate must never take the panel down with it; a leaf that throws
        // simply governs nothing and disappears by the zero-count rule.
        return false;
      }
    });
  }

  /** Categories that survive the zero-count rule, with their surviving leaves. */
  visibleTree() {
    const tree = [];
    for (const [categoryId, config] of getLayerCategories()) {
      if (config.kind === 'houseFilter') {
        if (this.houseEntries.length) {
          tree.push({
            id: categoryId,
            config,
            leaves: this.houseEntries.map(entry => ({
              id: entry.id,
              label: displayName(entry.house),
              count: entry.count,
              isHouse: true
            }))
          });
        }
        continue;
      }
      const leaves = getLayerChildren(categoryId)
        .map(([leafId, leafConfig]) => ({
          id: leafId,
          label: leafConfig.label,
          count: this.affectedBy(leafId).length,
          isHouse: false
        }))
        .filter(leaf => leaf.count > 0);
      if (leaves.length) tree.push({ id: categoryId, config, leaves });
    }
    return tree;
  }

  init() {
    // Re-entrant: a language switch calls this again. Checkbox state lives in
    // this.filters / this.leafFilters / this.houseFilters, so rebuilding from an
    // empty container preserves the user's selection while refreshing labels.
    this.container.innerHTML = '';
    this.container.className = `filter-panel${this.isOpen ? '' : ' collapsed'}`;
    this.container.appendChild(createElement('div', 'filter-title', t('filter.title')));

    const tree = createElement('div', 'filter-tree');
    this.container.appendChild(tree);
    this.renderTree();

    // Static layers stay a flat list below the tree; they are not categories.
    Object.entries(LAYER_REGISTRY)
      .filter(([, config]) => config.kind === 'svgLayer')
      .forEach(([id, config]) => {
        const option = createElement('label', 'filter-option filter-layer-option');
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.filters[id];
        checkbox.disabled = config.available === false;
        if (checkbox.disabled) option.title = t('filter.disabledLayer');
        checkbox.addEventListener('change', () => {
          this.filters[id] = checkbox.checked;
          this.onFilterChangeCallback?.(this.filters);
        });
        option.append(checkbox, createElement('span', '', config.label));
        this.container.appendChild(option);
      });
  }

  renderTree() {
    const host = this.container?.querySelector('.filter-tree');
    if (!host) return;
    host.innerHTML = '';

    const tree = this.visibleTree();
    if (!tree.length) {
      host.appendChild(createElement('p', 'filter-empty', t('filter.noneAffectMap')));
      return;
    }

    for (const category of tree) {
      const details = createElement('details', 'filter-category');
      details.open = this.openCategories.has(category.id);
      details.addEventListener('toggle', () => {
        if (details.open) this.openCategories.add(category.id);
        else this.openCategories.delete(category.id);
      });

      const total = category.leaves.reduce((sum, leaf) => sum + leaf.count, 0);
      const summary = createElement('summary', 'filter-category-summary');
      summary.append(
        createElement('span', 'filter-category-label', category.config.label),
        createElement('span', 'filter-category-count', String(total))
      );
      details.appendChild(summary);

      const actions = createElement('div', 'filter-category-actions');
      const allButton = createElement('button', 'filter-select-all', t('filter.selectAll'));
      allButton.type = 'button';
      allButton.addEventListener('click', () => this.setCategory(category, true));
      const noneButton = createElement('button', 'filter-select-none', t('filter.selectNone'));
      noneButton.type = 'button';
      noneButton.addEventListener('click', () => this.setCategory(category, false));
      actions.append(allButton, noneButton);
      details.appendChild(actions);

      for (const leaf of category.leaves) {
        const store = leaf.isHouse ? this.houseFilters : this.leafFilters;
        const option = createElement('label', 'filter-option filter-leaf-option');
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = store.get(leaf.id) !== false;
        checkbox.dataset.filterLeaf = leaf.id;
        checkbox.addEventListener('change', () => {
          store.set(leaf.id, checkbox.checked);
          this.emit(leaf.isHouse);
        });
        // The number is the count of map features this control removes, which is
        // the only number that tells the reader whether it is worth clicking.
        option.append(
          checkbox,
          createElement('span', 'filter-leaf-label', leaf.label),
          createElement('span', 'filter-leaf-count', String(leaf.count))
        );
        details.appendChild(option);
      }

      host.appendChild(details);
    }
  }

  setCategory(category, checked) {
    const store = category.config.kind === 'houseFilter' ? this.houseFilters : this.leafFilters;
    for (const leaf of category.leaves) store.set(leaf.id, checked);
    this.renderTree();
    this.emit(category.config.kind === 'houseFilter');
  }

  emit(isHouse) {
    if (isHouse) this.onHouseFilterChangeCallback?.(this.getVisibleHouseIds());
    else this.onLocationFilterChangeCallback?.(this.getVisibleLocationIds());
  }

  /**
   * Ids of the locations that should stay on the map.
   *
   * A location governed by no surviving leaf stays visible. Hiding it would make
   * an unrepresented location vanish with no control able to bring it back.
   */
  getVisibleLocationIds() {
    const hidden = new Set();
    for (const [leafId, isVisible] of this.leafFilters) {
      if (isVisible) continue;
      for (const location of this.affectedBy(leafId)) hidden.add(location.id);
    }
    return new Set(
      this.renderable.filter(location => !hidden.has(location.id)).map(location => location.id)
    );
  }

  getVisibleHouseIds() {
    return new Set(
      this.houseEntries
        .filter(entry => this.houseFilters.get(entry.id) !== false)
        .map(entry => entry.id)
    );
  }

  onFilterChange(callback) {
    this.onFilterChangeCallback = callback;
  }

  onLocationFilterChange(callback) {
    this.onLocationFilterChangeCallback = callback;
  }

  onHouseFilterChange(callback) {
    this.onHouseFilterChangeCallback = callback;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle('collapsed', !this.isOpen);
  }
}
