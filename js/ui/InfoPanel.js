import { createElement, formatYear, stripEntityPrefix } from '../utils/helpers.js';
import { getHouseColor, getHouseSecondaryColor, HOUSE_COLORS } from '../utils/colors.js';
import { matchesInternId } from '../utils/entities.js';
import { isCharacterEntity, isEventEntity } from '../utils/entityKind.js';

function getHouseSigilSVG(houseId, primaryColor, secondaryColor) {
  let innerPaths = '';
  
  if (houseId === 'stark') {
    // Stark: a grey direwolf running across an ice-white field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#F5F5F5"/>
                  <path d="M 85,45 C 80,40 75,40 65,40 C 58,40 50,42 42,46 C 35,48 28,45 22,40 C 20,38 18,40 18,43 C 18,48 24,52 30,52 C 34,52 38,50 42,50 C 45,50 48,54 52,56 L 48,78 L 53,78 L 56,58 C 60,58 64,58 66,58 L 68,78 L 73,78 L 72,56 C 76,54 80,50 85,45 Z" fill="#708090"/>
                  <path d="M 22,40 Q 15,30 20,20 Q 25,25 22,40" fill="none" stroke="#708090" stroke-width="3" stroke-linecap="round"/>
                  <path d="M 85,45 Q 92,38 90,34 L 86,36 L 82,34 L 84,40 Z" fill="#708090"/>`;
  } else if (houseId === 'targaryen') {
    // Targaryen: a three-headed red dragon breathing fire on a black field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#1a1a1a"/>
                  <path d="M 50,40 C 62,40 70,48 70,60 C 70,72 58,80 50,80 C 42,80 30,72 30,60 C 30,48 38,40 50,40 Z" fill="none" stroke="#8B0000" stroke-width="4"/>
                  <path d="M 50,80 L 46,88 L 54,88 Z" fill="#8B0000"/>
                  <path d="M 32,55 C 20,40 18,65 35,72" fill="none" stroke="#8B0000" stroke-width="3" stroke-linecap="round"/>
                  <path d="M 68,55 C 80,40 82,65 65,72" fill="none" stroke="#8B0000" stroke-width="3" stroke-linecap="round"/>
                  <path d="M 45,42 C 40,32 40,25 44,22" fill="none" stroke="#8B0000" stroke-width="2.5" stroke-linecap="round"/>
                  <path d="M 50,40 C 50,30 50,22 50,18" fill="none" stroke="#8B0000" stroke-width="2.5" stroke-linecap="round"/>
                  <path d="M 55,42 C 60,32 60,25 56,22" fill="none" stroke="#8B0000" stroke-width="2.5" stroke-linecap="round"/>
                  <polygon points="44,22 41,18 47,19" fill="#8B0000"/>
                  <polygon points="50,18 47,14 53,14" fill="#8B0000"/>
                  <polygon points="56,22 59,18 53,19" fill="#8B0000"/>
                  <path d="M 41,18 Q 30,16 35,12 M 50,14 Q 50,6 50,10 M 59,18 Q 70,16 65,12" stroke="#CC4400" stroke-width="1.2" fill="none"/>`;
  } else if (houseId === 'lannister') {
    // Lannister: a golden lion rampant on a crimson field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#8B0000"/>
                  <path d="M 40,78 Q 35,78 35,72 L 38,62 Q 35,55 40,48 Q 42,42 40,34 Q 45,24 55,24 C 62,24 64,28 62,35 C 58,35 52,38 52,42 L 56,44 C 62,42 68,38 72,40 C 72,44 68,46 64,48 L 74,48 L 74,52 L 64,54 L 70,62 C 73,62 75,65 72,70 L 66,70 C 64,65 62,65 60,65 L 58,78 L 48,78 L 50,65 L 42,65 L 40,78 Z" fill="#DAA520"/>
                  <path d="M 40,62 Q 22,60 25,35 Q 28,30 25,25 Q 32,32 26,45 Q 26,55 40,62" fill="#DAA520"/>`;
  } else if (houseId === 'baratheon') {
    // Baratheon: a crowned black stag leaping on a golden field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#FFD700"/>
                  <path d="M 22,65 L 32,55 Q 45,45 58,45 Q 66,45 74,52 L 85,42 Q 78,58 72,66 L 68,82 L 64,82 L 65,68 L 55,68 L 45,78 L 40,78 L 46,65 L 35,65 L 22,65 Z" fill="#1a1a1a"/>
                  <path d="M 74,52 Q 70,35 65,25 M 74,48 Q 66,38 60,32 M 74,52 Q 80,35 85,25 M 74,48 Q 84,38 88,32" stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                  <path d="M 70,55 Q 73,58 76,55" stroke="#FFD700" stroke-width="3" fill="none"/>`;
  } else if (houseId === 'tyrell') {
    // Tyrell: a golden rose on a grass-green field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#228B22"/>
                  <circle cx="50" cy="38" r="16" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <circle cx="34" cy="50" r="16" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <circle cx="66" cy="50" r="16" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <circle cx="40" cy="68" r="16" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <circle cx="60" cy="68" r="16" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <path d="M 50,50 L 50,28 M 50,50 L 28,50 M 50,50 L 72,50 M 50,50 L 34,66 M 50,50 L 66,66" stroke="#1F6F1F" stroke-width="2"/>
                  <circle cx="50" cy="50" r="18" fill="#FFD700" stroke="#8B7340" stroke-width="0.8"/>
                  <circle cx="50" cy="50" r="8" fill="#8B0000" stroke="#FFD700" stroke-width="1"/>`;
  } else if (houseId === 'tully') {
    // Tully: a leaping silver trout on a field of blue and red ripples
    innerPaths = `<rect width="100" height="100" rx="12" fill="#4169E1"/>
                  <path d="M 0,50 Q 25,40 50,50 T 100,50 L 100,100 L 0,100 Z" fill="#DC143C"/>
                  <path d="M 0,70 Q 25,60 50,70 T 100,70 L 100,100 L 0,100 Z" fill="#4169E1" opacity="0.3"/>
                  <path d="M 15,50 Q 35,28 60,35 C 72,38 82,48 85,50 C 76,56 65,58 52,56 Q 30,54 15,50 Z" fill="#E8E8E8" stroke="#708090" stroke-width="1.5"/>
                  <path d="M 15,50 L 8,42 L 12,50 L 6,58 Z" fill="#E8E8E8" stroke="#708090" stroke-width="1.2"/>
                  <circle cx="76" cy="45" r="1.5" fill="#333"/>
                  <path d="M 70,42 Q 68,46 70,49" stroke="#708090" stroke-width="1" fill="none"/>`;
  } else if (houseId === 'arryn') {
    // Arryn: a silver falcon volant and crescent moon on a sky-blue field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#4682B4"/>
                  <path d="M 30,30 A 24,24 0 1,0 70,70 A 28,28 0 1,1 30,30" fill="#F5F5F5"/>
                  <path d="M 40,50 Q 55,30 72,45 C 65,55 50,58 40,50 Z" fill="#F5F5F5"/>
                  <path d="M 48,45 L 42,38 L 48,42 L 46,35 L 53,44 Z" fill="#4682B4"/>`;
  } else if (houseId === 'greyjoy') {
    // Greyjoy: a golden kraken on a black field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#1a1a1a"/>
                  <path d="M 50,18 C 45,18 42,22 42,30 C 42,36 45,40 50,40 C 55,40 58,36 58,30 C 58,22 55,18 50,18 Z" fill="#FFD700"/>
                  <circle cx="47" cy="30" r="1" fill="#1a1a1a"/>
                  <circle cx="53" cy="30" r="1" fill="#1a1a1a"/>
                  <path d="M 44,36 Q 30,38 20,55 Q 16,60 22,60 Q 28,52 42,42 M 46,39 Q 34,45 28,75 Q 26,80 32,80 Q 38,70 45,46 M 54,39 Q 66,45 72,75 Q 74,80 68,80 Q 62,70 55,46 M 56,36 Q 70,38 80,55 Q 84,60 78,60 Q 72,52 58,42" stroke="#FFD700" stroke-width="3" fill="none" stroke-linecap="round"/>
                  <path d="M 48,40 L 45,82 M 52,40 L 55,82" stroke="#FFD700" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  } else if (houseId === 'martell') {
    // Martell: a gold spear piercing a red sun on an orange field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#FF8C00"/>
                  <circle cx="50" cy="50" r="16" fill="#8B0000"/>
                  <path d="M 50,22 L 50,78 M 22,50 L 78,50 M 30,30 L 70,70 M 30,75 L 70,25" stroke="#8B0000" stroke-width="4.5" stroke-linecap="round"/>
                  <circle cx="50" cy="50" r="15" fill="#8B0000"/>
                  <path d="M 18,82 L 82,18" stroke="#DAA520" stroke-width="3.5" stroke-linecap="round"/>
                  <polygon points="76,24 86,14 80,18" fill="#DAA520" stroke="#8B7340" stroke-width="0.5"/>`;
  } else if (houseId === 'bolton') {
    // Bolton: a red flayed man hanging upside down on a white X-frame, pink field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#FFC0CB"/>
                  <path d="M 18,18 L 82,82 M 18,82 L 82,18" stroke="#D4A0A0" stroke-width="3" stroke-linecap="round"/>
                  <circle cx="50" cy="28" r="6" fill="#8B0000" stroke="#5C0000" stroke-width="0.8"/>
                  <path d="M 50,34 L 50,62" stroke="#8B0000" stroke-width="4" stroke-linecap="round"/>
                  <path d="M 50,38 L 32,22 M 50,38 L 68,22" stroke="#8B0000" stroke-width="3" stroke-linecap="round"/>
                  <path d="M 50,60 L 34,78 M 50,60 L 66,78" stroke="#8B0000" stroke-width="3" stroke-linecap="round"/>
                  <path d="M 32,22 L 28,18 M 68,22 L 72,18 M 34,78 L 30,82 M 66,78 L 70,82" stroke="#8B0000" stroke-width="2" stroke-linecap="round"/>
                  <path d="M 46,32 Q 44,30 42,32 M 54,32 Q 56,30 58,32" stroke="#5C0000" stroke-width="1" fill="none"/>`;
  } else if (houseId === 'nights_watch') {
    // Night's Watch: a solid black banner
    innerPaths = `<rect width="100" height="100" rx="12" fill="#1a1a1a"/>
                  <path d="M 10,10 L 90,10 L 90,90 L 10,90 Z" fill="none" stroke="#333" stroke-width="1"/>`;
  } else if (houseId === 'hightower') {
    // Hightower: a stone watchtower with a beacon fire at the top on a grey field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#E8E8E8"/>
                  <path d="M 32,80 L 38,45 L 62,45 L 68,80 Z" fill="#808080" stroke="#3C2820" stroke-width="1.2"/>
                  <path d="M 40,45 L 42,28 L 58,28 L 60,45 Z" fill="#999" stroke="#3C2820" stroke-width="1"/>
                  <path d="M 46,28 L 47,20 L 53,20 L 54,28 Z" fill="none" stroke="#3C2820" stroke-width="1"/>
                  <path d="M 50,20 Q 42,10 50,6 Q 58,10 50,20" fill="#CC4400"/>
                  <circle cx="50" cy="18" r="3" fill="#FFD700"/>`;
  } else if (houseId === 'velaryon') {
    // Velaryon: a silver seahorse on a sea-green field
    innerPaths = `<rect width="100" height="100" rx="12" fill="#008B8B"/>
                  <path d="M 48,22 C 48,15 56,15 56,22 C 56,26 50,28 48,32 C 45,38 52,42 54,48 C 56,54 50,60 48,68 C 46,74 54,78 50,84 C 46,88 38,82 44,78 Q 48,74 44,68 C 42,64 38,58 40,52 C 42,46 44,38 48,22 Z" fill="#C0C0C0" stroke="#808080" stroke-width="0.8"/>
                  <path d="M 49,36 Q 40,40 44,48 M 49,42 Q 40,46 45,54" stroke="#C0C0C0" stroke-width="1.5" fill="none"/>`;
  } else if (houseId === 'frey') {
    // Frey: two blue towers on a grey field, connected by a bridge
    innerPaths = `<rect width="100" height="100" rx="12" fill="#A9A9A9"/>
                  <rect x="25" y="30" width="12" height="40" fill="#4169E1" stroke="#333" stroke-width="1"/>
                  <path d="M 23,30 L 39,30 L 31,20 Z" fill="#4169E1" stroke="#333" stroke-width="1"/>
                  <rect x="63" y="30" width="12" height="40" fill="#4169E1" stroke="#333" stroke-width="1"/>
                  <path d="M 61,30 L 77,30 L 69,20 Z" fill="#4169E1" stroke="#333" stroke-width="1"/>
                  <rect x="37" y="45" width="26" height="10" fill="#4169E1" stroke="#333" stroke-width="1"/>
                  <path d="M 42,55 Q 50,48 58,55 Z" fill="#A9A9A9" stroke="#333" stroke-width="1"/>
                  <path d="M 15,75 Q 32,70 50,75 T 85,75" stroke="#4169E1" stroke-width="2" fill="none"/>
                  <path d="M 20,83 Q 37,78 55,83 T 80,83" stroke="#4169E1" stroke-width="1.5" fill="none" opacity="0.6"/>`;
  } else {
    // General heraldic shield with cross divisions
    innerPaths = `<rect width="100" height="100" rx="12" fill="${primaryColor}"/>
                  <path d="M 20,20 L 80,20 L 80,55 C 80,72 50,85 50,85 C 50,85 20,72 20,55 Z" fill="none" stroke="${secondaryColor}" stroke-width="3"/>
                  <path d="M 50,20 L 50,85 M 20,50 L 80,50" stroke="${secondaryColor}" stroke-width="2"/>`;
  }
  
  return `<svg viewBox="0 0 100 100" style="width: 100%; height: 100%; display: block;">${innerPaths}</svg>`;
}

function calculateDistance(pt1, pt2) {
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function parsePathPoints(pathStr) {
  const points = [];
  const matches = pathStr.match(/-?\d+(?:\.\d+)?/g);
  if (matches) {
    for (let i = 0; i < matches.length - 1; i += 2) {
      points.push({ x: parseFloat(matches[i]), y: parseFloat(matches[i+1]) });
    }
  }
  return points;
}

export class InfoPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentEntity = null;
    this.rivers = null;
  }

  init() {
    this.container.className = 'info-panel';
    // Only catalog paths digitized in the 1500×1000 terrain coordinate space
    // are eligible for distance calculations. Legacy vector rivers are not.
    this.rivers = window.atlasDataManager?.data?.calibratedRivers || [];
  }

  open(entity, worldState) {
    if (!entity) return;
    this.currentEntity = entity;
    this.container.innerHTML = ''; // Clear panel

    if (window.atlasApp && window.atlasApp.audioManager) {
      window.atlasApp.audioManager.playWood();
    }

    // Close button
    const closeBtn = createElement('button', 'info-panel-close', '×');
    closeBtn.addEventListener('click', () => this.close());
    this.container.appendChild(closeBtn);

    // Identify entity type categories
    const isLocation = ['castle', 'city', 'landmark'].includes(entity.type);
    const isHouse = entity.type === 'house';
    const isFaction = ['faction', 'institution'].includes(entity.type);
    const isCharacter = isCharacterEntity(entity, window.atlasDataManager?.data?.characters);
    const isEvent = isEventEntity(entity, window.atlasDataManager?.data?.events);
    const isObject = entity.type === 'object' || (entity.id && window.atlasDataManager?.data?.objects?.some(object => object.id === entity.id));
    const isTitle = entity.type === 'title' || (entity.id && window.atlasDataManager?.data?.titles?.some(title => title.id === entity.id));

    // Characters have their own facts and relationships; never fall through to
    // the house/location template below.
    if (isCharacter) {
      this.renderCharacterPanel(entity, worldState);
      return;
    }
    if (isEvent) {
      this.renderEventPanel(entity, worldState);
      return;
    }
    if (isObject || isTitle) {
      this.renderCatalogEntryPanel(entity, isObject ? 'Object' : 'Title');
      return;
    }

    // Resolve ruling house ID and name
    let houseId = 'unknown';
    let lordName = 'Unknown Lord';
    let statusVal = 'Intact';
    let entityCanon = entity.canon || entity.canon_status || 'canon';

    let lordConfidence = 'inferred';
    let statusConfidence = 'inferred';
    let regionConfidence = 'canon';

    let hasTimelineLord = false;

    // Timeline array
    const timeline = entity.timeline || [];

    if (isLocation) {
      const stateMatches = timeline.filter(t => t.year <= worldState.year);
      if (stateMatches.length > 0) {
        const activeState = stateMatches[stateMatches.length - 1];
        houseId = activeState.house || activeState.faction || 'unknown';
        if (activeState.lord) {
          lordName = activeState.lord;
          hasTimelineLord = true;
        }
        statusVal = activeState.status || statusVal;
        entityCanon = activeState.canon || entityCanon;
        lordConfidence = activeState.lord_canon || 'inferred';
        statusConfidence = activeState.status_canon || 'inferred';
      } else if (entity.house || entity.faction) {
        houseId = entity.house || entity.faction;
      }
    } else {
      houseId = entity.id;
      const stateMatches = timeline.filter(t => t.year <= worldState.year);
      if (stateMatches.length > 0) {
        const activeState = stateMatches[stateMatches.length - 1];
        if (activeState.lord || activeState.leader) {
          lordName = activeState.lord || activeState.leader;
          hasTimelineLord = true;
        }
        lordConfidence = activeState.canon || 'canon';
      }
    }

    // Load House details
    let house = null;
    if (window.atlasDataManager) {
      house = window.atlasDataManager.getHouse(houseId);
      if (house && house.timeline && !hasTimelineLord) {
        const houseMatches = house.timeline.filter(t => t.year <= worldState.year);
        if (houseMatches.length > 0) {
          lordName = houseMatches[houseMatches.length - 1].lord || lordName;
          lordConfidence = houseMatches[houseMatches.length - 1].lord_canon || 'canon';
        }
      }
    }

    const houseColor = getHouseColor(houseId);
    const secondaryColor = getHouseSecondaryColor(houseId);

    // House Banner color stripe
    const bannerStripe = createElement('div', 'house-banner-stripe');
    bannerStripe.style.backgroundColor = houseColor;
    this.container.appendChild(bannerStripe);

    // ── 1. ORNATE HEADER ──
    const header = createElement('div', 'info-panel-header');
    
    // Castle/House Name Header with clean canon status tag
    const titleContainer = createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.justifyContent = 'center';
    titleContainer.style.gap = '0.5rem';
    titleContainer.style.marginBottom = '0.5rem';
    
    const title = createElement('h2', 'heading-secondary', entity.name);
    title.style.margin = '0';
    
    const badgeIcon = entityCanon === 'canon' ? '🟢' : entityCanon === 'inferred' ? '🟡' : '🔴';
    const locationBadge = createElement('span', `canon-badge ${entityCanon}`, badgeIcon);
    locationBadge.title = `Canon Status: ${entityCanon.toUpperCase()}`;
    
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
      
      if (house.crest) {
        const img = createElement('img');
        img.src = house.crest;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.onerror = () => {
          img.onerror = null;
          sigilBox.innerHTML = getHouseSigilSVG(houseId, houseColor, secondaryColor);
        };
        sigilBox.appendChild(img);
      } else {
        sigilBox.innerHTML = getHouseSigilSVG(houseId, houseColor, secondaryColor);
      }
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

    // Ornate Meta details
    const metaSection = createElement('div', 'info-section');
    metaSection.appendChild(this.createMetaRowWithBadge("Ruler / Lord", lordName, lordConfidence));
    metaSection.appendChild(this.createMetaRowWithBadge("Region", this.formatRegionName(entity.region), regionConfidence));
    if (isLocation) {
      metaSection.appendChild(this.createMetaRowWithBadge("Status", this.formatStatus(statusVal), statusConfidence));
      metaSection.appendChild(this.createMetaRowWithBadge("Type", this.formatStatus(entity.type), 'canon'));
    } else {
      const seatName = entity.seat || entity.city || 'Unknown';
      metaSection.appendChild(this.createMetaRowWithBadge("Seat / Capital", this.formatStatus(seatName), 'canon'));
      metaSection.appendChild(this.createMetaRowWithBadge("Type", this.formatStatus(entity.type), 'canon'));
    }
    
    // Combined Canon Summary Row
    const canonSummaryRow = createElement('div', 'info-row');
    canonSummaryRow.style.padding = '0.4rem 0';
    canonSummaryRow.style.fontSize = '0.8rem';
    canonSummaryRow.style.color = 'var(--ink-light)';
    canonSummaryRow.style.fontStyle = 'italic';
    
    let summaryText = "🟢 Verified canon history.";
    if (entityCanon === 'inferred' || lordConfidence === 'inferred') {
      summaryText = "🟡 Some details inferred from chronicles.";
    } else if (entityCanon === 'unknown') {
      summaryText = "🔴 Speculative reconstruction.";
    }
    canonSummaryRow.textContent = summaryText;
    metaSection.appendChild(canonSummaryRow);

    content.appendChild(metaSection);
    const fullPageButton = createElement('button', 'info-panel-full-page', 'Vezi pagina completă →');
    fullPageButton.addEventListener('click', () => window.atlasApp?.wikiPage?.open(entity, { fromCompact: true }));
    content.appendChild(fullPageButton);
    content.appendChild(this.createDivider());

    // Description text (Chronicle Record)
    const descSection = createElement('div', 'info-section');
    const descTitle = createElement('h3', 'label', "Chronicle Record");
    descTitle.style.marginBottom = '0.4rem';

    const rootSource = entity.source || (entity.metadata && entity.metadata.source);
    if (rootSource && entity.description) {
      const descText = createElement('p', 'body-text chronicle-text', entity.description);
      const sourceLink = createElement('a', 'source-link');
      sourceLink.href = rootSource;
      sourceLink.target = '_blank';
      sourceLink.textContent = ' Read more on A Wiki of Ice and Fire ↗';
      sourceLink.style.display = 'block';
      sourceLink.style.marginTop = '0.5rem';
      sourceLink.style.fontSize = '0.8rem';
      sourceLink.style.color = '#C5A55A';
      sourceLink.style.textDecoration = 'none';
      sourceLink.style.fontWeight = 'bold';
      descText.appendChild(sourceLink);
      descSection.appendChild(descTitle);
      descSection.appendChild(descText);
    } else {
      const gapText = createElement('p', 'body-text chronicle-text');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.textContent = "⬜ Lipsă sursă descriere istorică";
      descSection.appendChild(descTitle);
      descSection.appendChild(gapText);
    }
    content.appendChild(descSection);

    // Advisory notice for Far Lands
    if (entity.region === 'far_lands') {
      content.appendChild(this.createDivider());
      const advisorySection = createElement('div', 'info-section');
      const advisoryBox = createElement('div');
      advisoryBox.style.cssText = `
        background: linear-gradient(135deg, rgba(139,115,64,0.08), rgba(92,72,48,0.12));
        border: 1px dashed rgba(139,115,64,0.4);
        border-radius: 3px;
        padding: 0.65rem 0.8rem;
        font-family: 'Cormorant Garamond', serif;
        font-style: italic;
        font-size: 0.88rem;
        color: var(--ink-light);
        line-height: 1.5;
      `;
      advisoryBox.innerHTML = `<span style="font-size:1rem;">⚑</span> <strong style="font-family:'Cinzel',serif; font-size:0.75rem; letter-spacing:0.05em;">POORLY CHARTED TERRITORY</strong><br/>
        <span style="font-size:0.82rem;">Information about this region is fragmentary, legendary in nature, or derived from travellers' accounts. Canon status: <strong>${entity.canon_status || 'inferred'}</strong>.</span>`;
      advisorySection.appendChild(advisoryBox);
      content.appendChild(advisorySection);
    }

    // Lore details (Historical Ledger)
    if (entity.narratorText) {
      content.appendChild(this.createDivider());
      const loreSection = createElement('div', 'info-section');
      const loreTitle = createElement('h3', 'label', "Historical Ledger");
      
      if (rootSource) {
        const loreText = createElement('p', 'body-text-small', entity.narratorText);
        loreText.style.textAlign = 'justify';
        const sourceLink = createElement('a', 'source-link');
        sourceLink.href = rootSource;
        sourceLink.target = '_blank';
        sourceLink.textContent = ' Source: A Wiki of Ice and Fire ↗';
        sourceLink.style.display = 'block';
        sourceLink.style.marginTop = '0.5rem';
        sourceLink.style.fontSize = '0.75rem';
        sourceLink.style.color = '#C5A55A';
        sourceLink.style.textDecoration = 'none';
        loreText.appendChild(sourceLink);
        loreSection.appendChild(loreTitle);
        loreSection.appendChild(loreText);
      } else {
        const gapText = createElement('p', 'body-text-small');
        gapText.style.fontStyle = 'italic';
        gapText.style.color = 'var(--ink-light)';
        gapText.textContent = "⬜ Lipsă sursă narrativă";
        loreSection.appendChild(loreTitle);
        loreSection.appendChild(gapText);
      }
      content.appendChild(loreSection);
    }

    // Chronology Timeline (Rule 2: Sourced events only)
    content.appendChild(this.createDivider());
    const tlSection = createElement('div', 'info-section');
    const tlTitle = createElement('h3', 'label', "Chronology Timeline");
    tlSection.appendChild(tlTitle);

    const sourcedEvents = timeline.filter(entry => entry.source);

    if (sourcedEvents.length > 0) {
      const list = createElement('div', 'timeline-list');
      const sortedTimeline = [...sourcedEvents].sort((a,b) => a.year - b.year);
      sortedTimeline.forEach(entry => {
        const item = createElement('div', 'timeline-entry');
        if (entry.year === worldState.year) {
          item.classList.add('active');
        }
        
        const year = createElement('div', 'timeline-entry-year', formatYear(entry.year));
        const details = createElement('div', 'timeline-entry-event');
        details.textContent = entry.event || `${entity.name} undergoes structural/political shifts.`;
        
        const srcLink = createElement('a', 'source-link');
        srcLink.href = entry.source;
        srcLink.target = '_blank';
        srcLink.textContent = ' ↗ source';
        srcLink.style.fontSize = '0.75rem';
        srcLink.style.color = '#C5A55A';
        srcLink.style.marginLeft = '0.5rem';
        srcLink.style.textDecoration = 'none';
        srcLink.style.opacity = '0.8';
        details.appendChild(srcLink);
        
        item.appendChild(year);
        item.appendChild(details);
        list.appendChild(item);
      });
      tlSection.appendChild(list);
    } else {
      const gapText = createElement('div');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.style.fontSize = '0.9rem';
      gapText.textContent = "⬜ Lipsă cronologie atestată prin surse";
      tlSection.appendChild(gapText);
    }
    content.appendChild(tlSection);

    // ── 3. MEMBERS / LORDS KNOWN ──
    content.appendChild(this.createDivider());
    const membersSection = createElement('div', 'info-section');
    const membersTitle = createElement('h3', 'label', "Known Members & Lords");
    membersSection.appendChild(membersTitle);

    const uniqueMembers = new Map();

    // A. Gather from timeline
    timeline.forEach(t => {
      if (t.lord || t.leader) {
        const name = t.lord || t.leader;
        const key = name.toLowerCase().trim();
        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, {
            name: name,
            role: isFaction ? 'Leader' : 'Lord',
            years: t.year
          });
        }
      }
    });

    // B. Gather from characters.json
    if (window.atlasDataManager && window.atlasDataManager.data.characters) {
      window.atlasDataManager.data.characters.forEach(char => {
        let isMember = false;
        if (isHouse && char.house === entity.id) {
          isMember = true;
        } else if (isFaction && (char.house === entity.id || char.faction === entity.id)) {
          isMember = true;
        } else if (isLocation) {
          if (char.timeline) {
            const matches = char.timeline.filter(t => t.year <= worldState.year);
            if (matches.length > 0 && matches[matches.length - 1].location === entity.id) {
              isMember = true;
            }
          }
        }

        if (isMember) {
          const key = char.name.toLowerCase().trim();
          const role = char.titles && char.titles[0] ? char.titles[0] : (isFaction ? 'Member' : 'Noble');
          uniqueMembers.set(key, {
            name: char.name,
            role: role,
            description: char.description
          });
        }
      });
    }

    // C. Gather notable_members
    const metadata = entity.metadata || entity;
    if (metadata.notable_members) {
      metadata.notable_members.forEach(name => {
        const key = name.toLowerCase().trim();
        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, {
            name: name,
            role: 'Notable Figure'
          });
        }
      });
    }

    if (uniqueMembers.size > 0) {
      uniqueMembers.forEach(m => {
        const row = createElement('div', 'info-row');
        row.style.fontSize = '0.9rem';
        row.style.padding = '0.25rem 0';
        row.style.borderBottom = '1px dashed rgba(44, 24, 16, 0.05)';
        
        let descTooltip = m.description ? ` title="${m.description}"` : '';
        row.innerHTML = `<span style="font-weight:bold; color:var(--ink-light); cursor:help;"${descTooltip}>⚔ ${m.name}</span> 
                         <span style="font-style:italic; color:var(--gold-dark);">${m.role}</span>`;
        membersSection.appendChild(row);
      });
    } else {
      const gapText = createElement('div');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.style.fontSize = '0.9rem';
      gapText.textContent = "⬜ Lipsă date membri / lord";
      membersSection.appendChild(gapText);
    }
    content.appendChild(membersSection);

    // ── 4. RELATED HOUSES ──
    content.appendChild(this.createDivider());
    const relatedSection = createElement('div', 'info-section');
    const relatedTitle = createElement('h3', 'label', "Related Houses");
    relatedSection.appendChild(relatedTitle);

    const relatedHouses = new Set();
    const regionId = entity.region;

    if (window.atlasDataManager) {
      const allHouses = window.atlasDataManager.data.houses || [];
      const allLocations = window.atlasDataManager.getAllLocations() || [];

      // Vassal / Overlord logic
      let overlordId = null;
      let siblingVassalIds = [];

      if (isHouse) {
        allLocations.forEach(loc => {
          if (loc.vassals && loc.vassals.includes(entity.id)) {
            const rulingMatches = loc.timeline ? loc.timeline.filter(t => t.year <= worldState.year) : [];
            if (rulingMatches.length > 0) {
              overlordId = rulingMatches[rulingMatches.length - 1].house;
            } else if (loc.house) {
              overlordId = loc.house;
            }
            siblingVassalIds = loc.vassals;
          }
        });
      }

      if (overlordId && overlordId !== entity.id) {
        relatedHouses.add(overlordId);
      }
      siblingVassalIds.forEach(id => {
        if (id !== entity.id) {
          relatedHouses.add(id);
        }
      });

      if (isHouse && metadata.vassals) {
        metadata.vassals.forEach(vId => relatedHouses.add(vId));
      }
      if (isLocation && entity.vassals) {
        entity.vassals.forEach(vId => relatedHouses.add(vId));
      }

      if (regionId) {
        allHouses.forEach(h => {
          if (h.region === regionId && h.id !== entity.id) {
            relatedHouses.add(h.id);
          }
        });
      }
    }

    if (relatedHouses.size > 0) {
      const relatedGrid = createElement('div');
      relatedGrid.style.display = 'grid';
      relatedGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      relatedGrid.style.gap = '0.5rem';
      relatedGrid.style.marginTop = '0.5rem';

      relatedHouses.forEach(hId => {
        const rHouse = window.atlasDataManager.getHouse(hId);
        if (rHouse) {
          const card = createElement('div');
          card.style.background = 'rgba(44, 24, 16, 0.03)';
          card.style.border = '1px solid var(--parchment-dark)';
          card.style.padding = '0.45rem';
          card.style.borderRadius = '2px';
          card.style.fontSize = '0.82rem';
          card.style.textAlign = 'center';
          card.style.cursor = 'pointer';
          card.style.borderLeft = `3px solid ${getHouseColor(hId)}`;
          card.textContent = rHouse.name;
          
          card.addEventListener('click', () => {
            const seatId = rHouse.seat || rHouse.city;
            const seatLoc = window.atlasDataManager.getLocation(seatId);
            window.atlasApp.selectEntity(rHouse, seatLoc);
          });

          relatedGrid.appendChild(card);
        }
      });
      relatedSection.appendChild(relatedGrid);
    } else {
      const gapText = createElement('div');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.style.fontSize = '0.9rem';
      gapText.textContent = "⬜ Lipsă date case înrudite";
      relatedSection.appendChild(gapText);
    }
    content.appendChild(relatedSection);

    // ── 5. PROXIMITY CALCULATIONS ──
    content.appendChild(this.createDivider());
    const proxSection = createElement('div', 'info-section');
    const hasCalibratedRivers = Array.isArray(this.rivers) && this.rivers.length > 0;
    const proxTitle = createElement(
      'h3',
      'label',
      hasCalibratedRivers ? 'Nearby Castles & Rivers' : 'Nearby Castles & Settlements'
    );
    proxSection.appendChild(proxTitle);

    // World distances must never fall back to legacy schematic coordinates.
    // They remain disabled until the world scale and the relevant positions are calibrated.
    const worldScale = window.atlasDataManager?.getWorldMilesPerUnit?.();
    let startPt = worldScale ? window.atlasApp?.mapRenderer?.getLocationCoordinate(entity) : null;
    if (!startPt && !isLocation && window.atlasDataManager) {
      const seatId = entity.seat || entity.city;
      if (seatId) {
        const seatLoc = window.atlasDataManager.getLocation(seatId);
        if (seatLoc && worldScale) startPt = window.atlasApp?.mapRenderer?.getLocationCoordinate(seatLoc);
      }
    }

    if (startPt && startPt.x != null && startPt.y != null) {
      // A. Nearby Fortresses
      if (window.atlasDataManager) {
        const allLocs = window.atlasDataManager.getAllLocations();
        const locDists = [];
        allLocs.forEach(loc => {
          const locationPoint = window.atlasApp?.mapRenderer?.getLocationCoordinate(loc);
          if (loc.id !== entity.id && loc.id !== entity.seat && locationPoint) {
            const dist = calculateDistance(startPt, locationPoint);
            locDists.push({
              location: loc,
              distMiles: dist * worldScale
            });
          }
        });
        locDists.sort((a,b) => a.distMiles - b.distMiles);
        const topLocs = locDists.slice(0, 3);
        
        const locLabel = createElement('div');
        locLabel.style.fontWeight = 'bold';
        locLabel.style.fontSize = '0.85rem';
        locLabel.style.color = 'var(--gold-dark)';
        locLabel.style.marginTop = '0.4rem';
        locLabel.textContent = "Closest Fortresses & Settlements:";
        proxSection.appendChild(locLabel);

        topLocs.forEach(item => {
          const row = createElement('div');
          row.style.fontSize = '0.85rem';
          row.style.padding = '0.2rem 0';
          row.style.cursor = 'pointer';
          row.style.color = 'var(--ink)';
          row.style.textDecoration = 'underline';
          row.style.textDecorationStyle = 'dotted';
          row.textContent = `📍 ${item.location.name} (${Math.round(item.distMiles)} miles away)`;
          row.addEventListener('click', () => {
            window.atlasApp.selectEntity(item.location, item.location);
          });
          proxSection.appendChild(row);
        });
      }

      // B. Nearby Rivers
      const milesPerUnit = window.atlasDataManager?.getWorldMilesPerUnit?.();
      if (milesPerUnit && this.rivers && this.rivers.length > 0) {
        const riverDists = [];
        this.rivers.forEach(river => {
          let minDist = Infinity;
          const checkPoints = (points) => {
            points.forEach(pt => {
              const d = calculateDistance(startPt, pt);
              if (d < minDist) minDist = d;
            });
          };

          if (river.path) checkPoints(parsePathPoints(river.path));
          if (river.branches) {
            river.branches.forEach(b => {
              if (b.path) checkPoints(parsePathPoints(b.path));
            });
          }

          riverDists.push({
            name: river.name,
            distMiles: minDist * milesPerUnit
          });
        });

        riverDists.sort((a,b) => a.distMiles - b.distMiles);
        const topRivers = riverDists.slice(0, 2);

        const riverLabel = createElement('div');
        riverLabel.style.fontWeight = 'bold';
        riverLabel.style.fontSize = '0.85rem';
        riverLabel.style.color = 'var(--gold-dark)';
        riverLabel.style.marginTop = '0.6rem';
        riverLabel.textContent = "Closest Rivers & Waterways:";
        proxSection.appendChild(riverLabel);

        topRivers.forEach(r => {
          const row = createElement('div');
          row.style.fontSize = '0.85rem';
          row.style.padding = '0.15rem 0';
          row.textContent = `💧 ${r.name} (${Math.round(r.distMiles)} miles away)`;
          proxSection.appendChild(row);
        });
      }

    } else {
      const gapText = createElement('div');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.style.fontSize = '0.9rem';
      gapText.textContent = worldScale
        ? "⬜ Coordonate world lipsă - imposibil de calculat proximitatea"
        : "⬜ Calibrarea scării hărții lipsește - distanțele și proximitatea rămân dezactivate";
      proxSection.appendChild(gapText);
    }
    content.appendChild(proxSection);

    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  close() {
    this.container.classList.remove('open');
    document.dispatchEvent(new CustomEvent('locationDeselected'));
  }

  renderCharacterPanel(entity, worldState) {
    const canon = entity.confidence || entity.canon || entity.canon_status || 'unknown';
    const header = createElement('div', 'info-panel-header');
    const title = createElement('h2', 'heading-secondary', entity.name);
    title.style.margin = '0';
    header.appendChild(title);
    header.appendChild(this.createConfidenceBadge(canon));
    this.container.appendChild(header);
    this.container.appendChild(this.createDivider());

    const content = createElement('div', 'info-panel-content');
    const facts = createElement('div', 'info-section');
    const currentTitle = entity.titlu_curent;
    if (currentTitle) facts.appendChild(this.createMetaRowWithBadge('Current title', currentTitle, canon));
    const titlesArr = Array.isArray(entity.titles) && entity.titles.length
      ? entity.titles
      : (entity._afirmatii_pe_predicat?.titlu || entity._afirmatii_pe_predicat?.title);
    if (Array.isArray(titlesArr) && titlesArr.length) {
      const titleStr = titlesArr.map(t => typeof t === 'object' ? (t.titlu || t.valoare || t.name || JSON.stringify(t)) : t).join(' · ');
      const titleConf = typeof titlesArr[0] === 'object' && titlesArr[0]?.confidence ? (titlesArr[0].confidence === 'confirmed' ? 'canon' : titlesArr[0].confidence) : canon;
      facts.appendChild(this.createMetaRowWithBadge('Titles', titleStr, titleConf));
    }
    if (entity.membru_al || entity.house) {
      facts.appendChild(this.createLinkedMetaRow('Member of', entity.membru_al || entity.house, canon));
    }
    if (entity.born !== undefined && entity.born !== null) facts.appendChild(this.createMetaRowWithBadge('Born', formatYear(entity.born), canon));
    if (entity.died !== undefined && entity.died !== null) facts.appendChild(this.createMetaRowWithBadge('Died', formatYear(entity.died), canon));
    if (entity.locatie_asociata) facts.appendChild(this.createLinkedMetaRow('Associated location', entity.locatie_asociata, canon));
    if (entity.moarte?.descriere) {
      facts.appendChild(this.createMetaRowWithBadge('Death', entity.moarte.descriere, entity.moarte.confidence || canon));
    }
    content.appendChild(facts);

    const family = this.createCharacterFamilySection(entity, canon);
    if (family) {
      content.appendChild(this.createDivider());
      content.appendChild(family);
    }

    if (entity.description) {
      content.appendChild(this.createDivider());
      const description = createElement('div', 'info-section');
      description.appendChild(createElement('h3', 'label', 'Chronicle Record'));
      description.appendChild(createElement('p', 'body-text chronicle-text', entity.description));
      content.appendChild(description);
    }

    const fullPageButton = createElement('button', 'info-panel-full-page', 'Vezi pagina completă →');
    fullPageButton.addEventListener('click', () => window.atlasApp?.wikiPage?.open(entity, { fromCompact: true }));
    content.appendChild(fullPageButton);
    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  createConfidenceBadge(confidence) {
    const badge = createElement('span', `canon-badge ${confidence}`, confidence === 'canon' ? '✓' : confidence === 'inferred' ? '◇' : '?');
    badge.title = `Confidence: ${confidence}`;
    return badge;
  }

  createLinkedMetaRow(labelValue, entityId, confidence) {
    const row = createElement('div', 'info-row');
    row.style.borderBottom = '1px dashed rgba(44, 24, 16, 0.12)';
    row.style.padding = '0.45rem 0';
    row.style.alignItems = 'center';
    row.appendChild(createElement('span', 'info-label', labelValue));
    const target = this.getEntityById(entityId);
    const link = createElement(target ? 'button' : 'span', target ? 'info-entity-link' : 'info-value', target?.name || String(entityId));
    if (target) link.addEventListener('click', () => this.openLinkedEntity(target));
    row.appendChild(link);
    row.appendChild(this.createConfidenceBadge(confidence));
    return row;
  }

  createCharacterFamilySection(entity, confidence) {
    const labels = { parinti: 'Parents', copii: 'Children', frati: 'Siblings', casatorit_cu: 'Spouses', possible_parent_of: 'Possible children' };
    const section = createElement('div', 'info-section');
    let hasRelations = false;
    Object.entries(labels).forEach(([key, label]) => {
      let rawList = entity[key] || entity._afirmatii_pe_predicat?.[key] || [];
      if (!Array.isArray(rawList) || !rawList.length) return;
      hasRelations = true;
      const row = createElement('div', 'info-row');
      row.appendChild(createElement('span', 'info-label', label));
      const values = createElement('span', 'info-value');
      let rowConfidence = key === 'possible_parent_of' ? 'inferred' : null;

      rawList.forEach((item, index) => {
        if (index) values.append(', ');
        const id = typeof item === 'object' ? (item.id || item.valoare) : item;
        if (typeof item === 'object' && item.confidence && !rowConfidence) {
          rowConfidence = item.confidence === 'confirmed' ? 'canon' : item.confidence === 'uncertain' ? 'inferred' : item.confidence;
        }
        const target = this.getEntityById(id);
        const link = createElement(target ? 'button' : 'span', target ? 'info-entity-link' : '', target?.name || String(id));
        if (target) link.addEventListener('click', () => this.openLinkedEntity(target));
        values.appendChild(link);
      });
      row.appendChild(values);
      row.appendChild(this.createConfidenceBadge(rowConfidence || confidence));
      section.appendChild(row);
    });
    return hasRelations ? section : null;
  }

  getEntityById(id) {
    if (!id) return null;
    const cleanId = stripEntityPrefix(id);
    const data = window.atlasDataManager?.data;
    const matches = item => item.id === id || matchesInternId(item, id) || item.id === cleanId;
    return window.atlasDataManager?.getAllLocations?.().find(matches)
      || data?.houses?.find(matches)
      || data?.characters?.find(matches)
      || null;
  }

  openLinkedEntity(entity) {
    const location = ['castle', 'city', 'landmark'].includes(entity.type) ? entity : null;
    window.atlasApp?.selectEntity(entity, location);
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

  renderCatalogEntryPanel(entity, kind) {
    const header = createElement('div', 'info-panel-header');
    const title = createElement('h2', 'heading-secondary', entity.name || entity.nume || entity.id);
    title.style.margin = '0';
    header.appendChild(title);
    header.appendChild(createElement('div', 'label', kind));
    this.container.appendChild(header);
    this.container.appendChild(this.createDivider());

    const content = createElement('div', 'info-panel-content');
    const facts = createElement('div', 'info-section');
    const category = entity.categorie || entity.category || entity.type;
    if (category) facts.appendChild(this.createMetaRowWithBadge('Type', category, 'canon'));
    content.appendChild(facts);

    const descriptions = entity.descrieri || entity.descriptions || entity.description || entity.descriere;
    const descriptionList = Array.isArray(descriptions) ? descriptions : descriptions ? [descriptions] : [];
    if (descriptionList.length) {
      content.appendChild(this.createDivider());
      const section = createElement('div', 'info-section');
      section.appendChild(createElement('h3', 'label', 'Description'));
      descriptionList.forEach(description => section.appendChild(createElement('p', 'body-text chronicle-text', description)));
      content.appendChild(section);
    }

    const sources = entity.sources || entity.surse || entity.sursa || entity.source;
    const sourceList = Array.isArray(sources) ? sources : sources ? [sources] : [];
    if (sourceList.length) {
      content.appendChild(this.createDivider());
      const section = createElement('div', 'info-section');
      section.appendChild(createElement('h3', 'label', 'Sources'));
      sourceList.forEach(source => {
        const text = typeof source === 'string'
          ? source
          : source.source_book || source.source || source.sursa || source.name || JSON.stringify(source);
        section.appendChild(createElement('p', 'body-text-small', text));
      });
      content.appendChild(section);
    }

    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  renderEventPanel(entity, worldState) {
    const canon = entity.confidence || entity.canon || entity.canon_status || 'canon';
    const header = createElement('div', 'info-panel-header');
    
    const titleContainer = createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.justifyContent = 'center';
    titleContainer.style.gap = '0.5rem';
    titleContainer.style.marginBottom = '0.5rem';
    
    const title = createElement('h2', 'heading-secondary', entity.name || entity.nume || entity.id);
    title.style.margin = '0';
    
    titleContainer.appendChild(title);
    titleContainer.appendChild(this.createConfidenceBadge(canon));
    header.appendChild(titleContainer);

    const typeLabel = createElement('div', 'label', `📜 Event • ${entity.type || 'historical'}`);
    typeLabel.style.fontSize = '0.85rem';
    typeLabel.style.marginTop = '0.2rem';
    header.appendChild(typeLabel);

    this.container.appendChild(header);
    this.container.appendChild(this.createDivider());

    const content = createElement('div', 'info-panel-content');
    
    const metaSection = createElement('div', 'info-section');
    const yearVal = entity.year ?? entity.an ?? entity.an_aproximativ;
    if (yearVal !== undefined && yearVal !== null) {
      metaSection.appendChild(this.createMetaRowWithBadge("Year", formatYear(yearVal), canon));
    }
    const locId = entity.location || entity.locatie_id;
    if (locId) {
      metaSection.appendChild(this.createLinkedMetaRow("Location", locId, canon));
    }
    content.appendChild(metaSection);

    const desc = entity.description || entity.descriere;
    if (desc) {
      content.appendChild(this.createDivider());
      const descSection = createElement('div', 'info-section');
      descSection.appendChild(createElement('h3', 'label', 'Chronicle Record'));
      descSection.appendChild(createElement('p', 'body-text chronicle-text', desc));
      content.appendChild(descSection);
    }

    content.appendChild(this.createDivider());
    const participantsSection = createElement('div', 'info-section');
    participantsSection.appendChild(createElement('h3', 'label', 'Participants'));

    const rawParticipants = [...(entity.participanti || []), ...(entity.participants || [])];
    
    const seenIds = new Set();
    const uniqueParticipants = [];
    rawParticipants.forEach(p => {
      const pid = typeof p === 'object' ? (p.id || p.valoare) : p;
      const key = pid ? stripEntityPrefix(pid) : null;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        uniqueParticipants.push(p);
      }
    });

    if (uniqueParticipants.length > 0) {
      const list = createElement('div', 'participants-list');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '0.4rem';
      list.style.marginTop = '0.4rem';

      uniqueParticipants.forEach(p => {
        const pId = typeof p === 'object' ? (p.id || p.valoare) : p;
        const pRole = typeof p === 'object' ? (p.rol || p.role) : null;
        
        const row = this.createParticipantRow(pId, pRole);
        list.appendChild(row);
      });
      participantsSection.appendChild(list);
    } else {
      const gapText = createElement('div');
      gapText.style.fontStyle = 'italic';
      gapText.style.color = 'var(--ink-light)';
      gapText.style.fontSize = '0.9rem';
      gapText.textContent = "⬜ Lipsă date participanți";
      participantsSection.appendChild(gapText);
    }
    content.appendChild(participantsSection);

    const fullPageButton = createElement('button', 'info-panel-full-page', 'Vezi pagina completă →');
    fullPageButton.addEventListener('click', () => window.atlasApp?.wikiPage?.open(entity, { fromCompact: true }));
    content.appendChild(fullPageButton);

    this.container.appendChild(content);
    this.container.classList.add('open');
  }

  createParticipantRow(pId, pRole) {
    const row = createElement('div', 'participant-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '0.35rem 0.5rem';
    row.style.borderRadius = '4px';
    row.style.fontSize = '0.88rem';
    
    const target = this.getEntityById(pId);
    const isHouse = (typeof pId === 'string' && (pId.startsWith('HOUSE_') || pId.startsWith('house_'))) || target?.type === 'house';
    
    if (isHouse) {
      row.style.background = 'rgba(197, 165, 90, 0.15)';
      row.style.border = '1px solid rgba(197, 165, 90, 0.4)';
      row.style.borderLeft = '4px solid var(--gold-dark)';
    } else {
      row.style.background = 'rgba(44, 24, 16, 0.04)';
      row.style.border = '1px solid rgba(44, 24, 16, 0.18)';
      row.style.borderLeft = '4px solid var(--blood)';
    }
    
    const leftCol = createElement('div');
    leftCol.style.display = 'flex';
    leftCol.style.alignItems = 'center';
    leftCol.style.gap = '0.4rem';
    
    const icon = createElement('span', 'participant-icon', isHouse ? '🛡️' : '👤');
    icon.style.fontSize = '0.95rem';
    leftCol.appendChild(icon);
    
    const link = createElement(target ? 'button' : 'span', target ? 'info-entity-link' : 'info-value', target?.name || String(pId));
    if (isHouse) {
      link.style.fontWeight = 'bold';
      link.style.color = 'var(--gold-dark)';
    } else {
      link.style.fontWeight = '600';
    }
    
    if (target) {
      link.addEventListener('click', () => this.openLinkedEntity(target));
    }
    leftCol.appendChild(link);
    row.appendChild(leftCol);
    
    if (pRole) {
      const roleSpan = createElement('span', 'participant-role', pRole);
      roleSpan.style.fontStyle = 'italic';
      roleSpan.style.fontSize = '0.8rem';
      roleSpan.style.color = 'var(--ink-light)';
      roleSpan.style.marginLeft = '0.5rem';
      row.appendChild(roleSpan);
    }
    
    return row;
  }
}
