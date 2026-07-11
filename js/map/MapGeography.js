import { createSVGElement } from '../utils/helpers.js';
import { getRegionColor, getHouseColorWithAlpha } from '../utils/colors.js';

export class MapGeography {
  constructor(svgElement) {
    this.svg = svgElement;
    this.data = null;
  }

  async loadData() {
    const urls = {
      coastlines: 'data/map/coastlines.json',
      regions: 'data/map/regions.json',
      rivers: 'data/map/rivers.json',
      roads: 'data/map/roads.json',
      mountains: 'data/map/mountains.json',
      forests: 'data/map/forests.json'
    };

    const data = {};
    for (const [key, url] of Object.entries(urls)) {
      const response = await fetch(url);
      data[key] = await response.json();
    }
    this.data = data;
  }

  renderSea() {
    // Sea background container
    const seaGroup = createSVGElement('g', { id: 'layer-sea' });
    
    // Warm base sea color matching parchment textures
    const seaRect = createSVGElement('rect', {
      x: '0',
      y: '0',
      width: '1000',
      height: '1400',
      class: 'sea-bg'
    });
    seaGroup.appendChild(seaRect);

    // Apply the sea wave pattern overlay
    const seaPatternRect = createSVGElement('rect', {
      x: '0',
      y: '0',
      width: '1000',
      height: '1400',
      fill: 'url(#seaWaves)'
    });
    seaGroup.appendChild(seaPatternRect);

    this.svg.appendChild(seaGroup);
  }

  renderRegions() {
    const group = createSVGElement('g', { id: 'layer-regions' });
    this.data.regions.regions.forEach(region => {
      const path = createSVGElement('path', {
        d: region.path,
        class: 'region-polygon',
        'data-region-id': region.id
      });
      group.appendChild(path);
    });
    this.svg.appendChild(group);
  }

  renderCoastlines() {
    const group = createSVGElement('g', { id: 'layer-coastlines' });
    
    // Essos Coast
    const essosPath = createSVGElement('path', {
      d: this.data.coastlines.essos_coast,
      class: 'coastline-essos'
    });
    group.appendChild(essosPath);

    // Mainland
    const mainlandPath = createSVGElement('path', {
      d: this.data.coastlines.westeros.mainland,
      class: 'coastline-path'
    });
    group.appendChild(mainlandPath);

    // Islands
    Object.entries(this.data.coastlines.westeros.islands).forEach(([name, pathData]) => {
      if (Array.isArray(pathData)) {
        pathData.forEach(p => {
          const islandPath = createSVGElement('path', {
            d: p,
            class: 'island-path'
          });
          group.appendChild(islandPath);
        });
      } else {
        const islandPath = createSVGElement('path', {
          d: pathData,
          class: 'island-path'
        });
        group.appendChild(islandPath);
      }
    });

    this.svg.appendChild(group);
  }

  renderRivers() {
    const group = createSVGElement('g', { id: 'layer-rivers' });
    this.data.rivers.rivers.forEach(river => {
      if (river.branches) {
        river.branches.forEach(branch => {
          const path = createSVGElement('path', {
            d: branch.path,
            class: 'river-path',
            style: `stroke-width: ${branch.width * 0.85}px;`
          });
          group.appendChild(path);
        });
      } else {
        const path = createSVGElement('path', {
          d: river.path,
          class: 'river-path',
          style: `stroke-width: ${river.width * 0.85}px;`
        });
        group.appendChild(path);
      }
    });
    this.svg.appendChild(group);
  }

  renderRoads() {
    const group = createSVGElement('g', { id: 'layer-roads' });
    this.data.roads.roads.forEach(road => {
      const path = createSVGElement('path', {
        d: road.path,
        class: 'road-path',
        'data-road-id': road.id
      });
      group.appendChild(path);
    });
    this.svg.appendChild(group);
  }

  renderMountains() {
    const group = createSVGElement('g', { id: 'layer-mountains' });
    this.data.mountains.ranges.forEach(range => {
      range.peaks.forEach(peak => {
        let size = 7;
        if (peak.size === 'large') size = 11;
        if (peak.size === 'small') size = 5;
        
        const x = peak.x;
        const y = peak.y;

        const peakGroup = createSVGElement('g', { class: 'mountain-group' });

        // Shadow side wash (Eastern slope)
        const shadowPoly = createSVGElement('polygon', {
          points: `${x},${y - size} ${x + size},${y + size * 0.6} ${x},${y + size * 0.6}`,
          class: 'mountain-shadow-wash'
        });
        peakGroup.appendChild(shadowPoly);

        // Hand-drawn ridgeline & peaks
        const outline = createSVGElement('path', {
          d: `M ${x - size},${y + size * 0.6} 
              L ${x},${y - size} 
              L ${x + size},${y + size * 0.6} 
              M ${x},${y - size} 
              L ${x - size * 0.15},${y + size * 0.6}`,
          class: 'mountain-outline'
        });
        peakGroup.appendChild(outline);

        // Shadow hatching lines (3-4 fine lines drawn parallel to the shadow slope)
        const hatches = createSVGElement('path', {
          d: `M ${x + size * 0.25},${y - size * 0.3} L ${x + size * 0.45},${y - size * 0.15}
              M ${x + size * 0.4},${y + size * 0.05} L ${x + size * 0.65},${y + size * 0.2}
              M ${x + size * 0.55},${y + size * 0.35} L ${x + size * 0.8},${y + size * 0.5}`,
          class: 'mountain-hatch-lines'
        });
        peakGroup.appendChild(hatches);

        group.appendChild(peakGroup);
      });
    });
    this.svg.appendChild(group);
  }

  renderForests() {
    const group = createSVGElement('g', { id: 'layer-forests' });
    this.data.forests.forests.forEach(forest => {
      forest.trees.forEach(tree => {
        let size = 3.5;
        if (tree.size === 'large') size = 5;
        if (tree.size === 'small') size = 2.5;

        const x = tree.x;
        const y = tree.y;

        const treeGroup = createSVGElement('g', { class: 'tree-group' });

        // Coniferous / Pine trees in Northern regions (approx. y < 480)
        if (y < 480) {
          // Pine tree layers (triangles with a tiny trunk)
          const foliage = createSVGElement('path', {
            d: `M ${x},${y - size} 
                L ${x - size * 0.6},${y - size * 0.3} 
                L ${x - size * 0.4},${y - size * 0.3}
                L ${x - size * 0.75},${y + size * 0.3} 
                L ${x - size * 0.5},${y + size * 0.3}
                L ${x - size * 0.9},${y + size * 0.9} 
                L ${x + size * 0.9},${y + size * 0.9}
                L ${x + size * 0.5},${y + size * 0.3}
                L ${x + size * 0.75},${y + size * 0.3}
                L ${x + size * 0.4},${y - size * 0.3}
                L ${x + size * 0.6},${y - size * 0.3} Z`,
            class: 'tree-foliage-pine'
          });
          const trunk = createSVGElement('line', {
            x1: x, y1: y + size * 0.9,
            x2: x, y2: y + size * 1.2,
            class: 'tree-trunk'
          });
          treeGroup.appendChild(foliage);
          treeGroup.appendChild(trunk);
        } else {
          // Deciduous / Round-capped trees for Central/Southern regions
          const canopy = createSVGElement('path', {
            d: `M ${x},${y - size * 0.4} 
                C ${x - size * 1.1},${y - size * 0.8} ${x - size * 1.2},${y + size * 0.2} ${x},${y + size * 0.4}
                C ${x + size * 1.2},${y + size * 0.2} ${x + size * 1.1},${y - size * 0.8} ${x},${y - size * 0.4} Z`,
            class: 'tree-foliage-round'
          });
          // Shading line inside round canopy to give hand-inked texture
          const canopyShade = createSVGElement('path', {
            d: `M ${x - size * 0.4},${y - size * 0.1} Q ${x - size * 0.2},${y + size * 0.2} ${x + size * 0.4},${y + size * 0.1}`,
            class: 'tree-foliage-shade'
          });
          const trunk = createSVGElement('line', {
            x1: x, y1: y + size * 0.4,
            x2: x, y2: y + size * 1.1,
            class: 'tree-trunk'
          });
          treeGroup.appendChild(canopy);
          treeGroup.appendChild(canopyShade);
          treeGroup.appendChild(trunk);
        }

        group.appendChild(treeGroup);
      });
    });
    this.svg.appendChild(group);
  }

  updateRegionColors(worldState, animated = false) {
    const regionPaths = this.svg.querySelectorAll('.region-polygon');
    regionPaths.forEach(path => {
      // Apply smooth transition when scrubbing timeline
      if (animated) {
        path.style.transition = 'fill 400ms ease';
      } else {
        path.style.transition = '';
      }

      const regionId = path.getAttribute('data-region-id');
      if (worldState && worldState.regions && worldState.regions[regionId]) {
        const regionInfo = worldState.regions[regionId];
        // Dynamic region overlay color - extremely subtle tint
        const color = getHouseColorWithAlpha(regionInfo.house, 0.11);
        path.style.fill = color;
      } else {
        path.style.fill = 'transparent';
      }
    });
  }

  renderLabels() {
    const group = createSVGElement('g', { id: 'layer-labels' });
    
    // Render region labels (Cinzel, styled inside CSS map-label-region)
    this.data.regions.regions.forEach(region => {
      const label = createSVGElement('text', {
        x: region.labelPosition.x,
        y: region.labelPosition.y,
        class: 'map-label map-label-region',
        'data-label-tier': 'region'
      });
      label.textContent = region.name;
      group.appendChild(label);
    });

    // Render sea labels
    const narrowSeaLabel = createSVGElement('text', {
      x: '760',
      y: '650',
      class: 'map-label map-label-sea',
      'data-label-tier': 'sea'
    });
    narrowSeaLabel.textContent = "The Narrow Sea";
    group.appendChild(narrowSeaLabel);

    const sunsetSeaLabel = createSVGElement('text', {
      x: '110',
      y: '780',
      class: 'map-label map-label-sea',
      'data-label-tier': 'sea'
    });
    sunsetSeaLabel.textContent = "The Sunset Sea";
    group.appendChild(sunsetSeaLabel);

    this.svg.appendChild(group);
  }

  renderAll() {
    this.renderSea();
    this.renderCoastlines();
    this.renderRegions();
    this.renderRivers();
    this.renderRoads();
    this.renderForests();
    this.renderMountains();
    this.renderLabels();
  }
}
