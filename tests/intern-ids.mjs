// Regression guard for the three locations whose `id_intern` is an array.
// Before normalization, `entity.id_intern?.startsWith('PERSON_')` threw a
// TypeError inside InfoPanel.open() and the panel never opened for them.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasInternPrefix, matchesInternId, normalizeInternIds, toInternIds } from '../js/utils/entities.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locations = JSON.parse(readFileSync(join(root, 'data/locations/locations.json'), 'utf8'));

const arrayIds = locations.filter(l => Array.isArray(l.id_intern)).map(l => l.id);
console.log('locations with array id_intern:', arrayIds.join(', ') || '(none)');

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

// 1. The old expression really does throw for these three — the bug is real.
for (const id of ['kings_landing', 'oldtown_city', 'storm_end']) {
  const raw = locations.find(l => l.id === id);
  check(`${id} present in locations.json`, Boolean(raw));
  if (!raw) continue;
  let threw = false;
  try { raw.id_intern?.startsWith('PERSON_'); } catch { threw = true; }
  check(`${id}: old id_intern?.startsWith() throws (bug reproduced)`, threw);
}

// 2. After normalization the whole dataset survives the predicates.
const normalized = locations.map(normalizeInternIds);
check('every normalized id_intern is an array', normalized.every(l => Array.isArray(l.id_intern)));

let predicateThrew = null;
try {
  for (const entity of normalized) {
    hasInternPrefix(entity, 'PERSON_');
    hasInternPrefix(entity, 'EVENT_');
    matchesInternId(entity, 'LOCATION_DEBARCADERUL_REGELUI');
  }
} catch (err) {
  predicateThrew = err;
}
check(`predicates do not throw for any of ${normalized.length} locations`, predicateThrew === null);
if (predicateThrew) console.error(predicateThrew);

// 3. Predicates are also safe on raw (un-normalized) records.
let rawThrew = null;
try {
  for (const entity of locations) hasInternPrefix(entity, 'PERSON_');
} catch (err) { rawThrew = err; }
check('hasInternPrefix is safe on raw records too', rawThrew === null);

// 4. Multi-valued intern ids stay matchable (getNarrativeDistances relies on this).
const kl = normalizeInternIds(locations.find(l => l.id === 'kings_landing'));
const klInterns = toInternIds(locations.find(l => l.id === 'kings_landing').id_intern);
check(`kings_landing keeps all ${klInterns.length} intern ids`, kl.id_intern.length === klInterns.length);
check('each kings_landing intern id matches individually', klInterns.every(i => matchesInternId(kl, i)));
console.log('  kings_landing id_intern =', JSON.stringify(kl.id_intern));

process.exit(failures === 0 ? 0 : 1);
