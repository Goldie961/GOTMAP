import { createSVGElement } from '../utils/helpers.js';
import { MapGeography } from './MapGeography.js';
import { getHouseColor } from '../utils/colors.js';

// Tier-1 locations: always visible, largest labels
const CAPITAL_LOCATIONS = new Set([
  'kings_landing', 'winterfell', 'casterly_rock', 'highgarden', 'sunspear',
  'storm_end', 'the_eyrie', 'riverrun', 'pyke', 'dragonstone', 'oldtown',
  'harrenhal', 'the_wall', 'moat_cailin'
]);

const DEFAULT_WORLD_CANVAS = { width: 1500, height: 1000 };

export class MapRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.geography = null;
    this._markerCache = new Map();     // locationId -> { container, marker, fills[] }
    this._selectedLocationId = null;    // Bug B: persist selection across timeline updates
    this._rafPending = false;           // Bug A: rAF coalescing flag
    this._pendingWorldState = null;     // Bug A: latest world state waiting for rAF
    this.renderedPositions = new Map(); // Store visual coordinates after decluttering
    this.canvas = DEFAULT_WORLD_CANVAS;
    this.mapDefinition = null;
    this._lastWorldState = null;
    this.selectedRegionId = null;
    this._missingCoordinatesKey = null;
  }

  init() {
    this.mapDefinition = window.atlasDataManager?.getMapDefinition?.('world') || null;
    const coordinateSpace = window.atlasDataManager?.getMapCoordinateSpace?.('world');
    if (coordinateSpace?.width && coordinateSpace?.height) {
      this.canvas = { width: coordinateSpace.width, height: coordinateSpace.height };
    }
    this.svg = createSVGElement('svg', {
      id: 'map-svg',
      viewBox: `0 0 ${this.canvas.width} ${this.canvas.height}`,
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%'
    });
    this.svg.dataset.mapWidth = this.canvas.width;
    this.svg.dataset.mapHeight = this.canvas.height;
    this.svg.classList.add('terrain-map');
    this.container.appendChild(this.svg);
    this.createDefs();
    // Existing vector geography has no verified transform to the new terrain.
    // Do not load it until its geometry is explicitly calibrated.
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

    // ── UNEXPLORED HATCH PATTERN ──────────────
    // Cross-hatching for Far Lands / 'Here be dragons' zones
    const hatch = createSVGElement('pattern', {
      id: 'unexploredHatch', width: '12', height: '12',
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
    });
    hatch.appendChild(createSVGElement('rect', { width: '12', height: '12', fill: 'none' }));
    hatch.appendChild(createSVGElement('line', {
      x1: '0', y1: '0', x2: '0', y2: '12',
      stroke: 'rgba(92, 72, 48, 0.13)', 'stroke-width': '1.5'
    }));
    defs.appendChild(hatch);

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
    this.renderTerrainBackground();
    this.renderGeographicFeatures();

    // Locations layer (above terrain, below overlays)
    const locationsGroup = createSVGElement('g', { id: 'layer-locations' });
    this.svg.appendChild(locationsGroup);

    // Compass rose
    this.svg.appendChild(createSVGElement('use', { href: '#compass-rose' }));

    this.updateWorldState(worldState);
  }

  updateWorldState(worldState, animated = false) {
    if (!worldState) return;
    this._lastWorldState = worldState;

    // Bug A: Coalesce rapid timeline scrubs into a single rAF render
    this._pendingWorldState = worldState;
    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => {
        this._rafPending = false;
        if (this._pendingWorldState) {
          this.renderLocationMarkers(this._pendingWorldState);
        }
      });
    }
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

    // A location is only rendered after it has been calibrated for the new terrain map.
    // Legacy coordinates remain untouched in locations.json until the migration is complete.
    const allLocations = window.atlasDataManager?.getAllLocations?.() || [];
    const locations = allLocations.filter(loc => this.getLocationCoordinate(loc));
    if (window.atlasDataManager) {
      window.atlasDataManager.data.missingCoordinates = allLocations
        .filter(loc => !this.getLocationCoordinate(loc))
        .map(loc => loc.id);
      const missingKey = window.atlasDataManager.data.missingCoordinates.join(',');
      if (missingKey && missingKey !== this._missingCoordinatesKey) {
        console.info('[atlas] Locations omitted until calibrated:', window.atlasDataManager.data.missingCoordinates);
      }
      this._missingCoordinatesKey = missingKey;
    }

    // Run decluttering algorithm once if not already populated
    if (this.renderedPositions.size === 0 && locations.length > 0) {
      // Initialize with original coordinates
      locations.forEach(loc => {
        this.renderedPositions.set(loc.id, { ...this.getLocationCoordinate(loc) });
      });

      const threshold = 22;
      const minDistance = 24;
      const iterations = 3;

      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < locations.length; i++) {
          for (let j = i + 1; j < locations.length; j++) {
            const loc1 = locations[i];
            const loc2 = locations[j];
            const pos1 = this.renderedPositions.get(loc1.id);
            const pos2 = this.renderedPositions.get(loc2.id);

            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < threshold) {
              if (dist === 0) {
                // If exactly identical coordinates, push apart on X axis
                pos1.x += 12;
                pos2.x -= 12;
              } else {
                // Push apart along the line joining them
                const overlap = minDistance - dist;
                const shiftX = (dx / dist) * (overlap / 2);
                const shiftY = (dy / dist) * (overlap / 2);
                pos1.x += shiftX;
                pos1.y += shiftY;
                pos2.x -= shiftX;
                pos2.y -= shiftY;
              }
            }
          }
        }
      }
    }

    // The previous cache update only changed fills, leaving a stale crest when
    // a timeline transition changed rulers. Keep the DOM, but update the cached
    // crest image and its house-coloured frame as part of the same pass.
    if (this._markerCache.size > 0) {
      locations.forEach(loc => {
        try {
          const cached = this._markerCache.get(loc.id);
          if (!cached) return;
          const timeline = Array.isArray(loc.timeline) ? loc.timeline : [];
          const active = timeline.filter(t => t?.year <= worldState.year).at(-1);
          const houseId = loc.house || active?.house || active?.faction || 'unknown';
          const houseColor = getHouseColor(houseId);
          cached.fills.forEach(el => el.setAttribute('fill', houseColor));
          const crest = window.atlasDataManager?.getHouse?.(houseId)?.crest;
          if (cached.crestFrame) cached.crestFrame.setAttribute('stroke', houseColor);
          if (cached.crestImage && crest) cached.crestImage.setAttribute('href', crest);
        } catch (err) {
          console.error('[map-editor] Eșec actualizare marker pentru', loc?.id, err);
        }
      });

      // Bug B: Re-apply selection after in-place update
      if (this._selectedLocationId) {
        const sel = this.svg.querySelector(`.location-marker[data-location-id="${this._selectedLocationId}"]`);
        if (sel) {
          sel.classList.add('selected', 'glow-pulsing');
        }
      }
      return;
    }

    // First render: build all markers from scratch
    group.innerHTML = '';

    locations.forEach(loc => {
      try {
      // `house` must remain null when absent: an "unknown" fallback here would
      // override the ruling house resolved from the location timeline.
      loc = { ...loc, type: loc.type ?? 'unknown', region: loc.region ?? 'unknown', timeline: Array.isArray(loc.timeline) ? loc.timeline : [], house: loc.house ?? null, name: loc.name ?? loc.id ?? 'Unknown location' };
      const renderedPos = this.renderedPositions.get(loc.id) || this.getLocationCoordinate(loc);
      // Resolve ruling house at current year
      let houseId = 'unknown';
      if (loc.timeline) {
          const matches = loc.timeline.filter(t => t?.year <= worldState.year);
        if (matches.length > 0) {
          const active = matches[matches.length - 1];
            houseId = active?.house || active?.faction || 'unknown';
        }
      }
      if (loc.house) houseId = loc.house;

      const houseColor = getHouseColor(houseId);

      // Determine label tier
      let tier = '3';
      if (CAPITAL_LOCATIONS.has(loc.id)) tier = '1';
      else if (loc.type === 'castle' || loc.type === 'fortress' || loc.type === 'city') tier = '2';

      const markerContainer = createSVGElement('g', {
        class: `location-marker-position${this.selectedRegionId && loc.region !== this.selectedRegionId ? ' region-filtered-out' : ''}`,
        transform: `translate(${renderedPos.x}, ${renderedPos.y})`
      });

      const marker = createSVGElement('g', {
        class: 'location-marker',
        'data-location-id': loc.id
      });

      // Bug C: Invisible hit area rectangle (30×30 centered) for easier clicking
      marker.appendChild(createSVGElement('rect', {
        x: '-15', y: '-20', width: '30', height: '30',
        fill: 'transparent', stroke: 'none',
        class: 'marker-hit-area'
      }));

      // Track elements whose fill should update with house color
      const fillElements = [];
      let crestFrame = null;
      let crestImage = null;

      // ── Marker shapes ──
      // A house crest is the clearest visual identifier on a political map.
      // Keep it inside the same compact, coloured frame so differently shaped
      // heraldry remains legible at normal zoom.
      const rulingHouse = window.atlasDataManager?.getHouse?.(houseId);
      if (rulingHouse?.crest) {
        crestFrame = createSVGElement('circle', {
          cx: '0', cy: '-4', r: '11.5', fill: '#f5ead4', stroke: houseColor,
          'stroke-width': '2', class: 'house-crest-frame'
        });
        crestImage = createSVGElement('image', {
          x: '-9', y: '-13', width: '18', height: '18', href: rulingHouse.crest,
          preserveAspectRatio: 'xMidYMid meet', class: 'house-crest'
        });
        const fallback = createSVGElement('g', { class: 'house-crest-fallback', visibility: 'hidden' });
        if (loc.type === 'castle' || loc.type === 'fortress') {
          fallback.appendChild(createSVGElement('path', { d: 'M -7,5 L -7,-5 L -4,-5 L -4,-8 L -1,-8 L -1,-5 L 4,-5 L 4,-8 L 7,-8 L 7,5 Z', fill: '#6b5940', stroke: '#3C2820', 'stroke-width': '.8' }));
        } else if (loc.type === 'city') {
          fallback.appendChild(createSVGElement('path', { d: 'M -8,5 L -8,-1 L -4,-4 L 0,-1 L 0,-7 L 4,-4 L 4,0 L 8,2 L 8,5 Z', fill: '#6b5940', stroke: '#3C2820', 'stroke-width': '.8' }));
        } else {
          fallback.appendChild(createSVGElement('circle', { cx: '0', cy: '-4', r: '3', fill: '#8b7340', stroke: '#3C2820', 'stroke-width': '.6' }));
        }
        crestImage.addEventListener('error', () => { crestImage.setAttribute('visibility', 'hidden'); fallback.setAttribute('visibility', 'visible'); });
        marker.appendChild(crestFrame); marker.appendChild(crestImage); marker.appendChild(fallback);
      } else {
      const locId = loc.id;
      if (locId === 'winterfell') {
        const p1 = createSVGElement('path', {
          d: 'M -10,5 L -10,-2 Q 0,-4 10,-2 L 10,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        const p2 = createSVGElement('path', {
          d: 'M -8,5 L -8,-9 C -8,-10.5 -5,-11.5 -5,-9 L -5,5 M 3,5 L 3,-7 C 3,-8.5 6,-9.5 6,-7 L 6,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-9 L -6.5,-13 L -5,-9 Z M 3,-7 L 4.5,-11 L 6,-7 Z',
          fill: '#3C2820', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'casterly_rock') {
        marker.appendChild(createSVGElement('path', {
          d: 'M -13,5 L -11,-1 Q -9,-7 -4,-9 L 0,-11 L 4,-8 L 8,-3 L 11,5 Z',
          fill: '#7A6B58', stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        const p1 = createSVGElement('path', {
          d: 'M -4,-9 L -4,-13 L -2,-13 L -2,-10 M 1,-9 L 1,-12 L 3,-12 L 3,-8',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        });
        marker.appendChild(p1); fillElements.push(p1);
      } else if (locId === 'castle_black') {
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
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,5 L -5,-11 Q -3.5,-7 -2,5 M -3,5 L 0,-17 Q 1.5,-10 3,5 M 2,5 L 5,-11 Q 6.5,-7 8,5 M -8,5 L -8,0 Q 0,-3 8,0 L 8,5 Z',
          fill: '#2F3538', stroke: '#1B1F21', 'stroke-width': '0.85'
        }));
      } else if (locId === 'hightower' || locId === 'oldtown_city') {
        const p1 = createSVGElement('path', {
          d: 'M -7,5 L -5,-3 L 5,-3 L 7,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        const p2 = createSVGElement('path', {
          d: 'M -4,-3 L -3,-11 L 3,-11 L 4,-3 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
        marker.appendChild(createSVGElement('path', {
          d: 'M -2,-11 L -1.5,-17 L 1.5,-17 L 2,-11 Z',
          fill: '#FFF8E7', stroke: '#3C2820', 'stroke-width': '0.6'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -1.5,-17 L 0,-21 L 1.5,-17 M -4,-19 L -1,-18 M 4,-19 L 1,-18',
          stroke: '#E25822', 'stroke-width': '0.75', 'stroke-linecap': 'round'
        }));
      } else if (locId === 'kings_landing') {
        const p1 = createSVGElement('path', {
          d: 'M -4,5 L -4,-1 C -4,-6 4,-6 4,-1 L 4,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        const p2 = createSVGElement('path', {
          d: 'M -8,5 L -8,-7 L -6,-7 L -6,5 M 6,5 L 6,-7 L 8,-7 L 8,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.8'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-7 L -7,-11 L -6,-7 Z M 6,-7 L 7,-11 L 8,-7 Z',
          fill: '#8B2500', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'storm_end') {
        const p1 = createSVGElement('path', {
          d: 'M -9,5 L -9,-6 C -9,-9 -5,-10 -4,-10 L 4,-10 C 5,-10 9,-9 9,-6 L 9,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.9'
        });
        const p2 = createSVGElement('path', {
          d: 'M -11,5 L -11,-1 Q 0,-3 11,-1 L 11,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
      } else if (locId === 'the_eyrie') {
        marker.appendChild(createSVGElement('path', {
          d: 'M -10,5 L -6,0 L 0,-6 L 6,0 L 10,5 Z',
          fill: '#9AB2B7', stroke: '#3C2820', 'stroke-width': '0.85'
        }));
        marker.appendChild(createSVGElement('path', {
          d: 'M -4,0 L -3,-14 L -1,-14 L -2,0 Z M 1,-2 L 2,-19 L 4,-19 L 3,-2 Z',
          fill: '#E8EFF1', stroke: '#3C2820', 'stroke-width': '0.7'
        }));
      } else if (locId === 'riverrun') {
        const p1 = createSVGElement('path', {
          d: 'M -8,5 L 0,-5 L 8,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.85'
        });
        const p2 = createSVGElement('path', {
          d: 'M -9,5 L -9,2 L -6,2 L -6,5 M 6,5 L 6,2 L 9,2 L 9,5 M -1.5,-5 L -1.5,-9 L 1.5,-9 L 1.5,-5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
      } else if (locId === 'pyke') {
        marker.appendChild(createSVGElement('path', {
          d: 'M -9,5 L -9,-1 L -6,-1 L -6,5 M -2,5 L -2,-4 L 1,-4 L 1,5 M 5,5 L 5,-2 L 8,-2 L 8,5',
          fill: '#5A5144', stroke: '#3C2820', 'stroke-width': '0.8'
        }));
        const p1 = createSVGElement('path', {
          d: 'M -8,-1 L -8,-5 L -7,-5 L -7,-1 M -1,-4 L -1,-9 L 0,-9 L 0,-4 M 6,-2 L 6,-7 L 7,-7 L 7,-2',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(createSVGElement('path', {
          d: 'M -6,1 Q -4,0 -2,1 M 1,0 Q 3,-1 5,0',
          stroke: '#3C2820', 'stroke-width': '0.5', fill: 'none'
        }));
      } else if (locId === 'harrenhal') {
        marker.appendChild(createSVGElement('path', {
          d: `M -11,5 L -10,-3 L -8,0 L -7,5 Z
              M -6,5 L -6,-9 L -4,-6 L -3,5 Z
              M -2,5 L -2,-12 Q 0,-9 1,5 Z
              M 2,5 L 2,-6 L 4,-4 L 5,5 Z
              M 6,5 L 7,-2 L 9,-1 L 9,5 Z`,
          fill: '#1E1E1E', stroke: '#0D0D0D', 'stroke-width': '0.8'
        }));
      } else if (loc.type === 'castle' || loc.type === 'fortress') {
        const p1 = createSVGElement('path', {
          d: 'M -6,5 L -6,-1 Q 0,-3 6,-1 L 6,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        });
        const p2 = createSVGElement('path', {
          d: 'M -8,5 L -8,-6 L -5,-6 L -5,5 M 5,5 L 5,-6 L 8,-6 L 8,5',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.7'
        });
        marker.appendChild(p1); fillElements.push(p1);
        marker.appendChild(p2); fillElements.push(p2);
        marker.appendChild(createSVGElement('path', {
          d: 'M -8,-6 L -6.5,-9 L -5,-6 Z M 5,-6 L 6.5,-9 L 8,-6 Z',
          fill: '#3C2820', stroke: '#3C2820', 'stroke-width': '0.6'
        }));
      } else if (loc.type === 'city') {
        const p1 = createSVGElement('path', {
          d: 'M -7,5 L -7,0 L -3,-3 L 1,0 L 1,5 Z M 1,5 L 1,1 L 4,-1 L 7,1 L 7,5 Z M -3,5 L -3,-4 L 0,-6 L 3,-4 L 3,5 Z',
          fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
        });
        marker.appendChild(p1); fillElements.push(p1);
      } else {
        const r = loc.type === 'landmark' ? 3 : 3.5;
        const circle = createSVGElement('circle', {
          cx: '0', cy: '0', r: r.toString(),
          fill: loc.type === 'landmark' ? '#8B7340' : houseColor,
          stroke: '#3C2820', 'stroke-width': '0.5'
        });
        marker.appendChild(circle);
        if (loc.type !== 'landmark') fillElements.push(circle);
      }
      }

      // ── Label with tier ──
      const tierClass = tier === '1' ? 'capital' : tier === '2' ? 'castle' : 'minor';
      const label = createSVGElement('text', {
        x: '0',
        y: (loc.type === 'castle' || loc.type === 'fortress') ? '-16' : '-10',
        class: `map-label map-label-${tierClass}`,
        'data-label-tier': tier,
        'data-x': renderedPos.x,
        'data-y': renderedPos.y,
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

      markerContainer.appendChild(marker);
      group.appendChild(markerContainer);

      // Cache for in-place updates
      this._markerCache.set(loc.id, {
        container: markerContainer,
        marker: marker,
        fills: fillElements,
        crestFrame,
        crestImage
      });
      } catch (err) {
        console.error('[map-editor] Eșec randare marker pentru', loc?.id, err);
      }
    });

    this.updateLabelVisibility(this.canvas.width);
  }

  /* ─────────────────────────────────────────────
     Label collision — zoom-based visibility
     ───────────────────────────────────────────── */
  updateLabelVisibility(viewBoxWidth) {
    const labels = this.svg.querySelectorAll('.map-label');
    
    // Helper to check if two bounding boxes overlap
    function rectsOverlap(r1, r2, padding = 4) {
      return !(r2.x > r1.x + r1.width + padding ||
               r2.x + r2.width + padding < r1.x ||
               r2.y > r1.y + r1.height + padding ||
               r2.y + r2.height + padding < r1.y);
    }

    // Step 1: Filter candidates based on zoom thresholds
    const candidates = [];
    labels.forEach(label => {
      const tier = label.getAttribute('data-label-tier');
      const minZoom = Number(label.getAttribute('data-min-zoom') || 0);
      const currentZoom = this.canvas.width / viewBoxWidth;
      let isCandidate = false;

      if (viewBoxWidth > 700) {
        // Zoomed out: only capitals (1) + regions + seas
        isCandidate = (tier === '1' || tier === 'region' || tier === 'sea');
      } else if (viewBoxWidth > 400) {
        // Medium zoom: capitals (1) + castles/fortresses/cities (2) + regions + seas
        isCandidate = (tier !== '3');
      } else {
        // Zoomed in: everything is a candidate
        isCandidate = true;
      }

      if (currentZoom < minZoom) isCandidate = false;

      if (isCandidate) {
        label.style.opacity = '';
        candidates.push(label);
      } else {
        label.style.opacity = '0';
      }
    });

    // Step 2: Map to global bounding boxes and priorities
    const labelBoxes = candidates.map(label => {
      const localBBox = label.getBBox();
      const tier = label.getAttribute('data-label-tier');
      
      const dataX = label.getAttribute('data-x');
      const dataY = label.getAttribute('data-y');
      const x = dataX ? parseFloat(dataX) : 0;
      const y = dataY ? parseFloat(dataY) : 0;

      const isLocationLabel = (tier === '1' || tier === '2' || tier === '3');
      
      let width = localBBox.width;
      let height = localBBox.height;
      let localX = localBBox.x;
      let localY = localBBox.y;

      if (width === 0 || height === 0) {
        // Estimate size if browser layout has not run or is zero
        const textLength = label.textContent.length;
        let fontSize = 10;
        if (tier === '1') fontSize = 12;
        else if (tier === '2') fontSize = 10;
        else if (tier === 'region') fontSize = 13;
        else if (tier === 'sea') fontSize = 11;
        
        width = textLength * fontSize * 0.55;
        height = fontSize;
        localX = -width / 2; // middle anchor
        localY = isLocationLabel ? -16 : -5;
      }

      const globalX = isLocationLabel ? (x + localX) : (localX || x);
      const globalY = isLocationLabel ? (y + localY) : (localY || y);

      let priority = 0;
      if (tier === '1') priority = 5;       // Capitals (highest)
      else if (tier === '2') priority = 4;  // Major Castles & Cities
      else if (tier === '3') priority = 3;  // Minor Castles & Villages
      else if (tier === 'sea') priority = 2; // Seas
      else if (tier === 'region') priority = 1; // Regions (lowest - yield first)

      return {
        label,
        priority,
        box: {
          x: globalX,
          y: globalY,
          width: width,
          height: height
        }
      };
    });

    // Step 3: Sort by priority DESC (higher priority first)
    labelBoxes.sort((a, b) => b.priority - a.priority);

    // Step 4: Keep visible labels that don't collide
    const visibleBoxes = [];
    labelBoxes.forEach(item => {
      let collided = false;
      
      for (const visible of visibleBoxes) {
        if (rectsOverlap(item.box, visible.box, 4)) {
          collided = true;
          break;
        }
      }

      if (collided) {
        item.label.style.opacity = '0';
      } else {
        item.label.style.opacity = '';
        visibleBoxes.push(item);
      }
    });
  }

  highlightLocation(locationId) {
    this.clearHighlight();
    this._selectedLocationId = locationId;  // Bug B: remember selection
    const marker = this.svg.querySelector(`.location-marker[data-location-id="${locationId}"]`);
    if (marker) {
      marker.classList.add('selected');
      marker.classList.add('glow-pulsing');
    }
  }

  clearHighlight() {
    this._selectedLocationId = null;  // Bug B: clear selection
    this.svg.querySelectorAll('.location-marker.selected').forEach(el => {
      el.classList.remove('selected', 'glow-pulsing');
    });
  }

  getRenderedPosition(locationId) {
    return this.renderedPositions.get(locationId) || null;
  }

  getLocationCoordinate(location) {
    const overrides = window.atlasWorldCoordinateOverrides;
    // A null override explicitly removes a saved coordinate while editing.
    if (overrides && Object.hasOwn(overrides, location.id)) return overrides[location.id];

    const saved = window.atlasDataManager?.getWorldCoordinate?.(location.id);
    if (saved) return saved;
    return null;
  }

  setSelectedRegion(regionId = null) {
    this.selectedRegionId = regionId;
    this.svg.querySelectorAll('.location-marker-position').forEach(marker => {
      const locationId = marker.querySelector('.location-marker')?.dataset.locationId;
      const location = window.atlasDataManager?.getAllLocations?.().find(item => item.id === locationId);
      marker.classList.toggle('region-filtered-out', Boolean(regionId && location?.region !== regionId));
    });
    this.svg.querySelectorAll('.calibrated-region').forEach(region => {
      region.classList.toggle('selected', region.dataset.regionId === regionId);
    });
  }

  refreshLocationMarkers() {
    this._markerCache.clear();
    this.renderedPositions.clear();
    const group = this.svg.getElementById('layer-locations');
    if (group) group.innerHTML = '';
    if (this._lastWorldState) this.renderLocationMarkers(this._lastWorldState);
  }

  renderTerrainBackground() {
    const terrainSource = this.mapDefinition?.terrain?.src;
    if (!terrainSource) return;
    const terrain = createSVGElement('image', {
      id: 'layer-terrain',
      x: '0',
      y: '0',
      width: this.canvas.width,
      height: this.canvas.height,
      href: terrainSource,
      preserveAspectRatio: 'none'
    });
    this.svg.appendChild(terrain);
  }

  renderCalibratedRegionPolygons() {
    const regions = window.atlasDataManager?.data?.calibratedRegionPolygons || {};
    const group = createSVGElement('g', { id: 'layer-calibrated-regions' });
    Object.entries(regions).forEach(([id, region]) => {
      if (typeof region?.path !== 'string') return;
      const path = createSVGElement('path', {
        d: region.path,
        class: 'calibrated-region',
        'data-region-id': id
      });
      path.addEventListener('click', event => {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent('regionSelected', { detail: { regionId: id } }));
      });
      group.appendChild(path);
    });
    this.svg.appendChild(group);
  }

  renderGeographicFeatures() {
    const group = createSVGElement('g', { id: 'layer-labels' });
    const features = window.atlasDataManager?.data?.worldFeatures || [];
    features
      .filter(feature => !feature.needsCalibration && Number.isFinite(feature.position?.x) && Number.isFinite(feature.position?.y))
      .forEach(feature => {
        const label = createSVGElement('text', {
          x: feature.position.x,
          y: feature.position.y,
          class: `map-label map-feature-label map-feature-label--${feature.type || 'other'} ${feature.type === 'region' ? 'map-label-region' : 'map-label-sea'}`,
          'data-label-tier': feature.type === 'region' ? 'region' : 'sea',
          'data-min-zoom': Number.isFinite(feature.minZoom) ? feature.minZoom : '0',
          'data-x': feature.position.x,
          'data-y': feature.position.y,
          'text-anchor': 'middle',
          transform: feature.rotation ? `rotate(${feature.rotation} ${feature.position.x} ${feature.position.y})` : ''
        });
        label.textContent = feature.name;
        group.appendChild(label);
      });
    this.svg.appendChild(group);
    this.updateLabelVisibility(this.canvas.width);
  }
}
