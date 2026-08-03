// Router assertions: run with `node tests/router.mjs`.
//
// routes.js is pure by design, so the URL grammar and the state codec are
// exercised directly. The Back/Forward criterion needs a history, so this file
// carries a minimal one — enough of window.history and window.location for
// Router.js to run unmodified. Testing the router against a fake that reproduces
// only the parts it uses is the difference between asserting that the code
// exists and asserting that it runs; CLAUDE.md §6 asks for the second.
import {
  parsePath, buildPath, buildUrl, sameRoute,
  encodeState, decodeState, ENTITY_KINDS
} from '../js/router/routes.js';

const failures = [];
const checks = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ check: label, expected: JSON.stringify(expected), actual: JSON.stringify(actual), ok });
  if (!ok) failures.push({ check: label, expected: JSON.stringify(expected), actual: JSON.stringify(actual) });
}

// ── R1 · the route table of P6.1, parsed ───────────────────────────────────
check('R1 /', parsePath('/'), { name: 'map', params: {} });
check('R1 /harta', parsePath('/harta'), { name: 'map', params: {} });
check('R1 /harta/:id', parsePath('/harta/winterfell'), { name: 'map', params: { locationId: 'winterfell' } });
check('R1 /wiki', parsePath('/wiki'), { name: 'wikiIndex', params: {} });
check('R1 /wiki/:kind/:id', parsePath('/wiki/character/eddard_stark'), { name: 'wikiEntity', params: { kind: 'character', id: 'eddard_stark' } });
check('R1 /admin', parsePath('/admin'), { name: 'admin', params: {} });

// Tolerances that keep a hand-typed or copy-mangled address usable.
check('R1 trailing slash', parsePath('/wiki/house/stark/'), { name: 'wikiEntity', params: { kind: 'house', id: 'stark' } });
check('R1 query attached', parsePath('/harta/pyke?year=298'), { name: 'map', params: { locationId: 'pyke' } });
check('R1 percent-encoded id', parsePath('/wiki/location/fist_of_first_men'), { name: 'wikiEntity', params: { kind: 'location', id: 'fist_of_first_men' } });

// An unrecognised path resolves rather than failing, and says it did not match.
check('R1 unknown path', parsePath('/nonsense/deep'), { name: 'map', params: {}, unknown: true });
check('R1 unknown wiki kind', parsePath('/wiki/dinosaur/rex'), { name: 'wikiIndex', params: {}, unknown: true });

// ── R2 · parse ∘ build is the identity on every route it produces ───────────
const roundTrips = [
  { name: 'map', params: {} },
  { name: 'map', params: { locationId: 'kings_landing' } },
  { name: 'wikiIndex', params: {} },
  { name: 'admin', params: {} },
  ...ENTITY_KINDS.map(kind => ({ name: 'wikiEntity', params: { kind, id: 'storm_end' } }))
];
for (const route of roundTrips) {
  check(`R2 round-trip ${buildPath(route)}`, parsePath(buildPath(route)), route);
}
check('R2 sameRoute', [
  sameRoute({ name: 'map', params: { locationId: 'pyke' } }, { name: 'map', params: { locationId: 'pyke' } }),
  sameRoute({ name: 'map', params: { locationId: 'pyke' } }, { name: 'map', params: {} })
], [true, false]);

// ── R3 · the shareable state codec ─────────────────────────────────────────
const state = {
  lang: 'en',
  year: 298,
  view: { x: 120.44, y: 310.06, width: 350 },
  offLeaves: ['ruins', 'towns'],
  offHouses: ['house_frey'],
  selection: { kind: 'character', id: 'eddard_stark' }
};
const encoded = encodeState(state);
check('R3 encoded query', encoded.toString(), 'lang=en&year=298&v=120.4%2C310.1%2C350&off=ruins%2Ctowns&offh=house_frey&sel=character%3Aeddard_stark');
check('R3 decode round-trip', decodeState(encoded), {
  lang: 'en', year: 298,
  view: { x: 120.4, y: 310.1, width: 350 },
  offLeaves: ['ruins', 'towns'], offHouses: ['house_frey'],
  selection: { kind: 'character', id: 'eddard_stark' }
});

// Absent means "leave it alone", never "reset it" — a link that omits the year
// must not drag the timeline to zero.
check('R3 empty query', decodeState(''), {
  lang: null, year: null, view: null, offLeaves: [], offHouses: [], selection: null
});
// Malformed values are dropped, not propagated as NaN into a viewBox.
check('R3 malformed view', decodeState('v=1,2').view, null);
check('R3 malformed year', decodeState('year=soon').year, null);
check('R3 unknown selection kind', decodeState('sel=dinosaur:rex').selection, null);

// Keys not named are carried forward untouched. This is what lets a debounced
// viewBox sync run without erasing the selection navigate() just wrote.
check('R3 partial encode preserves', encodeState({ view: null }, 'lang=ro&sel=house%3Astark').toString(), 'lang=ro&sel=house%3Astark');
check('R3 empty list deletes', encodeState({ offLeaves: [] }, 'off=ruins').toString(), '');
check('R3 buildUrl', buildUrl({ name: 'wikiEntity', params: { kind: 'house', id: 'stark' } }, 'lang=en'), '/wiki/house/stark?lang=en');

// ── R4 · Back/Forward over five successive navigations ─────────────────────
//
// The acceptance criterion, run rather than asserted. The fake history is a
// stack with an index, which is what a browser's session history is.
function installFakeBrowser() {
  const entries = [{ url: '/', state: null }];
  let index = 0;
  const listeners = { popstate: [], hashchange: [] };

  const location = {
    protocol: 'http:',
    get pathname() { return entries[index].url.split('?')[0]; },
    get search() { const q = entries[index].url.split('?')[1]; return q ? `?${q}` : ''; },
    get hash() { return ''; },
    replace(url) { entries[index] = { url, state: null }; }
  };

  const history = {
    pushState(state, _title, url) {
      // A push truncates whatever was ahead, exactly as a browser does.
      entries.splice(index + 1);
      entries.push({ url, state });
      index = entries.length - 1;
    },
    replaceState(state, _title, url) { entries[index] = { url, state }; },
    back() { if (index > 0) { index -= 1; fire('popstate'); } },
    forward() { if (index < entries.length - 1) { index += 1; fire('popstate'); } }
  };

  function fire(type) {
    for (const listener of listeners[type]) listener({ type });
  }

  globalThis.window = {
    location, history,
    addEventListener: (type, fn) => listeners[type]?.push(fn),
    removeEventListener: () => {}
  };
  return { entries: () => entries, index: () => index, currentUrl: () => entries[index].url };
}

const browser = installFakeBrowser();
const { Router } = await import('../js/router/Router.js');

const seen = [];
const router = new Router({ onNavigate: route => seen.push(buildPath(route)) });
router.start();

// Five successive navigations, the shape a reader actually produces: a place,
// its wiki page, a linked house, the index, another place.
const journey = [
  { name: 'map', params: { locationId: 'winterfell' } },
  { name: 'wikiEntity', params: { kind: 'location', id: 'winterfell' } },
  { name: 'wikiEntity', params: { kind: 'house', id: 'stark' } },
  { name: 'wikiIndex', params: {} },
  { name: 'map', params: { locationId: 'pyke' } }
];
for (const route of journey) router.navigate(route);

const expectedForward = ['/harta', ...journey.map(buildPath)];
check('R4 five navigations recorded', seen, expectedForward);
check('R4 history depth', browser.entries().length, 6);

// Back five times must retrace them exactly.
const backwards = [];
for (let step = 0; step < 5; step += 1) {
  window.history.back();
  backwards.push(browser.currentUrl().split('?')[0]);
}
// The last one is '/' rather than '/harta': the table lists both as the map, so
// start() leaves a valid address alone. Only an unrecognised path is rewritten.
check('R4 back x5', backwards, ['/wiki', '/wiki/house/stark', '/wiki/location/winterfell', '/harta/winterfell', '/']);

// And Forward five times must replay them.
const forwards = [];
for (let step = 0; step < 5; step += 1) {
  window.history.forward();
  forwards.push(browser.currentUrl().split('?')[0]);
}
check('R4 forward x5', forwards, ['/harta/winterfell', '/wiki/location/winterfell', '/wiki/house/stark', '/wiki', '/harta/pyke']);

// Every step emitted a route, so the app was told to re-render each time. A
// router that changed the address without emitting would pass the two checks
// above and still leave the screen frozen.
check('R4 emissions', seen.length, 1 + 5 + 5 + 5);

// ── R5 · state sync never adds a history entry ─────────────────────────────
//
// The whole reason R4 can pass: MapInteraction.updateViewBox() fires once per
// animation frame, and a flyTo is 1500 ms of them.
const depthBefore = browser.entries().length;
for (let frame = 0; frame < 90; frame += 1) {
  router.syncStateNow({ view: { x: frame, y: frame, width: 350 } });
}
check('R5 sync adds no entries', browser.entries().length, depthBefore);
check('R5 sync wrote the last value', decodeState(browser.currentUrl().split('?')[1]).view, { x: 89, y: 89, width: 350 });
check('R5 sync kept the route', browser.currentUrl().split('?')[0], '/harta/pyke');

// A repeat navigation to where we already are must not grow the history: it is
// what makes Back a step and not a no-op the reader has to press twice.
router.navigate({ name: 'map', params: { locationId: 'pyke' } });
check('R5 duplicate navigation adds no entry', browser.entries().length, depthBefore);

console.table(checks.map(({ check: label, expected, actual }) => ({ check: label, expected, actual })));
if (failures.length) {
  console.error(`\nRouter assertions failed (${failures.length}):`);
  console.table(failures);
  process.exitCode = 1;
} else {
  console.log(`\nRouter test passed: ${checks.length} assertions.`);
}
