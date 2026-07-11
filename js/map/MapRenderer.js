import { createSVGElement } from '../utils/helpers.js';
import { MapGeography } from './MapGeography.js';
import { getHouseColor } from '../utils/colors.js';

export class MapRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.geography = null;
  }

  init() {
    this.svg = createSVGElement('svg', {
      id: 'map-svg',
      viewBox: '0 0 1000 1400',
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%'
    });
    this.container.appendChild(this.svg);
    this.createDefs();

    this.geography = new MapGeography(this.svg);
  }

  createDefs() {
    const defs = createSVGElement('defs');

    // Hover glow filter
    const hoverGlow = createSVGElement('filter', {
      id: 'markerGlowHover',
      x: '-50%',
      y: '-50%',
      width: '200%',
      height: '200%'
    });
    hoverGlow.appendChild(createSVGElement('feGaussianBlur', { stdDeviation: '3', result: 'blur' }));
    hoverGlow.appendChild(createSVGElement('feComponentTransfer'));
    // merge hover state
    const hoverMerge = createSVGElement('feMerge');
    hoverMerge.appendChild(createSVGElement('feMergeNode', { in: 'blur' }));
    hoverMerge.appendChild(createSVGElement('feMergeNode', { in: 'SourceGraphic' }));
    hoverGlow.appendChild(hoverMerge);
    defs.appendChild(hoverGlow);

    // Selected glow filter
    const selectGlow = createSVGElement('filter', {
      id: 'markerGlowSelected',
      x: '-50%',
      y: '-50%',
      width: '200%',
      height: '200%'
    });
    selectGlow.appendChild(createSVGElement('feGaussianBlur', { stdDeviation: '5', result: 'blur' }));
    const selectMerge = createSVGElement('feMerge');
    selectMerge.appendChild(createSVGElement('feMergeNode', { in: 'blur' }));
    selectMerge.appendChild(createSVGElement('feMergeNode', { in: 'SourceGraphic' }));
    selectGlow.appendChild(selectMerge);
    defs.appendChild(selectGlow);

    // Sea gradient pattern
    const pattern = createSVGElement('pattern', {
      id: 'seaPattern',
      width: '100',
      height: '100',
      patternUnits: 'userSpaceOnUse'
    });
    pattern.appendChild(createSVGElement('rect', {
      width: '100',
      height: '100',
      fill: 'var(--sea-deep)'
    }));
    // Wave paths in pattern
    const wave1 = createSVGElement('path', {
      d: 'M 0 20 Q 25 15, 50 20 T 100 20',
      fill: 'none',
      stroke: 'var(--sea)',
      'stroke-width': '0.5',
      opacity: '0.3'
    });
    const wave2 = createSVGElement('path', {
      d: 'M 0 70 Q 25 65, 50 70 T 100 70',
      fill: 'none',
      stroke: 'var(--sea)',
      'stroke-width': '0.5',
      opacity: '0.3'
    });
    pattern.appendChild(wave1);
    pattern.appendChild(wave2);
    defs.appendChild(pattern);

    // Ornate compass rose symbol in bottom right
    const compass = createSVGElement('g', { id: 'compass-rose', transform: 'translate(880, 1250) scale(0.6)' });
    // Dial and stars
    compass.appendChild(createSVGElement('circle', { r: '60', fill: 'none', stroke: 'var(--gold)', 'stroke-width': '2' }));
    compass.appendChild(createSVGElement('circle', { r: '50', fill: 'none', stroke: 'var(--gold-dark)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    // Points
    compass.appendChild(createSVGElement('polygon', { points: '0,-75 10,-10 0,0', fill: 'var(--gold)' }));
    compass.appendChild(createSVGElement('polygon', { points: '0,-75 -10,-10 0,0', fill: 'var(--gold-dark)' }));
    compass.appendChild(createSVGElement('polygon', { points: '0,75 10,10 0,0', fill: 'var(--gold-dark)' }));
    compass.appendChild(createSVGElement('polygon', { points: '0,75 -10,10 0,0', fill: 'var(--gold)' }));
    compass.appendChild(createSVGElement('polygon', { points: '75,0 10,10 0,0', fill: 'var(--gold)' }));
    compass.appendChild(createSVGElement('polygon', { points: '75,0 10,-10 0,0', fill: 'var(--gold-dark)' }));
    compass.appendChild(createSVGElement('polygon', { points: '-75,0 -10,10 0,0', fill: 'var(--gold-dark)' }));
    compass.appendChild(createSVGElement('polygon', { points: '-75,0 -10,-10 0,0', fill: 'var(--gold)' }));
    // N, S, E, W Text
    const textN = createSVGElement('text', { x: '0', y: '-85', 'text-anchor': 'middle', fill: 'var(--gold)', 'font-family': 'Cinzel', 'font-size': '16', 'font-weight': 'bold' });
    textN.textContent = 'N';
    compass.appendChild(textN);
    defs.appendChild(compass);

    this.svg.appendChild(defs);
  }

  async renderMap(worldState) {
    await this.geography.loadData();
    this.geography.renderAll();

    // Instantiate locations layer
    const locationsGroup = createSVGElement('g', { id: 'layer-locations' });
    this.svg.appendChild(locationsGroup);

    // Append compass rose
    const compassUse = createSVGElement('use', { href: '#compass-rose' });
    this.svg.appendChild(compassUse);

    this.updateWorldState(worldState);
  }

  updateWorldState(worldState) {
    if (!worldState) return;

    // 1. Update region overlays based on house color
    this.geography.updateRegionColors(worldState);

    // 2. Render/update location markers
    this.renderLocationMarkers(worldState);
  }

  renderLocationMarkers(worldState) {
    let group = this.svg.getElementById('layer-locations');
    if (!group) {
      group = createSVGElement('g', { id: 'layer-locations' });
      this.svg.appendChild(group);
    }
    group.innerHTML = ''; // Clear existing markers

    // Merge castles, cities, landmarks
    const locations = [];
    if (window.atlasDataManager) {
      locations.push(...window.atlasDataManager.getAllLocations());
    }

    locations.forEach(loc => {
      // Find ruling house for this location in this worldState
      let houseId = 'unknown';
      if (loc.timeline) {
        // Find newest entry <= current year
        const matches = loc.timeline.filter(t => t.year <= worldState.year);
        if (matches.length > 0) {
          const activeState = matches[matches.length - 1];
          houseId = activeState.house;
        }
      }
      if (loc.house) {
        houseId = loc.house;
      }

      const houseColor = getHouseColor(houseId);

      const marker = createSVGElement('g', {
        class: 'location-marker',
        'data-location-id': loc.id,
        transform: `translate(${loc.coordinates.x}, ${loc.coordinates.y})`
      });

      // Different marker styles by type
      if (loc.type === 'castle') {
        // Draw castle tower
        const tower = createSVGElement('path', {
          d: 'M -6 -10 L 6 -10 L 6 -6 L 4 -6 L 4 10 L -4 10 L -4 -6 L -6 -6 Z',
          fill: houseColor,
          stroke: 'var(--ink)',
          'stroke-width': '1'
        });
        marker.appendChild(tower);
      } else if (loc.type === 'fortress') {
        // Draw larger fort
        const fort = createSVGElement('path', {
          d: 'M -8 -8 L -4 -8 L -4 -4 L 4 -4 L 4 -8 L 8 -8 L 8 10 L -8 10 Z',
          fill: houseColor,
          stroke: 'var(--ink)',
          'stroke-width': '1.5'
        });
        marker.appendChild(fort);
      } else if (loc.type === 'city') {
        // City icon (cluster of buildings)
        const city = createSVGElement('path', {
          d: 'M -8 10 L -8 0 L -4 -4 L 0 0 L 4 -6 L 8 0 L 8 10 Z',
          fill: houseColor,
          stroke: 'var(--ink)',
          'stroke-width': '1'
        });
        marker.appendChild(city);
      } else {
        // Standard circle marker for small towns and natural locations
        const circle = createSVGElement('circle', {
          cx: '0',
          cy: '0',
          r: loc.type === 'town' ? '5' : '4',
          fill: loc.type === 'landmark' ? 'var(--gold-dark)' : houseColor,
          stroke: 'var(--ink)',
          'stroke-width': '1'
        });
        marker.appendChild(circle);
      }

      // Add text label
      const label = createSVGElement('text', {
        x: '0',
        y: loc.type === 'castle' || loc.type === 'fortress' ? '-14' : '-10',
        class: 'map-label',
        'text-anchor': 'middle'
      });
      label.textContent = loc.name;
      marker.appendChild(label);

      // Events
      marker.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('locationSelected', { detail: { locationId: loc.id } }));
      });

      marker.addEventListener('mouseenter', (e) => {
        document.dispatchEvent(new CustomEvent('locationHovered', {
          detail: { location: loc, x: e.clientX, y: e.clientY, show: true }
        }));
      });

      marker.addEventListener('mouseleave', () => {
        document.dispatchEvent(new CustomEvent('locationHovered', {
          detail: { show: false }
        }));
      });

      group.appendChild(marker);
    });
  }

  highlightLocation(locationId) {
    this.clearHighlight();
    const marker = this.svg.querySelector(`.location-marker[data-location-id="${locationId}"]`);
    if (marker) {
      marker.classList.add('selected');
      marker.classList.add('glow-pulsing');
    }
  }

  clearHighlight() {
    const selected = this.svg.querySelectorAll('.location-marker.selected');
    selected.forEach(el => {
      el.classList.remove('selected');
      el.classList.remove('glow-pulsing');
    });
  }
}
