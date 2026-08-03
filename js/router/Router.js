import { parsePath, buildPath, buildUrl, decodeState, encodeState, sameRoute } from './routes.js';

/**
 * History-API router with a hash fallback.
 *
 * Everything about *what a URL means* is in routes.js; this file owns only the
 * three things that need a browser: reading the address bar, writing it, and
 * hearing when the user changes it.
 *
 * Two write modes, and the distinction is the whole reason Back works:
 *
 *   navigate()  pushes an entry.  Called for navigations the reader performed —
 *               picking a place, opening a page, closing one.
 *   syncState() replaces the current entry, debounced.  Called for state that
 *               drifts continuously — pan, zoom, the timeline slider, filter
 *               checkboxes.  MapInteraction.updateViewBox() fires once per
 *               animation frame; pushing there would bury five real navigations
 *               under four hundred frames of a single flyTo, and the Back
 *               button would appear broken while behaving exactly as told.
 */

/** Long enough to outlast a flyTo (1500 ms is the longest), short enough that a copied address is current. */
const STATE_SYNC_DELAY = 400;

export class Router {
  /**
   * @param {(route, context) => void} onNavigate called with the resolved route
   *        whenever the address changes, including once at start().
   */
  constructor({ onNavigate } = {}) {
    this.onNavigate = onNavigate || (() => {});

    // file: has a pushState that throws on any path change, so it gets the hash
    // encoding even though the History API is nominally present.
    this.canUseHistory = typeof window !== 'undefined'
      && typeof window.history?.pushState === 'function';
    this.useHash = !this.canUseHistory
      || (typeof window !== 'undefined' && window.location.protocol === 'file:');

    this.current = null;
    /** Entries this router pushed. Tells `close` whether Back has anywhere to go. */
    this.depth = 0;
    /** Set while a route is being applied, so applying does not re-enter navigate(). */
    this.applying = false;

    this.syncTimer = null;
    this.started = false;
  }

  // ── reading the address bar ──────────────────────────────────────────────

  /** The routable part of the current URL: the path, or what follows `#` in hash mode. */
  readLocation() {
    const { pathname, search, hash } = window.location;
    if (!this.useHash) return { path: pathname, query: search.replace(/^\?/, '') };

    const raw = hash.replace(/^#/, '');
    const [path, query = ''] = raw.split('?');
    return { path: path || '/', query };
  }

  readRoute() {
    return parsePath(this.readLocation().path);
  }

  readQuery() {
    return new URLSearchParams(this.readLocation().query);
  }

  readState() {
    return decodeState(this.readQuery());
  }

  // ── writing it ───────────────────────────────────────────────────────────

  /** An href suitable for a real `<a>`, so wiki links are middle-clickable. */
  href(route, query = this.readQuery()) {
    const url = buildUrl(route, query);
    return this.useHash ? `#${url}` : url;
  }

  write(route, query, { replace }) {
    const url = this.href(route, query);
    if (this.canUseHistory) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ route: buildPath(route) }, '', url);
      return;
    }
    // No History API at all: the hash is the only writable part, and replacing
    // means replacing the whole document entry.
    if (replace) window.location.replace(url);
    else window.location.hash = url.replace(/^#/, '');
  }

  /**
   * Go to a route, pushing a history entry.
   *
   * The current query is carried forward by default: moving from the map to a
   * wiki page must not lose the year or the language, or Back would return to a
   * different map than the one the reader left.
   */
  navigate(route, { replace = false, query = null, state = null } = {}) {
    const base = query instanceof URLSearchParams ? query : this.readQuery();
    const params = state ? encodeState(state, base) : base;

    // A repeat click on the same place should not add an entry to walk back
    // through, but may still carry new state.
    const isSame = sameRoute(route, this.current);
    this.write(route, params, { replace: replace || isSame });
    if (!replace && !isSame) this.depth += 1;

    this.current = route;
    this.emit(route, { source: 'navigate' });
  }

  /**
   * Fold state into the *current* entry. Never pushes, never emits: the app is
   * already showing this state — the address bar is what is behind.
   */
  syncState(state) {
    if (this.applying) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      const route = this.current || this.readRoute();
      this.write(route, encodeState(state, this.readQuery()), { replace: true });
    }, STATE_SYNC_DELAY);
  }

  /** Same, without waiting — for state changes that are already discrete. */
  syncStateNow(state) {
    if (this.applying) return;
    clearTimeout(this.syncTimer);
    const route = this.current || this.readRoute();
    this.write(route, encodeState(state, this.readQuery()), { replace: true });
  }

  /**
   * Back if this session has somewhere to go, otherwise a real navigation.
   *
   * Closing the wiki opened from the map should return to that map, with its
   * zoom. Closing a wiki page opened from a shared link has no such history and
   * must not throw the reader off the site.
   */
  back(fallbackRoute) {
    if (this.depth > 0) {
      this.depth -= 1;
      window.history.back();
      return;
    }
    this.navigate(fallbackRoute, { replace: true });
  }

  // ── listening ────────────────────────────────────────────────────────────

  emit(route, context) {
    this.applying = true;
    try {
      this.onNavigate(route, { ...context, state: this.readState(), query: this.readQuery() });
    } finally {
      this.applying = false;
    }
  }

  onExternalChange = () => {
    // A pending replaceState from the entry we are leaving would otherwise land
    // on the entry we are arriving at.
    clearTimeout(this.syncTimer);
    const route = this.readRoute();
    this.current = route;
    this.emit(route, { source: 'popstate' });
  };

  /**
   * Resolve the address the page was opened with, and start listening.
   *
   * An unrecognised path is rewritten in place rather than pushed: the reader
   * mistyped once and should not have to press Back twice to leave.
   */
  start() {
    if (this.started) return this.readRoute();
    this.started = true;

    window.addEventListener('popstate', this.onExternalChange);
    if (this.useHash) window.addEventListener('hashchange', this.onExternalChange);

    const route = this.readRoute();
    this.current = route;
    if (route.unknown) this.write(route, this.readQuery(), { replace: true });
    this.emit(route, { source: 'start', initial: true });
    return route;
  }
}
