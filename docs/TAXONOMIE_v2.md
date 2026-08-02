# Taxonomia de locații — propunere v2

Status: **propunere**. Niciun fișier din `data/` nu a fost modificat de acest document.
Eșantion de referință: [`docs/taxonomie_esantion.json`](taxonomie_esantion.json) — 60 de rânduri adnotate manual.

---

## 0. Ce am măsurat înainte de a propune ceva

Toate cifrele de mai jos sunt ieșiri de comandă peste
`data/locations/locations.json` + `data/essos/free_cities.json` + `data/essos/far_lands.json`,
nu afirmații.

| Fapt | Valoare măsurată |
|---|---|
| Total locații încărcate | 1099 (1041 + 9 + 49) |
| Distribuția `type` | location 708, castle 185, landmark 122, city 30, town 26, fortress 16, ruins 12 |
| Valori distincte de `subtip` | 573 (497 apar exact o dată; 233 rânduri fără `subtip`) |
| Rânduri `type=location` cu `coordinates` nenule | **0 din 708** |
| Rânduri din tot corpusul cu `coordinates` nenule | 64 din 1099 |
| Pinuri în `catalog.json` | 77 |
| Pinuri care NU sunt puncte | **26 din 77 (33,8 %)** — vezi §4 |
| `relatii` populat | 886 rânduri, formă `{part_of: [], near: []}` |
| `relatii.part_of` nevid | 257 |
| Rânduri din cele 708 al căror `name` conține numele unei locații deja tipate | 85 |

### Trei premise din sarcină care s-au dovedit inexacte

1. **„21 din cele 77 de pinuri sunt de fapt ape sau regiuni."** Sunt **26**, iar categoria
   e mai largă decât ape+regiuni: 7 ape, 4 forme de relief, 8 insule/arhipelaguri,
   6 regiuni/continente, 1 obiect liniar. Șase dintre ele nu sunt nici măcar tipate
   `landmark`, ci `castle`/`ruins` — `yi_ti` (un imperiu), `naath`, `leng`, `claw_isle`,
   `driftmark`, `valyria`. Lista completă în §4.1. `red_watch` rămâne nedecis (fără
   `subtip`, fără descriere) și necesită triaj manual.

2. **`relatii.part_of` nu este un părinte.** Este populat din predicatul `region` și
   conține referințe REGIONALE, uneori auto-referențiale: `riverrun → LOCATION_RIVERRUN`,
   `pyke → LOCATION_PYKE`. Migrarea lui directă în `parent_id` ar produce 257 de relații
   greșite și cel puțin 2 cicluri de lungime 1. Nu poate fi sursă pentru axa 3.

3. **Nicio locație din cele 708 nu are coordonate.** Problema „64 % invizibile" nu se
   rezolvă prin retipare: retiparea decide *care* rânduri merită un punct, dar toate
   punctele trebuie ulterior calibrate manual în `catalog.json`. Retiparea produce o
   **coadă de lucru**, nu pinuri.

---

## 1. Modelul cu trei axe

Cele trei axe răspund la trei întrebări diferite, care astăzi sunt amestecate în `type`:

| Axă | Întrebare | Tip |
|---|---|---|
| `type` | Ce **este** lucrul? | enum închis, 13 valori |
| `mappable` | **Merită** geometrie proprie pe harta lumii? | boolean |
| `parent_id` | Ce îl **conține** fizic? | id sau `null` |

Ele sunt ortogonale, iar eșantionul demonstrează asta cu perechi concrete:

- `turnul_maesterului` și un han izolat de drum au **același `type`** (`structure`) și
  **`mappable` diferit** — unul e în curtea Winterfellului, celălalt stă singur în peisaj.
- `padurea_zeilor_de_la_winterfell` este `landform` cu `mappable: false`;
  `kingswood` este `landform` cu `mappable: true`. Tipul nu decide vizibilitatea.
- `gods_eye` este `mappable: true` și conține Insula Fețelor, care ar fi și ea
  `mappable: true`. **`mappable` nu se moștenește de la părinte, în niciun sens.**

### 1.1 `type` — vocabular închis, 13 valori

Fiecare valoare este justificată prin ce **angajament geometric** implică. Asta e
diferența față de `type`-ul actual: `landmark` nu spune nimic despre cum se desenează,
motiv pentru care 26 de pinuri sunt desenate greșit.

| `type` | Ce este | Geometrie | Din ce se alimentează |
|---|---|---|---|
| `settlement` | așezare locuită a cărei identitate principală nu e fortificația: oraș, târg, sat, cătun | punct | `city` 30 + `town` 26 + ~65 din 708 |
| `stronghold` | scaun fortificat: castel, cetate, fortăreață, turn-reședință, fort de pe Zid | punct | `castle` 185 + `fortress` 16 + ~89 din 708 |
| `structure` | un singur lucru construit care nu e nici scaun, nici așezare: han, bordel, templu, turn simplu, pod, moară, arenă, sediu de ghildă, statuie, Zidul | punct sau polilinie | ~158 din 708 |
| `interior` | spațiu **în interiorul** altei construcții: sală, încăpere, criptă, curte, bucătărie, grajd, beci | — (niciodată) | ~43 din 708 |
| `urban_feature` | element din țesutul unei așezări: stradă, alee, piață, poartă, cartier, docuri | — (niciodată la scara lumii) | ~61 din 708 |
| `region` | întindere administrativă sau culturală: regat, regiune, ținut, marcă, continent | poligon | ~38 din 708 + 6 pinuri actuale |
| `landform` | întindere naturală de uscat: pădure, lanț muntos, coline, câmpie, mlaștină, deșert | poligon | ~77 din 708 + 4 pinuri actuale |
| `island` | uscat înconjurat de apă, inclusiv arhipelag | poligon | ~35 din 708 + 8 pinuri actuale |
| `water` | mare, golf, strâmtoare, ocean, lac | poligon | ~66 din 708 + 7 pinuri actuale |
| `watercourse` | râu, pârâu, furcă, canal, cascadă | polilinie | subset din `water` de mai sus |
| `route` | drum, cărare, trecătoare, rută maritimă | polilinie | ~22 din 708 |
| `point_of_interest` | reper natural sau construit care **chiar este** un punct: copac-inimă, cerc de pietre, vad, vârf de promontoriu, movilă | punct | din `neclasificat` + `landform` |
| `non_place` | artefact de extragere care nu e loc: corabie, eveniment, instituție, mașinărie de asediu, notă OCR, rând-coș | — | ~17+ din 708 |

**13 valori. Ținta „sub 15" respectată.**

#### De ce lipsesc `landmark` și `ruins`

**`landmark` dispare.** Este exact eticheta care a produs problema din §4: acoperă în
același timp un golf, o pădure, un lanț muntos, un continent și un turn. Nu comunică nicio
geometrie, deci randorul nu poate face altceva decât să deseneze un romb. Cele 122 de
rânduri `landmark` se împart pe `water` / `landform` / `island` / `region` /
`point_of_interest` / `structure`.

**`ruins` dispare din `type`.** „Ruinat" este o **stare**, nu un fel de lucru. Harrenhal
este un castel ruinat; Valyria este o regiune ruinată; Moat Cailin este o fortăreață
ruinată. Toate trei ar fi `ruins` azi, ceea ce le pune la un loc pe baza singurului
lucru care nu contează pentru hartă. Informația nu se pierde — vezi axa auxiliară de mai jos.

#### Axă auxiliară necesară: `state`

Eliminarea lui `ruins` din `type` are nevoie de o destinație, altfel încalcă §5.4 din
`CLAUDE.md` (nu se pierde informație). Propun un al patrulea câmp, mic și închis:

```
state: "extant" | "ruined" | "former" | "unknown"     // implicit "unknown"
```

`former` acoperă cazuri pe care `ruined` nu le prinde: `aegonfort` (înlocuit, nu ruinat),
`brat_rupt_de_dorne` (scufundat, nu mai există ca formă de relief). Ambele sunt în eșantion.

### 1.2 `mappable` — boolean

**Definiție:** `mappable = true` dacă entitatea are o poziție sau o întindere în lume
care este (a) **distinctă de a părintelui** și (b) **rezolvabilă la scara hărții lumii**.

Reguli derivate, nu la liber:

- `interior`, `urban_feature`, `non_place` → **întotdeauna `false`**. Nu există excepție.
- restul tipurilor → `true` dacă entitatea stă singură în peisaj, `false` dacă e în incinta
  altei entități (`turnul_maesterului`, `bordelul_lui_petyr_baelish`).

**`mappable` NU înseamnă „are coordonate".** Asta e distincția care face câmpul util:

| `mappable` | geometrie în catalog | înțeles |
|---|---|---|
| `true` | prezentă | se desenează |
| `true` | absentă | **coadă de lucru pentru calibrare** |
| `false` | — | apare doar în wiki și în căutare, ca fiu al părintelui |

Cele 708 au 0 coordonate. Fără această separare, „mappable" ar fi identic cu „are pin"
și ar rămâne blocat la 77 pentru totdeauna. Cu ea, retiparea produce o listă de lucru
măsurabilă (§5).

Câmpul rămâne **derivabil și verificabil**: un test poate afirma
`type ∈ {interior, urban_feature, non_place} ⟹ mappable === false` și poate eșua la build.

### 1.3 `parent_id` — containment fizic

Un singur id, sau `null`. Semantica este strict **spațială**: „X se află în interiorul lui Y".

Constrângeri verificabile:
- trebuie să rezolve la un id existent;
- `parent_id !== id`;
- graful trebuie să fie aciclic;
- adâncimea recomandată ≤ 3 (`lume → oraș → castel → încăpere`).

**Ce NU este `parent_id`:**
- **nu** e apartenență regională — aceea rămâne în câmpul `region`, care există deja pe
  391 de rânduri. `winterfell` are `region: "the_north"`, nu `parent_id: "the_north"`;
- **nu** e proximitate — `orasul_cartitei` e *lângă* `castle_black`, nu *în* el;
  `relatii.near` rămâne pentru asta;
- **nu** se poate popula din `relatii.part_of`, din motivul măsurat la §0, premisa 2.

**Blocaj real, descoperit la adnotare:** sub-locațiile Fortăreței Roșii nu au un părinte
la care să poată arăta. Există **cinci** rânduri concurente pentru Fortăreața Roșie
(`cetatea_rosie_fortareata_rosie`, `fortareata_rosie_debarcaderul_regelui`,
`fortareata_rosie_fortareata_lui_maegor`, `fortareata_rosie_implicit_...`,
`fortareata_rosie_turnul_mainii`), niciunul canonic. La fel, criptele Winterfellului au
trei rânduri, iar Driftmark are patru. **Popularea lui `parent_id` pentru hub-urile mari
este blocată de deduplicare și trebuie planificată după ea, nu odată cu ea.** În eșantion
aceste cazuri poartă câmpul `parent_pending` cu lista candidaților.

---

## 2. Unde ajunge `subtip` — contraargument la propunerea din sarcină

Propunerea din sarcină: `subtip` devine vocabular închis derivat, textul original se mută
în `subtip_descriere`.

**Sunt de acord cu structura, nu cu execuția.** Contrapropunerea:

> **`subtip` se îngheață și se marchează deprecat, exact așa cum este. Vocabularul închis
> derivat intră într-un câmp NOU, `subtype`. Nimic nu se rescrie.**

Trei argumente, în ordinea greutății:

**1. Redenumirea este o rescriere fără câștig.** `subtip` există pe 1041 de rânduri. Mutarea
textului în `subtip_descriere` atinge toate cele 1041 pentru a obține exact aceeași
informație sub alt nume. Un câmp nou `subtype` obține același rezultat printr-un diff pur
aditiv, care nu poate corupe nimic dacă e greșit — se recalculează.

**2. Refolosirea numelui `subtip` cu semantică nouă rupe consumatorii în tăcere.** Codul
care citește azi `subtip` (indexul de căutare, panoul de informații) ar continua să
compileze și să ruleze, dar cu conținut de alt fel. Asta e clasa de bug descrisă în §4.8
din `CLAUDE.md` — cod care există și se execută, dar nu cu datele pe care le crede. Un
câmp nou forțează consumatorii să fie actualizați explicit.

**3. Al doilea vocabular închis va deriva la fel ca primul, dacă rămâne câmpul în care
scrie extragerea.** Cele 573 de valori nu au apărut din neglijență, ci pentru că `subtip`
este ținta extragerii. Dacă `subtip` rămâne ținta *și* devine vocabular închis, presiunea
e aceeași. Separarea numelor separă și rolurile: `subtip` = ce a spus extragerea,
`subtype` = ce am decis noi.

### Forma propusă

```jsonc
{
  "subtip": "încăpere/balcon în interiorul fortăreței",  // NESCHIMBAT, deprecat
  "subtype": "castle",                                   // NOU, închis, sub-domeniu al `type`
  "subtype_source": "manual"                             // "subtip" | "manual" | "inferred"
}
```

`subtype` este **scopat sub `type`** — nu o listă globală. `type: structure` admite
`inn | brothel | temple | tower | bridge | mill | arena | guildhall | monument | fortification`;
`type: interior` admite `hall | chamber | crypt | courtyard | kitchen | stable | cellar | armoury`;
și așa mai departe. Estimare: 40–60 de valori în total, toate verificabile printr-o tabelă
`type → subtype[]`.

`subtype_source` există ca să poată fi auditată propria derivare: după P2.2 se poate
măsura exact câte rânduri au fost decise automat și câte manual.

**Nota importantă asupra derivării:** `subtip` **nu poate deriva `type` fără supraveghere**.
Dovada e în eșantion: `riverrun` are `subtip: "încăpere/balcon în interiorul fortăreței"`
și `pyke` are `subtip: "tron/scaun de conducere"`. Ambele sunt castele. Extragerea a pus
în `subtip` o sub-locație din entitate, nu entitatea. Orice pipeline care citește `subtip`
și scrie `type` va tipa Riverrun ca încăpere.

---

## 3. Provenanța se păstrează

`_afirmatii_pe_predicat.type` există pe 835 de rânduri și conține valoarea brută cu
`source_book` / `source_page` / `confidence`. Este sursa reală a lui `subtip`. Ea rămâne
neatinsă și devine dovada pentru orice `type` propus. Când `type` e decis manual împotriva
lui `subtip`, discrepanța e vizibilă și auditabilă.

---

## 4. Ape și regiuni — de ce o mare nu e un punct

### 4.1 Inventarul măsurat: 26 din 77 de pinuri nu sunt puncte

| categorie | n | ids | `type` curent |
|---|---|---|---|
| **ape** | 7 | `sea_of_dorne`, `the_bite`, `blackwater_bay`, `bay_of_ice`, `ironman_s_bay`, `bay_of_crabs`, `gods_eye` | toate `landmark` |
| **relief** | 4 | `rainwood`, `wolfswood`, `kingswood`, `mountains_of_the_moon` | toate `landmark` |
| **insule** | 8 | `tarth`, `stepstones`, `skagos`, `three_sisters`, `driftmark`, `claw_isle`, `naath`, `leng` | 4 `landmark`, **4 `castle`** |
| **regiuni** | 6 | `rills`, `lhazar`, `yi_ti`, `valyria`, `sothoryos_continent`, `ulthos_continent` | 4 `landmark`, **1 `castle`**, **1 `ruins`** |
| **liniar** | 1 | `the_wall` | `landmark` |

`yi_ti` este un imperiu desenat ca romb. `sothoryos_continent` și `ulthos_continent` sunt
continente desenate ca romburi. Aceasta este cea mai vizibilă eroare de scară din harta
actuală și nu se repară prin retipare singură — cere geometrie.

`red_watch` rămâne **nedecis**: `subtip: null`, `descriere_fizica: []`, sursa e doar un URL
extern. Nu îl clasific din memorie (§5.2 din `CLAUDE.md`); merge la triaj manual.

### 4.2 Unde stă geometria

Conform §4.1 din `CLAUDE.md`, `catalog.json` este registrul autoritar de coordonate.
Geometria aparține **acolo**, nu în `locations.json`. `data/` nu se dublează.

```jsonc
// data/map/catalog.json → maps.world
{
  "coordinates": { "kings_landing": { "x": 304.4, "y": 580.2 } },   // NESCHIMBAT
  "geometries": {                                                    // NOU
    "blackwater_bay":  { "kind": "polygon",  "points": [[..],[..]], "label_anchor": [..] },
    "the_wall":        { "kind": "polyline", "points": [[..],[..]] },
    "furca_rosie_a_tridentului": { "kind": "polyline", "points": [[..],[..]] }
  }
}
```

`coordinates` rămâne pentru puncte. `geometries` e pentru restul. O entitate poate avea
ambele: un poligon pentru contur și un `label_anchor` pentru unde se așază numele.

### 4.3 Regula de randare, legată de `type`

| `type` | cum se desenează | etichetă |
|---|---|---|
| `settlement`, `stronghold`, `structure`, `point_of_interest` | marker punctiform (comportamentul actual) | lângă marker |
| `water`, `landform`, `island`, `region` | umplere poligonală + contur, **fără marker** | în centroid, urmând scara |
| `watercourse`, `route` | polilinie | de-a lungul traseului |

### 4.4 Reparația imediată, fără digitizare

Digitizarea a 26 de poligoane e muncă manuală în editorul de calibrare. Până atunci:

> **O entitate cu `type ∈ {water, landform, island, region}` și fără intrare în
> `geometries` se randează ca ETICHETĂ, nu ca romb** — text așezat la coordonata
> existentă, folosită ca `label_anchor`.

Costă zero digitizare, folosește coordonatele care există deja, și scoate imediat 26 de
romburi greșite de pe hartă. Un nume de mare scris peste mare arată corect; un romb în
mijlocul mării nu arată corect niciodată.

---

## 5. Estimarea: câte din cele 708 devin `mappable`

### 5.1 De ce extrapolarea directă din eșantion este invalidă

Eșantionul e construit 20 / 20 / 20 prin cerință — deci nereprezentativ prin construcție.
Rata brută pe cele 45 de rânduri `type=location` din eșantion este 44 %, adică 315 din 708.
**Această cifră este o coincidență, nu un rezultat**: ar fi ieșit altfel dacă grupul „evident
mappable" avea 25 de rânduri în loc de 20.

Metoda corectă: **stratificare**. Cele 708 se împart în straturi prin reguli lexicale
prioritare peste `subtip + name` (prima potrivire câștigă), iar rata de mappable se ia din
eșantion acolo unde stratul are ≥ 3 rânduri adnotate, și din judecată acolo unde e subțire.

### 5.2 Rezultat

```
strat                 N(708)  n_eșant   rată      sursă   est
structure_building       158        5    20%   eșantion    32
stronghold                89        7    86%   eșantion    76
landform                  77        3    67%   eșantion    51
water                     66        2    75%   judecată    50
settlement                65        6    83%   eșantion    54
urban_feature             61        2     0%   judecată     0
interior                  43       13     0%   eșantion     0
region                    38        0    65%   judecată    25
island                    35        4   100%   eșantion    35
neclasificat              30        2    40%   judecată    12
route                     22        0    40%   judecată     9
unknown                   17        1     0%   judecată     0
event_place                7        0    55%   judecată     4
---
SUMA BRUTĂ (înainte de dedup): 347 (49% din 708)
rânduri type=location adnotate: 45; dintre ele marcate duplicat: 4 (9%)
SUMA DUPĂ SCĂDEREA DUPLICATELOR: 316
acoperire eșantion (N din strate cu >=3 rânduri adnotate): 467 / 708
```

### 5.3 Cifra pe care o susțin

**≈ 300 din 708 devin `mappable`, interval 290–320.**

Corecție aplicată față de cele 316: ratele pentru `stronghold` (86 %) și `island` (100 %)
sunt **optimist deplasate**, pentru că grupul „evident mappable" a fost ales prin construcție
să conțină cazuri curate din exact aceste straturi. Cu ratele de judecată mai conservatoare
(70 % și 80 %) suma brută scade la ~326, iar după dedup la **~296**.

### 5.4 Ce înseamnă practic

| | |
|---|---|
| pinuri azi | 77 |
| ar deveni mappable din cele 708 | ~300 |
| retipate din `landmark`/`castle`/`ruins` cu geometrie areală | 26 |
| **total entități care merită prezență pe hartă** | **~390** |
| dintre ele, cu geometrie deja calibrată | 77 |
| **coadă de calibrare manuală rezultată** | **~310** |

Restul de ~400 din cele 708 nu dispar: devin `interior`, `urban_feature` sau `non_place`
și trăiesc în wiki ca fii ai părinților lor. Sunt căutabile, sunt citabile, nu sunt pe hartă.

**Aceasta este exact evitarea capcanei din enunț:** nu tipăm mecanic cele 708 ca
`castle`/`landmark`. Aproximativ 43 % din ele sunt clasificate ca ne-mappable prin regulă
de tip, nu prin excepție — și de aceea harta nu se umple cu camere, alei și grajduri.

---

## 6. Eșantionul de referință

[`docs/taxonomie_esantion.json`](taxonomie_esantion.json) — 60 de rânduri, trei grupuri:

| grup | n | ce demonstrează |
|---|---|---|
| `evident_mappable` | 20 | cazurile în care regula lexicală chiar funcționează; include 3 pinuri actuale greșit-punctiforme |
| `sub_locatie_evidenta` | 20 | 14 sub-locații Winterfell + 6 King's Landing/Dragonstone; conține cele 3 rânduri duplicate ale criptelor |
| `ambiguu` | 20 | `subtip` care descrie altceva decât entitatea, erori de scară, grupuri de duplicate, rânduri compuse, `non_place` |

Fiecare rând poartă starea curentă verbatim (`type`, `subtip`, dacă are pin, coordonatele
de la rădăcină) lângă propunere (`type`, `subtype`, `mappable`, `parent_id`, `geometry`,
opțional `state`), plus o notă care spune **de ce**. Câmpurile `duplicate_of_probabil` și
`parent_pending` marchează ce nu poate decide taxonomia singură.

Fișierul a fost generat programatic din `data/`, cu validare la generare: fiecare `id` și
fiecare `parent_id` trebuie să rezolve, altfel generarea eșuează.

---

## 7. Ce trebuie decis înainte de P2.2

1. **Deduplicare înainte de `parent_id`.** Fortăreața Roșie are 5 rânduri, criptele
   Winterfellului 3, Driftmark 4. `parent_id` nu se poate popula pentru hub-uri până nu
   există un canonic. Ordinea corectă: dedup → `type`/`mappable` → `parent_id` → geometrie.

2. **Rânduri compuse.** `capatul_furtunii_si_piatra_dragonului` (2 castele),
   `selhorys_valysar_volon_therys` (3 orașe), `hanul_violet_hanul_tiparului_verde_...`
   (6 hanuri), `armuraria_si_camera_de_garda` (2 încăperi). Nu sunt tipabile — sunt
   despicabile sau retrase. Necesită decizie separată.

3. **`non_place` rămâne în `locations.json` sau se mută?** §5.4 interzice ștergerea.
   Recomandarea mea: rămâne pe loc cu `type: non_place`, iar `DataManager` nu îl încarcă
   în stratul de locații. Mutarea într-un fișier nou e o migrare de date; marcarea nu e.

4. **Cine scrie `mappable`?** Recomandare: derivat la ETL din `type` + `parent_id` pentru
   cazurile cu regulă absolută, manual doar pentru restul, cu un test de build care
   verifică invariantul din §1.2.
