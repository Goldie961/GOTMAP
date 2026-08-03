// Regression checks for map-label data and deterministic priority decisions.
// Run with: node tests/map-labels.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPITAL_LOCATIONS, MapRenderer, compareLabelPriority, deriveMapLabel, labelBoxesOverlap
} from '../js/map/MapRenderer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locations = JSON.parse(readFileSync(join(root, 'data/locations/locations.json'), 'utf8'));
const fail = message => { throw new Error(message); };

const parenthesized = locations.filter(location => String(location.name || '').includes('('));
if (parenthesized.length !== 76) fail(`expected 76 parenthesized location names, got ${parenthesized.length}`);
for (const location of parenthesized) {
  const mapLabel = deriveMapLabel(location.name);
  if (!mapLabel || mapLabel.includes('(')) fail(`invalid derived map label for ${location.id}`);
}
if (deriveMapLabel("King's Landing (Aegonfort)") !== "King's Landing") fail('King\'s Landing map label regression');
if (deriveMapLabel('Hightower (Oldtown)') !== 'Hightower') fail('Oldtown map label regression');

const ids = new Set(locations.map(location => location.id));
for (const capital of CAPITAL_LOCATIONS) {
  if (!ids.has(capital)) fail(`capital missing from locations: ${capital}`);
}

const labels = [
  { tier: '1', isCapital: true, labelText: 'Winterfell', id: 'winterfell' },
  { tier: '1', isCapital: true, labelText: 'Oldtown', id: 'oldtown' },
  { tier: '1', isCapital: true, labelText: 'Pyke', id: 'pyke' },
  { tier: '2', isCapital: false, labelText: 'A', id: 'a' }
];
const expected = [...labels].sort(compareLabelPriority).map(label => label.id).join(',');
for (const order of [[...labels].reverse(), [labels[2], labels[0], labels[3], labels[1]]]) {
  if (order.sort(compareLabelPriority).map(label => label.id).join(',') !== expected) {
    fail('priority ordering changed with input order');
  }
}

// The collision predicate is the same one used by the renderer; a touching
// padded pair must be treated as a collision, while separated boxes must not.
if (!labelBoxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 13, y: 0, width: 10, height: 10 })) {
  fail('collision predicate missed padded overlap');
}
if (labelBoxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 15, y: 0, width: 10, height: 10 })) {
  fail('collision predicate reported a false overlap');
}

// Exercise the renderer's actual placement pass twice with SVG-like labels.
// `getBBox()` is deliberately the sole geometry source exposed to the renderer.
const catalog = JSON.parse(readFileSync(join(root, 'data/map/catalog.json'), 'utf8'));
const coordinates = catalog.maps.world.coordinates;
class TestLabel {
  constructor(id, text, point) {
    this.attrs = new Map([
      ['data-label-tier', '1'], ['data-location-id', id], ['data-x', String(point.x)], ['data-y', String(point.y)],
      ['data-label-base-x', '0'], ['data-label-base-y', '-25'], ['x', '0'], ['y', '-25'], ['text-anchor', 'middle']
    ]);
    this.textContent = text;
    this.style = { opacity: '', fontSize: '' };
  }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  getBBox() {
    const scale = Number.parseFloat(this.style.fontSize) || 1;
    const width = this.textContent.length * 6 * scale;
    const height = 10 * scale;
    const x = Number(this.getAttribute('x'));
    const y = Number(this.getAttribute('y'));
    const anchor = this.getAttribute('text-anchor');
    return { x: anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x, y: y - height, width, height };
  }
}
const capitalLabels = [...CAPITAL_LOCATIONS].map(id => {
  const location = locations.find(entry => entry.id === id);
  return new TestLabel(id, deriveMapLabel(location.name), coordinates[id]);
});
const renderer = Object.create(MapRenderer.prototype);
renderer.svg = { querySelectorAll: () => capitalLabels };
renderer.canvas = { width: 1500 };
renderer.disableLabelCulling = false;
renderer._labelMeasurementCache = new Map();
renderer.updateLabelVisibility(1500);
const firstLayout = JSON.stringify(renderer._lastLabelLayout);
renderer.updateLabelVisibility(1500);
const secondLayout = JSON.stringify(renderer._lastLabelLayout);
if (firstLayout !== secondLayout) fail('two label layout passes produced different output');
if (capitalLabels.some(label => label.style.opacity === '0')) fail('a tier-1 label was hidden');
const collisions = renderer._lastLabelLayout.flatMap((entry, index, all) =>
  all.slice(index + 1).filter(other => labelBoxesOverlap(entry.box, other.box)).map(other => `${entry.id}/${other.id}`)
);
if (collisions.length) fail(`overlapping capital labels: ${collisions.join(', ')}`);

console.log(`Map-label checks passed: ${CAPITAL_LOCATIONS.size} capitals; ${parenthesized.length} derived labels.`);
