import { createElement } from '../utils/helpers.js';

export class FilterPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isOpen = false;
    this.filters = {
      regions: true,
      coastlines: true,
      rivers: true,
      roads: true,
      forests: true,
      mountains: true,
      locations: true,
      labels: true
    };
    this.onFilterChangeCallback = null;
  }

  init() {
    this.container.className = 'filter-panel collapsed';

    const title = createElement('div', 'filter-title', 'Map Filters');
    this.container.appendChild(title);

    // Render checkbox options
    Object.keys(this.filters).forEach(key => {
      const option = createElement('label', 'filter-option');
      
      const checkbox = createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.filters[key];
      checkbox.addEventListener('change', () => {
        this.filters[key] = checkbox.checked;
        if (this.onFilterChangeCallback) {
          this.onFilterChangeCallback(this.filters);
        }
      });

      const labelText = createElement('span', '', this.formatLabel(key));
      
      option.appendChild(checkbox);
      option.appendChild(labelText);
      this.container.appendChild(option);
    });
  }

  onFilterChange(callback) {
    this.onFilterChangeCallback = callback;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.remove('collapsed');
    } else {
      this.container.classList.add('collapsed');
    }
  }

  formatLabel(key) {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
}
