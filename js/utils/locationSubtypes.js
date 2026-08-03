// Single source of truth for location subtype filtering.  Data imported before
// normalization is still rendered through the legacy type fallback.
export const DEFAULT_LOCATION_SUBTYPES = [
  'castel', 'oraș', 'sat', 'ruine', 'turn', 'han', 'port', 'câmp de luptă',
  'fortăreață', 'reședință', 'templu', 'repere naturale'
];

export const TYPE_TO_SUBTYPE = {
  castle: 'castel',
  city: 'oraș',
  town: 'sat',
  ruins: 'ruine',
  fortress: 'fortăreață',
  landmark: 'repere naturale'
};

export function getLocationSubtype(location) {
  return location?.subtip || TYPE_TO_SUBTYPE[location?.type] || 'nespecificat';
}
