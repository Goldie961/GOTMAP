import { createSVGElement, createElement } from '../utils/helpers.js';
import { distanceBetween, travelTime } from '../utils/coordinates.js';
import { t, displayName } from '../i18n/index.js';
import { fragmentMarkup } from '../i18n/langBadge.js';

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
      <h4 class="heading-decorative" style="font-size:1.1rem; margin:0 0 0.5rem 0;">${t('distance.title')}</h4>
      <div id="distance-summary" class="body-text" style="font-size:0.95rem;">${t('distance.selectLocations')}</div>
      <div class="distance-results-grid">
        <div class="distance-result-item">
          <div class="speed-icon">🚶</div>
          <div class="speed-label">${t('distance.footPace')}</div>
          <div class="speed-val" id="dist-walk">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">🐎</div>
          <div class="speed-label">${t('distance.horse')}</div>
          <div class="speed-val" id="dist-horse">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">⛵</div>
          <div class="speed-label">${t('distance.galley')}</div>
          <div class="speed-val" id="dist-ship">-</div>
        </div>
        <div class="distance-result-item">
          <div class="speed-icon">🐉</div>
          <div class="speed-label">${t('distance.dragon')}</div>
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

  /**
   * Rebuild the popup in the new interface language, keeping the current pair
   * selected. The popup lives on `document.body`, outside every container the
   * app re-renders, so it has to be replaced explicitly.
   */
  rebuild() {
    const { isActive, firstLocation, secondLocation } = this;
    this.popup?.remove();
    this.line?.remove();
    this.init();

    if (!isActive) return;
    this.activate();
    if (firstLocation) this.handleLocationClick(firstLocation);
    if (secondLocation) this.handleLocationClick(secondLocation);
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
    this.popup.querySelector('#distance-summary').textContent = t('distance.selectFirst');
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
      this.popup.querySelector('#distance-summary').textContent = t('distance.fromClickDest', { name: displayName(location) });
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
    this.popup.querySelector('#distance-summary').textContent = t('distance.fromClickDest', { name: displayName(location) });
    this.clearLine();
    const section = this.popup.querySelector('#narrative-distance-section');
    if (section) section.innerHTML = '';
    return true;
  }

  calculateDistance() {
    // Geometry resolves to the anchor; the narrative statements below stay on the
    // entities the reader actually picked, because a claim about the Hightower is
    // not a claim about Oldtown even when both share one point on the map.
    const anchor = id => window.atlasDataManager?.getMappableAnchor?.(id) || id;
    const p1 = window.atlasApp?.mapRenderer?.getLocationCoordinate(anchor(this.firstLocation));
    const p2 = window.atlasApp?.mapRenderer?.getLocationCoordinate(anchor(this.secondLocation));

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
        ${t('distance.locationToLocation', { from: `<strong>${displayName(this.firstLocation)}</strong>`, to: `<strong>${displayName(this.secondLocation)}</strong>` })}<br/>
        <span style="color:var(--gold-dark); font-weight:bold;">${t('distance.calibrationPending')}</span>
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
      ${t('distance.locationToLocation', { from: `<strong>${displayName(this.firstLocation)}</strong>`, to: `<strong>${displayName(this.secondLocation)}</strong>` })}<br/>
      <span style="color:var(--gold-dark); font-weight:bold;">${t('distance.miles', { miles: Math.round(miles) })}</span> ${t('distance.leagues', { leagues: Math.round(leagues) })}
    `;

    // Compute times
    this.popup.querySelector('#dist-walk').textContent = t('distance.days', { days: travelTime(miles, 'walking') });
    this.popup.querySelector('#dist-horse').textContent = t('distance.days', { days: travelTime(miles, 'horse') });
    this.popup.querySelector('#dist-ship').textContent = t('distance.days', { days: travelTime(miles, 'ship') });
    this.popup.querySelector('#dist-dragon').textContent = t('distance.days', { days: travelTime(miles, 'dragon') });
  }

  renderNarrativeDistances(statements) {
    const container = this.popup.querySelector('#narrative-distance-section');
    if (!container) return;

    if (!statements || statements.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.82rem; color: var(--ink-light, #5c4d3c); font-style: italic; text-align: center; padding: 0.3rem 0;">
          ${t('distance.noNarrative')}
        </div>
      `;
      return;
    }

    const hasUncertainty = statements.some(s => s.confidence === 'uncertain' || s.nota);

    let html = `
      <div style="font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: bold; margin-bottom: 0.4rem; color: var(--ink-dark, #2c1810); display: flex; align-items: center; justify-content: space-between;">
        <span>${t('distance.narrativeTitle', { count: statements.length })}</span>
        ${hasUncertainty ? `<span class="narrative-badge-warning" style="background:#8b0000; color:#ffffff; font-size:0.72rem; padding:2px 6px; border-radius:3px; font-family:sans-serif; font-weight:bold;">${t('distance.conflictBadge')}</span>` : ''}
      </div>
    `;

    statements.forEach((stmt) => {
      const isUncertain = stmt.confidence === 'uncertain' || stmt.nota;
      const cardStyle = isUncertain
        ? 'background: rgba(139, 0, 0, 0.08); border-left: 3px solid #8b0000; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 3px;'
        : 'background: rgba(44, 24, 16, 0.05); border-left: 3px solid var(--gold, #c2a677); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 3px;';

      // L3: the card body is quoted text extracted from the books, not prose the
      // application wrote. It is marked with its language and never hidden — 94%
      // of these 467 statements are Romanian, so filtering by language would
      // empty the panel on the English interface (§5.1).
      const fragment = fragmentMarkup([stmt.distance_value, stmt.context, stmt.travel_method].filter(Boolean).join(' '));

      html += `
        <div class="narrative-card" style="${cardStyle}"${fragment.attrs}>
          ${stmt.nota ? `<div style="color: #8b0000; font-weight: bold; font-size: 0.78rem; margin-bottom: 0.2rem;">${stmt.nota}</div>` : ''}
          <div style="font-weight: bold; font-size: 0.85rem; color: var(--ink-dark, #2c1810);">
            ${stmt.distance_value || t('distance.unspecifiedDistance')}${fragment.badge}
          </div>
          ${stmt.travel_method ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c); margin-top:0.1rem;"><strong>${t('distance.methodLabel')}</strong> ${stmt.travel_method}</div>` : ''}
          ${stmt.direction ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c);"><strong>${t('distance.directionLabel')}</strong> ${stmt.direction}</div>` : ''}
          ${stmt.context ? `<div style="font-size: 0.78rem; color: var(--ink-light, #5c4d3c); margin-top:0.2rem; font-style: italic;">"${stmt.context}"</div>` : ''}
          <div style="font-size: 0.72rem; color: var(--gold-dark, #8b6d31); margin-top: 0.25rem; text-align: right;">
            📖 ${stmt.source_book || ''} ${stmt.source_fragment ? t('distance.sourceFrag', { frag: stmt.source_fragment }) : ''} ${stmt.source_page ? t('distance.sourcePage', { page: stmt.source_page }) : ''}
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
