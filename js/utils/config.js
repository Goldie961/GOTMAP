/**
 * Global application configuration.
 * Contains easily adjustable parameters for entity filtering, completeness thresholds, and map behavior.
 */
export const COMPLETENESS_CONFIG = {
  // Option A: Hide entities with low completeness score & few statements from search and map
  HIDE_LOW_COMPLETENESS_ENTITIES: true,
  // Threshold score (entities with scor_total < COMPLETENESS_THRESHOLD are evaluated)
  COMPLETENESS_THRESHOLD: 0.15,
  // Minimum statements threshold (entities with nr_afirmatii_brute < MIN_STATEMENTS_THRESHOLD are evaluated)
  MIN_STATEMENTS_THRESHOLD: 2
};

/**
 * Evaluates whether an entity is considered "low completeness" based on COMPLETENESS_CONFIG.
 * @param {Object} entity 
 * @param {Object} [config] 
 * @returns {boolean}
 */
export function isLowCompletenessEntity(entity, config = COMPLETENESS_CONFIG) {
  if (!entity || typeof entity !== 'object') return false;
  if (!config || !config.HIDE_LOW_COMPLETENESS_ENTITIES) return false;

  const comp = entity._completitudine || entity.metadata?._completitudine;
  if (!comp || typeof comp !== 'object') return false;

  const score = comp.scor_total ?? 1.0;
  const numStatements = comp.nr_afirmatii_brute ?? 99;

  const threshold = config.COMPLETENESS_THRESHOLD ?? 0.15;
  const minStatements = config.MIN_STATEMENTS_THRESHOLD ?? 2;

  return score < threshold && numStatements < minStatements;
}

// Expose configuration globally for easy runtime tweaking from browser console
if (typeof window !== 'undefined') {
  window.COMPLETENESS_CONFIG = COMPLETENESS_CONFIG;
  window.isLowCompletenessEntity = isLowCompletenessEntity;
}
