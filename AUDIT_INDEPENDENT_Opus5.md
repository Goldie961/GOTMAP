# Audit independent — Atlas of Westeros

**Auditor:** Claude Opus 5 · **Data:** 2026-08-02
**Metodă:** citire directă a codului (`js/`, `css/`, `admin/`, `server.py`, `scripts/`, `scratch/`), parsare programatică a tuturor JSON-urilor din `data/` (în memorie, fără scriere), verificarea capturilor din `Imagini dovezi/`.
**Documente de referință:** `AUDIT_Atlas_of_Westeros_Claude.md` (Sonnet 5) și `AUDIT_FINAL_v2_Stare_Reala.md` (handoff anterior).

**Nicio modificare pe disc.** Singurul fișier creat este acesta. Nu am rulat niciun script din `scripts/` sau `scratch/`.

---

## Partea 1 — Verdict pe auditul lui Sonnet 5

### 1.1 Search → click pe eveniment „nu duce nicăieri" — **CONFIRM**

`js/app.js:117-174`. Handler-ul `searchBar.onSelect` are ramuri doar pentru `house`/`faction`/`institution` (linia 122), `character` (130) și `dragon` (152). Pentru `event` nu există ramură; `entity` rămâne `undefined`, iar `if (entity)` de la linia 171 nu se declanșează. Confirmat integral.

**Ce a ratat Sonnet:** pagina de wiki pentru evenimente **este deja scrisă și funcțională**. `js/ui/WikiPage.js` tratează explicit evenimente — participanți cu roluri (`WikiPage.js:321-330`), locația evenimentului (`WikiPage.js:365`), evenimente legate (`WikiPage.js:269-270`). `WikiPage` este instanțiat la `app.js:79-80`. Singura cale de acces e butonul „Vezi pagina completă →" din InfoPanel (`InfoPanel.js:360`, `:865`, `:1082`), care necesită ca `selectEntity` să fi reușit înainte.

Deci fix-ul minim nu e „scrie o pagină de wiki", ci **trei linii în `app.js`**: `else if (res.type === 'event') { entity = this.dataManager.getEvent(res.id); }` — și `entity` fiind non-null, InfoPanel se deschide, iar butonul spre WikiPage devine accesibil. Sonnet a tratat asta ca funcționalitate de construit; e funcționalitate construită și deconectată.

### 1.2 Distanța măsurată nu funcționează — **CONFIRM parțial, diagnostic incomplet**

Partea confirmată: `data/map/catalog.json` → `coordinateSpaces["world-terrain-1500x1000"]` are `milesPerUnit: null` și `scaleStatus: "needsCalibration"`. `DistanceTool.js:146-157` verifică exact asta și afișează „Map scale calibration pending". Corect.

**Infirm partea implicită** că distanțele narative „sunt deja afișate, dar sub rezultatul principal". Sunt afișate, dar utilizatorul aproape sigur nu ajunge niciodată la ele, din două motive pe care Sonnet nu le-a verificat:

1. `DistanceTool.handleLocationClick` e apelat exclusiv din `app.js:183-184`, în interiorul listener-ului `locationSelected`, care se declanșează doar la click pe un **marker de pe hartă**. Există **77 de markere** (`data/map/catalog.json` → `maps.world.coordinates`). Deci instrumentul poate compara doar 77 din 1099 locații — **7.0%**.
2. Cele 467 de perechi din `distances.json` referă id-uri care **toate rezolvă corect** (0 referințe rupte, verificat programatic) — dar perechile utile (ex. Winterfell↔King's Landing) cer ca ambele capete să aibă pin. Din 126 de case cu `seat`, doar **26 au sediul cu pin pe hartă**.

Exemplul dat de tine — Harrenhal + King's Landing — chiar funcționează: ambele sunt în cele 77. Dar e o coincidență fericită, nu regula.

**Recomandarea lui Sonnet (inversarea ierarhiei) e corectă dar insuficientă.** Selecția trebuie decuplată de markerele hărții: două dropdown-uri peste toate cele 1099 de locații, nu click pe hartă.

### 1.3 King's Landing — **INFIRM. Cauza e identificabilă static, și e chiar bug-ul pe care Sonnet l-a găsit și l-a exclus.**

Sonnet scrie: *„Datele locației (`kings_landing`) au coordonate valide în `locations.json`"* și, mai jos, *„Nu e neapărat cauza pentru King's Landing (care ARE coordonate)"*.

**Ambele afirmații sunt false.** Verificat direct: intrarea `kings_landing` din `data/locations/locations.json` are cheile `['id','name','type','continent','region','ownership_history', ...]` — **nu conține `coordinates`**. Sonnet a confundat coordonatele din `catalog.json` (care există: `{x:304.4, y:580.2}`) cu câmpul `coordinates` de la rădăcina obiectului din `locations.json` (care nu există). Sunt două sisteme diferite — exact distincția pe care `AUDIT_FINAL_v2_Stare_Reala.md` §5 o documentează.

Prin urmare, `app.js:280`:

```js
let targetX = location.coordinates.x;   // TypeError: Cannot read properties of undefined
```

**aruncă pentru King's Landing.** Ordinea contează: excepția e la linia 280, iar `getRenderedPosition()` — fallback-ul defensiv scris intenționat la liniile 282-290 — e apelat abia la linia 282. Garda nu apucă niciodată să ruleze. Efectul observabil, pas cu pas:

- `app.js:275` → `infoPanel.open()` reușește (panoul apare)
- `app.js:278` → `highlightLocation()` reușește
- `app.js:280` → **throw**, necaptat, în callback-ul `searchBar.onSelect`
- `flyTo()` de la linia 291 nu se execută niciodată → **harta nu se mișcă**

**Al doilea factor, care completează simptomul „nu se activează":** eticheta lui King's Landing e ștearsă de algoritmul de anti-coliziune. `loc.name` pentru `kings_landing` este `"King's Landing (Aegonfort)"` — **26 de caractere**, tier 1 (`MapRenderer.js:6-10`, `:383`). La `MapRenderer.js:726`, lățimea estimată a casetei este `26 × 12 × 0.55 ≈ 172 unități de hartă` — o casetă care se întinde de la x≈218 la x≈390 și se suprapune cu Tumbleton (x=271.7, la 35.9 unități), Kingswood, Blackwater Bay și The God's Eye. La egalitate de prioritate, `MapRenderer.js:755` folosește `sort()` pe un singur criteriu, deci ordinea între tier-1 e cea din array. Eticheta pică la `MapRenderer.js:770`.

Se vede în captura ta `Imagini dovezi/Kinglanding nu functioneaza.png`: medalionul cu cerbul Baratheon există la nord-est de Tumbleton — **markerul e desenat, eticheta lipsește**. Comparativ, în stânga-jos apare `TOWER (OLDTOWN)`, adică `oldtown` cu numele `"Hightower (Oldtown)"` — același tipar de nume cu paranteză.

Din 77 de locații cu pin, exact **2 au paranteză în nume**: `kings_landing` și `oldtown`. Amândouă sunt exact cele despre care te-ai plâns.

**Deci nu era nevoie de consolă live.** Sonnet a avut dreptate să ceară confirmare, dar a închis prea repede ipoteza corectă pe baza unei verificări greșite a datelor.

**Confirm însă statistica de robustețe**, cu cifre ușor diferite (denominatorul lui Sonnet nu e clar): din 391 de locații randabile, **327 nu au `coordinates` la rădăcină** (nu 189 din 220). Restrâns la `castle`+`fortress`+`city`+`town`: **213 din 257**.

### 2.1 Sursele nu se văd bine — **CONFIRM**

`css/panels.css:127` — exact textul citat de Sonnet, verificat caracter cu caracter.

**Adaug ce a ratat:** problema reală nu e stilul, ci **volumul**. Doar **34 din 2288 de personaje** au un câmp `description`. În lipsa unui text descriptiv, panoul e populat aproape exclusiv din `_afirmatii_pe_predicat` + `surse` — adică raportul semnal/zgomot e structural prost, nu doar prost stilizat. Se vede în captura ta cu Rhaenyra: blocul „născută/moartă/copii" e urmat imediat de un paragraf de proveniență („din Fragment 4.3; vie la finalul fragmentului (din Fragment 4.2); 97 D.C (din Fragment 3.2)"). Nici o schimbare de CSS nu repară asta.

**Bug vizual suplimentar, vizibil în aceeași captură și neraportat de nimeni:** eticheta `DEATH` se suprapune peste textul valorii („DEATHdouă zi a celei de-a zecea luni…"). Grid/flex fără `min-width` pe coloana de etichetă în `css/panels.css`.

### 2.2 Iconițele castelelor/caselor — **INFIRM diagnosticul, CONFIRM simptomul**

Sonnet: *„multe locații fără casă cunoscută cad pe un marker generic needistinctiv (punct)"* și recomandă ca silueta să fie determinată de tip, nu de existența steagului.

**Asta e deja implementat.** `MapRenderer.js:29-40` definește `appendLocationTypeGlyph()` cu 6 siluete distincte (castle / fortress / city / town / ruins / landmark), și e apelat pe **ambele** ramuri — linia 434 (când există emblemă) și linia 602 (când nu există). Recomandarea lui Sonnet descrie codul existent.

Cauza reală e alta, în trei straturi:

1. **Ramura fără emblemă desenează un cerc de rază 3–3.5** (`MapRenderer.js:590-596`) *sub* glif. Cercul mic e cel care „nu pare castel", nu glifa.
2. **103 din 229 de case nu au deloc câmp `crest`** (126 au, și toate cele 126 de fișiere există în `assets/sigils/` — 0 lipsă, deci nu e o problemă de assets).
3. **Rezolvarea casei stăpânitoare acoperă 6.7% din date.** Doar **74 din 1099 de locații** au `timeline`/`ownership_history`. Restul cad pe `houseId = 'unknown'` la `MapRenderer.js:369`, deci fără emblemă, deci pe ramura cu cerc.

La anul de boot (1 AC, `app.js:55`), din cele 77 de pinuri **doar 24 rezolvă la o casă cu emblemă**. Restul de 53 sunt cercuri. Asta e cifra din spatele reclamației tale.

**Ce a ratat complet toată lumea:** 21 din cele 77 de pinuri sunt tipate `landmark` și sunt de fapt **întinderi de apă și regiuni** — `blackwater_bay`, `bay_of_crabs`, `the_bite`, `bay_of_ice`, `sea_of_dorne`, `ironman_s_bay`, `stepstones`, `kingswood`, `wolfswood`, `rainwood`, `rills`, `mountains_of_the_moon`, `gods_eye`, `three_sisters`, `skagos`, `sothoryos_continent`, `ulthos_continent`, `lhazar`, `tarth`, `red_watch`, `the_wall`. Fiecare primește un **pin punctiform cu romb** — de aceea „mările arată la fel, urât". O mare nu e un punct. (Vezi §2.8 pentru soluția care există deja în cod.)

### 2.3 Panoul din dreapta + pagina completă de personaj — **CONFIRM ca observație, dar prioritizat greșit**

Structura e cum o descrie Sonnet. Dar cauza dominantă e de date, nu de layout: **1530 din 2227 de personaje cu scor de completitudine au `scor_total` sub 0.3** (69%), iar distribuția e `0.0: 499 · 0.1: 109 · 0.2: 922 · 0.4: 325 · 0.5: 169 · 0.6: 105 · 0.8: 58 · 0.9: 20 · 1.0: 20`.

Doar **40 de personaje din 2288 au scor ≥ 0.8**. Oricât de bine ai restructura pagina, pentru ~2 din 3 personaje nu există conținut de așezat. Ancorele de navigare pe care le propune Sonnet ar naviga prin secțiuni goale.

### 2.4 Zoom aiurea pe personaje — **CONFIRM simptomul, INFIRM explicația. Am găsit cauza exactă.**

Sonnet spune că e „prin design" — search-ul încearcă să localizeze personaje via ultima locație din timeline. Codul chiar face asta (`app.js:133-151`), dar **lanțul e rupt într-un punct precis**.

`app.js:143-147` are un fallback: dacă personajul n-are timeline, folosește sediul casei lui.

```js
if (!targetLocationId && res.house) {
  const house = this.dataManager.getHouse(res.house);
  if (house && house.seat) { targetLocationId = house.seat; }
}
```

`res.house` vine din `SearchEngine.js:54`, care citește `char.house || char.membru_al`. Am verificat toate cele **631 de valori `membru_al`** din `characters.json`: **0 rezolvă direct** la un id din `houses.json`; **toate 631 rezolvă doar după eliminarea prefixului**. Valorile sunt `HOUSE_TARGARYEN`, `HOUSE_FREY`, `HOUSE_LANNISTER`… iar id-urile din `houses.json` sunt `targaryen`, `frey`, `lannister`.

`DataManager.getHouse('HOUSE_TARGARYEN')` returnează `undefined`. **Întotdeauna.** Deci fallback-ul pe sediul casei nu se activează niciodată, pentru niciun personaj. Rămâne doar `char.timeline`, care există la foarte puține personaje — deci `loc` rămâne `undefined`, `selectEntity(entity, undefined)` sare peste tot blocul de zoom, iar când *există* un timeline, sare la o locație aleatorie din trecut. De aici senzația de „zoom aiurea".

`SearchEngine.js` are deja logica de curățare a prefixelor la linia 295, dar o folosește doar ca să decidă dacă afișează un alias — nu ca să normalizeze `houseId`.

### 3. Separarea `/harta` vs `/wiki` — **de acord cu concluzia, dar Sonnet a ratat că nu există routing deloc**

Recomandarea e bună. Adaug faptul tehnic decisiv: **aplicația nu are nicio formă de rutare.** `WikiPage` este un **overlay** — `WikiPage.js:26 open(entity, options)`, `:101 close`, fără `location.hash`, fără `history.pushState`, fără `popstate`. `index.html` e singurul document. Nu există `/wiki` ca URL, deci nici link partajabil, nici buton Back de browser, nici deep-link din search.

Deci „trimite spre `/wiki#event-id`" (Sonnet, §3) nu e o rearanjare — e infrastructură nouă. Corect ca direcție, subestimat ca efort. În schimb, **conținutul** paginii de wiki există deja (vezi §1.1), ceea ce Sonnet nu a spus.

### 4.1 Slider-ul de ani — **CONFIRM, plus un bug de date pe care nimeni nu l-a văzut**

Confirmat că bara e fixă jos. Dar problema serioasă nu e spațiul:

`js/ui/Timeline.js:22-23` fixează `minYear = 1`, `maxYear = 300`. Datele reale din `data/events/events.json`: **1561 de evenimente cu an numeric, interval −114 … 302**.

- **557 de evenimente (35.7% din cele datate) au an > 300** — inaccesibile prin slider.
- 3 evenimente au an < 1.
- `Timeline.js:145-146` calculează poziția în minimap ca `(evt.year − 1) / 299` și o limitează la `[2%, 98%]`. Cele 557 de evenimente post-300 se **suprapun toate pe 98%**, într-un singur teanc la marginea dreaptă. Se vede în captura ta: aglomerarea din dreapta-jos a minimap-ului.

Deci nu doar că sliderul ocupă spațiu — **ascunde peste o treime din cronologie**.

### 4.2 Filtrul de hartă e prea mare — **CONFIRM, dar mult mai grav decât „zeci de rânduri"**

`FilterPanel.js:103-122` randează o listă plată, sortată alfabetic, fără grupare și fără select-all — confirmat.

Cifrele reale, calculate din `FilterPanel.js:41-54` (`DEFAULT_LOCATION_SUBTYPES` ∪ subtipurile din `getAllLocations()`):

- **128 de checkbox-uri** randate.
- **102 dintre ele corespund unei singure locații.**
- **96 dintre ele nu pot afecta niciun pin vizibil** — subtipul lor nu apare la niciuna din cele 77 de locații cu coordonate. Sunt checkbox-uri complet inerte.

Sursa haosului e `subtip`, un câmp de text liber ieșit din extragere: **572 de valori distincte** în `locations.json`, dintre care **497 apar exact o dată**. Mostre reale:

| id | `subtip` |
|---|---|
| `riverrun` | `încăpere/balcon în interiorul fortăreței` |
| `pyke` | `tron/scaun de conducere` |
| — | `castel (pereche de turnuri-gemene, pe ambele maluri ale unui râu)` |
| — | `castel mic (ziduri de piatră, fortăreață de stejar)` |
| — | `castel/regiune (Westerlands)` |
| — | `așezare / castel (posibil)` |

`subtip` nu e o taxonomie, e text din carte. Gruparea în categorii pe care o propune Sonnet e corectă, dar **nu se poate face peste 572 de valori libere** — trebuie întâi o normalizare la un vocabular închis, cu `subtip` păstrat ca text descriptiv separat.

### 4.3 Nume pe ape + coș de triaj — **CONFIRM fezabilitatea, INFIRM efortul estimat**

Sonnet: *„tehnic e text SVG poziționat de-a lungul unei căi (`textPath`) … nu e un obstacol tehnic mare"*.

**Mecanismul e deja construit în întregime și nefolosit.** `MapRenderer.js:886-908 renderGeographicFeatures()` citește `data/map/world_features.json` și randează etichete cu poziție, rotație (`transform: rotate(...)`, linia 901), clasă `map-label-sea` (linia 895) și prag de zoom (`data-min-zoom`, linia 897). `updateLabelVisibility()` are deja tier-ul `'sea'` cu prioritate 2 (`MapRenderer.js:681`, `:724`, `:739`).

Ce lipsește: **date**. `world_features.json` conține **10 intrări, toate `type: "region"`, zero mări**. Adăugarea numelor de ape nu e cod nou — sunt rânduri într-un JSON de 1.3 KB. Diferență de efort: ore vs. minute.

Pentru „coșul de triaj": ideea e bună, dar fișierele de review există deja și sunt neatinse. `data/_import/etl_output/id_uri_compuse_needecise.json` are **2 octeți** (`[]` sau `{}`), iar `id_map_orfani_needecise.json` are 1280 de octeți. `AUDIT_FINAL_v2` §9.7 avertizează exact despre acumularea lor.

### 5. Ideile bonus — **CONFIRM două din trei, INFIRM una**

- **Filtru „Epoca Targaryen": ✅ Ușor** — Sonnet spune că „se leagă direct de `timeline`-urile deja existente pe fiecare locație/casă". **Infirm „pe fiecare".** Doar **74 din 1099 de locații** au timeline. Filtrul ar ascunde 93% din locații, nu ar filtra epoca. Rămâne fezabil pe evenimente (1561 datate), nu pe locații.
- **Import Markdown: ✅** — de acord, fără obiecții.
- **Dragoni & battle markers: ⚠️** — `data/dragons/dragons.json` are **2712 octeți**. Nu e „o structură separată deja existentă", e un stub. E o adăugare, cum spune Sonnet, dar pornind aproape de la zero.

### 6. Prioritizarea recomandată de Sonnet — vezi Partea 3.

---

## Partea 2 — Descoperiri noi (nemenționate de Sonnet 5)

### 2.1 🔴 **64% din locații nu există nicăieri în aplicație** — nici pe hartă, nici în search, nici în filtre

Cea mai gravă problemă găsită, și nu apare în niciunul din cele două audituri anterioare.

`DataManager.loadAll()` (`js/data/DataManager.js:94-104`) împarte locațiile în trei array-uri, filtrând strict pe `type`:

```js
this.data.castles   = temp.locations.filter(l => l.type === 'castle' || l.type === 'fortress')
this.data.cities    = temp.locations.filter(l => l.type === 'city' || l.type === 'town')
this.data.landmarks = temp.locations.filter(l => l.type === 'landmark' || l.type === 'ruins')
```

`getAllLocations()` (`DataManager.js:217-223`) returnează exact reuniunea acestor trei. Este **singura** sursă pentru `SearchEngine.buildIndex` (`SearchEngine.js:12`), `MapRenderer.renderLocationMarkers` (`MapRenderer.js:271`), `FilterPanel.setLocationSubtypes` (`app.js:83`) și `TimelineEngine` (`TimelineEngine.js:170`).

Distribuția reală a lui `type` peste cele 1099 de locații încărcate:

| `type` | număr | randat? |
|---|---|---|
| **`location`** | **708** | ❌ **niciodată** |
| `castle` | 185 | ✅ |
| `landmark` | 122 | ✅ |
| `city` | 30 | ✅ |
| `town` | 26 | ✅ |
| `fortress` | 16 | ✅ |
| `ruins` | 12 | ✅ |

**708 locații (64.4%) au `type: "location"` și sunt filtrate complet.** Nu apar în căutare, nu pot fi selectate, nu contribuie la filtre, nu pot fi plasate pe hartă.

Asta contrazice direct `AUDIT_FINAL_v2_Stare_Reala.md` §5, care afirmă: *„Restul există în date, căutabile, dar fără pin."* Nu sunt căutabile. Nu există.

De asemenea explică ce a raportat auditul anterior ca discrepanță: numărătorile de acolo (1041) sunt pe fișier, nu pe ce ajunge în aplicație. Real: 1041 + 9 (`free_cities.json`) + 49 (`far_lands.json`) = **1099** încărcate, **391** utilizabile, **77** vizibile.

Corecția e o linie în ETL (`type: "location"` → tipul concret) sau o linie în `DataManager` (fallback pentru tipuri necunoscute). Dar impactul e cel mai mare din tot raportul.

### 2.2 🔴 **`locatie_id` e citit înaintea lui `location` — 289 de evenimente pierd legătura de locație degeaba**

`js/ui/InfoPanel.js:1023` și `js/ui/WikiPage.js:365`:

```js
const locId = entity.locatie_id || entity.location;
```

`events.json` are **ambele** câmpuri pe toate cele 1682 de evenimente. Verificat programatic peste cele 875 de evenimente care au o locație:

| câmp | rezolvă la un id real de locație |
|---|---|
| `locatie_id` (brut, `LOCATION_*`) | **0 / 875** |
| `location` (rezolvat) | **875 / 875** |
| `locatie_id` după eliminarea prefixului | **586 / 875 (67%)** |

Codul alege câmpul care nu rezolvă *niciodată*, apoi încearcă să-l salveze cu o euristică de normalizare (`InfoPanel.js:1044`, `WikiPage.js:325`: strip prefix + lowercase) care reușește în 67% din cazuri. Euristica pică sistematic pe perechile română↔engleză: `LOCATION_PUMNUL_PRIMILOR_OAMENI` → `pumnul_primilor_oameni`, dar id-ul real este `fist_of_first_men`.

**Inversarea ordinii — `entity.location || entity.locatie_id` — repară 289 de evenimente (33%) instant, fără schimbare de date.**

Același tipar la participanți: `participanti` (brut) recuperează 2024/2194 (92%) prin normalizare, deci **170 de participanți rămân link-uri moarte**. Câmpul `participants` (presupus „rezolvat") e de fapt mai prost — rezolvă doar 77 de intrări.

**Notă asupra auditului tău intern:** `data/_import/etl_output/audit_integritate_referentiala.json` raportează 326 referințe rupte din 12193, pentru că rezolvă prin `id_map.json`. Corect ca audit de date. Dar `id_map.json` (1 MB) **nu e încărcat niciodată de aplicație** — nu apare în `DataManager.loadAll()` și nicio referință în `js/` (verificat prin grep pe tot directorul). Integritatea „curată" la nivel de ETL nu se traduce în integritate la runtime.

### 2.3 🔴 Securitatea panoului admin — **nicio autentificare, expus pe toate interfețele**

`server.py:182`:

```python
ThreadingHTTPServer(('', 8000), AtlasHandler).serve_forever()
```

`''` = `0.0.0.0` — **toate interfețele de rețea**, nu doar `localhost`. Pe orice Wi-Fi partajat (cafenea, cămin, birou, rețea de bloc), oricine îți poate ajunge la server.

Nu există: autentificare, token, verificare de origine, protecție CSRF, rate limiting. Endpoint-urile expuse fără nicio verificare:

| metodă | rută | efect |
|---|---|---|
| `POST` | `/api/save-coordinates` | rescrie coordonatele în 3 fișiere + `catalog.json` (`server.py:51-80`) |
| `POST` | `/api/locations` | adaugă locații (`:83-93`) |
| `POST` | `/api/houses` | adaugă case (`:94-103`) |
| `PUT` | `/api/locations/<id>`, `/api/houses/<id>` | suprascrie (`:108-127`) |
| `DELETE` | `/api/locations/<id>`, `/api/houses/<id>` | **șterge din date + din catalog** (`:129-146`) |

În plus, `AtlasHandler` extinde `SimpleHTTPRequestHandler`, care servește **întreg directorul rădăcină**. Cu serverul pornit, oricine pe rețea poate descărca `data.zip` (122 MB), `.git/`, și tot conținutul din `Imagini dovezi/`.

Nu e un pericol teoretic: `admin/map-editor.html` nu are nici măcar un ecran de login (23 de linii, doar markup, `<script type="module" src="map-editor.js">`).

**Minim viabil:** `ThreadingHTTPServer(('127.0.0.1', 8000), ...)`. O singură schimbare, elimină expunerea în rețea. Un token în header ar fi corect, dar legarea la loopback e fixul de 30 de secunde.

**Bug de performanță în același loc:** `server.py:58-71`, bucla de salvare face `write_json(path, rows)` pentru **fiecare** din cele 3 fișiere de locații, la fiecare salvare, indiferent dacă s-a schimbat ceva în ele. `locations.json` are 7.5 MB. Fiecare mutare de pin rescrie ~7.6 MB pe disc.

### 2.4 🟠 Performanță — încărcare inițială de ~62 MB, secvențială

`assets/Mapa/` are 89 MB, dar din ele:

| fișier | mărime | folosit? |
|---|---|---|
| `HARTA LUMII.png` | **46.4 MB** | ✅ `catalog.json:19` → `maps.world.terrain.src` |
| `HARTA LUMII.zip` | 46.5 MB | ❌ **niciodată** — arhiva aceleiași imagini, servită static |

Deci 46.5 MB din cei 89 sunt greutate moartă în directorul servit.

Imaginea de 46.4 MB e injectată ca un singur `<image>` SVG (`MapRenderer.js:855-864`), fără tiling, fără versiune progresivă, fără `loading="lazy"`, fără placeholder de rezoluție mică. Blochează prima randare utilă a hărții.

Peste asta, `DataManager.loadAll()` (`DataManager.js:39-42`) încarcă 12 JSON-uri **în serie**:

```js
for (const [key, url] of Object.entries(urls)) {
  const response = await fetch(`${this.basePath}${url}`);
  temp[key] = await response.json();
}
```

Cu `characters.json` = 12.6 MB, `locations.json` = 7.5 MB, `events.json` = 5.8 MB, `houses.json` = 3.6 MB → **~30 MB de JSON, unul după altul**, fiecare așteptând finalizarea celui anterior. Un `Promise.all` ar paraleliza fără altă schimbare.

Total pe încărcarea inițială: **~46 MB imagine + ~30 MB JSON ≈ 76 MB**, cu JSON-ul serializat. Ecranul de încărcare (`index.html:22-30`) are o bară de progres cu `width: 100%` hardcodat — decorativă, nu reflectă nimic.

**Fișiere `.zip` servite inutil din directoare de date:** `data/characters/characters.zip` (816 KB), `data/locations/locations.zip` (680 KB), `data/houses/houses.zip` (265 KB), `data/essos/far_lands.zip`, `data/map/regions.zip`, plus `data.zip` (122 MB) în rădăcină.

### 2.5 🟠 `scripts/` și `scratch/` — datorie tehnică reală, și complet în afara controlului de versiune

**40 de scripturi în `scripts/`, 42 de fișiere în `scratch/`.** 33 dintre ele scriu în `data/`.

Analiza gărzilor de siguranță (verificat prin grep după `argparse`, `--dry-run`, `backup`, `input(`):

| garda | scripturi |
|---|---|
| **niciuna** | **26** |
| doar `argparse` | 3 |
| doar `backup` | 7 |
| dry-run explicit | **0** |
| confirmare interactivă | **0** |

Toate cele 26 fără gardă sunt executabile prin simplu `python scripts/<nume>.py` și scriu direct peste datele curente. Printre ele: `merge_locations_nivel1.py`, `merge_houses_nivel1.py`, `unify_events_schema.py`, `dedup_person_entities.py`, `retire_misplaced_coordinates.py`, `filter_self_reference_statements.py`. Numele sugerează operații deja aplicate o dată — rerularea lor peste date deja procesate e exact riscul din întrebarea ta.

**Dar problema mai gravă e alta:**

```
scripts        tracked=0
scratch        tracked=0
data/_import   tracked=3
```

**Niciun script nu e în git.** Nu există `.gitignore`. Directorul `.git` conține **49 de obiecte temporare orfane** (`tmp_obj_*`) și `size-pack: 0` — repository-ul nu a fost niciodată împachetat și cel puțin o operație git a fost întreruptă la jumătate.

Regula #3 din `AUDIT_FINAL_v2_Stare_Reala.md` §0 — *„Fă backup/commit înainte de fiecare prompt care scrie în cod sau date"* — este **structural imposibil de respectat** pentru stratul care produce datele. Dacă mâine `characters.json` se strică, ai backup-ul datelor, dar nu ai versiunea scriptului care le-a generat.

Recomandare: `.gitignore` pentru `data.zip`, `*.zip`, `__pycache__/`, `Imagini dovezi/`; commit pentru `scripts/`; `scratch/` arhivat sau ignorat explicit. Fișierele care nu mai trebuie rulate — mutate în `scripts/archive/`, nu doar documentate.

### 2.6 🟠 Consistența schemei — răspuns la întrebarea ta despre „nivel bogat vs. minim"

Procentele reale, per categorie:

| categorie | n | `_afirmatii_pe_predicat` | `id_intern` | `aliasuri` | `surse` | `_completitudine` |
|---|---|---|---|---|---|---|
| locations | 1099 | 78% | 80% | **28%** | 77% | 80% |
| characters | 2288 | 97% | 97% | **11%** | 77% | 97% |
| houses | 229 | 83% | 93% | **13%** | 83% | 93% |
| events | 1682 | 97% | 98% | **0%** | 97% | 98% |
| **objects** | 276 | **0%** | **0%** | **0%** | 93% | **0%** |
| **titles** | 94 | **0%** | **0%** | **0%** | **0%** | **0%** |

Deci nu e o problemă uniformă. Trei observații:

1. **Nucleul (locations/characters/houses/events) e consistent bogat** — 78–98% pe câmpurile structurale. Aici stratul de îmbogățire a funcționat. `AUDIT_FINAL_v2` nu exagerează pe partea asta.
2. **`aliasuri` e gaura reală, transversală.** 0–28% acoperire. Contează direct pentru tine: `SearchEngine.extractSearchTerms` (`SearchEngine.js:162-166`) folosește `aliasuri` ca sursă principală de sinonime. Cu 11% acoperire la personaje și **0% la evenimente**, căutarea după orice denumire alternativă („Nunta Roșie" vs. numele generat) eșuează. Asta e mai important decât pare — e cauza de fond a senzației că „search-ul nu găsește".
3. **Nivel 5 (objects + titles) este, de fapt, neintegrat.** Vezi §2.7.

**Bonus, legat de completitudine:** filtrul `isLowCompletenessEntity` (`js/utils/config.js:20-34`) cere **ambele** condiții — `scor_total < 0.15` **ȘI** `nr_afirmatii_brute < 2`. Am evaluat predicatul peste toate entitățile: **ascunde exact 0 entități**, în toate categoriile. E apelat în 3 locuri (`SearchEngine.js:15,35,52,71,90,105,121`, `MapRenderer.js:272`) și nu face nimic niciodată. Sonnet îl menționează la §1.3 ca ipoteză eliminată — corect, dar a ratat că filtrul e mort cu totul.

### 2.7 🟠 Nivel 5 (`objects.json`, `titles.json`) nu e conectat la aplicație

`AUDIT_FINAL_v2_Stare_Reala.md` §9.5 declară: *„`objects.json` (276) și `titles.json` (94) populate, verificate. Fără probleme cunoscute la acest nivel."*

**Infirm.** `DataManager.loadAll()` (`DataManager.js:22-35`) listează 12 URL-uri. `objects.json` și `titles.json` **nu sunt printre ele**. `this.data.objects` și `this.data.titles` nu sunt niciodată populate.

Consecință: `SearchEngine.js:104-133` conține două blocuri complete de indexare pentru obiecte și titluri, ambele protejate de `if (dataManager.data.objects)` / `if (dataManager.data.titles)`. Condițiile sunt **permanent false**. 370 de entități, cod de indexare scris, zero rezultate posibile.

Sonnet menționează la §1.1 că `object` și `title` n-au ramură în handler-ul de search — corect, dar cauza e mai devreme: nici măcar nu ajung în index.

### 2.8 🟡 Duplicatul Oldtown e încă viu, și e chiar pe hartă

`AUDIT_FINAL_v2` §9.1 declară duplicatele Oldtown rezolvate: *„Oldtown (de 2 ori: `oldtown_city`, `turnul_inalt`, `vechiul_oras_oldtown`)"*, cu 6 duplicate reparate.

Ambele intrări sunt încă în date **și ambele au pin în `catalog.json`**:

| id | `type` | `name` | pin |
|---|---|---|---|
| `oldtown` | `castle` | `Hightower (Oldtown)` | ✅ |
| `oldtown_city` | `city` | (oraș / instituție a maesterilor) | ✅ |

Sunt două markere pe hartă pentru același loc. În captura ta se vede `TOWER (OLDTOWN)` în stânga-jos, cu un al doilea marker cu turn dedesubt.

În plus, `MapRenderer.js:480` are ramura `locId === 'hightower' || locId === 'oldtown_city'`. **`hightower` nu există în date** — verificat: nu e în `locations.json`, `free_cities.json` sau `far_lands.json`. Ramură moartă, rămasă dintr-o redenumire.

### 2.9 🟡 Două din cele nouă sedii mari nu sunt pe hartă

`MapRenderer.js:6-10` (`CAPITAL_LOCATIONS`) și `TimelineEngine.js:157-167` (`seats`) tratează 9 sedii regionale ca ancore. Starea lor reală:

| id | în date | tip randabil | **are pin** |
|---|---|---|---|
| `highgarden` | ✅ | ✅ | ❌ |
| `storm_end` | ✅ | ✅ | ❌ |
| `castle_black` | ✅ | ✅ | ❌ |
| celelalte 11 | ✅ | ✅ | ✅ |

**Highgarden (Reach) și Storm's End (Stormlands) nu apar pe hartă** — două din cele șapte regate rămân fără capitală vizibilă. `castle_black` are marker SVG custom scris manual (`MapRenderer.js:462-474`) care nu se randează niciodată.

Prioritate maximă la calibrarea manuală: astea trei, înaintea oricărei alte locații.

### 2.10 🟡 Duplicare de logică — tiparul `getCastle || getCity || landmarks.find`

Da, exact tiparul din întrebarea ta. **8 apariții identice**, în 2 fișiere:

- `js/app.js:118`, `:127`, `:150`, `:166`, `:179`
- `js/ui/InfoPanel.js:663-665`, `:701-703`

`DataManager` are `getCastle`, `getCity`, `getHouse`, `getFaction`, `getInstitution`, `getCharacter`, `getDragon`, `getEvent` — dar **nu are `getLocation(id)`**. Cele 8 copii sunt consecința directă a acestei absențe. O metodă de 3 linii în `DataManager.js` le înlocuiește pe toate — și devine locul natural unde să adaugi normalizarea `LOCATION_*` din §2.2.

**Duplicare a doua, mai insidioasă:** `getLocationSubtype()` și `TYPE_TO_SUBTYPE` sunt definite **de două ori, identic**, în `js/ui/FilterPanel.js:11-22` și `js/map/MapRenderer.js:14-25`. Filtrul și randarea depind de acordul lor exact. Orice modificare într-un fișier și nu în celălalt face ca bifarea unui subtip să nu mai corespundă pinurilor — un bug care s-ar manifesta ca „filtrul nu funcționează" și ar fi foarte greu de urmărit.

**Duplicare a treia:** normalizarea de id (`replace(/^(PERSON_|HOUSE_|LOCATION_|EVENT_|OBJECT_|TITLE_)/i, '').toLowerCase()`) e copiată în 4 locuri: `WikiPage.js:45`, `WikiPage.js:325`, `InfoPanel.js:924`, `InfoPanel.js:1044`.

### 2.11 🟡 Gestionarea erorilor JS — tiparul e „prinde tot și continuă în tăcere"

Ai cerut exemple concrete dincolo de `location.coordinates.x`. Codul oscilează între două extreme, ambele problematice.

**(a) Fetch fără nicio verificare — `DataManager.js:39-42`.** Niciun `response.ok`. Dacă oricare din cele 12 fișiere lipsește sau serverul întoarce 404, `response.json()` aruncă pe un `<!DOCTYPE html>`, `loadAll()` respinge, iar `app.init().catch(console.error)` (`app.js:299`) înghite eroarea. Rezultatul: **ecranul de încărcare rămâne pe loc, la infinit, fără niciun mesaj.** `index.html:22` — loader-ul se ascunde doar la `app.js:96-100`, cod care nu se mai atinge. Cel mai prost mod de a eșua: niciun semnal către utilizator.

**(b) `try`/`catch` per-marker care ascunde eșecuri — `MapRenderer.js:363-647`.** Întreaga construcție a unui marker e învelită într-un `try`, iar `catch` (linia 645-647) doar face `console.error` cu prefixul `[map-editor]` (greșit — codul e în randarea hărții principale, nu în editor). Un marker care eșuează dispare pur și simplu; harta pare completă. Același tipar la `MapRenderer.js:344-346`.

**(c) Acces în lanț fără gardă, în cod critic.** `app.js:208`:
```js
tooltip.innerHTML = `...${detail.location.type.toUpperCase()}...`
```
`detail.location.type` — dacă `type` lipsește, aruncă la fiecare hover. `MapRenderer.js:366` normalizează `type` la `'unknown'`, deci în practică e acoperit, dar prin coincidență, nu prin intenție.

**(d) `getWorldState` fără gardă.** `MapRenderer.js:337` și `:371` fac `t?.year <= worldState.year`. `worldState` nu e verificat. Dacă `TimelineEngine.getWorldState()` întoarce `null` (posibil pentru ani fără date), toată randarea markerelor aruncă — prinsă de `catch`-ul de la (b), deci **harta apare goală, fără nicio eroare vizibilă**.

**(e) `validateRegionLocationMembership()` e cod mort.** `DataManager.js:193-202` iterează `this.data.calibratedRegionPolygons`, care e setat la `{}` la linia 71 și nu e populat niciodată. La fel `getRegionBounds()` (`:185-187`), deci listener-ul `regionSelected` din `app.js:193-201` se oprește mereu la `if (!bounds) return;`. **Selecția pe regiune de pe hartă nu funcționează** — nu ca bug, ci pentru că geometria calibrată nu există. `MapRenderer.js:867-884 renderCalibratedRegionPolygons()` randează, din același motiv, un grup gol.

**(f) `data.missingCoordinates`** — `DataManager.js:72` îl inițializează, `MapRenderer.js:274-281` îl populează și îl logează, nimic din UI nu îl citește vreodată.

### 2.12 🟡 Nume de locații care sunt de fapt liste sau note de OCR

Peste cele 86 de „entități de spart" din `AUDIT_FINAL_v2` §9.4, în `locations.json` există intrări al căror `name` nu e un nume:

- Un `name` de **332 de caractere** enumerând 17 locuri distincte (`Malul de est al Gărzii Văduvei, Creasta Arbaletei, Lunca Rutului, Moara de Porumb, …`), cu un `id` de 300+ caractere generat prin slugificarea întregii liste.
- Un `name` de 111 caractere care e o listă de 6 hanuri.
- `Fingers (Degetele) [posibil corupt OCR: apare ca „Fingers" în text, formă originală engleză]` — o notă de audit stocată ca nume.
- `Inima Avântată (Heart's Home?) / referință vagă „năluca de la Inima Avântată"` — semnul de întrebare face parte din nume.
- `Drumul de munte / trecătoarea dintre hanul de la răscruce și Vale (nenumit explicit)`.

**76 din 1099 de locații au paranteze în nume.** Aceste intrări trec în `SearchEngine` ca `primaryName` (`SearchEngine.js:19`) și în etichetele hărții (`MapRenderer.js:614`). Sunt și cauza directă a bug-ului King's Landing din §1.3.

### 2.13 🟢 Observații minore, verificate

- **Fără `Promise.all` la timeline:** `DataManager.js:109-113` face un `await fetch` într-o buclă pentru `timelineYears = [1]` — un array cu un singur element, marcat „Extensible". Inofensiv acum, aceeași greșeală ca la §2.4 dacă se extinde.
- **`setSelectedRegion` — O(n·m) inutil.** `MapRenderer.js:822-826` apelează `getAllLocations().find(...)` **în interiorul** unei bucle peste toate markerele. `getAllLocations()` construiește un array nou de 391 de elemente la fiecare iterație. Cu 77 de markere: 77 de alocări + 77 de scanări liniare, la fiecare selecție de regiune.
- **Cale cu spațiu în `href` SVG:** `catalog.json:19` → `"assets/Mapa/HARTA LUMII.png"`. Funcționează în browserele actuale, dar e fragil la orice server care nu tolerează spații necodate.
- **`preserveAspectRatio: 'none'`** pe imaginea de teren (`MapRenderer.js:862`) întinde o imagine de 7685×5115 într-un canvas de 1500×1000 (raport 1.5:1 vs. 1.5:1 — de fapt aproape identic, deci fără distorsiune vizibilă; corect în practică, dar `'none'` înseamnă că orice schimbare de rezoluție a hărții va distorsiona silențios).
- **`do_POST` fără corp citit la 404** (`server.py:104`): `send_error(404)` fără a consuma `Content-Length` poate desincroniza conexiunea keep-alive.
- **`__pycache__/` în rădăcina proiectului** — artefacte compilate ale scripturilor, servite static, netrackuite, fără `.gitignore`.

---

## Partea 3 — Opinia mea

### Cât de bun a fost auditul lui Sonnet 5

**Solid pe suprafață, dar oprit exact înainte de stratul care contează.** Nu e superficial — citările sunt reale, `panels.css:127` e exact acolo, `DistanceTool.js:146` e exact acolo, iar diagnosticul de la §1.1 (evenimentele din search) e complet corect. Recomandările de UX sunt rezonabile. Un audit onest.

Dar are un tipar de eroare consistent: **a verificat că un cod există, nu că el se execută cu datele reale.**

Trei exemple din același tipar:

1. A spus că silueta ar trebui determinată de tip, nu de steag (§2.2). Codul face deja fix asta (`MapRenderer.js:29-40`). Ce nu a verificat: că 93% din locații nu au timeline, deci nu au casă, deci cad pe ramura cu cerc.
2. A spus că filtrul „Epoca Targaryen" e ușor pentru că „se leagă de `timeline`-urile deja existente pe fiecare locație/casă" (§5). 74 din 1099.
3. A spus că numele pe ape „nu e un obstacol tehnic mare" și a propus `textPath` (§4.3). Sistemul e complet construit și golit de date (`world_features.json`: 10 rânduri, 0 mări).

Și o eroare factuală care l-a costat concluzia principală: a confirmat că `kings_landing` are coordonate valide „în `locations.json`", când de fapt le are doar în `catalog.json`. Pe baza acelei verificări a exclus explicit propria descoperire corectă (`location.coordinates.x`) drept cauză. **Bug-ul pe care l-a găsit era chiar cauza bug-ului pe care nu l-a putut explica.** N-avea nevoie de consolă live; avea nevoie să deschidă intrarea `kings_landing` și să se uite la chei.

**Prea optimist**, net. Formulări ca „Nivel 5 complet, verificat funcțional" (preluat din auditul anterior fără verificare) sau „✅ Ușor" pe filtrul Targaryen dau senzația unui proiect la 85% care are nevoie de lustruire. Cifrele spun altceva: **7% din locații sunt vizibile pe hartă, 36% din locații sunt utilizabile în aplicație, 36% din evenimentele datate sunt inaccesibile prin timeline, 69% din personaje n-au conținut suficient pentru o pagină.**

Ceea ce nu înseamnă că proiectul e prost. Baza de date e serioasă — 12193 de referințe verificate, provenență la nivel de pagină, 467 de distanțe narative extrase. Munca grea e făcută. Problema e **stratul de legătură dintre date și aplicație**, și e mai subțire decât arată.

### Ce aș fi prioritizat diferit

Sonnet pune arhitectura `/harta` vs `/wiki` pe locul 1, „pentru că rezolvă simultan 3 probleme raportate". Nu sunt de acord. E o refactorizare mare (routing care nu există deloc) peste o fundație de date care încă pierde 64% din locații. Ai reconstrui navigarea către un conținut care în mare parte nu ajunge acolo.

Ordinea mea, strict după raport impact/efort:

**Întâi — reparațiile de o linie, cu impact disproporționat (câteva ore în total):**

1. **`type: "location"` → tip concret** (§2.1). Recuperează 708 locații în search, filtre și hartă. Cea mai mare schimbare de la cel mai mic efort din tot raportul.
2. **`location || locatie_id`** în `InfoPanel.js:1023` și `WikiPage.js:365` (§2.2). Repară legătura de locație pentru 289 de evenimente.
3. **`location.coordinates?.x`** în `app.js:280`, sau mutarea `getRenderedPosition()` înaintea liniei 280 (§1.3). Repară King's Landing și încă 326 de locații.
4. **Normalizarea `HOUSE_*` în `SearchEngine.js:54`** (§2.4). Repară zoom-ul pe personaje pentru toate cele 631 de referințe.
5. **`ThreadingHTTPServer(('127.0.0.1', 8000), ...)`** în `server.py:182` (§2.3). Elimină expunerea în rețea.
6. **`Timeline.js:23` → `maxYear = 302`** (§4.1). Deblochează 557 de evenimente.
7. **`Promise.all` în `DataManager.js:39-42`** (§2.4).
8. **Ștergerea lui `assets/Mapa/HARTA LUMII.zip`** — 46.5 MB de greutate moartă în directorul servit.

Punctele 1–8 sunt mai puțin de o zi de lucru împreună și schimbă mai mult din aplicație decât orice de pe lista lui Sonnet.

**Apoi — igiena, înainte să se acumuleze mai mult:**

9. `.gitignore` + commit pentru `scripts/` (§2.5). Nu e emoționant, dar acum riști să pierzi stratul care generează datele, și e singura parte a proiectului fără plasă de siguranță.
10. Calibrarea manuală a **Highgarden, Storm's End, Castle Black** (§2.9), înaintea oricăror altor pinuri.
11. Normalizarea `subtip` la un vocabular închis (§4.2) — precondiție obligatorie pentru gruparea filtrelor pe care o vrei.
12. Adăugarea numelor de mări în `world_features.json` (§4.3) — infrastructura există, sunt rânduri de JSON.

**Abia apoi — lucrurile mari:**

13. `/harta` vs `/wiki` cu routing real. Aici sunt de acord cu Sonnet pe fond, doar nu pe moment. După punctele 1–4, jumătate din simptomele pe care le-ar rezolva separarea vor fi deja dispărut, și vei ști mai bine ce trebuie separat.
14. Distanțele narative ca rezultat principal, cu selecție prin dropdown, nu prin click pe hartă (§1.2).
15. Restructurarea paginii de personaj. O las ultima deliberat: cu 69% din personaje sub scor 0.3 și 34 din 2288 cu descriere, ai proiecta un container pentru un conținut care nu există încă. Merită după o rundă de îmbogățire, nu înainte.

### O ultimă observație

`AUDIT_FINAL_v2_Stare_Reala.md` §0, regula 2 — *„Verifică fișierele, nu doar raportul text al agentului"* — este cea mai bună regulă din tot proiectul, și e regula pe care auditul lui Sonnet a încălcat-o. E ceva ce merită observat despre metodă: `audit_integritate_referentiala.json` raportează 326 referințe rupte din 12193 (2.7%), iar cifra e corectă *pentru ETL*. La runtime, în browser, fără `id_map.json` încărcat, aceleași date dau **855 de `locatie_id` și 2194 de `participanti` care nu rezolvă direct**.

Ambele numere sunt adevărate. Măsoară lucruri diferite. Proiectul are un audit de date bun și niciun audit al integrării — și exact în golul dintre ele stau majoritatea bug-urilor pe care le-ai raportat tu, din poze.
