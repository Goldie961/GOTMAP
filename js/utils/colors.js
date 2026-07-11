export const HOUSE_COLORS = {
  targaryen: { primary: '#8B0000', secondary: '#1a1a1a' },
  stark: { primary: '#708090', secondary: '#F5F5F5' },
  lannister: { primary: '#DAA520', secondary: '#8B0000' },
  baratheon: { primary: '#FFD700', secondary: '#1a1a1a' },
  tyrell: { primary: '#228B22', secondary: '#FFD700' },
  tully: { primary: '#4169E1', secondary: '#DC143C' },
  arryn: { primary: '#4682B4', secondary: '#F5F5F5' },
  greyjoy: { primary: '#2F4F4F', secondary: '#FFD700' },
  martell: { primary: '#FF8C00', secondary: '#8B0000' },
  bolton: { primary: '#8B0000', secondary: '#FFC0CB' },
  frey: { primary: '#708090', secondary: '#4169E1' },
  nights_watch: { primary: '#1a1a1a', secondary: '#F5F5F5' },
  hightower: { primary: '#E8E8E8', secondary: '#808080' },
  velaryon: { primary: '#008B8B', secondary: '#C0C0C0' }
};

export function getHouseColor(houseId) {
  if (HOUSE_COLORS[houseId]) {
    return HOUSE_COLORS[houseId].primary;
  }
  // Default fallback (gold/brown ink)
  return '#C5A55A';
}

export function getHouseColorWithAlpha(houseId, alpha) {
  const hex = getHouseColor(houseId);
  // Convert hex to rgb
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getRegionColor(regionId, worldState) {
  // Region colors adapt to controlling house
  if (worldState && worldState.regions && worldState.regions[regionId]) {
    const houseId = worldState.regions[regionId].house;
    return getHouseColor(houseId);
  }
  return '#F4E4C1'; // Default parchment
}
