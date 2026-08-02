import { createElement, formatYear, stripEntityPrefix } from '../utils/helpers.js';
import { matchesInternId } from '../utils/entities.js';
import { isCharacterEntity } from '../utils/entityKind.js';

const RELATION_LABELS = {
  ally_of: 'Allies', enemy_of: 'Enemies', vassal_of: 'Vassals', liege_of: 'Lieges'
};

const FAMILY_LABELS = {
  parinti: 'Parents', copii: 'Children', frati: 'Siblings', casatorit_cu: 'Spouses', possible_parent_of: 'Possible children'
};

/** Full, entity-focused wiki view.  It deliberately accepts both the current data
 * shape and the extended import shape, so importing more statements needs no UI rewrite. */
export class WikiPage {
  constructor() {
    this.currentEntity = null;
    this.previousEntity = null;
    this.host = null;
  }

  init() {
    this.host = createElement('div', 'wiki-page');
    this.host.setAttribute('aria-hidden', 'true');
    document.getElementById('app').appendChild(this.host);
  }

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

  linkToEntity(id, fallback = '') {
    const entity = this.getEntity(id);
    const link = createElement(entity ? 'button' : 'span', entity ? 'wiki-entity-link' : 'wiki-missing-reference', entity?.name || fallback || String(id));
    if (entity) link.addEventListener('click', () => this.open(entity));
    return link;
  }

  confidenceBadge(value) {
    const confidence = ['canon', 'inferred', 'unknown'].includes(value) ? value : 'unknown';
    const icon = { canon: '●', inferred: '◆', unknown: '?' }[confidence];
    const badge = createElement('span', `wiki-confidence ${confidence}`, `${icon} ${confidence}`);
    badge.title = { canon: 'Confirmed by canon', inferred: 'Inferred from sources', unknown: 'Uncertain or unknown' }[confidence];
    return badge;
  }

  sourceBlock(record, fallback) {
    const source = record?.source || record?.sursa || fallback?.source || fallback?.sursa;
    const book = record?.book || record?.carte || fallback?.book || fallback?.carte;
    const fragment = record?.source_fragment || record?.fragment || fallback?.source_fragment || fallback?.fragment;
    const page = record?.source_page || record?.page || fallback?.source_page || fallback?.page;
    if (!source && !book && !fragment && !page) return null;
    const line = createElement('div', 'wiki-source');
    const label = [book, fragment && `fragment: ${fragment}`, page && `p. ${page}`].filter(Boolean).join(' · ') || 'Source';
    line.appendChild(createElement('span', '', `Source: ${label}`));
    return line;
  }

  appendSection(title, build) {
    const content = build();
    if (!content || !content.childNodes.length) return;
    const section = createElement('section', 'wiki-section');
    section.appendChild(createElement('h2', '', title));
    section.appendChild(content);
    this.content.appendChild(section);
  }

  render() {
    const entity = this.currentEntity;
    const isCharacter = isCharacterEntity(entity, this.data.characters);
    if (isCharacter) {
      this.renderCharacterPage(entity);
      return;
    }
    this.host.innerHTML = '';
    const page = createElement('article', 'wiki-document');
    const toolbar = createElement('div', 'wiki-toolbar');
    const close = createElement('button', 'wiki-close', '× Close wiki');
    close.addEventListener('click', () => this.close());
    toolbar.appendChild(close);
    if (this.previousEntity) {
      const back = createElement('button', 'wiki-back', '← Back');
      back.addEventListener('click', () => this.open(this.previousEntity, { fromCompact: true }));
      toolbar.appendChild(back);
    }
    page.appendChild(toolbar);

    const header = createElement('header', 'wiki-header');
    header.appendChild(createElement('p', 'wiki-kicker', 'Atlas of Westeros · Wiki'));
    header.appendChild(createElement('h1', '', entity.name || entity.id));
    const aliases = entity.aliasuri || entity.aliases || [];
    if (aliases.length) header.appendChild(createElement('p', 'wiki-aliases', `Also known as: ${aliases.join(', ')}`));
    const identity = createElement('div', 'wiki-identity');
    identity.appendChild(this.fact('Type', entity.type));
    if (entity.subtip || entity.subtype) identity.appendChild(this.fact('Subtype', entity.subtip || entity.subtype));
    if (entity.region) identity.appendChild(this.fact('Region', entity.region.replace(/_/g, ' ')));
    identity.appendChild(this.confidenceBadge(entity.confidence || entity.canon || entity.canon_status || 'unknown'));
    header.appendChild(identity);
    page.appendChild(header);
    this.content = createElement('div', 'wiki-content');
    page.appendChild(this.content);

    this.appendSection('Description', () => this.descriptionSection(entity));
    this.appendSection('Relations', () => this.relationsSection(entity));
    this.appendSection('Chronology', () => this.timelineSection(entity));
    this.appendSection('Associated events', () => this.eventsSection(entity));
    this.appendSection(entity.type === 'character' ? 'Family relations' : entity.type === 'event' ? 'Participants' : 'Associated characters', () => this.peopleSection(entity));
    this.appendSection('Sources', () => this.sourcesSection(entity));
    this.host.appendChild(page);
  }

  renderCharacterPage(entity) {
    this.host.innerHTML = '';
    const page = createElement('article', 'wiki-document');
    const toolbar = createElement('div', 'wiki-toolbar');
    const close = createElement('button', 'wiki-close', '× Close wiki');
    close.addEventListener('click', () => this.close());
    toolbar.appendChild(close);
    if (this.previousEntity) {
      const back = createElement('button', 'wiki-back', '← Back');
      back.addEventListener('click', () => this.open(this.previousEntity, { fromCompact: true }));
      toolbar.appendChild(back);
    }
    page.appendChild(toolbar);

    const header = createElement('header', 'wiki-header');
    header.appendChild(createElement('p', 'wiki-kicker', 'Atlas of Westeros · Character'));
    header.appendChild(createElement('h1', '', entity.name || entity.id));
    const identity = createElement('div', 'wiki-identity');
    identity.appendChild(this.fact('Type', 'character'));
    identity.appendChild(this.confidenceBadge(entity.confidence || entity.canon || entity.canon_status || 'unknown'));
    header.appendChild(identity);
    page.appendChild(header);
    this.content = createElement('div', 'wiki-content');
    page.appendChild(this.content);

    this.appendSection('Biography', () => this.descriptionSection(entity));
    this.appendSection('Character details', () => this.characterDetailsSection(entity));
    this.appendSection('Family relations', () => this.peopleSection(entity));
    this.appendSection('Chronology', () => this.timelineSection(entity));
    this.appendSection('Associated events', () => this.eventsSection(entity));
    this.appendSection('Sources', () => this.sourcesSection(entity));
    this.host.appendChild(page);
  }

  characterDetailsSection(entity) {
    const box = createElement('div', 'wiki-relations');
    const confidence = entity.confidence || entity.canon || entity.canon_status || 'unknown';
    const addText = (label, value, valueConfidence = confidence) => {
      if (value === undefined || value === null || value === '') return;
      const row = createElement('div', 'wiki-relation-row');
      row.appendChild(createElement('strong', '', `${label}: `));
      row.append(String(value), ' ');
      row.appendChild(this.confidenceBadge(valueConfidence));
      box.appendChild(row);
    };
    const addLink = (label, id) => {
      if (!id) return;
      const row = createElement('div', 'wiki-relation-row');
      row.append(createElement('strong', '', `${label}: `), this.linkToEntity(id), ' ');
      row.appendChild(this.confidenceBadge(confidence));
      box.appendChild(row);
    };
    addText('Current title', entity.titlu_curent);
    const titlesList = Array.isArray(entity.titles) && entity.titles.length
      ? entity.titles
      : (entity._afirmatii_pe_predicat?.titlu || entity._afirmatii_pe_predicat?.title);
    if (Array.isArray(titlesList) && titlesList.length) {
      const formattedTitles = titlesList.map(t => typeof t === 'object' ? (t.titlu || t.valoare || t.name || JSON.stringify(t)) : t).join(' · ');
      const titleConf = typeof titlesList[0] === 'object' && titlesList[0]?.confidence ? (titlesList[0].confidence === 'confirmed' ? 'canon' : titlesList[0].confidence) : confidence;
      addText('Titles', formattedTitles, titleConf);
    }
    addLink('Member of', entity.membru_al || entity.house);
    addText('Born', entity.born !== undefined && entity.born !== null ? formatYear(entity.born) : null);
    addText('Died', entity.died !== undefined && entity.died !== null ? formatYear(entity.died) : null);
    addLink('Associated location', entity.locatie_asociata);
    addText('Death', entity.moarte?.descriere, entity.moarte?.confidence || confidence);
    return box;
  }

  fact(label, value) {
    const item = createElement('span', 'wiki-fact');
    item.append(createElement('strong', '', `${label}: `), document.createTextNode(String(value)));
    return item;
  }

  descriptionSection(entity) {
    const box = createElement('div');
    const description = entity.description || entity.descriere || entity.narratorText;
    const physical = entity.descriere_fizica;
    if (description) box.appendChild(createElement('p', 'wiki-description', description));
    if (Array.isArray(physical)) physical.forEach(text => box.appendChild(createElement('p', 'wiki-description', text)));
    const source = this.sourceBlock(entity);
    if (source) box.appendChild(source);
    return box;
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
      item.appendChild(createElement('div', '', entry.event || entry.eveniment || entry.description || 'Recorded change of state.'));
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

      if (event.nume_generat) item.appendChild(createElement('em', 'wiki-generated-name', ' ⓘ generated name'));
      const source = this.sourceBlock(event);
      if (source) item.appendChild(source);
      list.appendChild(item);
    });
    return list;
  }

  peopleSection(entity) {
    const box = createElement('div');
    if (entity.type === 'character') {
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
    if (entity.type === 'event') {
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
        location.append(createElement('strong', '', 'Location: '), this.linkToEntity(locationId));
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

  sourcesSection(entity) {
    const box = createElement('div');
    const sources = entity.sources || entity.surse || [];
    (Array.isArray(sources) ? sources : [sources]).forEach(source => {
      const item = this.sourceBlock(typeof source === 'string' ? { source } : source, entity);
      if (item) box.appendChild(item);
    });
    const root = this.sourceBlock(entity);
    if (root) box.appendChild(root);
    return box;
  }
}
