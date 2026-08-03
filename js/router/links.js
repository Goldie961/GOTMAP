import { entityKind } from './routes.js';

/**
 * Turning an entity into a link, for the components that render entity links.
 *
 * These read `window.atlasApp` rather than taking the router as a constructor
 * argument. That is the idiom the surrounding code already uses — Toolbar,
 * Timeline and WikiPage.proximitySection all reach for the app the same way —
 * and here it also avoids WikiPage importing app.js, which imports WikiPage.
 */

/** The `/wiki/:kind/:id` route for an entity, or null when it is not a routable record. */
export function entityRoute(entity) {
  if (!entity?.id) return null;
  const kind = entityKind(entity, window.atlasDataManager);
  return kind ? { name: 'wikiEntity', params: { kind, id: entity.id } } : null;
}

/** An href for a real `<a>`, so a wiki link can be middle-clicked or copied. */
export function entityHref(entity) {
  const route = entityRoute(entity);
  return route ? (window.atlasApp?.router?.href(route) ?? null) : null;
}

/**
 * Open an entity's wiki page as a navigation.
 *
 * Returns false when there is no router or no route, so a caller can keep its
 * previous direct-open behaviour rather than silently doing nothing.
 */
export function navigateToEntity(entity) {
  const route = entityRoute(entity);
  const router = window.atlasApp?.router;
  if (!route || !router) return false;
  router.navigate(route);
  return true;
}
