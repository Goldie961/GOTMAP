import { entityKind } from '../router/routes.js';
import { stripEntityPrefix } from '../utils/helpers.js';

/**
 * One answer to one question: *can the map show this entity right now, and
 * where?*
 *
 * It exists as its own module because three callers need the same answer and
 * must never disagree — the search dropdown, which decides which section a
 * result goes in; the click handler, which decides between a zoom and a
 * navigation; and the router, restoring a selection from an address. Two copies
 * of this rule would produce a result labelled "on the map" that opens a wiki
 * page, which is precisely the surprise P6.2 exists to remove.
 *
 * Nothing here is cached or precomputed. The catalog is read on every call, so
 * calibrating a castle in admin/map-editor.html moves it from the encyclopedia
 * section to the map section on the next page load, with no code change and no
 * list to maintain.
 */

/**
 * Kinds that can occupy a point.
 *
 * A house is here because it holds a seat, and a seat is a place — searching
 * "Stark" on the map and being taken to Winterfell is the behaviour the map is
 * for. A character is not, even for the 33 records that carry a timeline: a
 * reader typing a name into the map's search expects the map to stay put
 * (P6.2 requirement 2, which lists events, characters and objects together).
 */
const MAP_KINDS = new Set(['location', 'house']);

export function isMapKind(kind) {
  return MAP_KINDS.has(kind);
}

/**
 * The location the map would fly to for this entity, or null when there is
 * nowhere to fly.
 *
 * Null has two quite different causes and the caller does not need to tell them
 * apart: the entity is not a place at all (an event), or it is a place the
 * project has not calibrated yet. The second is the common one — 614 of the 697
 * locations that pass `isMappableLocation` carry no coordinate anywhere,
 * including Castle Black, White Harbor and The Twins. `mappable: true` is a
 * statement about the taxonomy, not about the catalog.
 *
 * @param {object} entity
 * @param {object} manager DataManager, or anything exposing getLocation,
 *        getMappableAnchor and getWorldCoordinate.
 */
export function resolveMapTarget(entity, manager) {
  if (!entity || !manager) return null;
  if (!isMapKind(entityKind(entity, manager))) return null;

  // A house's seat lives at the root after DataManager's compatibility pass,
  // but 152 of them carry it under `metadata` on disk, so both are read.
  const seatId = entity.seat || entity.city || entity.metadata?.seat || null;
  const locationId = seatId ? stripEntityPrefix(String(seatId)) : entity.id;
  const location = manager.getLocation?.(locationId);
  if (!location) return null;

  // A sub-location has no marker of its own; the pin belongs to the ancestor
  // that carries one, and that is what the camera flies to.
  const anchor = manager.getMappableAnchor?.(location);
  if (!anchor) return null;

  // The catalog is the only authority for where a marker sits (CLAUDE.md §4.1).
  // The deprecated root-level `coordinates` is deliberately not consulted: of
  // the 614 uncalibrated mappable locations, exactly zero have one, so reading
  // it would add a branch that never runs and a second source of truth.
  return manager.getWorldCoordinate?.(anchor.id) ? location : null;
}

/** Whether the map has somewhere to put this entity. */
export function hasMapPosition(entity, manager) {
  return resolveMapTarget(entity, manager) !== null;
}
