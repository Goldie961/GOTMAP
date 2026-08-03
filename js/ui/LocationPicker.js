import { createElement, debounce } from '../utils/helpers.js';
import { t, displayName } from '../i18n/index.js';
import { normalizeForSearch, allAliases } from '../i18n/entityName.js';

/**
 * A single search field that resolves to one location.
 *
 * Built rather than reusing SearchBar because SearchBar answers a different
 * question: it searches every entity kind, splits its results into "on the map"
 * and "in the encyclopedia", and hands the choice to the router. A distance
 * endpoint is never a character or an event, is never navigated to, and must
 * include places the map cannot show — so the two components share no useful
 * behaviour beyond a text input and a dropdown.
 *
 * It indexes over whatever list it is given and matches every alias in every
 * language (INV-S1), so "Debarcaderul Regelui" and "King's Landing" both find
 * the same place regardless of interface language.
 */
const RESULT_LIMIT = 8;

export class LocationPicker {
  /**
   * @param {{slot: string, onPick: (location: object|null) => void}} options
   *   `slot` is 'a' or 'b' and only drives labels and test hooks.
   */
  constructor({ slot, onPick } = {}) {
    this.slot = slot || 'a';
    this.onPick = onPick || (() => {});
    this.locations = [];
    this.entries = [];
    this.selected = null;
    this.items = [];
    this.activeIndex = -1;
  }

  /** Build the DOM and return the root element for the caller to place. */
  render() {
    this.root = createElement('div', 'distance-picker');
    this.root.dataset.slot = this.slot;

    this.label = createElement('label', 'distance-picker-label', t(`distance.endpoint.${this.slot}`));
    this.label.setAttribute('for', `distance-picker-${this.slot}`);

    this.input = createElement('input', 'distance-picker-input');
    this.input.type = 'search';
    this.input.id = `distance-picker-${this.slot}`;
    this.input.autocomplete = 'off';
    this.input.placeholder = t('distance.searchPlaceholder');

    this.dropdown = createElement('div', 'distance-picker-dropdown');
    this.dropdown.style.display = 'none';

    this.root.append(this.label, this.input, this.dropdown);

    this.input.addEventListener('input', debounce(() => this.onInput(), 180));
    this.input.addEventListener('keydown', event => this.onKeyDown(event));
    this.input.addEventListener('focus', () => { if (this.input.value.trim()) this.onInput(); });
    // A click inside the dropdown blurs the input first, so closing is delayed
    // for the same reason SearchBar delays it.
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 180));

    return this.root;
  }

  /**
   * Supply the searchable set. Terms are folded once here rather than per
   * keystroke: the list is ~1100 entries with several aliases each.
   */
  setLocations(locations) {
    this.locations = Array.isArray(locations) ? locations : [];
    this.entries = this.locations.map(location => ({
      location,
      terms: [displayName(location), ...allAliases(location)]
        .filter(term => typeof term === 'string' && term)
        .map(normalizeForSearch)
    }));
  }

  /** Set the field without firing onPick — used by the pin-click shortcut. */
  setValue(location) {
    this.selected = location || null;
    this.input.value = location ? displayName(location) : '';
    this.close();
  }

  getValue() {
    return this.selected;
  }

  clear() {
    this.selected = null;
    this.input.value = '';
    this.close();
  }

  focus() {
    this.input.focus();
    this.input.select();
  }

  onInput() {
    const query = normalizeForSearch(this.input.value);
    // Typing after a pick invalidates it: the field must not keep reporting a
    // location the reader has edited away from.
    if (this.selected && normalizeForSearch(displayName(this.selected)) !== query) {
      this.selected = null;
      this.onPick(null);
    }
    if (!query) {
      this.close();
      return;
    }

    const starts = [];
    const contains = [];
    for (const entry of this.entries) {
      if (entry.terms.some(term => term.startsWith(query))) starts.push(entry);
      else if (entry.terms.some(term => term.includes(query))) contains.push(entry);
      if (starts.length >= RESULT_LIMIT) break;
    }
    this.renderResults([...starts, ...contains].slice(0, RESULT_LIMIT));
  }

  renderResults(entries) {
    this.dropdown.innerHTML = '';
    this.items = [];
    this.activeIndex = -1;

    if (!entries.length) {
      this.dropdown.appendChild(createElement('div', 'distance-picker-empty', t('search.noResults')));
      this.dropdown.style.display = 'block';
      return;
    }

    entries.forEach(entry => {
      const item = createElement('div', 'distance-picker-option');
      const index = this.items.length;
      this.items.push(item);
      const name = createElement('span', 'distance-picker-option-name', displayName(entry.location));
      const meta = createElement('span', 'distance-picker-option-meta', entry.location.type || '');
      item.append(name, meta);
      item.addEventListener('mouseenter', () => this.highlight(index));
      // mousedown, not click: blur fires first and would close the dropdown.
      item.addEventListener('mousedown', event => {
        event.preventDefault();
        this.pick(entry.location);
      });
      this.dropdown.appendChild(item);
    });
    this.dropdown.style.display = 'block';
  }

  highlight(index) {
    this.items.forEach(item => item.classList.remove('active'));
    this.activeIndex = index;
    if (index >= 0 && index < this.items.length) this.items[index].classList.add('active');
  }

  pick(location) {
    this.selected = location;
    this.input.value = displayName(location);
    this.close();
    this.onPick(location);
  }

  onKeyDown(event) {
    if (this.dropdown.style.display === 'none' || !this.items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlight((this.activeIndex + 1) % this.items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlight((this.activeIndex - 1 + this.items.length) % this.items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex >= 0) this.items[this.activeIndex].dispatchEvent(new MouseEvent('mousedown'));
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  close() {
    this.dropdown.style.display = 'none';
    this.activeIndex = -1;
  }
}
