# Ghid de implementare — Atlas of Westeros v2

**Bazat pe:** sinteza a patru audituri (Sonnet 5, Opus 5 / Claude Code, ChatGPT, Grok) + verificare programatică independentă pe `admin.zip`.
**Scop:** trecerea de la v1 la v2, cu prompturi gata de rulat, împărțite pe unelte.
**Regulă generală:** niciun prompt din acest ghid nu se rulează fără commit înainte.

---

## 0. Cum se folosește ghidul

### 0.1 Regula de rutare pe unelte

| Unealtă | Ce primește | De ce |
|---|---|---|
| **Antigravity** | Muncă mecanică, mult text, zero decizii de arhitectură: rescrieri în masă, extragere de stringuri, traduceri, editări repetitive pe zeci de fișiere, curățenie de proiect | Consumă tokeni mulți pe operații ieftine intelectual — exact ce nu vrei să plătești la Claude |
| **Codex** | Sarcini algoritmice grele, dar **complet specificate**: scripturi ETL cu dry-run, algoritmi (anti-coliziune, motor de distanțe), transformări de date cu invarianți verificabili, teste | Are un enunț închis și un criteriu de corectitudine măsurabil. Nu are nevoie de judecată asupra produsului |
| **Claude Code** | Decizii de arhitectură, refactorizări care ating multe fișiere simultan, proiectare de scheme, orice atinge modelul de date sau contractul dintre module | Sunt sarcini unde greșeala costă o săptămână, nu o oră |

**Test rapid de rutare:** dacă poți scrie criteriul de acceptanță ca o comandă care întoarce un număr → Codex sau Antigravity. Dacă criteriul e „arată bine / e coerent / nu strică altceva" → Claude Code.

### 0.2 Contractul de verificare (se lipește în FIECARE prompt)

```
REGULI OBLIGATORII PENTRU ACEASTĂ SARCINĂ:
1. Înainte de orice modificare, rulează `git status`. Dacă arborele nu e curat, oprește-te
   și raportează. Nu lucra peste modificări necommitate.
2. Nu modifica niciun fișier din data/ decât dacă sarcina o cere explicit.
3. Nu rula niciun script din scripts/ sau scratch/ decât dacă sarcina o cere explicit.
4. La final, raportează:
   - lista exactă a fișierelor modificate
   - numărul de linii adăugate/șterse per fișier
   - rezultatul criteriului de acceptanță, ca ieșire de comandă, nu ca afirmație
5. Dacă descoperi că premisa sarcinii e greșită, OPREȘTE-TE și raportează.
   Nu improviza o sarcină alternativă.
```

### 0.3 Contextul de proiect (se lipește o dată per sesiune nouă)

```
CONTEXT PROIECT — Atlas of Westeros
Aplicație web: hartă SVG interactivă + wiki pentru universul ASOIAF.
Stack: JS vanilla cu module ES, fără framework, CSS custom, server.py (Python, static + API admin).

Structură:
  js/app.js                 orchestrare, wireEvents, selectEntity
  js/data/                  DataManager, SearchEngine, TimelineEngine
  js/map/                   MapRenderer, MapInteraction, MapLayers, MapAnimations, RegionSelector
  js/ui/                    SearchBar, InfoPanel, WikiPage, FilterPanel, Timeline, DistanceTool, Toolbar
  admin/map-editor.html|js  panou de calibrare coordonate
  data/                     JSON-uri (locations, characters, houses, events, dragons, objects, titles, map)
  scripts/                  ~40 scripturi Python de ETL (majoritatea deja rulate o dată)

Cifre reale, verificate (nu presupune altele):
  1099 locații încărcate → 391 utilizabile în aplicație → 77 vizibile pe hartă
  708 locații au type:"location" și sunt filtrate complet din getAllLocations()
  2288 personaje, 1682 evenimente, 229 case, 3 dragoni, 276 obiecte, 94 titluri
  objects.json și titles.json NU sunt încărcate de DataManager
  milesPerUnit este null → distanța geometrică indisponibilă
```

---

## 1. Harta fazelor

| Fază | Temă | Blochează | Unelte dominante |
|---|---|---|---|
| **F0** | Plasa de siguranță | tot | Antigravity |
| **F1** | Cablajul date ↔ aplicație | F4, F5, F6 | Claude Code + Antigravity |
| **F2** | Taxonomia locațiilor | F4, F5, F6 | Claude Code + Codex |
| **F3** | Bilingv RO/EN | F5, F6 | Claude Code + Antigravity |
| **F4** | Harta credibilă | F6 | Claude Code + Codex |
| **F5** | UX-ul reclamat | — | Claude Code |
| **F6** | `/harta` vs `/wiki` | — | Claude Code |
| **F7** | Funcționalități noi | — | mixt |

**Nu sări peste F1 și F2.** Tot ce e după ele presupune că datele ajung în aplicație și că au o taxonomie.

---

# FAZA 0 — Plasa de siguranță

*Fără asta, orice greșeală de mai jos e ireversibilă. `scripts/` nu e în git deloc.*

## P0.1 — Igiena repository-ului
**Unealtă:** Antigravity · **Depinde de:** nimic · **Efort:** 15 min

```
Sarcină: pune proiectul Atlas of Westeros sub control de versiune sănătos.

1. Creează .gitignore în rădăcină cu:
   __pycache__/
   *.pyc
   *.zip
   data.zip
   Imagini dovezi/
   .DS_Store
   scratch/

2. Verifică dacă vreun fișier deja urmărit de git se potrivește cu regulile noi.
   Dacă da, scoate-l din index cu `git rm --cached`, fără a-l șterge de pe disc.

3. Adaugă și commit-uiește întreg directorul scripts/ (în prezent 0 fișiere urmărite).
   Mesaj de commit: "chore: track ETL scripts and add gitignore"

4. Rulează `git count-objects -v`. Dacă size-pack este 0, rulează `git gc`.
   Raportează dacă găsești obiecte temporare orfane (tmp_obj_*) în .git/.

Criteriu de acceptanță (rulează și lipește ieșirea):
   git status --short          → gol
   git ls-files scripts/ | wc -l → număr > 0
   git check-ignore -v data.zip → confirmă că e ignorat

NU șterge niciun fișier de pe disc. NU atinge data/.
```

## P0.2 — Închiderea serverului admin
**Unealtă:** Antigravity · **Depinde de:** P0.1 · **Efort:** 10 min

```
Sarcină: server.py expune un API de scriere fără nicio autentificare, pe toate
interfețele de rețea.

Problema exactă, linia 182:
    ThreadingHTTPServer(('', 8000), AtlasHandler).serve_forever()
'' înseamnă 0.0.0.0. Endpointurile POST /api/save-coordinates, POST/PUT/DELETE
/api/locations/<id> și /api/houses/<id> pot fi apelate de oricine din aceeași rețea.

1. Schimbă legarea la '127.0.0.1'.
2. Adaugă un argument de linie de comandă --host cu valoarea implicită '127.0.0.1',
   ca să poți expune deliberat când chiar vrei.
3. Adaugă la pornire un mesaj care afișează pe ce adresă ascultă.
4. La server.py:104, do_POST trimite send_error(404) fără să consume corpul cererii
   (Content-Length). Consumă corpul înainte de a răspunde, ca să nu desincronizezi
   conexiunile keep-alive.

Criteriu de acceptanță:
   python server.py pornit → `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/` → 200
   de pe altă mașină din rețea, același curl pe IP-ul LAN → connection refused

NU adăuga autentificare cu parolă în această sarcină. Doar legarea la loopback.
```

## P0.3 — Carantina scripturilor deja rulate
**Unealtă:** Antigravity · **Depinde de:** P0.1 · **Efort:** 30 min

```
Sarcină: 26 din ~40 de scripturi din scripts/ scriu direct în data/ fără dry-run,
fără backup și fără confirmare. Multe au nume care sugerează operații unice, deja
aplicate (merge_*_nivel1.py, dedup_*, retire_*, filter_*). Rerularea lor peste date
deja procesate ar corupe datele.

1. Pentru fiecare fișier .py din scripts/, determină prin citire (NU prin rulare):
   - scrie în data/ ? (caută open(..., 'w'), json.dump, .to_csv, Path.write_text)
   - are argparse / --dry-run / backup / input() ?
   - din nume și din comentarii, pare operație unică deja aplicată ?

2. Produce scripts/INVENTAR.md cu un tabel: fișier | scrie în data | gărzi | verdict
   (activ / unic-deja-rulat / utilitar de citire).

3. Mută fizic în scripts/archive/ tot ce e clasificat "unic-deja-rulat".
   Adaugă scripts/archive/README.md care explică de ce sunt acolo și că rerularea
   e periculoasă.

4. Pentru cele rămase în scripts/ care scriu în data/ fără gardă, adaugă la începutul
   fiecăruia un bloc care refuză rularea fără flagul --i-know-what-im-doing.
   NU rescrie logica scriptului, doar adaugă garda.

Criteriu de acceptanță:
   grep -L "i-know-what-im-doing" scripts/*.py | xargs grep -l "json.dump" | wc -l → 0
   ls scripts/archive/*.py | wc -l → număr > 0

NU rula niciun script. NU modifica logica de transformare a datelor.
```

---

# FAZA 1 — Cablajul dintre date și aplicație

*Toate sunt reparații punctuale, fără schimbare de date. Împreună sunt sub o zi de lucru și schimbă mai mult decât orice redesign.*

## P1.1 — Bug-ul King's Landing (`id_intern` ca array)
**Unealtă:** Claude Code · **Depinde de:** F0 · **Efort:** 30 min
**De ce Claude Code:** atinge trei fișiere și cere o decizie de contract de date (unde normalizezi), nu doar un patch local.

```
Sarcină: repară crash-ul care face ca King's Landing, Oldtown (oraș) și Storm's End
să nu se activeze deloc la click, nici din search, nici de pe hartă.

CAUZA EXACTĂ, verificată:
js/ui/InfoPanel.js:177
    const isCharacter = entity.type === 'character' || entity.id_intern?.startsWith('PERSON_') || ...
Operatorul ?. protejează de null/undefined, NU de "nu e funcție".
Exact 3 locații din 1099 au id_intern ca ARRAY în loc de string:
    kings_landing, oldtown_city, storm_end
Pentru ele se aruncă TypeError: entity.id_intern.startsWith is not a function.

Crash-ul se produce în interiorul infoPanel.open(), apelat din app.js:275 — adică
ÎNAINTE de highlightLocation() (278) și de zoom (280). De aceea panoul nu apare deloc.
Clasa .open se adaugă abia la InfoPanel.js:809, cod care nu se atinge niciodată.

Trei situri identice de crash:
    js/ui/InfoPanel.js:177   (isCharacter)
    js/ui/InfoPanel.js:178   (isEvent)
    js/ui/WikiPage.js:92     (isCharacter)

CERINȚE:
1. Normalizează id_intern la un array de stringuri O SINGURĂ DATĂ, în
   DataManager.mapCompatibility (DataManager.js:78-92), astfel încât restul codului
   să poată presupune întotdeauna un array. Aplică normalizarea și pentru houses,
   characters, events, dragons — nu doar locations.
2. Rescrie cele trei situri ca test pe array (ex: o funcție ajutătoare
   hasInternPrefix(entity, 'PERSON_')). Pune funcția într-un singur loc, importată,
   nu duplicată.
3. DataManager.js:230-231 (getNarrativeDistances) compară id_intern cu === pe string.
   Cu array-uri asta e permanent fals. Fă comparația să funcționeze pe array.
4. Verifică dacă mai există în cod alte apeluri de metode de string pe câmpuri care
   pot fi array (aliasuri, tags, id_intern). Raportează-le, nu le repara pe toate.

Criteriu de acceptanță:
   node -e "..." sau un test scurt care încarcă locations.json, aplică normalizarea
   și confirmă că pentru kings_landing, oldtown_city, storm_end funcția
   hasInternPrefix nu aruncă.
   Manual în browser: click pe King's Landing din search → panoul se deschide,
   consola fără excepții.

NU schimba datele din locations.json. Normalizarea se face la încărcare, în cod.
```

## P1.2 — `getLocation()` unificat + garda pe coordonate
**Unealtă:** Claude Code · **Depinde de:** P1.1 · **Efort:** 45 min
**De ce Claude Code:** elimină 8 duplicate identice și creează punctul central prin care vor trece normalizările din F2 și F3.

```
Sarcină: unifică rezolvarea de locație și repară dereferențierea nesigură de coordonate.

PROBLEMA 1 — tipar duplicat de 8 ori:
    this.dataManager.getCastle(id) || this.dataManager.getCity(id)
      || this.dataManager.data.landmarks.find(l => l.id === id)
Apare în: js/app.js:118, :127, :150, :166, :179 și js/ui/InfoPanel.js:663-665, :701-703.
DataManager are getCastle/getCity/getHouse/getCharacter/getDragon/getEvent, dar NU are
getLocation(id).

PROBLEMA 2 — js/app.js:280-281:
    let targetX = location.coordinates.x;
    let targetY = location.coordinates.y;
Citește .x fără gardă. 327 din 391 de locații randabile nu au câmpul `coordinates`
la rădăcină. Fallback-ul defensiv getRenderedPosition() e apelat abia la linia 282,
deci garda nu apucă să ruleze.
ATENȚIE: acesta NU este bug-ul King's Landing. King's Landing ARE coordinates
{x:304.4, y:580.2}. Un audit anterior a susținut contrariul — este fals, verificat.

CERINȚE:
1. Adaugă DataManager.getLocation(id) care caută în castles, cities, landmarks.
   Construiește un Map id→locație o singură dată la loadAll, ca lookup-ul să fie O(1)
   (acum e o scanare liniară peste 391 de elemente la fiecare apel).
2. Înlocuiește toate cele 8 apariții cu getLocation().
3. În selectEntity, mută getRenderedPosition() ÎNAINTE de citirea coordonatelor și
   folosește location.coordinates ca fallback secundar, cu optional chaining.
   Dacă nici una nu dă o poziție validă, deschide panoul și NU face flyTo.
4. MapRenderer.js:822-826 (setSelectedRegion) apelează getAllLocations().find() în
   interiorul unei bucle peste toate markerele — construiește un array de 391 de
   elemente la fiecare iterație. Folosește noul Map.

Criteriu de acceptanță:
   grep -rn "getCastle(.*) || .*getCity" js/ | wc -l → 0
   Click pe orice locație fără coordonate (ex. Highgarden din search) → panoul se
   deschide, consola fără excepții, harta nu sare aiurea.
```

## P1.3 — Ordinea câmpurilor de locație la evenimente
**Unealtă:** Antigravity · **Depinde de:** P1.2 · **Efort:** 10 min

```
Sarcină: inversează ordinea a două câmpuri, în două fișiere.

js/ui/InfoPanel.js:1023 și js/ui/WikiPage.js:365 conțin:
    const locId = entity.locatie_id || entity.location;

Verificat programatic peste cele 875 de evenimente care au o locație:
    locatie_id (brut, format LOCATION_*)  rezolvă  0 / 875
    location   (rezolvat)                 rezolvă  875 / 875

Codul citește exact câmpul care nu rezolvă niciodată, apoi încearcă să-l repare cu
o euristică de eliminare de prefix care reușește doar în 586/875 cazuri, pentru că
pică pe perechile română↔engleză (LOCATION_PUMNUL_PRIMILOR_OAMENI → pumnul_primilor_oameni,
dar id-ul real e fist_of_first_men).

CERINȚĂ: schimbă în ambele fișiere în:
    const locId = entity.location || entity.locatie_id;
Păstrează euristica de fallback pentru cazul în care `location` lipsește.

Criteriu de acceptanță: un script de o dată care încarcă events.json și numără
câte evenimente rezolvă la o locație reală cu noua ordine → 875.

NU atinge nimic altceva în cele două fișiere.
```

## P1.4 — Normalizarea prefixului `HOUSE_`
**Unealtă:** Antigravity · **Depinde de:** P1.2 · **Efort:** 15 min

```
Sarcină: repară zoom-ul haotic la căutarea de personaje.

js/data/SearchEngine.js:54 citește:
    const houseId = this.normalizeSearchField(char.house || char.membru_al, ...)
Toate cele 631 de valori `membru_al` din characters.json au forma HOUSE_TARGARYEN,
HOUSE_STARK etc., iar id-urile din houses.json sunt targaryen, stark.
Verificat: 0/631 rezolvă direct, 631/631 rezolvă după eliminarea prefixului.

Consecință: în app.js:143-147, fallback-ul care ar trebui să ducă personajul la
sediul casei lui nu se activează NICIODATĂ. Rămâne doar char.timeline, care există
la foarte puține personaje — de aici zoom-ul aleatoriu sau absent.

CERINȚE:
1. Normalizează houseId în SearchEngine.js:54 prin eliminarea prefixului HOUSE_ și
   trecerea la lowercase, ÎNAINTE de a-l pune în index.
2. Există deja o expresie de normalizare de prefix copiată în 4 locuri:
   WikiPage.js:45, WikiPage.js:325, InfoPanel.js:924, InfoPanel.js:1044.
   Extrage-o într-o singură funcție exportată din js/utils/helpers.js, numită
   stripEntityPrefix(id), și folosește-o în toate cele 5 locuri (cele 4 + cel nou).

Criteriu de acceptanță:
   grep -rn "PERSON_|HOUSE_|LOCATION_" js/ | grep replace | wc -l → 1
   Un script de o dată: câte din cele 631 membru_al rezolvă la o casă după
   normalizare → 631.
```

## P1.5 — Reconectarea tipurilor de entități orfane
**Unealtă:** Codex · **Depinde de:** P1.2 · **Efort:** 1h
**De ce Codex:** enunț închis, criteriu numeric, fără decizii de produs.

```
Sarcină: trei tipuri de entități există în date și au cod de UI scris, dar nu ajung
niciodată la utilizator.

PROBLEMA A — objects și titles nu se încarcă:
DataManager.loadAll() (js/data/DataManager.js:22-35) listează 12 URL-uri.
data/objects/objects.json (276 intrări) și data/titles/titles.json (94 intrări) NU
sunt printre ele. Prin urmare this.data.objects și this.data.titles rămân undefined,
iar blocurile de indexare din SearchEngine.js:104-133 sunt protejate de
`if (dataManager.data.objects)` — condiție permanent falsă. 370 de entități,
cod de indexare scris, zero rezultate posibile.

PROBLEMA B — event/object/title nu au ramură în handlerul de search:
js/app.js:117-174, searchBar.onSelect are ramuri doar pentru house/faction/institution,
character și dragon. Pentru event, object, title, `entity` rămâne undefined și
`if (entity)` de la linia 171 nu se declanșează → click-ul nu face nimic.

IMPORTANT: pagina de wiki pentru evenimente EXISTĂ și e funcțională
(WikiPage.js:321-330 participanți cu roluri, :365 locație, :269-270 evenimente legate).
Nu o rescrie. E doar deconectată.

CERINȚE:
1. Adaugă objects.json și titles.json în loadAll(). Aplică-le aceeași
   mapCompatibility ca celorlalte. Dacă schema lor diferă (verifică: au 0%
   _afirmatii_pe_predicat, 0% id_intern), documentează diferența într-un comentariu,
   nu inventa câmpuri.
2. Adaugă în app.js ramuri pentru event, object, title:
   - entity = getEvent(id) / getObject(id) / getTitle(id)
   - loc rămâne null pentru toate trei (nu au poziție geografică proprie)
   - selectEntity(entity, null) deschide panoul fără zoom
3. Adaugă DataManager.getObject(id) și getTitle(id).
4. InfoPanel trebuie să știe să randeze object și title. Dacă nu are ramură, adaugă
   una minimală (nume, tip, descriere dacă există, surse) — NU o pagină elaborată.

Criteriu de acceptanță:
   - căutarea unui obiect cunoscut din objects.json întoarce rezultat
   - click pe el deschide panoul
   - click pe un eveniment deschide panoul și butonul "Vezi pagina completă" duce la
     WikiPage cu participanți randați
   - consola fără excepții

NU modifica structura JSON a fișierelor objects.json / titles.json.
```

## P1.6 — Curățenie de performanță și de interval
**Unealtă:** Antigravity · **Depinde de:** F0 · **Efort:** 20 min

```
Sarcină: patru schimbări independente, mecanice.

1. js/ui/Timeline.js:22-23 fixează minYear = 1, maxYear = 300.
   Datele reale din events.json: 1561 evenimente cu an numeric, interval -114 … 302.
   557 de evenimente (35.7%) au an > 300 și sunt inaccesibile prin slider; Timeline.js:145-146
   calculează poziția ca (year - 1) / 299 și o limitează la [2%, 98%], deci toate 557
   se suprapun într-un teanc la marginea dreaptă a minimap-ului.
   → Calculează minYear și maxYear DINAMIC din datele încărcate, la inițializare,
     în loc de constante. Formula de poziție trebuie să folosească intervalul real.

2. js/data/DataManager.js:39-42 încarcă 12 JSON-uri în serie cu await într-un for.
   Cu characters.json 12.6 MB, locations.json 7.5 MB, events.json 5.8 MB, houses.json
   3.6 MB, asta e ~30 MB secvențial.
   → Înlocuiește cu Promise.all. Păstrează ordinea de atribuire în `temp`.
   → Adaugă verificare response.ok. Dacă un fetch eșuează, afișează un mesaj vizibil
     în ecranul de încărcare în loc să lase loader-ul blocat la infinit
     (acum app.init().catch(console.error) din app.js:299 înghite eroarea în tăcere).

3. Șterge assets/Mapa/HARTA LUMII.zip (46.5 MB). Este arhiva aceleiași imagini
   care e deja servită necomprimată ca HARTA LUMII.png, și nu e referită nicăieri
   în cod. Verifică prin grep înainte de a șterge.

4. Șterge din directoarele de date arhivele nefolosite:
   data/characters/characters.zip, data/locations/locations.zip,
   data/houses/houses.zip, data/essos/far_lands.zip, data/map/regions.zip.
   Verifică prin grep că niciuna nu e referită în cod sau în scripts/.

Criteriu de acceptanță:
   du -sh assets/Mapa → sub 50 MB
   grep -rn "HARTA LUMII.zip" . → 0 rezultate
   Sliderul de timeline permite selectarea anului 302.
```

## P1.7 — Harnașament de verificare
**Unealtă:** Codex · **Depinde de:** P1.1–P1.6 · **Efort:** 2h
**De ce Codex:** e o sarcină de testare pură, cu criteriu obiectiv.

```
Sarcină: construiește un test de fum care poate rula după fiecare fază și care
prinde clasa de bug-uri care a produs King's Landing.

Problema de fond: bug-urile din v1 nu au fost prinse pentru că nimeni nu a executat
codul cu datele reale — s-a verificat că un cod există, nu că rulează.

CERINȚE:
1. Creează tests/smoke.mjs, rulabil cu `node tests/smoke.mjs`, care:
   - încarcă toate JSON-urile din data/ direct de pe disc (nu prin fetch)
   - reproduce mapCompatibility din DataManager
   - pentru FIECARE entitate din locations, characters, houses, events, objects, titles:
     apelează predicatele critice din InfoPanel (isCharacter, isEvent) și din
     WikiPage (render → isCharacter), izolate în funcții pure importabile
   - raportează orice entitate pentru care un predicat aruncă
2. Ca să fie posibil, extrage acele predicate din InfoPanel.js și WikiPage.js într-un
   modul js/utils/entityKind.js, pur, fără DOM. Cele două fișiere îl importă.
3. Adaugă în același test verificări de integritate la runtime:
   - câte locații ajung în getAllLocations() (așteptat, înainte de Faza 2: 391)
   - câte au coordonate în catalog.json (așteptat: 77)
   - câte evenimente rezolvă la o locație reală (așteptat, după P1.3: 875)
   - câte membru_al rezolvă la o casă (așteptat, după P1.4: 631)
   - câte entități are indexul de search, pe tipuri
4. Ieșirea trebuie să fie un tabel + exit code 1 dacă vreun predicat aruncă.

Criteriu de acceptanță:
   node tests/smoke.mjs → exit 0, zero excepții, tabelul afișat.
   Reintroducerea deliberată a bug-ului id_intern → exit 1 cu 3 entități raportate.
```

---

# FAZA 2 — Taxonomia locațiilor

*Aici se decide dacă v2 are sens. 708 din 1099 locații nu ajung nicăieri, dar nu toate merită pin pe hartă.*

## P2.1 — Proiectarea schemei (fără scriere)
**Unealtă:** Claude Code · **Depinde de:** F1 · **Efort:** 2h
**De ce Claude Code:** e singura sarcină din tot ghidul care e pur decizie de modelare.

```
Sarcină: proiectează taxonomia de locații pentru v2. NU MODIFICA NICIUN FIȘIER.
Livrabilul e un document de propunere, plus un eșantion adnotat.

SITUAȚIA:
- 1099 locații încărcate. DataManager.js:94-104 le împarte filtrând strict pe `type`:
  castle+fortress → castles, city+town → cities, landmark+ruins → landmarks.
- Distribuția reală a lui `type`:
      location  708   ← filtrat complet, nu ajunge nicăieri
      castle    185
      landmark  122
      city       30
      town       26
      fortress   16
      ruins      12
- Câmpul `subtip` are 572 de valori distincte, 497 apar exact o dată. Nu e taxonomie,
  e text liber ieșit din extragere. Exemple reale:
      riverrun → "încăpere/balcon în interiorul fortăreței"
      pyke     → "tron/scaun de conducere"
      "castel (pereche de turnuri-gemene, pe ambele maluri ale unui râu)"
      "stradă/alee în cadrul Fortăreței Roșii"
      "bordel", "grajd", "seră", "cripte subterane", "sală de ospețe"

CAPCANA DE EVITAT: a tipa mecanic cele 708 ca `castle`/`landmark` transformă problema
"64% invizibile" în problema "harta e plină de camere, alei și grajduri".

CERINȚE:
1. Propune un model cu trei axe separate:
   - `type`: vocabular ÎNCHIS, ce ESTE lucrul
   - `mappable`: boolean, primește pin propriu pe hartă?
   - `parent_id`: locația care îl conține (Tronul de Fier → pyke; criptele → winterfell)
   Justifică fiecare valoare de `type` propusă. Ținta: sub 15 valori.
2. Decide unde ajunge `subtip`: propunerea mea e `subtip` devine vocabular închis
   derivat, iar textul original se mută în `subtip_descriere`. Contrazice-mă dacă ai
   argument mai bun.
3. Tratează separat categoria APE și REGIUNI: 21 din cele 77 de pinuri actuale sunt
   tipate `landmark` dar sunt de fapt întinderi de apă sau regiuni (blackwater_bay,
   bay_of_crabs, the_bite, sea_of_dorne, kingswood, wolfswood, mountains_of_the_moon,
   skagos, the_wall...). Fiecare primește acum un romb punctiform. O mare nu e un punct.
4. Extrage un eșantion de 60 de locații ACOPERITOR (nu aleatoriu: 20 evident mappable,
   20 evident sub-locații, 20 ambigue) și adnotează-l manual cu type/mappable/parent_id
   propuse. Acesta devine setul de referință pentru P2.2.
5. Estimează, pe baza eșantionului, câte din cele 708 vor deveni mappable.

Livrabil: docs/TAXONOMIE_v2.md + docs/taxonomie_esantion.json
NU modifica data/. NU rula scripturi de migrare.
```

## P2.2 — Clasificatorul, cu dry-run
**Unealtă:** Codex · **Depinde de:** P2.1 · **Efort:** 3h

```
Sarcină: scrie scriptul care clasifică cele 1099 de locații conform schemei din
docs/TAXONOMIE_v2.md.

CERINȚE:
1. scripts/classify_locations.py, cu argparse:
   --dry-run   (IMPLICIT ACTIV; scrierea cere --apply explicit)
   --apply
   --report PATH
   --sample PATH   (rulează doar pe eșantionul de referință și raportează acuratețea)
2. Sursele de semnal, în ordinea priorității:
   - `subtip` (text liber, dar informativ)
   - `name` (conține "Turnul", "Sala", "Strada", "Poarta"...)
   - `descriere_fizica`
   - prezența în catalog.json (dacă are deja pin, e aproape sigur mappable)
   - relații / apartenență
3. Fiecare decizie primește `classification_confidence`: high / medium / low.
   Tot ce iese `low` NU se aplică automat — merge într-un fișier separat
   data/_review/needs_manual_type.json pentru triaj uman (vezi P7.2).
4. Scriptul NU suprascrie `type` existent pentru cele 391 deja tipate corect,
   decât dacă --retype-all e dat explicit.
5. Backup automat cu timestamp înainte de orice scriere.

Criteriu de acceptanță:
   python scripts/classify_locations.py --sample docs/taxonomie_esantion.json
   → acuratețe raportată pe cele 60 adnotate manual. Ținta: ≥ 85% pe cele evidente,
     iar pentru cele ambigue e acceptabil să iasă `low` și să meargă la triaj.
   Rularea fără --apply nu modifică niciun byte din data/ (verifică prin checksum).
```

## P2.3 — Aplicarea și raportul
**Unealtă:** Antigravity · **Depinde de:** P2.2 · **Efort:** 30 min

```
Sarcină: rulează migrarea de tipuri și produ raportul de impact.

1. Commit înainte. Confirmă `git status` curat.
2. Rulează scripts/classify_locations.py --dry-run --report docs/raport_taxonomie.md
   Citește raportul. Dacă mai mult de 15% din locații ies cu confidence=low, OPREȘTE-TE
   și raportează — înseamnă că schema nu e destul de bine definită.
3. Dacă raportul e acceptabil, rulează cu --apply.
4. Actualizează DataManager.loadAll() (js/data/DataManager.js:94-104) ca să folosească
   noile tipuri. getAllLocations() trebuie să întoarcă doar mappable=true.
   Adaugă o metodă separată getAllLocationsIncludingSubLocations() pentru wiki.
5. Rulează node tests/smoke.mjs și lipește ieșirea, înainte și după.

Criteriu de acceptanță:
   numărul de locații din getAllLocations() crește semnificativ față de 391
   numărul de checkbox-uri din filtru NU explodează (vezi P5.1, care depinde de asta)
   smoke test → exit 0
```

## P2.4 — Vocabularul închis de subtipuri
**Unealtă:** Codex · **Depinde de:** P2.3 · **Efort:** 2h

```
Sarcină: normalizează `subtip` de la 572 de valori libere la un vocabular închis.

CONTEXT: FilterPanel.js:41-54 construiește lista de checkbox-uri din
DEFAULT_LOCATION_SUBTYPES ∪ subtipurile din getAllLocations(). Rezultat actual:
128 de checkbox-uri, din care 102 corespund unei singure locații și 96 nu pot afecta
niciun pin vizibil. Sunt inerte.

CERINȚE:
1. scripts/normalize_subtip.py, cu aceleași reguli de dry-run/backup ca P2.2.
2. Mută textul original în `subtip_descriere` (nedistructiv, integral).
3. Mapează la vocabularul închis definit în docs/TAXONOMIE_v2.md.
4. Produce docs/raport_subtip.md cu: valoare veche → valoare nouă, număr de locații,
   plus lista valorilor pe care nu le-a putut mapa.
5. ATENȚIE la o duplicare existentă care va deveni periculoasă:
   getLocationSubtype() și TYPE_TO_SUBTYPE sunt definite IDENTIC de două ori, în
   js/ui/FilterPanel.js:11-22 și js/map/MapRenderer.js:14-25. Filtrul și randarea
   depind de acordul lor exact. Extrage-le într-un singur modul importat de ambele,
   ÎNAINTE de a schimba vocabularul.

Criteriu de acceptanță:
   numărul de valori distincte de subtip pe locații mappable → sub 20
   grep -c "TYPE_TO_SUBTYPE" în js/ → definit o singură dată
```

---

# FAZA 3 — Bilingv RO / EN

*Cerință nouă. Pusă înaintea UI-ului pentru că altfel refaci UI-ul de două ori.*

## P3.1 — Auditul lingvistic și arhitectura i18n
**Unealtă:** Claude Code · **Depinde de:** F2 · **Efort:** 3h
**De ce Claude Code:** e o decizie de arhitectură cu efect asupra fiecărui modul.

```
Sarcină: proiectează suportul bilingv RO/EN. NU MODIFICA NICIUN FIȘIER în această etapă.

SITUAȚIA REALĂ, verificată programatic (nu presupune altceva):
Datele NU sunt bilingve. Sunt amestecate în același câmp.
    locations   1041 | nume cu diacritice românești:  367 (35%)
    characters  2288 | nume cu diacritice românești:  470 (21%)
    events      1682 | nume cu diacritice românești: 1439 (86%)
    houses       229 | nume cu diacritice românești:    1 (0%)
Adică `name` conține uneori "King's Landing", uneori "Debarcaderul Regelui",
fără niciun marcaj de limbă.

Conținutul descriptiv:
    characters cu `description` (engleză):   34 / 2288
    locations cu `descriere_fizica` (română): 488
    distances.json: `distance_value`, `context`, `travel_method` — integral română
    _afirmatii_pe_predicat — integral română
    aliasuri: 308 locations, 260 characters — amestecate

Stringurile de interfață sunt și ele amestecate în cod:
    "Distance Measurements", "Foot Pace", "Click first location..." (engleză)
    "Fără mențiuni de distanță narativă extrasă din text", "Tip locație",
    "Distanțe Narative din Text", "Eșec randare marker pentru" (română)

CONCLUZIA DE PORNIT: un simplu toggle ar afișa aceeași supă în ambele moduri.

CERINȚE:
1. Definește TREI straturi separate, cu strategii diferite:
   L1 — cromul de interfață (butoane, etichete, mesaje): dicționar complet, ambele limbi
   L2 — numele de entități: câmpuri separate name_ro / name_en, cu regulă de fallback
   L3 — conținutul narativ (descrieri, citate, context de sursă): NU se traduce
        automat. Propune o strategie de afișare cu marcaj de limbă
        (ex: badge "RO" pe un fragment netradus, când interfața e pe EN).
2. Propune schema de câmpuri. Recomandarea mea de pornire, contrazice-o dacă ai altceva:
       name_en, name_ro, name        (name = câmp derivat, calculat la încărcare)
       aliases_en[], aliases_ro[]
   `name` NU se șterge — rămâne ca fallback, ca să nu spargi codul existent.
3. Definește regula de fallback, explicit: dacă lipsește name_en, se afișează name_ro
   cu marcaj? Sau se afișează transliterarea? Alege una și justific-o.
4. Propune mecanismul runtime: modul js/i18n/, fișiere i18n/ro.json + i18n/en.json,
   funcție t(key), persistența alegerii (localStorage NU e disponibil în artefacte,
   dar aici e aplicație proprie — e permis), atribut lang pe <html>.
5. Decide ce se întâmplă cu SEARCH: căutarea trebuie să găsească "King's Landing"
   ȘI "Debarcaderul Regelui" indiferent de limba selectată. Asta e cerință fermă —
   nu restrânge indexul la limba curentă.
6. Estimează efortul de traducere pentru fiecare strat, în număr de stringuri.

Livrabil: docs/I18N_ARHITECTURA.md
NU modifica data/. NU scrie cod în această etapă.
```

## P3.2 — Separarea numelor pe limbi
**Unealtă:** Codex · **Depinde de:** P3.1 · **Efort:** 4h

```
Sarcină: sparge câmpul `name` în name_ro / name_en pentru toate categoriile.

CERINȚE:
1. scripts/split_names_by_language.py, cu dry-run implicit, backup, --report.
2. Detecția limbii NU se face doar pe diacritice. Semnale de combinat:
   - diacritice românești (ăâîșț) → RO aproape sigur
   - apostrof + pattern posesiv englez ("King's", "Storm's") → EN
   - articol hotărât enclitic românesc (-ul, -ea, -le la final de cuvânt)
   - prezența în aliasuri a perechii (dacă name e RO și un alias e EN, ai ambele)
   - `id` este în general derivat din forma engleză — folosește-l ca semnal
3. Pentru fiecare entitate, produ patru rezultate posibile:
   a) ambele nume găsite (name + un alias în cealaltă limbă) → completează ambele
   b) doar RO → name_ro completat, name_en null
   c) doar EN → name_en completat, name_ro null
   d) nedecis → raportează în data/_review/needs_language_review.json
4. NU traduce nimic automat. Scriptul doar CLASIFICĂ și REDISTRIBUIE ce există deja.
5. Păstrează `name` intact ca fallback.
6. Raport obligatoriu: câte entități au ambele nume, câte doar unul, per categorie.

Criteriu de acceptanță:
   Raportul arată, per categorie, acoperirea name_en și name_ro.
   Zero entități cu name_en == name_ro (ar însemna clasificare greșită).
   Un eșantion manual de 40 de entități verificat de tine → sub 5% erori.

NU inventa traduceri. Numele lipsă rămân null și se completează în P3.5.
```

## P3.3 — Extragerea stringurilor de interfață
**Unealtă:** Antigravity · **Depinde de:** P3.1 · **Efort:** 3h
**De ce Antigravity:** e exact profilul — mult text, zero judecată, consum mare de tokeni pe muncă ieftină.

```
Sarcină: extrage TOATE stringurile vizibile de interfață din cod în fișiere de traducere.

CERINȚE:
1. Parcurge js/ui/, js/map/, js/app.js, admin/, index.html.
2. Pentru fiecare string vizibil utilizatorului (NU mesaje de consolă, NU nume de clase
   CSS, NU chei de date), creează o cheie ierarhică:
       distance.title          "Distance Measurements"
       distance.selectFirst    "Click first location..."
       distance.footPace       "Foot Pace"
       filter.title            "Map Filters"
       filter.locationType     "Tip locație"
       wiki.close              "× Close wiki"
       ...
3. Produce i18n/en.json și i18n/ro.json cu ACELEAȘI chei.
   - Pentru stringurile deja în engleză: en.json primește originalul, ro.json primește
     valoarea "TODO:" + originalul
   - Pentru cele deja în română: invers
   NU traduce în această sarcină. Doar extrage și marchează.
4. Înlocuiește în cod fiecare string cu apelul t('cheie').
   Funcția t() se implementează în P3.4 — pentru moment creează un stub în
   js/i18n/index.js care întoarce cheia dacă dicționarul lipsește.
5. Produce docs/raport_i18n_extractie.md: număr de chei, câte sunt TODO per limbă,
   lista fișierelor atinse.

ATENȚIE la stringurile din template literals cu interpolare — păstrează parametrii:
       `From ${location.name}. Click destination...`
   devine
       t('distance.fromClickDest', { name: location.name })

Criteriu de acceptanță:
   grep -rnE "innerHTML\s*=\s*[\`'\"][A-ZĂÎ]" js/ui/ → 0 rezultate (toate trec prin t())
   numărul de chei din en.json == numărul de chei din ro.json
   aplicația pornește și afișează chei brute (nu crapă)

NU traduce. NU modifica logica. Doar extragere mecanică.
```

## P3.4 — Runtime-ul i18n și comutatorul
**Unealtă:** Claude Code · **Depinde de:** P3.2, P3.3 · **Efort:** 3h

```
Sarcină: implementează stratul i18n funcțional, conform docs/I18N_ARHITECTURA.md.

CERINȚE:
1. js/i18n/index.js:
   - încarcă dicționarul limbii curente
   - t(key, params) cu interpolare
   - fallback: cheie lipsă în limba curentă → cealaltă limbă → cheia brută, cu
     console.warn o singură dată per cheie
   - setLanguage(lang) care re-randează UI-ul fără reload
2. Rezolvarea numelor de entități:
   - funcție displayName(entity, lang) care aplică regula de fallback din P3.1
   - folosită PESTE TOT unde acum se citește entity.name: SearchEngine.js:19,
     MapRenderer.js:614 (etichete), InfoPanel, WikiPage, DistanceTool, tooltip din app.js:208
3. Comutatorul în Toolbar: RO | EN, cu persistență.
   Setează și atributul lang pe <html> (contează pentru despărțirea în silabe și
   pentru cititoarele de ecran).
4. Search-ul rămâne BILINGV indiferent de limba interfeței: SearchEngine.extractSearchTerms
   trebuie să indexeze name_ro, name_en, aliases_ro, aliases_en, id, id_intern —
   toate, mereu. Doar AFIȘAREA rezultatului se schimbă cu limba.
5. Marcajul de conținut netradus (stratul L3): când interfața e pe EN și fragmentul e
   românesc, afișează un indicator discret. Nu ascunde conținutul.

Criteriu de acceptanță:
   - comutarea RO→EN schimbă toate etichetele fără reload
   - căutarea "Debarcaderul Regelui" funcționează cu interfața pe EN
   - căutarea "King's Landing" funcționează cu interfața pe RO
   - alegerea persistă după refresh
   - node tests/smoke.mjs → exit 0
```

## P3.5 — Completarea traducerilor
**Unealtă:** Antigravity · **Depinde de:** P3.4 · **Efort:** 4h

```
Sarcină: completează toate valorile marcate "TODO:" din i18n/ro.json și i18n/en.json.

CERINȚE:
1. Traduce stringurile de interfață. Registru: sobru, cartografic, nu colocvial.
   Termeni de referință pentru consistență (folosește traducerile oficiale românești
   ale cărților acolo unde există):
       Map Filters      → Filtre hartă
       Foot Pace        → Pe jos
       Horse            → Călare
       Galley           → Pe mare
       Dragon           → Pe dragon
       Sources          → Surse
       Chronology       → Cronologie
2. Produce docs/GLOSAR.md cu perechile de termeni consacrați, ca referință pentru
   traducerile viitoare. Include termenii de univers unde traducerea românească
   diferă semnificativ (Debarcaderul Regelui, Iernind / Winterfell, Zidul, Rondul de
   Noapte).
3. Pentru numele de entități rămase cu name_en sau name_ro null după P3.2:
   NU le completa în această sarcină. Ele merg la triaj manual (P7.2), pentru că
   traducerea numelor proprii de univers cere decizie editorială, nu automatizare.

Criteriu de acceptanță:
   grep -c "TODO:" i18n/*.json → 0
   Comutarea RO↔EN nu afișează nicio cheie brută în interfață.
```

---

# FAZA 4 — Harta credibilă

## P4.1 — Iconografia: scoaterea siluetelor din codul mort
**Unealtă:** Claude Code · **Depinde de:** F2 · **Efort:** 4h

```
Sarcină: repară motivul real pentru care "castelele nu arată a castele".

DIAGNOSTIC, verificat în cod (contrazice parțial auditurile anterioare):
1. MapRenderer.js are siluete SVG scrise manual pentru winterfell, casterly_rock,
   castle_black, dragonstone, hightower/oldtown_city, kings_landing, storm_end,
   the_eyrie, riverrun, pyke, harrenhal (liniile 437-567).
   TOATE sunt în ramura `else` a lui `if (rulingHouse?.crest)` de la linia 415.
   Când locația ARE casă cu emblemă — adică exact locațiile majore — silueta custom
   NU se desenează niciodată. Ai munca făcută, într-o ramură inaccesibilă.
2. Ramura fără emblemă (liniile 589-598) desenează un cerc de rază 3–3.5.
   Cercul e ce "nu pare castel", nu glifa de tip.
3. appendLocationTypeGlyph() (liniile 29-40) există și e apelată pe ambele ramuri,
   dar produce o glifă de ~10 unități, prea mică pentru a citi tipul.
4. La anul de boot (1 AC), din 77 de pinuri doar ~24 rezolvă la o casă cu emblemă.
   103 din 229 de case nu au deloc câmp `crest`. Toate cele 126 de fișiere de emblemă
   referite EXISTĂ în assets/sigils/ — nu e problemă de assets.
5. MapRenderer.js:480 are ramura `locId === 'hightower' || locId === 'oldtown_city'`.
   `hightower` NU există în date. Ramură moartă dintr-o redenumire.

CERINȚE:
1. Inversează ierarhia vizuală: SILUETA DE TIP este baza, întotdeauna desenată.
   Emblema casei, când există, se suprapune ca badge mic, NU înlocuiește silueta.
2. Silueta se alege după `type` din taxonomia F2, nu după id și nu după prezența
   emblemei. Fiecare tip mappable primește o formă distinctă și lizibilă la zoom normal.
3. Siluetele custom per-locație (Winterfell, Harrenhal etc.) devin un strat OPȚIONAL
   deasupra siluetei de tip, pentru locațiile emblematice — nu o ramură exclusivă.
4. APE și REGIUNI (categoria din P2.1) NU primesc pin punctiform. Primesc etichetă
   pe suprafață. Vezi P4.3.
5. Șterge ramura moartă `hightower`.
6. Verifică lizibilitatea la trei niveluri de zoom și raportează cu descriere, nu doar
   cu afirmația că arată bine.

Criteriu de acceptanță:
   Un castel fără casă cunoscută și un castel cu emblemă Lannister sunt AMÂNDOUĂ
   recognoscibile ca fiind castele, la același zoom.
   grep -n "hightower" js/map/MapRenderer.js → 0
```

## P4.2 — Etichetele de mări și regiuni
**Unealtă:** Antigravity · **Depinde de:** P4.1 · **Efort:** 2h

```
Sarcină: adaugă numele de mări pe hartă.

VESTE BUNĂ: mecanismul e deja construit complet și nefolosit.
MapRenderer.js:886-908 renderGeographicFeatures() citește data/map/world_features.json
și randează etichete cu poziție, rotație (transform: rotate(...), linia 901), clasă
map-label-sea (linia 895) și prag de zoom (data-min-zoom, linia 897).
updateLabelVisibility() are deja tier-ul 'sea' cu prioritate 2 (liniile 681, 724, 739).

CE LIPSEȘTE: DATE. world_features.json are 10 intrări, TOATE type:"region", ZERO mări.

CERINȚE:
1. Adaugă în world_features.json intrări type:"sea" pentru, cel puțin:
   Narrow Sea, Sunset Sea, Summer Sea, Shivering Sea, Bay of Crabs, Blackwater Bay,
   Bay of Ice, Ironman's Bay, The Bite, Sea of Dorne, Shipbreaker Bay, Stepstones.
2. Fiecare intrare are: id, name_en, name_ro, type, x, y, rotation, minZoom.
   (Câmpurile de limbă conform schemei din P3.1 — coordonează-te cu ea.)
3. Coordonatele se iau vizual din admin/map-editor.html, în spațiul 1500×1000.
   Dacă editorul nu permite plasarea de etichete non-locație, RAPORTEAZĂ și oprește-te
   — asta devine o sarcină de admin (P7.2), nu ghici coordonatele.
4. Stilul: literă spațiată, italic, opacitate redusă, urmând axa lungă a apei —
   convenție cartografică clasică. CSS-ul map-label-sea există; ajustează-l dacă e nevoie.

Criteriu de acceptanță:
   Cele 12 mări apar pe hartă, lizibile, fără să se suprapună peste pinuri de locații.
   Etichetele apar/dispar corect la zoom.

NU rescrie renderGeographicFeatures(). Adaugă date, ajustează CSS.
```

## P4.3 — Algoritmul de anti-coliziune al etichetelor
**Unealtă:** Codex · **Depinde de:** P4.1 · **Efort:** 3h

```
Sarcină: repară căderea etichetelor de la locațiile importante.

PROBLEMA: MapRenderer.js:656-780, updateLabelVisibility().
Lățimea casetei se estimează la linia ~726 ca nrCaractere × 12 × 0.55.
Pentru "King's Landing (Aegonfort)" (26 caractere) rezultă ~172 unități de hartă,
o casetă de la x≈218 la x≈390, care se suprapune cu Tumbleton, Kingswood,
Blackwater Bay și The God's Eye. Eticheta cade.
Din 77 de locații cu pin, exact 2 au paranteză în nume: kings_landing și oldtown.
Amândouă au eticheta ștearsă.

La egalitate de prioritate, sortarea de la linia ~755 e pe un singur criteriu, deci
ordinea între tier-1 e ordinea din array — nedeterministă din perspectiva produsului.

CERINȚE:
1. Estimarea de lățime să folosească măsurare reală (getComputedTextLength() sau
   getBBox()), nu o formulă pe număr de caractere. Măsoară o dată și memorează.
2. Numele de afișare pe hartă NU trebuie să fie numele complet cu paranteze.
   Introdu un câmp `map_label` derivat: partea dinaintea primei paranteze.
   "King's Landing (Aegonfort)" → "King's Landing"
   Numele complet rămâne în search și în panou.
   ATENȚIE: 76 din 1099 de locații au paranteze în nume.
3. Sortarea de prioritate să fie deterministă și pe criterii multiple:
   tier, apoi importanță (CAPITAL_LOCATIONS), apoi lungime de etichetă, apoi id
   (ca departajare stabilă).
4. Adaugă strategie de plasare alternativă înainte de a renunța la o etichetă:
   încearcă cele 4 poziții (sus/jos/stânga/dreapta față de pin) și abia apoi ascunde.
5. Etichetele tier-1 (capitale) nu se ascund niciodată. Se micșorează sau se deplasează.

Criteriu de acceptanță:
   La zoom implicit, toate cele 14 locații din CAPITAL_LOCATIONS au etichetă vizibilă.
   Zero suprapuneri de casete detectate programatic (scrie verificarea în test).
   Rezultatul e identic la două randări succesive (determinism).
```

## P4.4 — Duplicatul Oldtown și sediile lipsă
**Unealtă:** Claude Code · **Depinde de:** F2 · **Efort:** 2h

```
Sarcină: două probleme de integritate a hărții.

PROBLEMA 1 — Oldtown e de două ori pe hartă:
    oldtown       type=castle  name="Hightower (Oldtown)"   are pin
    oldtown_city  type=city    (oraș / instituție maesteri)  are pin
Un audit anterior le declara rezolvate. Nu sunt. Sunt două markere pentru același loc.
DECIZIE NECESARĂ (nu o lua singur — propune-mi variantele):
   a) fuziune completă într-o singură entitate
   b) păstrare ca oraș + landmark distinct (Turnul Înalt e o clădire reală distinctă
      de oraș, deci varianta asta e defensabilă), cu parent_id din taxonomia F2
Recomandă una, cu argumente, și implement-o abia după confirmare.

PROBLEMA 2 — sedii regionale fără pin:
    highgarden   în date, tip randabil, FĂRĂ pin în catalog.json
    storm_end    în date, tip randabil, FĂRĂ pin
    castle_black în date, tip randabil, FĂRĂ pin (are și siluetă custom la
                 MapRenderer.js:462-474 care nu se randează niciodată)
Două din cele șapte regate n-au capitală vizibilă pe hartă.

CERINȚE:
1. Verifică în admin/map-editor.js că plasarea de pinuri noi funcționează și
   salvează corect în catalog.json.
2. Raportează dacă mai există alte locații din CAPITAL_LOCATIONS (MapRenderer.js:6-10)
   sau din seats (TimelineEngine.js:157-167) fără pin.
3. Plasarea efectivă a celor trei pinuri o fac eu manual în editor — tu pregătește
   editorul și verifică fluxul de salvare.
4. server.py:58-71 rescrie toate cele 3 fișiere de locații la FIECARE salvare de pin,
   inclusiv locations.json de 7.5 MB, chiar dacă nu s-a schimbat nimic în ele.
   Scrie doar fișierele efectiv modificate.

Criteriu de acceptanță:
   O mutare de pin în editor rescrie doar catalog.json, nu 7.6 MB.
   Lista locațiilor-ancoră fără pin, raportată complet.
```

---

# FAZA 5 — UX-ul reclamat

## P5.1 — Filtrele grupate
**Unealtă:** Claude Code · **Depinde de:** P2.4 · **Efort:** 3h

```
Sarcină: restructurează panoul de filtre.

STARE ACTUALĂ: FilterPanel.js:103-122 randează o listă PLATĂ, sortată alfabetic,
fără grupare, fără select-all: 128 de checkbox-uri, din care 102 corespund unei
singure locații și 96 nu pot afecta niciun pin vizibil.
LAYER_REGISTRY (js/map/MapLayers.js) are doar 2 straturi: locations, labels.
Categoriile pe care le vrei (Ape, Case, Geografie) nu există ca straturi.

PRECONDIȚIE: P2.4 trebuie terminat. Nu se poate grupa peste 572 de valori libere.

CERINȚE:
1. Ierarhie pe două niveluri, colapsabilă:
       Locații   → Castele · Orașe · Sate · Fortărețe · Ruine
       Geografie → Ape · Păduri · Munți · Insule · Regiuni
       Case      → grupate pe regiune
       Istorie   → Bătălii · Evenimente (dacă devin randabile)
2. Fiecare categorie are select-all / select-none și afișează numărul de pinuri
   AFECTATE, nu numărul de entități din date. Un checkbox care nu poate schimba
   nimic vizibil NU se afișează.
3. Categoriile sunt colapsate implicit, cu excepția "Locații".
4. Extinde LAYER_REGISTRY cu straturile noi în loc să hardcodezi categoriile în UI.
5. Toate etichetele trec prin t() (F3).

Criteriu de acceptanță:
   Numărul de controale vizibile la deschidere → sub 12.
   Fiecare checkbox afișat schimbă vizibil ceva pe hartă când e debifat.
```

## P5.2 — Timeline colapsabil
**Unealtă:** Antigravity · **Depinde de:** P1.6 · **Efort:** 2h

```
Sarcină: bara de timeline ocupă spațiu fix jos și acoperă permanent din hartă.

CERINȚE:
1. Stare implicită: bară subțire (~28px) cu anul curent și un buton de expandare.
2. La expandare: sliderul complet + minimap + play/pause, ca overlay peste hartă,
   NU ca spațiu rezervat care micșorează harta.
3. Starea (colapsat/expandat) persistă.
4. Toate etichetele prin t().
5. NU schimba logica de calcul a anilor — a fost reparată în P1.6.

Criteriu de acceptanță:
   În stare colapsată, înălțimea utilă a hărții crește cu cel puțin 100px.
   Sliderul rămâne funcțional în ambele stări.
```

## P5.3 — Reîmpachetarea surselor
**Unealtă:** Claude Code · **Depinde de:** F3 · **Efort:** 3h

```
Sarcină: sursele bibliografice sunt ilizibile și sufocă panoul.

CAUZA STILISTICĂ: css/panels.css:127
    .wiki-source { margin-top:.3rem; color: var(--ink-light); font-size:.78rem; font-style: italic; }

DAR CAUZA DE FOND E ALTA, și e important să o știi înainte să redesenezi:
doar 34 din 2288 de personaje au câmp `description`. În lipsa unui text descriptiv,
panoul e populat aproape exclusiv din _afirmatii_pe_predicat + surse. Raportul
semnal/zgomot e structural prost, nu doar prost stilizat. Se vede în captura cu
Rhaenyra: blocul de fapte e urmat imediat de un paragraf de proveniență
("din Fragment 4.3; vie la finalul fragmentului (din Fragment 4.2); 97 D.C ...").

CERINȚE:
1. Sursele nu se șterg — sunt dovada de canonicitate și au valoare reală.
   Se colapsează: un indicator discret (📖 sau numărul de surse) lângă fiecare
   afirmație, care extinde detaliile la click.
2. Gruparea pe carte, nu pe afirmație:
       Foc și Sânge — p. 120, 145, 200
   în loc de trei rânduri separate.
3. BUG SEPARAT de reparat aici: eticheta DEATH se suprapune peste valoare
   ("DEATHdouă zi a celei de-a zecea luni..."). Coloana de etichetă din grid/flex
   n-are min-width. Vizibil în captura cu Maester Aemon și în cea cu Rhaenyra.
4. Când o afirmație are variante contradictorii din surse diferite (câmpul `moarte`
   are frecvent mai multe), afișează-le explicit ca "variante din surse diferite",
   nu concatenate într-un singur paragraf.

Criteriu de acceptanță:
   Panoul pentru Rhaenyra Targaryen încape pe un ecran fără scroll pentru faptele
   de bază, cu sursele accesibile la un click.
   Nicio suprapunere de etichetă peste valoare, la trei lățimi de fereastră diferite.
```

## P5.4 — Panoul compact vs. pagina completă
**Unealtă:** Claude Code · **Depinde de:** P5.3 · **Efort:** 4h

```
Sarcină: separă clar panoul de primă interacțiune de pagina enciclopedică.

CERINȚE:
1. Panoul din dreapta (InfoPanel), la prima selecție, afișează DOAR:
   - nume (în limba curentă) + emblemă/siluetă
   - tip și regiune
   - 3-4 fapte-cheie, alese pe categorie de entitate
   - buton mare "Vezi pagina completă"
   Nimic altceva. Fără liste de titluri de 15 rânduri, fără paragrafe de proveniență.
2. Pagina completă (WikiPage) primește ancore de navigare sus.
   AVERTISMENT DE DATE: 1530 din 2227 de personaje cu scor de completitudine au
   scor_total sub 0.3 (69%), și doar 40 au scor ≥ 0.8. Ancorele NU trebuie să
   afișeze secțiuni goale. Ascunde ancora dacă secțiunea n-are conținut și afișează
   un indicator onest de completitudine în header.
3. InfoPanel.js are 1146 de linii și amestecă randarea pentru locații, case,
   personaje, evenimente. Sparge-l pe fișiere per tip de entitate, cu un dispecer
   comun. Fără asta, orice modificare viitoare atinge tot fișierul.

Criteriu de acceptanță:
   Panoul de primă interacțiune încape fără scroll pentru orice entitate.
   Un personaj cu scor 0.1 nu afișează 6 secțiuni goale.
   InfoPanel.js sub 300 de linii; restul în module dedicate.
```

---

# FAZA 6 — Separarea `/harta` și `/wiki`

## P6.1 — Routerul
**Unealtă:** Claude Code · **Depinde de:** F5 · **Efort:** 5h

```
Sarcină: introdu rutare reală. În prezent NU EXISTĂ NICIUNA.

STARE ACTUALĂ, verificată: WikiPage este un simplu overlay.
WikiPage.js:26 open(entity), :35 close(). Fără location.hash, fără history.pushState,
fără popstate. index.html e singurul document.
Consecințe: nicio adresă partajabilă, butonul Back al browserului nu funcționează,
niciun deep-link din search, nicio posibilitate de a lega un eveniment la o pagină.

Asta înseamnă că "trimite spre /wiki#event-id" din auditurile anterioare NU e o
rearanjare, e infrastructură nouă. Estimeaz-o ca atare.
În schimb, CONȚINUTUL paginii de wiki există deja și e funcțional — nu îl rescrie.

CERINȚE:
1. Router bazat pe History API, cu fallback pe hash. Schema de rute:
       /                      → hartă
       /harta                 → hartă
       /harta/:locationId     → hartă cu locația selectată și zoom aplicat
       /wiki                  → index enciclopedic cu search propriu
       /wiki/:type/:id        → pagina completă
       /admin                 → editor
   Cu prefix de limbă sau parametru, conform deciziei din P3.1.
2. server.py trebuie să servească index.html pentru orice rută necunoscută
   (fallback SPA), fără să strice servirea fișierelor statice și a /api/.
3. Starea hărții (zoom, an selectat, filtre active) se reflectă în query string,
   ca să fie partajabilă.
4. Butonul Back trebuie să funcționeze corect între hartă și wiki.

Criteriu de acceptanță:
   Copierea adresei din browser și deschiderea într-o filă nouă reproduce exact
   aceeași stare.
   Back/Forward funcționează pe minim 5 navigări succesive.
```

## P6.2 — Separarea celor două search-uri
**Unealtă:** Claude Code · **Depinde de:** P6.1 · **Efort:** 3h

```
Sarcină: search-ul de pe hartă și cel din wiki au scopuri diferite.

CERINȚE:
1. Search-ul de pe /harta întoarce DOAR entități cu poziție pe hartă
   (mappable=true din taxonomia F2). Click = zoom. Previzibil, fără surprize.
2. Dacă rezultatul cerut nu e mappable (un eveniment, un personaj, un obiect),
   search-ul de pe hartă îl afișează într-o secțiune separată, marcată clar
   ("în enciclopedie"), iar click-ul navighează la /wiki/:type/:id.
   NU încerca să-l arate pe hartă.
3. Search-ul din /wiki acoperă tot, cu filtrare pe tip de entitate.
4. AMBELE rămân bilingve (P3.4): indexul conține toate variantele de nume
   indiferent de limba interfeței.
5. Problemă de acoperire de reținut: `aliasuri` are acoperire 28% la locations,
   11% la characters, 0% la events. E cauza de fond a senzației că "search-ul nu
   găsește". Nu o poți repara aici, dar nu construi presupunând că aliasurile există.

Criteriu de acceptanță:
   Căutarea unui personaj din /harta nu mai provoacă niciun zoom.
   Căutarea unui eveniment din /harta duce la pagina lui de wiki.
```

---

# FAZA 7 — Funcționalități noi

## P7.1 — Motorul de distanțe
**Unealtă:** Claude Code · **Depinde de:** F6 · **Efort:** 5h

```
Sarcină: reproiectează instrumentul de distanță.

STARE ACTUALĂ, verificată:
1. milesPerUnit este null în catalog.json → DistanceTool.js:146-157 afișează mereu
   "Map scale calibration pending". Rezultatul principal e permanent gol.
2. Selecția se face EXCLUSIV prin click pe marker (app.js:183-184 → handleLocationClick).
   Există 77 de markere. Deci poți compara 77 din 1099 de locații.
3. Datele narative sunt mai slabe decât par. Din cele 467 de afirmații din
   distances.json:
       - doar 20 conțin vreo cifră
       - 128 de capete de pereche nu rezolvă la un id din locations.json
       - 73 de perechi distincte au ambele capete printre cele 77 cu pin
   Perechea Harrenhal ↔ King's Landing are 4 intrări CARE SE CONTRAZIC:
       "sute de leghe depărtare"
       "mii de kilometri depărtare"
       "de la Harrenhal, pe drumul regelui, se ajunge repede și direct"

CERINȚE:
1. Selecția prin două câmpuri de căutare (A și B) peste TOATE locațiile, nu prin
   click pe pin. Click-ul pe pin rămâne ca scurtătură, nu ca singură cale.
2. Ierarhia rezultatului:
   a) valoare canonică (câmp NOU, `distanta_canonica_leghe`, completat manual de mine
      pentru perechile importante) — rezultatul principal
   b) afirmațiile narative din carte, ca dovadă, cu sursă și pagină
   c) distanța geometrică, DOAR dacă milesPerUnit devine ne-null, marcată explicit
      ca aproximare
3. Când există afirmații contradictorii, afișează-le ca atare, cu avertisment.
   NU alege una și NU face medie. Contradicția e informație.
4. Timpii de călătorie (călare / pe jos / pe mare / pe dragon) se calculează DOAR
   din valoarea canonică, niciodată din text liber.
5. Propune-mi lista celor ~40 de perechi care merită completate manual cu valoare
   canonică, ordonate după frecvența apariției în distances.json.

Criteriu de acceptanță:
   Selectarea Harrenhal + King's Landing afișează cele 4 afirmații, marcate ca
   fiind în conflict, plus valoarea canonică dacă am completat-o.
   Pot selecta două locații care nu au pin pe hartă.
```

## P7.2 — Coșul de triaj din admin
**Unealtă:** Codex · **Depinde de:** F2, F3 · **Efort:** 4h

```
Sarcină: construiește interfața de triaj pentru tot ce e incert.

CONTEXT: mai multe faze produc cozi de lucruri nedecise:
    data/_review/needs_manual_type.json      (din P2.2)
    data/_review/needs_language_review.json  (din P3.2)
    data/_import/etl_output/id_uri_compuse_needecise.json      (2 octeți — gol)
    data/_import/etl_output/id_map_orfani_needecise.json       (1280 octeți)
    NEEDS_REVIEW.md                          (deja în proiect)
Plus locațiile cu nume care sunt de fapt liste sau note de OCR: un `name` de 332 de
caractere enumerând 17 locuri, un `name` care e o listă de 6 hanuri, intrări de forma
"Fingers (Degetele) [posibil corupt OCR: ...]".

CERINȚE:
1. admin/triage.html, pagină nouă, servită de același server.
2. Încarcă toate cozile de mai sus într-o listă unificată, cu filtrare pe sursă și
   pe tip de problemă.
3. Pentru fiecare element: afișează contextul complet (entitatea brută, JSON) și
   oferă acțiuni:
       - atribuie type / mappable / parent_id
       - completează name_ro / name_en
       - marchează ca duplicat al lui X
       - sparge în N entități (pentru numele care sunt liste)
       - respinge / arhivează
4. Fiecare acțiune scrie printr-un endpoint nou din server.py, cu backup automat
   și jurnal de modificări (cine, când, ce, valoarea veche).
5. Navigare la tastatură. Vei procesa sute de elemente — mouse-ul nu e suficient.
6. Contor de progres vizibil.

Criteriu de acceptanță:
   Pot procesa 20 de elemente consecutive fără să ating mouse-ul.
   Fiecare modificare are intrare în jurnal și se poate anula.
   server.py rămâne legat la 127.0.0.1 (P0.2).
```

## P7.3 — Filtrul de epocă
**Unealtă:** Antigravity · **Depinde de:** P5.1 · **Efort:** 2h

```
Sarcină: adaugă filtrarea pe epocă istorică.

AVERTISMENT DE FEZABILITATE, verificat: auditurile anterioare susțin că e ușor
pentru că "se leagă de timeline-urile existente pe fiecare locație". FALS.
Doar 74 din 1099 de locații au timeline sau ownership_history. Un filtru de epocă
aplicat pe locații ar ascunde 93% din ele.

FEZABIL este pe EVENIMENTE: 1561 de evenimente au an numeric, interval -114 … 302.

CERINȚE:
1. Definește epocile ca intervale, într-un fișier de date, nu hardcodat:
       Era Eroilor, Cucerirea (1-37 AC), Epoca Targaryen, Dansul Dragonilor (129-131),
       Robert's Rebellion, prezentul narativ...
   Cu name_ro / name_en conform F3.
2. Selectarea unei epoci mută sliderul de timeline la intervalul respectiv și
   filtrează evenimentele afișate.
3. Locațiile NU se ascund pe baza epocii. Dacă o locație are timeline, i se
   actualizează casa conducătoare — comportamentul existent. Dacă nu are, rămâne
   afișată neutru.
4. Marchează în UI că filtrul se aplică evenimentelor, nu geografiei.

Criteriu de acceptanță:
   Selectarea "Dansul Dragonilor" afișează doar evenimentele din 129-131.
   Numărul de pinuri de pe hartă nu scade.
```

## P7.4 — Dragoni și bătălii
**Unealtă:** Antigravity · **Depinde de:** P4.1 · **Efort:** 3h

```
Sarcină: extinde stratul de dragoni și adaugă markere de bătălii.

AVERTISMENT: data/dragons/dragons.json are 2712 octeți și 3 intrări. Auditurile
anterioare îl descriu ca "structură separată deja existentă". Este un stub.
Pornești aproape de la zero pe partea de date.

CERINȚE:
1. Definește schema completă pentru un dragon: id, name_ro, name_en, călăreți cu
   interval de ani, naștere, moarte, locație de moarte, evenimente, surse.
   Aliniat cu convențiile din F3 și cu structura de surse din restul proiectului.
2. Extrage din datele existente (events.json, characters.json) tot ce se poate
   despre Vhagar, Caraxes, Meraxes, Balerion, Syrax etc. RAPORTEAZĂ ce ai găsit
   înainte de a scrie — nu inventa date de canon.
3. Markere de bătălii: identifică în events.json evenimentele de tip bătălie cu
   locație rezolvabilă (după P1.3) și randează-le ca strat separat, comutabil,
   legat de filtrul de epocă din P7.3.
4. NU inventa niciun fapt care nu e în datele tale. Câmpurile fără sursă rămân null.

Criteriu de acceptanță:
   Stratul de dragoni și cel de bătălii se pot comuta independent.
   Fiecare câmp completat are o sursă în date sau e marcat ca inferred.
```

---

## Anexă A — Ordinea de rulare condensată

| # | Prompt | Unealtă | Depinde de |
|---|---|---|---|
| 1 | P0.1 Igiena git | Antigravity | — |
| 2 | P0.2 Server loopback | Antigravity | P0.1 |
| 3 | P0.3 Carantina scripturilor | Antigravity | P0.1 |
| 4 | P1.1 Bug King's Landing | **Claude Code** | F0 |
| 5 | P1.2 getLocation + coordonate | **Claude Code** | P1.1 |
| 6 | P1.3 location \|\| locatie_id | Antigravity | P1.2 |
| 7 | P1.4 Prefix HOUSE_ | Antigravity | P1.2 |
| 8 | P1.5 Objects/titles/events | Codex | P1.2 |
| 9 | P1.6 Timeline + Promise.all | Antigravity | F0 |
| 10 | P1.7 Smoke test | Codex | P1.1–P1.6 |
| 11 | P2.1 Schema taxonomiei | **Claude Code** | F1 |
| 12 | P2.2 Clasificator | Codex | P2.1 |
| 13 | P2.3 Aplicare | Antigravity | P2.2 |
| 14 | P2.4 Vocabular subtip | Codex | P2.3 |
| 15 | P3.1 Arhitectura i18n | **Claude Code** | F2 |
| 16 | P3.2 Split nume | Codex | P3.1 |
| 17 | P3.3 Extragere stringuri | Antigravity | P3.1 |
| 18 | P3.4 Runtime i18n | **Claude Code** | P3.2, P3.3 |
| 19 | P3.5 Traduceri | Antigravity | P3.4 |
| 20 | P4.1 Iconografie | **Claude Code** | F2 |
| 21 | P4.2 Etichete mări | Antigravity | P4.1 |
| 22 | P4.3 Anti-coliziune | Codex | P4.1 |
| 23 | P4.4 Oldtown + sedii | **Claude Code** | F2 |
| 24 | P5.1 Filtre grupate | **Claude Code** | P2.4 |
| 25 | P5.2 Timeline colapsabil | Antigravity | P1.6 |
| 26 | P5.3 Surse | **Claude Code** | F3 |
| 27 | P5.4 Panou + wiki | **Claude Code** | P5.3 |
| 28 | P6.1 Router | **Claude Code** | F5 |
| 29 | P6.2 Search separat | **Claude Code** | P6.1 |
| 30 | P7.1 Distanțe | **Claude Code** | F6 |
| 31 | P7.2 Triaj admin | Codex | F2, F3 |
| 32 | P7.3 Epocă | Antigravity | P5.1 |
| 33 | P7.4 Dragoni | Antigravity | P4.1 |

**Distribuție:** Claude Code 13 · Antigravity 13 · Codex 7.

---

## Anexă B — Ce NU trebuie să facă niciun agent

Lipește asta când ai impresia că un agent o ia razna:

```
INTERDICȚII PERMANENTE PE ACEST PROIECT:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită. Multe sunt
   operații unice deja aplicate; rerularea corupe datele.
2. Nu inventa fapte de canon ASOIAF. Dacă un câmp n-are sursă în datele proiectului,
   rămâne null. Datele au proveniență la nivel de pagină — nu o dilua.
3. Nu traduce automat nume proprii de univers. Merg la triaj manual.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi și marchează-le pe cele vechi ca
   deprecate.
5. Nu "repara" o problemă schimbând datele când cauza e în cod, și invers.
6. Nu raporta o sarcină ca terminată fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii e falsă, oprește-te și raportează. Nu improviza.
```

---

## Anexă C — Cifrele de referință

De verificat după fiecare fază, ca să vezi dacă te miști în direcția bună:

| Metrică | v1 (acum) | Țintă v2 |
|---|---|---|
| Locații încărcate | 1099 | 1099 |
| Locații în `getAllLocations()` | 391 | de stabilit în P2.1 |
| Locații cu pin pe hartă | 77 | ≥ 150 |
| Checkbox-uri în filtru | 128 | < 12 controale vizibile |
| Evenimente accesibile prin timeline | 1004 / 1561 | 1561 |
| Evenimente cu locație rezolvată | 586 / 875 | 875 |
| Personaje cu casă rezolvată | 0 / 631 | 631 |
| Obiecte + titluri în search | 0 / 370 | 370 |
| Entități care crapă la click | 3 | 0 |
| Încărcare inițială | ~76 MB secvențial | < 40 MB paralel |
| Limbi de interfață | 0 (amestec) | 2 complete |

---

*Ghid generat pe baza inspecției directe a codului și a parsării programatice a tuturor JSON-urilor din `admin.zip`. Toate cifrele citate au fost verificate; cele care contrazic auditurile anterioare sunt marcate explicit în prompturi.*
