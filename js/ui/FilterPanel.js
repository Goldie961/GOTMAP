import { createElement } from '../utils/helpers.js';
import { LAYER_REGISTRY } from '../map/MapLayers.js';

// These are the normalized location subtypes expected by the expanded schema.
// Keep them visible even before the import supplies locations for every subtype.
const DEFAULT_LOCATION_SUBTYPES = [
  'castel', 'oraș', 'sat', 'ruine', 'turn', 'han', 'port', 'câmp de luptă',
  'fortăreață', 'oraș liber', 'reședință', 'templu', 'repere naturale'
];

const TYPE_TO_SUBTYPE = {
  castle: 'castel',
  city: 'oraș',
  town: 'sat',
  ruins: 'ruine',
  fortress: 'fortăreață',
  landmark: 'repere naturale'
};

function getLocationSubtype(location) {
  return location?.subtip || TYPE_TO_SUBTYPE[location?.type] || 'nespecificat';
}

export class FilterPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isOpen = false;

    // Build filters map dynamically from LAYER_REGISTRY.
    // Each key matches the layer ID in MapLayers; all layers default to visible.
    this.filters = Object.fromEntries(
      Object.keys(LAYER_REGISTRY).map(id => [id, true])
    );

    this.onFilterChangeCallback = null;
    this.onLocationSubtypeChangeCallback = null;
    this.locationSubtypeCounts = new Map();
    this.locationSubtypeFilters = new Map();
  }

  setLocationSubtypes(locations = []) {
    this.locationSubtypeCounts.clear();
    locations.forEach(location => {
      const subtype = getLocationSubtype(location);
      this.locationSubtypeCounts.set(subtype, (this.locationSubtypeCounts.get(subtype) || 0) + 1);
    });

    const subtypes = new Set([
      ...DEFAULT_LOCATION_SUBTYPES,
      ...this.locationSubtypeCounts.keys()
    ]);
    subtypes.forEach(subtype => {
      if (!this.locationSubtypeFilters.has(subtype)) this.locationSubtypeFilters.set(subtype, true);
    });

    // This method is intentionally callable before init, when the data loads,
    // and later after an import refresh.
    if (this.container?.querySelector('.location-subtype-filters')) {
      this.renderLocationSubtypeFilters();
    }
  }

  init() {
    this.container.className = 'filter-panel collapsed';

    const title = createElement('div', 'filter-title', 'Map Filters');
    this.container.appendChild(title);

    // Render checkbox options from LAYER_REGISTRY — label comes from registry, not hardcoded.
    Object.entries(LAYER_REGISTRY).forEach(([id, config]) => {
      const option = createElement('label', 'filter-option');

      const checkbox = createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.filters[id];
      checkbox.disabled = config.available === false;
      if (checkbox.disabled) option.title = 'This layer has no verified geometry on the world terrain yet.';
      checkbox.addEventListener('change', () => {
        this.filters[id] = checkbox.checked;
        if (this.onFilterChangeCallback) {
          this.onFilterChangeCallback(this.filters);
        }
      });

      const labelText = createElement('span', '', config.label);

      option.appendChild(checkbox);
      option.appendChild(labelText);
      this.container.appendChild(option);
    });

    this.renderLocationSubtypeFilters();
  }

  renderLocationSubtypeFilters() {
    const existing = this.container.querySelector('.location-subtype-filters');
    if (existing) existing.remove();

    const section = createElement('fieldset', 'location-subtype-filters');
    const legend = createElement('legend', 'filter-subtitle', 'Tip locație');
    section.appendChild(legend);

    [...this.locationSubtypeFilters.keys()]
      .sort((a, b) => a.localeCompare(b, 'ro'))
      .forEach(subtype => {
        const option = createElement('label', 'filter-option location-subtype-option');
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.locationSubtypeFilters.get(subtype);
        checkbox.dataset.locationSubtype = subtype;
        checkbox.addEventListener('change', () => {
          this.locationSubtypeFilters.set(subtype, checkbox.checked);
          if (this.onLocationSubtypeChangeCallback) {
            this.onLocationSubtypeChangeCallback(this.getVisibleLocationSubtypes());
          }
        });

        const count = this.locationSubtypeCounts.get(subtype) || 0;
        const label = createElement('span', '', `${subtype} (${count})`);
        option.append(checkbox, label);
        section.appendChild(option);
      });

    this.container.appendChild(section);
  }

  getVisibleLocationSubtypes() {
    return new Set(
      [...this.locationSubtypeFilters]
        .filter(([, isVisible]) => isVisible)
        .map(([subtype]) => subtype)
    );
  }

  onFilterChange(callback) {
    this.onFilterChangeCallback = callback;
  }

  onLocationSubtypeChange(callback) {
    this.onLocationSubtypeChangeCallback = callback;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.remove('collapsed');
    } else {
      this.container.classList.add('collapsed');
    }
  }
}
