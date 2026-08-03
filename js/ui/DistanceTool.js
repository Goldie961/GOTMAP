import { createSVGElement, createElement } from '../utils/helpers.js';
import { distanceBetween, travelTime } from '../utils/coordinates.js';
import { t, displayName } from '../i18n/index.js';
import { fragmentMarkup } from '../i18n/langBadge.js';
import { assessPair, MILES_PER_LEAGUE } from '../data/DistanceClaims.js';
import { LocationPicker } from './LocationPicker.js';

/**
 * The distance panel, in three tiers of decreasing authority.
 *
 * 1. `distanta_canonica_leghe` from data/locations/canonical_distances.json —
 *    the result. Curated by hand, with a route and a source. Travel times are
 *    derived from this and from nothing else.
 * 2. The statements extracted from the books — evidence, quoted with book and
 *    page. Where they disagree, the disagreement is shown as the finding rather
 *    than resolved: no statement is chosen over another and nothing is averaged.
 * 3. Straight-line map geometry — an approximation, and only when the world
 *    coordinate space actually declares a `milesPerUnit`. It is currently null,
 *    so this tier is absent rather than displayed as an empty headline.
 *
 * Endpoints come from two search fields over every known place. Clicking a
 * marker still fills a field, but only 80 of ~1100 places carry a marker, so it
 * is a shortcut and not the way in.
 */
export class DistanceTool {
  constructor(svgElement, options = {}) {
    this.svg = svgElement;
    this.dataManager = options.dataManager || null;
    this.isActive = false;
    this.firstLocation = null;
    this.secondLocation = null;
    this.line = null;
    this.popup = null;
    this.pickers = {};

    this.init();
  }

  init() {
    this.popup = createElement('div', 'distance-popup hidden');
    this.popup.innerHTML = `
      <button class="distance-popup-close" aria-label="${t('distance.close')}">×</button>
      <h4 class="heading-decorative">${t('distance.title')}</h4>
      <div class="distance-endpoints"></div>
      <div class="distance-tiers">
        <section class="distance-tier distance-tier-canonical" id="distance-canonical"></section>
        <section class="distance-tier distance-tier-travel" id="distance-travel"></section>
        <section class="distance-tier distance-tier-narrative" id="distance-narrative"></section>
        <section class="distance-tier distance-tier-geometry" id="distance-geometry"></section>
      </div>
    `;
    document.body.appendChild(this.popup);

    const endpoints = this.popup.querySelector('.distance-endpoints');
    this.pickers.a = new LocationPicker({ slot: 'a', onPick: location => this.setEndpoint('a', location) });
    this.pickers.b = new LocationPicker({ slot: 'b', onPick: location => this.setEndpoint('b', location) });
    endpoints.appendChild(this.pickers.a.render());

    const swap = createElement('button', 'distance-swap', '⇄');
    swap.type = 'button';
    swap.title = t('distance.swap');
    swap.addEventListener('click', () => this.swap());
    endpoints.appendChild(swap);
    endpoints.appendChild(this.pickers.b.render());

    const candidates = this.dataManager?.getDistanceEndpointCandidates?.() || [];
    this.pickers.a.setLocations(candidates);
    this.pickers.b.setLocations(candidates);

    this.popup.querySelector('.distance-popup-close').addEventListener('click', () => this.deactivate());

    this.line = createSVGElement('line', {
      class: 'distance-line', x1: '0', y1: '0', x2: '0', y2: '0', style: 'display: none;'
    });
    this.svg.appendChild(this.line);

    this.renderResult();
  }

  /**
   * Rebuild in the new interface language, keeping the pair selected. The popup
   * lives on `document.body`, outside every container the app re-renders.
   */
  rebuild() {
    const { isActive, firstLocation, secondLocation } = this;
    this.popup?.remove();
    this.line?.remove();
    this.init();

    if (!isActive) return;
    this.activate();
    this.firstLocation = firstLocation;
    this.secondLocation = secondLocation;
    if (firstLocation) this.pickers.a.setValue(firstLocation);
    if (secondLocation) this.pickers.b.setValue(secondLocation);
    this.renderResult();
  }

  toggle() {
    if (this.isActive) this.deactivate();
    else this.activate();
  }

  activate() {
    this.isActive = true;
    this.popup.classList.remove('hidden');
    this.renderResult();
    this.pickers.a.focus();
  }

  deactivate() {
    this.isActive = false;
    this.firstLocation = null;
    this.secondLocation = null;
    this.pickers.a.clear();
    this.pickers.b.clear();
    this.popup.classList.add('hidden');
    this.clearLine();
    this.renderResult();
  }

  setEndpoint(slot, location) {
    if (slot === 'a') this.firstLocation = location;
    else this.secondLocation = location;
    this.renderResult();
  }

  swap() {
    const { firstLocation, secondLocation } = this;
    this.firstLocation = secondLocation;
    this.secondLocation = firstLocation;
    this.pickers.a.setValue(secondLocation);
    this.pickers.b.setValue(firstLocation);
    this.renderResult();
  }

  /**
   * The marker shortcut. Fills the first empty field, and once both are taken
   * starts a new comparison from the place just clicked — the same behaviour as
   * before, now expressed through the fields so the reader can see what the
   * click did and correct it by typing.
   */
  handleLocationClick(location) {
    if (!this.isActive || !location) return false;

    if (!this.firstLocation) {
      this.firstLocation = location;
      this.pickers.a.setValue(location);
    } else if (!this.secondLocation && location.id !== this.firstLocation.id) {
      this.secondLocation = location;
      this.pickers.b.setValue(location);
    } else {
      this.firstLocation = location;
      this.secondLocation = null;
      this.pickers.a.setValue(location);
      this.pickers.b.clear();
    }
    this.renderResult();
    return true;
  }

  // ---------------------------------------------------------------- rendering

  renderResult() {
    const canonical = this.popup.querySelector('#distance-canonical');
    const travel = this.popup.querySelector('#distance-travel');
    const narrative = this.popup.querySelector('#distance-narrative');
    const geometry = this.popup.querySelector('#distance-geometry');

    const a = this.firstLocation;
    const b = this.secondLocation;

    if (!a || !b) {
      canonical.innerHTML = `<p class="distance-hint">${t('distance.selectLocations')}</p>`;
      travel.innerHTML = '';
      narrative.innerHTML = '';
      geometry.innerHTML = '';
      this.clearLine();
      return;
    }
    if (a.id === b.id) {
      canonical.innerHTML = `<p class="distance-hint">${t('distance.samePlace')}</p>`;
      travel.innerHTML = '';
      narrative.innerHTML = '';
      geometry.innerHTML = '';
      this.clearLine();
      return;
    }

    const record = this.dataManager?.getCanonicalDistance?.(a, b) || null;
    canonical.innerHTML = this.canonicalMarkup(a, b, record);
    travel.innerHTML = this.travelMarkup(record);

    // Statements stay on the entities the reader picked, not on their map
    // anchors: a claim about the Hightower is not a claim about Oldtown even
    // when one point on the map serves both.
    const statements = this.dataManager?.getNarrativeDistances?.(a, b) || [];
    narrative.innerHTML = this.narrativeMarkup(statements);

    geometry.innerHTML = this.geometryMarkup(a, b);
  }

  canonicalMarkup(a, b, record) {
    const pair = t('distance.locationToLocation', {
      from: `<strong>${displayName(a)}</strong>`,
      to: `<strong>${displayName(b)}</strong>`
    });

    if (!record) {
      return `
        <div class="distance-pair-line">${pair}</div>
        <p class="distance-canonical-missing">${t('distance.canonicalMissing')}</p>
      `;
    }

    const leagues = record.distanta_canonica_leghe;
    const miles = Math.round(leagues * MILES_PER_LEAGUE);
    const provenance = [
      record.ruta ? `<div class="distance-canonical-meta"><strong>${t('distance.routeLabel')}</strong> ${record.ruta}</div>` : '',
      record.sursa ? `<div class="distance-canonical-meta"><strong>${t('distance.sourceLabel')}</strong> ${record.sursa}</div>` : '',
      record.nota ? `<div class="distance-canonical-meta distance-canonical-note">${record.nota}</div>` : ''
    ].join('');

    return `
      <div class="distance-pair-line">${pair}</div>
      <div class="distance-canonical-value">
        ${t('distance.leaguesValue', { leagues })}
        <span class="distance-canonical-miles">${t('distance.miles', { miles })}</span>
      </div>
      ${provenance}
    `;
  }

  /**
   * Travel times, derived from the canonical value alone. Free text can never
   * feed them: "sute de leghe" and "se ajunge repede" are impressions, and
   * turning either into a number of days would invent a figure the project has
   * no source for. With no canonical value there are no times.
   */
  travelMarkup(record) {
    const modes = [
      ['🚶', t('distance.footPace'), 'walking'],
      ['🐎', t('distance.horse'), 'horse'],
      ['⛵', t('distance.galley'), 'ship'],
      ['🐉', t('distance.dragon'), 'dragon']
    ];
    const miles = record ? record.distanta_canonica_leghe * MILES_PER_LEAGUE : null;

    const tiles = modes.map(([icon, label, mode]) => `
      <div class="distance-result-item">
        <div class="speed-icon">${icon}</div>
        <div class="speed-label">${label}</div>
        <div class="speed-val">${miles === null ? '—' : t('distance.days', { days: travelTime(miles, mode) })}</div>
      </div>
    `).join('');

    return `
      <h5 class="distance-tier-title">${t('distance.travelTitle')}</h5>
      <div class="distance-results-grid">${tiles}</div>
      ${miles === null ? `<p class="distance-hint">${t('distance.travelNeedsCanonical')}</p>` : ''}
    `;
  }

  narrativeMarkup(statements) {
    if (!statements.length) {
      return `
        <h5 class="distance-tier-title">${t('distance.narrativeHeading')}</h5>
        <p class="distance-hint">${t('distance.noNarrative')}</p>
      `;
    }

    const assessment = assessPair(statements);
    const banner = assessment.conflict
      ? `<div class="distance-conflict-banner" role="note">
           <strong>${t('distance.conflictBadge')}</strong>
           <span>${t('distance.conflictExplained')}</span>
           <ul class="distance-conflict-reasons">
             ${assessment.reasons.map(reason => `<li>${t(`distance.conflictReason.${reason}`)}</li>`).join('')}
           </ul>
         </div>`
      : (statements.length > 1 && !assessment.measurable
        ? `<p class="distance-hint">${t('distance.multipleUnmeasured', { count: statements.length })}</p>`
        : '');

    const cards = assessment.claims.map(({ statement, claim }) => {
      const flagged = claim.emphasis && assessment.reasons.includes('emphasis');
      const uncertain = statement.confidence === 'uncertain' || statement.nota;
      const classes = ['narrative-card'];
      if (uncertain) classes.push('narrative-card-uncertain');
      if (flagged) classes.push('narrative-card-flagged');

      // The card body is quoted text from the books, not prose the application
      // wrote. It is marked with its language and never hidden: 94% of these
      // statements are Romanian, so filtering by language would empty the panel
      // on the English interface (§5.1).
      const fragment = fragmentMarkup(
        [statement.distance_value, statement.context, statement.travel_method].filter(Boolean).join(' ')
      );

      return `
        <div class="${classes.join(' ')}"${fragment.attrs}>
          ${statement.nota ? `<div class="narrative-card-nota">${statement.nota}</div>` : ''}
          <div class="narrative-card-value">
            ${statement.distance_value || t('distance.unspecifiedDistance')}${fragment.badge}
          </div>
          <div class="narrative-card-claim">${this.claimMarkup(claim)}</div>
          ${statement.travel_method ? `<div class="narrative-card-meta"><strong>${t('distance.methodLabel')}</strong> ${statement.travel_method}</div>` : ''}
          ${statement.direction ? `<div class="narrative-card-meta"><strong>${t('distance.directionLabel')}</strong> ${statement.direction}</div>` : ''}
          ${statement.context ? `<div class="narrative-card-context">„${statement.context}”</div>` : ''}
          <div class="narrative-card-source">
            📖 ${statement.source_book || ''}
            ${statement.source_fragment ? t('distance.sourceFrag', { frag: statement.source_fragment }) : ''}
            ${statement.source_page ? t('distance.sourcePage', { page: statement.source_page }) : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <h5 class="distance-tier-title">
        ${t('distance.narrativeTitle', { count: statements.length })}
        <span class="distance-tier-note">${t('distance.narrativeIsEvidence')}</span>
      </h5>
      ${banner}
      <div class="distance-narrative-list">${cards}</div>
    `;
  }

  /**
   * What the parser could read out of one statement, shown beside the quote so
   * the reader can check the reading against the sentence. Explicitly labelled
   * as a reading of the text, because it is derived and fallible — the panel
   * never treats it as a measurement.
   */
  claimMarkup(claim) {
    const emphasis = claim.emphasis
      ? `<span class="narrative-claim-emphasis narrative-claim-${claim.emphasis}">${t(`distance.emphasis.${claim.emphasis}`)}</span>`
      : '';

    if (claim.axis === 'length') {
      const fmt = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
      let reading;
      if (claim.bound === 'magnitude') {
        reading = t('distance.claimRange', { min: fmt(claim.leagueMin), max: fmt(claim.leagueMax) });
      } else if (claim.bound === 'atLeast') {
        reading = t('distance.claimAtLeast', { leagues: fmt(claim.leagueMin) });
      } else if (claim.bound === 'atMost') {
        reading = t('distance.claimAtMost', { leagues: fmt(claim.leagueMax) });
      } else {
        reading = t('distance.claimExact', { leagues: fmt(claim.leagueMin) });
      }
      const converted = claim.unit !== 'league'
        ? ` <span class="narrative-claim-unit">${t('distance.claimConverted', { unit: t(`distance.unit.${claim.unit}`) })}</span>`
        : '';
      return `<span class="narrative-claim-label">${t('distance.readingLabel')}</span> ${reading}${converted} ${emphasis}`;
    }

    if (claim.axis === 'duration') {
      const days = claim.bound === 'atLeast' ? claim.dayMin : claim.dayMax;
      const reading = days < 1
        ? t('distance.claimHours', { hours: Math.round(days * 24) })
        : t('distance.claimDays', { days: Math.round(days * 10) / 10 });
      const prefix = claim.bound === 'atLeast' ? '≥ ' : claim.bound === 'atMost' ? '≤ ' : '';
      return `<span class="narrative-claim-label">${t('distance.readingLabel')}</span> ${prefix}${reading} ${emphasis}`;
    }

    return `<span class="narrative-claim-label">${t('distance.readingLabel')}</span> <span class="narrative-claim-none">${t('distance.claimNone')}</span> ${emphasis}`;
  }

  /**
   * Geometry, and the line on the map. Both depend on the world coordinate
   * space declaring a scale; `milesPerUnit` is null today, so the tier states
   * that a geometric distance is unavailable instead of showing a blank result
   * where the main figure belongs.
   */
  geometryMarkup(a, b) {
    const anchor = location => this.dataManager?.getMappableAnchor?.(location) || location;
    const renderer = window.atlasApp?.mapRenderer;
    const p1 = renderer?.getLocationCoordinate?.(anchor(a));
    const p2 = renderer?.getLocationCoordinate?.(anchor(b));

    if (!p1 || !p2) {
      this.clearLine();
      return `
        <h5 class="distance-tier-title">${t('distance.geometryTitle')}</h5>
        <p class="distance-hint">${t('distance.geometryNoPins')}</p>
      `;
    }

    this.line.setAttribute('x1', p1.x);
    this.line.setAttribute('y1', p1.y);
    this.line.setAttribute('x2', p2.x);
    this.line.setAttribute('y2', p2.y);
    this.line.style.display = 'block';

    const milesPerUnit = this.dataManager?.getWorldMilesPerUnit?.();
    if (!milesPerUnit) {
      return `
        <h5 class="distance-tier-title">${t('distance.geometryTitle')}</h5>
        <p class="distance-hint">${t('distance.calibrationPending')}</p>
      `;
    }

    const miles = distanceBetween(p1, p2) * milesPerUnit;
    return `
      <h5 class="distance-tier-title">${t('distance.geometryTitle')}</h5>
      <div class="distance-geometry-value">
        ${t('distance.miles', { miles: Math.round(miles) })}
        ${t('distance.leagues', { leagues: Math.round(miles / MILES_PER_LEAGUE) })}
        <span class="distance-geometry-caveat">${t('distance.geometryApprox')}</span>
      </div>
    `;
  }

  clearLine() {
    if (this.line) this.line.style.display = 'none';
  }
}
