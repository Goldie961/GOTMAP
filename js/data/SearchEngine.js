export class SearchEngine {
  constructor() {
    this.index = [];
  }

  buildIndex(dataManager) {
    this.index = [];
    const locations = dataManager.getAllLocations();
    
    locations.forEach(loc => {
      // Map region human name for readability
      let regionName = loc.region.replace(/_/g, ' ');
      regionName = regionName.charAt(0).toUpperCase() + regionName.slice(1);

      this.index.push({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        regionId: loc.region,
        regionName: regionName,
        coordinates: loc.coordinates
      });
    });
  }

  search(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    const matches = this.index.map(item => {
      const name = item.name.toLowerCase();
      let score = 0;

      if (name === cleanQuery) {
        score = 100; // Exact match
      } else if (name.startsWith(cleanQuery)) {
        score = 50;  // Prefix match
      } else if (name.includes(cleanQuery)) {
        score = 25;  // Substring match
      }

      return { item, score };
    });

    // Filter non-matches and sort by score descending
    return matches
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(m => m.item)
      .slice(0, 10); // Limit to 10 results
  }
}
