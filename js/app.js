import { DataManager } from './data/DataManager.js';
import { TimelineEngine } from './data/TimelineEngine.js';
import { SearchEngine } from './data/SearchEngine.js';
import { MapRenderer } from './map/MapRenderer.js';
import { MapInteraction } from './map/MapInteraction.js';
import { MapLayers } from './map/MapLayers.js';
import { MapAnimations } from './map/MapAnimations.js';
import { Timeline } from './ui/Timeline.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { SearchBar } from './ui/SearchBar.js';
import { FilterPanel } from './ui/FilterPanel.js';
import { DistanceTool } from './ui/DistanceTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { AudioManager } from './utils/AudioManager.js';

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
    this.searchBar = null;
    this.filterPanel = null;
    this.distanceTool = null;
    this.toolbar = null;

    this.currentWorldState = null;
  }

  async init() {
    window.atlasApp = this;

    // 0. Initialize Audio Manager (muted by default)
    this.audioManager = new AudioManager();
    this.audioManager.init();

    // 1. Initialize data manager and load all JSONs
    this.dataManager = new DataManager();
    await this.dataManager.loadAll();

    // 2. Build engines
    this.timelineEngine = new TimelineEngine(this.dataManager);
    this.searchEngine = new SearchEngine();
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

    this.filterPanel = new FilterPanel('filter-panel');
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
      
      // Update info panel if it's currently open
      const openPanel = document.querySelector('.info-panel.open');
      if (openPanel) {
        const lastSelectedId = this.mapRenderer.svg.querySelector('.location-marker.selected')?.getAttribute('data-location-id');
        if (lastSelectedId) {
          const loc = this.dataManager.getCastle(lastSelectedId) || 
                      this.dataManager.getCity(lastSelectedId) || 
                      this.dataManager.data.landmarks.find(l => l.id === lastSelectedId);
          this.infoPanel.open(loc, this.currentWorldState);
        }
      }
    });

    // Handle search selection clicks
    this.searchBar.onSelect(res => {
      const loc = this.dataManager.getCastle(res.id) || this.dataManager.getCity(res.id) || this.dataManager.data.landmarks.find(l => l.id === res.id);
      if (loc) {
        this.selectLocation(loc);
      }
    });

    // SVG location clicking
    document.addEventListener('locationSelected', e => {
      const locId = e.detail.locationId;
      const loc = this.dataManager.getCastle(locId) || this.dataManager.getCity(locId) || this.dataManager.data.landmarks.find(l => l.id === locId);
      
      if (loc) {
        // If distance tool is active, handle path routing
        if (this.distanceTool.isActive) {
          this.distanceTool.handleLocationClick(loc);
        } else {
          this.selectLocation(loc);
        }
      }
    });

    // SVG hover tooltips
    const tooltip = document.getElementById('tooltip');
    document.addEventListener('locationHovered', e => {
      const detail = e.detail;
      if (detail.show) {
        tooltip.innerHTML = `<strong>${detail.location.name}</strong><br/><span style="font-size:0.75rem; color:var(--gold-dark); font-weight:bold;">${detail.location.type.toUpperCase()}</span>`;
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

    // Clicking out of details closes the sidebar details panel
    document.addEventListener('click', e => {
      // If click was on map background (the sea)
      if (e.target.classList.contains('sea-bg') || e.target.id === 'map-svg') {
        this.infoPanel.close();
        this.mapRenderer.clearHighlight();
      }
    });
  }

  selectLocation(location) {
    // Paper rustle sound on location selection
    if (this.audioManager) this.audioManager.playPaper();

    this.infoPanel.open(location, this.currentWorldState);
    this.mapRenderer.highlightLocation(location.id);
    
    // Zoom and pan smoothly (cinematic zoom width = 350)
    this.mapInteraction.flyTo(location.coordinates.x, location.coordinates.y, 350, 1500);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new AtlasApp();
  app.init().catch(console.error);
});
