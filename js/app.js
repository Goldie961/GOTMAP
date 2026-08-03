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
import { WikiIndex } from './ui/WikiIndex.js';
import { SearchBar } from './ui/SearchBar.js';
import { FilterPanel } from './ui/FilterPanel.js';
import { DistanceTool } from './ui/DistanceTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { AudioManager } from './utils/AudioManager.js';
import { Router } from './router/Router.js';
import { entityKind, resolveEntity, sameRoute } from './router/routes.js';
import { navigateToEntity } from './router/links.js';
import { resolveMapTarget } from './map/mapTarget.js';
import * as i18n from './i18n/index.js';
import { t, displayName } from './i18n/index.js';

/** The bare map, and the fallback for every route that resolves to nothing. */
const MAP_ROUTE = { name: 'map', params: {} };

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
    this.wikiIndex = null;
    this.searchBar = null;
    this.filterPanel = null;
    this.distanceTool = null;
    this.toolbar = null;
    this.router = null;

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

    this.wikiIndex = new WikiIndex();
    this.wikiIndex.init();
    this.wikiIndex.setSources({ searchEngine: this.searchEngine, dataManager: this.dataManager });

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

    // 6. Resolve the address the page was opened with. Last, because applying a
    // route selects entities, moves the camera and rebuilds the filter panel —
    // all of which need the components above to exist — and before the loading
    // screen lifts, so a shared link reveals its own state rather than the
    // default map followed by a jump to it.
    this.router = new Router({ onNavigate: (route, context) => this.applyRoute(route, context) });
    this.mapInteraction.onViewBoxChange = () => this.syncMapState();
    this.router.start();

    // 7. Dismiss loading screen
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

      this.syncMapState();
    });

    // The map's search decides between two outcomes, and the decision is the
    // same one that put the result under "on the map" or "in the encyclopedia":
    // a place the map can show is a zoom, everything else is a page. Nothing
    // reaches the camera by accident (P6.2).
    this.searchBar.setMapTargetResolver(entity => this.mapTargetFor(entity));
    this.searchBar.onSelect(res => {
      const entity = res.entity || this.dataManager.getLocation(res.id);
      if (!entity) return;
      if (this.mapTargetFor(entity)) this.openEntity(entity);
      else navigateToEntity(entity);
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
          this.openEntity(loc);
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
      this.syncMapState();
    });

    // Kept separate from layer toggles: these change individual map features
    // rather than showing or hiding a whole SVG group.
    this.filterPanel.onLocationFilterChange(visibleIds => {
      this.mapRenderer.setVisibleLocationIds(visibleIds);
      this.syncMapState();
    });

    this.filterPanel.onHouseFilterChange(visibleHouseIds => {
      this.mapRenderer.setVisibleHouseIds(visibleHouseIds);
      this.syncMapState();
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

    /**
     * Dropping the selection is a navigation, not a UI reset: Back has to
     * return to the place the reader just left. The panel is closed by
     * applyRoute() on the way through, so it is not closed here as well.
     */
    const dismissDetailsAndResetMap = () => {
      this.mapInteraction.resetView();
      const hasSelection = Boolean(this.router?.current?.params?.locationId)
        || Boolean(this.router?.readState()?.selection);
      if (this.router && (hasSelection || !sameRoute(this.router.current, MAP_ROUTE))) {
        this.router.navigate(MAP_ROUTE, { state: { selection: null, view: null } });
        return;
      }
      this.infoPanel.close();
      this.mapRenderer.clearHighlight();
    };

    // Clicking out of details returns to the complete map as well as closing the panel.
    document.addEventListener('click', e => {
      // Clicking the SVG canvas or terrain returns to the complete map.
      if (e.target.id === 'map-svg' || e.target.id === 'layer-terrain') {
        dismissDetailsAndResetMap();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // An overlay is on top of the map; Escape belongs to it, and resetting the
      // camera behind it would leave the reader somewhere else on return.
      if (this.wikiPage?.isOpen || this.wikiIndex?.isOpen) {
        this.router.back(MAP_ROUTE);
        return;
      }
      dismissDetailsAndResetMap();
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
    if (this.wikiIndex?.isOpen) this.wikiIndex.render();

    // The address has to follow the switch, or copying it would hand someone a
    // link that opens in the other language: ?lang wins over the stored choice
    // at startup (docs/I18N_ARHITECTURA.md §6.3), which is what makes a shared
    // link reproduce the language it was shared in.
    this.router?.syncStateNow({ lang: i18n.getLanguage() });
  }

  // ── routing ────────────────────────────────────────────────────────────────
  //
  // One direction only: the interface calls openEntity(), which writes the
  // address; the router reads the address and calls applyRoute(), which applies
  // it. Nothing below applyRoute() ever writes the address, which is what keeps
  // a navigation from re-entering itself.

  /**
   * The navigation entry point for selecting an entity, from anywhere.
   *
   * A place becomes /harta/:locationId, as the route table specifies. Anything
   * else stays on the map route — the summary panel opens over the map, which
   * is what the app has always done — and records itself in `?sel=`, because
   * /harta/:locationId cannot carry a character and the acceptance criterion is
   * that the address reproduces the state, not most of it.
   *
   * `view: null` clears the inherited viewBox so applyRoute() flies to the new
   * selection rather than honouring the previous view; the flight's result is
   * written back by syncMapState() when it settles.
   */
  openEntity(entity) {
    if (!entity || !this.router) return;
    const kind = entityKind(entity, this.dataManager);
    if (kind === 'location') {
      this.router.navigate({ name: 'map', params: { locationId: entity.id } },
        { state: { selection: null, view: null } });
      return;
    }
    this.router.navigate(MAP_ROUTE, {
      state: { selection: kind ? { kind, id: entity.id } : null, view: null }
    });
  }

  /** Apply a resolved route. Called by the router — on load, on a navigation and on popstate. */
  applyRoute(route, { state, initial } = {}) {
    if (route.name === 'admin') {
      // A separate document, not a view of this one.
      window.location.replace('admin/map-editor.html');
      return;
    }

    this.applySharedState(state, { initial });

    if (route.name === 'wikiEntity') {
      const entity = resolveEntity(route.params.kind, route.params.id, this.dataManager);
      if (!entity) {
        // An id that resolves to nothing is a broken link, not a broken app:
        // say so and show the index rather than an empty page.
        console.warn(`[router] /wiki/${route.params.kind}/${route.params.id} matches no record.`);
        this.wikiPage.close();
        this.wikiIndex.open();
        return;
      }
      this.wikiIndex.close();
      this.wikiPage.open(entity);
      return;
    }

    if (route.name === 'wikiIndex') {
      this.wikiPage.close();
      this.wikiIndex.open();
      return;
    }

    this.wikiPage.close();
    this.wikiIndex.close();
    this.applyMapSelection(route, state);
  }

  /** Year, filters and camera — the part of the address every route carries. */
  applySharedState(state, { initial } = {}) {
    if (!state) return;

    if (state.lang && i18n.isSupported(state.lang) && state.lang !== i18n.getLanguage()) {
      i18n.setLanguage(state.lang);
    }

    if (Number.isFinite(state.year) && state.year !== this.timeline.getYear()) {
      this.timeline.setYear(state.year);
    }

    // Filters before the camera: applying them re-renders markers, and the
    // declutter pass that runs with them reads the view it is decluttering for.
    const wanted = { leaves: state.offLeaves || [], houses: state.offHouses || [] };
    const current = this.filterPanel.getHiddenIds();
    const differs = current.leaves.join(',') !== wanted.leaves.join(',')
      || current.houses.join(',') !== wanted.houses.join(',');
    if (initial || differs) {
      this.filterPanel.applyHiddenIds(wanted);
      this.applyFilters();
    }

    if (state.view) this.mapInteraction.setViewBox(state.view.x, state.view.y, state.view.width);
  }

  /**
   * Push the panel's whole state into the map at once.
   *
   * The panel's three callbacks each push one third of it, which is right when
   * the reader ticks one box; restoring an address changes all three at once and
   * needs all three applied whether or not they differ from the default.
   */
  applyFilters() {
    Object.entries(this.filterPanel.filters).forEach(([layer, isVisible]) => {
      this.mapLayers.toggleLayer(layer, isVisible);
    });
    this.mapRenderer.setVisibleLocationIds(this.filterPanel.getVisibleLocationIds());
    this.mapRenderer.setVisibleHouseIds(this.filterPanel.getVisibleHouseIds());
  }

  applyMapSelection(route, state) {
    const selection = route.params.locationId
      ? { kind: 'location', id: route.params.locationId }
      : state?.selection || null;

    const entity = selection ? resolveEntity(selection.kind, selection.id, this.dataManager) : null;
    if (selection && !entity) console.warn(`[router] ${selection.kind}/${selection.id} matches no record.`);

    if (!entity) {
      this.infoPanel.close();
      this.mapRenderer.clearHighlight();
      return;
    }

    // A viewBox in the address is the state to reproduce. Flying to the entity
    // would compute a different one and a shared link would not open on the view
    // it was shared from.
    this.selectEntity(entity, this.mapTargetFor(entity), { fly: !state?.view });
  }

  /**
   * The location the camera should go to for an entity, or null when the map
   * has nowhere to put it.
   *
   * Delegates so that the search dropdown's two sections and this click handler
   * cannot disagree: the label the reader clicked and the thing that happens are
   * decided by the same function (js/map/mapTarget.js).
   */
  mapTargetFor(entity) {
    return resolveMapTarget(entity, this.dataManager);
  }

  /** What the address bar should currently say about the map. */
  currentMapState() {
    const hidden = this.filterPanel.getHiddenIds();
    // `selection` and `lang` are deliberately absent: encodeState only writes
    // the keys it is given, so omitting them leaves what navigate() and the
    // language switch wrote intact.
    return {
      year: this.timeline?.getYear?.() ?? null,
      view: this.mapInteraction ? { ...this.mapInteraction.viewBox } : null,
      offLeaves: hidden.leaves,
      offHouses: hidden.houses
    };
  }

  /** Debounced: this is called once per animation frame during a flyTo. */
  syncMapState() {
    this.router?.syncState(this.currentMapState());
  }

  selectLocation(location) {
    this.selectEntity(location, location);
  }

  selectEntity(entity, location, { fly = true } = {}) {
    // Paper rustle sound on location selection
    if (this.audioManager) this.audioManager.playPaper();

    this.infoPanel.open(entity, this.currentWorldState);

    if (location) {
      this.mapRenderer.highlightLocation(location.id);
      if (!fly) return;

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
