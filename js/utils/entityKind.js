import { hasInternPrefix } from './entities.js';

// Entity-kind checks live outside UI components so data-driven callers can use
// the exact same logic without requiring a DOM.
const hasIdIn = (entity, entities) => Boolean(entity?.id)
  && Array.isArray(entities)
  && entities.some(candidate => candidate.id === entity.id);

export function isCharacterEntity(entity, characters = []) {
  return entity?.type === 'character'
    || hasInternPrefix(entity, 'PERSON_')
    || hasIdIn(entity, characters);
}

export function isEventEntity(entity, events = []) {
  return entity?.type === 'event'
    || hasInternPrefix(entity, 'EVENT_')
    || hasIdIn(entity, events);
}
