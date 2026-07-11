import { createElement, formatYear } from '../utils/helpers.js';

export class Timeline {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.slider = null;
    this.yearValDisplay = null;
    this.kingNameDisplay = null;
    this.minimap = null;
    this.playBtn = null;
    
    this.years = [1, 37, 48, 60, 92, 101, 120, 129, 131, 136, 157, 209, 260, 282, 298, 300];
    this.currentYearIdx = 0;
    this.onYearChangeCallback = null;
    this.isPlaying = false;
    this.playInterval = null;
  }

  init() {
    // 1. Setup Wrapper
    const wrapper = createElement('div', 'timeline-container');

    // 2. Setup Top row (Play button + displays)
    const topRow = createElement('div', 'timeline-top-row');

    this.playBtn = createElement('button', 'timeline-play-btn', '▶');
    this.playBtn.title = "Play History";
    this.playBtn.addEventListener('click', () => this.togglePlay());
    topRow.appendChild(this.playBtn);

    const yearDisplay = createElement('div', 'timeline-year-display');
    this.yearValDisplay = createElement('span', 'year-number', '1 AC');
    this.kingNameDisplay = createElement('div', 'timeline-king-name', 'King Aegon I Targaryen');
    yearDisplay.appendChild(this.yearValDisplay);
    yearDisplay.appendChild(this.kingNameDisplay);
    topRow.appendChild(yearDisplay);

    wrapper.appendChild(topRow);

    // 3. Setup Slider Wrapper
    const sliderWrapper = createElement('div', 'timeline-slider-wrapper');
    this.slider = createElement('input', 'timeline-slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = (this.years.length - 1).toString();
    this.slider.value = '0';
    
    this.slider.addEventListener('input', () => {
      this.currentYearIdx = parseInt(this.slider.value);
      this.updateDisplay();
      this.notifyChange();
    });

    sliderWrapper.appendChild(this.slider);
    wrapper.appendChild(sliderWrapper);

    // 4. Setup Minimap for events
    this.minimap = createElement('div', 'timeline-minimap');
    wrapper.appendChild(this.minimap);

    this.container.appendChild(wrapper);
    this.updateDisplay();
  }

  setYear(year) {
    const idx = this.years.indexOf(year);
    if (idx !== -1) {
      this.currentYearIdx = idx;
      this.slider.value = idx.toString();
      this.updateDisplay();
      this.notifyChange();
    }
  }

  getYear() {
    return this.years[this.currentYearIdx];
  }

  onYearChange(callback) {
    this.onYearChangeCallback = callback;
  }

  notifyChange() {
    if (this.onYearChangeCallback) {
      this.onYearChangeCallback(this.getYear());
    }
  }

  updateDisplay() {
    const year = this.getYear();
    this.yearValDisplay.textContent = formatYear(year);

    // Dynamically retrieve King info for display if window has data
    if (window.atlasDataManager) {
      // Use dynamic engine if available, otherwise check hardcoded timeline snapshots
      const state = (window.atlasApp && window.atlasApp.timelineEngine) 
        ? window.atlasApp.timelineEngine.getWorldState(year) 
        : window.atlasDataManager.getTimeline(year);

      if (state && state.king) {
        // Resolve character name
        const char = window.atlasDataManager.getCharacter(state.king.character);
        let name = char ? char.name : state.king.character.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        // Check if title is Queen
        const isQueen = state.king.title && state.king.title.toLowerCase().includes('queen');
        this.kingNameDisplay.textContent = isQueen ? `Queen ${name}` : `King ${name}`;
      } else {
        this.kingNameDisplay.textContent = 'Peace in the Realm';
      }
    } else {
      this.kingNameDisplay.textContent = 'King Aegon I Targaryen';
    }
  }

  renderMinimap(events) {
    this.minimap.innerHTML = '';
    if (!events) return;

    const startYear = this.years[0];
    const endYear = this.years[this.years.length - 1];
    const range = endYear - startYear;

    events.forEach(evt => {
      const relative = (evt.year - startYear) / range;
      const left = Math.max(2, Math.min(98, relative * 100)); // Clamp between 2% and 98%

      const marker = createElement('div', `timeline-marker ${evt.type}`);
      marker.style.left = `${left}%`;
      
      // Icon mapping
      let icon = '●';
      if (evt.type === 'battle') icon = '⚔';
      if (evt.type === 'coronation') icon = '👑';
      if (evt.type === 'dragon') icon = '🐉';
      if (evt.type === 'death') icon = '💀';

      marker.textContent = icon;
      marker.title = `${evt.name} (${formatYear(evt.year)})`;

      marker.addEventListener('click', () => {
        // Find nearest timeline year that contains this event or is just before/on it
        const nearestYear = this.years.reduce((prev, curr) => {
          return (Math.abs(curr - evt.year) < Math.abs(prev - evt.year) ? curr : prev);
        });
        this.setYear(nearestYear);
        // Dispatch location selection or focus if the event has location
        if (evt.location) {
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('locationSelected', { detail: { locationId: evt.location } }));
          }, 350);
        }
      });

      this.minimap.appendChild(marker);
    });
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.playBtn.textContent = '⏸';
      this.playInterval = setInterval(() => {
        let nextIdx = this.currentYearIdx + 1;
        if (nextIdx >= this.years.length) {
          nextIdx = 0;
        }
        this.slider.value = nextIdx.toString();
        this.currentYearIdx = nextIdx;
        this.updateDisplay();
        this.notifyChange();
      }, 3000);
    } else {
      this.playBtn.textContent = '▶';
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }
}
