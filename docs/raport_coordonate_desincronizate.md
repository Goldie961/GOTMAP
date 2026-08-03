# Raport — coordonate desincronizate între cele două sisteme

**Data măsurătorii:** 2026-08-03
**Metodă:** comparație directă între `data/map/catalog.json → maps.world.coordinates`
și câmpul `coordinates` de la rădăcina fiecărei locații, peste toate cele trei
fișiere de locații.

**Acest document nu repară nimic.** Este documentare, nu corecție. Catalogul este
corect prin definiție de la această dată înainte (vezi CLAUDE.md §4.1).

---

## 1. De ce există documentul

Proiectul are două locuri în care stă poziția unei locații:

| sistem | unde | citit de |
|---|---|---|
| **catalog** (autoritar) | `data/map/catalog.json → maps.world.coordinates` | `MapRenderer.getLocationCoordinate()` — singurul consumator la randare |
| **rădăcină** (deprecat) | câmpul `coordinates` din obiectul locației | `js/app.js:356`, doar ca fallback de fly-to pentru locațiile **fără** pin; passthrough în `SearchEngine.js:35` |

Până acum, `admin/map-editor` scria în amândouă la fiecare salvare. Rezultatul
măsurat mai jos arată că două copii scriibile ale aceluiași fapt nu rămân
sincronizate — nici măcar când un singur proces le scrie pe amândouă.

Începând cu această sarcină, editorul **nu mai scrie niciodată** câmpul de la
rădăcină. Câmpul rămâne în date: este singura sursă de poziție pentru locațiile
fără pin și nu se șterge.

## 2. Cifrele

Măsurat pe arborele de lucru (79 de pinuri în catalog). Cifrele pentru `HEAD`
(77 de pinuri) diferă doar prin `highgarden` și `storm_end`, ambele necomise,
ambele în categoria „absent la rădăcină".

| categorie | HEAD (77) | arbore de lucru (79) |
|---|---|---|
| rădăcină identică cu catalogul | 57 | 57 |
| **divergente** (ambele valori există și diferă) | **7** | **7** |
| absente la rădăcină (catalogul are pin, rădăcina n-are valoare) | 13 | 15 |
| pinuri fără nicio locație corespondentă | 0 | 0 |

Absența nu este conflict. Cele două categorii se raportează separat pentru că
implică lucruri diferite: una e o valoare greșită, cealaltă e o valoare lipsă.

## 3. Divergențe reale — 7

| id | fișier | `coordinates` (rădăcină) | catalog | `sursa_coordonate` |
|---|---|---|---|---|
| `lorath` | free_cities | 739.8, 500.8 | 566.4, 303.7 | null |
| `lys` | free_cities | 742, 512.9 | 520.4, 700.6 | null |
| `norvos` | free_cities | 766.3, 496 | 564.3, 400.8 | null |
| `pentos` | free_cities | 762, 488.6 | 538.8, 558.3 | null |
| `myr` | free_cities | 748.1, 507.7 | 552.4, 595.8 | null |
| `qohor` | free_cities | 748.2, 519.6 | 631.5, 417.8 | null |
| `tyrosh` | free_cities | 764.3, 514 | 485.1, 593.3 | null |

**Toate cele 7 sunt orașe libere din Essos. Toate au `sursa_coordonate: null`.**

Valorile lor de la rădăcină ocupă o casetă de **26.5 × 31.0 unități** pe o pânză
de 1500 × 1000 — x între 739.8 și 766.3, y între 488.6 și 519.6. Șapte orașe
răspândite peste tot Essosul nu stau în realitate într-un pătrat de 27 × 31 de
unități. Sunt valori de umplutură dintr-un import, nu plasări cartografice.

Catalogul le are corect: `lys` la 520.4, 700.6 și `norvos` la 564.3, 400.8 sunt
la distanțe plauzibile unul de altul.

**Nu se face backfill.** Nu există o stare consistentă de restaurat — propagarea
acestor valori ar propaga o coincidență de import, nu un adevăr.

## 4. Absente la rădăcină — 15

Catalogul are pin; obiectul locației n-are `coordinates`, sau îl are `null`.
Nu este un conflict; nu e nimic de reconciliat. Se listează pentru completitudine.

| id | fișier | catalog | `sursa_coordonate` |
|---|---|---|---|
| `braavos` | free_cities | 519.3, 314.7 | null |
| `highgarden` | locations | 190, 640 | AWOIAF |
| `storm_end` | locations | 372, 672 | *(șir gol)* |
| `volantis` | free_cities | 617.1, 659.7 | null |
| `yi_ti` | far_lands | 1183.3, 738.7 | null |
| `valyria` | far_lands | 675.1, 775.5 | null |
| `mantarys` | far_lands | 672.5, 661.4 | null |
| `meereen` | far_lands | 825.6, 580 | null |
| `tolos` | far_lands | 739.8, 628.2 | null |
| `yunkai` | far_lands | 823.6, 615.4 | null |
| `astapor` | far_lands | 819.5, 657.6 | null |
| `leng` | far_lands | 1265.1, 815 | null |
| `qarth` | far_lands | 1019.8, 702.6 | null |
| `naath` | far_lands | 610.7, 902.1 | null |
| `lhazar` | far_lands | 861.5, 593.2 | null |

`highgarden` și `storm_end` au intrat în catalog necomise, cu
`source: "capital-label-visibility"` și `method: "approximate"`. Sunt aproximări
pentru vizibilitatea etichetelor de capitală, **nu** plasări calibrate în editor.
Rămân candidate pentru recalibrare manuală.

## 5. Ce s-a schimbat în cod

- `server.py` — `/api/save-coordinates` nu mai atinge fișierele de locații. Le
  citește doar pentru a valida id-urile. Scrie exclusiv `catalog.json`.
- `server.py` — `write_json()` compară cu conținutul de pe disc și scrie doar la
  diferență. Se aplică tuturor rutelor de admin, nu doar salvării de pinuri.
- Câmpul `coordinates` de la rădăcină rămâne în date, marcat deprecat în
  comentariul din `server.py` și în CLAUDE.md §4.1.
