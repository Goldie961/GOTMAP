import { easeInOutCubic } from '../utils/helpers.js';

// SVG's screen CTM does not account for the letterboxing introduced by
// preserveAspectRatio="xMidYMid meet". Calculate against the rendered map area
// so a click in a side margin can never produce coordinates outside the canvas.
export function screenToMapPoint(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const viewAspect = viewBox.width / viewBox.height;
  const screenAspect = rect.width / rect.height;

  let width;
  let height;
  let left = rect.left;
  let top = rect.top;

  if (screenAspect > viewAspect) {
    height = rect.height;
    width = height * viewAspect;
    left += (rect.width - width) / 2;
  } else {
    width = rect.width;
    height = width / viewAspect;
    top += (rect.height - height) / 2;
  }

  const inside = clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height;
  return {
    x: viewBox.x + ((clientX - left) / width) * viewBox.width,
    y: viewBox.y + ((clientY - top) / height) * viewBox.height,
    inside,
    width,
    height
  };
}

export class MapInteraction {
  constructor(svgElement, options = {}) {
    this.svg = svgElement;
    this.container = svgElement.parentElement;
    this.mapWidth = options.mapWidth || Number(svgElement.dataset.mapWidth) || 1000;
    this.mapHeight = options.mapHeight || Number(svgElement.dataset.mapHeight) || 1400;
    
    // Default viewBox state
    this.viewBox = { x: 0, y: 0, width: this.mapWidth, height: this.mapHeight };
    
    // Zoom constraints
    this.minWidth = this.mapWidth * 0.12;
    this.maxWidth = this.mapWidth;
    
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    
    this.animationId = null;
    this._lastLabelVisibilityWidth = null;

    /** Set by AtlasApp to keep the address bar in step with the view (P6.1). */
    this.onViewBoxChange = null;

    this.init();
  }

  init() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
    
    this.enablePan();
    this.enableZoom();
  }

  enablePan() {
    this.container.addEventListener('mousedown', this.onPointerDown.bind(this));
    window.addEventListener('mousemove', this.onPointerMove.bind(this));
    window.addEventListener('mouseup', this.onPointerUp.bind(this));
    
    // Touch support
    this.container.addEventListener('touchstart', this.onPointerDown.bind(this), { passive: true });
    window.addEventListener('touchmove', this.onPointerMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onPointerUp.bind(this));
  }

  onPointerDown(e) {
    if (e.button && e.button !== 0) return; // Only left click

    // A drag started on a location marker is handled by the map editor's own
    // marker-drag logic. If we also start panning here, both systems fight
    // over the same mousedown/touchstart (pointerdown and mousedown are
    // separate native events, so stopPropagation() on one doesn't stop the
    // other) and the whole map pans underneath the marker being dragged.
    if (e.target?.closest?.('.location-marker')) return;

    this.isPanning = true;
    this.container.classList.add('panning');
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    this.startPoint = { x: clientX, y: clientY };
    
    // Cancel ongoing flyTo animations
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  onPointerMove(e) {
    if (!this.isPanning) return;
    
    if (e.cancelable) e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - this.startPoint.x;
    const dy = clientY - this.startPoint.y;
    
    // Scale movement by the actual rendered map area, excluding side letterboxing.
    const content = screenToMapPoint(this.svg, clientX, clientY);
    const scaleX = this.viewBox.width / content.width;
    const scaleY = this.viewBox.height / content.height;
    
    this.viewBox.x -= dx * scaleX;
    this.viewBox.y -= dy * scaleY;
    
    // Constrain pan within reasonable boundaries
    const margin = 200;
    this.viewBox.x = Math.max(-margin, Math.min(this.mapWidth - this.viewBox.width + margin, this.viewBox.x));
    this.viewBox.y = Math.max(-margin, Math.min(this.mapHeight - this.viewBox.height + margin, this.viewBox.y));
    
    this.updateViewBox();
    this.startPoint = { x: clientX, y: clientY };
  }

  onPointerUp() {
    this.isPanning = false;
    this.container.classList.remove('panning');
  }

  enableZoom() {
    this.container.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }

  onWheel(e) {
    e.preventDefault();
    
    // Get mouse pointer in SVG space to zoom towards it
    const point = screenToMapPoint(this.svg, e.clientX, e.clientY);
    if (!point.inside) return;
    
    // Determine zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    
    this.zoom(zoomFactor, point.x, point.y);
  }

  zoom(factor, centerX, centerY) {
    const newWidth = this.viewBox.width * factor;
    const newHeight = this.viewBox.height * factor;
    
    // Constrain width
    if (newWidth < this.minWidth || newWidth > this.maxWidth) return;
    
    // Target viewBox after zoom
    const targetX = centerX - (centerX - this.viewBox.x) * factor;
    const targetY = centerY - (centerY - this.viewBox.y) * factor;
    const targetW = newWidth;
    const targetH = newHeight;

    // Smooth animated zoom (200ms with easeOutQuad)
    const startX = this.viewBox.x;
    const startY = this.viewBox.y;
    const startW = this.viewBox.width;
    const startH = this.viewBox.height;
    const duration = 200;
    const startTime = performance.now();

    if (this._zoomAnimId) cancelAnimationFrame(this._zoomAnimId);

    const animateZoom = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t * (2 - t); // easeOutQuad

      this.viewBox.x = startX + (targetX - startX) * ease;
      this.viewBox.y = startY + (targetY - startY) * ease;
      this.viewBox.width = startW + (targetW - startW) * ease;
      this.viewBox.height = startH + (targetH - startH) * ease;
      this.updateViewBox();

      if (t < 1) {
        this._zoomAnimId = requestAnimationFrame(animateZoom);
      } else {
        this._zoomAnimId = null;
      }
    };

    this._zoomAnimId = requestAnimationFrame(animateZoom);
  }

  // Recenters the view on a point without changing the current zoom level.
  // Used instead of flyTo() where an automatic zoom change would be
  // disorienting (e.g. selecting a location from the admin editor list) —
  // zooming stays exclusively under the user's control via the mouse wheel.
  panTo(targetX, targetY, duration = 450) {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const startX = this.viewBox.x;
    const startY = this.viewBox.y;
    const width = this.viewBox.width;
    const height = this.viewBox.height;

    const targetViewBoxX = targetX - width / 2;
    const targetViewBoxY = targetY - height / 2;

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      this.viewBox.x = startX + (targetViewBoxX - startX) * ease;
      this.viewBox.y = startY + (targetViewBoxY - startY) * ease;
      this.updateViewBox();

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  flyTo(targetX, targetY, zoomWidth, duration = 1500) {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    const startX = this.viewBox.x;
    const startY = this.viewBox.y;
    const startWidth = this.viewBox.width;
    const startHeight = this.viewBox.height;
    
    const targetHeight = zoomWidth * (this.mapHeight / this.mapWidth);
    const targetViewBoxX = targetX - zoomWidth / 2;
    const targetViewBoxY = targetY - targetHeight / 2;
    
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutCubic(progress);
      
      this.viewBox.x = startX + (targetViewBoxX - startX) * ease;
      this.viewBox.y = startY + (targetViewBoxY - startY) * ease;
      this.viewBox.width = startWidth + (zoomWidth - startWidth) * ease;
      this.viewBox.height = startHeight + (targetHeight - startHeight) * ease;
      
      this.updateViewBox();
      
      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  resetView() {
    this.flyTo(this.mapWidth / 2, this.mapHeight / 2, this.mapWidth, 1200);
  }

  /**
   * Put the view exactly where told, with no animation.
   *
   * Restoring from an address — on load or on Back — has to land on the value
   * that was shared, not near it. flyTo() would interpolate towards it over
   * 1.5 s while the reader watches a view they did not ask for, and any pointer
   * event in that window would cancel the animation part-way and leave the
   * address bar describing a view the map never reached.
   */
  setViewBox(x, y, width) {
    if (![x, y, width].every(Number.isFinite) || width <= 0) return false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this._zoomAnimId) cancelAnimationFrame(this._zoomAnimId);
    this.animationId = null;
    this._zoomAnimId = null;

    this.viewBox.width = Math.max(this.minWidth, Math.min(this.maxWidth, width));
    this.viewBox.height = this.viewBox.width * (this.mapHeight / this.mapWidth);
    this.viewBox.x = x;
    this.viewBox.y = y;
    this.updateViewBox();
    return true;
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x.toFixed(2)} ${this.viewBox.y.toFixed(2)} ${this.viewBox.width.toFixed(2)} ${this.viewBox.height.toFixed(2)}`);
    if (window.atlasApp && window.atlasApp.mapRenderer) {
      // Panning does not change label overlap in map space. Re-running getBBox
      // collision detection for every pointer event was the primary source of
      // stutter on the large terrain image, so refresh only after a meaningful
      // zoom change.
      const previous = this._lastLabelVisibilityWidth;
      const changedEnough = previous === null || Math.abs(this.viewBox.width - previous) / previous >= 0.12;
      if (changedEnough) {
        window.atlasApp.mapRenderer.updateLabelVisibility(this.viewBox.width);
        this._lastLabelVisibilityWidth = this.viewBox.width;
      }
    }
    // Fires once per animation frame during a flyTo, so the subscriber must
    // debounce rather than push a history entry (see Router.syncState).
    this.onViewBoxChange?.(this.viewBox);
  }
}
