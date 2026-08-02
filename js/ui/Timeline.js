import { createElement, formatYear } from '../utils/helpers.js';

export class Timeline {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.slider = null;
    this.yearValDisplay = null;
    this.kingNameDisplay = null;
    this.minimap = null;
    this.playBtn = null;
    this.tooltip = null;


    // Playback step in years per tick (configurable)
    this.playStep = 1;

    this.onYearChangeCallback = null;
    this.isPlaying = false;
    this.playInterval = null;

    // Year range
    this.minYear = 1;
    this.maxYear = 300;
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

    // 3. Setup Minimap for events (placed ABOVE progress bar/slider)
    this.minimap = createElement('div', 'timeline-minimap');
    wrapper.appendChild(this.minimap);

    // 4. Setup Slider Wrapper — continuous range 1–300 AC
    const sliderWrapper = createElement('div', 'timeline-slider-wrapper');
    this.slider = createElement('input', 'timeline-slider');
    this.slider.type = 'range';
    this.slider.min = this.minYear.toString();
    this.slider.max = this.maxYear.toString();
    this.slider.step = '1';
    this.slider.value = this.minYear.toString();
    
    this.slider.addEventListener('input', () => {
      this.updateDisplay();
      this.notifyChange();
      // Play a very subtle metallic tick sound on sliding
      if (window.atlasApp && window.atlasApp.audioManager) {
        window.atlasApp.audioManager.playTick();
      }
    });

    sliderWrapper.appendChild(this.slider);
    wrapper.appendChild(sliderWrapper);

    // 5. Setup Rich Tooltip
    this.tooltip = createElement('div', 'timeline-tooltip');
    wrapper.appendChild(this.tooltip);

    this.container.appendChild(wrapper);
    this.updateDisplay();
  }

  /**
   * Set the slider to a specific year (any integer between minYear and maxYear).
   * Works for any year, not just historical milestones.
   */
  setYear(year) {
    const clamped = Math.max(this.minYear, Math.min(this.maxYear, Math.round(year)));
    this.slider.value = clamped.toString();
    this.updateDisplay();
    this.notifyChange();
  }

  /**
   * Returns the current year as an integer read directly from the slider value.
   */
  getYear() {
    return parseInt(this.slider.value, 10);
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

    // Dynamically compute year bounds from loaded event data
    const validYears = events.filter(evt => Number.isFinite(evt.year)).map(evt => evt.year);
    if (validYears.length > 0) {
      this.minYear = Math.min(...validYears);
      this.maxYear = Math.max(...validYears);
      if (this.slider) {
        this.slider.min = this.minYear.toString();
        this.slider.max = this.maxYear.toString();
      }
    }

    const startYear = this.minYear;
    const endYear = this.maxYear;
    const range = (endYear - startYear) || 1;

    // The timeline has no visual representation for undated Wiki-only events.
    events.filter(evt => Number.isFinite(evt.year)).forEach(evt => {
      const relative = (evt.year - startYear) / range;
      const left = Math.max(2, Math.min(98, relative * 100)); // Clamp between 2% and 98%

      // Determine the visual class type & illustrated symbol
      let icon = '●';
      let eventType = evt.type || 'political';
      
      const descLower = (evt.description || '').toLowerCase();
      const nameLower = (evt.name || '').toLowerCase();
      const isDragonRelated = eventType === 'dragon' || 
                              nameLower.includes('dragon') || 
                              descLower.includes('dragon') ||
                              descLower.includes('balerion') ||
                              descLower.includes('vhagar') ||
                              descLower.includes('meraxes');
                            
      if (isDragonRelated) {
        icon = '🐉';
        eventType = 'dragon';
      } else if (eventType === 'battle') {
        icon = '⚔';
      } else if (eventType === 'coronation' || eventType === 'political') {
        icon = '👑';
      } else if (eventType === 'conquest' || eventType === 'founding') {
        icon = 'conquest';
        icon = '🏰';
      }

      const marker = createElement('div', `timeline-marker ${eventType}`);
      marker.style.left = `${left}%`;
      marker.textContent = icon;

      // Event hover tooltip listeners
      marker.addEventListener('mouseenter', () => {
        this.showTooltip(evt.name, evt.year, left);
      });
      marker.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });

      marker.addEventListener('click', () => {
        // Jump directly to the event's exact year (continuous slider supports any year)
        this.setYear(evt.year);

        // Play metal timeline click sound
        if (window.atlasApp && window.atlasApp.audioManager) {
          window.atlasApp.audioManager.playTimeline();
        }

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

  showTooltip(text, year, pctLeft) {
    this.tooltip.textContent = `${formatYear(year)} — ${text}`;
    this.tooltip.style.left = `${pctLeft}%`;
    this.tooltip.style.opacity = '1';
    this.tooltip.style.transform = 'translate(-50%, -100%) translateY(-6px) scale(1)';
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'translate(-50%, -100%) translateY(0) scale(0.9)';
  }

  /**
   * Play/pause — advances year by year (playStep AC per tick) through the continuous range.
   * Wraps back to minYear when it reaches maxYear.
   */
  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.playBtn.textContent = '⏸';
      this.playInterval = setInterval(() => {
        let nextYear = this.getYear() + this.playStep;
        if (nextYear > this.maxYear) {
          nextYear = this.minYear;
        }
        this.setYear(nextYear);
        // Play click sound
        if (window.atlasApp && window.atlasApp.audioManager) {
          window.atlasApp.audioManager.playTick();
        }
      }, 3000);
    } else {
      this.playBtn.textContent = '▶';
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }
}
