# Raport PAS 5 — Alte detalii utile (arme, obiecte, titluri, alte elemente)

## 1. Fișiere procesate

Cele 7 fișiere consolidate de secțiune „5.Alte detalii", câte unul per carte
(9.168 linii însumate), au fost parsate programatic pe câmpurile structurate
(`**Nume / concept:**`, `**Variante de nume întâlnite:**`, `**Categorie
(orientativ):**`, `**Descriere (combinată):**`, `**Pagina (total):**`).
S-au extras **1.314 intrări brute** — cifră identică cu cea raportată la
Pas 0 pentru totalul obiect+titlu+altele din aceleași fișiere sursă
(secțiunea 3 din `raport_pas0.md`), ceea ce confirmă acoperirea completă.

**Metodologie (transparență, ca la Pas 0):** dat fiind volumul, procesarea
s-a făcut printr-un pipeline Python, nu prin citire manuală a fiecăreia
dintre cele 1.314 intrări linie-cu-linie. Pipeline-ul a avut trei etape:

1. **Potrivire cu registrul existent** (`entities_part1-4.json`): fiecare
   „Nume / concept" a fost normalizat (fără diacritice, fără paranteze, fără
   ghilimele) și căutat printre `nume_canonic` + `aliasuri` din registru,
   inclusiv prin extragerea sub-șirurilor din ghilimele („X" → X) și
   eliminarea prefixelor gen „Cântecul", „Porecla", „Titlul". **1.261 din
   1.314** (96%) s-au potrivit automat cu un ID existent — de așteptat,
   întrucât registrul de la Pas 0 a fost construit din aceleași fișiere de
   secțiune 5.
2. **Triaj manual al celor 53 rămase nepotrivite** — fiecare a fost
   verificată individual (nu algoritmic): containere/formule agregate →
   excluse; nume/poreclă specifică și unică, fără duplicat în registru →
   entitate nouă; duplicat cu diferență minoră de formă (ex. articol
   hotărât) → legată de ID-ul existent.
3. **Descompunere în afirmații atomice**: „Descriere (combinată)" a fost
   spartă în clauze (pe `.` / `;`, cu protejarea parantezelor), apoi fiecare
   clauză a fost clasificată pe predicat prin tipare (ex. „purtat(ă) de X" →
   `owned_by`, „dăruit(ă)/oferit(ă) de X" → `given_by`, „făurit(ă)/forjat(ă)
   de X" → `made_by`, „din oțel/aur/argint..." → `material`); clauzele care
   nu s-au potrivit niciunui tipar au rămas `description` — atomice (o
   clauză = o afirmație), dar nereduse la o relație structurată. Pentru
   `owned_by`/`given_by`/`made_by`, numele din text a fost căutat în
   registrul de persoane/case pentru a înlocui textul liber cu ID-ul
   entității, acolo unde s-a găsit o potrivire clară.

Acest pas final (3) e cel mai puțin fiabil dintre cele trei — clasificarea
pe predicat e euristică, nu o interpretare propoziție-cu-propoziție făcută
de mine; recomand tratarea afirmațiilor cu predicat `description` ca strat
brut, util pentru citire, dar nu la fel de structurat ca `owned_by` /
`material` / etc. Afirmațiile cu predicat relațional (`owned_by`,
`given_by`, `made_by`) merită verificate prioritar, fiind mai puține (66 în
total) și mai ușor de validat rapid.

## 2. Elemente noi create

**22 entități noi**, toate de tip `titlu` (nume/porecle specifice, unice,
fără corespondent în registru), în `entities_pas5_additions.json` (gata de
adăugat la registru) și, cu referința la formularea originală din sursă, în
`elemente_noi_create.json`:

| Carte | Nr. entități noi |
|---|---:|
| Dansul Dragonilor | 3 |
| Festinul Ciorilor | 1 |
| Foc și Sânge | 9 |
| Înclestarea Regilor | 1 |
| Iureșul Săbiilor | 1 |
| Urzeala Tronurilor | 5 |
| Cavalerul celor 7 Regate | 0 |
| **Total** | **22** |

Zero entități noi de tip `obiect`/`altele` — toate elementele din acele
categorii aveau deja un ID din Pas 0. Singurul gol real era printre
poreclele/titlurile individuale citate direct în text (ex. „Regele Sudului",
„Lordul Aerului", „Ser Bunic" / „Barbă-albă", „Bizonul", „Degețelul") care nu
fuseseră create separat la Pas 0.

Trei potriviri suplimentare au fost legate manual de un ID existent, în
ciuda unei mici diferențe de formă (nu au fost create ca noi):
„Regicid" → `TITLE_PORECLA`; „Lord Suprem al Tridentului și Lord de
Harrenhal" → `TITLE_TITLUL_LORD_SUPREM_AL_TRIDENTULUI`; „Pezevenghiul"
(poreclă Tyrion) → deja alias pe `PERSON_TYRION_LANNISTER`.

## 3. Titluri-container filtrate

**28 de intrări** excluse ca antete/containere descriptive (conform regulii
critice din prompt), listate în `titluri_invalide_eliminate.json` — majoritatea
sunt aceleași tipare deja documentate la Pas 0 pentru acest corpus (etichetă
la plural: „Titluri", „Titluri/porecle"; formulă de titulatură regală
completă: „Titlul complet al lui X"; roster/regulă fără nume propriu:
„Garda Regelui, componență la acest moment").

**Limitare documentată:** unele containere (ex. „Porecle istorice notorii...",
„Poreclele dothraki pentru Viserys", „Apelativele Dany–Drogo") conțin în
descriere mai multe porecle individuale reale (14, respectiv 2, respectiv 2).
Din motive de volum/timp, acestea **nu au fost explodate** în entități
separate în această trecere — containerul a fost doar exclus, fără a crea
sub-entități pentru fiecare nume citat în interior. Recomand o trecere
suplimentară dedicată exclusiv acestor containere, dacă se dorește
acoperire completă a poreclelor individuale.

## 4. Afirmații generate

**2.338 afirmații atomice**, în 3 fișiere fără suprapunere:
`statements_alte_detalii_part1.json` (780), `part2.json` (780), `part3.json`
(778) — acoperind **1.030 de entități distincte** ca subiect (din cele
1.286 de intrări procesate; unele intrări diferite din cărți diferite se leagă
de același ID, ex. mențiuni repetate ale aceleiași săbii în mai multe cărți).

| Predicat | Nr. afirmații |
|---|---:|
| description | 1.369 |
| category | 898 |
| owned_by | 45 |
| given_by | 15 |
| made_by | 6 |
| material | 5 |
| found_at | 0 |
| lost_at | 0 |
| **Total** | **2.338** |

| Carte | Nr. afirmații |
|---|---:|
| Dansul Dragonilor | 666 |
| Festinul Ciorilor | 399 |
| Urzeala Tronurilor | 376 |
| Foc și Sânge | 333 |
| Iureșul Săbiilor | 296 |
| Cavalerul celor 7 Regate | 171 |
| Înclestarea Regilor | 97 |

**13 afirmații** marcate `confidence: "uncertain"` (proveniența: marcaj ⚠ în
sursă), niciuna aleasă subiectiv — extrase automat oriunde apărea simbolul.

`found_at`/`lost_at` nu au apărut deloc: tiparele „găsit la X"/„pierdut la
X" nu s-au regăsit literal în text în nicio clauză; informația de acest tip
(ex. unde a fost descoperit un obiect) există probabil în descrieri dar
formulată altfel (ex. „descoperit de X pe fundul unui cufăr la Standfast") —
a rămas clasificată drept `description` în loc de `found_at`, deci nu s-a
pierdut informația, doar nu s-a structurat pe acel predicat specific.

`source_fragment`: `null` peste tot unde textul menționează zero fragmente
sau mai multe fragmente diferite pentru aceeași intrare (nu s-a putut atribui
un singur fragment neambiguu clauzei); populat doar când exact un singur
„Fragment N" apărea în intrare. Niciun `0` folosit ca valoare de rezervă.

## 5. Recomandare pentru verificare manuală

Dat fiind caracterul euristic al pasului 3, recomand verificarea prioritară,
în ordine, a: (a) celor 66 de afirmații `owned_by`/`given_by`/`made_by` —
puține și cu impact mare dacă sunt greșite; (b) celor 22 de entități noi din
`elemente_noi_create.json`, înainte de a le adăuga definitiv în registru;
(c) celor 13 afirmații `uncertain`; (d) opțional, containerele cu porecle
individuale nedecompuse (secțiunea 3 de mai sus).
