import { DataManager } from './data/DataManager.js';
import { TimelineEngine } from './data/TimelineEngine.js';
import { SearchEngine } from './data/SearchEngine.js';
import { MapRenderer } from './map/MapRenderer.js';
import { MapInteraction } from './map/MapInteraction.js';
import { MapLayers } from './map/MapLayers.js';
import { MapAnimations } from './map/MapAnimations.js';
import { Timeline } from './ui/Timeline.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { WikiPage } from './ui/WikiPage.js';
import { SearchBar } from './ui/SearchBar.js';
import { FilterPanel } from './ui/FilterPanel.js';
import { DistanceTool } from './ui/DistanceTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { AudioManager } from './utils/AudioManager.js';
import * as i18n from './i18n/index.js';
import { t, displayName } from './i18n/index.js';

class AtlasApp {
  constructor() {
    this.audioManager = null;
    this.dataManager = null;
    this.timelineEngine = null;
    this.searchEngine = null;
    this.mapRenderer = null;
    this.mapInteraction = null;
    this.mapLayers = null;
    this.mapAnimations = null;
    this.timeline = null;
    this.infoPanel = null;
    this.wikiPage = null;
    this.searchBar = null;
    this.filterPanel = null;
    this.distanceTool = null;
    this.toolbar = null;

    this.currentWorldState = null;
  }

  async init() {
    window.atlasApp = this;

    // 0. i18n first: `t()` is synchronous, so the dictionaries have to be in
    // memory before anything renders. A failure here throws rather than logging,
    // which is what turns a missing en.json into a visible error instead of a
    // loading screen that never ends.
    await i18n.init();
    i18n.onLanguageChange(() => this.applyLanguage());

    const loadingTitle = document.querySelector('#loading-screen h1');
    if (loadingTitle) loadingTitle.textContent = t('app.title');
    const loadingSub = document.querySelector('#loading-screen p');
    if (loadingSub) loadingSub.textContent = t('app.subtitle');

    // 0b. Audio Manager (muted by default)
    this.audioManager = new AudioManager();
    this.audioManager.init();

    // 1. Initialize data manager and load all JSONs
    this.dataManager = new DataManager();
    await this.dataManager.loadAll();

    // 2. Build engines
    this.timelineEngine = new TimelineEngine(this.dataManager);
    this.searchEngine = new SearchEngine({ language: i18n.getLanguage() });
    this.searchEngine.buildIndex(this.dataManager);

    // Get starting world state
    this.currentWorldState = this.timelineEngine.getWorldState(1); // Year 1 AC

    // 3. Initialize map elements
    this.mapRenderer = new MapRenderer('map-container');
    this.mapRenderer.init();
    await this.mapRenderer.renderMap(this.currentWorldState);

    this.mapInteraction = new MapInteraction(this.mapRenderer.svg);
    this.mapLayers = new MapLayers(this.mapRenderer.svg);
    
    this.mapAnimations = new MapAnimations(this.mapRenderer.svg);
    this.mapAnimations.init();

    // 4. Initialize UI components
    this.toolbar = new Toolbar('toolbar');
    this.toolbar.init();

    this.searchBar = new SearchBar('search-bar-target');
    this.searchBar.setSearchEngine(this.searchEngine);
    this.searchBar.init();

    this.infoPanel = new InfoPanel('info-panel');
    this.infoPanel.init();

    this.wikiPage = new WikiPage();
    this.wikiPage.init();

    this.filterPanel = new FilterPanel('filter-panel');
    // Point markers and surface labels together: both are things the reader sees
    // and both must be counted, or unchecking "Ape" would report zero and be
    // dropped as ineffective while seven bay names stayed on the map.
    this.filterPanel.setRenderableLocations(
      this.mapRenderer.getRenderableLocations(),
      this.currentWorldState?.year ?? 1
    );
    this.filterPanel.init();

    this.timeline = new Timeline('timeline');
    this.timeline.init();
    this.timeline.renderMinimap(this.dataManager.data.events);

    this.distanceTool = new DistanceTool(this.mapRenderer.svg);

    // 5. Connect all UI actions and custom events
    this.wireEvents();

    // 6. Dismiss loading screen
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 600);
    }
  }

  wireEvents() {
    // Timeline year slide
    this.timeline.onYearChange(year => {
      this.currentWorldState = this.timelineEngine.getWorldState(year);
      // Animated smooth transition for region colors (Faza 4 spec)
      this.mapRenderer.updateWorldState(this.currentWorldState, true);

      // Crest badges are resolved per year, so which houses hold anything on
      // screen changes as the slider moves. Rebuilding keeps the Houses category
      // honest instead of listing holders from year 1 forever.
      this.filterPanel.setRenderableLocations(
        this.mapRenderer.getRenderableLocations(),
        year
      );

      // Update info panel if it's currently open
      if (this.infoPanel && this.infoPanel.currentEntity) {
        this.infoPanel.open(this.infoPanel.currentEntity, this.currentWorldState);
      }
    });

    // Handle search selection clicks
    this.searchBar.onSelect(res => {
      let loc = this.dataManager.getLocation(res.id);
      let entity = loc;

      if (!loc) {
        if (res.type === 'house' || res.type === 'faction' || res.type === 'institution') {
          entity = this.dataManager.getHouse(res.id);
          if (entity) {
            const seatId = entity.seat || entity.city || null;
            if (seatId) {
              loc = this.dataManager.getLocation(seatId);
            }
          }
        } else if (res.type === 'character') {
          const char = this.dataManager.getCharacter(res.id);
          entity = char;
          let targetLocationId = null;
          if (char && char.timeline && char.timeline.length > 0) {
            const currentYear = this.currentWorldState ? this.currentWorldState.year : 1;
            const matches = char.timeline.filter(t => t.year <= currentYear);
            if (matches.length > 0) {
              targetLocationId = matches[matches.length - 1].location;
            } else {
              targetLocationId = char.timeline[0].location;
            }
          }
          if (!targetLocationId && res.house) {
            const house = this.dataManager.getHouse(res.house);
            if (house && house.seat) {
              targetLocationId = house.seat;
            }
          }
          if (targetLocationId) {
            loc = this.dataManager.getLocation(targetLocationId);
          }
        } else if (res.type === 'dragon') {
          const dragon = this.dataManager.getDragon(res.id);
          entity = dragon;
          let targetLocationId = null;
          if (dragon && dragon.timeline && dragon.timeline.length > 0) {
            const currentYear = this.currentWorldState ? this.currentWorldState.year : 1;
            const matches = dragon.timeline.filter(t => t.year <= currentYear);
            if (matches.length > 0) {
              targetLocationId = matches[matches.length - 1].location;
            } else {
              targetLocationId = dragon.timeline[0].location;
            }
          }
          if (targetLocationId) {
            loc = this.dataManager.getLocation(targetLocationId);
          }
        } else if (res.type === 'event') {
          entity = this.dataManager.getEvent(res.id);
          // Events have no map position of their own; opening the panel must
          // not zoom to a linked location.
          loc = null;
        } else if (res.type === 'object') {
          entity = this.dataManager.getObject(res.id);
          // Objects are not map entities.
          loc = null;
        } else if (res.type === 'title') {
          entity = this.dataManager.getTitle(res.id);
          // Titles are not map entities.
          loc = null;
        }
      }

      if (entity) {
        this.selectEntity(entity, loc);
      }
    });

    // SVG location clicking
    document.addEventListener('locationSelected', e => {
      const locId = e.detail.locationId;
      const loc = this.dataManager.getLocation(locId);
      
      if (loc) {
        // If distance tool is active, handle path routing
        if (this.distanceTool.isActive) {
          this.distanceTool.handleLocationClick(loc);
        } else {
          this.selectEntity(loc, loc);
        }
      }
    });

    // Calibrated geometry is optional. When it exists, it provides zoom and
    // a visual filter; `location.region` remains the authoritative assignment.
    document.addEventListener('regionSelected', e => {
      const regionId = e.detail.regionId;
      const bounds = this.dataManager.getRegionBounds(regionId);
      this.mapRenderer.setSelectedRegion(regionId);
      if (!bounds) return;
      const padding = 1.18;
      const zoomWidth = Math.min(this.mapInteraction.mapWidth, Math.max(bounds.width * padding, bounds.height * (this.mapInteraction.mapWidth / this.mapInteraction.mapHeight) * padding, 120));
      this.mapInteraction.flyTo(bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2, zoomWidth, 1200);
    });

    // SVG hover tooltips
    const tooltip = document.getElementById('tooltip');
    document.addEventListener('locationHovered', e => {
      const detail = e.detail;
      if (detail.show) {
        tooltip.innerHTML = `<strong>${displayName(detail.location)}</strong><br/><span style="font-size:0.75rem; color:var(--gold-dark); font-weight:bold;">${detail.location.type.toUpperCase()}</span>`;
        tooltip.style.left = `${detail.x}px`;
        tooltip.style.top = `${detail.y}px`;
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
      } else {
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
      }
    });

    // Toggle Filter Checkboxes
    this.filterPanel.onFilterChange(filters => {
      Object.entries(filters).forEach(([layer, isVisible]) => {
        this.mapLayers.toggleLayer(layer, isVisible);
      });
    });

    // Kept separate from layer toggles: these change individual map features
    // rather than showing or hiding a whole SVG group.
    this.filterPanel.onLocationFilterChange(visibleIds => {
      this.mapRenderer.setVisibleLocationIds(visibleIds);
    });

    this.filterPanel.onHouseFilterChange(visibleHouseIds => {
      this.mapRenderer.setVisibleHouseIds(visibleHouseIds);
    });

    // Toolbar event dispatchers
    document.addEventListener('toggleFilters', () => {
      this.filterPanel.toggle();
    });

    document.addEventListener('toggleDistanceTool', () => {
      this.distanceTool.toggle();
    });

    document.addEventListener('toggleDayNight', () => {
      this.mapAnimations.toggleDayNight();
    });

    document.addEventListener('seasonChanged', e => {
      this.mapAnimations.applySeason(e.detail.season);
    });

    const dismissDetailsAndResetMap = () => {
      this.infoPanel.close();
      this.mapRenderer.clearHighlight();
      this.mapInteraction.resetView();
    };

    // Clicking out of details returns to the complete map as well as closing the panel.
    document.addEventListener('click', e => {
      // Clicking the SVG canvas or terrain returns to the complete map.
      if (e.target.id === 'map-svg' || e.target.id === 'layer-terrain') {
        dismissDetailsAndResetMap();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') dismissDetailsAndResetMap();
    });
  }

  /**
   * Language switch: a full re-render, no DOM diffing (§6.5).
   *
   * Without a framework, a complete rebuild on a rare user action is correct and
   * verifiable, whereas a partial update is exactly how code gets written that
   * never runs. What must survive it is enumerated below; everything else is
   * rebuilt from the model.
   *
   * The search index is deliberately absent from this list — INV-S1.
   */
  applyLanguage() {
    // State that lives in the DOM rather than in a model.
    const query = this.searchBar?.input?.value ?? '';
    const year = this.timeline?.getYear?.() ?? 1;
    const wikiWasOpen = this.wikiPage?.host?.classList.contains('open');

    // Display projections only; searchTerms are untouched.
    this.searchEngine.refreshDisplayNames(i18n.getLanguage());

    // The toolbar owns the search bar's container, so the two are rebuilt together.
    this.toolbar.init();
    this.searchBar.init();
    this.searchBar.input.value = query;

    // Checkbox state lives in FilterPanel's own maps and survives the rebuild.
    this.filterPanel.init();

    this.timeline.container.innerHTML = '';
    this.timeline.init();
    this.timeline.renderMinimap(this.dataManager.data.events);
    this.timeline.slider.value = String(year);
    this.timeline.updateDisplay();

    this.distanceTool.rebuild();
    this.mapRenderer.refreshLabels();

    if (this.infoPanel?.currentEntity) {
      this.infoPanel.open(this.infoPanel.currentEntity, this.currentWorldState);
    }
    if (wikiWasOpen && this.wikiPage.currentEntity) {
      this.wikiPage.render();
    }
  }

  selectLocation(location) {
    this.selectEntity(location, location);
  }

  selectEntity(entity, location) {
    // Paper rustle sound on location selection
    if (this.audioManager) this.audioManager.playPaper();

    this.infoPanel.open(entity, this.currentWorldState);

    if (location) {
      this.mapRenderer.highlightLocation(location.id);

      // The rendered position comes from the calibrated catalog and is the only
      // authority for where a marker actually sits. Most locations (327 of 391)
      // carry no root-level `coordinates` at all, so that field is a fallback and
      // must be read with optional chaining, never before the calibrated lookup.
      // A sub-location has no marker of its own, so flying to it means flying to
      // the ancestor that carries one — otherwise selecting the Hightower would
      // fall through to its deprecated root `coordinates` and land elsewhere.
      const anchorId = this.dataManager.getMappableAnchor(location)?.id || location.id;
      const renderedPos = this.mapRenderer.getRenderedPosition(anchorId);
      const targetX = renderedPos?.x ?? location.coordinates?.x;
      const targetY = renderedPos?.y ?? location.coordinates?.y;

      // Uncalibrated and uncoordinated: keep the panel open, leave the camera put
      // rather than flying to NaN.
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

      // Zoom and pan smoothly (cinematic zoom width = 350)
      this.mapInteraction.flyTo(targetX, targetY, 350, 1500);
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new AtlasApp();
  app.init().catch(err => {
    console.error('Initialization failed:', err);
    const loader = document.getElementById('loading-screen');
    if (loader) {
      const content = loader.querySelector('.loading-content') || loader;
      const errDiv = document.createElement('div');
      errDiv.className = 'loading-error-message';
      errDiv.style.color = '#ff4d4d';
      errDiv.style.marginTop = '1.5rem';
      errDiv.style.fontWeight = 'bold';
      errDiv.style.fontSize = '1.1rem';
      errDiv.textContent = t('app.loadError', { message: err.message });
      content.appendChild(errDiv);
    }
  });
});
