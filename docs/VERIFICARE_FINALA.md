# VERIFICARE FINALĂ — Atlas of Westeros v2

Sesiune de audit, read-only. Nicio modificare de cod, date sau configurație.
Data: 2026-08-04 · Branch: `master` · HEAD: `7d82dc5`

Ghidul de implementare a fost furnizat de utilizator în timpul sesiunii
(`GHID_Implementare_Atlas_v2.md`, 1353 linii). Anexa C există și a fost folosită
ca referință — secțiunea B nu mai este BLOCKED.

---

## Rezumat

| | |
|---|---|
| Total verificări | 62 |
| PASS | 38 |
| FAIL | 13 |
| WARNING | 5 |
| BLOCKED | 4 |
| SKIPPED (buget) | 2 |

**Probleme pe severitate:** 3 CRITICAL · 6 HIGH · 8 MEDIUM · 4 LOW

---

## Notă de metodă

Secțiunile H / Q / R au fost rulate **într-un browser real** (panoul Browser,
Chromium), nu cu Playwright/Puppeteer — niciunul nu este instalat în proiect.
`tools/audit_ui.mjs` nu a mai fost scris; driverul a fost înlocuit de execuție
directă în pagină. Rezultatele sunt observate, nu deduse.

**O corecție importantă de metodă.** Prima măsurătoare a arătat `#layer-locations`
gol — zero markere pe hartă. Nu este un bug de produs. `MapRenderer.updateWorldState()`
programează `renderLocationMarkers()` în `requestAnimationFrame`, iar panoul
Browser rulează cu `document.visibilityState === 'hidden'`, unde rAF nu se declanșează:

```
{"visibilityState":"hidden","hidden":true,"rafFiredWithin500ms":false,"elapsed":516}
```

Toate măsurătorile de hartă de mai jos au fost făcute după forțarea sincronă a
randării. Consecința reală a acestui design este raportată separat ca M-8.

---

# A. STAREA REPOSITORY (P0)

### A1 — `git status --short` → **FAIL** (așteptat: gol)

```
 M css/map.css
 M css/timeline.css
 M data/dragons/dragons.json
 M data/houses/houses.json
 M i18n/en.json
 M i18n/ro.json
 M js/app.js
 M js/data/DataManager.js
 M js/data/TimelineEngine.js
 M js/map/MapLayers.js
 M js/map/MapRenderer.js
 M js/ui/Timeline.js
?? data/_backups/
?? data/timeline/eras.json
```

12 fișiere modificate necommitate, inclusiv două fișiere de **date**
(`dragons.json`, `houses.json`). `data/timeline/eras.json` este **untracked dar
încărcat de aplicație** (`DataManager.loadAll`, linia 51) — o clonă curată a
repo-ului nu pornește. CLAUDE.md §6 cere oprirea lucrului pe un arbore murdar.

### A2 — `git log --oneline -40` → **PASS**

24 de commituri, unul per fază, fără amestec vizibil:

```
7d82dc5 feat(P8): interfata de triaj pentru cozile de lucruri nedecise
faefa81 feat(P7): reproiecteaza instrumentul de distanta pe trei niveluri
db012c8 feat(P6.2): separa search-ul hartii de cel din enciclopedie
a18a664 feat(P6.1): rutare reala pe History API, cu fallback pe hash
1ad7039 checkpoint: F2 taxonomie + P3.x i18n + F5 panouri
52bdcc9 Pre-migration checkpoint
...
```

### A3 — `git diff --stat HEAD~1 HEAD` → **PASS**

```
 .gitignore            |   5 +
 admin/triage.css      | 411 +++++
 admin/triage.html     | 104 ++++
 admin/triage.js       | 571 ++++++
 js/ui/DistanceTool.js |   2 +-
 server.py             |  50 ++
 tests/smoke.mjs       |  44 +-
 tests/test_triage.py  | 181 ++++
 triage.py             | 668 +++++++
 9 files changed, 2034 insertions(+), 2 deletions(-)
```

Fără reformatare masivă. Diff-ul necommitat separat (288+ / 108−) atinge
`dragons.json` (136 linii) și `houses.json` (32 linii) — vezi A1.

### A4 — `git fsck` → **WARNING**

40 de obiecte dangling (blob + tree). Fără erori de integritate. Normal după
rebase/amend, dar merită `git gc`.

### A5 — `git count-objects -v` → **WARNING**

```
count: 1564   size: 75972   in-pack: 1506   packs: 2
size-pack: 123592   prune-packable: 1151
garbage: 19   size-garbage: 490114
```

19 fișiere `tmp_obj_*` reziduale, 490 MB de garbage. Scrieri întrerupte
(probabil OneDrive — vezi nota de mediu). `git gc --prune=now` le curăță.

### A6 / A7 — branches → **PASS** · A8 — `git stash list` → **PASS** (gol)

---

# B. SMOKE TEST (P0)

`node tests/smoke.mjs` → **exit code 0** ✅

Tabelul complet este reprodus în transcript; rândurile relevante față de Anexa C:

| Metrică Anexa C | Țintă v2 | Măsurat | Verdict |
|---|---|---|---|
| Locații încărcate | 1099 | **1099** | PASS |
| Locații în `getAllLocations()` | de stabilit în P2.1 | 694 | INFO |
| **Locații cu pin pe hartă** | **≥ 150** | **80** | **FAIL** |
| Checkbox-uri în filtru | < 12 vizibile | 8 bifabile / 13 controale | PASS |
| Evenimente accesibile prin timeline | 1561 | **1568** | PASS |
| Evenimente cu locație rezolvată | 875 | **875** | PASS |
| Personaje cu casă rezolvată | 631 | **631** | PASS |
| Obiecte + titluri în search | 370 | **370** (276+94) | PASS |
| Entități care crapă la click | 0 | **0** | PASS |
| **Încărcare inițială** | **< 40 MB paralel** | **74.26 MB**, paralel | **FAIL** |
| Limbi de interfață | 2 complete | 2 (dicționar), ~1 (entități) | WARNING |

Smoke test-ul **nu încarcă `data/timeline/eras.json`**, deși `DataManager` îl
cere. Un `eras.json` lipsă sau invalid trece de smoke și pică în browser.

---

# C. CABLAJ (P0)

Măsurat cu `tools/verify_final.mjs` (JSON de pe disc + `mapCompatibility`).

| # | Verificare | Așteptat | Măsurat | Verdict |
|---|---|---|---|---|
| C1 | predicate care aruncă pentru `id_intern` array | 0 | **0** (3 locații au array: `kings_landing`, `storm_end`, `oldtown_city`) | PASS |
| C2 | evenimente care rezolvă la o locație | 875 | **875** core / 881 runtime | PASS |
| C3 | `membru_al` rezolvat după `HOUSE_` | 631 | **631 / 631** | PASS |
| C4 | obiecte în indexul de search | 276 | **276** | PASS |
| C5 | titluri în indexul de search | 94 | **94** | PASS |
| C6 | `maxYear` folosit de Timeline | 302 | **302** | PASS |
| C7 | fetch-uri cu `response.ok` | toate | **toate** | PASS |
| C8 | fetch-uri în `Promise.all` | toate | **16 paralel, 1 serial** | WARNING |

**C7 — dovadă.** `js/data/DataManager.js:68-71`:

```js
const response = await fetch(`${this.basePath}${url}`);
if (!response.ok) {
  throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
}
```

`js/data/DataManager.js:178-181` (timeline) și `js/i18n/index.js:114-117`
(dicționare) au aceeași gardă. Zero `fetch` fără verificare în `js/`.

**C8 — dovadă.** Cele 16 seturi statice sunt în `Promise.all`
(`DataManager.js:66-75`). Dar snapshot-urile de timeline rămân într-un `for`
secvențial cu `await` înăuntru (`DataManager.js:177-183`):

```js
const timelineYears = [1];
for (const yr of timelineYears) {
  const response = await fetch(`${this.basePath}data/timeline/year_${yr}.json`);
```

Cu un singur an în array impactul e nul azi. Comentariul îl declară „Extensible
array" — la al doilea an devine serial. WARNING, nu FAIL.

**C6 — observație suplimentară.** `maxYear` este corect 302, dar `minYear`
ajunge **−600**:

```json
{"sliderMin":"-600","sliderMax":"302","eventBounds":{"min":-600,"max":302},
 "eventsWithYear":1568,"reachableOnSlider":1568}
```

Un singur eveniment (`uncloaking_of_uthero`, −600, din `free_cities_events.json`)
întinde sliderul peste 902 ani. Între −600 și −115 există **exact 1 eveniment**,
adică 54% din slider acoperă un singur punct. Vezi M-3.

---

# D. TAXONOMIE (P0)

| # | Verificare | Așteptat | Măsurat | Verdict |
|---|---|---|---|---|
| D1 | `getAllLocations()` | raportează | **694** | INFO |
| D2 | `type:"location"` neclasificate | ~0 | **217** | **FAIL** |
| D3 | `classification_confidence=low` în date live | 0 | **0** | PASS |
| D4 | intrări în `taxonomy_override` | listează | **câmpul nu există nicăieri în proiect** | BLOCKED |

D3, histograma completă: `{"(absent)":608, "high":401, "medium":90}`. Zero `low`.
Dar 608 din 1099 de înregistrări nu au deloc câmpul — clasificarea nu a acoperit
55% din date.

D2, histograma de tipuri:

```
location 217 · castle 185 · landmark 122 · stronghold 91 · urban_feature 67
structure 60 · settlement 48 · interior 41 · region 35 · island 33 · city 30
watercourse 29 · route 27 · town 26 · landform 25 · water 19 · fortress 16
non_place 16 · ruins 12
```

217 înregistrări încă `type:"location"` — P2.3 nu s-a terminat. Ele sunt excluse
din `getAllLocations()` și din search, deci sunt invizibile în produs, dar
selectabile ca capete de distanță.

### D5 — cele 8 cazuri de regresie → **PASS**

```
kings_landing        type=castle    subtip=null                          pin=true
crakehall            type=castle    subtip="castel/regiune (Westerlands)" pin=false
acorn_hall           type=castle    subtip="castel mic (ziduri de piatră…)" pin=true
brightwater_keep     type=castle    subtip="castel"                      pin=false
maidenpool           type=city      subtip="oraş/port"                   pin=false
blackpool            type=town      subtip=null                          pin=false
harroway_town        type=city      subtip=null                          pin=false
boneway              type=landmark  subtip="drum"                        pin=false
```

Niciun castel nu este clasificat `interior`, `chamber`, `lake` sau `road`.
Regula de acceptanță ține. `boneway` = `landmark` cu subtip „drum" este corect
(este un drum, nu un castel).

---

# E. BILINGV (P0)

| # | Verificare | Așteptat | Măsurat | Verdict |
|---|---|---|---|---|
| E1 | `grep -c "TODO:" i18n/*.json` | 0 | **en=0, ro=0** | PASS |
| E2 | nr. chei en vs ro | egale | **322 / 322**, zero diferențe | PASS |
| E3 | entități cu `name_en == name_ro` | raportează | **5 din 51** care au ambele | vezi mai jos |
| E4 | `innerHTML = "literal cu majusculă"` în `js/ui/` | 0 | **0** | PASS |
| E5 | „Debarcaderul Regelui" cu interfața EN | rezultat | **10 rezultate, primul `kings_landing`** | PASS |
| E6 | „King's Landing" cu interfața RO | rezultat | **5 rezultate, primul `kings_landing`** | PASS |

E3 — cele 5 identice sunt exact cei 5 dragoni (`balerion`, `vhagar`, `meraxes`,
`caraxes`, `syrax`), nume proprii valyriene care nu se traduc. Corect.

**Problema reală nu e E3, ci acoperirea.** Din 5282 de intrări în index, doar
**46** își schimbă numele afișat între RO și EN:

```
E3 entities carrying BOTH name_ro and name_en: 51; of those name_ro === name_en: 5
    entities whose displayName differs ro vs en: 46
```

Stratul i18n de interfață e complet (322/322 chei). Stratul de **nume de entități**
este la sub 1%. „2 limbi complete" din Anexa C nu este atins pentru conținut.

**Și mai grav: numele care există sunt parțial greșite.** Vezi CRITICAL-1.

---

# F. HARTĂ (P0)

| # | Verificare | Așteptat | Măsurat | Verdict |
|---|---|---|---|---|
| F1 | mutare de pin rescrie doar `catalog.json` | da | cod: da; runtime: netestat | **BLOCKED** |
| F2 | `grep -n "hightower" js/map/MapRenderer.js` | 0 | **0** | PASS |
| F3 | `highgarden`, `storm_end`, `castle_black` au pin | toate 3 | **2 din 3** | **FAIL** |
| F4 | cele 14 `CAPITAL_LOCATIONS` au etichetă vizibilă | da | **14 / 14** | PASS |

**F1 — BLOCKED, cu justificare.** Testul runtime (POST pe `/api/save-coordinates`)
a fost respins de clasificatorul de sandbox al sesiunii. Nu îl marchez PASS pe
baza codului. Ce se poate afirma din cod, verificat: `server.py:177-178` citește
`LOCATION_FILES` doar pentru validarea id-urilor, iar `server.py:199` scrie
exclusiv `CATALOG`. `write_json` (linia 36-43) compară bytes înainte de scriere.
Checksum-uri înregistrate înainte de test, pentru operatorul uman:

```
bbfee731fe9179ad3597f6fb6bd312114f7d9b9047176d7a40d1ab9be06bdcfa  data/locations/locations.json
5abcae4158e51e0bd19c02d8f56b9988579da1054c7183eb9d5f12813800af03  data/map/catalog.json
```

**F3 — dovadă:**

```
highgarden       pin=true   inLocations=true
storm_end        pin=true   inLocations=true
castle_black     pin=false  inLocations=true
```

`castle_black` nu are pin. Nu e în `CAPITAL_LOCATIONS`, deci F4 trece oricum, dar
P4.4 îl cerea explicit alături de celelalte două. Silueta lui custom din
`MapRenderer.js` rămâne cod care nu se execută.

**F4 — dovadă** (după randare forțată, viewBox implicit 1500×1000):

```json
{"labelsTotal":89,"labelsVisible":49,"capitalsWithVisibleLabel":"14/14"}
```

Toate cele 14 capitale au etichetă vizibilă, inclusiv `kings_landing` și
`oldtown_city` (cele două cu paranteză în nume, care cădeau în v1).
Criteriul P4.3 este îndeplinit.

**F3 — total pinuri: 80**, față de ținta Anexa C de ≥150. FAIL (vezi B).

---

# G. SECURITATE (P0)

| # | Verificare | Așteptat | Măsurat | Verdict |
|---|---|---|---|---|
| G1 | `server.py` ascultă pe `127.0.0.1` | da | **da** | PASS |
| G2 | conexiune de pe IP-ul LAN | refuzată | **refuzată** | PASS |
| G3 | `eval(` / `new Function(` în `js/` | 0 | **0** | PASS |
| G4 | `outerHTML` / `insertAdjacentHTML` | listează | **0 apariții** | PASS |
| G5 | path traversal | blocat | **blocat peste rădăcină; tot repo-ul servit** | WARNING |
| G6 | regex cu backtracking catastrofal | listează | **0 nested quantifiers** | PASS |
| G7 | `fetch` fără `response.ok` | 0 | **0** | PASS |

**G1 — dovadă:** `server.py:301` → `default='127.0.0.1'`. Confirmat cu netstat:

```
TCP    127.0.0.1:8753    0.0.0.0:0    LISTENING    23408
```

**G2 — dovadă:**

```
* Trying 192.168.0.111:8753...
* connect to 192.168.0.111 port 8753 from 0.0.0.0 port 64953 failed: Connection refused
curl: (7) Failed to connect to 192.168.0.111 port 8753 after 2049 ms
```

**G5 — dovadă:**

```
/../../../Windows/win.ini      -> 404 335b
/..%2f..%2fWindows/win.ini     -> 404 335b
/data/../server.py             -> 200 16007b  text/x-python
/.git/config                   -> 200 332b
/CLAUDE.md                     -> 200 9212b
/triage.py                     -> 200 26332b
/data/_backups/                -> 200 470b    (listare de director)
/nonexistent-route             -> 200 2411b   (SPA fallback, corect)
/api/nope                      -> 404 335b    (corect, nu e rescris)
```

Ieșirea din rădăcină este blocată corect de `SimpleHTTPRequestHandler`. Dar
**tot conținutul repo-ului este servit**, inclusiv `.git/config`, sursele Python
și listările de directoare. Pe loopback riscul e mic; devine serios în momentul
în care cineva pornește cu `--host 0.0.0.0`. Vezi M-1.

---

# O. DATE (P0)

| Categorie | Rezultat | Verdict |
|---|---|---|
| `id` duplicate în același tip | **0** în toate cele 7 colecții | PASS |
| `id_intern` duplicate | **0** | PASS |
| alias duplicate cross-tip | **0** (43 în cadrul aceluiași tip) | PASS |
| **coliziuni de `id` între tipuri** | **46** | **FAIL** |
| referințe lipsă (character→house, event→location, location→parent, catalog→location) | **0** | PASS |
| `house.seat` → location | **27 nerezolvabile** | **FAIL** |
| referințe circulare `parent_id` | **0** | PASS |
| locații cu `parent_id` | 27 / 1099 | INFO |

Totaluri: `location 1099 · house 236 · character 2288 · event 1689 · object 276 ·
title 94 · dragon 5`.

**Coliziuni cross-tip (46)** — aceleași id-uri există ca locație *și* ca
casă (și, pentru `wyl`, și ca personaj):

```
crakehall, yronwood, hornwood, darry, redfort, sarsfield, banefort, cuy,
blackmont, vaith, wyl (location+house+character), tarth, estermont, rosby,
stokeworth, hayford, volmark, harlaw, saltcliffe, blacktyde, … (26 more)
```

Acest lucru este *în parte* legitim (casa Darry și castelul Darry sunt entități
diferite cu același nume), dar rutele wiki sunt `/wiki/:kind/:id`, deci
`/wiki/house/darry` și `/wiki/location/darry` coexistă corect. Riscul real este
în `parts.js:getEntityById()`, care rezolvă **fără tip**, în ordinea
locations → houses → characters, deci un link intern către casa `darry` va
deschide castelul. Vezi M-6.

**`house.seat` — 27 nerezolvabile, din care 26 din același motiv de schemă.**
Vezi CRITICAL-3 / HIGH-1.

---

# P. SEARCH (P1) — **PASS cu 2 excepții**

20 de interogări × 2 limbi de interfață. Rezultatele sunt **identice** în RO și
EN, ceea ce confirmă INV-S1 (indexul nu depinde de limbă).

| query | tip | primul rezultat | ținta găsită |
|---|---|---|---|
| Debarcaderul Regelui | location | `kings_landing` / castle | **DA** |
| King's Landing | location | `kings_landing` / castle | **DA** |
| Fortareata Rosie | location | `kings_landing` / castle | vezi nota |
| winterfell | location | `winterfell` / castle | DA |
| LOCATION_WINTERFELL | location | `winterfell` / castle | DA |
| targaryen | house | `targaryen` / house | DA |
| Casa Stark | house | `stark` / house | DA |
| lannister | house | `lannister` / house | DA |
| Eddard Stark | character | `eddard_stark` | DA |
| ned | character | `eddard_stark` | DA |
| Jon Snow | character | `jon_snow` | DA |
| Balerion | dragon | `balerion` / dragon | DA |
| Vhagar | dragon | `vhagar` / dragon | DA |
| Syrax | dragon | `syrax` / dragon | DA |
| Gheara | object | `gheara_lunga` / object | DA |
| Ac | object | `acorn_hall` / castle | slab |
| Mana Regelui | title | eveniment, nu titlu | **NU** |
| Lord Comandant | title | `jeor_mormont…` / character | **NU** |
| Batalia Apei Negre | event | eveniment corect | DA |
| Blackwater | event | `trident` / landmark | slab |

Diacriticele funcționează („Fortareata Rosie" fără diacritice găsește entitatea).
Case-insensitive funcționează. Căutarea după `id` și `id_intern` funcționează.

**Excepția 1:** nu există entitate `red_keep`. „Fortăreața Roșie" cade pe
`kings_landing` pentru că numele *ei românesc este greșit* (CRITICAL-1), iar
Fortăreața Roșie propriu-zisă este fragmentată în 5 înregistrări separate
(`fortareata_rosie_debarcaderul_regelui`, `fortareata_rosie_fortareata_lui_maegor`,
`fortareata_rosie_turnul_mainii`, `fortareata_rosie_implicit_locul_scenei…`,
`cetatea_rosie_fortareata_rosie`).

**Excepția 2:** titlurile sunt greu de atins prin căutare naturală — interogări
evidente ca „Mâna Regelui" sau „Lord Comandant" returnează evenimente și
personaje înaintea titlurilor. Titlurile sunt indexate (94/94), dar id-urile lor
încep cu `titlul_…`, ceea ce diluează scorul de prefix.

---

# Q + H. UI, PARCURGERE AUTOMATĂ (P1) — **PASS**

Eșantion cu seed 42, PRNG `mulberry32`, ID-urile complete sunt listate în
Anexa 1 de mai jos. 185 de entități deschise prin `app.selectEntity()`:

```json
{"counts":{"location":50,"character":50,"house":20,"event":20,
           "object":20,"title":20,"dragon":5},
 "exceptions":0,"errors":[],
 "consoleErrorsDuringSweep":0,"sampleConsoleErrors":[]}
```

**Zero excepții necaptate. Zero erori de consolă.** (Dragoni: 5, nu 20 — atât
există. Vezi HIGH-4.)

| # | Scenariu | Rezultat | Verdict |
|---|---|---|---|
| H1 | click pe King's Landing din search | panou deschis, consolă curată — dar titlul afișat este „Fortăreața Roșie" | **FAIL** (vezi CRITICAL-1) |
| H2 | click pe un eveniment | panou + buton „Vezi pagina completă" → `/wiki/event/batalia_de_la_apa_neagra` | PASS |
| H3 | căutare personaj | fără zoom haotic | PASS |
| H4 | distanță Harrenhal + King's Landing din dropdown | 4 afirmații, marcate `magnitude+emphasis` | PASS |
| H5 | 20 entități aleatorii | 0 excepții (rulat pe 185) | PASS |

H2 — dovadă (text randat în panou):

```
Bătălia de la Apa Neagră | 📜 Eveniment • historical · An 302 AC 🟢 ·
Locație Râul Apa Neagră ✓ · Participanți Stannis Baratheon ✓ · Vezi pagina completă →
href=/wiki/event/batalia_de_la_apa_neagra
```

H4 — confirmat și de smoke test: `harrenhal↔kings_landing statements → 4, magnitude+emphasis`.

---

# R. NETWORK (P1) — **FAIL pe buget, PASS pe erori**

98 de requesturi, **zero 404, zero 500, zero request eșuat**. Toate JSON-urile,
fonturile și emblemele se încarcă (200 OK).

```json
{"requests":98,"transferKB":76071,"decodedMB":74.26,
 "dataRequestCount":21,"dataStartSpreadMs":404.9,
 "byExt":{"png":"45523KB","json":"29948KB","js":"378KB","woff2":"135KB","css":"58KB"}}
```

Top assets:

| Asset | KB |
|---|---|
| `assets/Mapa/HARTA LUMII.png` | **45 357** |
| `data/characters/characters.json` | 12 350 |
| `data/locations/locations.json` | 7 444 |
| `data/events/events.json` | 5 789 |
| `data/houses/houses.json` | 3 673 |

Cerințele Anexa C: **„< 40 MB paralel"**. Paralelismul este atins (21 de cereri
de date pornite într-o fereastră de 405 ms, prin `Promise.all`). Volumul **nu**:
74.26 MB, de 1.86× peste țintă. `transferKB ≈ decodedMB` ⇒ **serverul nu comprimă
nimic**; `characters.json` s-ar reduce sub 2 MB cu gzip.

---

# I. ARHITECTURĂ (P2)

- Fișiere > 600 linii: **1** — `js/map/MapRenderer.js` (1352). `js/ui/WikiPage.js`
  are 798. Restul sunt sub prag.
- `console.log` / `TODO` / `FIXME` / `HACK` / `debugger` în cod de producție: **0**.
  Cele 3 potriviri din `js/i18n/dictionary.js` sunt constanta `TODO_MARKER = 'TODO:'`,
  care este mecanismul de fallback, nu un rest.
- Importuri circulare: `js/i18n/index.js` ↔ `js/i18n/entityName.js` este documentat
  și rupt intenționat (`entityName.js` nu importă `index.js`). Nicio buclă reală.
- Cod mort confirmat eliminat: ramura `hightower` (F2 = 0 potriviri).

# J. PERFORMANȚĂ (P2)

Un singur caz real în hot path, măsurat, nu presupus:

`MapRenderer.js:704-734` — algoritmul de decluttering este **O(n² × 3)** peste
`locations`. Cu 53 de puncte randate: 3 × 53 × 52 / 2 = **4134 de comparații**,
neglijabil. Devine 3 × 150² / 2 ≈ 33 750 la ținta Anexa C de 150 de pinuri —
tot acceptabil. **Nu este o problemă azi.**

`DataManager.getCastle/getCity/getHouse/getCharacter/getEvent/getObject/getTitle`
folosesc `.find()` liniar (linii 244-282). `getCharacter` scanează 2288 de
înregistrări per apel. `getLocation` are index O(1); celelalte nu. Timeline
`resolveKing()` apelează `getHouse()` la fiecare schimbare de an. Impact mic la
scara curentă, dar este exact inconsistența pe care indexul de locații a rezolvat-o.

# K. MEMORY LEAKS (P2)

- **50 `addEventListener`, 0 `removeEventListener`** în tot `js/`.
- `setInterval` 1 / `clearInterval` 1 — echilibrat (playback timeline).
- Majoritatea listenerelor sunt pe singletoni cu viață cât pagina — inofensive.
- **Excepția reală:** `js/ui/panels/parts.js:139` — `createFullPageButton()` atașează
  un `click` la **fiecare** randare de panou. Panoul se re-randează la fiecare
  `selectEntity`. În sweepul de 185 de entități s-au creat 185 de butoane, fiecare
  cu listenerul lui; nodurile vechi sunt înlocuite prin `innerHTML = ''`, deci GC-ul
  le colectează. Scurgere lentă, nu permanentă. LOW.
- Zero `MutationObserver` / `ResizeObserver` / `IntersectionObserver` în proiect.

# L. RACE CONDITIONS (P1)

- `window.atlasDataManager` este setat abia la **finalul** lui `loadAll()`
  (`DataManager.js:186`), dar `MapRenderer.init()` îl citește
  (`MapRenderer.js:402-404`) cu `?.` și cade pe `DEFAULT_WORLD_CANVAS`. Ordinea
  din `app.init()` este corectă azi; garda este optional chaining, nu o
  precondiție explicită. WARNING.
- `updateWorldState()` coalescează scrubbing-ul prin rAF cu `_pendingWorldState`
  — corect implementat, ultima stare câștigă.
- **M-8** (mai jos) este singurul caz reproductibil.

# M. EXCEPȚII (P1)

- `catch` gol: **1** — `admin/map-editor.js:27` (`catch { … }` pe ping, deliberat,
  are fallback vizibil).
- `MapRenderer.js:766` prinde și **doar loghează** eșecul de actualizare a unui
  marker. Un marker care eșuează dispare, harta pare completă. Capcana este
  documentată în CLAUDE.md §4.9 și **încă există**.
- `app.init().catch(console.error)` — CLAUDE.md §4.9 o descrie ca înghițind erori
  și lăsând ecranul de loading blocat. Verificat: ecranul de loading **se ascunde**
  corect la boot (`loadingVisible:false`), deci simptomul nu s-a reprodus.
- `throw` înghițit: niciunul găsit.

# N. CONSISTENȚĂ (P2) — SKIPPED (buget)

# S. ASSETS (P2) — parțial

`data/characters/characters.backup_compound_fix.json` — **11.9 MB**, în arborele
servit, urmărit în git, nereferențiat de niciun cod. Recuperabil integral.
`data/map/_legacy_unused/` (5 fișiere) este deja izolat prin nume.

# T. DIMENSIUNI (P2)

| Tip | Top |
|---|---|
| Imagini | `HARTA LUMII.png` **45 357 KB**; apoi embleme, max 12.4 KB |
| JSON (live) | characters 12 350 · locations 7 444 · events 5 789 · houses 3 673 |
| JSON (mort) | `characters.backup_compound_fix.json` 11 903 |
| JS | MapRenderer 57 · WikiPage 36 |
| CSS | panels 34.9 · map 8.6 · timeline 6.1 |

---

# Probleme, grupate pe severitate

## CRITICAL

### CRITICAL-1 — Numele românești de locație sunt greșite, nu doar lipsă
- **Fișier:** `data/locations/locations.json`
- **Componentă:** date / P3.2 (split de nume pe limbi)
- **Descriere:** din cele 56 de locații care au și `name_ro` și `name_en`, cel
  puțin 7 perechi denumesc **locuri diferite**. Cel mai vizibil:

| id | `name_ro` | `name_en` | ce e greșit |
|---|---|---|---|
| `kings_landing` | **Fortăreața Roșie** | King's Landing (Aegonfort) | Fortăreața Roșie e o clădire *în* Debarcaderul Regelui |
| `white_harbor_city` | **Gâtul** | White Harbor | Gâtul e o regiune la 1000 de mile distanță |
| `garda_apei_cenusii` | Garda Apei Cenușii | **Stone Door** | perechi complet nelegate |
| `fundatura_puricilor` | Fundătura Puricilor | **King's Landing** | Flea Bottom ≠ orașul |
| `strada_otelului` | Strada Oțelului | **King's Landing** | idem |
| `casa_celor_nemuritori` | Casa Celor Nemuritori | **House of Dust** | e House of the Undying |
| `the_eyrie` | **Ținutul Eyrie** | The Eyrie | „Ținutul" = regiunea, nu castelul |

- **Impact:** interfața pornește pe **RO**. Capitala Westerosului se afișează în
  panou, în wiki și în rezultatele de căutare drept „Fortăreața Roșie". Este
  informație de canon greșită, prezentată ca fapt, exact ce interzice Anexa B §2.
- **Reproducere:** pornește serverul, click pe King's Landing → panoul scrie
  „Fortăreața Roșie". Verificat live:
  `{"name_ro":"Fortăreața Roșie","name_en":"King's Landing (Aegonfort)"}`
- **RECOMANDARE:** `name_ro` pentru aceste 7+ înregistrări nu poate fi reparat
  automat — trece la triaj manual (`admin/triage.html` există deja pentru asta).
  Până atunci, `name_ro` greșit e mai rău decât absent: un `name_ro` care nu a
  trecut prin triaj ar trebui ignorat de `resolveName()`, care ar cădea pe pasul 4
  (numele brut). Cauza este în **date**, nu în cod — `entityName.js` face exact ce
  trebuie cu ce primește.

### CRITICAL-2 — Dragonii există de două ori, cu același `id`, ca tipuri diferite
- **Fișier:** `data/dragons/dragons.json` + `data/objects/objects.json`
- **Descriere:** `balerion`, `vhagar`, `meraxes` există **și** în `dragons.json`
  (tip `dragon`) **și** în `objects.json` (tip `object`), cu id identic. În
  `objects.json` mai sunt 4 dragoni fără pereche: `cannibal`, `dreamfyre`,
  `silverwing`, `vermithor`, toți cu `categorie: "obiect / ființă (dragon)"`.
- **Impact:** indexul de search conține ambele intrări pentru aceeași creatură;
  `/wiki/object/balerion` și `/wiki/dragon/balerion` sunt două pagini pentru
  același Balerion, cu date diferite (cea din objects are descrieri sursate
  bogate, cea din dragons are `birth`/`death`/`riders`). `parts.js:getEntityById()`
  rezolvă fără tip și va lega greșit.
- **Reproducere:**
  ```
  node -e "…objects.json… filter(id in ['balerion','vhagar','meraxes'])"
  → 3 înregistrări, categorie 'obiect / ființă (dragon)' sau null
  ```
- **RECOMANDARE:** cei 7 dragoni din `objects.json` sunt sursa mai bogată
  (au `descrieri` + `surse` la nivel de pagină). Migrează-i în `dragons.json`
  păstrând `descrieri`/`surse`, și marchează înregistrările din `objects.json` ca
  deprecate (nu le șterge — CLAUDE.md §5.4).

### CRITICAL-3 — `metadata.seat` este un array de obiecte pentru 26 de case
- **Fișier:** `data/houses/houses.json`
- **Descriere:** 26 din cele 152 de case care au `metadata.seat` îl au ca **array
  de înregistrări de proveniență**, nu ca string:
  ```json
  "seat": [{"predicate":"seat","valoare":"LOCATION_BLACKTYDE",
            "confidence":"canon","source_book":"Înclestarea Regilor"}, …]
  ```
  Aceasta este **exact aceeași clasă de bug** ca `id_intern` array (CLAUDE.md §4.2),
  care a fost reparată pentru `id_intern` și ratată pentru `seat`.
- **Case afectate:** `blacktyde, butterwell, casele_slate_long_holt_ashwood,
  casterly, caswell, chester, durrandon, footly, franklyn, greystark, humble,
  loraq, merlyn, orkwood, pahl, piper, plumm, poole, pryor, reyne, saltcliffe,
  serry, sunderland, sunderly, tarbeck, webber`
- **Consecințe** — două, ambele confirmate live (vezi HIGH-1 și HIGH-2).
- **RECOMANDARE:** cauza e în **date**, dar reparația corectă e în **cod**:
  `mapCompatibility` normalizează deja `id_intern` prin `toInternIds()`. Adaugă
  aceeași normalizare pentru `seat` (extrage `valoare` din prima înregistrare,
  păstrează restul ca surse). Aceasta e și reparația care alimentează `SourceCite`
  cu proveniența pe care datele o poartă deja.

## HIGH

### HIGH-1 — „[OBJECT OBJECT]" apare în interfață pentru 26 de case
- **Fișier:** `js/ui/panels/parts.js:126-129` (`formatStatus`), apelat din
  `js/ui/panels/houseSummary.js:25-27`
- **Descriere:** `formatStatus(seat)` face `String(seat).replace(/_/g,' ').toUpperCase()`.
  Pe un array de obiecte rezultă literal `[OBJECT OBJECT],[OBJECT OBJECT]`.
- **Reproducere:** click pe Casa Blacktyde. Text randat, capturat live:
  ```
  ×Casa Blacktyde🔴HOUSE Fișă sumară♦RegiuneTHE IRON ISLANDS🟢
  Reședință / Capitală[OBJECT OBJECT],[OBJECT OBJECT]🟢Vezi pagina completă →
  ```
- **Impact:** text corupt vizibil în produs, pentru 26 de case. Badge-ul verde
  „🟢 canon" îl prezintă ca informație sursată.

### HIGH-2 — Aceleași 26 de case nu au poziție pe hartă
- **Fișier:** `js/map/mapTarget.js:57-60`
- **Descriere:** `stripEntityPrefix(String(seatId))` produce
  `"[object object],[object object]"`, `getLocation()` întoarce `undefined`,
  `resolveMapTarget()` întoarce `null`.
- **Impact:** `hasMapPosition()` e fals ⇒ butonul „arată pe hartă" lipsește și
  camera nu zboară la sediu pentru acele 26 de case, deși sediul **este** în date
  (`LOCATION_BLACKTYDE` există).
- **Reproducere:** `dm.getLocation(String(dm.getHouse('blacktyde').seat))` → `undefined`.

### HIGH-3 — Stratul de bătălii ratează 19 din 21 de bătălii
- **Fișier:** `js/map/MapRenderer.js:649-651` + `data/events/events.json`
- **Descriere:** stratul filtrează `event.type === 'battle'`. Dar **1662 din 1689
  de evenimente nu au deloc câmpul `type`**:
  ```
  event type histogram: [["(none)",1662],["battle",8],["political",8],
    ["conquest",5],["coronation",2],["founding",1],["death",1],…]
  ```
  Din 21 de evenimente al căror **nume** este o bătălie sau un asediu, doar 2 au
  `type:"battle"`; 19 nu au tip deloc — inclusiv `batalia_de_la_apa_neagra`,
  `batalia_campiilor_de_foc`, `batalia_clopotelor`, `asediul_raventree_ului`.
- **Impact:** stratul „Bătălii" randează 7 markere. Criteriul P7.4 („markere de
  bătălii … evenimentele de tip bătălie cu locație rezolvabilă") nu e îndeplinit.
- **RECOMANDARE:** cauza e în **date** (câmp `type` necompletat la extragere), nu
  în cod. Nu repara filtrul lărgindu-l cu regex pe nume — asta ar inventa o
  taxonomie. Completează `type` prin triaj.

### HIGH-4 — `dragons.json` are 5 din ~26 de dragoni prezenți în date
- **Fișier:** `data/dragons/dragons.json`
- **Descriere:** fișierul a crescut de la 3 (stub-ul din P7.4) la 5. Dar numele de
  dragoni care apar în `events.json` sunt **26**:
  ```
  Balerion, Vhagar, Meraxes, Caraxes, Syrax, Vermithor, Silverwing, Seasmoke,
  Sunfyre, Moondancer, Tessarion, Vermax, Arrax, Tyraxes, Stormcloud, Morghul,
  Shrykos, Dreamfyre, Meleys, Cannibal, Sheepstealer, Grey Ghost, Drogon,
  Rhaegal, Viserion, Quicksilver
  ```
  7 dintre ei au deja înregistrare proprie, cu descrieri și surse — **în
  `objects.json`** (vezi CRITICAL-2). Cei 3 din canonul principal (Drogon,
  Rhaegal, Viserion) apar în `events.json` și `characters.json` dar nu au
  înregistrare nicăieri.
- **Impact:** cerința 2 din P7.4 („extrage din datele existente tot ce se poate
  … RAPORTEAZĂ ce ai găsit") a fost aplicată la 5 dragoni din 26. Wiki-ul de
  dragoni este la ~19% din ce susțin datele proiectului.
- **Confirmă observația utilizatorului.**

### HIGH-5 — Bugetul de încărcare este depășit de 1.86×
- **Măsurat:** 74.26 MB decodat / 76.07 MB transferat, țintă Anexa C < 40 MB.
- **Cauza dominantă:** `assets/Mapa/HARTA LUMII.png` = **45.4 MB**, adică 61% din
  total, pentru o hartă randată la maximum 1080×720 px.
- **A doua cauză:** serverul nu comprimă (`transferKB ≈ decodedKB`).
  `characters.json` 12.35 MB → sub 2 MB cu gzip.
- **RECOMANDARE:** re-encodează harta (WebP/AVIF sau PNG cuantizat + tiling la
  zoom). La 1080 px lățime efectivă, 45 MB sunt ~40× peste necesar. Adaugă
  `Content-Encoding: gzip` în `server.py`. Cele două împreună aduc încărcarea sub
  10 MB fără să atingă datele.

### HIGH-6 — Arborele de lucru nu este curat (P0 §A1)
- 12 fișiere modificate necommitate, două dintre ele fișiere de date.
- `data/timeline/eras.json` este **untracked dar încărcat obligatoriu** de
  `DataManager.loadAll()`. O clonă curată a repo-ului **nu pornește**: fetch-ul
  întoarce 404, `response.ok` este fals, `loadAll` aruncă.
- **Reproducere:** `git clone` într-un director nou → `python server.py` →
  aplicația se oprește la încărcare.

## MEDIUM

### M-1 — Serverul expune tot repo-ul, inclusiv `.git/`
`/.git/config`, `/server.py`, `/triage.py`, `/CLAUDE.md` întorc 200. Listarea de
directoare e activă (`/data/_backups/` → 200). Pe `127.0.0.1` riscul e mic;
`--host` este un flag public (`server.py:301`) și mută asta în LAN instant.
**RECOMANDARE:** allowlist de prefixe servite (`/js`, `/css`, `/data`, `/assets`,
`/i18n`, `/admin`, `/index.html`) + `list_directory` dezactivat.

### M-2 — API-ul de scriere nu are autentificare, CSRF sau verificare de origine
`do_POST` / `do_PUT` / `do_DELETE` acceptă orice cerere. `read_body()`
(`server.py:47-49`) face `json.loads` fără să verifice `Content-Type`, iar nimic
nu verifică `Origin` sau `Referer`. Un formular cross-origin cu
`enctype="text/plain"` este o „simple request" (fără preflight CORS) al cărei
corp poate fi construit ca JSON valid — deci orice site deschis în paralel poate
apela `/api/locations`, `/api/houses` și `/api/save-coordinates`.
`DELETE` este protejat incidental de preflight, `POST` nu.
**Confirmare runtime: NU s-a executat** — testul a fost respins de clasificatorul
de sandbox al sesiunii. Constatarea este din citirea codului și este marcată ca
atare, conform regulii anti-halucinare 2.
**RECOMANDARE:** respinge cererile al căror `Content-Type` nu e exact
`application/json` și cele cu `Origin` prezent și diferit de `http://127.0.0.1:<port>`.

### M-3 — Sliderul de timeline se întinde pe 902 ani pentru un singur eveniment
`minYear` devine −600 din `uncloaking_of_uthero` (`free_cities_events.json`).
Între −600 și −115 există **1 eveniment**; 54% din slider este gol. Epocile
declarate în `eras.json` încep la −114, deci intervalul −600…−115 nu e acoperit
de nicio epocă.
**RECOMANDARE:** limitează `eventBounds` la un percentil (sau la minimul epocilor)
și tratează valorile extreme ca outlieri accesibili prin epocă, nu prin slider.

### M-4 — 217 locații încă `type:"location"` (P2.3 neterminat)
Excluse din hartă, search și wiki. Rămân selectabile ca capete de distanță, deci
utilizatorul poate alege un capăt pe care nu îl poate găsi altfel.

### M-5 — Fragmentarea aceleiași locații în mai multe înregistrări
12 grupuri de nume, 27 de înregistrări. Cele mai clare:

```
"fortareata rosie" ×4 : fortareata_rosie_debarcaderul_regelui[stronghold],
                        fortareata_rosie_fortareata_lui_maegor[stronghold],
                        fortareata_rosie_implicit_locul_scenei…[stronghold],
                        fortareata_rosie_turnul_mainii[structure]
"Maegor's Holdfast" ×3: cetatuia_lui_maegor, citadela_lui_maegor, fortareata_lui_maegor
"sunspear" ×3         : sunspear[castle], sunspear_dorne[stronghold],
                        sunspear_palatul_vechi_din_sunspear[stronghold]
"insulele de fier" ×2 : insulele_de_fier[island], insulele_de_fier_pyke[stronghold]
```
Tiparul de id (`A_B`, unde A și B sunt locuri diferite) arată artefacte de
extragere: mențiunea „Fortăreața Roșie / Turnul Mâinii" a devenit o entitate.
Cea mai lungă are 317 caractere și înșiră 17 toponime.
**Aceasta este „mai multe cazuri" pe care le bănuia utilizatorul, generalizate.**

### M-6 — `getEntityById()` rezolvă fără tip peste 46 de id-uri coliziune
`js/ui/panels/parts.js:38-45` caută locations → houses → characters. Pentru cele
46 de id-uri partajate (`darry`, `hornwood`, `tarth`, `wyl`…) un link intern către
**casă** deschide **castelul**. Rutele `/wiki/:kind/:id` sunt corecte; doar
rezolvarea internă nu.

### M-7 — Aliasuri corupte de la despicarea pe paranteze
22 de aliasuri pe 14 locații au paranteze dezechilibrate:
```
kings_landing :: ["Debarcaderul Regelui (malul apei", "Fortăreața Roșie (King's Landing", "Red Keep)", "cheiul)", "orașul"]
riverrun      :: ["Sera Lordului Hoster (glass garden", "balcon)"]
bitterbridge  :: ["Bitterbridge)", "Podul Amar (Stonebridge"]
```
Sunt indexate în search, deci apar ca „potrivit pe alias: cheiul)".

### M-8 — Harta nu randează niciun marker până la primul cadru de animație
`MapRenderer.updateWorldState()` (linia 590-599) programează **tot** randarea de
markere în `requestAnimationFrame`. Într-un context fără compoziție (tab în
fundal, pagină ascunsă, captură automată, print) rAF nu se declanșează și harta
rămâne cu zero pinuri pe termen nelimitat. Se repară singur la focalizare.
**Reproducere:** deschide aplicația într-un tab de fundal, așteaptă, apoi comută
pe el — pinurile apar abia în acel moment. Verificat:
`{"visibilityState":"hidden","rafFiredWithin500ms":false}`, `#layer-locations` gol,
`renderedPositions.size = 0`, în timp ce `getRenderableLocations()` întorcea 53.
Straturile de bătălii și dragoni **nu** au problema (sunt randate sincron din
`setEventRange`), ceea ce face simptomul și mai derutant: harta arată markere de
eveniment fără niciun oraș sub ele.

## LOW

### L-1 — 50 `addEventListener`, 0 `removeEventListener` (vezi §K)
### L-2 — `characters.backup_compound_fix.json` (11.9 MB) este servit și urmărit în git
### L-3 — 19 fișiere `tmp_obj_*` / 490 MB garbage în `.git/objects` (vezi A5)
### L-4 — Etichetele de casă amestecă limbile în aceeași listă
Panoul de filtre, cu interfața pe RO, afișează simultan `Casa Lannister`,
`Casa Stark`, `Casa Tully` și `House Bracken`, `House Dustin`, `House Grafton`,
`House Greyjoy`, `House Hightower`, `House Qoherys`, `House Smallwood`.
Cauza este în date (unele case au `name_ro`, altele nu), nu în `t()`.

---

# Tabel final

| # | Verificare | Așteptat | Rezultat | Verdict |
|---|---|---|---|---|
| A1 | `git status --short` | gol | 12 modificate + 2 untracked | **FAIL** |
| A2 | `git log --oneline -40` | un commit per fază | 24 commituri, curate | PASS |
| A3 | `git diff --stat HEAD~1 HEAD` | fără reformatare | 2034+/2− | PASS |
| A4 | `git fsck` | fără erori | 40 dangling, 0 erori | WARNING |
| A5 | `git count-objects -v` | informativ | 19 garbage / 490 MB | WARNING |
| A6 | `git branch --merged` | informativ | `master` | PASS |
| A7 | `git branch --no-merged` | informativ | gol | PASS |
| A8 | `git stash list` | gol | gol | PASS |
| B | smoke test exit code | 0 | **0** | PASS |
| B-c1 | locații încărcate | 1099 | 1099 | PASS |
| B-c2 | locații cu pin | ≥150 | **80** | **FAIL** |
| B-c3 | evenimente în timeline | 1561 | 1568 | PASS |
| B-c4 | evenimente cu locație | 875 | 875 | PASS |
| B-c5 | personaje cu casă | 631 | 631 | PASS |
| B-c6 | obiecte+titluri în search | 370 | 370 | PASS |
| B-c7 | entități care crapă | 0 | 0 | PASS |
| B-c8 | încărcare inițială | <40 MB | **74.26 MB** | **FAIL** |
| B-c9 | limbi de interfață | 2 complete | 2 dicționar / 46 entități | WARNING |
| C1 | predicate care aruncă | 0 | 0 | PASS |
| C2 | evenimente→locație | 875 | 875 | PASS |
| C3 | `membru_al`→casă | 631 | 631 | PASS |
| C4 | obiecte în index | 276 | 276 | PASS |
| C5 | titluri în index | 94 | 94 | PASS |
| C6 | `maxYear` | 302 | 302 | PASS |
| C7 | fetch cu `response.ok` | toate | toate | PASS |
| C8 | fetch în `Promise.all` | toate | 16 paralel, 1 serial | WARNING |
| D1 | `getAllLocations()` | raportează | 694 | INFO |
| D2 | `type:"location"` rămase | ~0 | **217** | **FAIL** |
| D3 | `confidence=low` live | 0 | 0 | PASS |
| D4 | `taxonomy_override` | listează | câmpul nu există | **BLOCKED** |
| D5 | 8 cazuri de regresie | niciun castel greșit | toate corecte | PASS |
| E1 | `TODO:` în i18n | 0 | 0 | PASS |
| E2 | chei en vs ro | egale | 322 / 322 | PASS |
| E3 | `name_en == name_ro` | raportează | 5 din 51 (dragoni) | PASS |
| E4 | `innerHTML` literal | 0 | 0 | PASS |
| E5 | „Debarcaderul Regelui" pe EN | rezultat | 10, primul corect | PASS |
| E6 | „King's Landing" pe RO | rezultat | 5, primul corect | PASS |
| F1 | mutare pin → doar catalog | da | netestat (blocat) | **BLOCKED** |
| F2 | `hightower` în MapRenderer | 0 | 0 | PASS |
| F3 | highgarden/storm_end/castle_black | toate 3 | **2 din 3** | **FAIL** |
| F4 | 14 capitale cu etichetă | toate | **14/14** | PASS |
| G1 | bind pe 127.0.0.1 | da | da | PASS |
| G2 | conexiune LAN | refuzată | refuzată | PASS |
| G3 | `eval`/`new Function` | 0 | 0 | PASS |
| G4 | `outerHTML`/`insertAdjacentHTML` | listează | 0 | PASS |
| G5 | path traversal | blocat | blocat; repo expus | WARNING |
| G6 | regex catastrofal | listează | 0 | PASS |
| G7 | fetch fără `.ok` | 0 | 0 | PASS |
| H1 | click King's Landing | panou + consolă curată | panou OK, **nume greșit** | **FAIL** |
| H2 | click eveniment | panou + buton wiki | OK | PASS |
| H3 | căutare personaj | fără zoom haotic | OK | PASS |
| H4 | distanță Harrenhal↔KL | conflict marcat | 4 afirmații, magnitude+emphasis | PASS |
| H5 | 20 entități aleatorii | 0 excepții | 0 din 185 | PASS |
| I | arhitectură | praguri | 1 fișier >600, 0 TODO/log | PASS |
| J | performanță hot path | raportează | O(n²) declutter, acceptabil | PASS |
| K | memory leaks | raportează | 50 add / 0 remove | WARNING |
| L | race conditions | raportează | 1 reproductibil (M-8) | **FAIL** |
| M | excepții | raportează | 1 catch gol justificat, 1 catch care ascunde | WARNING |
| N | consistență | raportează | — | **SKIPPED** |
| O-1 | `id` duplicate | 0 | 0 | PASS |
| O-2 | `id_intern` duplicate | 0 | 0 | PASS |
| O-3 | alias duplicate cross-tip | 0 | 0 | PASS |
| O-4 | coliziuni `id` cross-tip | 0 | **46** | **FAIL** |
| O-5 | referințe lipsă | 0 | 0 (dar `seat` ×27) | **FAIL** |
| O-6 | referințe circulare | 0 | 0 | PASS |
| P | search, 7 tipuri × RO/EN | funcțional | 18/20, identic RO=EN | PASS |
| Q | 185 entități, seed 42 | 0 excepții | **0** | PASS |
| R | network | 0 erori | 0 erori, buget depășit | **FAIL** |
| S | assets nereferențiate | cifră | 11.9 MB recuperabil | WARNING |
| T | dimensiuni | top 10 | raportat | PASS |

---

## NOT READY FOR RELEASE

**Justificare, aplicând mecanic criteriile din §U:**

- **3 CRITICAL** → pragul „≥ 1 CRITICAL" este depășit.
- **6 HIGH** → pragul „≥ 3 HIGH" este depășit.
- **Secțiuni P0 cu FAIL:** A (A1), B (2 cifre Anexa C), D (D2), F (F3), O (O-4, O-5).
- **Secțiuni P0 BLOCKED:** D4, F1 → auditul este și **incomplet**, deci verdictul
  nu poate fi „READY cu rezerve" nici dacă restul s-ar repara.
- Smoke test exit code = 0 (singurul criteriu de blocare care **nu** se aplică).

### Toate problemele rămase, ordonate

| # | Severitate | Problemă |
|---|---|---|
| 1 | CRITICAL | `name_ro` greșit pentru ≥7 locații, inclusiv capitala |
| 2 | CRITICAL | Dragoni duplicați cu același `id` în `dragons.json` și `objects.json` |
| 3 | CRITICAL | `metadata.seat` array de obiecte pentru 26 de case |
| 4 | HIGH | „[OBJECT OBJECT]" randat în interfață pentru 26 de case |
| 5 | HIGH | Aceleași 26 de case nu au poziție pe hartă |
| 6 | HIGH | Stratul de bătălii ratează 19 din 21 de bătălii (`type` necompletat) |
| 7 | HIGH | 5 din ~26 de dragoni în `dragons.json` |
| 8 | HIGH | Încărcare 74 MB vs ținta <40 MB (harta = 45 MB, fără gzip) |
| 9 | HIGH | Arbore de lucru murdar; `eras.json` untracked dar obligatoriu |
| 10 | MEDIUM | Serverul expune `.git/`, sursele și listări de directoare |
| 11 | MEDIUM | API de scriere fără auth/CSRF/verificare de origine |
| 12 | MEDIUM | Slider de 902 ani pentru un eveniment outlier |
| 13 | MEDIUM | 217 locații încă `type:"location"` |
| 14 | MEDIUM | 27 de înregistrări fragmentate pe 12 locuri reale |
| 15 | MEDIUM | `getEntityById()` fără tip peste 46 de id-uri coliziune |
| 16 | MEDIUM | 22 de aliasuri cu paranteze dezechilibrate |
| 17 | MEDIUM | Zero markere de locație până la primul rAF |
| 18 | LOW | 50 `addEventListener` / 0 `removeEventListener` |
| 19 | LOW | Backup de 11.9 MB servit și urmărit în git |
| 20 | LOW | 490 MB garbage în `.git/objects` |
| 21 | LOW | Etichete de casă amestecate RO/EN în aceeași listă |

### Ce funcționează bine (pentru echilibru)

Cablajul din Faza 1 ține integral: 875/875 evenimente, 631/631 personaje,
370/370 obiecte+titluri, 0 excepții de predicat pe 185 de entități deschise real
în browser. Anti-coliziunea de etichete din P4.3 își atinge criteriul greu —
**14/14 capitale au etichetă vizibilă**, inclusiv cele două cu paranteză care
cădeau în v1. Stratul i18n de interfață este complet și simetric (322/322).
Search-ul este cu adevărat independent de limbă: aceleași 20 de interogări dau
rezultate identice pe RO și pe EN. Instrumentul de distanțe raportează corect
conflictul Harrenhal↔King's Landing. Zero erori de rețea pe 98 de cereri.

---

## Anexa 1 — Eșantion seed 42 (reproductibil)

PRNG `mulberry32(42)`, extragere fără repunere, în ordinea:
locations(50) → characters(50) → houses(20) → events(20) → objects(20) →
titles(20) → dragons(20, disponibili 5).

**Locations (50):** `saltspear, holdfast_in_the_hills, leaganul_naggai, honeywine,
high_hermitage, satul_cu_acoperisuri_de_paie, castelele_fratilor_wode, red_fork,
marea_verii, fawnton, woodswatch_by_the_pool, muntii_rosii_sala_mesei_pictate,
cararea_credintei, castelul_unde_locuieste_batranul_cavaler_care_a_aparat_un_pod,
gallowsgrey, ny_sar, water_gardens, sunset_sea, eastwatch, cuy,
insulele_baziliscului, rain_house, last_river, deepwood_motte,
apartamentele_lui_maester_aemon, claw_isle, grandview, fluviul_skahazadhan,
sisterton, karhold, ghaston_grey, lacrimile_alyssei, cotul_negru,
hanul_omului_ingenuncheat, crangul_auriu, acorn_water, raventree_hall,
brightwater_keep, jinqi, rills, oakenshield, pebble, brownhollow, castelul_verii,
capul_ghearei_despicate, marea_fumeganda_valyria, orasul_lordului_harroway,
sharp_point, castelul_longbow, castelul_pinkmaiden`

**Characters (50):** `balaq_cel_negru, randyll_tarly, richard_rodden, rodrik_stark,
vaduvoiul, batranul_negustor_asigurator_de_corabii, walder_cel_negru_frey,
lollys_stokeworth, walda_frey, cedra, borros_baratheon, adrian_redford, jezhene,
lyanna_mormont, penny_jenny_jenny_iarba_rosie, tormund_napasta_uriasilor,
bar_emmon, sandor_clegane_cainele, varys, grazhar, roslin_frey, denyo,
marele_jon_umber, ser_simon_dondarrion, bryen_farring, tagganaro, moreo_tumitis,
tytos_lannister, loras_tyrell, naggle, hugh_hungerford, orton_merryweather,
henly, septa_mordane, gwayne_gaunt, lordul_edmund_gardener, shagwell_pyg_timeon,
roger_de_pennytree, mellei, tom_barba_incalcita, lollys, melisandre_din_asshai,
guyard_cel_verde, benjicot_branch, roggerio_rogare, harmen_uller, ser_ilyn_payne,
tris_botley, belis, lotho_rogare`

**Houses (20):** `reyne, qoherys, iron_bank_of_braavos, royce, hewett, hardyng,
flint, gargalen, lefford, durrandon, beesbury, mooton, dalt, stonehouse, ashford,
piper, qorgyle, celtigar, shepherd, uller`

**Events (20):** `tourney_harrenhal, revolta_blackfyre_pentru_tronul_de_fier,
o_multime_de_lupi_au_trecut_pe_drumul_hayfordului_la_vanatoare,
theon_o_conduce_pe_barbrey_in_criptele_winterfellului…,
tyrion_dezvaluie_public_ca_stie_cine_e_tanarul_griff…,
cere_corabii_pentru_a_opri_salbaticii…, nasterea_printesei_daenerys,
jon_il_trimite_pe_naluca_singur_spre_castelul_negru…,
catelyn_refuza_sa_paraseasca_camera_lui_bran, aeron_toarna_apa_peste_capul_lui_theon…,
promulgarea_legii_vaduvei, quaithe_o_avertizeaza_pe_dany…,
dany_il_trimite_pe_rakharo…, daario_ii_taie_capul_sergentului…,
drazenko_ii_sopteste_lui_alyn_un_secret, aegon_a_adunat_demnitarii_ramasi_la_sunspear…,
cersei_il_manipuleaza_pe_balman…, yunkaii_lanseaza_atacul_cu_sase_trebusete…,
moare_epuizat_de_calatoria_de_la_nunta_de_aur, weese_o_foloseste_pe_arya_ca_mesagera…`

**Objects (20):** `cerbul_de_argint, ciocanul_regelui_robert,
masa_pictata_de_la_piatra_dragonului, coroana_iubirii_si_frumusetii, dreamfyre,
galera_doamna_alba, fiii_razboinicului, potirul_de_nunta_al_lui_joffrey,
dragonul_de_aur, craniul_dragonului_meraxes, temnitele_lui_maegor_cel_crud,
coroana_soimului_de_munte_si_vale, lordul_tywin, obsidianul_sticla_dragonilor,
marele_kraken, monede_diverse, corabia_tacerea, coroana_regilor_iernii,
coroana_de_lemn, coroana_lui_theon_greyjoy`

**Titles (20):** `titlul_khaleesi, legile_regelui_maegor_cel_crud, garda_regelui,
titlul_magnarul_thennilor_termenul_magnar, monstru, coroana_de_lemn_plutitor,
neveste_de_sare, cavaler_ceapa, titlul_adevarat_pazitor_al_estului,
lighioana_cu_patru_capete, ser_bunic_barba_alba, recompensa_lui_cersei,
titlul_pazitor_al_sudului, triarhi, titlul_regele_salbaticilor, regele_sudului,
fratia_padurii_regelui, titlurile_lui_tormund_napasta_uriasilor,
statutul_de_sora_tacuta, titlurile_complete_ale_lui_wyman_manderly`

**Dragons (5, tot ce există):** `syrax, vhagar, balerion, caraxes, meraxes`

---

## Anexa 2 — Iconografia hărții la zoom implicit

Nu face parte din grila A–T; a fost cerută explicit. Măsurat live, după randare
forțată, fereastră 1280×720.

```json
{"elementPx":"1280x720","drawnMapPx":"1080x720","letterboxPx":"200 horizontal",
 "pxPerWorldUnit":0.72,"viewBox":"0 0 1500 1000"}
```

Anatomia unui marker, în unități de lume (canvas 1500×1000):

| Element | Dimensiune | px la zoom implicit |
|---|---|---|
| zonă de click (`marker-hit-area`) | 30 × 30 | 21.6 × 21.6 |
| siluetă de tip (`location-type-castle`) | 18 × 16 | 13 × 11.5 |
| badge de emblemă | 10.4 × 10.4 | 7.5 × 7.5 |
| etichetă („Winterfell") | 76.5 × 13.9 | 55 × 10 |
| **extindere verticală totală** (etichetă → bază) | **~43** | **~31 px** |

**Trei constatări, în ordinea impactului:**

1. **Harta pierde 200 px din 1280 pe letterboxing.** `viewBox` este 1500×1000
   (raport 1.5), containerul 1280×720 (raport 1.78). Cu
   `preserveAspectRatio="xMidYMid meet"` scala e limitată de înălțime
   (720/1000 = 0.72), deci harta se desenează pe 1080×720 și rămân 200 px de
   margini goale. **Harta chiar *este* mai mică decât fereastra** — nu e o iluzie
   produsă de iconițe.

2. **Markerele nu contra-scalează la zoom.** `MapInteraction` implementează zoom-ul
   modificând **exclusiv `viewBox`** (linia 64). Dimensiunile markerelor sunt
   constante în unități de lume. Consecința: raportul iconiță/hartă este **fix**.
   La zoom ×2 o iconiță de 13 px devine 26 px; la ×4, 52 px. Iconițele nu câștigă
   informație, doar suprafață.

3. **Spațierea impusă este mai mică decât o etichetă.** Decluttering-ul
   (`MapRenderer.js:700-701`) folosește `threshold = 22` și `minDistance = 24`
   unități, dar o etichetă singură are **76.5 unități** lățime — de 3.2× mai mult
   decât distanța minimă garantată. Coliziunile sunt structurale, iar
   `updateLabelVisibility()` le rezolvă ascunzând: din 89 de etichete, **49 rămân
   vizibile, 40 sunt suprimate** (45%).

**RECOMANDARE (de implementat separat, nu în acest audit):**

- **Contra-scalare.** Aplică pe grupul fiecărui marker
  `transform: scale(k / zoom)`, cu `zoom = 1500 / viewBox.width`, plafonat
  (ex. `clamp(0.45, 1/zoom, 1)`). Markerele își păstrează dimensiunea **pe ecran**
  la orice zoom; harta câștigă suprafață relativă exact când te apropii. Aceasta
  este singura schimbare care rezolvă și „harta pare mică", și aglomerarea.
- **Elimină letterboxing-ul.** Fie potrivește `viewBox` la raportul containerului
  (`preserveAspectRatio="xMidYMid slice"` + margini de siguranță în date), fie
  recalculează `viewBox` la `resize`. Cei 200 px recuperați sunt +18% lățime utilă,
  gratis.
- **Leagă `minDistance` de lățimea reală a etichetei**, nu de o constantă.
  `updateLabelVisibility()` deja măsoară textul (`_labelMeasurementCache`);
  aceeași măsurătoare ar trebui să alimenteze decluttering-ul, ca pinurile să nu
  fie împinse la 24 de unități când eticheta cere 76.
- **Trepte de densitate în loc de ascundere.** La zoom mic desenează doar tier 1
  cu etichetă și tier 2–3 ca puncte de 2–3 unități fără etichetă; pe măsură ce
  zoom-ul crește, promovează treptat. Azi tot ce nu încape dispare complet, ceea
  ce face harta să pară și goală, și aglomerată în același timp.

---

## Curățenie

`tools/verify_final.mjs` — creat pentru acest audit, **șters la finalul sesiunii**.
`tools/audit_ui.mjs` — nu a fost creat (fără Playwright/Puppeteer în proiect;
secțiunile H/Q/R au rulat în browserul real).
Serverul de test (port 8753) — oprit.
Nicio modificare în `data/`, `js/`, `css/`, `i18n/`, `admin/` sau `server.py`.
