import { createSVGElement, createElement } from '../utils/helpers.js';
import { distanceBetween, travelTime } from '../utils/coordinates.js';

export class DistanceTool {
  constructor(svgElement) {
    this.svg = svgElement;
    this.isActive = false;
    this.firstLocation = null;
    this.secondLocation = null;
    this.line = null;
    this.popup = null;
    
    this.init();
  }

  init() {
    // Create distance output popup container in body
    this.popup = createElement('div', 'distance-popup hidden');
    
    // Ornate structure
    this.popup.innerHTML = `
      <button class="distance-popup-close">×</button>
      <h4 class="heading-decorative" style="font-size:1.1rem; margin:0 0 0.5rem 0;">Distance Measurements</h4>
      <div id="distance-summary" class="body-text" style="font-size:0.95rem;">Select two locations on the map.</div>
      <div class="distance-results-grid">
        <div class="distance-result-item">
          <div class="speed-icon">🚶</div>
          <div class="speed-label">Foot Pace</div>
          <div class="speed-val" id="dist-walk">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">🐎</div>
          <div class="speed-label">Horse</div>
          <div class="speed-val" id="dist-horse">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">⛵</div>
          <div class="speed-label">Galley</div>
          <div class="speed-val" id="dist-ship">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">🐉</div>
          <div class="speed-label">Dragon</div>
          <div class="speed-val" id="dist-dragon">-</div>
        </div>
      </div>
      <div id="narrative-distance-section" class="narrative-distance-section" style="margin-top: 1rem; text-align: left; max-height: 220px; overflow-y: auto; padding-top: 0.5rem; border-top: 1px dashed var(--parchment-dark, #c2a677);"></div>
    `;

    document.body.appendChild(this.popup);

    // Event listener for close button
    this.popup.querySelector('.distance-popup-close').addEventListener('click', () => {
      this.deactivate();
    });

    // Create persistent line element in SVG
    this.line = createSVGElement('line', {
      class: 'distance-line',
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '0',
      style: 'display: none;'
    });
    this.svg.appendChild(this.line);
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate() {
    this.isActive = true;
    this.firstLocation = null;
    this.secondLocation = null;
    this.popup.classList.remove('hidden');
    this.popup.querySelector('#distance-summary').textContent = "Click first location...";
    this.clearLine();
    
    // Clear display
    this.popup.querySelector('#dist-walk').textContent = '-';
    this.popup.querySelector('#dist-horse').textContent = '-';
    this.popup.querySelector('#dist-ship').textContent = '-';
    this.popup.querySelector('#dist-dragon').textContent = '-';

    const section = this.popup.querySelector('#narrative-distance-section');
    if (section) section.innerHTML = '';
  }

  deactivate() {
    this.isActive = false;
    this.firstLocation = null;
    this.secondLocation = null;
    this.popup.classList.add('hidden');
    this.clearLine();
    const section = this.popup.querySelector('#narrative-distance-section');
    if (section) section.innerHTML = '';
  }

  handleLocationClick(location) {
    if (!this.isActive) return false;

    if (!this.firstLocation) {
      this.firstLocation = location;
      this.popup.querySelector('#distance-summary').textContent = `From ${location.name}. Click destination...`;
      return true;
    }

    if (!this.secondLocation && location.id !== this.firstLocation.id) {
      this.secondLocation = location;
      this.calculateDistance();
      return true;
    }

    // Reset selection if clicking a third time or clicking first again
    this.firstLocation = location;
    this.secondLocation = null;
    this.popup.querySelector('#distance-summary').textContent = `From ${location.name}. Click destination...`;
    this.clearLine();
    const section = this.popup.querySelector('#narrative-distance-section');
    if (section) section.innerHTML = '';
    return true;
  }

  calculateDistance() {
    const p1 = window.atlasApp?.mapRenderer?.getLocationCoordinate(this.firstLocation);
    const p2 = window.atlasApp?.mapRenderer?.getLocationCoordinate(this.secondLocation);

    const narrativeStatements = window.atlasDataManager?.getNarrativeDistances?.(this.firstLocation, this.secondLocation) || [];
    this.renderNarrativeDistances(narrativeStatements);

    if (!p1 || !p2) return;

    // Draw line
    this.line.setAttribute('x1', p1.x);
    this.line.setAttribute('y1', p1.y);
    this.line.setAttribute('x2', p2.x);
    this.line.setAttribute('y2', p2.y);
    this.line.style.display = 'block';

    const milesPerUnit = window.atlasDataManager?.getWorldMilesPerUnit?.();
    if (!milesPerUnit) {
      this.popup.querySelector('#distance-summary').innerHTML = `
        <strong>${this.firstLocation.name}</strong> to <strong>${this.secondLocation.name}</strong><br/>
        <span style="color:var(--gold-dark); font-weight:bold;">Map scale calibration pending.</span>
      `;
      this.popup.querySelector('#dist-walk').textContent = '—';
      this.popup.querySelector('#dist-horse').textContent = '—';
      this.popup.querySelector('#dist-ship').textContent = '—';
      this.popup.querySelector('#dist-dragon').textContent = '—';
      return;
    }

    const miles = distanceBetween(p1, p2) * milesPerUnit;
    const leagues = miles / 3;

    this.popup.querySelector('#distance-summary').innerHTML = `
      <strong>${this.firstLocation.name}</strong> to <strong>${this.secondLocation.name}</strong><br/>
      <span style="color:var(--gold-dark); font-weight:bold;">${Math.round(miles)} miles</span> (~${Math.round(leagues)} leagues)
    `;

    // Compute times
    this.popup.querySelector('#dist-walk').textContent = `${travelTime(miles, 'walking')} days`;
    this.popup.querySelector('#dist-horse').textContent = `${travelTime(miles, 'horse')} days`;
    this.popup.querySelector('#dist-ship').textContent = `${travelTime(miles, 'ship')} days`;
    this.popup.querySelector('#dist-dragon').textContent = `${travelTime(miles, 'dragon')} days`;
  }

  renderNarrativeDistances(statements) {
    const container = this.popup.querySelector('#narrative-distance-section');
    if (!container) return;

    if (!statements || statements.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.82rem; color: var(--ink-light, #5c4d3c); font-style: italic; text-align: center; padding: 0.3rem 0;">
          Fără mențiuni de distanță narativă extrasă din text pentru această pereche.
        </div>
      `;
      return;
    }

    const hasUncertainty = statements.some(s => s.confidence === 'uncertain' || s.nota);

    let html = `
      <div style="font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: bold; margin-bottom: 0.4rem; color: var(--ink-dark, #2c1810); display: flex; align-items: center; justify-content: space-between;">
        <span>Distanțe Narative din Text (${statements.length})</span>
        ${hasUncertainty ? '<span class="narrative-badge-warning" style="background:#8b0000; color:#ffffff; font-size:0.72rem; padding:2px 6px; border-radius:3px; font-family:sans-serif; font-weight:bold;">⚠ Conflict / Incerte</span>' : ''}
      </div>
    `;

    statements.forEach((stmt) => {
      const isUncertain = stmt.confidence === 'uncertain' || stmt.nota;
      const cardStyle = isUncertain 
        ? 'background: rgba(139, 0, 0, 0.08); border-left: 3px solid #8b0000; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 3px;'
        : 'background: rgba(44, 24, 16, 0.05); border-left: 3px solid var(--gold, #c2a677); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 3px;';

      html += `
        <div class="narrative-card" style="${cardStyle}">
          ${stmt.nota ? `<div style="color: #8b0000; font-weight: bold; font-size: 0.78rem; margin-bottom: 0.2rem;">${stmt.nota}</div>` : ''}
          <div style="font-weight: bold; font-size: 0.85rem; color: var(--ink-dark, #2c1810);">
            ${stmt.distance_value || 'Distanță nespecificată numeric'}
          </div>
          ${stmt.travel_method ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c); margin-top:0.1rem;"><strong>Mijloc:</strong> ${stmt.travel_method}</div>` : ''}
          ${stmt.direction ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c);"><strong>Direcție:</strong> ${stmt.direction}</div>` : ''}
          ${stmt.context ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c); margin-top:0.2rem; font-style: italic;">"${stmt.context}"</div>` : ''}
          <div style="font-size: 0.72rem; color: var(--gold-dark, #8b6d31); margin-top: 0.25rem; text-align: right;">
            📖 ${stmt.source_book || ''} ${stmt.source_fragment ? `(Frag. ${stmt.source_fragment})` : ''} ${stmt.source_page ? `[p. ${stmt.source_page}]` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  clearLine() {
    this.line.style.display = 'none';
  }
}
