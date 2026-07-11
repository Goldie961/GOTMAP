# Atlas of Westeros

A premium historical atlas of the *A Song of Ice and Fire* universe, built with HTML, CSS, Vanilla JavaScript, and SVG. 

## Features
- **Cinematic Map Engine**: Fully interactive custom SVG map with mouse pan/zoom, coordinate fitting boundaries, and smooth animated viewport transitions (like Google Earth).
- **Annals Chronology Timeline**: Snaps to 16 historical milestones (1 AC to 300 AC). Updates regional political control, ruling houses, castle ownership, living dragons, and kings dynamically.
- **Minimap Event Markers**: Highlights key wars, coronations, and events on the timeline scrollbar for quick indexing.
- **Living Map**: Features environmental micro-animations including drifting fog layers, rising town smoke, and animated water.
- **Day/Night Mode & Seasons**: Switch the map between daylight and nighttime with city lights glowing. Toggle winter season rendering to freeze the North.
- **Sidebar Chronicles Info Panel**: Displays ruling lords, historical description details, castle timeline chronology, residents, and vassals.
- **Canon Confidence Indicators**: Badges highlight information status (🟢 Canon / 🟡 Inferred / 🔴 Unknown).
- **Distance Calculator**: Measures straight-line miles and leagues between two locations, estimating travel time on foot, horseback, galley ship, or dragon flight.
- **Fuzzy Global Search**: Autocompletes and flies the camera directly to targeted locations.

## Setup
Simply open `index.html` in any web browser, or serve it using a local static server:
```bash
# Python
python -m http.server 8000

# Node
npx http-server
```
Open `http://localhost:8000` in the browser. Works entirely offline with zero dependencies!
