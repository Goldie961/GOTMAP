import { t } from '../i18n/index.js';
import { getSurfaceKind } from '../utils/surfaces.js';

/**
 * LAYER_REGISTRY
 *
 * The single declaration of what the filter panel offers. FilterPanel renders
 * this tree and computes counts from it; it hardcodes no category of its own.
 *
 * Every entry carries a `kind`, and the kind decides how a toggle takes effect:
 *
 *   'svgLayer'       Static SVG geometry with no Entity model, shown or hidden
 *                    by its <g> element through the convention
 *                      svg.getElementById(`layer-${id}`)
 *                    implemented in showLayer() / hideLayer() / toggleLayer().
 *
 *   'category'       A collapsible heading. Toggles nothing itself; it owns the
 *                    select-all / select-none control for its children.
 *
 *   'locationFilter' A leaf under a category. `matches(location)` decides which
 *                    rendered locations it governs; the marker is hidden by CSS
 *                    class, the same mechanism the old subtype filter used.
 *
 *   'houseFilter'    A leaf whose children are generated from the data at
 *                    runtime — one per house that actually draws a crest badge.
 *
 * Leaves are declared for categories that are currently empty (`fortresses`,
 * `ruins`). That is deliberate: FilterPanel drops any leaf whose affected-pin
 * count is zero, so the intended structure lives here in full and the panel
 * shows only the part of it the data can support. A leaf appears by itself the
 * day a pin lands, with no UI change.
 *
 * Counting note: leaves are matched against the locations the map actually
 * DRAWS (MapRenderer.getRenderableLocations()), never against the dataset. The
 * panel previously counted `getAllLocations()` and produced 316 checkboxes of
 * which 283 could not affect a single pin.
 *
 * NOTE: 'regions' under Geography refers to entities classified as region
 * extents by getSurfaceKind(), NOT to the SVG polygon overlays in
 * data/map/regions.json.
 */
export const LAYER_REGISTRY = {
  // ── Locations: point markers, grouped by `type` ──
  // `type` and not `subtip`: the latter is 572 values of free text, and
  // `subtype` (the P2.4 taxonomy) is absent on all 78 drawn locations.
  locations: {
    kind: 'category', defaultOpen: true, available: true,
    isStaticGeometry: false, entityTypes: ['castle', 'city', 'landmark'],
    get label() { return t('layers.locations'); }
  },
  castles: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.castles'); },
    matches: location => !getSurfaceKind(location) && location.type === 'castle'
  },
  cities: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.cities'); },
    matches: location => !getSurfaceKind(location) && location.type === 'city'
  },
  towns: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.towns'); },
    matches: location => !getSurfaceKind(location) && location.type === 'town'
  },
  fortresses: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.fortresses'); },
    matches: location => !getSurfaceKind(location) && location.type === 'fortress'
  },
  ruins: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.ruins'); },
    matches: location => !getSurfaceKind(location) && location.type === 'ruins'
  },
  landmarks: {
    kind: 'locationFilter', parent: 'locations',
    get label() { return t('layers.landmarks'); },
    matches: location => !getSurfaceKind(location) && location.type === 'landmark'
  },

  // ── Geography: surface labels, grouped by getSurfaceKind() ──
  geography: {
    kind: 'category', defaultOpen: false, available: true,
    get label() { return t('layers.geography'); }
  },
  waters: {
    kind: 'locationFilter', parent: 'geography',
    get label() { return t('layers.waters'); },
    matches: location => ['water', 'watercourse'].includes(getSurfaceKind(location))
  },
  islands: {
    kind: 'locationFilter', parent: 'geography',
    get label() { return t('layers.islands'); },
    matches: location => getSurfaceKind(location) === 'island'
  },
  landforms: {
    kind: 'locationFilter', parent: 'geography',
    get label() { return t('layers.landforms'); },
    matches: location => getSurfaceKind(location) === 'landform'
  },
  regions: {
    kind: 'locationFilter', parent: 'geography',
    get label() { return t('layers.regions'); },
    matches: location => getSurfaceKind(location) === 'region'
  },
  linearFeatures: {
    kind: 'locationFilter', parent: 'geography',
    get label() { return t('layers.linearFeatures'); },
    matches: location => ['linear', 'route'].includes(getSurfaceKind(location))
  },

  // ── Houses: crest badges drawn on top of point markers ──
  houses: {
    kind: 'houseFilter', defaultOpen: false, available: true,
    get label() { return t('layers.houses'); }
  },

  // ── Standalone static layer ──
  labels: {
    kind: 'svgLayer', isStaticGeometry: true, entityTypes: [], available: true,
    get label() { return t('layers.labels'); }
  }
};

/** The category entries, in declaration order. */
export function getLayerCategories() {
  return Object.entries(LAYER_REGISTRY)
    .filter(([, config]) => config.kind === 'category' || config.kind === 'houseFilter');
}

/** The leaves declared under a given category, in declaration order. */
export function getLayerChildren(categoryId) {
  return Object.entries(LAYER_REGISTRY)
    .filter(([, config]) => config.parent === categoryId);
}

export class MapLayers {
  constructor(svgElement) {
    this.svg = svgElement;
  }


  showLayer(layerId) {
    const layer = this.svg.getElementById(`layer-${layerId}`);
    if (layer) {
      layer.style.display = 'block';
      layer.style.opacity = '0';
      setTimeout(() => {
        layer.style.transition = 'opacity 0.3s ease';
        layer.style.opacity = '1';
      }, 50);
    }
  }

  hideLayer(layerId) {
    const layer = this.svg.getElementById(`layer-${layerId}`);
    if (layer) {
      layer.style.transition = 'opacity 0.3s ease';
      layer.style.opacity = '0';
      setTimeout(() => {
        layer.style.display = 'none';
      }, 300);
    }
  }

  toggleLayer(layerId, isVisible) {
    if (isVisible) {
      this.showLayer(layerId);
    } else {
      this.hideLayer(layerId);
    }
  }
}
