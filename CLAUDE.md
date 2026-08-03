# Atlas of Westeros — reguli de proiect

> Acest fișier este citit automat la începutul fiecărei sesiuni.
> Copie identică salvată ca `AGENTS.md` pentru uneltele care folosesc acel nume.
> Ghidul complet de implementare, cu toate sarcinile: `docs/GHID_Implementare_Atlas_v2.md`

---

## 1. Ce este proiectul

Aplicație web cu hartă SVG interactivă + wiki pentru universul ASOIAF (Game of Thrones).
Datele provin din extragere manuală și semi-automată din traducerile românești ale
cărților, cu proveniență la nivel de pagină. Baza de date este partea valoroasă a
proiectului. Stratul de legătură dintre date și aplicație este partea fragilă.

**Stack:** JavaScript vanilla cu module ES, fără framework. CSS custom. SVG pentru hartă.
`server.py` (Python stdlib) pentru servire statică + API de admin.

## 2. Structura

```
js/app.js                 orchestrare, wireEvents, selectEntity
js/data/                  DataManager, SearchEngine, TimelineEngine
js/map/                   MapRenderer, MapInteraction, MapLayers, MapAnimations, RegionSelector
js/ui/                    SearchBar, InfoPanel, WikiPage, FilterPanel, Timeline, DistanceTool, Toolbar
js/utils/                 helpers, config, colors, coordinates, AudioManager
admin/map-editor.html|js  panou de calibrare a coordonatelor
css/                      main, map, panels, timeline, typography, animations
data/                     JSON-uri: locations, characters, houses, events, dragons,
                          objects, titles, essos, map (catalog + regions + world_features)
scripts/                  ~40 scripturi Python de ETL — vezi §5
tests/smoke.mjs           test de fum (rulează după fiecare fază)
```

## 3. Cifre de referință — verificate programatic

**Nu presupune alte cifre. Dacă ai nevoie de una care nu e aici, măsoar-o și raportează.**

| Fapt | Valoare |
|---|---|
| Locații încărcate în aplicație | 1099 (1041 locations + 9 free_cities + 49 far_lands) |
| Locații care ajung în `getAllLocations()` | 391 |
| Locații cu pin pe hartă (`catalog.json`) | 77 |
| Locații cu `type: "location"`, filtrate complet | 708 |
| Locații randabile fără `coordinates` la rădăcină | 327 / 391 |
| Personaje | 2288 (34 au `description`; 69% au scor de completitudine sub 0.3) |
| Evenimente | 1682 (1561 cu an numeric, interval −114 … 302) |
| Case | 229 (103 fără câmp `crest`) |
| Dragoni | 3 (fișierul are 2.7 KB — este un stub, nu o structură completă) |
| Obiecte / titluri | 276 / 94 — **nu sunt încărcate de DataManager** |
| Afirmații de distanță | 467 (doar 20 conțin vreo cifră) |
| `milesPerUnit` în catalog | `null` → distanța geometrică indisponibilă |
| Checkbox-uri în panoul de filtre | 128 (~96 nu pot afecta niciun pin) |

## 4. Capcane cunoscute — citește înainte de a diagnostica ceva

Acestea au produs deja diagnostice greșite în audituri anterioare. Nu le repeta.

1. **Există DOUĂ sisteme de coordonate.** `locations.json` are un câmp `coordinates`
   la rădăcina obiectului. `data/map/catalog.json → maps.world.coordinates` este
   registrul autoritar folosit efectiv la randare. `MapRenderer.getLocationCoordinate()`
   citește DOAR din catalog. Un audit anterior le-a confundat și a concluzionat greșit.
   `kings_landing` are `coordinates: {x: 304.4, y: 580.2}` în **ambele**.

   `coordinates` de la rădăcină este **deprecat și nu se mai scrie**; `catalog.json`
   este singura sursă pentru locațiile cu pin. Câmpul rămâne în date pentru că este
   singura poziție disponibilă pentru locațiile fără pin (fallback de fly-to la
   `js/app.js:356`) — nu se șterge. Cele două sisteme divergeau deja pentru 7 orașe
   libere: `docs/raport_coordonate_desincronizate.md`.

2. **`id_intern` poate fi string SAU array.** Exact 3 locații îl au ca array:
   `kings_landing`, `oldtown_city`, `storm_end`. Operatorul `?.` nu protejează de
   „nu e o funcție". Orice `entity.id_intern?.startsWith(...)` aruncă pentru ele.

3. **`aliasuri` și `tags` pot fi string sau array.** Aceeași clasă de bug.

4. **Prefixele nu sunt normalizate nicăieri la încărcare.** `membru_al` are forma
   `HOUSE_TARGARYEN` (631/631 nu rezolvă direct), `locatie_id` are forma
   `LOCATION_*` (0/875 rezolvă direct). Câmpul `location` al evenimentelor rezolvă
   875/875 și trebuie preferat.

5. **Euristica de eliminare a prefixului nu e suficientă.** Pică pe perechile
   română↔engleză: `LOCATION_PUMNUL_PRIMILOR_OAMENI` → `pumnul_primilor_oameni`,
   dar id-ul real este `fist_of_first_men`.

6. **`subtip` nu este o taxonomie.** Are 572 de valori distincte, 497 apar o singură
   dată. Este text liber ieșit din extragere: „încăpere/balcon în interiorul fortăreței",
   „tron/scaun de conducere", „castel mic (ziduri de piatră, fortăreață de stejar)".

7. **Datele nu sunt bilingve — sunt amestecate în același câmp.** `name` conține
   uneori engleză, uneori română, fără marcaj. Evenimente: 86% nume românești.
   Case: 100% englezești. Descrierile sunt aproape integral românești.

8. **Cod scris care nu se execută niciodată.** Înainte de a propune ceva „nou",
   verifică dacă nu există deja într-o ramură inaccesibilă:
   - siluetele SVG per-locație din `MapRenderer.js:437-567` sunt în ramura `else` a
     lui `if (rulingHouse?.crest)` — nu se desenează pentru locațiile cu emblemă
   - `renderGeographicFeatures()` are rotație și praguri de zoom, dar
     `world_features.json` are 0 mări
   - blocurile de indexare pentru obiecte și titluri din `SearchEngine.js:104-133`
     sunt protejate de condiții permanent false
   - `isLowCompletenessEntity()` ascunde exact 0 entități, în toate categoriile
   - `validateRegionLocationMembership()` și `getRegionBounds()` iterează un obiect
     gol; selecția pe regiune nu funcționează din acest motiv

9. **Tratarea erorilor ascunde eșecuri.** `MapRenderer.js:363-647` învelește
   construcția fiecărui marker într-un `try/catch` care doar loghează. Un marker care
   eșuează dispare, iar harta pare completă. `app.init().catch(console.error)`
   înghite orice eroare de încărcare și lasă ecranul de loading blocat la infinit.

## 5. Interdicții permanente

1. **Nu rula scripturi din `scripts/` sau `scratch/`** fără cerere explicită în sarcină.
   Multe sunt operații unice deja aplicate (`merge_*_nivel1.py`, `dedup_*`, `retire_*`).
   Rerularea peste date deja procesate le corupe. Cele arhivate în `scripts/archive/`
   nu se rulează niciodată.
2. **Nu inventa fapte de canon ASOIAF.** Dacă un câmp nu are sursă în datele
   proiectului, rămâne `null`. Datele au proveniență la nivel de pagină — nu o dilua
   cu informații din memorie sau de pe wiki-uri externe.
3. **Nu traduce automat nume proprii de univers.** Merg la triaj manual.
4. **Nu șterge câmpuri din JSON.** Adaugă câmpuri noi; marchează-le pe cele vechi ca
   deprecate. Textul original se păstrează întotdeauna undeva.
5. **Nu repara în date o problemă a cărei cauză e în cod, și invers.** Stabilește întâi
   unde e cauza.
6. **Nu modifica `data/`** decât dacă sarcina o cere explicit.
7. **Nu improviza.** Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.
   Nu înlocui sarcina cu una pe care o consideri mai bună.

## 6. Contractul de lucru

**Înainte de orice modificare:**
- rulează `git status`. Dacă arborele nu e curat, oprește-te și raportează.
  Nu lucra peste modificări necommitate.

**În timpul lucrului:**
- o sarcină = un commit. Nu amesteca faze.
- orice transformare de date se face cu backup automat și cu dry-run implicit;
  scrierea trebuie să ceară un flag explicit.

**La final, raportează întotdeauna:**
1. lista exactă a fișierelor modificate
2. numărul de linii adăugate / șterse per fișier
3. **rezultatul criteriului de acceptanță ca ieșire de comandă, nu ca afirmație**
4. orice premisă din sarcină care s-a dovedit inexactă

**Regula de fond:** verifică faptul, nu enunțul. Bug-urile din v1 au existat pentru că
s-a confirmat că un cod *există*, nu că se *execută* cu datele reale. Când afirmi o
cifră, măsoar-o. Când afirmi că ceva funcționează, rulează-l.

## 7. Verificare

După fiecare fază:

```bash
node tests/smoke.mjs      # exit 0 obligatoriu
git status --short         # gol după commit
```

Smoke test-ul verifică, printre altele: câte locații ajung în aplicație, câte au pin,
câte evenimente rezolvă la o locație, câte personaje rezolvă la o casă, și dacă vreun
predicat de tip de entitate aruncă pentru vreo entitate din date.

## 8. Convenții de cod

- module ES, `import`/`export`, fără bundler
- fără dependențe noi fără discuție prealabilă
- comentariile explică **de ce**, nu **ce**
- numele de funcții și variabile în engleză; textul vizibil utilizatorului trece prin
  stratul i18n (`t('cheie')`), niciodată hardcodat
- fără `localStorage` în cod care ar putea ajunge într-un artefact; în aplicația
  proprie este permis
- logica duplicată se extrage la a doua apariție, nu la a cincea
