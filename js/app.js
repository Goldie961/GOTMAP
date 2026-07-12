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
      if (this.infoPanel && this.infoPanel.currentEntity) {
        this.infoPanel.open(this.infoPanel.currentEntity, this.currentWorldState);
      }
    });

    // Handle search selection clicks
    this.searchBar.onSelect(res => {
      let loc = this.dataManager.getCastle(res.id) || this.dataManager.getCity(res.id) || this.dataManager.data.landmarks.find(l => l.id === res.id);
      let entity = loc;

      if (!loc) {
        if (res.type === 'house' || res.type === 'faction' || res.type === 'institution') {
          entity = this.dataManager.getHouse(res.id);
          if (entity) {
            const seatId = entity.seat || entity.city || null;
            if (seatId) {
              loc = this.dataManager.getCastle(seatId) || this.dataManager.getCity(seatId) || this.dataManager.data.landmarks.find(l => l.id === seatId);
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
            loc = this.dataManager.getCastle(targetLocationId) || this.dataManager.getCity(targetLocationId) || this.dataManager.data.landmarks.find(l => l.id === targetLocationId);
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
            loc = this.dataManager.getCastle(targetLocationId) || this.dataManager.getCity(targetLocationId) || this.dataManager.data.landmarks.find(l => l.id === targetLocationId);
          }
        }
      }

      if (entity) {
        this.selectEntity(entity, loc);
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

  selectLocation(location) {
    this.selectEntity(location, location);
  }

  selectEntity(entity, location) {
    // Paper rustle sound on location selection
    if (this.audioManager) this.audioManager.playPaper();

    this.infoPanel.open(entity, this.currentWorldState);

    if (location) {
      this.mapRenderer.highlightLocation(location.id);
      // Zoom and pan smoothly (cinematic zoom width = 350)
      let targetX = location.coordinates.x;
      let targetY = location.coordinates.y;
      const renderedPos = this.mapRenderer.getRenderedPosition(location.id);
      if (renderedPos) {
        targetX = renderedPos.x;
        targetY = renderedPos.y;
      } else {
        // This location has not yet been calibrated on the new terrain map.
        // Keep the information panel open, but do not fly the camera to stale coordinates.
        return;
      }
      this.mapInteraction.flyTo(targetX, targetY, 350, 1500);
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new AtlasApp();
  app.init().catch(console.error);
});
