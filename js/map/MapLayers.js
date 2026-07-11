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
