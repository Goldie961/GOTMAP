# Raport Pas 4 — Evenimente

## 0. Decizie de proces (context important)

Înainte de generarea propriu-zisă, verificarea prealabilă a `entities.json` a arătat că
există deja **1663 entități `EVENT_...`** create într-o etapă anterioară (Pas 0),
majoritatea cu ID-uri generate din propoziția narativă completă (`nume_generat: true`),
exact anti-tiparul pe care regula critică din acest prompt îl interzice pe viitor.

La cererea ta, am aplicat **opțiunea 2**: pentru fiecare eveniment din cele 7 fișiere
`4.Evenimente`, am căutat un `EVENT_ID` existent folosind carte + pagină/fragment +
similaritate de conținut narativ (nu numele, nesigur din cauza `nume_generat`). Am
reutilizat ID-ul existent la potrivire clară; am creat ID nou doar dacă nu exista
corespondent; la potrivire neclară, am semnalat spre validare fără să aleg singur.

Rezultat: aproape toate evenimentele din aceste fișiere aveau deja un corespondent
(same content, ID prost format) — deci acest pas a produs în principal **afirmații noi
atașate unor ID-uri existente**, nu entități noi.

## 1. Fișiere excluse / procesate

- **Exclus explicit:** `FESTINUL CIORILOR/4.Evenimente/EVENIMENTE_CONSOLIDAT_COMPLET.md`
  (conform instrucțiunii). Folosit doar `EVENIMENTE_CONSOLIDAT_FESTINUL_CIORILOR.md`.
- Procesate toate celelalte 6 fișiere consolidate (câte unul per carte).

## 2. Volum procesat

| Carte | Intrări eveniment parsate | Potrivire clară (reutilizat ID) | Ambiguu (de verificat) | Fără corespondent / conținut insuficient |
|---|---|---|---|---|
| Cavalerul celor Șapte Regate | 69 | 69 | 0 | 0 |
| Dansul Dragonilor | 361 | 344 | 14 | 3 |
| Festinul Ciorilor | 199 | 194 | 5 | 0 |
| Focul și Sângele | 396 | 394 | 2 | 0 |
| Înclestarea Regilor | 464 | 457 | 7 | 0 |
| Iureșul Săbiilor | 244 | 244 | 0 | 0 |
| Urzeala Tronurilor | 99 | 99 | 0 | 0 |
| **Total** | **1832** | **1801** | **28** | **3** |

## 3. Entități noi create

**0 (zero).** Fișierul `evenimente_noi_create.json` este o listă goală.

Motiv: fiecare eveniment identificabil din aceste fișiere avea deja un `EVENT_...`
corespondent (creat în Pas 0), astfel încât regula "creează entitate nouă DOAR dacă nu
există deja echivalent" nu s-a aplicat niciodată în acest set de date. Cele 3 intrări
fără corespondent (vezi mai jos) nu întrunesc nici regula de numire (nu au un nume
propriu de tip Bătălia/Asediul/Nunta/etc.), deci nu au generat entități noi — sunt notițe
narative minore, nu evenimente cu nume propriu.

**Notă separată (nu am acționat, doar semnalez):** ID-urile existente rămân în formatul
"propoziție completă" (ex. `EVENT_NUNTA_ROSIE_IN_URMA_CAREIA_SE_PRESUPUNE_CA_FRATII_GLOVER_AU_MURIT`).
Nu le-am redenumit — nu era în mandatul acestui pas — dar dacă vrei un pas separat de
curățare/renume a registrului de evenimente, semnalează-mi.

## 4. Afirmații generate

**9919 afirmații atomice**, împărțite în:
- `statements_evenimente_part1.json` (2000)
- `statements_evenimente_part2.json` (2000)
- `statements_evenimente_part3.json` (2000)
- `statements_evenimente_part4.json` (2000)
- `statements_evenimente_part5.json` (1919)

Defalcare pe predicat:

| Predicat | Nr. afirmații |
|---|---|
| participant | 2825 |
| event_type | 1646 |
| what_happened | 1632 |
| location | 1497 |
| consequence | 1198 | 
| period_approx | 1121 |

Defalcare pe încredere: **9823 `confirmed`**, **96 `uncertain`** (provenite din cele 16
intrări marcate ⚠ în sursă).

`part_of` **nu a fost generat sistematic** — a stabili cu încredere ce evenimente sunt
sub-parte a unui război/eveniment mai mare (ex. bătălie parte a Războiului celor Cinci
Regi) necesită interpretare istorică per caz, nu doar potrivire de text; l-am lăsat
neacoperit ca să nu introduc relații greșite. Dacă vrei, pot face o trecere dedicată doar
pentru `part_of`.

## 5. Referințe lipsă / ambigue (persoană, locație)

La predicatul `participant`:
- **842** mențiuni de participant nu au găsit niciun `PERSON_.../HOUSE_...` corespunzător
  în registru — au rămas ca text liber în `object` (nu am inventat ID-uri).
- **71** mențiuni au găsit **mai multe** ID-uri candidate cu același nume — text liber,
  cu ambiguitate nerezolvată.

La predicatul `location`:
- **157** locații nu au găsit corespondent — text liber.
- **537** locații au găsit mai mulți `LOCATION_...` candidați cu alias identic (ex.
  "Castelul Negru" apare ca alias la 4 ID-uri diferite de sub-locații din registrul
  existent — problemă de duplicare din Pas 0, nu ceva ce am putut rezolva aici fără să
  aleg arbitrar).

Aceste cazuri nu blochează afirmația — sunt păstrate cu textul original în `object`,
astfel încât nimic din sursă să nu se piardă, dar merită o trecere de curățare a
registrului de persoane/locații dacă vrei matching mai precis pe viitor.

## 6. De verificat manual

`evenimente_nepotrivite_de_verificat.json` conține **31 intrări**:
- 28 cu potrivire ambiguă (mai mulți candidați apropiați ca scor de similaritate, fără
  suprapunere de pagină care să tranșeze clar)
- 3 cu conținut insuficient în sursă (fără text la "Ce s-a întâmplat", doar tip generic)

Fiecare intrare include textul original și până la 3 candidați posibili cu scorurile
lor, pentru decizia ta.

## 6bis. Reprocesare suplimentară — potrivire pe nume parțial (prenume/poreclă)

La cererea ta, am reluat DOAR afirmațiile `participant`/`location` cu `object` text liber
(913 participant = 842 fără corespondent + 71 ambigue la nume complet; 694 location = 157
fără corespondent + 537 ambigue la alias duplicat) și am încercat o potrivire suplimentară
pe prenume, poreclă/nickname (extras din paranteze sau ghilimele din `nume_canonic`) și
`aliasuri`, nu doar pe numele complet.

Reguli aplicate:
- Am indexat separat: (a) porecla/nickname-ul din paranteze sau „...” din `nume_canonic`,
  (b) primul cuvânt de conținut al numelui (prenumele real, după eliminarea titlurilor —
  Ser, Lord, Regele, Casa etc. — ca să nu potrivesc greșit pe cuvinte din titlu, ex. "de
  Riverrun"), (c) fiecare alias.
- Dacă un singur ID candidat rezultă → rezolvat automat.
- Dacă mai multe → am încercat restrângere după cartea-sursă a afirmației; dacă tot rămâne
  mai mult de un candidat → **lăsat text liber, neschimbat** (nu am ales automat).

**Rezultat:**
- `participant`: **286 din 913** rezolvate suplimentar la un `PERSON_.../HOUSE_...` ID
  (rămân 627 text liber, tot ambigue sau fără corespondent chiar și pe nume parțial).
- `location`: **53 din 694** rezolvate suplimentar la un `LOCATION_...` ID (rămân 641 text
  liber).

Motivul principal pentru care majoritatea rămân nerezolvate la `location`: registrul are
duplicate cu alias identic (ex. „Castelul Negru", „Riverrun", „Winterfell" apar ca alias
la mai multe ID-uri diferite de sub-locații) — potrivirea pe nume parțial nu poate alege
între ele fără o curățare a registrului. Pentru `participant`, motivul principal e prenume
comune purtate de mai mulți (ex. „Jon" — Jon Snow, Jon Arryn, Jon Connington etc.), rămase
corect nerezolvate.

## 7. Metodologie de potrivire (pe scurt)

Pentru fiecare eveniment nou-parsat: candidați restrânși la evenimentele existente din
aceeași carte; scor combinat din (a) suprapunere de pagină/fragment între câmpul
"Pagina (total)" al intrării și `prima_aparitie` a candidatului, și (b) similaritate de
text între "Ce s-a întâmplat" și `continut_narativ` al candidatului (comparație parțială,
ca să nu penalizeze trunchierea la ~100 caractere din `continut_narativ`). Potrivire clară
= similaritate foarte mare SAU scor înalt cu diferență mare față de al doilea candidat.
