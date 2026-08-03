/**
 * The URL grammar of the atlas — pure functions, no DOM, no history, no fetch.
 *
 * Everything that decides *what a URL means* lives here so tests/router.mjs can
 * exercise it under Node. Router.js holds only the browser glue; if a rule can
 * be stated without a `window`, it belongs in this file.
 *
 * Route table (docs/GHID_Implementare_Atlas_v2.md P6.1):
 *
 *   /                     → map
 *   /harta                → map
 *   /harta/:locationId    → map, that location selected and flown to
 *   /wiki                 → encyclopedic index
 *   /wiki/:kind/:id       → full entity page
 *   /admin                → editor
 *
 * The language is a query parameter, not a path prefix — decided in
 * docs/I18N_ARHITECTURA.md §6.3 and already implemented by
 * js/i18n/index.js:detectInitialLanguage(). A prefix would have meant two
 * sources of truth for the same choice.
 */

const MAP_SEGMENT = 'harta';
const WIKI_SEGMENT = 'wiki';
const ADMIN_SEGMENT = 'admin';

/** `/map` is accepted on input for convenience and never produced on output. */
const MAP_ALIASES = new Set([MAP_SEGMENT, 'map']);

/**
 * The `:kind` of /wiki/:kind/:id.
 *
 * It exists in the URL to disambiguate, not to decorate: 15 house ids are also
 * character ids (see WikiPage.resolveKind), so `/wiki/eddard_stark` alone would
 * be a question the data cannot answer. With the kind in the path the lookup is
 * a single collection and the answer is unique.
 */
export const ENTITY_KINDS = ['location', 'house', 'character', 'event', 'object', 'title', 'dragon'];

/** Query parameter names. Short because a map URL carries several of them. */
export const QUERY_KEYS = {
  lang: 'lang',
  year: 'year',
  view: 'v',
  offLeaves: 'off',
  offHouses: 'offh',
  selection: 'sel'
};

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape in a hand-edited URL is not a reason to fail routing.
    return segment;
  }
}

/**
 * Split a pathname into meaningful segments.
 * Tolerates a leading origin, a trailing slash, an empty string and a query or
 * fragment left attached by the caller.
 */
function segmentsOf(rawPath) {
  const path = String(rawPath ?? '/').split('?')[0].split('#')[0];
  return path.split('/').map(decodeSegment).filter(Boolean);
}

/**
 * Path → route. Never throws and never returns null: an unrecognised path is
 * the map, flagged `unknown` so the caller can decide whether to rewrite the
 * address bar. A router that can fail has no useful behaviour on a typo.
 */
export function parsePath(rawPath) {
  const [head, ...rest] = segmentsOf(rawPath);

  if (!head) return { name: 'map', params: {} };

  if (head === ADMIN_SEGMENT) return { name: 'admin', params: {} };

  if (head === WIKI_SEGMENT) {
    if (!rest.length) return { name: 'wikiIndex', params: {} };
    const [kind, id] = rest;
    if (ENTITY_KINDS.includes(kind) && id) return { name: 'wikiEntity', params: { kind, id } };
    return { name: 'wikiIndex', params: {}, unknown: true };
  }

  if (MAP_ALIASES.has(head)) {
    return rest[0] ? { name: 'map', params: { locationId: rest[0] } } : { name: 'map', params: {} };
  }

  return { name: 'map', params: {}, unknown: true };
}

/** Route → canonical path. The inverse of parsePath for every route it produces. */
export function buildPath(route) {
  const params = route?.params || {};
  switch (route?.name) {
    case 'admin':
      return `/${ADMIN_SEGMENT}`;
    case 'wikiIndex':
      return `/${WIKI_SEGMENT}`;
    case 'wikiEntity':
      return `/${WIKI_SEGMENT}/${encodeURIComponent(params.kind)}/${encodeURIComponent(params.id)}`;
    case 'map':
    default:
      return params.locationId
        ? `/${MAP_SEGMENT}/${encodeURIComponent(params.locationId)}`
        : `/${MAP_SEGMENT}`;
  }
}

/** Same route and same parameters — used to avoid pushing a duplicate entry. */
export function sameRoute(a, b) {
  return Boolean(a) && Boolean(b) && buildPath(a) === buildPath(b);
}

// ── Shareable state ────────────────────────────────────────────────────────
//
// Point 3 of the task: zoom, selected year and active filters live in the query
// string so an address reproduces the view. Two rules keep it usable:
//
//   · Only deviations from the default are written. The filter panel builds 320
//     checkboxes; enumerating the checked ones would produce kilobyte URLs that
//     no one can paste, and would also freeze today's defaults into every old
//     link. Absent means "as it comes out of the box".
//   · The viewBox is rounded to one decimal. The extra digits are animation
//     noise from flyTo, not information.

/** Round-trip precision for viewBox coordinates: enough to place a pin, not enough to record an animation frame. */
const VIEW_PRECISION = 1;

function roundView(value) {
  return Number(Number(value).toFixed(VIEW_PRECISION));
}

function parseNumberList(raw, expected) {
  if (typeof raw !== 'string' || !raw) return null;
  const parts = raw.split(',').map(part => Number.parseFloat(part));
  if (parts.length !== expected || parts.some(part => !Number.isFinite(part))) return null;
  return parts;
}

function parseIdList(raw) {
  if (typeof raw !== 'string' || !raw) return [];
  return [...new Set(raw.split(',').map(part => part.trim()).filter(Boolean))];
}

/**
 * Serialize app state onto a URLSearchParams.
 *
 * `base` is carried forward so a navigation never drops a parameter it does not
 * own — `lang` in particular is written by the i18n layer, not by the router.
 * A field set to null or an empty list is deleted rather than written empty.
 */
export function encodeState(state = {}, base = null) {
  const params = new URLSearchParams(base || '');

  const write = (key, value) => {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  };

  // The i18n layer owns the language; the router only keeps it in the address so
  // a copied link opens in the language it was copied from (§6.3 gives ?lang
  // priority over the stored choice, which is exactly what makes that work).
  if ('lang' in state) write(QUERY_KEYS.lang, state.lang);
  if ('year' in state) {
    write(QUERY_KEYS.year, Number.isFinite(state.year) ? Math.round(state.year) : null);
  }
  if ('view' in state) {
    const view = state.view;
    const usable = view && ['x', 'y', 'width'].every(key => Number.isFinite(view[key]));
    write(QUERY_KEYS.view, usable ? [view.x, view.y, view.width].map(roundView).join(',') : null);
  }
  if ('offLeaves' in state) {
    write(QUERY_KEYS.offLeaves, (state.offLeaves || []).join(',') || null);
  }
  if ('offHouses' in state) {
    write(QUERY_KEYS.offHouses, (state.offHouses || []).join(',') || null);
  }
  if ('selection' in state) {
    const selection = state.selection;
    write(QUERY_KEYS.selection, selection?.kind && selection?.id ? `${selection.kind}:${selection.id}` : null);
  }
  return params;
}

/**
 * URLSearchParams (or a query string) → state.
 *
 * Every field is null or empty when absent or malformed; the caller must treat
 * that as "leave it alone", never as "reset it". A shared link that omits the
 * year must not silently move the timeline to zero.
 */
export function decodeState(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');

  const year = Number.parseInt(params.get(QUERY_KEYS.year) ?? '', 10);
  const view = parseNumberList(params.get(QUERY_KEYS.view), 3);
  const rawSelection = params.get(QUERY_KEYS.selection) || '';
  const separator = rawSelection.indexOf(':');
  const kind = separator > 0 ? rawSelection.slice(0, separator) : null;
  const id = separator > 0 ? rawSelection.slice(separator + 1) : null;

  return {
    lang: params.get(QUERY_KEYS.lang) || null,
    year: Number.isFinite(year) ? year : null,
    view: view ? { x: view[0], y: view[1], width: view[2] } : null,
    offLeaves: parseIdList(params.get(QUERY_KEYS.offLeaves)),
    offHouses: parseIdList(params.get(QUERY_KEYS.offHouses)),
    selection: kind && id && ENTITY_KINDS.includes(kind) ? { kind, id } : null
  };
}

/** Full URL from a route plus a query string, as it should appear in the address bar. */
export function buildUrl(route, params) {
  const query = params instanceof URLSearchParams ? params.toString() : String(params || '');
  return query ? `${buildPath(route)}?${query}` : buildPath(route);
}

/**
 * Which collection an entity belongs to, as a `/wiki/:kind/` token.
 *
 * Identity in the loaded collections decides, not the id: ids collide across
 * collections, so `getHouse(entity.id)` returning something proves nothing
 * about what `entity` is. An explicit `type` is consulted first, because
 * `characters.json` records carry one assigned at load and locations carry a
 * real one — but 1662 of the 1682 events carry none, which is why membership
 * has to be the fallback rather than the other way round.
 */
export function entityKind(entity, manager) {
  if (!entity || typeof entity !== 'object') return null;

  if (entity.type === 'character') return 'character';
  if (entity.type === 'event') return 'event';
  if (entity.type === 'house' || entity.type === 'faction' || entity.type === 'institution') return 'house';
  if (entity.type === 'dragon') return 'dragon';

  const data = manager?.data || {};
  const byIdentity = [
    ['dragon', data.dragons],
    ['object', data.objects],
    ['title', data.titles],
    ['house', data.houses],
    ['character', data.characters],
    ['event', data.events]
  ];
  for (const [kind, collection] of byIdentity) {
    if (Array.isArray(collection) && collection.includes(entity)) return kind;
  }
  if (manager?.getLocation?.(entity.id)) return 'location';

  return null;
}

/**
 * The inverse: a `/wiki/:kind/:id` pair back to a loaded entity, or null.
 *
 * Locations resolve through the full list including sub-locations — the
 * Hightower has no pin but has a page, and a link to it must not 404.
 */
export function resolveEntity(kind, id, manager) {
  if (!kind || !id || !manager) return null;
  switch (kind) {
    case 'location':
      return manager.getLocation(id) || null;
    case 'house':
      return manager.getHouse(id) || null;
    case 'character':
      return manager.getCharacter(id) || null;
    case 'event':
      return manager.getEvent(id) || null;
    case 'object':
      return manager.getObject(id) || null;
    case 'title':
      return manager.getTitle(id) || null;
    case 'dragon':
      return manager.getDragon(id) || null;
    default:
      return null;
  }
}
