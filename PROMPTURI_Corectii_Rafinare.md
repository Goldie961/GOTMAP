# Corecții după rafinare — Prompturi + Ghid

Continuă după `PROMPTURI_Rafinare_Finala.md` (Prompturile A-F). Verificarea directă a
rezultatelor a găsit 3 lucruri de corectat înainte să considerăm rafinarea completă.
**3 prompturi**, independente unul de altul, plus ghidul de folosire.

---

## Tabel de ansamblu

| # | Prompt | Scop | Risc |
|---|---|---|---|
| G | Re-rulare reală a consolidării de sinonime (Promptul D) | `characters.json` să reflecte chiar ce spune raportul D | Mic-Mediu |
| H | Reparare ID-uri compuse greșit (Bran+Rickon etc.) | Desparte valorile de tip „două persoane într-un singur câmp" | Mic |
| I | Decizie + implementare: Case ca participanți la evenimente | Rezolvă 113 din cele 137 referințe reale rupte, dintr-o singură decizie | Mic-Mediu |

---

## Ghid de folosire

1. **G nu depinde de H sau I** — poate rula oricând, independent.
2. **H și I sunt și ele independente între ele** — ordine liberă.
3. **Backup înainte de fiecare**, ca de obicei — toate trei scriu în date.
4. **După G, verifică chiar tu** (sau trimite-mi) un singur personaj cunoscut cu
   variante de titlu (Jon Arryn, Catelyn Stark, Eddard Stark — exact cele verificate
   de mine) — dacă tot arată variante separate, scriptul tot nu s-a aplicat cu adevărat
   pe fișierul live, nu doar pe un eșantion de test.
5. **I cere o decizie a ta înainte de implementare**, la fel ca Promptul F — nu
   implementează orbește.
6. **Nu mai lua de bune cifrele unui raport de audit fără sursă dublă** — Promptul A
   a arătat clar că un script de audit poate avea el însuși un bug care umflă
   artificial numărul de probleme găsite. Cere mereu, la orice audit viitor,
   confirmarea că toate fișierele-sursă relevante (inclusiv `data/essos/*`) au fost
   incluse în verificare, nu doar cele „principale".

---

## Prompt G — Re-rulare reală a consolidării de sinonime pe `characters.json`

```
Context: consolidation_functions.py conține deja dicționarul TITLE_SYNONYMS și logica
de normalizare (adăugate corect la promptul anterior). Dar characters.json, verificat
direct, NU reflectă aceste schimbări — Jon Arryn încă are toate cele 10 titluri
originale, inclusiv toate cele 3 variante „Stăpân al Eyrie"/„Lord al Eyrie-i"/„Lord de
Eyrie" separate, neunite. Catelyn Stark și Eddard Stark la fel, neschimbate. Raportul
anterior a descris corect codul, dar exemplele de „înainte/după" nu au fost aplicate
cu adevărat pe fișierul live — probabil au fost rulate doar pe un eșantion de test,
separat de fișierul de producție.

Sarcină:
1. Backup characters.json → data/_import/etl_output/backups/characters.pre_sinonime_reale.json
2. Găsește EXACT unde/cum a fost rulată consolidarea inițial pentru a produce
   characters.json (probabil un script separat de agregare/merge care apelează
   consolidate_title_at din consolidation_functions.py) — verifică dacă acel script
   chiar a fost re-rulat cu codul nou, sau dacă modificarea de la promptul anterior a
   rămas neaplicată pe date.
3. Re-rulează consolidarea title_at pe TOATE cele 2288 de personaje din
   characters.json curent (nu recreezi de la zero din statements — folosești
   `titles`/`_afirmatii_pe_predicat` deja existente în fișier ca input, doar aplici
   din nou pasul de deduplicare cu noul dicționar de sinonime peste ce există deja).
4. Scrie rezultatul înapoi în characters.json.
5. Verifică EXPLICIT, citind direct din fișierul scris pe disc (nu dintr-o variabilă
   în memorie sau un test separat): Jon Arryn are acum „Lord de Eyrie" ca singur
   titlu din cele 3 variante? Catelyn Stark? Eddard Stark?

Verificare cerută (obligatorie, cu citire directă din characters.json după scriere):
1. Numărul de personaje cu titluri unificate suplimentar față de înainte.
2. Titlurile complete, citite direct din fișier, pentru Jon Arryn, Catelyn Stark,
   Eddard Stark — arată array-ul `titles` complet, nu doar exemplul unificat.
3. Confirmă că numărul total de personaje (2288) nu s-a schimbat — acest prompt
   NU trebuie să adauge/șteargă personaje, doar să unifice titluri în interiorul
   fiecăruia.

Raportează cu citate exacte din fișierul rescris, nu din memoria rulării scriptului.
```

---

## Prompt H — Reparare ID-uri compuse greșit (relații de familie)

```
Context: audit_integritate_referentiala.json a găsit valori invalide de tipul
„PERSON_BRAN_STARK_SI_RICKON_STARK" și „PERSON_BRAN_STARK_RICKON_STARK" (ambele
variante!) în câmpurile `frati`/`copii`, plus „PERSON_BAELA_SI_RHAENA_TARGARYEN" —
cazuri unde extragerea din carte a prins „Bran și Rickon Stark" sau „Baela și Rhaena
Targaryen" ca UN SINGUR nume compus, în loc să separe în două ID-uri distincte într-un
array.

Sarcină:
1. Backup characters.json (dacă nu ai deja unul proaspăt de la Promptul G).
2. Scrie scripts/fix_compound_person_ids.py:
   - caută în TOATE câmpurile de relații (`parinti`, `copii`, `frati`, `casatorit_cu`)
     din characters.json valori care conțin tipare de compunere: „_SI_", „ȘI", „and",
     „,", sau orice alt separator pe care-l găsești efectiv în date la verificare.
   - pentru fiecare valoare compusă găsită, încearcă să identifici cele 2 (sau mai
     multe) persoane reale din nume (ex. „BRAN_STARK_SI_RICKON_STARK" → caută dacă
     există deja `PERSON_BRAN_STARK`/`bran_stark` și `PERSON_RICKON_STARK`/
     `rickon_stark` ca entități separate în characters.json).
   - dacă găsești ambele persoane reale: înlocuiește valoarea compusă cu cele 2 ID-uri
     separate, adăugate corect în array (nu suprascrie restul array-ului).
   - dacă NU găsești vreuna din persoane ca entitate separată deja existentă: NU
     inventa, pune cazul deoparte într-un fișier
     data/_import/etl_output/id_uri_compuse_needecise.json pentru decizie manuală.
3. Aplică aceeași verificare și pentru orice alt câmp relevant (`membru_al`,
   `participanti` la evenimente) — dacă găsești tipare similare de compunere acolo,
   tratează-le la fel.

Verificare cerută:
1. Câte cazuri compuse au fost găsite în total, câte reparate automat, câte puse
   deoparte needecise.
2. Confirmă manual 3 exemple reparate — arată array-ul complet `frati`/`copii` înainte
   și după, pentru persoanele afectate (ex. Bran Stark, Rickon Stark).
3. Re-rulează (sau cere-mi să re-verific) audit_referential_integrity.py după —
   confirmă că aceste cazuri specifice nu mai apar ca rupte.

Raportează numerele exacte și cele 3 exemple.
```

---

## Prompt I — Decizie + implementare: Case ca participanți la evenimente

```
Context: 113 din cele 137 de referințe reale rupte găsite de audit (peste 80% din tot
ce-i cu adevărat de reparat) sunt ID-uri de tip HOUSE_* (ex. HOUSE_STARK, HOUSE_TYRELL,
HOUSE_LANNISTER) apărând în câmpul `participants`/`participanti` din events.json —
câmp gândit inițial doar pentru persoane individuale (PERSON_*). Nu-i neapărat o
eroare de extragere — în multe cazuri chiar așa scrie în carte („Casa Stark s-a
alăturat bătăliei"), nu un personaj anume.

Sarcină, ÎN DOUĂ PAȘI — oprește-te după Pasul 1 și așteaptă decizia utilizatorului:

PASUL 1 — Analiză, fără implementare:
1. Numără exact câte evenimente au cel puțin un HOUSE_* în participanti/participants,
   și dă 5-10 exemple concrete de evenimente + contextul lor (ca să vedem dacă chiar
   are sens narativ „Casa X a participat" sau dacă e o eroare de extragere care ar fi
   trebuit să identifice o persoană anume).
2. Prezintă opțiuni concrete:
   a) extinde schema — `participants` rămâne mixt (PERSON_* și HOUSE_*), dar UI-ul
      (InfoPanel/WikiPage) tratează vizual diferit o Casă de o persoană (iconiță/
      culoare diferită) quando afișează participanții unui eveniment.
   b) separă în două câmpuri — `participanti_persoane` și `participanti_case`,
      schema mai curată, dar cere modificare în mai multe locuri de cod (orice UI
      care citește `participants` acum).
   c) pentru fiecare caz, încearcă să identifici persoana specifică din context (ex.
      liderul casei la acea dată) și înlocuiește HOUSE_* cu PERSON_* — cel mai corect
      istoric, dar mult mai multă muncă manuală/verificare, risc de greșeală per caz.
3. NU implementa nimic încă — prezintă analiza, exemplele, și oprește-te.

PASUL 2 (după decizia utilizatorului) — implementare opțiunea aleasă.

Raportează la Pasul 1: numărul exact de evenimente afectate, cele 5-10 exemple cu
context, cele 3 opțiuni clar descrise. Așteaptă răspuns înainte de Pasul 2.
```
