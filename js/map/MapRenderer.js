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

    // ── MARKER GLOW FILTERS (very subtle per Faza 6) ──
    ['markerGlowHover', 'markerGlowSelected'].forEach((id, i) => {
      const f = createSVGElement('filter', {
        id, x: '-30%', y: '-30%', width: '160%', height: '160%'
      });
      f.appendChild(createSVGElement('feGaussianBlur', {
        stdDeviation: i === 0 ? '1.5' : '2.5', result: 'blur'
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

  updateWorldState(worldState, animated = false) {
    if (!worldState) return;
    this.geography.updateRegionColors(worldState, animated);
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
      const locId = loc.id;
      if (locId === 'winterfell') {
        // Winterfell -> heavy round drum towers, keep, timber roofs
        marker.appendChild(createSVGElement('path', {
          d: 'M -10,5 L -10,-2 Q 0,-4 10,-2 L 10,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L -8,-9 C -8,-10.5 -5,-11.5 -5,-9 L -5,5 M 3,5 L 3,-7 C 3,-8.5 6,-9.5 6,-7 L 6,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        // Conical roofs
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-9 L -6.5,-13 L -5,-9 Z M 3,-7 L 4.5,-11 L 6,-7 Z',
          fill: '#3C2820', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'casterly_rock') {
        // Casterly Rock -> massive rock with castle structure carved on top
        marker.appendChild(createSVGElement('path', {
          d: 'M -13,5 L -11,-1 Q -9,-7 -4,-9 L 0,-11 L 4,-8 L 8,-3 L 11,5 Z',
          fill: '#7A6B58', stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        // Small towers on top
        marker.appendChild(createSVGElement('path', {
          d: 'M -4,-9 L -4,-13 L -2,-13 L -2,-10 M 1,-9 L 1,-12 L 3,-12 L 3,-8',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        }));
      } else if (locId === 'castle_black') {
        // Castle Black -> giant ice wall background + wooden keep
        marker.appendChild(createSVGElement('path', {
          d: 'M -15,5 L -15,-15 L 15,-15 L 15,5 Z',
          fill: '#E2EEF4', stroke: '#7FA8B5', 'stroke-width': '0.6', 'fill-opacity': '0.8'
        }));
        marker.appendChild(createSVGElement('rect', {
          x: '-7', y: '-3', width: '13', height: '8',
          fill: '#5A4632', stroke: '#2A1A0C', 'stroke-width': '0.75'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -2,-15 L 8,-15 M 5,-15 L 5,3',
          stroke: '#2A1A0C', 'stroke-width': '0.7'
        }));
      } else if (locId === 'dragonstone') {
        // Dragonstone -> volcanic dark keep with spiky wing spires
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L -5,-11 Q -3.5,-7 -2,5 M -3,5 L 0,-17 Q 1.5,-10 3,5 M 2,5 L 5,-11 Q 6.5,-7 8,5 M -8,5 L -8,0 Q 0,-3 8,0 L 8,5 Z',
          fill: '#2F3538', stroke: '#1B1F21', 'stroke-width': '0.85'
        }));
      } else if (locId === 'hightower' || locId === 'oldtown_city') {
        // Oldtown -> Hightower lighthouse beacon
        marker.appendChild(createSVGElement('path', {
          d: 'M -7,5 L -5,-3 L 5,-3 L 7,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -4,-3 L -3,-11 L 3,-11 L 4,-3 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -2,-11 L -1.5,-17 L 1.5,-17 L 2,-11 Z',
          fill: '#FFF8E7', stroke: '#3C2820', 'stroke-width': '0.6'
        }));
        // Fire beacon lines
        marker.appendChild(createSVGElement('path', {
          d: 'M -1.5,-17 L 0,-21 L 1.5,-17 M -4,-19 L -1,-18 M 4,-19 L 1,-18',
          stroke: '#E25822', 'stroke-width': '0.75', 'stroke-linecap': 'round'
        }));
      } else if (locId === 'kings_landing') {
        // King's Landing -> Red Keep towers & dome
        marker.appendChild(createSVGElement('path', {
          d: 'M -4,5 L -4,-1 C -4,-6 4,-6 4,-1 L 4,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L -8,-7 L -6,-7 L -6,5 M 6,5 L 6,-7 L 8,-7 L 8,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.8'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-7 L -7,-11 L -6,-7 Z M 6,-7 L 7,-11 L 8,-7 Z',
          fill: '#8B2500', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'storm_end') {
        // Storm's End -> giant round drum tower & shield wall
        marker.appendChild(createSVGElement('path', {
          d: 'M -9,5 L -9,-6 C -9,-9 -5,-10 -4,-10 L 4,-10 C 5,-10 9,-9 9,-6 L 9,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.9'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -11,5 L -11,-1 Q 0,-3 11,-1 L 11,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
      } else if (locId === 'the_eyrie') {
        // The Eyrie -> towers hanging on jagged peaks
        marker.appendChild(createSVGElement('path', {
          d: 'M -10,5 L -6,0 L 0,-6 L 6,0 L 10,5 Z',
          fill: '#9AB2B7', stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -4,0 L -3,-14 L -1,-14 L -2,0 Z M 1,-2 L 2,-19 L 4,-19 L 3,-2 Z',
          fill: '#E8EFF1', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'riverrun') {
        // Riverrun -> triangular castle nestled in water arches
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L 0,-5 L 8,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -9,5 L -9,2 L -6,2 L -6,5 M 6,5 L 6,2 L 9,2 L 9,5 M -1.5,-5 L -1.5,-9 L 1.5,-9 L 1.5,-5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        }));
      } else if (locId === 'pyke') {
        // Pyke -> towers on sea stacks with rope bridge arches
        marker.appendChild(createSVGElement('path', {
          d: 'M -9,5 L -9,-1 L -6,-1 L -6,5 M -2,5 L -2,-4 L 1,-4 L 1,5 M 5,5 L 5,-2 L 8,-2 L 8,5',
          fill: '#5A5144', stroke: '#3C2820', 'stroke-width': '0.8'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-1 L -8,-5 L -7,-5 L -7,-1 M -1,-4 L -1,-9 L 0,-9 L 0,-4 M 6,-2 L 6,-7 L 7,-7 L 7,-2',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -6,1 Q -4,0 -2,1 M 1,0 Q 3,-1 5,0',
          stroke: '#3C2820', 'stroke-width': '0.5', fill: 'none'
        }));
      } else if (locId === 'harrenhal') {
        // Harrenhal -> 5 melted, broken, black towers
        marker.appendChild(createSVGElement('path', {
          d: `M -11,5 L -10,-3 L -8,0 L -7,5 Z
              M -6,5 L -6,-9 L -4,-6 L -3,5 Z
              M -2,5 L -2,-12 Q 0,-9 1,5 Z
              M 2,5 L 2,-6 L 4,-4 L 5,5 Z
              M 6,5 L 7,-2 L 9,-1 L 9,5 Z`,
          fill: '#1E1E1E', stroke: '#0D0D0D', 'stroke-width': '0.8'
        }));
      } else if (loc.type === 'castle' || loc.type === 'fortress') {
        // Standard keep (two towers + gate)
        marker.appendChild(createSVGElement('path', {
          d: 'M -6,5 L -6,-1 Q 0,-3 6,-1 L 6,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L -8,-6 L -5,-6 L -5,5 M 5,5 L 5,-6 L 8,-6 L 8,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-6 L -6.5,-9 L -5,-6 Z M 5,-6 L 6.5,-9 L 8,-6 Z',
          fill: '#3C2820', stroke: '#3C2820', 'stroke-width': '0.6'
        }));
      } else if (loc.type === 'city') {
        // City marker (cluster of 3 tiny roof/keep houses)
        marker.appendChild(createSVGElement('path', {
          d: 'M -7,5 L -7,0 L -3,-3 L 1,0 L 1,5 Z M 1,5 L 1,1 L 4,-1 L 7,1 L 7,5 Z M -3,5 L -3,-4 L 0,-6 L 3,-4 L 3,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        }));
      } else {
        // Simple village/town circle
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
