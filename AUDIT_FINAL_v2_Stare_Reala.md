# AUDIT FINAL v2 — Stare reală a proiectului + plan de continuare
## Atlas of Westeros: de la date brute la motor de cunoaștere

Document de handoff, scris ca să poată fi dat unei conversații noi (cu Claude sau cu
oricare alt asistent) împreună cu folderul proiectului, ca să continue exact de unde
s-a oprit aici, fără să piardă context. Înlocuiește `AUDIT_FINAL_Plan_Integrare.md`
original — arhitectura și deciziile de acolo rămân valabile (secțiunile 2, 4, 5, 6 de
mai jos sunt aproape neschimbate), dar acest document adaugă **starea reală, verificată,
a fiecărui nivel**, plus tot ce a fost descoperit doar prin lucru efectiv, nu prin plan.

---

## 0. Cum s-a lucrat până acum (regulile de bază, verificate în practică)

Munca s-a făcut prin prompturi date unor agenți de cod cu acces direct la disc
(Codex, Antigravity, opencode — s-au schimbat pe parcurs, din motive de credite/
disponibilitate) — nu Claude scrie cod direct în acest proiect. Claude scrie
prompturile, verifică rezultatele direct în fișiere (nu doar raportul agentului),
găsește probleme reale, scrie corecții.

**Reguli confirmate ca esențiale, prin experiență directă, nu teoretic:**

1. **Niciun prompt nu garantează execuție perfectă** — fiecare rundă, fără excepție,
   a avut nevoie de cel puțin o corecție găsită prin verificare directă.
2. **Verifică fișierele, nu doar raportul text al agentului** — s-au prins de mai
   multe ori discrepanțe reale (ex. Codex a raportat „141 evenimente nedatate" quando
   fișierul chiar avea 121; un raport de „100% rezolvat" quando de fapt un ID central
   ca `kings_landing` avea 0 rezultate la testul propriu al agentului).
3. **Fă backup/commit înainte de fiecare prompt** care scrie în cod sau date.
4. **Corecțiile se scriu în script, nu se aplică ca patch-uri pe rezultat** — altfel
   dispar la orice regenerare viitoare.
5. **Un prompt = un scop clar**, niciodată mai multe schimbări mari simultan.
6. **Conflictele/incertitudinile din date rămân marcate, nu se rezolvă automat** —
   deciziile ambigue se pun deoparte în fișiere `*_needecise.json`/`*_needs_review.json`
   pentru decizie manuală, niciodată alese tacit de agent.
7. **Un tipar de bug descoperit o dată tinde să reapară în alt câmp** — bug-ul de
   trunchiere la paranteză deschisă (`"Debarcaderul Regelui (malul apei"`) a apărut
   întâi la `subtip` (Nivel 1), a fost reparat acolo, apoi a reapărut identic la
   `aliasuri`, la un merge complet diferit, câteva săptămâni mai târziu. Verifică
   mereu dacă un fix a fost aplicat punctual sau structural.
8. **Duplicate de identitate sunt un risc sistemic, nu un accident izolat** — au
   apărut atât la locații (King's Landing exista de 6 ori sub nume diferite), cât și
   la personaje (Jon Arryn de 3 ori, 90+ perechi cu tipar „Ser X" vs. „X"). Motivul
   e mereu același: potrivire nume românesc din carte vs. ID englez din AWOIAF, fără
   punte de traducere. Verifică asta explicit la orice nivel nou, nu presupune că
   Nivelul 1 a rezolvat tiparul o dată pentru totdeauna.
9. **Harta a fost generată cu AI (ChatGPT), nu e la scară reală** — testat cu date
   concrete (5 perechi de distanțe cunoscute din Nord au dat scări între 1.14 și 6.99
   mile/unitate). Nicio calibrare de scară unică nu va fi corectă peste tot. Decizie
   luată: nu se urmărește triangulare pe mile — poziționarea se face doar pe regiune
   (calitativ), niciodată pe distanță calculată.

---

## 1. Ce există acum — rezumat executiv, actualizat

**Aplicația** („Atlas of Westeros"): hartă SVG interactivă (peste harta proprie,
generată cu AI, 7685×5115px), timeline, calculator de distanțe (cu secțiune de
distanțe narative din text), editor de hartă admin funcțional (reparat, vezi §9),
search, filtre. Module: `map/`, `data/`, `ui/`, `utils/`, plus `admin/` (editor) și
`scripts/` (toate ETL-urile).

**Baza de date**, stare curentă (verificată direct, nu din raport):

| Categorie | Fișier | Total actual | Notă |
|---|---|---|---|
| Case | `data/houses/houses.json` | ~229 | Nivel 1, stabil de mult, fără probleme cunoscute |
| Locații | `data/locations/locations.json` | **1041** | vezi discrepanță neexplicată la §10 |
| Personaje | `data/characters/characters.json` | **2312** | după curățare duplicate, vezi §9 |
| Evenimente | `data/events/events.json` | **1682** | conține duplicate cunoscute, nerezolvate încă, vezi §9 |
| Distanțe (narative) | `data/locations/distances.json` | **467** | complet, funcțional, verificat |
| Obiecte | `data/objects/objects.json` | 276 | Nivel 5, verificat funcțional |
| Titluri | `data/titles/titles.json` | 94 | Nivel 5, verificat funcțional |

**Toate cele 5 niveluri din planul original (§7 mai jos) au fost parcurse cel puțin
o dată.** Dar „parcurs" ≠ „perfect" — §9 din acest document listează exact ce a rămas
deschis la fiecare, cu numere reale.

---

## 2. Viziunea de produs — neschimbată, încă validă

```
                    UNIVERSUL WESTEROS (Home)
        ┌──────────────┬──────────────┬──────────────┐
        │    Hartă      │     Wiki      │   Timeline    │
        └──────────────┴──────────────┴──────────────┘
                    toate citesc din aceeași bază
```

- **Harta** — punct de intrare vizual/spațial. Click pe o entitate → panou compact
  (`InfoPanel.js`), buton „Vezi pagina completă →".
- **Wiki** — punct de intrare prin căutare. Aceeași entitate, pagină dedicată
  (`WikiPage.js`, mod „complet").
- **Timeline** — anul selectat schimbă stăpânii caselor, filtrează evenimentele,
  ascunde locațiile nedatate. **Reparat și conectat** (vezi §9.2) — inițial
  `TimelineEngine.js` citea `year`, ETL-ul scria `an_aproximativ`, nimic nu se
  vedea; corectat prin unificare de schemă.

Regulă de bază, neschimbată: 1 set de date + 3 straturi de prezentare peste el.

---

## 3. Schema de date — extinsă, confirmată funcțională

Toate extinderile din planul original (câmpuri `id_intern`, `aliasuri`, `relatii`,
`subtip`, `sursa_coordonate`, `evenimente`, `descriere_fizica`, `participanti`,
`locatie_id`, `an_aproximativ`, `nume_generat`, `titlu_curent`, `membru_al`,
`parinti`/`copii`/`frati`/`casatorit_cu`, `moarte`) sunt implementate și verificate
funcționale în producție, pentru toate cele 6 categorii. Fișierele `objects.json` și
`titles.json` există și sunt populate (Nivel 5).

**Adăugare față de plan, descoperită prin lucru, nu anticipată:** fiecare entitate
consolidată (personaje, mai ales) are acum și `_afirmatii_pe_predicat` — un jurnal
intern, per predicat, cu toate afirmațiile brute + sursele lor + un câmp
`surse_combinate` quando mai multe afirmații identice au fost unite. Util pentru
audit/retrasare la sursă, nu afișat în UI.

---

## 4. Pasul de agregare (ETL) — confirmat funcțional, cu reguli de consolidare adăugate

Scriptul central e `scripts/aggregate_import.py`, extins iterativ pentru fiecare
categorie. Reguli de consolidare adăugate față de planul inițial (nu erau anticipate,
au apărut din testare pe date reale):

- **`title_at` (titluri de-a lungul timpului, la personaje):** o persoană poate avea
  zeci de afirmații brute despre titlul purtat (Jon Arryn a avut 22, grupate în 9
  variante distincte). Regulă implementată: dedup pe similaritate de text (prag 0.80),
  ordonare cronologică pe baza ancorajului per-carte (§6), `titlu_curent` = ultimul
  cronologic, restul în `titles[]` cu sursă. **Limitare cunoscută, nerezolvată:**
  variante ca „Stăpân al Eyrie" vs. „Lord de Eyrie" rămân separate — pragul de
  similaritate simplu nu prinde sinonime (Stăpân/Lord). Ar avea nevoie de un mic
  dicționar de sinonime, netratat încă.
- **`died` (moarte):** mai multe afirmații parțiale/contradictorii per persoană
  (Jon Arryn a avut 7). Regulă: cea cu `confidence` mai mare devine
  `moarte.descriere`, restul intră în `moarte.variante`, niciodată aleasă complet
  automat fără păstrarea alternativelor.
- **`parent_of`/`child_of`/`sibling_of`:** verificate să nu se dubleze quando aceeași
  relație apare din ambele direcții în sursă.
- **Filtrare zgomot:** valori care sunt doar cifre/„pag. N" (scăpate din extragere ca
  fals `title_at`) trebuie filtrate explicit — semnalat ca problemă la Promptul 9,
  necesită verificare dacă filtrul a fost și aplicat în ETL-ul final (nu confirmat
  explicit în ultima verificare).

`id_map.json` (mapare `LOCATION_*`/`PERSON_*`/`HOUSE_*` ↔ id aplicație) s-a dovedit
esențial dincolo de scopul inițial de „retrasare la sursă" — a fost soluția directă
pentru conectarea `locatie_id` din evenimente la `locations.json`, fără să fie nevoie
de potrivire fuzzy nouă.

---

## 5. Poziționarea pe hartă — strategie schimbată față de plan, cu motiv confirmat

Planul original (triangulare din distanțe narative) **a fost abandonat, deliberat**,
după testare directă:

- Harta e generată cu AI, nu calculată din distanțele cărții. Test concret: 5 perechi
  cunoscute de distanțe din Nord (Karhold-Last Hearth, Dreadfort-Winterfell etc.) au
  dat scări între **1.14 și 6.99 mile/unitate** — variație de 6x în aceeași regiune.
  Nicio scară (unică sau regională) nu poate fi corectă peste tot.
- **Decizie finală:** poziționare DOAR pe regiune (calitativ — „undeva în Nord"), cu
  marcaj vizual explicit de aproximare (`sursa_coordonate: "manual"`, contur
  întrerupt/opacitate redusă pe hartă). Triangularea pe distanță reală, dezactivată
  definitiv ca strategie.
- **Stare curentă, verificată:** doar **77 de locații** (din 1041, adică ~7.4%) au
  poziție calibrată pe hartă (în `catalog.json`, sursa reală de coordonate — vezi
  §9.4 pentru arhitectura de coordonate). Restul există în date, căutabile, dar fără
  pin. Nu există niciun fallback automat de poziționare aproximativă în
  `MapRenderer.js` — verificat explicit, decizie asumată (nu bug), ca să nu aglomereze
  vizual sute de locații în același punct central de regiune.

**Arhitectură de coordonate, descoperită prin lucru, importantă pentru continuare:**
există DOUĂ sisteme paralele de coordonate — câmpul `coordinates` (legacy, în
`locations.json`, incomplet) și `data/map/catalog.json` → `maps.world.coordinates`
(sursa autoritară reală, folosită de `MapRenderer.js` la randare, prin
`getWorldCoordinate()` din `DataManager.js`). Orice lucru viitor de poziționare
trebuie să scrie în `catalog.json`, nu (doar) în `coordinates`.

---

## 6. Cronologia — neschimbată, confirmată funcțională

Strategia din planul original (regex D.C./Î.C. pe Foc și Sânge, ancoraj per-carte
pentru restul seriei principale, ~209 AC pentru Cavalerul celor 7 Regate) a fost
implementată și verificată: 1541/1662 evenimente noi au acum `year` numeric valid,
121 rămân explicit nedatate (`year: null`), excluse corect din timeline.

---

## 7. Ordinea de introducere a datelor pe niveluri — plan original, pentru referință

| Nivel | Conținut | Pe hartă? | Sursă |
|---|---|---|---|
| 1 | Case Nobile + Locații | Da (ancore + poziționare regională) | `statements_case_nobile`, `statements_locatii` |
| 2 | Evenimente | Nu (atașate la locație) | `statements_evenimente` |
| 3 | Distanțe | Nu (alimentează `DistanceTool.js`) | `statements_distante` |
| 4 | Personaje | Nu (listate în paginile caselor/evenimentelor) | `statements_persoane` |
| 5 | Alte detalii (obiecte, titluri) | Nu | `statements_alte_detalii` |

**Toate 5 au fost parcurse.** Detaliul real al fiecăruia, cu bug-uri găsite și stare
curentă, e la §9.

---

## 8. Editorul de hartă (`admin/map-editor.html`) — construit, reparat, funcțional

Nu era în planul original — a devenit necesar quando volumul de locații de plasat
manual a crescut. Istoricul reparațiilor (relevant dacă mai apar regresii):

1. **Bug inițial:** căutarea pierdea focus-ul la fiecare literă (re-randare completă
   a panoului la fiecare `oninput`). **Reparat:** salvare/restaurare poziție cursor.
2. **Bug inițial:** serverul raporta „salvat cu succes" chiar quando unele ID-uri nu
   se găseau nicăieri (`updated: len(coordinates)` în loc de numărul real scris).
   **Reparat**, în `server.py` și în client, cu avertisment vizibil separat.
3. **Bug inițial:** marker-ul tras cu mouse-ul „sărea" la următorul click, fiindcă
   drag-ul muta poziția direct în DOM fără să sincronizeze cache-ul intern de poziții
   al `MapRenderer.js`. **Reparat** prin `setRenderedPosition()`, sursă unică de
   adevăr pentru poziția vizuală.
4. **Bug inițial:** nicio confirmare vizuală la selectarea unei locații neplasate.
   **Reparat:** indicator pulsatoriu cu numele locației.
5. **Rafinare UX ulterioară:** trecere la model „trage din listă direct pe hartă"
   (funcționalitate care exista deja parțial, needescoperibilă) ca metodă principală,
   plus deselectare prin click-dreapta, plus hint de nume și la repoziționare (nu doar
   la prima plasare).

**Stare curentă:** funcțional, testat de utilizator direct, ~77+ locații plasate
manual până acum, plus puncte de ancoră noi în Est (vezi §9.5).

---

## 9. Starea reală, pe niveluri — CE MAI RĂMÂNE DE FĂCUT (secțiunea cea mai importantă)

### 9.1 Nivel 1 — Case + Locații: aproape complet, cu duplicate reparate

- Case: complet, stabil, fără probleme cunoscute de mult timp.
- Locații: merge făcut (333 originale + 738 noi = ar trebui 1071), poziționare
  regională parțial făcută.
- **Bug major găsit și reparat:** locații majore existau duplicat, sub nume românesc
  separat de cel englez original (fără punte de traducere la matching automat).
  Confirmate și reparate: King's Landing (exista de 3 ori: `kings_landing`,
  `debarcaderul_regelui`, `debarcaderul_regelui_fortareata_rosie`), Oldtown (de 2 ori:
  `oldtown_city`, `turnul_inalt`, `vechiul_oras_oldtown`), Storm's End
  (`sfarsitul_furtunii`). Conținutul narativ (evenimente, descrieri) a fost mutat
  corect în entitatea originală înainte de ștergere. **6 duplicate rezolvate.**
- **Rămân needecise:** 12 cazuri în `data/_import/etl_output/duplicate_locations_needecise.json`
  — nu s-au mai verificat/rezolvat.
- **DISCREPANȚĂ NEEXPLICATĂ, ÎNCĂ DESCHISĂ:** numărul total de locații e 1041, dar
  calculul așteptat (1071 − 6 duplicate șterse la King's Landing/Oldtown/Storm's End
  = 1065, apoi − 14 fantome Essos șterse separat = 1051) nu se potrivește cu 1041 —
  lipsesc 10 locații neexplicate. **Primul lucru de verificat în continuare:**
  compară `locations.json` curent cu un backup mai vechi (`data/_import/etl_output/backups/`)
  ca să vezi exact ce s-a mai șters/pierdut și dacă a fost intenționat.

### 9.2 Nivel 2 — Evenimente: funcțional, cu duplicate cunoscute, neatacate

- ETL rulat, merge făcut, Timeline conectat și funcțional (verificat: 298 AC → 99
  evenimente, 299 AC → 303, 300 AC → 239, toate corecte).
- **Duplicate cunoscute, NEREZOLVATE, decizie explicită de amânare:** scanare a găsit
  **17807 perechi candidate** în total (70 din coliziune original-vs-importat, 17737
  importat-vs-importat, majoritatea zgomot din suprapunere de an/participanți). La
  prag de scor ≥0.65: **386 perechi** rămân candidați serioși de duplicat real (ex.
  „Nunta Roșie" descrisă de 2-3 ori separat, ca entități diferite). Fișier:
  `data/_import/etl_output/duplicate_events_candidati.json`.
- **Decizie luată:** nu-i urgent — duplicatele arată o poveste de două ori pe
  Timeline, nu strică nimic funcțional. Amânat intenționat, nu uitat.

### 9.3 Nivel 3 — Distanțe: complet, verificat, fără probleme cunoscute

`DistanceTool.js` extins cu secțiune de distanțe narative, `distances.json` (467
perechi) integrat, cele 2 conflicte din sursă păstrate marcate (`⚠`), nicio valoare
aleasă tacit. Testat și confirmat funcțional pe multiple perechi, inclusiv după
reparația duplicatelor de la 9.1 (Winterfell↔King's Landing dădea 0, acum dă 2, corect).

### 9.4 Nivel 4 — Personaje: cel mai avansat nivel de curățare, dar ÎNCĂ deschis

Cel mai complex nivel, cu cea mai multă muncă de consolidare. Stare curentă:

- ETL rulat (11261 afirmații brute → 2470 personaje inițial).
- **Consolidare `title_at`/`died` implementată și verificată** (vezi §4) — funcțională,
  cu limitarea cunoscută a sinonimelor netratate.
- **Bug major găsit:** duplicate de identitate, același tipar ca la locații — nume cu
  prefix de titlu („Ser X" vs. „X", „Lordul X" vs. „X") creau entități separate pentru
  aceeași persoană. Exemplu confirmat: Jon Arryn exista de 3 ori.
- **Curățare făcută:** scanare completă → **167 grupuri** cu tipar prefix-titlu
  găsite; **129 confirmate automat** (cu semnal suplimentar — relații de familie,
  casă comună, moarte similară) și unificate; **38 needecise**, fără semnal de
  confirmare, puse deoparte (`data/_import/etl_output/nume_similare_neconfirmate.json`).
  Plus **32 din 33** clustere deja detectate anterior (scor ≥0.85) unificate; 1 exclus
  manual corect (Aegon II vs. Aegon V — persoane diferite, nu unificate din greșeală).
  **2470 → 2312 personaje** (158 duplicate reale eliminate).
- **Rescanare independentă, după curățare:** au mai rămas **33 de coliziuni de nume**
  — majoritatea sunt exact cele 38 needecise (corect, lipsă de semnal), dar au apărut
  și câteva dintr-un **tipar nou, nemenționat până acum**: sufix de poreclă/epitet
  („Dalton Greyjoy" vs. „Dalton Greyjoy Krakenul Roșu", „Hother Umber" vs. „Hother
  Umber Urgia Târfelor") și diferențe de punctuație/spațiere (`jaqen_hghar` vs.
  `jaqen_h_ghar`, `burta_de_bere` vs. `burtadebere`). **Nu a fost tratat încă, e
  material clar pentru un prompt viitor.**
- **RĂMÂN COMPLET NEATINSE, în fișiere de review generate dar nefolosite încă:**
  - **188 persoane ambigue** — `data/_import/entitati_ambigue_persoane_needecise.json`
  - **8 contradicții de familie** — `data/_import/etl_output/contradictii_familie_needs_review.json`
  - **86 entități de spart** (entități unite greșit la extragere, trebuie despărțite,
    operație inversă față de tot ce s-a făcut până acum) — `data/_import/entitati_de_spart.json`
  - **33 coliziuni rămase** (menționate mai sus, tipar nou de sufix/punctuație)

### 9.5 Nivel 5 — Alte detalii (Obiecte, Titluri): complet, verificat funcțional

`objects.json` (276) și `titles.json` (94) populate, verificate. Fără probleme
cunoscute la acest nivel.

### 9.6 Regiuni / hartă Est — lucru suplimentar, făcut în paralel cu nivelurile

Nu era în planul original — a apărut din nevoia de a extinde regiunile dincolo de
Westeros. Stare:

- Cele 12 regiuni originale (9 Westeros + Dincolo de Zid + Orașele Libere +
  „far_lands" ca o singură cutie uriașă pentru tot restul lumii) au fost auditate:
  poligoane inegale ca precizie (Nordul, foarte detaliat; Insulele de Fier, doar un
  dreptunghi), și un bug confirmat (`the_westerlands` nu acoperea Casterly Rock/
  Lannisport, care sunt la vest de orice punct din poligonul desenat).
- **Decizie luată:** subdivizare a „far_lands" în regiuni reale pentru Est (Marea
  Dothraki, Golful Sclavilor, Qarth, etc.), condiționată de plasare manuală de ancore
  în `admin/map-editor.html` (nu se poate automatiza — harta n-are etichete text, doar
  utilizatorul știe unde a gândit fiecare zonă când a generat-o cu AI).
- **Verificat, cu dublă confirmare independentă (utilizator + Claude):** după
  reparațiile de regiuni, `verify_all.py` rulează cu **58 matched, 6 mismatch** (toate
  cele 6 sunt insule, corect excluse din poligoanele de masă continentală — Dragonstone,
  Pyke, Driftmark, Claw Isle, Skagos, Tarth).
- **Rămân necalibrate pe hartă:** ~964 de locații (din 1041), fără nicio poziție —
  muncă manuală de continuat cu editorul, fără termen limită, ritm liber.

### 9.7 Alte fișiere de review generate, nefolosite/neverificate încă

Pe lângă cele deja menționate, verifică la începutul continuării dacă mai există
fișiere similare needecise create de agenți în timpul lucrului, necunoscute încă
acestei liste (agenții au tendința să genereze fișiere de audit suplimentare fără
să fie mereu cerute explicit — verifică `data/_import/` și `data/_import/etl_output/`
integral la începutul unei sesiuni noi).

---

## 10. Recomandare de prioritate pentru continuare

În ordinea în care aș ataca, dacă aș continua eu:

1. **Lămurește discrepanța de 10 locații** (§9.1) — poate fi ceva minor, dar
   „nu știu de ce a scăzut un număr" nu trebuie lăsat nerezolvat, e exact genul de
   lucru care mușcă mai târziu.
2. **Cele 33 de coliziuni rămase la personaje**, tipar nou (sufix/punctuație) — mic,
   izolat, rapid de rezolvat cu regula deja confirmată bună (semnal suplimentar
   obligatoriu, nu doar nume).
3. **Cele 86 de entități de spart** — operație inversă, importantă înainte să se mai
   adauge conținut peste entități unite greșit.
4. **Cele 188 + 8 needecise la personaje** — cer timp de citire manuală, nu grabă.
5. **Duplicatele de evenimente (386 la scor mare)** — amânat de la Nivel 2, tot valabil.
6. **Calibrarea celor ~964 de locații rămase pe hartă** — muncă manuală, fără presiune,
   se poate face oricând, în ritmul propriu, cu editorul deja reparat.

Nu există un „Nivel 6" în planul original — cele 5 niveluri acoperă tot ce era
planificat din `statements_*.json`. Dacă utilizatorul vrea să continue „cu restul
nivelurilor", clarifică ce înseamnă exact asta pentru el (poate: aplicarea completă a
curățeniei de mai sus, poate: funcționalități noi de UI, poate: ceva neplanificat
încă) — nu presupune.
