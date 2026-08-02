# Audit Atlas of Westeros — Concluzii

Verificare făcută pe baza codului real (`js/`, `css/`, `data/`, `admin/`) și a celor 7 capturi de ecran trimise. Pentru fiecare punct: ce am verificat, ce am găsit, și recomandarea mea. Bug-urile confirmate au fișier + linie exactă.

---

## 1. Bug-uri confirmate (cauză identificată în cod)

### 1.1 Search → click pe un eveniment "nu duce nicăieri"
**Status: cauză 100% confirmată.**

În `js/app.js`, handler-ul `searchBar.onSelect(res => {...})` tratează explicit doar rezultate de tip `house`/`faction`/`institution`, `character` și `dragon`. Pentru `event`, `object` sau `title` nu există nicio ramură de cod. `entity` rămâne `null`, condiția `if (entity) { this.selectEntity(...) }` nu se declanșează niciodată — click-ul literalmente nu face nimic. Nu e un bug ascuns/random, e funcționalitate neterminată pentru aceste tipuri.

**Recomandare:** nu aș "repara" asta izolat — vezi punctul 3 (separarea /harta vs /wiki), pentru că soluția corectă schimbă și ce ar trebui să facă acest click.

### 1.2 Distanța măsurată "nu funcționează deloc"
**Status: cauză 100% confirmată.**

`data/map/catalog.json` → `coordinateSpaces["world-terrain-1500x1000"]` are `milesPerUnit: null` și `scaleStatus: "needsCalibration"`. Harta nu a fost niciodată calibrată la o scară reală (mile per pixel). `DistanceTool.js` (linia ~146) verifică exact acest lucru: dacă `milesPerUnit` e null, afișează mereu „Map scale calibration pending” în loc de o cifră — indiferent ce două locații alegi.

**Important:** aveți deja `data/locations/distances.json` cu **467 de afirmații de distanță extrase din carte** (cu sursă, pagină, metodă de deplasare, confidence). Acestea sunt deja afișate de `DistanceTool.js`, dar *sub* rezultatul principal (care e mereu gol). Ideea ta — să fie distanța din carte, nu din pixeli calculați — e exact calea corectă, pentru că datele deja există și sunt substanțiale.

**Recomandare:** inversează ierarhia — distanța narativă (din carte) devine rezultatul principal afișat; distanța calculată din hartă (dacă/când se calibrează scara) devine un "plus" secundar, marcat clar ca aproximare geometrică.

### 1.3 King's Landing nu se activează din search
**Status: cauză NEconfirmată — am eliminat ipotezele principale.**

Ce am verificat și e OK:
- Datele locației (`kings_landing`) au coordonate valide în `locations.json`.
- E calibrat corect în `catalog.json` → coordonate `{x:304.4, y:580.2}`, în interiorul spațiului hărții (1500×1000).
- Nu există id duplicat `kings_landing` în date.
- Nu e filtrat de `isLowCompletenessEntity` (are date bogate).

N-am putut reproduce eroarea fără browser live, deci nu pot spune sigur care e cauza exactă. Cel mai probabil e o eroare de runtime (JS exception) undeva în lanțul click → selectEntity → zoom, posibil legată de faptul că e singura locație cu marker SVG "custom-desenat" (cod separat în `MapRenderer.js` linia ~499, spre deosebire de restul locațiilor care folosesc markerul generic).

**Găsit pe drum — bug real, separat:** `app.js`, funcția `selectEntity()`, linia ~280:
```js
let targetX = location.coordinates.x;
let targetY = location.coordinates.y;
```
Acest cod citește `location.coordinates.x` **fără să verifice dacă `coordinates` există**. Am numărat: **189 din 220** de castele/orașe din `locations.json` NU au acest câmp la nivelul de bază al obiectului (ex: Castle Black, Highgarden, Storm's End, White Harbor). Pentru oricare din aceste locații, dacă `getRenderedPosition()` nu găsește o poziție deja randată pe hartă, acest cod aruncă o eroare JS necontrolată. Nu e neapărat cauza pentru King's Landing (care ARE coordonate), dar e o gaură reală de robustețe care afectează multe alte locații și trebuie reparată oricum.

**Ce-mi trebuie ca să localizez exact bug-ul King's Landing:** fie acces să rulez aplicația live, fie eroarea din consola browser-ului (F12 → Console) exact în momentul click-ului.

---

## 2. Probleme de design (confirmate din poze + cod)

### 2.1 Sursele/paginile "nu se văd bine ochiului"
**Confirmat în CSS.** Clasa `.wiki-source` (`css/panels.css`, linia 127):
```css
.wiki-source { margin-top: .3rem; color: var(--ink-light); font-size: .78rem; font-style: italic; }
```
Font mic, culoare deschisă, italic — practic o notă de subsol clasică de carte tipărită, dar pe ecran devine ilizibilă, mai ales cu liste lungi de pagini (vezi poza cu "NU MI PLACE PAGINA DE WIKI FINALĂ").

**Recomandare:** nu le-aș elimina — sunt dovadă de canonicitate, au valoare reală. Aș reîmpacheta: un simbol mic „📖” sau „(surse)” clickabil lângă fiecare afirmație, care deschide/extinde detaliile (carte, fragment, pagină) la cerere, în loc să fie tot înșirat vizibil permanent. Lista completă de pagini rămâne disponibilă, dar nu mai aglomerează ochiul.

### 2.2 Iconițele castelelor/caselor fără steag arată prost
Confirmat vizual din capturi. Momentan multe locații fără casă cunoscută cad pe un marker generic needistinctiv (punct), în timp ce câteva locații majore (King's Landing, Dragonstone, Hightower, Storm's End, The Eyrie) au forme SVG custom, cod scris manual per-locație în `MapRenderer.js`.

**Recomandare:** silueta (castel/oraș/ruine/reper) ar trebui să fie determinată de **tip**, nu de existența unui steag — fiecare tip să aibă o formă implicită distinctă (turn/zid pentru castel, acoperișuri pentru oraș/sat, coloane sparte pentru ruine). Emblema casei (dacă există) se suprapune ca un cerc mic în colț, nu înlocuiește silueta. Așa un castel arată mereu ca un castel.

### 2.3 Panoul din dreapta la prima căutare + pagina completă de personaj
Confirmat din capturi — panoul „mini-wiki” arată dens/brut la prima afișare, iar pagina completă (wiki final) e un bloc lung, neseparat vizual, cu toate secțiunile (biografie, titluri, relații, cronologie, evenimente, surse) înșirate fără ancore de navigare.

**Recomandare:**
- Panoul de la prima căutare: doar esențial (nume, emblemă, 2–3 fapte-cheie, buton mare „Vezi pagina completă”).
- Pagina completă: secțiuni cu ancore de navigare sus (Istorie / Familie / Cronologie / Evenimente / Surse) ca să nu fie un singur bloc lung de citit.

### 2.4 Zoom-ul "aiurea" pe personaje vs castele/case
Legat direct de secțiunea 3 de mai jos — momentan search-ul de pe hartă încearcă să "localizeze" personaje (via ultima locație cunoscută din timeline), ceea ce nu are sens pe o hartă care ar trebui să fie despre geografie. De asta pare aleatoriu/greșit.

---

## 3. Decizie de arhitectură: `/harta` separat de `/wiki`

**Recomandarea mea: DA, separă-le.** E soluția corectă, nu doar o preferință de gust — rezolvă simultan punctele 1.1, 2.3 și 2.4 de mai sus.

Propunere concretă:
- **`/harta`** — search-ul de aici întoarce *doar* entități geografice (castele, orașe, repere). Click = zoom pe hartă. Simplu, previzibil, fără zoom-uri ciudate pe personaje.
- **`/wiki`** — search propriu, separat, care acoperă tot (personaje, case, evenimente, obiecte, titluri, dragoni). Click = pagina completă de detalii, cu toate informațiile (biografie, relații, cronologie, surse).
- Dacă totuși pe hartă apare un rezultat non-geografic (ex. un eveniment cu locație asociată), search-ul îl trimite spre `/wiki#event-id`, nu încearcă să-l "arate" pe hartă unde nu are ce căuta ca marker propriu.

Asta transformă bug-ul de la 1.1 dintr-un "de reparat" într-un "nici nu ar trebui să existe în forma asta" — event-urile din search-ul de hartă dispar, apar doar în wiki, unde chiar au sens.

---

## 4. Alte probleme de UX (confirmate din capturi)

### 4.1 Slider-ul de ani ocupă hartă și nu are logică clară acolo jos
Confirmat — în capturi, bara de timeline fixă jos "mănâncă" din harta vizibilă permanent.
**Recomandare:** variantă colapsabilă/minimizabilă — o bară subțire, expandabilă la click/hover, sau tratată ca overlay peste hartă (nu spațiu fix rezervat).

### 4.2 Filtrul de hartă e prea mare / te pierzi
Confirmat din captura "map filtre foarte mare" — lista de subtipuri e plată, zeci de rânduri (ex: „castel/cetate”, „castel/domeniu”, „castel/reședință” etc.), fără grupare.
**Recomandare:** categorii mari colapsabile (Locații → Castele / Orașe-Sate / Repere naturale; Ape; Case pe regiune/dinastie), cu select-all/none per categorie. Subtipurile fine rămân disponibile, dar ascunse implicit sub categoria lor.

### 4.3 Admin map — nume de ape/mări + „coș de triaj” pentru date fără destinație clară
Ambele idei sunt fezabile și bune:
- **Nume pe ape** (Marea Îngustă, Golful Crabilor etc.) — tehnic e text SVG poziționat de-a lungul unei căi (`textPath`), stil hărți vechi ilustrate — nu e un obstacol tehnic mare.
- **„Coș de triaj”** pentru date fără direcție clară — ai deja `NEEDS_REVIEW.md` în proiect, deci problema e deja identificată de tine; îi lipsește doar o interfață. O pagină nouă în admin, cu listă needs-review + dropdown „trimite la: locations / events / objects / titles / etc.” e exact modelul corect de lucru.

---

## 5. Ideile tale bonus — verificare fezabilitate

| Idee | Fezabilitate | Observație |
|---|---|---|
| Filtru „Epoca Targaryen” | ✅ Ușor | Se leagă direct de `timeline`-urile deja existente pe fiecare locație/casă — nu trebuie date noi. |
| Import automat Markdown → JSON | ✅ Fezabil | Depinde de formatul exact al `.md`-urilor tale — trebuie să văd un exemplu ca să scriu parser-ul corect. |
| Dragoni & battle markers | ✅ Fezabil | `data/dragons` există deja ca structură separată — extinderea cu date de bătălie e o adăugare, nu o restructurare. |

---

## 6. Prioritizare recomandată (opinia mea, dacă vrei un punct de plecare)

1. **Arhitectura `/harta` vs `/wiki`** — rezolvă simultan 3 probleme raportate, deci are cel mai mare impact per efort.
2. **Distanța din carte ca sursă principală** — datele există deja (467 afirmații), doar trebuie schimbată ierarhia de afișare.
3. **Filtre grupate pe categorii** — impact mare de claritate, efort moderat.
4. **King's Landing** — necesită diagnostic live (consolă browser) înainte de fix.
5. **Iconițe pe tip de locație + pagina de wiki restructurată** — impact vizual mare, dar efort de design mai mare, se poate face incremental.
6. **Slider de ani, nume pe ape, coș de triaj admin** — îmbunătățiri secundare, se pot face oricând.

---

*Document generat pe baza inspecției directe a codului sursă din `data.zip` și a capturilor din `Imagini_dovezi.zip`. Nicio modificare de cod nu a fost făcută — acesta e doar auditul.*
