import { createElement, debounce } from '../utils/helpers.js';

export class SearchBar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.input = null;
    this.dropdown = null;
    this.searchEngine = null;
    this.onSelectCallback = null;
    this.selectedIndex = -1;
  }

  init() {
    // Construct HTML structure
    this.input = createElement('input');
    this.input.type = 'text';
    this.input.placeholder = "Search Winterfell, The Eyrie...";
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

    // Shortcut '/' to focus
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== this.input) {
        e.preventDefault();
        this.input.focus();
      }
    });
  }

  setSearchEngine(engine) {
    this.searchEngine = engine;
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
      const results = this.searchEngine.search(query);
      this.renderResults(results);
    }
  }

  renderResults(results) {
    this.dropdown.innerHTML = '';
    this.selectedIndex = -1;

    if (results.length === 0) {
      const empty = createElement('div', '', "No locations found");
      empty.style.padding = '0.5rem 1rem';
      empty.style.fontStyle = 'italic';
      empty.style.color = 'var(--ink-light)';
      this.dropdown.appendChild(empty);
      this.dropdown.style.display = 'block';
      return;
    }

    results.forEach((res, idx) => {
      const item = createElement('div');
      item.style.padding = '0.5rem 1rem';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '0.6rem';
      item.style.borderBottom = '1px solid rgba(44, 24, 16, 0.05)';
      item.style.transition = 'background-color 0.2s';

      // Icon matching
      let icon = '📍';
      if (res.type === 'castle' || res.type === 'fortress') icon = '🏰';
      if (res.type === 'city') icon = '🏘';
      if (res.type === 'town' || res.type === 'port') icon = '⛵';
      if (res.type === 'landmark' || res.type === 'natural') icon = '🌲';

      item.innerHTML = `<span>${icon}</span> <strong style="color:var(--ink);">${res.name}</strong> <span style="font-size:0.8rem; color:var(--ink-light);">(${res.regionName})</span>`;

      item.addEventListener('mouseenter', () => this.highlightItem(idx));
      item.addEventListener('click', () => this.selectResult(res));

      this.dropdown.appendChild(item);
    });

    this.dropdown.style.display = 'block';
  }

  highlightItem(idx) {
    const items = this.dropdown.children;
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].style.background = 'none';
    }
    this.selectedIndex = idx;
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].style.background = 'rgba(197, 165, 90, 0.15)';
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
    const items = this.dropdown.children;
    if (this.dropdown.style.display === 'none') return;

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
