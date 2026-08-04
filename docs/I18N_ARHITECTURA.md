# Arhitectura suportului bilingv RO / EN

> Document de proiectare. Nu conține cod și nu autorizează nicio modificare în `data/`.
> Toate cifrele din §1 sunt măsurate pe arborele de lucru la **2026-08-03**, cu scripturile
> din §12. Nicio cifră nu este preluată din `CLAUDE.md` §3 fără re-măsurare — vezi §11
> pentru cele care s-au dovedit depășite.

---

## 0. Rezumatul deciziilor

| # | Decizie | Motiv scurt |
|---|---|---|
| D1 | Trei straturi, trei mecanisme diferite: dicționar (L1), câmpuri per-limbă (L2), marcaj de limbă fără traducere (L3) | Un singur mecanism ar costa ~407.000 de cuvinte de traducere pentru un câștig marginal |
| D2 | `name` rămâne pe disc neatins; se adaugă `name_ro` / `name_en`; la încărcare `name` devine câmp derivat, dar valoarea brută se păstrează în `name_source` | Codul existent citește `entity.name` și se localizează gratuit, fără ca șirul cu proveniență să dispară din runtime |
| D3 | Fallback = **șirul verbatim din cealaltă limbă, cu badge de limbă**. Fără transliterare, fără traducere automată | Orice altceva inventează canon (`CLAUDE.md` §5.2) și rupe potrivirea cu ediția tipărită pe care o are cititorul |
| D4 | `events.name` **nu** intră în L2. Este propoziție generată, nu titlu (1222/1682 au `nume_generat: true`) | `name_en` pentru „14 frați ai Rondului de Noapte plănuiesc" nu este traducere de nume, e traducere de narațiune |
| D5 | Indexul de căutare rămâne unic și independent de limbă, plus pliere de diacritice obligatorie | 2282 din 5298 de entități au nume care nu se pot tasta pe o tastatură EN |
| D6 | Panoul de filtre nu se poate internaționaliza înainte de finalizarea migrării `subtip` → `subtype` | Etichetele sunt construite din date libere: 320 de checkbox-uri, 233 cu diacritice |
| D7 | Cele 15 variante de `source_book` se normalizează la 7 cărți; titlurile bilingve sunt un tabel de 7 intrări | 66.000 de referințe de proveniență devin bilingve pentru 14 șiruri |

---

## 1. Premisele verificate

### 1.1 Numele de entități — clasificare pe limbă

Testul diacriticelor **subestimează masiv** româna. „Debarcaderul Regelui", „Casa Barbă-Roșie",
„Aleea Noroioasă" au diacritice, dar „Adăpostul Pietruit" fără diacritice, „Bătrânul Flint",
„Aegon al III-lea", „Casele Slate, Long, Holt, Ashwood" nu. Clasificarea de mai jos combină
diacriticele cu morfologia articolului hotărât (`-ul`, `-ului`, `-ilor`, `-ele`, `-elor`) și
cuvintele de legătură.

| Colecție | n | `ro` | `en` | `mixed` | `neutral` |
|---|---:|---:|---:|---:|---:|
| locations (incl. free_cities + far_lands) | 1099 | 589 | 101 | 17 | 392 |
| characters | 2288 | 839 | 7 | 11 | 1431 |
| houses | 229 | 3 | 126 | 0 | 100 |
| events | 1682 | 1588 | 20 | 30 | 44 |
| objects | 276 | 238 | 1 | 2 | 35 |
| titles | 94 | 80 | 0 | 4 | 10 |
| **total** | **5668** | **3337** | **255** | **64** | **2012** |

`neutral` = substantiv propriu identic în ambele limbi: `Winterfell`, `Casterly Rock`,
`Arya Stark`, `Casa Blackfyre`. **Aceste 2012 de intrări nu au nevoie de traducere.**
Este cea mai importantă cifră a documentului: 36% din problemă nu există.

`mixed` = numele conține deja ambele limbi în același șir:
`"Braț(ul) Rupt de Dorne (Arm of Dorne)"`, `"Aegon cel Nesigur (Aegon the Unlikely)"`,
`"Titlul „Păzitorul Nordului" (Warden of the North)"`.

### 1.2 Numele **au deja** o sursă parțială pentru cealaltă limbă

Trei surse exploatabile, măsurate:

| Sursă | Volum | Exemplu |
|---|---:|---|
| `id` (englezesc) vs `id_intern` (românesc) diferă | 171 locații (19% din cele 887 cu `id_intern`) | `id=castle_black` ⇄ `id_intern=LOCATION_CASTELUL_NEGRU` |
| Paranteză finală în `name` | 59 loc. + 383 pers. + 44 obj. + 10 titluri = **496** | `"Aducătoarea Luminii (Lightbringer)"` |
| Alias în cealaltă limbă | 63 locații + 5 case | `"The Eyrie"` ⇄ `"Cerul"`; `"Arborul"` ⇄ `"The Arbor"` |

Concluzie operațională: **~400–500 de perechi RO↔EN pot fi extrase mecanic** și trimise la
triaj în loc să fie scrise de la zero. Nu pot fi acceptate automat — `id_intern` e
majusculat și fără diacritice (`CAPATUL_FURTUNII` → `Capătul Furtunii`), iar parantezele
conțin uneori altceva decât traducerea (`"Aegon Blackfyre (fiul lui Daemon, geamăn întâi-născut)"`).

### 1.3 `aliasuri` este parțial corupt și nu poate fi folosit ca sursă fără reparație

495 valori la locații, 365 la personaje, 35 la case = **895 de valori**.
**23 au paranteze dezechilibrate** — urmă clară de o despărțire pe virgulă aplicată peste
un șir care conținea virgule în interiorul parantezelor:

```
kings_landing.aliasuri = [
  "Debarcaderul Regelui (malul apei",   ← rupt
  "Fortăreața Roșie (King's Landing",   ← rupt
  "Red Keep)",                          ← rupt
  "cheiul)",                            ← rupt
  ...
]
```

Aceste 23 de valori **nu se clasifică pe limbă și nu se importă**; se marchează
`aliases_unclassified` și merg la triaj manual. Restul de 872 se pot clasifica automat.

### 1.4 Conținutul narativ — volumul real

Numai proză (exclus id-uri, titluri de carte, pagini, nume de predicat):

| Câmp | Fragmente | Caractere |
|---|---:|---:|
| `locations._afirmatii_pe_predicat[].valoare` | 13.608 | 636.548 |
| `characters._afirmatii_pe_predicat[].valoare` | 13.556 | 442.711 |
| `events._afirmatii_pe_predicat[].valoare` | 9.870 | 514.247 |
| `locations.evenimente[]` | 1.987 | 224.871 |
| `houses._afirmatii_pe_predicat[].valoare` | 5.315 | 182.883 |
| `timeline[].event` (case + personaje) | 1.562 | 106.889 |
| `locations.descriere_fizica[]` | 1.474 | 105.583 |
| `locations._afirmatii[].distance_value` | 1.418 | 81.186 |
| `objects.descrieri[]` | 336 | 36.409 |
| `distances.context` / `.distance_value` / `.travel_method` | 461 / 467 / 440 | 68.302 |
| `events._afirmatii[].role` | 946 | 25.195 |
| `titles.descrieri[]` | 79 | 8.268 |
| `characters.description` | 34 | 4.970 |
| `events.description` / `.outcome` | 20 / 20 | 4.509 |
| **TOTAL** | **51.615** | **2.443.462 (~407.000 cuvinte)** |

Pentru scară: cele cinci romane ASOIAF publicate au împreună ~1,77 milioane de cuvinte.
**Traducerea L3 ar fi de ordinul unui sfert dintr-o serie de romane.** Decizia D1 nu este
o preferință, este singura opțiune.

### 1.5 Stringurile de interfață

Extrase doar șirurile care **ajung efectiv în DOM** — noduri de text din template-uri,
`textContent` / `innerText`, atribute `title` / `placeholder` / `aria-label`, argumentul 3 al
lui `createElement(tag, class, text)` (`js/utils/helpers.js:20`) și primul argument al
helperelor `createMetaRow*` / `createDivider` etc.

| Zonă | Unice | RO | EN |
|---|---:|---:|---:|
| `js/` + `index.html` (aplicația) | **78** | 9 | 69 |
| `admin/map-editor.*` (unealtă internă) | 43 | 30 | 13 |

Distribuția în aplicație: `InfoPanel.js` 39, `DistanceTool.js` 13, `WikiPage.js` 8,
`Toolbar.js` 7, `FilterPanel.js` 3, `Timeline.js` 3, `SearchBar.js` 2, `index.html` 2, restul 1.

Amestecul este confirmat și localizat exact:

```
EN  js/ui/DistanceTool.js:23   "Distance Measurements"
RO  js/ui/DistanceTool.js:180  "Fără mențiuni de distanță narativă extrasă din text pentru această pereche."
EN  js/ui/DistanceTool.js:208  "Mijloc:"          ← etichetă RO clasificată EN: nu are diacritice
RO  js/ui/DistanceTool.js:209  "Direcție:"
EN  js/ui/InfoPanel.js:374     "Chronicle Record"
RO  js/ui/InfoPanel.js:397     "⬜ Lipsă sursă descriere istorică"
RO  js/ui/InfoPanel.js:367     "Vezi pagina completă →"
EN  js/ui/InfoPanel.js:429     "Historical Ledger"
```

Două secțiuni adiacente din același panou, `InfoPanel.js:374` și `:397`, sunt în limbi diferite.

### 1.6 Vocabularele închise care ajung în UI

| Vocabular | Valori distincte | Observație |
|---|---:|---|
| `locations.type` | 19 | id-uri EN, stabile |
| `locations.subtype` (taxonomia nouă) | 29 | id-uri EN, stabile |
| `locations.subtip` (text liber, vechi) | **572** (497 apar o singură dată, 424 cu diacritice) | nu e taxonomie |
| `region` (locații + case) | 12 (uniune) | id-uri EN |
| `confidence` / `canon` | 5 | `canon`, `confirmed`, `probable`, `unknown`, `uncertain` |
| chei de predicat în `_afirmatii_pe_predicat` | 42 | id-uri EN |
| `tags` | 19 | se suprapun cu region + type |
| `source_book` | **15 variante → 7 cărți** | vezi §1.7 |
| `distances.travel_method` | 257 (230 apar o dată, 174 cu diacritice) | text liber, RO |
| `objects.categorie` | 57 (38 apar o dată) | text liber, RO |
| `titles.categorie` | 11 | text liber, RO |

### 1.7 `source_book` — 15 variante pentru 7 cărți

```
"Dansul Dragonilor" 9003 / "Dansul dragonilor" 3038          → A Dance with Dragons
"Iureșul Săbiilor" 7727 / "Iureșul săbiilor" 3370            → A Storm of Swords
"Festinul Ciorilor" 6280 / "Festinul ciorilor" 1718          → A Feast for Crows
"Foc și Sânge" 6099 / "Focul și sângele" 4219                → Fire & Blood
"Urzeala Tronurilor" 4755 / "Urzeala tronurilor" 1461        → A Game of Thrones
"Înclestarea Regilor" 4236 / "Încleștarea Regilor" 2631
  / "Încleștarea regilor" 2432                               → A Clash of Kings
"Cavalerul celor 7 Regate" 1489
  / "Cavalerul celor Șapte Regate" 1437                      → A Knight of the Seven Kingdoms
```

Notă: `"Înclestarea Regilor"` (4236 apariții, cea mai frecventă variantă) are `s` în loc de `ș` —
greșeală de tastare propagată. Normalizarea este necesară independent de i18n.

**14 șiruri** (7 chei × 2 limbi) fac bilingve ~66.000 de referințe de proveniență.
Este cel mai bun raport efort/efect din tot proiectul.

---

## 2. Cele trei straturi

```
┌─ L1 · CROM DE INTERFAȚĂ ────────────────────────────────────────────────┐
│  Ce:      butoane, etichete, titluri de secțiune, mesaje de gol/eroare,  │
│           tooltip-uri, vocabulare închise (type, region, confidence,     │
│           predicate, titluri de carte)                                   │
│  Sursă:   scris de dezvoltator, nu extras din cărți                      │
│  Strategie: dicționar complet, ambele limbi, cheie stabilă               │
│  Regulă:  100% acoperire obligatorie. Nu există fallback vizibil.        │
│  Volum:   ~220 chei                                                      │
├─ L2 · NUME DE ENTITĂȚI ─────────────────────────────────────────────────┤
│  Ce:      nume proprii de locuri, personaje, case, obiecte, titluri,     │
│           dragoni + aliasurile lor                                       │
│  Sursă:   extras din traduceri, cu proveniență la nivel de pagină        │
│  Strategie: câmpuri paralele name_ro / name_en, câmp derivat la încărcare│
│  Regulă:  acoperire parțială acceptată; lipsa → cealaltă limbă + badge   │
│  Volum:   3989 sloturi, 2052 celule de completat, 2012 nu au nevoie      │
├─ L3 · CONȚINUT NARATIV ─────────────────────────────────────────────────┤
│  Ce:      descrieri, afirmații pe predicat, context de distanță,         │
│           evenimente narative, citate, note de sursă                     │
│  Sursă:   text din traducerea românească a cărților                      │
│  Strategie: NU se traduce. Se etichetează cu limba și se afișează ca     │
│           citat, cu badge și cu proveniența deja existentă               │
│  Regulă:  fragmentul nu se ascunde niciodată pentru că e „în altă limbă" │
│  Volum:   51.615 fragmente, ~407.000 cuvinte → 0 traduse                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Testul de apartenență

Când nu e clar în ce strat intră un șir, se aplică în ordine:

1. **A fost scris de un dezvoltator, nu extras dintr-o carte?** → L1.
2. **Este un nume propriu, adică răspunde la „cum se numește?"** → L2.
3. **Altfel** → L3.

Aplicat pe cazurile ambigue reale din date:

| Șir | Strat | De ce |
|---|---|---|
| `"Chronicle Record"` (`InfoPanel.js:374`) | L1 | titlu de secțiune scris de dezvoltator |
| `"Debarcaderul Regelui"` | L2 | nume propriu |
| `"castel mohorât, ziduri de granit, Marea Sală cu flamuri"` | L3 | descriere extrasă |
| `"castel"` (`subtip`) | L1 după migrare | vocabular închis de 29 de valori — vezi §3.3 |
| `"încăpere/balcon în interiorul fortăreței"` (`subtip`) | L3 azi | text liber, apare o singură dată |
| `"Urzeala Tronurilor"` (`source_book`) | L1 | tabel de 7 intrări, titlu publicat oficial în ambele limbi |
| `"nespecificată numeric, dar sugerată ca fiind de mai multe zile de călărie"` | L3 | frază extrasă |
| `"călare / pasăre mesageră"` (`travel_method`) | L3 azi, L1 după normalizare | 257 valori libere azi; ~15 după normalizare |
| `"14 frați ai Rondului de Noapte plănuiesc"` (`events.name`) | L3 | propoziție generată, nu titlu — vezi §4.5 |
| `"Battle of Gulltown"` (`events.name`) | L2 | titlu real, `nume_generat: false` |

---

## 3. L1 — cromul de interfață

### 3.1 Structura dicționarului

Chei plate, cu punct, grupate pe componentă. Fără ICU, fără pluralizare complexă, fără
dependențe noi (`CLAUDE.md` §8).

```jsonc
// i18n/ro.json
{
  "app.title":                  "Atlasul Westerosului",
  "app.loading":                "Se dezvăluie analele celor Șapte Regate...",
  "app.loadError":              "Eroare la încărcare: {message}",

  "toolbar.dayNight":           "Comută zi / noapte",
  "toolbar.season":             "Comută anotimpul (vară / iarnă)",
  "toolbar.filters":            "Comută filtrele hărții",
  "toolbar.distance":           "Calculator de distanțe",
  "toolbar.reset":              "Resetează vederea hărții",

  "info.section.chronicle":     "Cronică",
  "info.section.ledger":        "Registru istoric",
  "info.gap.description":       "⬜ Lipsă sursă descriere istorică",
  "info.meta.ruler":            "Conducător / Lord",
  "info.meta.region":           "Regiune",

  "distance.title":             "Măsurători de distanță",
  "distance.pickFirst":         "Alege prima locație...",
  "distance.pickSecond":        "De la {from}. Alege destinația...",
  "distance.noNarrative":       "Fără mențiuni de distanță narativă extrasă din text pentru această pereche.",

  "filter.title":               "Filtrele hărții",
  "filter.locationType":        "Tip locație",

  "search.placeholder":         "Caută Winterfell, Cuibul Vulturilor...",
  "search.foundAs":             "găsit ca: {term}",
  "search.empty":               "Nicio locație găsită",

  "era.before":                 "î.C.",       // Before Conquest
  "era.after":                  "d.C.",       // After Conquest

  "lang.badge.ro":              "RO",
  "lang.badge.en":              "EN",
  "lang.untranslated.tooltip":  "Fragment din traducerea românească, netradus. Sursă: {book}, p. {page}",

  "vocab.type.castle":          "castel",
  "vocab.type.settlement":      "așezare",
  "vocab.region.the_north":     "Nordul",
  "vocab.region.the_reach":     "Podișul",
  "vocab.confidence.canon":     "canon",
  "vocab.confidence.probable":  "probabil",
  "vocab.predicate.builder":    "constructor",
  "vocab.book.agot":            "Urzeala Tronurilor",
  "vocab.book.acok":            "Încleștarea Regilor"
}
```

`i18n/en.json` are exact aceleași chei. **Setul de chei este identic prin construcție** —
vezi asertarea din §9.

### 3.2 Regula de fallback la L1

```
t(key, lang)  →  dicționar[lang][key]
              →  dicționar['ro'][key]      + console.warn o singură dată per cheie
              →  key                        + console.warn
```

Româna este limba-sursă a proiectului, deci ea este plasa de siguranță. Un `t()` care
returnează cheia goală (`"filter.title"`) în interfață este un defect vizibil, ceea ce este
intenția: L1 nu are voie să fie incomplet.

**Interzis:** fallback tăcut. Fiecare cheie lipsă se raportează o dată în consolă și se
numără; testul de fum eșuează dacă numărul e diferit de zero.

### 3.3 Panoul de filtre — dependență blocantă

`js/ui/FilterPanel.js:100` construiește eticheta fiecărui checkbox direct din date:

```js
const label = createElement('span', '', `${subtype} (${count})`);
```

unde `subtype` vine din `getLocationSubtype()` (`js/utils/locationSubtypes.js:17`), adică din
câmpul `subtip` — text liber românesc.

Măsurat pe arborele de lucru curent: **320 de checkbox-uri**, dintre care **233 cu diacritice
românești**, incluzând etichete de tipul `"încăpere/balcon în interiorul fortăreței"` și
`"castel (pereche de turnuri-gemene, pe ambele maluri ale unui râu)"`.

Consecință: **panoul de filtre nu se poate internaționaliza ca L1 în forma actuală.**
Nu pentru că i-ar lipsi traducerile, ci pentru că etichetele lui nu sunt chei — sunt date.

Migrarea `subtip` → `subtype` aflată în lucru (câmpurile `subtype`, `mappable`,
`classification_confidence` există deja în arborele de lucru, cu 29 de valori distincte)
transformă costul de i18n al panoului **din 320 de etichete imposibile în 29 de chei banale**.

**Panoul de filtre se internaționalizează după migrarea taxonomiei, nu înainte.**
Aceeași observație pentru `travel_method` (257 → ~15) și `objects.categorie` (57 → ~10).

### 3.4 `admin/`

`admin/map-editor.*` are 43 de șiruri, 30 românești. Este o unealtă internă de calibrare, cu
un singur utilizator. **Rămâne monolingv românesc, în afara scopului.** Se marchează ca atare
în cod pentru ca un audit viitor să nu-l raporteze ca regresie.

---

## 4. L2 — numele de entități

### 4.1 Schema propusă

Recomandarea de pornire din sarcină era:

```
name_en, name_ro, name        (name = câmp derivat, calculat la încărcare)
aliases_en[], aliases_ro[]
```

O păstrez în esență. Contrazic patru puncte.

#### Contra-punct 1 — `name` derivat pierde șirul brut din runtime

Dacă `DataManager` suprascrie `name` la încărcare, valoarea originală extrasă din carte
dispare din memorie. Este exact șirul cu proveniență, cel care justifică proiectul. Fără el
nu se mai poate depana de ce un nume s-a rezolvat greșit, iar `SearchEngine.extractSearchTerms`
(`SearchEngine.js:152`) ar indexa forma derivată în loc de cea brută.

**Propunere:** `DataManager` face derivarea, dar mută originalul, nu îl aruncă:

```js
// pseudocod, la încărcare — nu se implementează în această etapă
entity.name_source = entity.name;              // șirul brut, exact ca pe disc
entity.name        = resolveName(entity, lang); // câmp derivat, ce citește UI-ul
entity.name_lang   = 'ro' | 'en' | 'neutral' | 'fallback';
```

Pe disc `name` rămâne **neatins și înghețat** (`CLAUDE.md` §5.4). Câștigul propunerii
originale — codul existent se localizează gratuit — se păstrează integral.

#### Contra-punct 2 — `objects` și `titles` folosesc `nume`, nu `name`

Măsurat: `objects.json` (276) și `titles.json` (94) au câmpul `nume`, nu `name`. Ambele au
peste 70% conținut românesc. `SearchEngine.js:109` și `:125` maschează deja diferența cu
`obj.name || obj.nume || obj.id`.

Schema L2 trebuie să adauge `name_ro` / `name_en` **cu aceleași denumiri de câmp în toate
colecțiile** (`CLAUDE.md` §8: nume de câmpuri în engleză), iar `nume` rămâne înghețat lângă
ele. Efect secundar util: la a doua apariție a `|| obj.nume ||` se poate extrage rezolvarea
într-un singur loc.

#### Contra-punct 3 — lipsește marcajul de proveniență al traducerii

Din cele 1783 de nume EN care trebuie scrise, ~400 pot fi propuse mecanic (§1.2), din surse
de calitate foarte diferită: un slug de `id` nu este echivalent cu o traducere verificată în
carte. Fără marcaj, peste trei luni nimeni nu mai poate deosebi `"Storm's End"` derivat din
`id=storm_end` de `"Storm's End"` citit la pagina 412.

**Propunere:** un bloc compact, alături de câmpuri, nu în locul lor:

```jsonc
"_i18n": {
  "name": {
    "ro": { "status": "verified", "source": "book" },
    "en": { "status": "seeded",   "source": "id_slug" }
  }
}
```

`status` ∈ `verified` | `seeded` | `absent`.
`source` ∈ `book` | `id_slug` | `parenthetical` | `alias` | `manual`.

Doar `status: "verified"` se afișează fără badge de avertizare. Reutilizează exact idiomul
de încredere pe care aplicația îl are deja (`canon-badge`, `InfoPanel.js:279`).

#### Contra-punct 4 — aliasurile au nevoie de o a treia găleată

23 din 895 de valori sunt rupte sintactic (§1.3) și nu se pot clasifica. Nu au voie să fie
nici aruncate, nici puse arbitrar într-o limbă.

```
aliases_ro[]            — clasificate română
aliases_en[]            — clasificate engleză
aliases_unclassified[]  — neutre + cele 23 deteriorate; intră în index, nu în afișare
```

`aliasuri` rămâne înghețat pe disc ca sursă.

#### Schema finală

```jsonc
{
  "id": "kings_landing",

  // ── înghețate, sursa de proveniență, nu se modifică niciodată ──
  "name":     "King's Landing (Aegonfort)",   // pe disc: brut. în runtime: derivat (vezi mai jos)
  "aliasuri": ["Debarcaderul Regelui", "Red Keep", "..."],
  "id_intern": ["LOCATION_DEBARCADERUL_REGELUI", "..."],

  // ── noi ──
  "name_ro": "Debarcaderul Regelui",
  "name_en": "King's Landing",
  "aliases_ro": ["Fortăreața Roșie", "Fortăreața lui Aegon"],
  "aliases_en": ["Red Keep", "Aegonfort"],
  "aliases_unclassified": ["cheiul", "orașul"],

  "_i18n": {
    "name": {
      "ro": { "status": "verified", "source": "book" },
      "en": { "status": "verified", "source": "book" }
    }
  }
}

// derivat la încărcare, niciodată scris pe disc:
//   name_source = "King's Landing (Aegonfort)"
//   name        = "King's Landing"   (lang = en)
//   name_lang   = "en"
```

### 4.2 Regula de fallback — aleasă și justificată

Sarcina cere o alegere explicită între „afișează cealaltă limbă cu marcaj" și „afișează
transliterarea". **Aleg prima. Fără rezerve.**

```
resolveName(entity, lang):
  1. entity[`name_${lang}`]            → afișează curat, fără badge
  2. entity.name_source este `neutral` → afișează curat, fără badge      (2012 cazuri)
  3. entity[`name_${otherLang}`]       → afișează + badge limbii sursă
  4. entity.name_source (brut)         → afișează + badge „?"
  5. entity.id                         → afișează + badge „?"            (niciodată gol)
```

**De ce nu transliterarea.** Trei motive, în ordinea greutății:

1. **Ar inventa canon.** `CLAUDE.md` §5.2 și §5.3 interzic explicit inventarea de fapte și
   traducerea automată a numelor proprii de univers. „Debarcaderul Regelui" transliterat
   mecanic nu dă „King's Landing" — dă un șir care nu apare în nicio ediție a cărții. Un
   nume inventat într-un proiect care își justifică existența prin proveniență la nivel de
   pagină este o regresie, nu o îmbunătățire.
2. **Ar strica singurul lucru pe care fallback-ul îl poate garanta: utilitatea.** Un cititor
   pe interfața EN care vede badge-ul `RO` și textul „Debarcaderul Regelui" poate căuta
   exact acel șir în ediția românească pe care o are pe raft. Un transliterat inventat nu
   se potrivește cu nimic, în nicio ediție.
3. **Ar ascunde golul.** Badge-ul `RO` pe interfața EN este o unitate de măsură: numărul de
   badge-uri vizibile este progresul traducerii. Transliterarea ar face lucrarea să pară
   terminată exact acolo unde nu a început.

**Interzis:** ascunderea entităților fără nume în limba curentă. Un filtru pe limbă ar
elimina 1749 de locații și personaje din interfața EN. Aceasta este regula fermă a stratului.

### 4.2.1 Excepții de la scară

Scara are o singură premisă: că `name_ro` și `name_en` ale aceleiași înregistrări
denumesc **același loc**. Când premisa nu ține, pasul 1 devine cel mai prost pas
posibil — este singurul care afișează un nume greșit *fără* niciun marcaj.

Până la această fază scara nu avea nicio excepție; secțiunea se deschide aici.

#### Excepția 1 — `name_review_status: "contested"`

**Măsurat** (`node scripts/report_bilingual_name_conflicts.mjs`, 2026-08-04, pe
`data/locations/locations.json` — 1041 înregistrări): 56 de locații au și `name_ro`,
și `name_en`. **16 dintre perechi nu sunt confirmate ca denumind același loc.**

| id | `name_ro` | `name_en` | ce se ciocnește |
|---|---|---|---|
| `kings_landing` | Fortăreața Roșie | King's Landing (Aegonfort) | „Fortăreața Roșie" e nume principal la 6 alte înregistrări |
| `white_harbor_city` | Gâtul | White Harbor | „Gâtul" e nume principal la `gatul` |
| `white_harbor` | Portul Alb | New Keep (White Harbor) | „White Harbor" e nume principal la `white_harbor_city` |
| `fundatura_puricilor` | Fundătura Puricilor | King's Landing | „King's Landing" e nume principal la `kings_landing` |
| `strada_otelului` | Strada Oțelului | King's Landing | idem |
| `the_eyrie` | Ținutul Eyrie | The Eyrie | fără urmă structurală; din auditul CRITICAL-1 |
| `casa_celor_nemuritori` | Casa Celor Nemuritori | House of Dust | idem |
| `garda_apei_cenusii` | Garda Apei Cenușii | Stone Door | idem |

Cauza este în **date** — despărțirea numelor din P3.2 —, nu în `resolveName()`.
Reparația numelor este triaj manual (`admin/triage.html`, sursa `contested_name`).
Ce se repară în cod este numai **comportamentul de afișare până atunci**:

```
resolveName(entity, lang):
  0. entity.name_review_status === 'contested'  →  sari direct la pasul 4
  1. entity[`name_${lang}`]                     →  curat, fără badge
  ...
```

Pașii 1, 2 și 3 se sar toți trei, nu doar pasul 1: pasul 3 citește `name_${otherLang}`,
adică exact celălalt capăt al aceleiași perechi contestate, iar pasul 2 se referă la
`name` brut, unde ajunge oricum pasul 4 — cu deosebirea că pasul 4 pune badge-ul de
limbă, iar pasul 2 nu.

**De ce numele brut.** `name` este șirul extras din carte, cu proveniență la nivel de
pagină. Nu este tradus, deci nu poate fi tradus *greșit*. Pe interfața RO,
`kings_landing` afișează azi „King's Landing (Aegonfort)" cu badge `EN` în loc de
„Fortăreața Roșie" fără niciun badge. Primul spune cititorului adevărul și îi arată
că traducerea lipsește; al doilea îi spunea o informație de canon falsă, prezentată ca
fapt — exact ce interzice `CLAUDE.md` §5.2.

**Costul, măsurat:** 6 din cele 16 perechi (`fortareata_lui_maegor`, `gatul`,
`insula_cedrilor`, `marea_fumeganda`, `muscatura`, `turnul_mainii`) se ciocnesc cu o
înregistrare care este **duplicatul aceluiași loc**, nu un loc diferit — la ele
traducerea era bună, iar interfața EN pierde temporar numele englezesc. Criteriul de
coliziune nu poate distinge structural cazul (`white_harbor_city` are exact aceeași
formă și este greșit), deci alegerea este între a le trimite la triaj și a lăsa 10
nume greșite pe hartă. Merg la triaj.

Statusul se închide singur: acțiunea `set_names` din triaj îl coboară la `"reviewed"`
(`triage.py:_apply_set_names`), iar `contested` este singura valoare pe care
`resolveName()` o ocolește. `name_review_status` și `name_review` se **adaugă** lângă
`name_ro` / `name_en`, care rămân neatinse (`CLAUDE.md` §5.4).

### 4.3 Badge-ul de limbă

Un singur mecanism vizual, folosit identic la L2 și L3:

```
[RO] Debarcaderul Regelui
 └── chip de 2 litere, dimensiune 0.65rem, aceleași tokenuri de culoare ca `canon-badge`
     title = t('lang.untranslated.tooltip', { book, page })
```

Se afișează **numai când limba fragmentului diferă de limba interfeței**. Pe interfața RO,
un utilizator român nu vede niciun badge pe cele 3337 de nume românești — vede badge `EN` pe
cele 255 englezești. Simetric și fără costuri suplimentare.

### 4.4 Case — cazul special `"Casa X"`

100 din 229 de case sunt clasificate `neutral` pentru că poartă deja forma `"Casa Blackfyre"`,
`"Casa Baelish"` — românește articulat, cu nume propriu netradus. Alte 126 sunt `"House
Targaryen"`, `"House Stark"`. **Aceeași colecție folosește ambele convenții.**

Aici traducerea este pur mecanică și sigură: `House {X}` ⇄ `Casa {X}`, cu `{X}` netradus.
Se generează programatic pentru toate cele 226 de case care se potrivesc tiparului, cu
`source: "manual"` degradat la `"seeded"`, și se verifică prin eșantion. Cele 3 rămase
(`"Casa Barbă-Roșie"`, `"Casele Slate, Long, Holt, Ashwood"`, `"Casa Dalt (de la Lemonwood)"`)
merg la triaj.

### 4.5 Evenimente — nu intră în L2

Sarcina le tratează la un loc cu numele de entități. Măsurătoarea contrazice asta:

- **1222 din 1682** au `nume_generat: true` — numele este generat de conducta de extragere.
- **1128 (67%)** au numele mai lung de 6 cuvinte.
- **248** încep cu literă mică.

Exemple reale: `"14 frați ai Rondului de Noapte plănuiesc"`, `"A căzut de pe un pod din Pyke"`,
`"3 corăbii capturate (galion, galeră de negoț, ketch"` (trunchiat în date).

Acestea nu sunt nume. Sunt rezumate narative folosite ca etichetă. `name_en` pentru ele
înseamnă traducere de narațiune, adică L3, adică ~69.000 de caractere pe care D1 le exclude.

**Propunere:**
- `events.name` primește `name_lang` (etichetă de limbă) și se afișează cu badge, ca L3.
- Cele 20 de evenimente cu `nume_generat: false` și nume scurt englezesc
  (`"Battle of Gulltown"`, `"The Field of Fire"`, `"The Last Storm"`) primesc
  `title_ro` / `title_en` opționale — 40 de celule, nu 3364.

Aceasta este singura abatere de fond de la structura cerută în sarcină. O semnalez explicit
pentru că schimbă efortul L2 cu −40%.

---

## 5. L3 — conținutul narativ

### 5.1 Principiu

**Nu se traduce. Nu se ascunde. Se marchează.**

Un fragment narativ este un citat cu proveniență la nivel de pagină. Tradus automat, își
pierde exact proprietatea care îl face valoros. Ascuns pe interfața EN, golește aplicația:
488 de locații au `descriere_fizica`, 461 de perechi au `context` de distanță — toate
românești.

### 5.2 Afișarea

```
┌────────────────────────────────────────────────────────────────┐
│ Physical description                             [RO]  ⓘ       │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ castel mohorât, ziduri de granit, Marea Sală cu flamuri,   │ │
│ │ criptă subterană cu morminte                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│ Urzeala Tronurilor, p. 24                                      │
└────────────────────────────────────────────────────────────────┘
```

Elementele, în ordinea importanței:

1. **Antetul secțiunii este L1** — se traduce integral. Cititorul EN înțelege *ce* citește
   chiar dacă nu înțelege textul.
2. **Badge `RO` la nivel de secțiune**, nu per propoziție. La 13.608 fragmente pe locații,
   un badge per fragment ar fi zgomot. Badge per secțiune, cu tooltip.
3. **Corpul citatului este vizual distinct** — chenar stânga, serif italic (aplicația are
   deja `.chronicle-text`), pentru că este citat, nu proză a aplicației.
4. **Proveniența este deja în date și devine bilingvă gratuit** prin tabelul de 7 cărți
   din §1.7. `"Urzeala Tronurilor, p. 24"` / `"A Game of Thrones, p. 24"`.
   Numărul paginii se referă la ediția românească — se marchează în tooltip; nu se inventează
   echivalentul din ediția engleză.

### 5.3 Eticheta de limbă a fragmentelor

Detectarea limbii este mecanică și nu necesită traducător: diacritice + morfologie +
cuvinte de legătură, exact clasificatorul din §1.1. Rezultatul se scrie **o singură dată**,
la nivel de secțiune, nu de fragment:

```jsonc
"_i18n": {
  "descriere_fizica": { "lang": "ro", "detected": true },
  "evenimente":       { "lang": "ro", "detected": true }
}
```

`detected: true` marchează originea automată. Un triaj ulterior poate suprascrie cu
`detected: false`. Nu se rescrie niciun text.

### 5.4 Ce se poate totuși traduce în L3, ieftin

Trei sub-mulțimi mici, unde traducerea este utilă și sigură:

| Sub-mulțime | Volum | De ce merită |
|---|---:|---|
| `characters.description` | 34 | sunt deja în engleză; au nevoie de versiunea RO |
| `events.description` + `.outcome` | 40 | idem, deja engleze |
| `dragons.description` | 3 | idem |

**77 de fragmente**, deja englezești, care lipsesc din română. Este singurul conținut narativ
propus pentru traducere, și merge în direcția inversă celei presupuse de sarcină.

---

## 6. Mecanismul runtime

### 6.1 Structura de fișiere

```
i18n/
  ro.json                   dicționarul L1, limba-sursă
  en.json                   dicționarul L1, aceleași chei
js/i18n/
  index.js                  API public: t, setLanguage, getLanguage, onLanguageChange
  dictionary.js             încărcare + fallback + contorizarea cheilor lipsă
  entityName.js             resolveName, resolveAliases, detectLanguage
  format.js                 formatYear (mutat din helpers.js), numere, liste
```

`js/utils/helpers.js:36` conține `formatYear()` care emite `"298 AC"` / `"114 BC"` hardcodat.
Se mută în `js/i18n/format.js` și trece prin `t('era.after')` / `t('era.before')`.

### 6.2 API

```js
t(key)                         // → string
t(key, { name: 'Winterfell' }) // interpolare simplă {name}, fără ICU
getLanguage()                  // → 'ro' | 'en'
setLanguage(lang)              // persistă + actualizează <html lang> + emite evenimentul
onLanguageChange(fn)           // abonare
```

`t()` este **sincron și pur**. Nicio promisiune, niciun await la punctul de apel. Prețul
este o constrângere de ordine (§6.4), care se plătește o singură dată.

Fără ICU, fără pluralizare morfologică. Româna are trei forme de plural, dar interfața
măsurată nu are niciun șir care să depindă de numărul gramatical: numerele apar ca
`"{n} locații calibrate"` sau `"({count})"`. Dacă apare unul, se rezolvă cu două chei
explicite, nu cu o bibliotecă.

### 6.3 Persistența alegerii

`localStorage` este permis aici — este aplicația proprie, nu un artefact (`CLAUDE.md` §8).

```
Ordinea de determinare la pornire:
  1. parametrul de URL ?lang=ro|en          (are prioritate; face linkurile partajabile)
  2. localStorage['atlas.lang']
  3. navigator.language.startsWith('ro') ? 'ro' : 'en'
  4. 'ro'                                    (limba-sursă a proiectului)
```

Cheia `atlas.lang` este prefixată pentru a nu intra în conflict pe `localhost`, unde
`admin/map-editor.html` rulează pe aceeași origine.

### 6.4 Ordinea de inițializare — constrângere dură

`name` este câmp derivat din limba activă, deci limba trebuie cunoscută **înainte** ca
`DataManager.loadAll()` să construiască obiectele:

```
1. i18n.init()            ← determină limba, încarcă ro.json + en.json, setează <html lang>
2. dataManager.loadAll()  ← derivă name / name_source / name_lang
3. searchEngine.buildIndex()
4. componentele UI
```

`js/app.js:312` are `app.init().catch(console.error)`. `CLAUDE.md` §4.9 documentează deja că
acest lanț înghite orice eroare de încărcare și lasă ecranul de loading blocat la infinit.
**Un eșec de încărcare a dicționarului trebuie să fie fatal și vizibil**, nu o linie în
consolă. Altfel simptomul unui `en.json` lipsă este un ecran de încărcare care nu se
termină niciodată — exact clasa de defect pe care §4.9 o descrie.

### 6.5 Comutarea limbii

`setLanguage()` emite `atlas:languagechange` pe `window`. `app.js` reacționează cu
**re-randare completă**:

```
1. re-derivă name pe toate entitățile din dataManager (fără fetch — datele sunt deja în memorie)
2. re-randează Toolbar, FilterPanel, Timeline
3. re-randează InfoPanel dacă e deschis, pe aceeași entitate
4. re-randează WikiPage dacă e deschisă
5. MapRenderer.render() — etichetele pinurilor
6. SearchEngine: NU se reconstruiește indexul (§7)
```

Fără diferențe de DOM, fără randare incrementală. Fără framework, o re-randare completă la o
acțiune rară a utilizatorului este corectă și verificabilă; o actualizare parțială ar produce
exact clasa de defecte pe care `CLAUDE.md` §4.8 le descrie — cod scris care nu se execută.

Starea care trebuie păstrată peste re-randare: entitatea selectată, zoom-ul și panoramarea
hărții, anul din timeline, checkbox-urile de filtre, textul din câmpul de căutare.

### 6.6 `<html lang>`

`index.html:2` este `<html lang="en">`, iar conținutul afișat e majoritar românesc — atributul
este greșit azi. `admin/map-editor.html:2` este `lang="ro"`, ceea ce e corect și rămâne așa.

`index.html` devine `lang="ro"` (valoarea implicită) și `i18n.setLanguage()` scrie
`document.documentElement.lang`. Contează pentru despărțirea în silabe, pentru cititoarele de
ecran și pentru selecția corectă a fontului — aplicația folosește Cinzel și Cormorant Garamond,
ambele cu glife pentru `ș`/`ț`, dar substituirea implicită a browserului nu este garantată.

Fragmentele L3 primesc `lang="ro"` pe elementul containerului, chiar și când interfața e EN.
Este exact scopul atributului și face badge-ul din §5.2 accesibil, nu doar vizual.

---

## 7. Căutarea

### 7.1 Invarianți fermi

**INV-S1 — Indexul nu depinde niciodată de limba interfeței.**
Se construiește o singură dată, cu toți termenii din toate limbile. `setLanguage()` **nu**
reconstruiește și **nu** filtrează indexul. O căutare după „King's Landing" trebuie să
găsească entitatea și pe interfața RO; o căutare după „Debarcaderul Regelui" trebuie să o
găsească pe interfața EN.

**INV-S2 — Plierea diacriticelor este obligatorie, pe ambele părți.**
**2282 din 5298** de entități denumite au diacritice românești. Fără pliere, un utilizator cu
tastatură engleză care tastează `Fortareata` nu găsește `Fortăreața`. Se pliază **și**
interogarea, **și** termenul din index, la comparație — niciodată la afișare.

**INV-S3 — Rezultatul afișează numele în limba interfeței, dar declară termenul care a
potrivit**, când acesta diferă. `js/ui/SearchBar.js:131` are deja mecanismul `"(găsit ca: …)"`;
i se adaugă badge-ul de limbă din §4.3.

### 7.2 Ce se schimbă concret

`SearchEngine.extractSearchTerms()` (`js/data/SearchEngine.js:138–171`) adaugă deja
`name`, `nume_canonic`, `nume`, `nume_generat`, `id`, `id_intern[]`, `aliasuri[]`.
**Arhitectura cerută de punctul 5 din sarcină este deja pe jumătate implementată.**

Se adaugă: `name_ro`, `name_en`, `aliases_ro[]`, `aliases_en[]`, `aliases_unclassified[]`.

Se adaugă plierea în `scoreTerm()` (`SearchEngine.js:223`) — un singur punct, pentru că
toate cele șase ramuri de potrivire (exact, prefix, cuvinte, substring, Levenshtein, pe
cuvinte) trec prin `cleanQuery` și `tLower`.

`buildIndex()` păstrează `primaryName` pentru **sortare și afișare**; se schimbă în
`resolveName(entity, lang)` și se re-evaluează la comutarea limbii — dar `searchTerms` nu
se atinge. Aceasta este singura parte a indexului care depinde de limbă și este o proiecție,
nu un filtru.

### 7.3 Un efect secundar util

`id_intern` conține deja forma românească normalizată pentru 887 de locații
(`LOCATION_DEBARCADERUL_REGELUI`) și este deja indexat. Rezultatul: o parte din căutarea
bilingvă **funcționează deja azi, accidental**, prin proveniență. Se documentează ca
intenționat și se acoperă cu o asertare, ca să nu fie eliminat ca „câmp intern" într-o
curățenie viitoare.

### 7.4 Asertări de adăugat în `tests/smoke.mjs`

```
S1  search('King\'s Landing')      conține kings_landing, în ambele limbi
S2  search('Debarcaderul Regelui') conține kings_landing, în ambele limbi
S3  search('Fortareata Rosie')     conține kings_landing            (INV-S2, fără diacritice)
S4  setLanguage nu modifică lungimea indexului                      (INV-S1)
S5  fiecare rezultat are un nume nevid pentru ambele limbi          (§4.2 pasul 5)
S6  setul de chei din ro.json === setul de chei din en.json
S7  numărul de chei L1 lipsă la o randare completă === 0
```

---

## 8. Efortul de traducere

### 8.1 L1 — cromul de interfață

| Bucată | Chei | Stare |
|---|---:|---|
| literale din `js/` + `index.html` | 78 | 69 există în EN, 9 în RO → fiecare are nevoie de perechea lipsă |
| `locations.type` | 19 | id-uri EN → ambele etichete de scris |
| `locations.subtype` (taxonomia nouă) | 29 | **blocat pe migrarea taxonomiei** (§3.3) |
| `region` | 12 | |
| `confidence` / `canon` | 5 | |
| chei de predicat | 42 | |
| `source_book` | 7 | ambele titluri publicate oficial → doar de transcris |
| `tags` (net, după eliminarea suprapunerilor) | 2 | |
| `travel_method` normalizat | ~15 | **blocat pe normalizare** (257 azi) |
| `objects.categorie` normalizat | ~10 | **blocat pe normalizare** (57 azi) |
| `titles.categorie` normalizat | ~6 | **blocat pe normalizare** (11 azi) |
| ere (`era.before` / `era.after`) | 2 | |
| badge + tooltip de limbă | ~10 | nou |
| **TOTAL L1** | **~237 chei** | |

**~474 de valori**; ~110 există deja într-o limbă → **~364 de valori de scris.**
Din acestea, **~60 sunt blocate** pe migrarea taxonomiei și pe normalizări.
Volum util imediat: **~304 valori**, adică o zi de lucru.

`admin/` (43 de șiruri): în afara scopului (§3.4).

### 8.2 L2 — numele de entități

Excluzând evenimentele (§4.5):

| | locations | characters | houses | objects | titles | dragons | **total** |
|---|---:|---:|---:|---:|---:|---:|---:|
| sloturi de nume | 1099 | 2288 | 229 | 276 | 94 | 3 | **3989** |
| `neutral` — 0 muncă | 392 | 1431 | 100 | 35 | 10 | 3 | **1971** |
| necesită EN scris (`ro`+`mixed`) | 606 | 850 | 3 | 240 | 84 | 0 | **1783** |
| necesită RO scris (`en`+`mixed`) | 118 | 18 | 126 | 3 | 4 | 0 | **269** |

**Celule totale de completat: 2052.**

Reduceri deja disponibile:

| Reducere | Celule |
|---|---:|
| tiparul `House {X}` ⇄ `Casa {X}`, generabil (§4.4) | −226 |
| seminte din `id_intern` diferit de `id` (§1.2) | ~−171 |
| seminte din paranteza finală (§1.2) | ~−300 (din 496 candidate, ~60% sunt traduceri) |
| seminte din alias în cealaltă limbă (§1.2) | ~−68 |

**Estimare realistă: ~2050 de celule, dintre care ~700 propuse mecanic (doar validate) și
~1350 scrise manual.**

Plus: **895 de valori de alias de clasificat** pe limbă (clasificare, nu traducere — automată,
cu triaj pe eșantion) și **23 de valori deteriorate de reparat manual** (§1.3).

La 60 de nume validate pe oră pentru cele propuse mecanic și 25 pe oră pentru cele scrise:
**≈ 12 + 54 ≈ 66 de ore de triaj.** Este cea mai scumpă parte a proiectului și singura care
nu se poate automatiza fără să încalce `CLAUDE.md` §5.2.

### 8.3 L3 — conținutul narativ

| | |
|---|---:|
| fragmente narative | **51.615** |
| caractere | **2.443.462** |
| cuvinte estimate | **~407.000** |
| **fragmente propuse pentru traducere** | **0** |
| etichete de limbă de scris (per câmp, nu per fragment) | ~15 chei `_i18n`, generate automat |
| șiruri L1 necesare pentru badge + tooltip | ~10 (deja numărate în §8.1) |
| excepția din §5.4: descrieri deja engleze, de tradus în RO | **77** |

### 8.4 Totalul

| Strat | Șiruri de scris | Natura muncii |
|---|---:|---|
| L1 | ~364 (din care ~60 blocate) | scriere de dezvoltator, rapidă |
| L2 | ~2052 celule + 895 clasificări | triaj cu carte pe masă, lent, ~66 h |
| L3 | 77 | excepție, deja engleze |
| **Total** | **~2493 șiruri** | față de **~409.000 de cuvinte** dacă L3 s-ar traduce |

**Raportul de compresie al arhitecturii pe trei straturi: ~160×.**

---

## 9. Ordinea de implementare și criteriile de acceptanță

Fiecare fază este un commit (`CLAUDE.md` §6). Nicio fază nu atinge `data/` fără dry-run
implicit, backup automat și flag explicit de scriere.

| Fază | Conținut | Criteriu de acceptanță, ca ieșire de comandă |
|---|---|---|
| **F1** | `js/i18n/` + `i18n/ro.json` + `i18n/en.json`, doar cele 78 de literale de crom. Fără atingerea datelor. | `node tests/smoke.mjs` iese 0; S6 și S7 trec; numărul de chei lipsă = 0 |
| **F2** | Vocabularele închise deblocate (type, region, confidence, predicate, source_book, ere) | fiecare valoare distinctă măsurată în §1.6 are cheie; asertare de acoperire |
| **F3** | Pliere de diacritice + termeni multilingvi în `SearchEngine` | S1–S4 trec; lungimea indexului neschimbată la comutare |
| **F4** | Etichetare L3 + badge + `lang` pe containere. Fără traduceri. | fiecare secțiune narativă randată are `lang` și badge când diferă de UI |
| **F5** | Schema L2 pe disc: `name_ro` / `name_en` / `aliases_*` / `_i18n`, **goale**, plus derivarea în `DataManager` | `name` derivat === `name` de pe disc pentru toate entitățile când toate câmpurile noi sunt goale — regresie zero, demonstrată |
| **F6** | Semințe mecanice (§1.2, §4.4) cu `status: "seeded"` | numărul de `seeded` raportat per colecție; niciunul nu ajunge afișat fără badge |
| **F7** | Triaj manual, incremental, pe colecții | `verified` crește; `seeded` scade; badge-urile vizibile scad monoton |
| **F8** | *Blocat pe migrarea taxonomiei:* panoul de filtre, `travel_method`, `categorie` | 320 de checkbox-uri → 29; nicio etichetă din date |

F1–F5 nu depind de triaj și pot fi livrate integral. F8 nu poate începe înainte de
finalizarea migrării `subtip` → `subtype`.

---

## 10. Ce nu facem

1. **Nu traducem automat nimic** — nici nume, nici narațiune. `CLAUDE.md` §5.2 și §5.3.
2. **Nu transliterăm.** §4.2.
3. **Nu ștergem și nu rescriem `name`, `nume`, `aliasuri`, `id_intern`, `subtip` pe disc.**
   `CLAUDE.md` §5.4. Câmpurile noi se adaugă lângă ele.
4. **Nu filtrăm nimic pe limbă** — nici indexul de căutare, nici lista de entități, nici
   fragmentele narative. Un utilizator EN vede toate cele 1099 de locații, unele cu badge `RO`.
5. **Nu adăugăm biblioteci de i18n.** `CLAUDE.md` §8. `t()` cu interpolare `{cheie}` acoperă
   toate cele 237 de chei măsurate.
6. **Nu internaționalizăm `admin/`.** §3.4.
7. **Nu inventăm numere de pagină pentru ediția engleză.** Paginile din `surse` se referă la
   ediția românească; se marchează, nu se convertesc.
8. **Nu începem panoul de filtre înainte de migrarea taxonomiei.** §3.3.

---

## 11. Premise care s-au dovedit inexacte

### 11.1 Din `CLAUDE.md` §3 — cifre depășite de lucrul necommitat

Arborele de lucru era murdar la începutul acestei sesiuni (`git status` în §12). Cifrele de
referință din `CLAUDE.md` §3 corespund stării de la `HEAD` (commit `52bdcc9`), nu arborelui curent.

| Fapt | `CLAUDE.md` §3 | Măsurat la `HEAD` | Măsurat în arborele de lucru |
|---|---:|---:|---:|
| Locații în `getAllLocations()` | 391 | **391** ✓ | **697** |
| Checkbox-uri în panoul de filtre | 128 | — | **320** |
| Obiecte / titluri încărcate de `DataManager` | „nu sunt încărcate" | — | **încărcate** (`DataManager.js:31–32, 126–127`) |

Migrarea în curs adaugă în `locations.json` câmpurile `subtype`, `mappable`, `state`,
`classification_confidence`, `parent_id`, ceea ce mută 306 locații în bucketul randabil.
**Toate cifrele din acest document sunt măsurate pe arborele de lucru** și trebuie
re-măsurate după ce migrarea se comite.

### 11.2 Din enunțul sarcinii

| Afirmație | Verificare |
|---|---|
| locations 1041, 367 cu diacritice (35%) | **368**, nu 367. Diferență de 1. |
| characters 2288, 470 cu diacritice (21%) | **474**, nu 470. Diferență de 4. |
| events 1682, 1439 cu diacritice (86%) | **1439** ✓ exact |
| houses 229, 1 cu diacritice (0%) | **1** ✓ exact |
| characters cu `description`: 34 | **34** ✓ exact |
| locations cu `descriere_fizica`: 488 | **488** ✓ exact |
| distances.json: 467, integral română | **467** ✓; `context` 94% RO, `distance_value` 94% RO, `travel_method` 52% RO (48% sunt `"nespecificat"`, `"—"` sau nume proprii) |
| aliasuri: 308 locations, 260 characters | **308 / 260** ✓ exact |

Diferențele de ±1 și ±4 la diacritice provin din `free_cities.json` și `far_lands.json`,
pe care `DataManager` le concatenează la `locations` (`DataManager.js:58`) — enunțul a numărat
doar `locations.json`.

### 11.3 Corecția de fond a enunțului

> „Adică `name` conține uneori «King's Landing», uneori «Debarcaderul Regelui»,
> fără niciun marcaj de limbă."

Exact, dar **testul diacriticelor subestimează problema cu ~60%.** Măsurat cu morfologie
în plus față de diacritice: nu 368 de locații românești, ci **589 + 17 mixte**. Nu 474 de
personaje, ci **839 + 11**.

Simultan, problema este **cu 36% mai mică decât pare**: **2012 din 5668 de nume sunt identice
în ambele limbi** (`Winterfell`, `Casterly Rock`, `Arya Stark`) și nu au nevoie de nimic.

Și: `name` **are deja** marcaj de limbă parțial, în trei locuri neintenționate —
`id` (englezesc) vs `id_intern` (românesc) pentru 171 de locații, paranteza finală pentru
496 de entități, aliasul în cealaltă limbă pentru 68. Aproximativ 700 de perechi RO↔EN
există deja în date și nu trebuie scrise, ci extrase.

---

## 12. Reproductibilitate

Toate cifrele din acest document au fost produse cu scripturi de măsurare rulate pe arborele
de lucru la 2026-08-03. Niciun script nu a scris nimic. Niciun fișier din `data/` nu a fost
atins.

Starea arborelui la momentul măsurării:

```
$ git status --short
 M data/locations/locations.json
 M docs/taxonomie_esantion.json
 M js/data/DataManager.js
 M js/map/MapRenderer.js
 M js/ui/FilterPanel.js
 M scripts/classify_locations.py
 M tests/smoke.mjs
?? data/_backups/
?? data/_review/
?? docs/raport_taxonomie.md
?? js/utils/locationSubtypes.js
?? scripts/normalize_subtip.py
```

Măsurătorile care trebuie re-rulate după comiterea migrării taxonomiei: §1.6
(`subtip` / `subtype`), §3.3 (numărul de checkbox-uri), §8.1 (cheile blocate), §11.1.
