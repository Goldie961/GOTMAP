import { createSVGElement } from '../utils/helpers.js';
import { getHouseColor } from '../utils/colors.js';
import { isLowCompletenessEntity } from '../utils/config.js';
import { getLocationSubtype } from '../utils/locationSubtypes.js';
import { getSurfaceKind } from '../utils/surfaces.js';
import { resolveRulingHouseId } from '../utils/houses.js';
import { nameDescriptor } from '../i18n/index.js';

// Tier-1 locations: always visible, largest labels
export const CAPITAL_LOCATIONS = new Set([
  'kings_landing', 'winterfell', 'casterly_rock', 'highgarden', 'sunspear',
  'storm_end', 'the_eyrie', 'riverrun', 'pyke', 'dragonstone', 'oldtown',
  'harrenhal', 'the_wall', 'moat_cailin'
]);

/**
 * True when this location is a capital, or is the anchor standing in for one.
 * `CAPITAL_LOCATIONS` names ids as the books do, and some of those ids turn out
 * to be sub-locations once the containment taxonomy is applied — `oldtown` is
 * the Hightower, whose marker is drawn by `oldtown_city`. Membership therefore
 * has to be tested in both directions.
 */
export function isCapitalAnchor(location) {
  if (!location) return false;
  if (CAPITAL_LOCATIONS.has(location.id)) return true;
  // `globalThis.window` rather than `window`: tests/map-labels.mjs exercises the
  // label pass headlessly, where a bare `window` is a ReferenceError that no
  // amount of optional chaining catches.
  const dataManager = globalThis.window?.atlasDataManager;
  if (!dataManager?.getMappableAnchor) return false;
  for (const capitalId of CAPITAL_LOCATIONS) {
    if (dataManager.getMappableAnchor(capitalId)?.id === location.id) return true;
  }
  return false;
}

const DEFAULT_WORLD_CANVAS = { width: 1500, height: 1000 };

// Parenthetical qualifiers belong in the full record, not in a compact map
// label.  The original name remains available to search and the info panel.
export function deriveMapLabel(name) {
  const fullName = String(name || '');
  return fullName.split('(')[0].trim() || fullName;
}

const TIER_PRIORITY = { '1': 5, '2': 4, '3': 3, sea: 2, region: 1 };
const LABEL_PLACEMENTS = [
  { name: 'top', x: 0, y: -1, anchor: 'middle' },
  { name: 'bottom', x: 0, y: 1, anchor: 'middle' },
  { name: 'left', x: -1, y: 0, anchor: 'end' },
  { name: 'right', x: 1, y: 0, anchor: 'start' }
];

export function labelBoxesOverlap(first, second, padding = 4) {
  return !(second.x > first.x + first.width + padding ||
    second.x + second.width + padding < first.x ||
    second.y > first.y + first.height + padding < first.y);
}

export function compareLabelPriority(first, second) {
  const tier = (TIER_PRIORITY[second.tier] || 0) - (TIER_PRIORITY[first.tier] || 0);
  if (tier) return tier;
  const capital = Number(second.isCapital) - Number(first.isCapital);
  if (capital) return capital;
  const length = first.labelText.length - second.labelText.length;
  if (length) return length;
  return first.id.localeCompare(second.id);
}

/* ─────────────────────────────────────────────
   Type silhouettes — the base layer of every point marker
   ───────────────────────────────────────────── */

// The shape that says *what kind of place this is*. Always drawn, for every
// point marker, before anything else. It is chosen from `type` and never from
// the presence of a crest: a castle with no known house and a castle held by the
// Lannisters must read as the same kind of thing.
//
// All silhouettes share the ground line y = 5 and a footprint of roughly 18×16
// units, which is what the previous ~10-unit glyph lacked. `top` is the highest
// point of the shape and drives crest and label placement.
const TYPE_SILHOUETTES = {
  // Curtain wall between two battlemented towers, crenellated keep in the middle.
  castle: {
    top: -11,
    tinted: true,
    d: 'M -9,5 L -9,-4 L -8,-4 L -8,-7 L -6,-7 L -6,-4 L -4,-4 L -4,-9 L -2.5,-9 L -2.5,-11 '
      + 'L -1,-11 L -1,-9 L 1,-9 L 1,-11 L 2.5,-11 L 2.5,-9 L 4,-9 L 4,-4 L 6,-4 L 6,-7 '
      + 'L 8,-7 L 8,-4 L 9,-4 L 9,5 Z'
  },
  // Heavier and battered: sloped curtain, low square towers.
  fortress: {
    top: -8,
    tinted: true,
    d: 'M -10,5 L -8,-4 L -5.5,-4 L -5.5,-8 L -2,-8 L -2,-4 L 2,-4 L 2,-8 L 5.5,-8 L 5.5,-4 L 8,-4 L 10,5 Z'
  },
  // One tall keep over a low wall.
  stronghold: {
    top: -12,
    tinted: true,
    d: 'M -9,5 L -9,-2 L -4,-2 L -4,-10 L -2.5,-10 L -2.5,-12 L -1,-12 L -1,-10 L 1,-10 '
      + 'L 1,-12 L 2.5,-12 L 2.5,-10 L 4,-10 L 4,-2 L 9,-2 L 9,5 Z'
  },
  // A skyline: three roofs of different heights.
  city: {
    top: -9,
    tinted: true,
    d: 'M -10,5 L -10,-2 L -6.5,-6 L -3,-2 L -3,5 Z M -3,5 L -3,-4 L 0,-9 L 3,-4 L 3,5 Z '
      + 'M 3,5 L 3,-1 L 6.5,-5 L 10,-1 L 10,5 Z'
  },
  town: {
    top: -7,
    tinted: true,
    d: 'M -8,5 L -8,-1 L -4,-5 L 0,-1 L 0,5 Z M 0,5 L 0,-3 L 4,-7 L 8,-3 L 8,5 Z'
  },
  // Same family as `town`, one roof fewer.
  settlement: {
    top: -6,
    tinted: true,
    d: 'M -7,5 L -7,-1 L -3.5,-4.5 L 0,-1 L 0,5 Z M 0,5 L 0,-2 L 3.5,-6 L 7,-2 L 7,5 Z'
  },
  // The castle outline, broken: gaps in the wall, uneven stumps.
  ruins: {
    top: -8,
    tinted: true,
    d: 'M -9,5 L -9,-2 L -7,-2 L -7,-6 L -5,-6 L -5,0 L -2,0 L -2,-8 L 0,-8 L 0,-3 L 2,-3 '
      + 'L 2,-6 L 4,-6 L 4,1 L 7,1 L 7,-2 L 9,-2 L 9,5 Z'
  },
  // Natural, not built: a mound. Neutral stone colour, never house-tinted, so it
  // cannot be mistaken for a holding.
  landmark: { top: -6, tinted: false, d: 'M -9,5 Q -5,-3.5 0,-6 Q 5,-3.5 9,5 Z' },
  default: { top: -6, tinted: false, d: 'M -7,5 L -7,-2 L 0,-6 L 7,-2 L 7,5 Z' }
};

const NEUTRAL_STONE = '#8B7340';

/**
 * Draw the type silhouette. Always called, for every point marker.
 * @returns {number} the highest y of the shape, for stacking what goes above it
 */
function appendTypeSilhouette(marker, type, houseColor, fillElements) {
  const shape = TYPE_SILHOUETTES[type] || TYPE_SILHOUETTES.default;
  const path = createSVGElement('path', {
    d: shape.d,
    class: `location-type-base location-type-${type}`,
    fill: shape.tinted ? houseColor : NEUTRAL_STONE,
    stroke: '#3C2820',
    'stroke-width': '0.8',
    'stroke-linejoin': 'round'
  });
  marker.appendChild(path);
  // Only house-tinted shapes follow a change of ruler on the timeline.
  if (shape.tinted) fillElements.push(path);
  return shape.top;
}

/**
 * The ruling house's crest, as a small badge pinned to the upper right of
 * whatever was drawn below it. It annotates the silhouette; it never stands in
 * for it. Previously this was a 20-unit disc drawn *instead of* the shape, which
 * is why a Lannister castle and a Lannister city looked identical.
 *
 * Built for every marker, crest or not: a location changes hands as the timeline
 * moves, and the in-place update path only flips visibility.
 *
 * @param {number} baseTop highest y drawn so far, so the badge clears it
 */
function appendHouseCrestBadge(marker, crestUrl, houseColor, baseTop, houseId = null) {
  const cy = Math.min(baseTop - 1, -8);
  const radius = 5.2;
  // `display`, not `visibility`: SVG inherits visibility, and a descendant that
  // sets `visible` overrides a hidden ancestor. The heraldry fallback below does
  // exactly that when it fires, which would paint a shield on every crestless
  // marker. `display: none` cannot be overridden from inside.
  const group = createSVGElement('g', {
    class: 'house-crest-badge',
    display: crestUrl ? 'inline' : 'none',
    // Carried on the element so the house filter can hide badges without a
    // re-render. A CSS class beats this presentation attribute, which is why
    // hiding works even though `display` is set inline here.
    //
    // Only stamped when a crest is actually drawn. Tagging a badge that renders
    // `display: none` made it a filter target the panel had no checkbox for, so
    // the first house toggle hid it for good with nothing able to restore it.
    ...(houseId && crestUrl ? { 'data-house-id': houseId } : {})
  });
  const frame = createSVGElement('circle', {
    cx: '9', cy: String(cy), r: String(radius),
    fill: '#f5ead4', stroke: houseColor, 'stroke-width': '1.5', class: 'house-crest-frame'
  });
  const image = createSVGElement('image', {
    x: '5', y: String(cy - 4), width: '8', height: '8',
    href: crestUrl || '', preserveAspectRatio: 'xMidYMid meet', class: 'house-crest'
  });
  // A crest file that fails to load must not leave an empty disc. Only armed
  // when there is a URL to fail: an empty href errors unconditionally.
  const fallback = createSVGElement('path', {
    d: `M 5.4,${cy - 3.4} L 12.6,${cy - 3.4} L 12.6,${cy + 0.6} Q 9,${cy + 4.2} 5.4,${cy + 0.6} Z`,
    fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.5',
    class: 'house-crest-fallback', display: 'none'
  });
  if (crestUrl) {
    image.addEventListener('error', () => {
      image.setAttribute('display', 'none');
      fallback.setAttribute('display', 'inline');
    });
  }
  group.appendChild(frame);
  group.appendChild(image);
  group.appendChild(fallback);
  marker.appendChild(group);
  return { group, frame, image, top: cy - radius };
}

/* ─────────────────────────────────────────────
   Landmark silhouettes — optional layer above the type base
   ───────────────────────────────────────────── */

// Hand-drawn art for the emblematic locations. These used to live in the `else`
// branch of `if (rulingHouse?.crest)`, which meant they were never drawn for any
// location that had a crest — that is, never for the major castles they were
// drawn for. They are now an optional layer stacked on the type base, chosen by
// id and independent of heraldry.
//
// Each entry appends its own art and returns its highest y.
const LANDMARK_SILHOUETTES = {
  winterfell(marker, houseColor, fillElements) {
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
    return -13;
  },
  casterly_rock(marker, houseColor, fillElements) {
    marker.appendChild(createSVGElement('path', {
      d: 'M -13,5 L -11,-1 Q -9,-7 -4,-9 L 0,-11 L 4,-8 L 8,-3 L 11,5 Z',
      fill: '#7A6B58', stroke: '#3C2820', 'stroke-width': '0.85'
    }));
    const p1 = createSVGElement('path', {
      d: 'M -4,-9 L -4,-13 L -2,-13 L -2,-10 M 1,-9 L 1,-12 L 3,-12 L 3,-8',
      fill: houseColor, stroke: '#3C2820', 'stroke-width': '0.75'
    });
    marker.appendChild(p1); fillElements.push(p1);
    return -13;
  },
  castle_black(marker) {
    marker.appendChild(createSVGElement('path', {
      d: 'M -15,5 L -15,-15 L 15,-15 L 15,5 Z',
      fill: '#E2EEF4', stroke: '#7FA8B5', 'stroke-width': '0.6', 'fill-opacity': '0.8'
    }));
    marker.appendChild(createSVGElement('rect', {
      x: '-7', y: '-3', width: '13', height: '8',
      fill: '#5A4632', stroke: '#2A1A0C', 'stroke-width': '0.75'
    }));
    marker.appendChild(createSVGElement('path', {
      d: 'M -2,-15 L 8,-15 M 5,-15 L 5,3', stroke: '#2A1A0C', 'stroke-width': '0.7'
    }));
    return -15;
  },
  dragonstone(marker) {
    marker.appendChild(createSVGElement('path', {
      d: 'M -8,5 L -5,-11 Q -3.5,-7 -2,5 M -3,5 L 0,-17 Q 1.5,-10 3,5 M 2,5 L 5,-11 Q 6.5,-7 8,5 M -8,5 L -8,0 Q 0,-3 8,0 L 8,5 Z',
      fill: '#2F3538', stroke: '#1B1F21', 'stroke-width': '0.85'
    }));
    return -17;
  },
  oldtown_city(marker, houseColor, fillElements) {
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
    return -21;
  },
  kings_landing(marker, houseColor, fillElements) {
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
    return -11;
  },
  storm_end(marker, houseColor, fillElements) {
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
    return -10;
  },
  the_eyrie(marker) {
    marker.appendChild(createSVGElement('path', {
      d: 'M -10,5 L -6,0 L 0,-6 L 6,0 L 10,5 Z',
      fill: '#9AB2B7', stroke: '#3C2820', 'stroke-width': '0.85'
    }));
    marker.appendChild(createSVGElement('path', {
      d: 'M -4,0 L -3,-14 L -1,-14 L -2,0 Z M 1,-2 L 2,-19 L 4,-19 L 3,-2 Z',
      fill: '#E8EFF1', stroke: '#3C2820', 'stroke-width': '0.7'
    }));
    return -19;
  },
  riverrun(marker, houseColor, fillElements) {
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
    return -9;
  },
  pyke(marker, houseColor, fillElements) {
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
    return -9;
  },
  harrenhal(marker) {
    marker.appendChild(createSVGElement('path', {
      d: `M -11,5 L -10,-3 L -8,0 L -7,5 Z
          M -6,5 L -6,-9 L -4,-6 L -3,5 Z
          M -2,5 L -2,-12 Q 0,-9 1,5 Z
          M 2,5 L 2,-6 L 4,-4 L 5,5 Z
          M 6,5 L 7,-2 L 9,-1 L 9,5 Z`,
      fill: '#1E1E1E', stroke: '#0D0D0D', 'stroke-width': '0.8'
    }));
    return -12;
  }
};

export class MapRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.svg = null;
    this._markerCache = new Map();     // locationId -> { container, marker, fills[] }
    this._selectedLocationId = null;    // Bug B: persist selection across timeline updates
    this._rafPending = false;           // Bug A: rAF coalescing flag
    this._pendingWorldState = null;     // Bug A: latest world state waiting for rAF
    this.renderedPositions = new Map(); // Store visual coordinates after decluttering
    this.canvas = DEFAULT_WORLD_CANVAS;
    this.mapDefinition = null;
    this._lastWorldState = null;
    this.selectedRegionId = null;
    this.visibleLocationIds = null;
    this.visibleHouseIds = null;
    this._missingCoordinatesKey = null;
    this.disableLabelCulling = false;
    this._labelMeasurementCache = new Map();
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

    const { points: locations, surfaces, anchored } = this.getRenderableLocations();
    this.renderSurfaceLabels(surfaces);

    if (window.atlasDataManager) {
      // Counted over `anchored`: a location whose parent draws its marker is not
      // awaiting calibration, and listing it as such would send the editor
      // hunting for a pin it must never place.
      window.atlasDataManager.data.missingCoordinates = anchored
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
          const houseId = resolveRulingHouseId(loc, worldState.year);
          const houseColor = getHouseColor(houseId);
          cached.fills.forEach(el => el.setAttribute('fill', houseColor));
          const crest = window.atlasDataManager?.getHouse?.(houseId)?.crest;
          if (cached.crestFrame) cached.crestFrame.setAttribute('stroke', houseColor);
          if (cached.crestImage && crest) cached.crestImage.setAttribute('href', crest);
          // The badge exists on every marker, so a location that gains or loses
          // a ruling house across the timeline now shows or hides its heraldry
          // instead of keeping whatever it had at first render.
          if (cached.crestBadge) {
            cached.crestBadge.setAttribute('display', crest ? 'inline' : 'none');
            // This path keeps the DOM instead of rebuilding it, so the house tag
            // and the active filter have to be re-stamped by hand. Without it the
            // badge kept the ruler it had at first render — Winterfell still read
            // Stark in 300 AC — and the panel's counts disagreed with the map.
            if (crest) cached.crestBadge.setAttribute('data-house-id', houseId);
            else cached.crestBadge.removeAttribute('data-house-id');
            cached.crestBadge.classList.toggle('crest-filtered-out', Boolean(
              crest && this.visibleHouseIds && !this.visibleHouseIds.has(houseId)
            ));
          }
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
      // Shared with FilterPanel so the house filter counts exactly the badges
      // this loop stamps; see js/utils/houses.js for why they must not diverge.
      const houseId = resolveRulingHouseId(loc, worldState.year);

      const houseColor = getHouseColor(houseId);

      // Determine label tier. Capital status is asked of the anchor, not of the
      // marker: `oldtown` is the tier-1 name in the set, but the marker that
      // survives at Oldtown is `oldtown_city`, and it must not silently demote
      // to tier 2 because the set names its sub-location.
      let tier = '3';
      if (isCapitalAnchor(loc)) tier = '1';
      else if (loc.type === 'castle' || loc.type === 'fortress' || loc.type === 'city') tier = '2';

      const markerContainer = createSVGElement('g', {
        class: `location-marker-position${this.selectedRegionId && loc.region !== this.selectedRegionId ? ' region-filtered-out' : ''}${this.isLocationSubtypeVisible(loc) ? '' : ' subtype-filtered-out'}`,
        transform: `translate(${renderedPos.x}, ${renderedPos.y})`
      });

      const marker = createSVGElement('g', {
        class: `location-marker${loc.sursa_coordonate === 'triangulat' ? ' coordinate-triangulated' : ''}`,
        'data-location-id': loc.id,
        'data-location-subtype': getLocationSubtype(loc),
        'data-coordinate-source': loc.sursa_coordonate || 'unknown'
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
      let crestBadge = null;

      // ── Marker shapes ──
      // Three layers, drawn in this order and never mutually exclusive:
      //   1. type silhouette   — ALWAYS, chosen from `type`
      //   2. landmark art      — optional, for the emblematic locations
      //   3. house crest badge — optional, small, offset to the upper right
      //
      // The old structure made 1 and 2 alternatives of "does this house have a
      // crest", so the hand-drawn art for Winterfell, Harrenhal and the rest was
      // unreachable for exactly the major castles it was drawn for, and a crest
      // was all that a Lannister holding ever showed. What a pin *is* must not
      // depend on whether its owner happens to have heraldry.
      const rulingHouse = window.atlasDataManager?.getHouse?.(houseId);

      let topY = appendTypeSilhouette(marker, loc.type, houseColor, fillElements);

      const landmarkArt = LANDMARK_SILHOUETTES[loc.id];
      if (landmarkArt) {
        marker.classList.add('has-landmark-silhouette');
        topY = Math.min(topY, landmarkArt(marker, houseColor, fillElements));
      }

      const badge = appendHouseCrestBadge(marker, rulingHouse?.crest || null, houseColor, topY, rulingHouse?.id || null);
      // Markers are rebuilt from scratch on every world-state change, so an
      // active house filter has to be re-stamped here or scrubbing the timeline
      // would silently bring every hidden crest back.
      if (this.visibleHouseIds && rulingHouse?.id && !this.visibleHouseIds.has(rulingHouse.id)) {
        badge.group.classList.add('crest-filtered-out');
      }
      crestFrame = badge.frame;
      crestImage = badge.image;
      crestBadge = badge.group;
      topY = Math.min(topY, badge.top);

      // ── Label with tier ──
      // Derived from what was actually drawn rather than from a per-type
      // constant, so the label clears the silhouette and the badge in every
      // combination instead of only the two that used to be hardcoded.
      const tierClass = tier === '1' ? 'capital' : tier === '2' ? 'castle' : 'minor';
      const label = createSVGElement('text', {
        x: '0',
        y: (topY - 4).toFixed(1),
        class: `map-label map-label-${tierClass}`,
        'data-label-tier': tier,
        'data-x': renderedPos.x,
        'data-y': renderedPos.y,
        'data-label-base-x': '0',
        'data-label-base-y': (topY - 4).toFixed(1),
        'data-location-id': loc.id,
        'text-anchor': 'middle'
      });
      this.applyLocationLabel(label, loc);
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
        crestImage,
        crestBadge
      });
      } catch (err) {
        console.error('[map-editor] Eșec randare marker pentru', loc?.id, err);
      }
    });

    this.updateLabelVisibility(this.canvas.width);
  }

  /**
   * Areas rendered as names rather than as markers.
   *
   * Costs no digitizing: it reuses the coordinate that already exists in the
   * catalog as a `label_anchor`. A sea name written across the sea reads
   * correctly; a lozenge in the middle of the sea never does.
   *
   * These labels stay clickable, so the entity is still reachable from the map —
   * the point marker is what disappears, not the location.
   */
  renderSurfaceLabels(surfaces) {
    let group = this.svg.getElementById('layer-surface-labels');
    if (group) group.remove();
    group = createSVGElement('g', { id: 'layer-surface-labels' });

    surfaces.forEach(loc => {
      try {
        const point = this.getLocationCoordinate(loc);
        if (!point) return;
        const kind = getSurfaceKind(loc);
        // Water borrows the sea styling, everything else the region styling;
        // both already exist and both are drawn without a halo, which is what
        // makes them read as terrain rather than as a pin.
        const styleClass = kind === 'water' || kind === 'watercourse' ? 'map-label-sea' : 'map-label-region';
        const label = createSVGElement('text', {
          x: point.x,
          y: point.y,
          class: `map-label map-surface-label map-surface-label--${kind} ${styleClass}`,
          'data-label-tier': kind === 'water' || kind === 'watercourse' ? 'sea' : 'region',
          'data-x': point.x,
          'data-y': point.y,
          'data-location-id': loc.id,
          'data-surface-kind': kind,
          'text-anchor': 'middle'
        });
        this.applyLocationLabel(label, loc);
        label.addEventListener('click', event => {
          event.stopPropagation();
          document.dispatchEvent(new CustomEvent('locationSelected', { detail: { locationId: loc.id } }));
        });
        group.appendChild(label);
      } catch (err) {
        console.error('[atlas] Eșec randare etichetă de suprafață pentru', loc?.id, err);
      }
    });

    this.svg.appendChild(group);
    return group.childElementCount;
  }

  /**
   * Pin label text, in the interface language. `xml:lang` is set whenever the
   * string is not in that language, so the marker stays honest to a screen
   * reader even though an SVG label has no room for the badge chip.
   */
  applyLocationLabel(label, loc) {
    const descriptor = nameDescriptor(loc);
    // `map_label` is generated during data ingestion. Strip as a defensive
    // fallback for older callers and localized descriptors.
    label.textContent = deriveMapLabel(loc.map_label || descriptor.text);
    this._labelMeasurementCache?.delete(label);
    if (descriptor.badgeLang && descriptor.badgeLang !== 'unknown') {
      label.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', descriptor.badgeLang);
      label.classList.add('map-label-untranslated');
    } else {
      label.removeAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang');
      label.classList.remove('map-label-untranslated');
    }
  }

  /**
   * Re-project every pin label after a language switch. Deliberately not a
   * `renderMap()` — rebuilding the marker layer would drop the current zoom,
   * the highlight and the marker cache for a change that only affects text.
   */
  refreshLabels() {
    if (!this.svg) return 0;
    const labels = this.svg.querySelectorAll('.map-label[data-location-id]');
    labels.forEach(label => {
      const loc = window.atlasDataManager?.getLocation(label.getAttribute('data-location-id'));
      if (loc) this.applyLocationLabel(label, loc);
    });
    this.updateLabelVisibility(this.canvas.width);
    return labels.length;
  }

  /* ─────────────────────────────────────────────
     Label collision — zoom-based visibility
     ───────────────────────────────────────────── */
  updateLabelVisibility(viewBoxWidth) {
    const labels = this.svg.querySelectorAll('.map-label');
    if (this.disableLabelCulling) {
      labels.forEach(label => { label.style.opacity = ''; });
      return;
    }
    
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
        if (label.style.fontSize) {
          label.style.fontSize = '';
          this._labelMeasurementCache.delete(label);
        }
        label.removeAttribute('data-label-placement');
        candidates.push(label);
      } else {
        label.style.opacity = '0';
      }
    });

    // Step 2: Map to global bounding boxes and priorities
    const labelBoxes = candidates.map(label => {
      const tier = label.getAttribute('data-label-tier');
      
      const isLocationLabel = (tier === '1' || tier === '2' || tier === '3');
      
      return {
        label,
        tier,
        id: label.getAttribute('data-location-id') || '',
        isCapital: isCapitalAnchor(
          globalThis.window?.atlasDataManager?.getLocation?.(label.getAttribute('data-location-id'))
            || { id: label.getAttribute('data-location-id') }
        ),
        labelText: label.textContent || '',
        isLocationLabel
      };
    });

    // Step 3: Sort by priority DESC (higher priority first)
    labelBoxes.sort(compareLabelPriority);

    // Step 4: Try all four positions before culling. Capital labels additionally
    // use deterministic outer rings and real, smaller SVG text when necessary.
    const visibleBoxes = [];
    labelBoxes.forEach(item => {
      const scales = item.isCapital ? [1, 0.9, 0.8, 0.7, 0.6, 0.5] : [1];
      const distances = item.isCapital ? [0, 18, 34, 52] : [0];
      let placed = null;
      for (const scale of scales) {
        this.setLocationLabelScale(item.label, scale);
        for (const distance of distances) {
          for (const placement of LABEL_PLACEMENTS) {
            const box = this.positionLabel(item.label, item.isLocationLabel, placement, distance);
            if (!visibleBoxes.some(visible => labelBoxesOverlap(box, visible.box))) {
              placed = { box, placement };
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;
      }
      if (!placed && !item.isCapital) {
        item.label.style.opacity = '0';
      } else {
        // Tier-1 labels are primary navigation and are never silently removed.
        if (!placed) {
          this.setLocationLabelScale(item.label, 0.5);
          const placement = LABEL_PLACEMENTS[LABEL_PLACEMENTS.length - 1];
          placed = { box: this.positionLabel(item.label, true, placement, 70), placement };
        }
        item.label.style.opacity = '';
        item.label.setAttribute('data-label-placement', placed.placement.name);
        visibleBoxes.push({ ...item, box: placed.box });
      }
    });
    this._lastLabelLayout = visibleBoxes.map(item => ({
      id: item.id,
      tier: item.tier,
      box: { ...item.box },
      placement: item.label.getAttribute('data-label-placement') || 'static'
    }));
  }

  setLocationLabelScale(label, scale) {
    if (!label.hasAttribute('data-label-base-x')) return;
    const fontSize = scale === 1 ? '' : `${scale}em`;
    if (label.style.fontSize === fontSize) return;
    label.style.fontSize = fontSize;
    this._labelMeasurementCache.delete(label);
  }

  measureLabel(label) {
    const cached = this._labelMeasurementCache.get(label);
    if (cached) return cached;
    let bbox = null;
    try { bbox = label.getBBox(); } catch { /* SVG layout is not ready yet. */ }
    // Never substitute a character-count estimate: getBBox is the authoritative
    // measurement for the active SVG font, weight and letter spacing.
    const measurement = {
      x: bbox?.x || 0,
      y: bbox?.y || 0,
      width: bbox?.width || 0,
      height: bbox?.height || 0,
      yOffset: bbox ? bbox.y - Number(label.getAttribute('y') || 0) : 0
    };
    this._labelMeasurementCache.set(label, measurement);
    return measurement;
  }

  positionLabel(label, isLocationLabel, placement, distance = 0) {
    if (!isLocationLabel) {
      const bbox = this.measureLabel(label);
      return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
    }
    const measurement = this.measureLabel(label);
    const pinX = Number(label.getAttribute('data-x'));
    const pinY = Number(label.getAttribute('data-y'));
    const baseY = Number(label.getAttribute('data-label-base-y'));
    const x = placement.x * (14 + distance);
    const y = placement.y < 0 ? baseY - distance : placement.y > 0 ? 18 + distance : -2;
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('text-anchor', placement.anchor);
    const left = placement.anchor === 'middle' ? x - measurement.width / 2
      : placement.anchor === 'end' ? x - measurement.width : x;
    return { x: pinX + left, y: pinY + y + measurement.yOffset, width: measurement.width, height: measurement.height };
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

  setRenderedPosition(locationId, point) {
    if (!point) return;
    const position = { x: point.x, y: point.y };
    this.renderedPositions.set(locationId, position);
    const container = this._markerCache.get(locationId)?.container;
    if (container) container.setAttribute('transform', `translate(${position.x}, ${position.y})`);
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
      // getAllLocations() rebuilds a 391-element array; inside this loop that was
      // once per marker. The indexed lookup is O(1) and allocation-free.
      const location = window.atlasDataManager?.getLocation?.(locationId);
      marker.classList.toggle('region-filtered-out', Boolean(regionId && location?.region !== regionId));
    });
    this.svg.querySelectorAll('.calibrated-region').forEach(region => {
      region.classList.toggle('selected', region.dataset.regionId === regionId);
    });
  }

  /**
   * The locations this map will actually draw, split into point markers and
   * surface labels.
   *
   * Public and callable before the first render, because the filter panel must
   * count what the map draws rather than what the dataset contains. Those two
   * numbers differ by an order of magnitude: 694 mappable locations, 78 drawn.
   * Deriving the panel from `getAllLocations()` is what produced 316 checkboxes
   * of which 283 could not affect a single pin.
   */
  getRenderableLocations() {
    // A location is only rendered after it has been calibrated for the new terrain map.
    // Legacy coordinates remain untouched in locations.json until the migration is complete.
    const allLocations = window.atlasDataManager?.getAllLocations?.() || [];

    // A sub-location is drawn by its parent, never beside it. Suppressing the
    // marker here rather than at getAllLocations() is deliberate: the record
    // stays in search, in the wiki and in the filter facets, and keeps whatever
    // pin it has in the catalog so a future badge can be drawn at its true spot.
    const anchored = allLocations.filter(
      loc => !window.atlasDataManager?.isRenderedByAncestor?.(loc)
    );
    const calibrated = anchored.filter(loc => this.getLocationCoordinate(loc) && !isLowCompletenessEntity(loc));

    // Areas are split off before anything else. A bay, a wood, an island or a
    // continent has an extent, not a position; giving it a point marker is the
    // most visible scale error on the map (TAXONOMIE_v2 §4.1). Until their
    // polygons exist they render as a name at the same coordinate — §4.4.
    return {
      anchored,
      surfaces: calibrated.filter(loc => getSurfaceKind(loc)),
      points: calibrated.filter(loc => !getSurfaceKind(loc))
    };
  }

  // Filtering is by location id, not by subtype string. The panel now decides
  // membership through registry predicates, and ids survive a re-render whereas
  // a subtype label depended on a free-text field with 572 distinct values.
  isLocationSubtypeVisible(location) {
    return !this.visibleLocationIds || this.visibleLocationIds.has(location?.id);
  }

  setVisibleLocationIds(ids) {
    this.visibleLocationIds = ids instanceof Set ? new Set(ids) : null;
    const isHidden = id => Boolean(this.visibleLocationIds) && !this.visibleLocationIds.has(id);

    this.svg.querySelectorAll('.location-marker-position').forEach(container => {
      const id = container.querySelector('.location-marker')?.dataset.locationId;
      container.classList.toggle('subtype-filtered-out', isHidden(id));
    });
    // Surfaces are labels in their own group, not point markers, so the same
    // filter has to reach them separately or unchecking "Ape" would do nothing.
    this.svg.querySelectorAll('.map-surface-label').forEach(label => {
      label.classList.toggle('subtype-filtered-out', isHidden(label.dataset.locationId));
    });
  }

  setVisibleHouseIds(ids) {
    this.visibleHouseIds = ids instanceof Set ? new Set(ids) : null;
    this.svg.querySelectorAll('.house-crest-badge').forEach(badge => {
      const houseId = badge.dataset.houseId;
      badge.classList.toggle('crest-filtered-out', Boolean(
        houseId && this.visibleHouseIds && !this.visibleHouseIds.has(houseId)
      ));
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
