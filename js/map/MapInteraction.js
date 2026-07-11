import { screenToSVG } from '../utils/coordinates.js';
import { easeInOutCubic } from '../utils/helpers.js';

export class MapInteraction {
  constructor(svgElement, options = {}) {
    this.svg = svgElement;
    this.container = svgElement.parentElement;
    
    // Default viewBox state
    this.viewBox = { x: 0, y: 0, width: 1000, height: 1400 };
    
    // Zoom constraints
    this.minWidth = 200;
    this.maxWidth = 1000;
    
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    
    this.animationId = null;

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
    
    // Scale movement by zoom level
    const scale = this.viewBox.width / this.container.clientWidth;
    
    this.viewBox.x -= dx * scale;
    this.viewBox.y -= dy * scale;
    
    // Constrain pan within reasonable boundaries
    const margin = 200;
    this.viewBox.x = Math.max(-margin, Math.min(1000 - this.viewBox.width + margin, this.viewBox.x));
    this.viewBox.y = Math.max(-margin, Math.min(1400 - this.viewBox.height + margin, this.viewBox.y));
    
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
    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert screen coordinates of mouse to SVG coordinates
    const scaleX = this.viewBox.width / this.container.clientWidth;
    const scaleY = this.viewBox.height / this.container.clientHeight;
    const svgMouseX = this.viewBox.x + mouseX * scaleX;
    const svgMouseY = this.viewBox.y + mouseY * scaleY;
    
    // Determine zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    
    this.zoom(zoomFactor, svgMouseX, svgMouseY);
  }

  zoom(factor, centerX, centerY) {
    const newWidth = this.viewBox.width * factor;
    const newHeight = this.viewBox.height * factor;
    
    // Constrain width
    if (newWidth < this.minWidth || newWidth > this.maxWidth) return;
    
    // Zoom toward point
    this.viewBox.x = centerX - (centerX - this.viewBox.x) * factor;
    this.viewBox.y = centerY - (centerY - this.viewBox.y) * factor;
    this.viewBox.width = newWidth;
    this.viewBox.height = newHeight;
    
    this.updateViewBox();
  }

  flyTo(targetX, targetY, zoomWidth, duration = 1500) {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    const startX = this.viewBox.x;
    const startY = this.viewBox.y;
    const startWidth = this.viewBox.width;
    const startHeight = this.viewBox.height;
    
    const targetHeight = zoomWidth * 1.4; // 1000:1400 ratio
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
    this.flyTo(500, 700, 1000, 1200);
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x.toFixed(2)} ${this.viewBox.y.toFixed(2)} ${this.viewBox.width.toFixed(2)} ${this.viewBox.height.toFixed(2)}`);
    if (window.atlasApp && window.atlasApp.mapRenderer) {
      window.atlasApp.mapRenderer.updateLabelVisibility(this.viewBox.width);
    }
  }
}
