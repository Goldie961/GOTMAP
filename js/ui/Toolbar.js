import { createElement } from '../utils/helpers.js';

export class Toolbar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  init() {
    this.container.className = 'timeline-top-row';
    this.container.style.position = 'fixed';
    this.container.style.top = '15px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.width = '90%';
    this.container.style.maxWidth = '1100px';
    this.container.style.background = 'radial-gradient(circle, var(--parchment-light) 0%, var(--parchment) 100%)';
    this.container.style.border = '1px solid var(--gold)';
    this.container.style.borderRadius = '4px';
    this.container.style.padding = '0.5rem 1.5rem';
    this.container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    this.container.style.zIndex = '150';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'space-between';
    this.container.style.alignItems = 'center';

    // 1. App Title
    const title = createElement('h1', 'heading-primary', 'Atlas of Westeros');
    title.style.fontSize = '1.3rem';
    title.style.margin = '0';
    this.container.appendChild(title);

    // 2. Search Container (empty, SearchBar will populate it)
    const searchContainer = createElement('div', 'search-container');
    searchContainer.id = 'search-bar-target';
    searchContainer.style.flex = '1';
    searchContainer.style.maxWidth = '360px';
    searchContainer.style.margin = '0 2rem';
    searchContainer.style.position = 'relative';
    this.container.appendChild(searchContainer);

    // 3. Action Buttons
    const buttons = createElement('div', 'toolbar-buttons');
    buttons.style.display = 'flex';
    buttons.style.gap = '0.6rem';

    // Day/Night Toggle
    const nightBtn = createElement('button', 'timeline-play-btn');
    nightBtn.innerHTML = '☀';
    nightBtn.title = "Toggle Day/Night Mode";
    nightBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleDayNight'));
      nightBtn.innerHTML = nightBtn.innerHTML === '☀' ? '🌙' : '☀';
    });
    buttons.appendChild(nightBtn);

    // Season Toggle
    const seasonBtn = createElement('button', 'timeline-play-btn');
    seasonBtn.innerHTML = '🍃';
    seasonBtn.title = "Toggle Season (Summer/Winter)";
    let isSummer = true;
    seasonBtn.addEventListener('click', () => {
      isSummer = !isSummer;
      document.dispatchEvent(new CustomEvent('seasonChanged', { detail: { season: isSummer ? 'summer' : 'winter' } }));
      seasonBtn.innerHTML = isSummer ? '🍃' : '❄';
    });
    buttons.appendChild(seasonBtn);

    // Filter Toggle
    const filterBtn = createElement('button', 'timeline-play-btn');
    filterBtn.innerHTML = '⚙';
    filterBtn.title = "Toggle Map Filters";
    filterBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleFilters'));
    });
    buttons.appendChild(filterBtn);

    // Distance Tool Toggle
    const distanceBtn = createElement('button', 'timeline-play-btn');
    distanceBtn.innerHTML = '📏';
    distanceBtn.title = "Distance Calculator";
    distanceBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleDistanceTool'));
    });
    buttons.appendChild(distanceBtn);

    this.container.appendChild(buttons);
  }
}
