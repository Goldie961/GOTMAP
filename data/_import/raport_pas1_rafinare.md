# Raport Rafinare Pas 1 — Case Nobile

Notă preliminară: nu am avut acces la fișierele-sursă brute (extrase din cărți), doar la
JSON-urile deja generate la Pasul 1 și la raportul asociat. Verificarea celor 556 de
afirmații `ally_of`/`enemy_of`/`vassal_of`/`liege_of` s-a făcut prin evaluarea
plauzibilității fiecărei relații față de universul ASOIAF (istoria caselor, evenimentele
cunoscute din cărți), conform instrucțiunii din cerere pentru cazul în care fișierul sursă
original nu mai e disponibil.

## Corecția 1 — ally_of / enemy_of / vassal_of / liege_of

| Rezultat | Nr. |
|---|---:|
| Verificate (total) | **556** |
| Corectate (predicat și/sau direcție greșite, corecție cu încredere ridicată) | **23** |
| Mutate în `case_relatii_de_verificat.json` (incertitudine, nu pot fi corectate cu încredere) | **14** |
| Confirmate ca fiind deja corecte | **519** |

### Cele 23 corectate (predicat/direcție greșite, corectate)

- `HOUSE_LANNISTER vassal_of PERSON_JANOS_SLYNT` → `liege_of` (Lannisterii l-au ridicat pe Slynt la rang, nu invers)
- `HOUSE_LANNISTER vassal_of HOUSE_CRAKEHALL` → `liege_of` (Crakehall e stegar al Lannisterilor)
- `HOUSE_CLEGANE vassal_of PERSON_NED_STARK` → `vassal_of HOUSE_LANNISTER` (Clegane e casă a Ținuturilor de Vest, stegară a Lannisterilor, nu a Stark)
- `HOUSE_GLOVER ally_of HOUSE_GREYJOY` (ACOK) → `enemy_of` (ironborn-ii cuceresc Deepwood Motte de la Glover)
- `HOUSE_GREYJOY vassal_of HOUSE_GOODBROTHER` → `liege_of` (Goodbrother e stegară a Greyjoy)
- `HOUSE_LANNISTER vassal_of PERSON_SER_AMORY_LORCH` → `liege_of` (Lorch e cavaler în slujba Lannisterilor)
- `HOUSE_LANNISTER ally_of PERSON_RENLY_BARATHEON` → `enemy_of` (Renly e rival la tron, nu aliat)
- `HOUSE_LANNISTER enemy_of PERSON_SER_STAFFORD_LANNISTER` → `ally_of` (Stafford e rudă și comandant loial al Lannisterilor)
- `HOUSE_LANNISTER enemy_of HOUSE_MARBRAND` → `liege_of` (Marbrand e stegară loială a Lannisterilor)
- `HOUSE_MARBRAND enemy_of HOUSE_LANNISTER` → `vassal_of` (aceeași corecție, din perspectiva Marbrand)
- `HOUSE_STARK enemy_of HOUSE_MALLISTER` (ACOK) → `ally_of` (Mallister luptă alături de Robb Stark)
- `HOUSE_STARK enemy_of PERSON_ROBERT_BARATHEON` → `ally_of` (Robert e cel mai apropiat aliat/prieten al lui Ned Stark)
- `HOUSE_TARGARYEN enemy_of PERSON_SER_JORAH_MORMONT` → `ally_of` (Jorah e protectorul devotat al lui Daenerys)
- `HOUSE_TULLY enemy_of HOUSE_MALLISTER` → `liege_of` (Mallister e stegară loială a Tully)
- `HOUSE_LANNISTER ally_of PERSON_STANNIS_BARATHEON` (ASOS) → `enemy_of` (Stannis e adversar constant al Lannisterilor)
- `HOUSE_STARK enemy_of HOUSE_MALLISTER` (ASOS, a doua apariție) → `ally_of`
- `HOUSE_STARK vassal_of HOUSE_MORMONT` (AGOT) → `liege_of` (Mormont/Insula Ursului e stegară a Stark)
- `HOUSE_STARK vassal_of HOUSE_MORMONT` (ADWD, ×2) → `liege_of`
- `HOUSE_SUNDERLAND liege_of HOUSE_ARRYN` → `vassal_of` (Sunderland e stegară a Vaii, nu invers)
- `HOUSE_TULLY vassal_of HOUSE_FREY` → `liege_of` (Frey e stegară a Tully)
- `HOUSE_TYRELL vassal_of HOUSE_BEESBURY` → `liege_of` (Beesbury e casă mică, stegară a Highgarden/Tyrell)
- `HOUSE_LANNISTER ally_of PERSON_DALTON_GREYJOY` → `enemy_of` (Dalton Greyjoy a jefuit Lannisport — eveniment istoric de conflict, nu alianță)

### Cele 14 mutate în `case_relatii_de_verificat.json`

Fiecare cu subiect, predicat, obiect, sursă și motivul incertitudinii — vezi fișierul.
Pe scurt, cazurile sunt: două afirmații privind Ser Rodrik Cassel (inclusiv exemplul
semnalat: `HOUSE_STARK enemy_of PERSON_SER_RODRIK_CASSEL`), o relație de vasalitate
Stark–Greyjoy inexistentă în canon, o presupusă dușmănie Arryn–Royce ce contrazice o
relație deja confirmată în corpus, o "dușmănie" a Casei Mallister față de propriul lord,
o afirmație Stark–Karstark plasată cronologic greșit (evenimentul are loc abia în cartea
următoare), exemplul semnalat explicit `HOUSE_LANNISTER vassal_of PERSON_STANNIS_BARATHEON`,
o "alianță" Bolton–Greyjoy care reflectă de fapt un șiretlic/o trădare, și patru cazuri unde
o casă apare drept „dușman" al propriului ei membru/lord (Beesbury, Baratheon/Borys,
Harroway/Alys, Strong/Larys), plus relația de vasalitate reciproc-contradictorie
Osgrey–Webber.

Nu a fost șters nimic fără documentare — toate cele 14 apar cu textul original și motivul
în `case_relatii_de_verificat.json`, iar restul (519) au rămas neschimbate în fișierele de
output.

## Corecția 2 — despărțire valori multiple la `sigil`

| Rezultat | Nr. |
|---|---:|
| Afirmații `sigil` inițiale | 292 |
| Din care cu valori multiple separate prin „;" | **35** |
| Afirmații rezultate din despărțirea celor 35 | **87** |
| Total afirmații `sigil` după despărțire | **344** (257 nemodificate + 87 rezultate) |

Despărțirea s-a făcut strict pe separatorul „;", păstrând `source_book`, `source_fragment`,
`source_page` și `confidence` identice pentru toate valorile rezultate din aceeași afirmație
originală. Nu s-a deduplicat nimic — variantele provenite din fragmente diferite au fost
păstrate ca atare.

## Total afirmații în output

2556 (Pas 1) − 14 (mutate la verificare) + 52 (net din despărțirea `sigil`, 87 rezultate − 35
originale) = **2594** afirmații în `statements_case_nobile_part1.json` … `part7.json`.

## Fișiere livrate

- `statements_case_nobile_part1.json` … `part7.json` — fișierele corectate (aceeași structură).
- `case_relatii_de_verificat.json` — cele 14 afirmații mutate, cu text original și motiv.
- `raport_pas1_rafinare.md` — acest raport.
