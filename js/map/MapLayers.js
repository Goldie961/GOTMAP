/**
 * LAYER_REGISTRY
 *
 * Maps each toggleable map layer to its display label, a flag indicating whether
 * it is static SVG geometry (isStaticGeometry: true), and any Entity types it
 * renders (entityTypes).
 *
 * Layers with isStaticGeometry: true have NO corresponding Entity model. They are
 * toggled by directly showing/hiding their SVG <g> element via the convention
 *   this.svg.getElementById(`layer-${layerId}`)
 * which is already implemented in MapLayers.showLayer() / hideLayer() / toggleLayer().
 *
 * The `locations` layer is the only non-static layer. It renders Entities of types
 * ['castle', 'city', 'landmark'] which exist in the locations.json Entity model.
 *
 * NOTE: 'regions' refers to the SVG polygon overlays in data/map/regions.json.
 * These are NOT Entity model objects — they are static geometry. Do NOT set
 * entityTypes: ['region'] here, as no 'region' Entity type exists.
 */
export const LAYER_REGISTRY = {
  locations:  { label: 'Locations',                         isStaticGeometry: false, entityTypes: ['castle', 'city', 'landmark'], available: true },
  labels:     { label: 'Geographic labels',                 isStaticGeometry: true,  entityTypes: [], available: true }
};

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
