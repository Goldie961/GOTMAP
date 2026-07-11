import { createSVGElement } from '../utils/helpers.js';

export class MapAnimations {
  constructor(svgElement) {
    this.svg = svgElement;
    this.isNight = false;
    this.activeSeason = 'summer';
  }

  init() {
    this.createFogEffect();
    this.createSmokeEffect();
    this.createOverlays();
  }

  createOverlays() {
    // We create structural overlays on top of the map
    // Night overlay (dark blue rect with multiply blend mode)
    const nightOverlay = createSVGElement('rect', {
      id: 'map-night-overlay',
      x: '0',
      y: '0',
      width: '1000',
      height: '1400',
      fill: '#0a0a2a',
      opacity: '0',
      style: 'mix-blend-mode: multiply; pointer-events: none; transition: opacity 2s ease;'
    });
    this.svg.appendChild(nightOverlay);

    // City glow lights group
    const lightsGroup = createSVGElement('g', {
      id: 'map-night-lights',
      opacity: '0',
      style: 'pointer-events: none; transition: opacity 2s ease;'
    });
    
    // Add glowing light markers for major settlements
    const lightCoords = [
      { x: 530, y: 770, name: "King's Landing" },
      { x: 270, y: 990, name: "Oldtown" },
      { x: 265, y: 655, name: "Lannisport" },
      { x: 500, y: 430, name: "White Harbor" },
      { x: 630, y: 620, name: "Gulltown" }
    ];

    lightCoords.forEach(coord => {
      const glow = createSVGElement('circle', {
        cx: coord.x,
        cy: coord.y,
        r: '6',
        fill: '#FFF58B',
        filter: 'url(#markerGlowHover)'
      });
      lightsGroup.appendChild(glow);
    });

    this.svg.appendChild(lightsGroup);

    // Winter overlay (white tint overlay)
    const winterOverlay = createSVGElement('rect', {
      id: 'map-winter-overlay',
      x: '0',
      y: '0',
      width: '1000',
      height: '1400',
      fill: '#B0C4DE',
      opacity: '0',
      style: 'mix-blend-mode: overlay; pointer-events: none; transition: opacity 1.5s ease;'
    });
    this.svg.appendChild(winterOverlay);
  }

  createFogEffect() {
    const fogGroup = createSVGElement('g', { id: 'layer-fog', style: 'opacity: 0.15;' });
    
    // Create large, soft clouds drifting across Beyond the Wall and the Neck
    const fogConfigs = [
      { cx: 350, cy: 120, rx: 120, ry: 40, duration: '60s', dx: 80 },
      { cx: 520, cy: 150, rx: 100, ry: 30, duration: '75s', dx: -60 },
      { cx: 400, cy: 480, rx: 150, ry: 40, duration: '90s', dx: 100 } // The Neck
    ];

    fogConfigs.forEach(cfg => {
      const ellipse = createSVGElement('ellipse', {
        cx: cfg.cx,
        cy: cfg.cy,
        rx: cfg.rx,
        ry: cfg.ry,
        fill: '#FFF8E7',
        filter: 'url(#markerGlowSelected)'
      });

      const anim = createSVGElement('animateTransform', {
        attributeName: 'transform',
        type: 'translate',
        from: `0 0`,
        to: `${cfg.dx} 0`,
        dur: cfg.duration,
        repeatCount: 'indefinite',
        additive: 'sum'
      });

      ellipse.appendChild(anim);
      fogGroup.appendChild(ellipse);
    });

    this.svg.appendChild(fogGroup);
  }

  createSmokeEffect() {
    const smokeGroup = createSVGElement('g', { id: 'layer-smoke' });
    
    // Add rising smoke over King's Landing, Oldtown, Harrenhal (ruins)
    const smokeSources = [
      { x: 530, y: 770 }, // KL
      { x: 270, y: 990 }, // Oldtown
      { x: 460, y: 670 }  // Harrenhal
    ];

    smokeSources.forEach((src, idx) => {
      const smokeContainer = createSVGElement('g', {
        transform: `translate(${src.x}, ${src.y})`
      });

      // Staggered smoke particles
      for (let i = 0; i < 3; i++) {
        const particle = createSVGElement('circle', {
          cx: '0',
          cy: '0',
          r: '2',
          class: 'smoke-particle',
          style: `animation-delay: ${i * 1.6 + idx * 0.5}s;`
        });
        smokeContainer.appendChild(particle);
      }
      smokeGroup.appendChild(smokeContainer);
    });

    this.svg.appendChild(smokeGroup);
  }

  toggleDayNight() {
    this.isNight = !this.isNight;
    const nightOverlay = this.svg.getElementById('map-night-overlay');
    const lightsGroup = this.svg.getElementById('map-night-lights');
    
    if (this.isNight) {
      if (nightOverlay) nightOverlay.style.opacity = '0.65';
      if (lightsGroup) lightsGroup.style.opacity = '0.8';
    } else {
      if (nightOverlay) nightOverlay.style.opacity = '0';
      if (lightsGroup) lightsGroup.style.opacity = '0';
    }
  }

  applySeason(season) {
    this.activeSeason = season;
    const winterOverlay = this.svg.getElementById('map-winter-overlay');
    const northPolygon = this.svg.querySelector('.region-polygon[data-region-id="the_north"]');

    if (season === 'winter') {
      if (winterOverlay) winterOverlay.style.opacity = '0.35';
      if (northPolygon) {
        northPolygon.style.fill = '#E8F4F8'; // Snowy ice-white tint
        northPolygon.style.fillOpacity = '0.45';
      }
    } else {
      if (winterOverlay) winterOverlay.style.opacity = '0';
      if (northPolygon) {
        northPolygon.style.fill = '';
        northPolygon.style.fillOpacity = '';
      }
    }
  }
}
