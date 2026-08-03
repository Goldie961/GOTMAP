# Raport Extragere i18n — Atlas of Westeros

## Summary / Sumar
Extragerea stringurilor de interfață utilizator (UI) din codul sursă al aplicației în fișiere de traducere i18n s-a realizat cu succes.

- **Număr total de chei i18n extrase**: `213`
- **Număr TODO în `en.json`** (stringuri venite din limba română): `95`
- **Număr TODO în `ro.json`** (stringuri venite din limba engleză): `118`

---

## Lista Fișierelor Atinse / Modified Files

### Fișiere de Infrastructură i18n (Noi):
1. `js/i18n/index.js` — Modul stub cu funcția `t(key, params)`
2. `i18n/en.json` — Dicționar cu chei ierarhice pentru limba Engleză
3. `i18n/ro.json` — Dicționar cu chei ierarhice pentru limba Română

### Fișiere Sursă Modificate:
1. `index.html` (interfață HTML principală, titlu și loader)
2. `js/app.js` (inițializare text loader și mesaje de eroare)
3. `js/ui/DistanceTool.js` (etichete, viteze, mesaje narative și interpolare distanțe)
4. `js/ui/FilterPanel.js` (titluri filtre și categorii de locație)
5. `js/ui/InfoPanel.js` (panouri de detalii entități, cronologie, casete canon și proximitate)
6. `js/ui/SearchBar.js` (placeholder, mesaje fără rezultate și etichete aliasuri)
7. `js/ui/Timeline.js` (titluri controale, regi/regine și mesaje de stare)
8. `js/ui/Toolbar.js` (titlu aplicație și tooltip-uri pentru butoane)
9. `js/ui/WikiPage.js` (titluri secțiuni wiki, etichete relații/familie și metadate)
10. `js/map/MapLayers.js` (etichete pentru straturile de hartă în `LAYER_REGISTRY`)
11. `admin/map-editor.js` (interfață editor administrative, avertismente server, toaste și dialoguri de confirmare)

---

## Criterii de Acceptanță / Acceptance Criteria Verification
- `grep -rnE "innerHTML\s*=\s*[\`'\"][A-ZĂÎ]" js/ui/` → **0 rezultate** (Toate stringurile din `js/ui/` trec prin `t()`).
- `număr chei en.json == număr chei ro.json` → **Confirmat: 213 == 213**.
- Aplicația pornește și afișează chei brute fără a crăpa.
