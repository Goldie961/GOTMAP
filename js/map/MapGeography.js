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
    const seaRect = createSVGElement('rect', {
      x: '0',
      y: '0',
      width: '1000',
      height: '1400',
      class: 'sea-bg'
    });
    this.svg.appendChild(seaRect);
  }

  renderRegions() {
    const group = createSVGElement('g', { id: 'layer-regions' });
    this.data.regions.regions.forEach(region => {
      const path = createSVGElement('path', {
        d: region.path,
        class: 'region-polygon',
        'data-region-id': region.id,
        fill: '#FFF8E7'
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
      class: 'island-path',
      fill: '#E8D48B',
      opacity: '0.4'
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
            'stroke-width': branch.width
          });
          group.appendChild(path);
        });
      } else {
        const path = createSVGElement('path', {
          d: river.path,
          class: 'river-path',
          'stroke-width': river.width
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
        let size = 6;
        if (peak.size === 'large') size = 9;
        if (peak.size === 'small') size = 4;
        
        // Draw triangular peak symbol
        const points = `${peak.x},${peak.y - size} ${peak.x - size},${peak.y + size / 2} ${peak.x + size},${peak.y + size / 2}`;
        const peakElem = createSVGElement('polygon', {
          points: points,
          class: 'mountain-peak'
        });
        group.appendChild(peakElem);
      });
    });
    this.svg.appendChild(group);
  }

  renderForests() {
    const group = createSVGElement('g', { id: 'layer-forests' });
    this.data.forests.forests.forEach(forest => {
      forest.trees.forEach(tree => {
        let size = 3;
        if (tree.size === 'large') size = 4.5;
        if (tree.size === 'small') size = 2;
        
        const treeElem = createSVGElement('circle', {
          cx: tree.x,
          cy: tree.y,
          r: size,
          class: 'forest-tree'
        });
        group.appendChild(treeElem);
      });
    });
    this.svg.appendChild(group);
  }

  updateRegionColors(worldState) {
    const regionPaths = this.svg.querySelectorAll('.region-polygon');
    regionPaths.forEach(path => {
      const regionId = path.getAttribute('data-region-id');
      if (worldState && worldState.regions && worldState.regions[regionId]) {
        const regionInfo = worldState.regions[regionId];
        const color = getHouseColorWithAlpha(regionInfo.house, 0.30);
        path.style.fill = color;
      } else {
        path.style.fill = '#FFF8E7';
      }
    });
  }

  renderLabels() {
    const group = createSVGElement('g', { id: 'layer-labels' });
    
    // Render region labels
    this.data.regions.regions.forEach(region => {
      const label = createSVGElement('text', {
        x: region.labelPosition.x,
        y: region.labelPosition.y,
        class: 'map-label map-label-region'
      });
      label.textContent = region.name;
      group.appendChild(label);
    });

    // Render sea labels
    const narrowSeaLabel = createSVGElement('text', {
      x: '730',
      y: '650',
      class: 'map-label map-label-sea'
    });
    narrowSeaLabel.textContent = "The Narrow Sea";
    group.appendChild(narrowSeaLabel);

    const sunsetSeaLabel = createSVGElement('text', {
      x: '120',
      y: '780',
      class: 'map-label map-label-sea'
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
