import { createElement, formatYear, stripEntityPrefix } from '../utils/helpers.js';
import { matchesInternId } from '../utils/entities.js';
import { isCharacterEntity, isEventEntity } from '../utils/entityKind.js';
import { t, displayName, resolveAliases } from '../i18n/index.js';
import { appendEntityName, markFragmentLanguage } from '../i18n/langBadge.js';
import { collectSources, collectClaimVariants, dedupeSources } from '../utils/sources.js';
import { createSourceCite, createSourceList } from './SourceCite.js';
import { readCompletenessScore, completenessBand, coverageBand } from '../utils/completeness.js';
import { getHouseColor } from '../utils/colors.js';
import { navigateToEntity, entityHref } from '../router/links.js';

/**
 * Does a built section actually say anything?
 *
 * `childNodes.length` was the old test and it was too weak: a builder that
 * returns a wrapper holding an empty wrapper passed it, and the page grew a
 * heading over nothing. On a dataset where most records are sparse that is the
 * difference between an honest page and six empty headings.
 */
function hasContent(node) {
  if (!node) return false;
  if (node.textContent && node.textContent.trim()) return true;
  // Images, canvases and inputs carry no text but are content.
  return Boolean(node.querySelector?.('img, svg, canvas, input, button'));
}

function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Sample points off an SVG path string; good enough for a nearest-river test. */
function parsePathPoints(pathString) {
  const numbers = String(pathString).match(/-?\d+(?:\.\d+)?/g) || [];
  const points = [];
  for (let index = 0; index < numbers.length - 1; index += 2) {
    points.push({ x: Number.parseFloat(numbers[index]), y: Number.parseFloat(numbers[index + 1]) });
  }
  return points;
}

const RELATION_LABELS = {
  get ally_of() { return t('wiki.relations.allyOf'); },
  get enemy_of() { return t('wiki.relations.enemyOf'); },
  get vassal_of() { return t('wiki.relations.vassalOf'); },
  get liege_of() { return t('wiki.relations.liegeOf'); }
};

const FAMILY_LABELS = {
  get parinti() { return t('wiki.family.parents'); },
  get copii() { return t('wiki.family.children'); },
  get frati() { return t('wiki.family.siblings'); },
  get casatorit_cu() { return t('wiki.family.spouses'); },
  get possible_parent_of() { return t('wiki.family.possibleChildren'); }
};

/** Full, entity-focused wiki view.  It deliberately accepts both the current data
 * shape and the extended import shape, so importing more statements needs no UI rewrite. */
export class WikiPage {
  constructor() {
    this.currentEntity = null;
    this.previousEntity = null;
    this.host = null;
    /** Sections that produced content on the last render; drives the anchor nav. */
    this.sections = [];
    this.plannedSections = 0;
  }

  init() {
    this.host = createElement('div', 'wiki-page');
    this.host.setAttribute('aria-hidden', 'true');
    document.getElementById('app').appendChild(this.host);
  }

  /**
   * Show a record. This is the *render* entry point and stays deliberately
   * ignorant of the address bar: the router calls it after a navigation has
   * already happened. Anything in the interface that should change the address
   * calls navigateToEntity() instead, and comes back here through the router.
   */
  open(entity, options = {}) {
    if (!entity) return;
    if (this.currentEntity && !options.fromCompact) this.previousEntity = this.currentEntity;
    this.currentEntity = entity;
    this.render();
    this.host.classList.add('open');
    this.host.setAttribute('aria-hidden', 'false');
  }

  close() {
    this.host.classList.remove('open');
    this.host.setAttribute('aria-hidden', 'true');
  }

  /** True while the page is on screen — the router's test for what to close. */
  get isOpen() {
    return this.host?.classList.contains('open') ?? false;
  }

  get data() { return window.atlasDataManager?.data || {}; }

  getEntity(id) {
    if (!id) return null;
    if (typeof id === 'object') return id;
    const cleanId = stripEntityPrefix(id);
    const all = [
      ...(window.atlasDataManager?.getAllLocations?.() || []),
      ...(this.data.houses || []), ...(this.data.characters || []),
      ...(this.data.events || []), ...(this.data.dragons || [])
    ];
    return all.find(item => item.id === id || matchesInternId(item, id) || item.id === cleanId) || null;
  }

  /**
   * A cross-reference to another record.
   *
   * Now a real `<a>` with a real href when the target is routable, so a reader
   * can middle-click it, copy it or bookmark it — the point of P6.1. The click
   * is still intercepted: the app has the entity in memory and a full page load
   * would discard the map behind the overlay.
   */
  linkToEntity(id, fallback = '') {
    const entity = this.getEntity(id);
    if (!entity) {
      return createElement('span', 'wiki-missing-reference', fallback || String(id));
    }
    const href = entityHref(entity);
    const link = createElement(href ? 'a' : 'button', 'wiki-entity-link', displayName(entity) || fallback || String(id));
    if (href) link.href = href;
    link.addEventListener('click', event => {
      // Let the browser handle the modified clicks it handles better than we do.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
      event.preventDefault();
      if (!navigateToEntity(entity)) this.open(entity);
    });
    return link;
  }

  confidenceBadge(value) {
    const confidence = ['canon', 'inferred', 'unknown'].includes(value) ? value : 'unknown';
    const icon = { canon: '●', inferred: '◆', unknown: '?' }[confidence];
    const badge = createElement('span', `wiki-confidence ${confidence}`, `${icon} ${confidence}`);
    badge.title = { canon: t('wiki.confidence.canon'), inferred: t('wiki.confidence.inferred'), unknown: t('wiki.confidence.unknown') }[confidence];
    return badge;
  }

  /**
   * A collapsed citation for one record. It used to print book, fragment and the
   * full page range inline, which on a character page meant the same 300-character
   * page list sixteen times over; the reader now gets a chip and opens what they
   * want. Nothing is dropped — see js/ui/SourceCite.js.
   *
   * `source_book` is read here for the first time: the previous field list looked
   * only for `book`/`carte`, which no character record has, so the book name was
   * silently missing from every citation but one.
   */
  sourceBlock(record, fallback) {
    const cite = createSourceCite(collectSources(record, fallback));
    if (!cite) return null;
    const line = createElement('div', 'wiki-source');
    line.appendChild(cite);
    return line;
  }

  /**
   * Build a section and keep it only if it produced something.
   *
   * The emptiness test is the load-bearing part: 1530 of the 2227 scored
   * characters are below 0.3, so on most records most sections have nothing to
   * say. `childNodes.length` alone was not enough — a builder that returns a box
   * holding an empty box passed it — so the text and element counts are both
   * checked. Sections that survive register an anchor; the rest leave no trace.
   *
   * @param {string} key stable, language-independent anchor id
   */
  appendSection(key, title, build) {
    let content = null;
    try {
      content = build();
    } catch (error) {
      // A section that throws must not abort the page; it simply does not exist.
      console.error(`[WikiPage] section "${key}" failed:`, error);
      return;
    }
    if (!hasContent(content)) return;

    const section = createElement('section', 'wiki-section');
    section.id = `wiki-section-${key}`;
    section.appendChild(createElement('h2', '', title));
    section.appendChild(content);
    this.content.appendChild(section);
    this.sections.push({ key, title, id: section.id });
  }

  /**
   * Anchors for the sections that exist, and nothing for the ones that do not.
   * Inserted after the sections are built precisely so it cannot advertise an
   * empty one.
   */
  buildSectionNav() {
    if (this.sections.length < 2) return null;
    const nav = createElement('nav', 'wiki-nav');
    nav.setAttribute('aria-label', t('wiki.nav.label'));
    this.sections.forEach(section => {
      const link = createElement('a', 'wiki-nav-link', section.title);
      link.href = `#${section.id}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        // The page scrolls inside `.wiki-page`, not the document, so the native
        // fragment jump would move the wrong scroller.
        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(link);
    });
    return nav;
  }

  /**
   * What the reader is actually getting, stated before they scroll. Two separate
   * measures because they answer different questions: `scor_total` is the
   * extraction pass's judgement of the record, the section count is what this
   * page could build. `coverageBand` is the fallback for the minority of records
   * that were never scored. See js/utils/completeness.js.
   */
  buildCompleteness(entity) {
    const box = createElement('div', 'wiki-completeness');
    const score = readCompletenessScore(entity);
    const band = completenessBand(score) || coverageBand(this.sections.length, this.plannedSections) || 'sparse';

    box.classList.add(band);
    box.appendChild(createElement('span', 'wiki-completeness-band', t(`completeness.${band}`)));
    box.appendChild(createElement('span', 'wiki-completeness-detail', t('wiki.completeness.sections', {
      filled: this.sections.length,
      total: this.plannedSections
    })));
    if (score !== null) {
      box.appendChild(createElement('span', 'wiki-completeness-detail', t('wiki.completeness.score', { score: score.toFixed(2) })));
    }
    return box;
  }

  /**
   * The sections a page will attempt, in reading order. Characters get their own
   * plan because the same builders answer different questions for them —
   * `peopleSection` is a family tree on a character and a member list on a house.
   *
   * The plan is what the completeness indicator counts against: "4 of 8" is only
   * honest if the 8 is what this kind of entity could have had.
   */
  sectionPlan(entity, kind) {
    if (kind === 'character') {
      return [
        ['biography', t('wiki.section.biography'), () => this.descriptionSection(entity)],
        ['details', t('wiki.section.characterDetails'), () => this.characterDetailsSection(entity)],
        ['family', t('wiki.section.familyRelations'), () => this.peopleSection(entity)],
        ['chronology', t('wiki.section.chronology'), () => this.timelineSection(entity)],
        ['events', t('wiki.section.associatedEvents'), () => this.eventsSection(entity)],
        ['sources', t('wiki.section.sources'), () => this.sourcesSection(entity)]
      ];
    }
    if (kind === 'event') {
      return [
        ['description', t('wiki.section.description'), () => this.descriptionSection(entity)],
        ['chronology', t('wiki.section.chronology'), () => this.timelineSection(entity)],
        ['people', t('wiki.section.participants'), () => this.peopleSection(entity)],
        ['sources', t('wiki.section.sources'), () => this.sourcesSection(entity)]
      ];
    }
    // Places, houses, factions. Related houses and proximity are theirs alone:
    // an event carries a region too, and listing every house in it said nothing.
    return [
      ['description', t('wiki.section.description'), () => this.descriptionSection(entity)],
      ['relations', t('wiki.section.relations'), () => this.relationsSection(entity)],
      ['chronology', t('wiki.section.chronology'), () => this.timelineSection(entity)],
      ['events', t('wiki.section.associatedEvents'), () => this.eventsSection(entity)],
      ['people', t('wiki.section.associatedCharacters'), () => this.peopleSection(entity)],
      ['houses', t('wiki.section.relatedHouses'), () => this.relatedHousesSection(entity)],
      ['proximity', t('wiki.section.proximity'), () => this.proximitySection(entity)],
      ['sources', t('wiki.section.sources'), () => this.sourcesSection(entity)]
    ];
  }

  /**
   * Which page shape this record gets. Same rule as the summary dispatcher: an
   * explicit `type` outranks collection membership, because ids collide — 15
   * house ids are also character ids, so House Dustin used to be given a
   * character page.
   *
   * The membership fallback still matters: 1662 of the 1682 event records carry
   * no `type` at all and the other 20 carry 'battle', 'conquest' and the like, so
   * `entity.type === 'event'` was never once true and the participants branch of
   * peopleSection() had never run.
   *
   * @returns {'character'|'event'|'entity'}
   */
  resolveKind(entity) {
    if (entity?.type === 'character') return 'character';
    if (entity?.type === 'event') return 'event';
    if (['house', 'faction', 'institution', 'castle', 'city', 'landmark', 'object', 'title'].includes(entity?.type)) return 'entity';
    if (isCharacterEntity(entity, this.data.characters)) return 'character';
    if (isEventEntity(entity, this.data.events)) return 'event';
    return 'entity';
  }

  render() {
    const entity = this.currentEntity;
    const kind = this.resolveKind(entity);
    this.currentKind = kind;

    this.host.innerHTML = '';
    this.sections = [];

    const page = createElement('article', 'wiki-document');
    page.appendChild(this.buildToolbar());
    const header = this.buildHeader(entity, kind);
    page.appendChild(header);
    this.content = createElement('div', 'wiki-content');
    page.appendChild(this.content);

    const plan = this.sectionPlan(entity, kind);
    this.plannedSections = plan.length;
    plan.forEach(([key, title, build]) => this.appendSection(key, title, build));

    // Both of these describe the sections, so both are built after them and
    // inserted at the top: the nav can only link what exists, and the indicator
    // can only count what was rendered.
    header.appendChild(this.buildCompleteness(entity));
    const nav = this.buildSectionNav();
    if (nav) page.insertBefore(nav, this.content);

    this.host.appendChild(page);
  }

  /**
   * Close and Back both go through browser history now, so the page's own
   * controls and the browser's own buttons cannot disagree about where "back"
   * is. `previousEntity` remains only as the label's condition: it says whether
   * this page was reached from another one.
   */
  buildToolbar() {
    const toolbar = createElement('div', 'wiki-toolbar');
    const close = createElement('button', 'wiki-close', t('wiki.close'));
    close.addEventListener('click', () => {
      const router = window.atlasApp?.router;
      if (router) router.back({ name: 'map', params: {} });
      else this.close();
    });
    toolbar.appendChild(close);
    if (this.previousEntity) {
      const back = createElement('button', 'wiki-back', t('wiki.back'));
      back.addEventListener('click', () => {
        const router = window.atlasApp?.router;
        if (router) router.back({ name: 'map', params: {} });
        else this.open(this.previousEntity, { fromCompact: true });
      });
      toolbar.appendChild(back);
    }
    return toolbar;
  }

  buildHeader(entity, kind) {
    const header = createElement('header', 'wiki-header');
    header.appendChild(createElement('p', 'wiki-kicker', kind === 'character' ? t('wiki.characterKicker') : t('wiki.kicker')));
    appendEntityName(header.appendChild(createElement('h1')), entity);

    const aliases = resolveAliases(entity) || [];
    if (aliases.length) header.appendChild(createElement('p', 'wiki-aliases', t('wiki.alsoKnownAs', { aliases: aliases.join(', ') })));

    const identity = createElement('div', 'wiki-identity');
    identity.appendChild(this.fact(t('wiki.fact.type'), kind === 'character' ? 'character' : entity.type));
    if (entity.subtip || entity.subtype) identity.appendChild(this.fact(t('wiki.fact.subtype'), entity.subtip || entity.subtype));
    if (entity.region) identity.appendChild(this.fact(t('wiki.fact.region'), String(entity.region).replace(/_/g, ' ')));
    identity.appendChild(this.confidenceBadge(entity.confidence || entity.canon || entity.canon_status || 'unknown'));
    header.appendChild(identity);

    // The Far Lands advisory moved here from the compact panel: it qualifies the
    // whole record, so it belongs with the record, not with a map pin.
    if (entity.region === 'far_lands') {
      const advisory = createElement('div', 'wiki-advisory');
      advisory.appendChild(createElement('strong', '', t('info.poorlyChartedTitle')));
      advisory.appendChild(createElement('p', '', t('info.poorlyChartedText', { canonStatus: entity.canon_status || 'inferred' })
        .replace(/<[^>]+>/g, '')));
      header.appendChild(advisory);
    }
    return header;
  }

  characterDetailsSection(entity) {
    const box = createElement('div', 'wiki-relations');
    const confidence = entity.confidence || entity.canon || entity.canon_status || 'unknown';
    const addText = (label, value, valueConfidence = confidence, sources = null) => {
      if (value === undefined || value === null || value === '') return;
      const row = createElement('div', 'wiki-relation-row');
      row.appendChild(createElement('strong', '', `${label}: `));
      row.append(String(value), ' ');
      row.appendChild(this.confidenceBadge(valueConfidence));
      const cite = createSourceCite(sources);
      if (cite) row.appendChild(cite);
      box.appendChild(row);
    };
    /** Several sourced readings of the same field, kept apart instead of merged. */
    const addClaim = (label, claim, claimConfidence = confidence) => {
      const variants = collectClaimVariants(claim);
      if (!variants.length) return;
      if (variants.length === 1) {
        addText(label, variants[0].text, claim?.confidence || claimConfidence, variants[0].sources);
        return;
      }
      const row = createElement('div', 'wiki-relation-row');
      row.appendChild(createElement('strong', '', `${label}: `));
      row.appendChild(this.confidenceBadge(claim?.confidence || claimConfidence));
      row.appendChild(createElement('div', 'claim-variants-note', t('source.variants')));
      const list = createElement('ul', 'claim-variants');
      variants.forEach(variant => {
        const item = createElement('li', 'claim-variant');
        item.appendChild(createElement('span', 'claim-variant-text', variant.text));
        const cite = createSourceCite(variant.sources);
        if (cite) item.appendChild(cite);
        list.appendChild(item);
      });
      row.appendChild(list);
      box.appendChild(row);
    };
    const addLink = (label, id) => {
      if (!id) return;
      const row = createElement('div', 'wiki-relation-row');
      row.append(createElement('strong', '', `${label}: `), this.linkToEntity(id), ' ');
      row.appendChild(this.confidenceBadge(confidence));
      box.appendChild(row);
    };
    addText(t('wiki.fact.currentTitle'), entity.titlu_curent);
    const titlesList = Array.isArray(entity.titles) && entity.titles.length
      ? entity.titles
      : (entity._afirmatii_pe_predicat?.titlu || entity._afirmatii_pe_predicat?.title);
    if (Array.isArray(titlesList) && titlesList.length) {
      const formattedTitles = titlesList.map(t => typeof t === 'object' ? (t.titlu || t.valoare || t.name || JSON.stringify(t)) : t).join(' · ');
      const titleConf = typeof titlesList[0] === 'object' && titlesList[0]?.confidence ? (titlesList[0].confidence === 'confirmed' ? 'canon' : titlesList[0].confidence) : confidence;
      addText(t('wiki.fact.titles'), formattedTitles, titleConf, dedupeSources(titlesList.flatMap(title => collectSources(title))));
    }
    addLink(t('wiki.fact.memberOf'), entity.membru_al || entity.house);
    // `born` is an array on 2204 of the 2288 character records — empty on all but
    // 14, and holding prose rather than a year on those. Only the 24 integers are
    // dates. The old null-check let the rest through and rendered a bare " AC",
    // which made an otherwise empty section look as though it had a fact in it.
    const year = value => (typeof value === 'number' && Number.isFinite(value) ? formatYear(value) : null);
    addText(t('wiki.fact.born'), year(entity.born));
    addText(t('wiki.fact.died'), year(entity.died));
    addLink(t('wiki.fact.associatedLocation'), entity.locatie_asociata);
    addClaim(t('wiki.fact.death'), entity.moarte, confidence);
    return box;
  }

  fact(label, value) {
    const item = createElement('span', 'wiki-fact');
    item.append(createElement('strong', '', `${label}: `), document.createTextNode(String(value)));
    return item;
  }

  descriptionSection(entity) {
    const box = createElement('div');
    const physical = entity.descriere_fizica;
    // `narratorText` used to be a section of its own in the compact panel and was
    // shadowed here by `||`; both texts exist on some records and both are shown.
    // L3. `descriere_fizica` alone is 488 locations and 105.583 characters of
    // Romanian extracted from the books; it is marked, never translated and
    // never withheld from the English interface (§5.1).
    [entity.description || entity.descriere, entity.narratorText]
      .filter(Boolean)
      .forEach(text => this.appendFragment(box, text));
    if (Array.isArray(physical)) physical.forEach(text => this.appendFragment(box, text));
    else if (typeof physical === 'string') this.appendFragment(box, physical);
    // Only worth citing when there is a text to attribute.
    if (box.childNodes.length) {
      const source = this.sourceBlock(entity);
      if (source) box.appendChild(source);
    }
    return box;
  }

  /** A quoted fragment, tagged with its own language and badged when it differs. */
  appendFragment(box, text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const paragraph = createElement('p', 'wiki-description', text);
    markFragmentLanguage(paragraph, text);
    box.appendChild(paragraph);
    return paragraph;
  }

  relationsSection(entity) {
    const box = createElement('div', 'wiki-relations');
    const relations = entity.relatii || entity.relations || {};
    Object.entries(RELATION_LABELS).forEach(([key, label]) => {
      let rawList = relations[key] || entity[key] || entity._afirmatii_pe_predicat?.[key] || [];
      if (!Array.isArray(rawList) || !rawList.length) return;
      const row = createElement('div', 'wiki-relation-row');
      row.appendChild(createElement('strong', '', `${label}: `));
      rawList.forEach((item, index) => {
        if (index) row.append(', ');
        const id = typeof item === 'object' ? (item.id || item.valoare) : item;
        row.appendChild(this.linkToEntity(id));
      });
      box.appendChild(row);
      const source = this.sourceBlock(relations[`${key}_source`] || entity[`${key}_source`], entity);
      if (source) box.appendChild(source);
    });
    return box;
  }

  timelineSection(entity) {
    const timeline = entity.timeline || entity.ownership_history || entity.history || [];
    if (!Array.isArray(timeline) || !timeline.length) return createElement('div');
    const list = createElement('ol', 'wiki-timeline');
    [...timeline].sort((a, b) => (a.year ?? a.an ?? Infinity) - (b.year ?? b.an ?? Infinity)).forEach(entry => {
      const item = createElement('li');
      const heading = createElement('div', 'wiki-timeline-heading');
      const year = entry.year ?? entry.an ?? entry.an_aproximativ;
      if (year !== undefined && year !== null) heading.appendChild(createElement('strong', '', formatYear(year)));
      heading.appendChild(this.confidenceBadge(entry.confidence || entry.canon || 'unknown'));
      item.appendChild(heading);
      item.appendChild(createElement('div', '', entry.event || entry.eveniment || entry.description || t('wiki.recordedChange')));
      ['lord', 'leader', 'house', 'faction', 'location'].forEach(key => {
        if (!entry[key]) return;
        const detail = createElement('div', 'wiki-timeline-detail');
        detail.append(`${key.replace(/_/g, ' ')}: `);
        detail.appendChild(this.linkToEntity(entry[key]));
        item.appendChild(detail);
      });
      const source = this.sourceBlock(entry, entity);
      if (source) item.appendChild(source);
      list.appendChild(item);
    });
    return list;
  }

  eventsSection(entity) {
    const ids = new Set(entity.evenimente || entity.events || []);
    (this.data.events || []).forEach(event => {
      const people = [...(event.participanti || []), ...(event.participants || [])].map(p => p?.id || p?.valoare || p);
      if (event.locatie_id === entity.id || event.location === entity.id || people.includes(entity.id) || (event.factions || []).includes(entity.id)) ids.add(event.id);
    });
    if (!ids.size) return createElement('div');
    const list = createElement('ul', 'wiki-linked-list');
    ids.forEach(id => {
      const event = this.getEntity(id);
      if (!event) return;
      const item = createElement('li');
      item.appendChild(this.linkToEntity(event));
      const year = event.year ?? event.an_aproximativ;
      if (year !== undefined && year !== null) item.append(` (${formatYear(year)})`);

      const eventConf = event.confidence || event.canon || (event.nume_generat ? 'inferred' : 'canon');
      item.appendChild(document.createTextNode(' '));
      item.appendChild(this.confidenceBadge(eventConf === 'confirmed' ? 'canon' : eventConf === 'uncertain' ? 'inferred' : eventConf));

      if (event.nume_generat) item.appendChild(createElement('em', 'wiki-generated-name', t('wiki.generatedName')));
      const source = this.sourceBlock(event);
      if (source) item.appendChild(source);
      list.appendChild(item);
    });
    return list;
  }

  /**
   * Family for a character, participants for an event, members for anything else.
   *
   * The branch used to be chosen from `entity.type`, which is 'character' on no
   * character record and 'event' on no event record — both are assigned at load
   * or resolved by collection membership. The caller now passes the kind it
   * already resolved.
   */
  peopleSection(entity, kind = this.currentKind) {
    const box = createElement('div');
    if (kind === 'character') {
      Object.entries(FAMILY_LABELS).forEach(([key, label]) => {
        let rawList = entity[key] || entity._afirmatii_pe_predicat?.[key] || [];
        if (!Array.isArray(rawList) || !rawList.length) return;
        const row = createElement('div', 'wiki-relation-row');
        row.appendChild(createElement('strong', '', `${label}: `));

        let rowConfidence = key === 'possible_parent_of' ? 'inferred' : null;

        rawList.forEach((item, index) => {
          if (index) row.append(', ');
          const id = typeof item === 'object' ? (item.id || item.valoare) : item;
          if (typeof item === 'object' && item.confidence && !rowConfidence) {
            rowConfidence = item.confidence === 'confirmed' ? 'canon' : item.confidence === 'uncertain' ? 'inferred' : item.confidence;
          }
          row.appendChild(this.linkToEntity(id));
        });

        row.append(' ');
        row.appendChild(this.confidenceBadge(rowConfidence || entity.confidence || entity.canon || entity.canon_status || 'canon'));
        box.appendChild(row);
      });
      return box;
    }
    if (kind === 'event') {
      const rawParticipants = [...(entity.participanti || []), ...(entity.participants || [])];
      if (!rawParticipants.length) return box;

      // Deduplicate by normalized ID (strip HOUSE_/PERSON_ prefix, lowercase)
      const seenIds = new Set();
      const uniqueParticipants = [];
      // Process participanti first (objects with roles) so they win over bare strings
      rawParticipants.forEach(p => {
        const pid = typeof p === 'object' ? (p.id || p.valoare) : p;
        const key = pid ? stripEntityPrefix(pid) : null;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          uniqueParticipants.push(p);
        }
      });

      const list = createElement('ul', 'wiki-participants-list');
      uniqueParticipants.forEach(participant => {
        const id = participant?.id || participant?.valoare || participant;
        const role = participant?.rol || participant?.role || null;
        const entity2 = this.getEntity(id);
        const isHouse = (typeof id === 'string' && (id.startsWith('HOUSE_') || id.startsWith('house_'))) || entity2?.type === 'house';

        const item = createElement('li', isHouse ? 'wiki-participant-house' : 'wiki-participant-person');

        const iconSpan = createElement('span', 'wiki-participant-icon', isHouse ? '🛡️' : '👤');
        item.appendChild(iconSpan);

        const nameLink = this.linkToEntity(id);
        if (isHouse) nameLink.classList.add('wiki-house-link');
        item.appendChild(nameLink);

        if (role) {
          const roleSpan = createElement('span', 'wiki-participant-role', ` — ${role}`);
          item.appendChild(roleSpan);
        }
        if (participant?.confidence) {
          const pConf = participant.confidence === 'confirmed' ? 'canon' : participant.confidence === 'uncertain' ? 'inferred' : participant.confidence;
          item.append(' ');
          item.appendChild(this.confidenceBadge(pConf));
        }
        list.appendChild(item);
      });
      const locationId = entity.location || entity.locatie_id;
      if (locationId) {
        const location = createElement('div', 'wiki-relation-row');
        location.append(createElement('strong', '', t('wiki.locationLabel')), this.linkToEntity(locationId));
        box.appendChild(location);
      }
      box.appendChild(list);
      const source = this.sourceBlock(entity);
      if (source) box.appendChild(source);
      return box;
    }
    const related = (this.data.characters || []).filter(char => char.house === entity.id || char.membru_al === entity.id || char.locatie_asociata === entity.id || char.location === entity.id || (char.timeline || []).some(t => t.location === entity.id));
    if (!related.length) return box;
    const list = createElement('ul', 'wiki-linked-list');
    related.forEach(char => {
      const item = createElement('li'); item.appendChild(this.linkToEntity(char));
      const source = this.sourceBlock(char); if (source) item.appendChild(source);
      list.appendChild(item);
    });
    box.appendChild(list);
    return box;
  }

  /**
   * Houses connected to this record by overlordship, vassalage or shared region.
   * Moved here from the compact panel, which is now a summary and has no room for
   * a grid; the calculation is unchanged.
   */
  relatedHousesSection(entity) {
    const box = createElement('div');
    const manager = window.atlasDataManager;
    if (!manager) return box;

    const isHouse = entity.type === 'house';
    const metadata = entity.metadata || entity;
    const related = new Set();
    const year = window.atlasApp?.currentWorldState?.year ?? Infinity;

    if (isHouse) {
      // The overlord is whoever rules a seat that lists this house as a vassal;
      // the other names on that list are its peers.
      for (const location of manager.getAllLocations() || []) {
        if (!location.vassals?.includes(entity.id)) continue;
        const states = (location.timeline || []).filter(entry => entry.year <= year);
        const overlord = states.length ? states[states.length - 1].house : location.house;
        if (overlord && overlord !== entity.id) related.add(overlord);
        location.vassals.forEach(id => { if (id !== entity.id) related.add(id); });
      }
      (metadata.vassals || []).forEach(id => related.add(id));
    }
    (entity.vassals || []).forEach(id => related.add(id));
    if (entity.region) {
      (this.data.houses || []).forEach(house => {
        if (house.region === entity.region && house.id !== entity.id) related.add(house.id);
      });
    }
    if (!related.size) return box;

    const grid = createElement('div', 'wiki-house-grid');
    related.forEach(id => {
      const house = manager.getHouse(id);
      if (!house) return;
      const href = entityHref(house);
      const card = createElement(href ? 'a' : 'button', 'wiki-house-card', displayName(house));
      if (href) card.href = href; else card.type = 'button';
      card.style.borderLeftColor = getHouseColor(id);
      card.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
        event.preventDefault();
        if (!navigateToEntity(house)) this.open(house);
      });
      grid.appendChild(card);
    });
    if (grid.childNodes.length) box.appendChild(grid);
    return box;
  }

  /**
   * Nearest places and waterways. Empty — and therefore absent, with no anchor —
   * whenever the map scale is uncalibrated or the record has no position, which
   * is the honest answer rather than a row saying the distance is unavailable.
   * `milesPerUnit` is null in the catalog today, so this section is currently
   * empty for every entity; it exists so that calibrating the map turns it on.
   */
  proximitySection(entity) {
    const box = createElement('div');
    const manager = window.atlasDataManager;
    const renderer = window.atlasApp?.mapRenderer;
    const milesPerUnit = manager?.getWorldMilesPerUnit?.();
    if (!manager || !renderer || !milesPerUnit) return box;

    let origin = renderer.getLocationCoordinate(entity);
    if (!origin) {
      // Houses keep their seat under `metadata`; 152 of 229 have one and none has
      // a root-level `seat`, so the root-only lookup resolved to undefined.
      const seatId = entity.metadata?.seat || entity.seat || entity.city;
      const anchor = seatId ? manager.getMappableAnchor(seatId) : null;
      if (anchor) origin = renderer.getLocationCoordinate(anchor);
    }
    if (!origin || origin.x == null || origin.y == null) return box;

    const places = (manager.getAllLocations() || [])
      .filter(location => location.id !== entity.id && location.id !== entity.seat)
      .map(location => ({ location, point: renderer.getLocationCoordinate(location) }))
      .filter(item => item.point)
      .map(item => ({ location: item.location, miles: distanceBetween(origin, item.point) * milesPerUnit }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 5);

    if (places.length) {
      box.appendChild(createElement('h3', 'wiki-subheading', t('info.closestFortressesSettlements')));
      const list = createElement('ul', 'wiki-linked-list');
      places.forEach(item => {
        const row = createElement('li');
        row.appendChild(this.linkToEntity(item.location));
        row.append(` — ${Math.round(item.miles)} mi`);
        list.appendChild(row);
      });
      box.appendChild(list);
    }

    const rivers = manager.data?.calibratedRivers || [];
    if (rivers.length) {
      const nearest = rivers.map(river => {
        const paths = [river.path, ...(river.branches || []).map(branch => branch.path)].filter(Boolean);
        const closest = paths.flatMap(parsePathPoints)
          .reduce((best, point) => Math.min(best, distanceBetween(origin, point)), Infinity);
        return { name: river.name, miles: closest * milesPerUnit };
      }).filter(item => Number.isFinite(item.miles)).sort((a, b) => a.miles - b.miles).slice(0, 3);

      if (nearest.length) {
        box.appendChild(createElement('h3', 'wiki-subheading', t('info.closestRiversWaterways')));
        const list = createElement('ul', 'wiki-linked-list');
        nearest.forEach(item => list.appendChild(createElement('li', '', t('info.closestRiverItem', { name: item.name, miles: Math.round(item.miles) }))));
        box.appendChild(list);
      }
    }
    return box;
  }

  /**
   * The one place provenance is the subject rather than an annotation, so here it
   * stays open — grouped per book, which is the guarantee that collapsing the
   * inline citations hides nothing the reader cannot still reach.
   */
  sourcesSection(entity) {
    const box = createElement('div');
    const claimSources = [
      ...collectSources(entity),
      ...(Array.isArray(entity.titles) ? entity.titles : []).flatMap(title => collectSources(title)),
      ...Object.values(entity._afirmatii_pe_predicat || {})
        .flatMap(claims => (Array.isArray(claims) ? claims : [claims]))
        .flatMap(claim => collectSources(claim))
    ];
    const list = createSourceList(dedupeSources(claimSources));
    if (list) box.appendChild(list);
    return box;
  }
}
