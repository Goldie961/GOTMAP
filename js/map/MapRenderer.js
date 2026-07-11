import { createSVGElement } from '../utils/helpers.js';
import { MapGeography } from './MapGeography.js';
import { getHouseColor } from '../utils/colors.js';

// Tier-1 locations: always visible, largest labels
const CAPITAL_LOCATIONS = new Set([
  'kings_landing', 'winterfell', 'casterly_rock', 'highgarden', 'sunspear',
  'storm_end', 'the_eyrie', 'riverrun', 'pyke', 'dragonstone', 'oldtown',
  'harrenhal', 'the_wall', 'moat_cailin'
]);

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

  /* ─────────────────────────────────────────────
     SVG Defs — textures, gradients, patterns, filters
     ───────────────────────────────────────────── */
  createDefs() {
    const defs = createSVGElement('defs');

    // ── PARCHMENT ──────────────────────────────
    // Radial gradient for warm, uneven parchment fill
    const parchGrad = createSVGElement('radialGradient', {
      id: 'parchmentFill', cx: '40%', cy: '45%', r: '65%'
    });
    this._addStops(parchGrad, [
      ['0%', '#FFF8E7'], ['55%', '#F4E4C1'], ['100%', '#E8D4A8']
    ]);
    defs.appendChild(parchGrad);

    // Paper grain filter (fractal noise blended multiplicatively)
    const grain = createSVGElement('filter', {
      id: 'paperGrain', x: '0%', y: '0%', width: '100%', height: '100%'
    });
    grain.appendChild(createSVGElement('feTurbulence', {
      type: 'fractalNoise', baseFrequency: '0.65', numOctaves: '3',
      stitchTiles: 'stitch', result: 'noise', seed: '2'
    }));
    grain.appendChild(createSVGElement('feColorMatrix', {
      type: 'saturate', values: '0', in: 'noise', result: 'mono'
    }));
    grain.appendChild(createSVGElement('feBlend', {
      in: 'SourceGraphic', in2: 'mono', mode: 'multiply'
    }));
    defs.appendChild(grain);

    // Age stain pattern (subtle foxing spots)
    const ages = createSVGElement('pattern', {
      id: 'ageStains', width: '500', height: '600', patternUnits: 'userSpaceOnUse'
    });
    ages.appendChild(createSVGElement('rect', { width: '500', height: '600', fill: 'none' }));
    [
      { cx: 80, cy: 130, rx: 30, ry: 22, fill: 'rgba(175,145,95,0.06)' },
      { cx: 340, cy: 55, rx: 22, ry: 28, fill: 'rgba(155,125,75,0.04)' },
      { cx: 200, cy: 400, rx: 38, ry: 26, fill: 'rgba(165,135,85,0.05)' },
      { cx: 430, cy: 280, rx: 24, ry: 16, fill: 'rgba(145,115,65,0.035)' },
      { cx: 120, cy: 520, rx: 20, ry: 32, fill: 'rgba(160,130,80,0.04)' },
    ].forEach(s => ages.appendChild(createSVGElement('ellipse', s)));
    defs.appendChild(ages);

    // ── SEA ─────────────────────────────────────
    const seaGrad = createSVGElement('linearGradient', {
      id: 'seaGradient', x1: '0', y1: '0', x2: '0.3', y2: '1'
    });
    this._addStops(seaGrad, [
      ['0%', '#3D6B7F'], ['30%', '#4A7B90'],
      ['65%', '#5A8BA0'], ['100%', '#4A7585']
    ]);
    defs.appendChild(seaGrad);

    // Organic wave line pattern
    const waves = createSVGElement('pattern', {
      id: 'seaWaves', width: '200', height: '120',
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-3)'
    });
    waves.appendChild(createSVGElement('rect', { width: '200', height: '120', fill: 'none' }));
    [
      { d: 'M 0 25 Q 50 15 100 25 T 200 25', sw: '0.8', op: '0.12' },
      { d: 'M 10 55 Q 60 45 110 55 T 210 55', sw: '0.6', op: '0.08' },
      { d: 'M 5 85 Q 55 78 105 85 T 205 85', sw: '0.5', op: '0.06' },
      { d: 'M 15 108 Q 65 100 115 108 T 215 108', sw: '0.4', op: '0.05' },
    ].forEach(w => {
      waves.appendChild(createSVGElement('path', {
        d: w.d, fill: 'none', stroke: '#B0D0E0',
        'stroke-width': w.sw, opacity: w.op
      }));
    });
    defs.appendChild(waves);

    // ── MARKER GLOW FILTERS ────────────────────
    ['markerGlowHover', 'markerGlowSelected'].forEach((id, i) => {
      const f = createSVGElement('filter', {
        id, x: '-50%', y: '-50%', width: '200%', height: '200%'
      });
      f.appendChild(createSVGElement('feGaussianBlur', {
        stdDeviation: i === 0 ? '3' : '5', result: 'blur'
      }));
      const m = createSVGElement('feMerge');
      m.appendChild(createSVGElement('feMergeNode', { in: 'blur' }));
      m.appendChild(createSVGElement('feMergeNode', { in: 'SourceGraphic' }));
      f.appendChild(m);
      defs.appendChild(f);
    });

    // ── COMPASS ROSE ───────────────────────────
    const compass = createSVGElement('g', {
      id: 'compass-rose', transform: 'translate(900, 1300) scale(0.5)'
    });
    compass.appendChild(createSVGElement('circle', {
      r: '60', fill: 'none', stroke: '#8B7340',
      'stroke-width': '1.2', opacity: '0.4'
    }));
    compass.appendChild(createSVGElement('circle', {
      r: '48', fill: 'none', stroke: '#8B7340',
      'stroke-width': '0.5', 'stroke-dasharray': '3 4', opacity: '0.25'
    }));
    // Cardinal points
    [
      ['0,-70 7,-7 0,0', '#8B7340', '0.5'],
      ['0,-70 -7,-7 0,0', '#5C4830', '0.35'],
      ['0,70 7,7 0,0', '#5C4830', '0.35'],
      ['0,70 -7,7 0,0', '#8B7340', '0.5'],
      ['70,0 7,7 0,0', '#8B7340', '0.5'],
      ['70,0 7,-7 0,0', '#5C4830', '0.35'],
      ['-70,0 -7,7 0,0', '#5C4830', '0.35'],
      ['-70,0 -7,-7 0,0', '#8B7340', '0.5'],
    ].forEach(([pts, fill, op]) => {
      compass.appendChild(createSVGElement('polygon', { points: pts, fill, opacity: op }));
    });
    const nLabel = createSVGElement('text', {
      x: '0', y: '-80', 'text-anchor': 'middle', fill: '#8B7340',
      'font-family': 'Cinzel', 'font-size': '12', 'font-weight': 'bold', opacity: '0.45'
    });
    nLabel.textContent = 'N';
    compass.appendChild(nLabel);
    defs.appendChild(compass);

    this.svg.appendChild(defs);
  }

  _addStops(gradient, stops) {
    stops.forEach(([offset, color]) => {
      gradient.appendChild(createSVGElement('stop', { offset, 'stop-color': color }));
    });
  }

  /* ─────────────────────────────────────────────
     Map rendering pipeline
     ───────────────────────────────────────────── */
  async renderMap(worldState) {
    await this.geography.loadData();
    this.geography.renderAll();

    // Locations layer (above terrain, below overlays)
    const locationsGroup = createSVGElement('g', { id: 'layer-locations' });
    this.svg.appendChild(locationsGroup);

    // Compass rose
    this.svg.appendChild(createSVGElement('use', { href: '#compass-rose' }));

    this.updateWorldState(worldState);
  }

  updateWorldState(worldState) {
    if (!worldState) return;
    this.geography.updateRegionColors(worldState);
    this.renderLocationMarkers(worldState);
  }

  /* ─────────────────────────────────────────────
     Location markers — cartographic style
     ───────────────────────────────────────────── */
  renderLocationMarkers(worldState) {
    let group = this.svg.getElementById('layer-locations');
    if (!group) {
      group = createSVGElement('g', { id: 'layer-locations' });
      this.svg.appendChild(group);
    }
    group.innerHTML = '';

    const locations = window.atlasDataManager ? window.atlasDataManager.getAllLocations() : [];

    locations.forEach(loc => {
      // Resolve ruling house at current year
      let houseId = 'unknown';
      if (loc.timeline) {
        const matches = loc.timeline.filter(t => t.year <= worldState.year);
        if (matches.length > 0) houseId = matches[matches.length - 1].house;
      }
      if (loc.house) houseId = loc.house;

      const houseColor = getHouseColor(houseId);

      // Determine label tier
      let tier = '3';
      if (CAPITAL_LOCATIONS.has(loc.id)) tier = '1';
      else if (loc.type === 'castle' || loc.type === 'fortress' || loc.type === 'city') tier = '2';

      const marker = createSVGElement('g', {
        class: 'location-marker',
        'data-location-id': loc.id,
        transform: `translate(${loc.coordinates.x}, ${loc.coordinates.y})`
      });

      // ── Marker shapes ──
      if (loc.type === 'castle' || loc.type === 'fortress') {
        const sz = loc.type === 'fortress' ? 1.2 : 1;
        const s = 5 * sz;
        // Small square keep with crenellations
        marker.appendChild(createSVGElement('rect', {
          x: -s, y: -s * 1.8, width: s * 2, height: s * 2.2,
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7', rx: '0.5'
        }));
        for (let i = -1; i <= 1; i++) {
          marker.appendChild(createSVGElement('rect', {
            x: -s + (i + 1) * s * 0.6, y: -s * 2.1, width: s * 0.4, height: s * 0.35,
            fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.4'
          }));
        }
      } else if (loc.type === 'city') {
        marker.appendChild(createSVGElement('circle', {
          cx: '0', cy: '0', r: '5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7'
        }));
        marker.appendChild(createSVGElement('circle', {
          cx: '0', cy: '0', r: '1.8', fill: '#3C2820'
        }));
      } else {
        const r = loc.type === 'landmark' ? 3 : 3.5;
        marker.appendChild(createSVGElement('circle', {
          cx: '0', cy: '0', r: r.toString(),
          fill: loc.type === 'landmark' ? '#8B7340' : houseColor,
          stroke: '#3C2820', 'stroke-width': '0.5'
        }));
      }

      // ── Label with tier ──
      const tierClass = tier === '1' ? 'capital' : tier === '2' ? 'castle' : 'minor';
      const label = createSVGElement('text', {
        x: '0',
        y: (loc.type === 'castle' || loc.type === 'fortress') ? '-16' : '-10',
        class: `map-label map-label-${tierClass}`,
        'data-label-tier': tier,
        'text-anchor': 'middle'
      });
      label.textContent = loc.name;
      marker.appendChild(label);

      // ── Interaction events ──
      marker.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('locationSelected', {
          detail: { locationId: loc.id }
        }));
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

  /* ─────────────────────────────────────────────
     Label collision — zoom-based visibility
     ───────────────────────────────────────────── */
  updateLabelVisibility(viewBoxWidth) {
    const labels = this.svg.querySelectorAll('.map-label');
    labels.forEach(label => {
      const tier = label.getAttribute('data-label-tier');
      if (viewBoxWidth > 700) {
        // Zoomed out: only capitals + region/sea labels
        label.style.opacity = (tier === '1' || tier === 'region' || tier === 'sea') ? '' : '0';
      } else if (viewBoxWidth > 400) {
        // Medium zoom: capitals + castles + region/sea
        label.style.opacity = (tier === '3') ? '0' : '';
      } else {
        // Zoomed in: everything visible
        label.style.opacity = '';
      }
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
    this.svg.querySelectorAll('.location-marker.selected').forEach(el => {
      el.classList.remove('selected', 'glow-pulsing');
    });
  }
}
