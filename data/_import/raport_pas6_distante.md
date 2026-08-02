# Raport Pas 6 — Distanțe și poziționare relativă

## Rezumat general

- Fișiere sursă procesate: 7 (câte unul per carte)
- Perechi de locații procesate (blocuri „Pereche de locații”): **741**
- Mențiuni individuale găsite (= linii „Distanță: …”): **846**
- Afirmații atomice generate în `statements_distante.json`: **467**
  - din care marcate `approx: true` (surse cu „aproximativ”): 143
  - perechi unice de ID-uri de locație acoperite: 328
- Referințe lipsă / semnalate în `referinte_lipsa.json`: **379**
  - din care ambele locații lipsesc complet din registru: 317
  - din care cel puțin o locație e „nume multiplu grupat” (⚠ pereche ambiguă, mai multe locații distincte sub aceeași etichetă): 56
  - din care mixte (una lipsă din registru + una grupată ambiguu): 6
- Perechi cu avertisment ⚠ explicit în sursă: **8** (listate mai jos)

## Defalcare per carte

| Carte | Perechi procesate | Mențiuni | Afirmații generate | Referințe lipsă |
|---|---|---|---|---|
| Urzeala Tronurilor | 108 | 137 | 60 | 77 |
| Înclestarea Regilor | 119 | 128 | 66 | 62 |
| Iureșul Săbiilor | 98 | 105 | 48 | 57 |
| Festinul Ciorilor | 111 | 124 | 85 | 39 |
| Dansul Dragonilor | 166 | 191 | 107 | 84 |
| Cavalerul celor 7 Regate | 36 | 37 | 21 | 16 |
| Foc și Sânge | 103 | 124 | 80 | 44 |

## Metodologie

- Fiecare mențiune individuală de distanță (linia „Distanță: … — Fragment N, pag. X”) a devenit o afirmație separată; nu s-a combinat/mediat nimic, conform cerinței.
- Potrivirea denumirilor de locații din fișierele de Distanțe cu ID-urile din `entities.json` s-a făcut în etape, în ordinea priorității:
  1. Potrivire exactă pe `nume_canonic` (normalizat: fără diacritice, minuscule).
  2. Potrivire exactă pe `aliasuri`.
  3. Denumiri compuse cu „/” unde toate variantele indică **același** ID (sinonime înregistrate) — acceptate ca atare.
  4. Normalizare ușoară a articolului hotărât românesc (ex. „Zid” → „Zidul”), aplicată doar când rezultă un singur ID candidat.
- Când o locație din pereche NU are corespondent unic în registru (poziție vagă, tabără nenumită, reper descriptiv fără ID propriu) → mențiunea a fost trimisă integral în `referinte_lipsa.json`, cu ambele locații (raw text), status și eventualii candidați găsiți — NU s-a inventat un ID nou.
- Când o denumire combina „/” **două locații distincte** cu ID-uri diferite (nu sinonime, ci două locuri reale diferite puse sub aceeași etichetă, ex. „Highgarden / Capătul Furtunii”) → tratat ca *nume multiplu grupat*, trimis în `referinte_lipsa.json`, nu s-a decis unilateral care e „locația reală”.
- Notele ⚠ deja prezente în fișierele sursă au fost păstrate ca atare și listate mai jos, fără a fi „rezolvate” de mine.

## ⚠ Perechi ambigue semnalate explicit în sursă (nu au fost decise unilateral)

- **[Urzeala Tronurilor]** Domeniul Regelui / Debarcăderul Regelui — Winterfell
  - (⚠ „Domeniul Regelui" și „Debarcăderul Regelui" tratate ca aceeași pereche cu Winterfell — verificați dacă „Domeniul Regelui" desemnează regiunea sau orașul propriu-zis)
- **[Urzeala Tronurilor]** Winterfell (cătunul de iarnă) — marginea Pădurii Lupului
  - (⚠ posibil aceeași zonă generală ca „limita zonei agricole / marginea Pădurii Lupilor" din Fragment 3, dar distanța și contextul diferă mult — verificați manual dacă e vorba de același reper)
- **[Urzeala Tronurilor]** Sherrer (posibil altă locație, neclar) — Fortăreața Roșie / locul unde vorbește Ned
  - (⚠ conform extragerii originale, neclar la ce eveniment se referă exact această mențiune)
- **[Urzeala Tronurilor]** Riverrun — confluența Furcii Roșii și a unui alt curs de apă (numit „Pietrei Răsturnate" / „Piatra Răsucită" în traducere)
  - (⚠ posibil aceeași denumire coruptă/variantă de traducere — „Pietrei Răsturnate" în Fragment 13 vs. „Piatra Răsucită" în Fragment 14 — verificați manual)
- **[Înclestarea Regilor]** Gemenii — Ținuturile Riverurilor/Ochiul Zeilor
  - - Distanță: „aproape până la Gemeni" | Direcție: miazănoapte, peste Trident | Mijloc de deplasare: nespecificat | Context: extinderea conflictului (aproximativ) ⚠ conflict — Fragment 3, pag. nespecificată *(aproximativ)
- **[Festinul Ciorilor]** Eyrie — Castelul Lunii / Porțile Lunii (baza muntelui)
  - - ⚠ „Castelul Lunii" (Fragment 6) și „Porțile Lunii" (Fragment 11) sunt foarte probabil aceeași locație — verifică manual
- **[Dansul Dragonilor]** Drumul regelui (ținutul Umber) — Dreadfort
  - - Locația A: drumul regelui (teritoriul Umber) | Locația B: Dreadfort | Distanță: drumul regelui străbate hotarele vestice ale pământurilor Umber pe o distanță foarte mare (cifră redată în text ca „cinci mii de kilometri” — posibil eroare de traducere/tipar, marcată ca atare) | Direcție: sud-est, prin Dealurile Solitare | Mijloc de deplasare: mărșăluire terestră (oaste) | Context: ruta propusă de Jon pentru campania lui Stannis — PART-6, pag. 308 ⚠ cifră posibil eronată în text
- **[Dansul Dragonilor]** Metereze Winterfell — pământul de dedesubt
  - - Locația A: metereze Winterfell (zid interior) | Locația B: pământul de dedesubt | Distanță: „treizeci de metri înălțime" | Direcție: nespecificată | Mijloc de deplasare: nespecificat | Context: — — PART-15, pag. 823 ⚠ conflict — aceeași structură (metereze Winterfell), cifre incompatibile (250 m vs. 30 m) — posibil eroare/exagerare narativă sau porțiuni diferite ale zidului; ambele valori păstrate

## Alte perechi cu „nume multiplu grupat” (bundle de 2+ locații distincte sub aceeași etichetă, fără avertisment explicit în sursă)

Acestea au fost detectate automat (denumirea locației A sau B, la despărțire pe „/”, indică ID-uri diferite din registru) și trimise în `referinte_lipsa.json` pentru verificare manuală — exemple reprezentative:

- „Domeniul Regelui / Debarcăderul Regelui” → candidați: LOCATION_DEBARCADERUL_REGELUI, LOCATION_DOMENIUL_REGELUI
- „Highgarden / Capătul Furtunii” → candidați: LOCATION_CAPATUL_FURTUNII, LOCATION_HIGHGARDEN
- „Debarcăderul Regelui / Domeniul Regelui” → candidați: LOCATION_DEBARCADERUL_REGELUI, LOCATION_DOMENIUL_REGELUI
- „Asshai / Tărâmul Umbrelor” → candidați: LOCATION_ASSHAI, LOCATION_TARAMUL_UMBRELOR
- „Tărâmul Umbrelor / Asshai” → candidați: LOCATION_ASSHAI, LOCATION_TARAMUL_UMBRELOR
- „Valea Arryn / Eyrie” → candidați: LOCATION_EYRIE, LOCATION_VALEA_ARRYN
- „Gâtul (The Neck) / Winterfell” → candidați: LOCATION_GATUL, LOCATION_WINTERFELL
- „Lacrimile Alyssei / Lancea Uriașului (platou)” → candidați: LOCATION_LACRIMILE_ALYSSEI, LOCATION_LANCEA_URIASULUI
- „Castelul Negru / drumul regelui” → candidați: LOCATION_CASTELUL_NEGRU, LOCATION_DRUMUL_REGELUI
- „Capătul Furtunii / Highgarden” → candidați: LOCATION_CAPATUL_FURTUNII, LOCATION_HIGHGARDEN
- „Fortăreața Roșie / Postul de pază-metereze” → candidați: LOCATION_FORTAREATA_ROSIE, LOCATION_POSTUL_DE_PAZA
- „drumul regelui / Gemeni (via Furca Verde)” → candidați: LOCATION_DRUMUL_REGELUI, LOCATION_GEMENI
- „Debarcăderul Regelui / Riverrun (front de vest)” → candidați: LOCATION_DEBARCADERUL_REGELUI, LOCATION_RIVERRUN
- „Ochiul Zeilor / Furca Roșie” → candidați: LOCATION_FURCA_ROSIE, LOCATION_OCHIUL_ZEILOR
- „Dintele de Aur / Munții Lunii” → candidați: LOCATION_DINTELE_DE_AUR, LOCATION_MUNTII_LUNII
- „Dragonul Mării / Deepwood Motte” → candidați: LOCATION_DEEPWOOD_MOTTE, LOCATION_DRAGONUL_MARII
- „Portul Alb / gorgane / pădurea lupilor (surse de recruți)” → candidați: LOCATION_GORGANE, LOCATION_PADUREA_LUPILOR, LOCATION_PORTUL_ALB
- „Apa Laptelui (malul estic) / Pumnul Primilor Oameni” → candidați: LOCATION_APA_LAPTELUI, LOCATION_PUMNUL_PRIMILOR_OAMENI
- „Dorne / Treptele de Piatră” → candidați: LOCATION_DORNE, LOCATION_TREPTELE_DE_PIATRA
- „Dorne / Sunspear” → candidați: LOCATION_DORNE, LOCATION_SUNSPEAR
- „Hanul Omului Îngenuncheat / Satul pârjolit” → candidați: LOCATION_HANUL_OMULUI_INGENUNCHEAT, LOCATION_SATUL_PARJOLIT
- „Turnul Prăbușit / Pădurea Lupilor” → candidați: LOCATION_PADUREA_LUPILOR, LOCATION_TURNUL_PRABUSIT
- „Orașul Vechi / dincolo de marea îngustă / Dorne / Zid” → candidați: LOCATION_DORNE, LOCATION_ORASUL_VECHI
- „Castelul Lunii / Porțile Lunii (baza muntelui)” → candidați: LOCATION_CASTELUL_LUNII, LOCATION_PORTILE_LUNII
- „Harrenhal / Darry” → candidați: LOCATION_DARRY, LOCATION_HARRENHAL

(și altele — vezi `referinte_lipsa.json`, status `nume_multiplu_grupat`, total 62 apariții)

## Note privind formatul

- `source_fragment` a fost păstrat ca string, exact cum apare în sursă (ex. „1”, „1.3” pentru Foc și Sânge, sau numărul din „PART-N” pentru Dansul Dragonilor) — niciodată `0`, `null` doar dacă lipsea complet.
- `source_page` conține pagina/paginile mențiunii individuale (nu totalul agregat de la finalul blocului „Pereche de locații”).
- Câmpurile `direction`, `travel_method` au fost lăsate `null` doar dacă segmentul respectiv lipsea complet din linia sursă; dacă sursa spunea explicit „Nespecificată”/„Nespecificat”, valoarea a fost păstrată ca atare (e conținut din sursă, nu o lipsă de extragere).
- `entities.json` (cele 4 părți din Pas 0) NU a fost modificat; nu s-a adăugat niciun ID nou.
