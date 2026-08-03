// Hand-drawn fallback heraldry, one branch per house. 103 of 229 houses have no
// `crest` file, and this is what they get instead of an empty circle.
//
// Moved out of InfoPanel.js unchanged: it is 120 lines of static SVG that had
// nothing to do with panel logic and made the file impossible to read.

export function getHouseSigilSVG(houseId, primaryColor, secondaryColor) {
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
