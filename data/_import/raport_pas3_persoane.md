# Raport Pas 3 — Arbore genealogic / Persoane

## Metodologie

Dat fiind volumul corpusului (7 cărți, ~38.900 linii de markdown sursă, 4.246
mențiuni brute de persoane care se unifică în 2.458 entități în `entities.json`),
procesarea a fost făcută printr-un pipeline sistematic (parsare + reguli), nu
manual entitate-cu-entitate — în aceeași logică descrisă în `raport_pas0.md`
pentru același motiv de scală.

Pipeline-ul:
1. **Parsare bloc-per-persoană** din fiecare fișier `3.Arbore` (secțiunile
   `- **Persoană:** NUME` cu câmpurile indentate sub ele). Fișierul consolidat
   folosit pentru Înclestarea Regilor a fost `ARBORE_GENEALOGIC_CONSOLIDAT.md`;
   `_3a.md`/`_3b.md` au fost excluse conform cerinței.
   → **Verificare de coerență**: parser-ul a găsit 4.246 mențiuni brute de
   persoană, identic cu cifra "4246 (minus 7 excluse)" din raportul Pas 0.
2. **Rezolvare nume → ID** exclusiv contra `entities.json` (nicio invenție de
   ID nou), cu potriviri în cascadă: exact → variantă fără paranteze de stare
   ("(decedat)") → fără paranteze/ghilimele → indice "stripped" construit și pe
   partea de registru (pentru cazuri ca „Cersei (regină)" → „Cersei") → alias
   → set de cuvinte (tokens) → segment după virgulă → sugestie de nume de casă
   (pentru menționări cu un singur prenume, ex. „Cersei" în contextul Casei
   Lannister a persoanei curente).
3. **Clasificare câmpuri** (eterogene între cele 7 fișiere — fiecare carte
   folosește etichete puțin diferite: „Părinți" vs „Tată:"/"Mamă:", „Frați /
   surori" vs „Frate:"/"Soră:", etc.) în categorii canonice: Casă, Părinți,
   Frați/surori, Soț/soție, Copii, Titluri, Vârstă, An naștere/moarte.
4. **Generare afirmații atomice** cu o afirmație separată per relație
   individuală și per titlu cronologic, conform regulilor din prompt.

## Decizii de interpretare (documentate pentru transparență)

- Câmpurile de tip logodnic/logodnă, iubită/ibovnică/parteneră, precum și
  relațiile de tip nepot/nepoată/mătușă/unchi/bunică au fost **omise** — nu
  există predicate corespunzătoare în schema cerută (`married_to` presupune
  căsătorie confirmată; nepot/mătușă nu sunt copil/părinte/frate direct), iar
  inventarea unui predicat nou ar încălca schema fixă.
- Pentru `title_at`/`age_at`/`born`/`died`, obiectul afirmației este **textul
  descriptiv** din sursă (ex. „fost Mână a Regelui"), nu un ID din
  `entities.json` — regula de validare a ID-urilor din prompt vizează explicit
  entitățile de tip persoană/casă, iar cele 78 de entități „titlu" din registru
  nu acoperă granularitatea fiecărei variante cronologice de titlu.
- `source_page` este valoarea câmpului „Pagina (total)" al persoanei (unde
  exista), aplicată tuturor afirmațiilor despre acea persoană — sursa nu oferă
  paginare per-fragment separat de aceasta.
- Când același predicat (ex. copil-părinte) apare cu confidence diferit în
  cărți/blocuri diferite (ex. blocul unei persoane are `⚠` explicit, blocul
  celeilalte persoane nu), am păstrat ambele — asta reflectă corect ce spune
  sursa în fiecare loc, nu o contradicție de-a mea.

## Statistici finale

**Persoane procesate:** 4.025 din 4.246 mențiuni brute (221 nerezolvate —
vezi mai jos). **1.791 entități-persoană distincte** au cel puțin o afirmație.

**Total afirmații generate (după deduplicare exactă): 11.261**

### Pe carte
| Carte | Persoane (mențiuni brute) | Afirmații |
|---|---|---|
| Urzeala Tronurilor | 315 | 926 |
| Înclestarea Regilor | 486 | 1.992 |
| Iureșul Săbiilor | 1.286 | 2.723 |
| Festinul Ciorilor | 528 | 1.441 |
| Dansul Dragonilor | 979 | 2.118 |
| Cavalerul celor 7 Regate | 160 | 496 |
| Foc și Sânge | 492 | 1.565 |
| **Total** | **4.246** | **11.261** |

### Pe predicat
| Predicat | Nr. afirmații |
|---|---|
| title_at | 6.440 |
| member_of | 1.507 |
| sibling_of | 1.130 |
| parent_of | 753 |
| child_of | 628 |
| died | 504 |
| married_to | 216 |
| age_at | 52 |
| born | 16 |
| possible_parent_of | 15 |

### Pe confidence
| Confidence | Nr. afirmații |
|---|---|
| confirmed | 11.024 |
| probable | 127 |
| uncertain | 110 |

**110 afirmații marcate „uncertain"** din cauza conflictelor de sursă
(marcaj ⚠ sau variații explicite `[Fragment N]` între fragmente), acoperind
**20 persoane distincte** — majoritatea cazuri de părinți/vârstă/moarte
contestate între fragmente (ex. Jon Arryn — cauza morții variază între
fragmente; Robert Arryn — identitatea unui părinte variază).

## Fișiere livrate

- `statements_persoane_part1.json` (4.000 afirmații)
- `statements_persoane_part2.json` (4.000 afirmații)
- `statements_persoane_part3.json` (3.261 afirmații)
- `referinte_lipsa.json` (968 referințe nerezolvate, vezi mai jos)

## Referințe lipsă / nerezolvate (`referinte_lipsa.json`)

**968 referințe** (persoane sau case menționate în text dar care nu s-au putut
lega cu certitudine de un ID existent în `entities.json`) au fost semnalate,
împărțite astfel:

| Motiv | Nr. |
|---|---|
| Persoană menționată într-o relație (părinte/frate/soț/copil), neidentificabilă | 536 |
| Casă menționată în câmpul „Casă", neidentificabilă | 211 |
| Persoana-subiect a blocului însuși, neidentificabilă în `entities.json` | 221 |

Motive tipice pentru nerezolvare (documentate per-intrare în fișier, cu
`raw_name`, `carte`, `câmp` și persoana-subiect unde e relevant):
- **Prenume izolat, ambiguu** (ex. „Aemond" ca și copil al Alicent Hightower —
  copilul aparține de fapt Casei Targaryen a tatălui, nu Casei Hightower a
  mamei, deci sugestia de casă contextuală nu se aplică; heuristica de
  completare cu numele casei subiectului nu acoperă acest caz).
- **Porecle/nume alternative** care nu se potrivesc exact (după eliminarea
  parantezelor/ghilimelelor) cu `nume_canonic` sau `aliasuri` din registru
  (ex. „Aegon cel Tânăr").
- **Case fără corespondent clar** — origini descriptive ("origine modestă",
  "neafiliat marilor case", "neclară") care nu sunt de fapt nume de casă, ci
  descrieri; unele chiar dacă case reale (ex. o casă minoră neînregistrată ca
  entitate „casa" în Pas 0) nu au putut fi confirmate.
- **221 persoane-subiect** ale unor blocuri din Arbore nu au putut fi legate de
  niciun ID din `entities.json` — cauza principală fiind formulări compuse
  neobișnuite ale numelui în antetul blocului (nume + poreclă + titlu combinate
  într-un mod care nu se regăsește exact în `nume_canonic`/`aliasuri`), sau
  identități explicit incerte în sursă (ex. „Tânărul Griff", a cărui identitate
  reală e disputată chiar în text).

Aceste 968 de intrări nu au generat nicio afirmație (subiectul sau obiectul
relației respective a fost omis, nu ghicit), conform cerinței de a nu inventa
ID-uri.

## Note privind acoperirea

- Câmpurile goale ("nemenționați", "—", etc.) nu au generat afirmații, conform
  regulii 4.
- Nicio afirmație nu are `subject` sau `object` egal cu o entitate de tip
  „Casa X" din tabelul genealogic listat ca atare (regula 8) — casele au fost
  procesate exclusiv ca obiect al predicatului `member_of`.
- Niciun `source_fragment` nu are valoarea `0`; câmpul este `null` acolo unde
  sursa nu atașează un fragment real afirmației respective.
