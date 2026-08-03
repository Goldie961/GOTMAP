// The first-interaction panel: who is this, and where do I read the rest.
//
// It used to be the whole encyclopedia — chronology, members, related houses,
// proximity, provenance — rendered into a 420px column that scrolled for several
// screens on any well-covered entity. Everything below the key facts now lives on
// the entity's page (js/ui/WikiPage.js), which is what the button leads to.
//
// This file is a shell. It owns the container, the header and the dispatch; it
// knows nothing about any specific entity type. Per-type rendering lives in
// js/ui/panels/, one module each, behind the table in js/ui/panels/index.js.

import { createElement } from '../utils/helpers.js';
import { getHouseColor, getHouseSecondaryColor } from '../utils/colors.js';
import { t, displayName } from '../i18n/index.js';
import { appendEntityName } from '../i18n/langBadge.js';
import { readCompletenessScore, completenessBand } from '../utils/completeness.js';
import { getHouseSigilSVG } from './panels/sigils.js';
import { createDivider, createFullPageButton, createValueBadge } from './panels/parts.js';
import { resolveSummaryPanel } from './panels/index.js';

// The panel must fit one screen for every entity, so the fact list is capped
// rather than merely short: a type module may offer more, only this many render.
const MAX_FACTS = 4;

export class InfoPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentEntity = null;
    this.rivers = null;
  }

  init() {
    this.container.className = 'info-panel';
    // Kept for compatibility with callers that still read it; the proximity
    // calculation that used it now runs on the full page.
    this.rivers = window.atlasDataManager?.data?.calibratedRivers || [];
  }

  open(entity, worldState) {
    if (!entity) return;
    this.currentEntity = entity;
    this.container.innerHTML = '';
    window.atlasApp?.audioManager?.playWood();

    const data = window.atlasDataManager?.data || {};
    const panel = resolveSummaryPanel(entity, data);
    const context = { worldState: worldState || {}, data };

    const closeButton = createElement('button', 'info-panel-close', '×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => this.close());
    this.container.appendChild(closeButton);

    const crestHouseId = this.safely(panel, 'crest', entity, context);
    if (crestHouseId) {
      const stripe = createElement('div', 'house-banner-stripe');
      stripe.style.backgroundColor = getHouseColor(crestHouseId);
      this.container.appendChild(stripe);
    }

    this.container.appendChild(this.buildHeader(entity, panel, context, crestHouseId));
    this.container.appendChild(createDivider());

    const content = createElement('div', 'info-panel-content');
    const facts = createElement('div', 'info-section');
    const rows = (this.safely(panel, 'facts', entity, context) || []).filter(Boolean);
    rows.slice(0, MAX_FACTS).forEach(row => facts.appendChild(row));
    if (rows.length) content.appendChild(facts);

    content.appendChild(createFullPageButton(entity));
    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  buildHeader(entity, panel, context, crestHouseId) {
    const header = createElement('div', 'info-panel-header');

    const titleRow = createElement('div', 'info-panel-title');
    const title = createElement('h2', 'heading-secondary');
    appendEntityName(title, entity);
    // The heading is clamped to three lines; this keeps the whole name reachable.
    title.title = displayName(entity);
    titleRow.appendChild(title);
    titleRow.appendChild(createValueBadge(entity.canon || entity.canon_status || entity.confidence || 'unknown'));
    header.appendChild(titleRow);

    const kicker = this.safely(panel, 'kicker', entity, context);
    if (kicker) header.appendChild(createElement('p', 'info-panel-kicker', kicker));

    if (crestHouseId) header.appendChild(this.buildCrest(crestHouseId));

    const house = crestHouseId ? window.atlasDataManager?.getHouse?.(crestHouseId) : null;
    if (house && house.id !== entity.id) {
      header.appendChild(createElement('div', 'label info-panel-house', displayName(house)));
    }
    const words = this.safely(panel, 'words', entity, context) || house?.words || house?.metadata?.words;
    if (words) header.appendChild(createElement('div', 'house-words', `"${words}"`));

    const note = this.completenessNote(entity);
    if (note) header.appendChild(note);
    return header;
  }

  buildCrest(houseId) {
    const box = createElement('div', 'house-sigil-display');
    box.style.borderColor = getHouseColor(houseId);
    const house = window.atlasDataManager?.getHouse?.(houseId);
    const drawFallback = () => { box.innerHTML = getHouseSigilSVG(houseId, getHouseColor(houseId), getHouseSecondaryColor(houseId)); };

    if (house?.crest) {
      const image = createElement('img');
      image.src = house.crest;
      image.alt = '';
      // 103 of 229 houses have no crest file and some paths are stale; the
      // silhouette is the fallback rather than a broken-image icon.
      image.onerror = () => { image.onerror = null; drawFallback(); };
      box.appendChild(image);
    } else {
      drawFallback();
    }
    return box;
  }

  /**
   * One honest line about how much the record holds — here, and not only on the
   * full page, because it is what tells a reader whether the button is worth
   * pressing: 1530 of the 2227 scored characters sit below 0.3. Absent for the
   * records that were never scored, rather than guessed at.
   */
  completenessNote(entity) {
    const band = completenessBand(readCompletenessScore(entity));
    if (!band) return null;
    return createElement('p', `info-panel-completeness ${band}`, t(`completeness.${band}`));
  }

  /** A type module that throws must not take the whole panel down with it. */
  safely(panel, method, entity, context) {
    if (typeof panel[method] !== 'function') return null;
    try {
      return panel[method](entity, context);
    } catch (error) {
      console.error(`[InfoPanel] ${panel.id}.${method} failed for ${entity?.id}:`, error);
      return null;
    }
  }

  close() {
    this.container.classList.remove('open');
    document.dispatchEvent(new CustomEvent('locationDeselected'));
  }
}
