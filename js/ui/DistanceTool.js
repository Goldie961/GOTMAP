import { createSVGElement, createElement } from '../utils/helpers.js';
import { distanceInMiles, distanceInLeagues, travelTime } from '../utils/coordinates.js';

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
  }

  deactivate() {
    this.isActive = false;
    this.firstLocation = null;
    this.secondLocation = null;
    this.popup.classList.add('hidden');
    this.clearLine();
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
    return true;
  }

  calculateDistance() {
    const p1 = this.firstLocation.coordinates;
    const p2 = this.secondLocation.coordinates;

    // Draw line
    this.line.setAttribute('x1', p1.x);
    this.line.setAttribute('y1', p1.y);
    this.line.setAttribute('x2', p2.x);
    this.line.setAttribute('y2', p2.y);
    this.line.style.display = 'block';

    const miles = distanceInMiles(p1, p2);
    const leagues = distanceInLeagues(p1, p2);

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

  clearLine() {
    this.line.style.display = 'none';
  }
}
