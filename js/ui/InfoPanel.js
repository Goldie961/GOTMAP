import { createElement, formatYear } from '../utils/helpers.js';
import { getHouseColor, HOUSE_COLORS } from '../utils/colors.js';

function getHouseSigilSVG(houseId, primaryColor, secondaryColor) {
  let innerPaths = '';
  
  if (houseId === 'stark') {
    // Direwolf profile snarling
    innerPaths = `<path d="M 25,65 L 35,55 L 42,50 C 47,40 52,28 66,24 C 69,22 72,13 70,8 C 66,11 60,17 55,20 C 45,24 35,23 28,28 C 24,31 22,36 22,40 C 22,44 15,48 10,50 C 16,54 18,62 20,66 C 22,70 26,76 32,80 L 40,83 L 55,78 L 45,70 L 35,68 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <circle cx="48" cy="28" r="1.5" fill="${secondaryColor}"/>`;
  } else if (houseId === 'targaryen') {
    // 3-headed dragon
    innerPaths = `<circle cx="50" cy="50" r="14" fill="none" stroke="${primaryColor}" stroke-width="1"/>
                  <path d="M 50,20 C 40,20 30,30 30,45 C 30,55 35,60 40,65 C 43,62 45,55 45,48 C 45,35 50,30 55,30 M 50,20 C 60,20 70,30 70,45 C 70,55 65,60 60,65 C 57,62 55,55 55,48" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round"/>
                  <path d="M 46,28 C 44,22 41,20 38,20 M 54,28 C 56,22 59,20 62,20 M 50,38 C 50,30 50,24 50,21" fill="none" stroke="${primaryColor}" stroke-width="1.8"/>
                  <path d="M 32,45 C 22,50 20,60 25,72 M 68,45 C 78,50 80,60 75,72" fill="none" stroke="${primaryColor}" stroke-width="1.5" stroke-linecap="round"/>
                  <path d="M 42,68 C 45,78 50,85 50,88 C 50,85 55,78 58,68" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round"/>`;
  } else if (houseId === 'lannister') {
    // Lion rampant golden
    innerPaths = `<path d="M 35,78 C 38,70 38,62 42,56 C 45,50 40,46 38,40 C 36,32 45,22 55,22 C 62,22 68,28 66,38 C 65,44 58,46 58,52 L 68,54 L 75,48 L 78,54 L 68,60 C 66,66 70,72 68,78 C 66,80 50,82 48,78 C 48,72 52,68 50,62 L 42,64 L 40,78 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <circle cx="60" cy="30" r="1.5" fill="${secondaryColor}"/>`;
  } else if (houseId === 'baratheon') {
    // Crowned stag rampant
    innerPaths = `<path d="M 45,78 L 48,68 C 52,64 54,58 50,50 C 46,42 50,34 56,34 C 62,34 66,40 64,48 L 72,50 L 76,44 L 72,58 C 70,64 74,70 70,78 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 52,34 Q 48,22 45,18 M 52,30 Q 44,26 40,24 M 58,34 Q 62,22 65,18 M 58,30 Q 66,26 70,24" stroke="${secondaryColor}" stroke-width="1.2" fill="none"/>
                  <path d="M 48,46 Q 55,42 62,46" stroke="${secondaryColor}" stroke-width="1.5" fill="none"/>`;
  } else if (houseId === 'tyrell') {
    // Rose gold/green
    innerPaths = `<circle cx="50" cy="50" r="22" fill="none" stroke="${primaryColor}" stroke-width="2"/>
                  <path d="M 50,28 C 42,28 36,36 36,44 C 36,52 44,56 50,56 C 56,56 64,52 64,44 C 64,36 58,28 50,28 Z" fill="none" stroke="${primaryColor}" stroke-width="1.5"/>
                  <circle cx="50" cy="44" r="7" fill="none" stroke="${primaryColor}" stroke-width="1.5"/>
                  <path d="M 38,62 L 28,68 M 62,62 L 72,68 M 50,72 L 50,82" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round"/>`;
  } else if (houseId === 'tully') {
    // Leaping silver trout
    innerPaths = `<path d="M 18,50 Q 30,35 50,38 C 65,40 76,46 84,48 C 76,54 62,56 50,54 Q 30,52 18,50 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 84,48 L 90,42 L 87,50 L 92,54 L 84,50 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.2"/>
                  <path d="M 32,40 Q 36,44 42,42 M 50,42 Q 54,46 60,44" stroke="${secondaryColor}" stroke-width="1" fill="none"/>
                  <circle cx="28" cy="47" r="1" fill="${secondaryColor}"/>`;
  } else if (houseId === 'arryn') {
    // Falcon and moon
    innerPaths = `<circle cx="50" cy="50" r="24" fill="none" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 34,34 A 20,20 0 1,0 66,66 A 23,23 0 1,1 34,34" fill="${secondaryColor}" opacity="0.8"/>
                  <path d="M 35,50 Q 50,35 68,48 Q 50,55 35,50 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 45,46 L 40,40 L 45,44 L 42,38 L 48,45 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.2"/>`;
  } else if (houseId === 'greyjoy') {
    // Golden kraken
    innerPaths = `<path d="M 50,22 Q 44,28 44,38 C 44,44 47,48 50,48 C 53,48 56,44 56,38 C 56,28 50,22 50,22 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 44,38 Q 30,42 22,60 M 46,42 Q 38,48 30,75 M 54,42 Q 62,48 70,75 M 56,38 Q 70,42 78,60" stroke="${primaryColor}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                  <path d="M 48,46 L 45,82 M 52,46 L 55,82" stroke="${primaryColor}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  } else if (houseId === 'martell') {
    // Sun pierced by spear
    innerPaths = `<circle cx="50" cy="50" r="14" fill="${primaryColor}"/>
                  <path d="M 50,15 L 50,85 M 15,50 L 85,50 M 25,25 L 75,75 M 25,75 L 75,25" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round"/>
                  <path d="M 22,22 L 78,78" stroke="${secondaryColor}" stroke-width="1.5" stroke-linecap="round"/>
                  <polygon points="74,74 85,85 78,72" fill="${secondaryColor}"/>`;
  } else if (houseId === 'bolton') {
    // Flayed man on X-cross
    innerPaths = `<path d="M 20,20 L 80,80 M 20,80 L 80,20" stroke="${primaryColor}" stroke-width="4" stroke-linecap="round"/>
                  <path d="M 42,32 C 42,26 58,26 58,32 C 58,38 52,42 50,48 C 48,42 42,38 42,32 Z" fill="${secondaryColor}" stroke="${primaryColor}" stroke-width="1"/>
                  <path d="M 50,48 L 50,75 M 50,52 L 32,38 M 50,52 L 68,38 M 50,68 L 32,82 M 50,68 L 68,82" stroke="${secondaryColor}" stroke-width="2" stroke-linecap="round"/>`;
  } else if (houseId === 'nights_watch') {
    // Black crow in flight
    innerPaths = `<path d="M 15,42 C 30,42 42,32 50,48 C 58,32 70,42 85,42 C 72,50 62,50 50,56 C 38,50 28,50 15,42 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 50,48 L 50,68 L 46,74 L 50,70 L 54,74 L 50,68 Z M 48,50 L 52,50" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.2"/>`;
  } else if (houseId === 'hightower') {
    // Lighthouse high tower
    innerPaths = `<path d="M 38,78 L 44,48 L 56,48 L 62,78 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 44,48 L 46,28 L 54,28 L 56,48 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.2"/>
                  <circle cx="50" cy="20" r="4" fill="#FFF58B"/>
                  <path d="M 42,20 L 30,16 M 58,20 L 70,16 M 50,12 L 50,4" stroke="#FFF58B" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (houseId === 'velaryon') {
    // Silver Seahorse
    innerPaths = `<path d="M 45,72 C 40,68 38,56 42,48 C 44,42 40,36 44,30 C 46,24 54,22 58,28 C 60,34 54,38 52,42 C 50,46 54,54 52,62 C 50,68 56,72 50,78 Q 45,82 38,75 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1.5"/>
                  <path d="M 38,75 Q 32,70 30,74" stroke="${secondaryColor}" stroke-width="1.2" fill="none"/>`;
  } else {
    // General heraldic shield with cross divisions
    innerPaths = `<path d="M 30,25 L 70,25 L 70,55 C 70,70 50,82 50,82 C 50,82 30,70 30,55 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="2"/>
                  <path d="M 50,25 L 50,82 M 30,50 L 70,50" stroke="${secondaryColor}" stroke-width="1.5"/>`;
  }
  
  return `<svg viewBox="0 0 100 100" style="width: 100%; height: 100%; display: block;">${innerPaths}</svg>`;
}

export class InfoPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  init() {
    this.container.className = 'info-panel';
  }

  open(location, worldState) {
    this.container.innerHTML = ''; // Clear panel
    if (window.atlasApp && window.atlasApp.audioManager) {
      window.atlasApp.audioManager.playWood();
    }

    // Close button
    const closeBtn = createElement('button', 'info-panel-close', '×');
    closeBtn.addEventListener('click', () => this.close());
    this.container.appendChild(closeBtn);

    // Resolve ruling house at current year
    let houseId = 'unknown';
    let lordName = 'Unknown Lord';
    let statusVal = 'Intact';
    let locationCanon = location.canon || 'canon';

    let lordConfidence = 'inferred';
    let statusConfidence = 'inferred';
    let regionConfidence = 'canon';

    if (location.timeline) {
      const stateMatches = location.timeline.filter(t => t.year <= worldState.year);
      if (stateMatches.length > 0) {
        const activeState = stateMatches[stateMatches.length - 1];
        houseId = activeState.house;
        lordName = activeState.lord || lordName;
        statusVal = activeState.status || statusVal;
        locationCanon = activeState.canon || locationCanon;
        lordConfidence = activeState.lord_canon || 'inferred';
        statusConfidence = activeState.status_canon || 'inferred';
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
          lordConfidence = houseMatches[houseMatches.length - 1].lord_canon || 'canon';
        }
      }
    }

    const houseColor = getHouseColor(houseId);
    const secondaryColor = (HOUSE_COLORS[houseId] && HOUSE_COLORS[houseId].secondary) ? HOUSE_COLORS[houseId].secondary : '#8B7340';

    // House Banner color stripe
    const bannerStripe = createElement('div', 'house-banner-stripe');
    bannerStripe.style.backgroundColor = houseColor;
    this.container.appendChild(bannerStripe);

    // ── 1. ORNATE HEADER ──
    const header = createElement('div', 'info-panel-header');
    
    // Castle Name Header with clean canon status tag
    const titleContainer = createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.justifyContent = 'center';
    titleContainer.style.gap = '0.5rem';
    titleContainer.style.marginBottom = '0.5rem';
    
    const title = createElement('h2', 'heading-secondary', location.name);
    title.style.margin = '0';
    
    const locationBadge = createElement('span', `canon-badge ${locationCanon}`, locationCanon === 'canon' ? '🟢' : locationCanon === 'inferred' ? '🟡' : '🔴');
    locationBadge.title = `Castle Placement: ${locationCanon.toUpperCase()}`;
    
    titleContainer.appendChild(title);
    titleContainer.appendChild(locationBadge);
    header.appendChild(titleContainer);

    if (house) {
      // Large Vector Sigil Box
      const sigilBox = createElement('div', 'house-sigil-display');
      sigilBox.style.borderColor = houseColor;
      sigilBox.style.width = '90px';
      sigilBox.style.height = '90px';
      sigilBox.style.borderRadius = '50%';
      sigilBox.style.overflow = 'hidden';
      sigilBox.style.margin = '1rem auto 0.5rem';
      sigilBox.style.backgroundColor = 'rgba(255, 248, 231, 0.9)';
      
      sigilBox.innerHTML = getHouseSigilSVG(houseId, houseColor, secondaryColor);
      header.appendChild(sigilBox);

      // House Name
      const houseLabel = createElement('div', 'label', house.name);
      houseLabel.style.fontSize = '0.85rem';
      houseLabel.style.marginTop = '0.4rem';
      header.appendChild(houseLabel);

      // House Motto
      if (house.words) {
        const words = createElement('div', 'house-words', `"${house.words}"`);
        words.style.fontFamily = 'Cormorant Garamond, serif';
        words.style.fontStyle = 'italic';
        words.style.fontSize = '1.15rem';
        words.style.color = 'var(--gold-dark)';
        header.appendChild(words);
      }
    }
    this.container.appendChild(header);

    // Divider
    this.container.appendChild(this.createDivider());

    // ── 2. MAIN CONTENT ──
    const content = createElement('div', 'info-panel-content');

    // Ornate Meta details with individual confidence badges
    const metaSection = createElement('div', 'info-section');
    metaSection.appendChild(this.createMetaRowWithBadge("Ruling Lord", lordName, lordConfidence));
    metaSection.appendChild(this.createMetaRowWithBadge("Region", this.formatRegionName(location.region), regionConfidence));
    metaSection.appendChild(this.createMetaRowWithBadge("Status", this.formatStatus(statusVal), statusConfidence));
    
    // Combined Canon Summary Row
    const canonSummaryRow = createElement('div', 'info-row');
    canonSummaryRow.style.padding = '0.4rem 0';
    canonSummaryRow.style.fontSize = '0.8rem';
    canonSummaryRow.style.color = 'var(--ink-light)';
    canonSummaryRow.style.fontStyle = 'italic';
    
    let summaryText = "🟢 Verified canon history.";
    if (locationCanon === 'inferred' || lordConfidence === 'inferred') {
      summaryText = "🟡 Some details inferred from chronicles.";
    } else if (locationCanon === 'unknown') {
      summaryText = "🔴 Speculative reconstruction.";
    }
    canonSummaryRow.textContent = summaryText;
    metaSection.appendChild(canonSummaryRow);

    content.appendChild(metaSection);
    content.appendChild(this.createDivider());

    // Description text
    const descSection = createElement('div', 'info-section');
    const descTitle = createElement('h3', 'label', "Chronicle Record");
    descTitle.style.marginBottom = '0.4rem';
    const descText = createElement('p', 'body-text chronicle-text', location.description);
    descSection.appendChild(descTitle);
    descSection.appendChild(descText);
    content.appendChild(descSection);

    // Lore details
    if (location.narratorText) {
      content.appendChild(this.createDivider());
      const loreSection = createElement('div', 'info-section');
      const loreTitle = createElement('h3', 'label', "Historical Ledger");
      const loreText = createElement('p', 'body-text-small', location.narratorText);
      loreText.style.textAlign = 'justify';
      loreSection.appendChild(loreTitle);
      loreSection.appendChild(loreText);
      content.appendChild(loreSection);
    }

    // Location Events Timeline
    if (location.timeline && location.timeline.length > 0) {
      content.appendChild(this.createDivider());
      const tlSection = createElement('div', 'info-section');
      const tlTitle = createElement('h3', 'label', "Castle Chronology");
      tlSection.appendChild(tlTitle);

      const list = createElement('div', 'timeline-list');
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

    // Residents
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
          content.appendChild(this.createDivider());
          const charSection = createElement('div', 'info-section');
          const charTitle = createElement('h3', 'label', "Notable Residents");
          charSection.appendChild(charTitle);

          localChars.forEach(char => {
            const row = createElement('div', 'info-row');
            row.style.fontSize = '0.92rem';
            row.style.padding = '0.2rem 0';
            row.innerHTML = `<span style="font-weight:bold; color:var(--ink-light);">⚔ ${char.name}</span> <span style="font-style:italic; color:var(--gold-dark);">${char.titles[0] || 'Noble'}</span>`;
            charSection.appendChild(row);
          });
          content.appendChild(charSection);
        }
      }
    }

    // Vassals
    if (location.vassals && location.vassals.length > 0 && window.atlasDataManager) {
      content.appendChild(this.createDivider());
      const vassalSection = createElement('div', 'info-section');
      const vassalTitle = createElement('h3', 'label', "Sworn Vassals");
      vassalSection.appendChild(vassalTitle);

      const vassalGrid = createElement('div');
      vassalGrid.style.display = 'grid';
      vassalGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      vassalGrid.style.gap = '0.5rem';
      vassalGrid.style.marginTop = '0.5rem';

      location.vassals.forEach(vId => {
        const vHouse = window.atlasDataManager.getHouse(vId);
        if (vHouse) {
          const card = createElement('div');
          card.style.background = 'rgba(44, 24, 16, 0.03)';
          card.style.border = '1px solid var(--parchment-dark)';
          card.style.padding = '0.45rem';
          card.style.borderRadius = '2px';
          card.style.fontSize = '0.82rem';
          card.style.textAlign = 'center';
          card.style.cursor = 'pointer';
          card.style.borderLeft = `3px solid ${getHouseColor(vId)}`;
          card.textContent = vHouse.name;
          
          card.addEventListener('click', () => {
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

  createDivider() {
    const div = createElement('div', 'decorative-divider');
    div.innerHTML = '<span>♦</span>';
    return div;
  }

  createMetaRowWithBadge(labelVal, valueVal, confidence = 'canon') {
    const row = createElement('div', 'info-row');
    row.style.borderBottom = '1px dashed rgba(44, 24, 16, 0.12)';
    row.style.padding = '0.45rem 0';
    row.style.alignItems = 'center';
    
    const label = createElement('span', 'info-label', labelVal);
    label.style.fontFamily = 'Cinzel, serif';
    label.style.fontSize = '0.8rem';
    label.style.color = 'var(--ink-light)';
    
    const rightCol = createElement('div');
    rightCol.style.display = 'flex';
    rightCol.style.alignItems = 'center';
    rightCol.style.gap = '0.4rem';
    
    const value = createElement('span', '', valueVal);
    value.style.fontFamily = 'Cormorant Garamond, serif';
    value.style.fontSize = '1.05rem';
    value.style.fontWeight = '600';
    value.style.color = 'var(--ink)';
    
    const badge = createElement('span', `canon-badge ${confidence}`, confidence === 'canon' ? '🟢' : confidence === 'inferred' ? '🟡' : '🔴');
    badge.title = `${confidence.toUpperCase()} source value`;
    badge.style.background = 'none';
    badge.style.border = 'none';
    badge.style.padding = '0';
    badge.style.fontSize = '0.9rem';
    badge.style.cursor = 'help';
    
    rightCol.appendChild(value);
    rightCol.appendChild(badge);
    row.appendChild(label);
    row.appendChild(rightCol);
    return row;
  }

  formatRegionName(regionId) {
    if (!regionId) return 'Unknown';
    return regionId.replace(/_/g, ' ').toUpperCase();
  }

  formatStatus(status) {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toUpperCase();
  }
}
