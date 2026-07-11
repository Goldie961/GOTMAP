import { createElement, formatYear } from '../utils/helpers.js';
import { getHouseColor } from '../utils/colors.js';

export class InfoPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  init() {
    this.container.className = 'info-panel';
  }

  open(location, worldState) {
    this.container.innerHTML = ''; // Clear panel

    // Close button
    const closeBtn = createElement('button', 'info-panel-close', '×');
    closeBtn.addEventListener('click', () => this.close());
    this.container.appendChild(closeBtn);

    // Resolve ruling house at current year
    let houseId = 'unknown';
    let lordName = 'Unknown Lord';
    let statusVal = 'Intact';
    let canonVal = location.canon || 'canon';

    if (location.timeline) {
      const stateMatches = location.timeline.filter(t => t.year <= worldState.year);
      if (stateMatches.length > 0) {
        const activeState = stateMatches[stateMatches.length - 1];
        houseId = activeState.house;
        lordName = activeState.lord || lordName;
        statusVal = activeState.status || statusVal;
        canonVal = activeState.canon || canonVal;
      }
    }

    if (location.house) {
      houseId = location.house;
    }

    // Load House details
    let house = null;
    if (window.atlasDataManager) {
      house = window.atlasDataManager.getHouse(houseId);
      if (house && house.timeline) {
        const houseMatches = house.timeline.filter(t => t.year <= worldState.year);
        if (houseMatches.length > 0) {
          lordName = houseMatches[houseMatches.length - 1].lord || lordName;
        }
      }
    }

    const houseColor = getHouseColor(houseId);

    // House Banner color stripe
    const bannerStripe = createElement('div', 'house-banner-stripe');
    bannerStripe.style.backgroundColor = houseColor;
    this.container.appendChild(bannerStripe);

    // 1. Ornate Header
    const header = createElement('div', 'info-panel-header');
    const title = createElement('h2', 'heading-secondary', location.name);
    header.appendChild(title);

    if (house) {
      // Sigil details
      const sigilBox = createElement('div', 'house-sigil-display');
      sigilBox.style.borderColor = houseColor;
      
      const sigilImg = createElement('span');
      sigilImg.style.fontSize = '2rem';
      
      // Select sigil emoji based on house
      let emoji = '🛡';
      if (houseId === 'stark') emoji = '🐺';
      if (houseId === 'targaryen') emoji = '🐉';
      if (houseId === 'lannister') emoji = '🦁';
      if (houseId === 'baratheon') emoji = '🦌';
      if (houseId === 'tyrell') emoji = '🌹';
      if (houseId === 'tully') emoji = '🐟';
      if (houseId === 'arryn') emoji = '🦅';
      if (houseId === 'greyjoy') emoji = '🦑';
      if (houseId === 'martell') emoji = '☀️';
      if (houseId === 'bolton') emoji = '💀';
      if (houseId === 'mormont') emoji = '🐻';
      if (houseId === 'hightower') emoji = '🕯';
      if (houseId === 'velaryon') emoji = '🐚';
      if (houseId === 'nights_watch') emoji = '🐦';
      
      sigilImg.textContent = emoji;
      sigilBox.appendChild(sigilImg);
      header.appendChild(sigilBox);

      // House Name
      const houseLabel = createElement('div', 'label', house.name);
      header.appendChild(houseLabel);

      // Words
      if (house.words) {
        const words = createElement('div', 'house-words', `"${house.words}"`);
        header.appendChild(words);
      }
    }
    this.container.appendChild(header);

    // 2. Main Content
    const content = createElement('div', 'info-panel-content');

    // Basic Meta Details
    const metaSection = createElement('div', 'info-section');
    metaSection.appendChild(this.createMetaRow("Region", this.formatRegionName(location.region)));
    metaSection.appendChild(this.createMetaRow("Ruling Lord", lordName));
    metaSection.appendChild(this.createMetaRow("Status", this.formatStatus(statusVal)));
    
    // Canon Confidence Badge
    const canonRow = createElement('div', 'info-row');
    const canonLabel = createElement('span', 'info-label', "Canon Confidence");
    const badge = createElement('span', `canon-badge ${canonVal}`, canonVal);
    
    let tooltip = "🔵 Verified canon information from text.";
    if (canonVal === 'inferred') tooltip = "🟡 Derived from logical context and map layouts.";
    if (canonVal === 'unknown') tooltip = "🔴 Speculative placement/details.";
    badge.title = tooltip;
    
    canonRow.appendChild(canonLabel);
    canonRow.appendChild(badge);
    metaSection.appendChild(canonRow);

    content.appendChild(metaSection);

    // Description text
    const descSection = createElement('div', 'info-section');
    const descTitle = createElement('h3', 'label', "Chronicle Description");
    const descText = createElement('p', 'body-text chronicle-text', location.description);
    descSection.appendChild(descTitle);
    descSection.appendChild(descText);
    content.appendChild(descSection);

    // Lore details
    if (location.narratorText) {
      const loreSection = createElement('div', 'info-section');
      const loreTitle = createElement('h3', 'label', "Historical Atlas Records");
      const loreText = createElement('p', 'body-text-small', location.narratorText);
      loreText.style.textAlign = 'justify';
      loreSection.appendChild(loreTitle);
      loreSection.appendChild(loreText);
      content.appendChild(loreSection);
    }

    // Location Events Timeline
    if (location.timeline && location.timeline.length > 0) {
      const tlSection = createElement('div', 'info-section');
      const tlTitle = createElement('h3', 'label', "Castle Chronology");
      tlSection.appendChild(tlTitle);

      const list = createElement('div', 'timeline-list');
      // Sort oldest to newest
      const sortedTimeline = [...location.timeline].sort((a,b) => a.year - b.year);
      sortedTimeline.forEach(entry => {
        const item = createElement('div', 'timeline-entry');
        if (entry.year === worldState.year) {
          item.classList.add('active');
        }
        
        const year = createElement('div', 'timeline-entry-year', formatYear(entry.year));
        const details = createElement('div', 'timeline-entry-event', entry.event || `${location.name} undergoes structural/political shifts.`);
        
        item.appendChild(year);
        item.appendChild(details);
        list.appendChild(item);
      });
      tlSection.appendChild(list);
      content.appendChild(tlSection);
    }

    // Characters at Location
    if (window.atlasDataManager) {
      const characters = window.atlasDataManager.data.characters;
      if (characters) {
        const localChars = characters.filter(char => {
          if (!char.timeline) return false;
          const matches = char.timeline.filter(t => t.year <= worldState.year);
          if (matches.length > 0) {
            const active = matches[matches.length - 1];
            return active.location === location.id;
          }
          return false;
        });

        if (localChars.length > 0) {
          const charSection = createElement('div', 'info-section');
          const charTitle = createElement('h3', 'label', "Notable Residents");
          charSection.appendChild(charTitle);

          localChars.forEach(char => {
            const row = createElement('div', 'info-row');
            row.style.fontSize = '0.9rem';
            row.innerHTML = `<span style="font-weight:bold; color:var(--ink-light);">⚔ ${char.name}</span> <span style="font-style:italic; color:var(--gold-dark);">${char.titles[0] || 'Noble'}</span>`;
            charSection.appendChild(row);
          });
          content.appendChild(charSection);
        }
      }
    }

    // Vassals
    if (location.vassals && location.vassals.length > 0 && window.atlasDataManager) {
      const vassalSection = createElement('div', 'info-section');
      const vassalTitle = createElement('h3', 'label', "Key Sworn Vassals");
      vassalSection.appendChild(vassalTitle);

      const vassalGrid = createElement('div');
      vassalGrid.style.display = 'grid';
      vassalGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      vassalGrid.style.gap = '0.4rem';
      vassalGrid.style.marginTop = '0.5rem';

      location.vassals.forEach(vId => {
        const vHouse = window.atlasDataManager.getHouse(vId);
        if (vHouse) {
          const card = createElement('div');
          card.style.background = 'rgba(44, 24, 16, 0.04)';
          card.style.border = '1px solid var(--parchment-dark)';
          card.style.padding = '0.4rem';
          card.style.borderRadius = '3px';
          card.style.fontSize = '0.85rem';
          card.style.textAlign = 'center';
          card.style.cursor = 'pointer';
          card.style.borderLeft = `3px solid ${getHouseColor(vId)}`;
          card.textContent = vHouse.name;
          
          card.addEventListener('click', () => {
            // Find seat coordinates if available
            if (vHouse.seat) {
              const seat = window.atlasDataManager.getCastle(vHouse.seat);
              if (seat) {
                document.dispatchEvent(new CustomEvent('locationSelected', { detail: { locationId: seat.id } }));
              }
            }
          });

          vassalGrid.appendChild(card);
        }
      });
      vassalSection.appendChild(vassalGrid);
      content.appendChild(vassalSection);
    }

    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  close() {
    this.container.classList.remove('open');
    document.dispatchEvent(new CustomEvent('locationDeselected'));
  }

  createMetaRow(labelVal, valueVal) {
    const row = createElement('div', 'info-row');
    const label = createElement('span', 'info-label', labelVal);
    const value = createElement('span', '', valueVal);
    row.appendChild(label);
    row.appendChild(value);
    return row;
  }

  formatRegionName(regionId) {
    return regionId.replace(/_/g, ' ').toUpperCase();
  }

  formatStatus(status) {
    return status.replace(/_/g, ' ').toUpperCase();
  }
}
