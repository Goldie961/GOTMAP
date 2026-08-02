# Raport PAS 0 — Registrul global de entități

## 1. Fișiere scanate

Au fost scanate efectiv **42 de fișiere .md** (nu 45) — confirmat. Cele 3 fișiere-draft
excluse explicit conform instrucțiunilor:

- `INCLESTAREA REGILOR/3.Arbore/ARBORE_GENEALOGIC_3a.md`
- `INCLESTAREA REGILOR/3.Arbore/ARBORE_GENEALOGIC_3b.md`
- `FESTINUL CIORILOR/4.Evenimente/EVENIMENTE_CONSOLIDAT_COMPLET.md`

Repartizare: 7 cărți × 6 subfoldere (1.Locații, 2.CaseNobile, 3.Arbore, 4.Evenimente,
5.Alte detalii, 6.Distanțe) = 42 fișiere sursă valide, câte unul din fiecare subfolder
pentru fiecare carte.

**Notă despre metodologie:** dat fiind volumul corpusului (~106.000 de linii însumate
în cele 42 de fișiere), extragerea s-a făcut printr-un pipeline de scripturi Python
(parsare pe câmpuri structurate `**Nume:**`, `**Fragment N**`, `**Pagina (total):**`
etc.), nu prin citire manuală linie-cu-linie a fiecărei mențiuni. Regulile din prompt
(null vs. 0, capcana „Casa X" ca persoană, capcana titlurilor-container) au fost
implementate ca reguli explicite de clasificare, nu aplicate ad-hoc entitate-cu-entitate.
Această abordare a permis acoperirea completă a corpusului, dar înseamnă că verificarea
e sistematică/statistică, nu o citire manuală a fiecăreia dintre cele ~6.500 de intrări
finale — motiv suplimentar pentru care fișierele de revizuire (secțiunea 4) merită
atenția dumneavoastră.

În timpul construcției au fost identificate și corectate câteva probleme reale de
extragere (documentate pentru transparență):
- O mențiune sursă zgomotoasă ("Winterfell" listat drept „variantă de nume" a unui
  sept fără legătură) declanșa o unificare în lanț care înghițea zeci de locații
  fără legătură între ele într-o singură entitate. Soluție: unificarea automată se
  face acum *doar* pe potrivirea exactă a numelui principal normalizat, nu pe baza
  câmpurilor libere „Variante de nume întâlnite" — mai conservator, dar mai sigur.
- Un format de tip „tabel-sinteză" (în `IURESUL SABIILOR/3.Arbore`) înghesuia mai
  multe câmpuri pe un singur rând, corupând numele/ID-urile; a fost curățat.
- Porecle între ghilimele („Ned", „Regele Nordului" etc.) împiedicau unificarea
  corectă a acelorași persoane între cărți; au fost tratate ca aliasuri, nu ca nume
  separate.

## 2. Entități per tip

| Tip | Nr. entități unificate |
|---|---:|
| casa | 216 |
| locatie | 962 |
| persoana | 2469 |
| eveniment | 1663 |
| obiect | 277 |
| titlu | 79 |
| altele | 801 |
| **TOTAL** | **6467** (6449 după corecțiile din secțiunea 7 — 18 duplicate unificate) |

Fișierul rezultat a fost împărțit în 4 părți (dat fiind volumul):
`entities_part1.json` … `entities_part4.json`, aceeași schemă, fără suprapunere
(1617 / 1617 / 1617 / 1616 intrări).

## 3. Unificare automată între cărți

Unificarea s-a făcut **doar** pe potrivirea exactă a numelui principal normalizat
(diacritice eliminate, paranteze/ghilimele-nickname eliminate din cheia de comparație),
nu pe câmpurile libere de variante — vezi motivul de mai sus. Rezumat aproximativ al
reducerii prin unificare (mențiuni brute → entități unice):

| Tip | Mențiuni brute | Entități unice | Reduse prin unificare |
|---|---:|---:|---:|
| locatie | 1569 | 962 | 607 |
| casa | 513 | 216 | 297 |
| persoana | 4246 (minus 7 excluse) | 2469 | 1770 |
| eveniment | 1832 | 1663 | 169 |
| obiect+titlu+altele | 1314 (minus 62 excluse) | 1157 | 95 |

Numărul relativ mic de unificări pentru „eveniment" reflectă faptul că evenimentele nu
au un câmp „Nume" propriu-zis în sursă (secțiunea 4 nu conține deloc eticheta
„Fragment N" — confirmat, conform regulii din prompt); numele lor a fost derivat din
prima propoziție a câmpului „Ce s-a întâmplat", ceea ce reduce șansa de potrivire
exactă a acelorași evenimente istorice povestite diferit în cărți diferite. Acesta e un
compromis deliberat spre precizie (sub-unificare) mai degrabă decât risc de
suprapunere greșită.

## 4. Fișiere de revizuire

### `entitati_ambigue_de_verificat.json` — 42 de grupuri
Conțin nume (normalizate) care apar clasificate sub **tipuri diferite** în surse
distincte (ex. „Casa Bracken" apare atât ca `casa` cât și ca `locatie`; „Prinţul
Zdrenţăros" apare atât ca `persoana` cât și ca `titlu`; „Cioara cu trei ochi" apare
atât ca `persoana` cât și ca `altele`). Toate intrările au fost păstrate **separate**
în `entities_*.json` (nu s-a unificat automat), conform regulii 4. Fiecare grup conține
ID-urile implicate și cărțile de origine, pentru confirmare manuală.

### `persoana_case_de_verificat.json` — 7 intrări
Toate provin din `DANSUL DRAGONILOR/3.Arbore` — 7 mențiuni unde câmpul „Persoană:"
conținea de fapt un nume de casă („Casa Baratheon (linia Tommen)", „Casa Frey (arbore
extins)", „Casa Greyjoy", „Casa Lannister", „Casa Martell", „Casa Stark", „Casa
Tyrell"). Toate cele 7 au fost verificate automat: pentru fiecare există deja un
`HOUSE_...` echivalent în registrul de case (`HOUSE_BARATHEON`, `HOUSE_FREY`,
`HOUSE_GREYJOY`, `HOUSE_LANNISTER`, `HOUSE_MARTELL`, `HOUSE_STARK`, `HOUSE_TYRELL`),
deci au fost ignorate ca intrări `persoana` — nu a fost necesară crearea unui fișier
separat suplimentar, mențiunile fiind pur și simplu excluse din extragere.

### `titluri_invalide_eliminate.json` — 20 de intrări
Antete/containere descriptive din secțiunea 5.Alte detalii, clasificate sursă drept
„titlu" dar care nu sunt ele însele un titlu purtat de cineva — semnale folosite:
numele conține „Titluri" la plural (ex. „Titluri", „Titluri/porecle", „Titluri
conferite la numirea lui Tywin Lannister ca Mână a Regelui") sau e o formulă
descriptivă de context, nu textul titlului însuși (ex. „Titlul complet al regelui
Robert (la dictarea testamentului)", „Formula titulaturii regale (folosită la
execuții, sub Robert)", „Titlul purtat de Randyll Tarly"). Distribuite pe cărți:
Urzeala Tronurilor (7), Înclestarea Regilor (6), Iureșul Săbiilor (1), Festinul
Ciorilor (1), Dansul Dragonilor (4), Cavalerul celor 7 Regate (0), Foc și Sânge (1).

Notă suplimentară: 42 de mențiuni cu categoria sursă „poreclă" (nicknames) au fost
excluse din crearea de entități noi — sunt tratate ca aliasuri ale persoanelor deja
existente, nu ca entități separate, întrucât `tip: titlu/poreclă` nu există în schema
cerută și crearea lor separată ar fi dus la duplicate ale persoanelor deja
înregistrate.

## 5. Fragment / pagină — date reale vs. `null`

| Tip | Total | Are `fragment` real | Are `pagina` reală | Ambele `null` |
|---|---:|---:|---:|---:|
| casa | 216 | 129 (60%) | 196 (91%) | 10 (5%) |
| locatie | 962 | 693 (72%) | 752 (78%) | 57 (6%) |
| persoana | 2469 | 796 (32%) | 1308 (53%) | 673 (27%) |
| eveniment | 1663 | 0 (0%, prin definiție) | 1022 (61%) | 641 (39%) |
| obiect | 277 | 154 (56%) | 234 (84%) | 31 (11%) |
| titlu | 79 | 35 (44%) | 61 (77%) | 15 (19%) |
| altele | 801 | 391 (49%) | 602 (75%) | 144 (18%) |

Pentru **eveniment**, `fragment` este `null` pentru toate cele 1663 de intrări, prin
definiție — secțiunea 4.Evenimente nu conține deloc eticheta „Fragment N" în formatul
sursă (confirmat, conform observației din prompt), trasabilitatea folosind exclusiv
„Pagina (total)". Niciun `0` nu a fost folosit ca valoare de rezervă nicăieri în
registru — s-a folosit exclusiv `null` acolo unde nu exista o mențiune reală de
fragment/pagină.

## 6. Limitări cunoscute (pentru transparență)

- Unificarea conservatoare (doar pe nume principal exact) înseamnă că e posibil să
  existe entități duplicate sub nume ușor diferite între cărți (ex. o casă/locație
  numită diferit prin traducere/formulare într-o carte față de alta) care nu au fost
  unificate automat — sunt păstrate separat, conform regulii „dacă nu ești sigur, nu
  unifica automat".
- Câmpul `subtip` pentru locații și obiecte a fost extras din primul segment al unei
  liste adesea eterogene din sursă (ex. „regiune/promontoriu; regiune/ținut") — poate
  să nu reflecte întotdeauna cea mai bună descriere per entitate.
- Numele entităților `eveniment` sunt derivate din prima propoziție a descrierii
  faptice (sursa nu oferă un nume propriu-zis pentru majoritatea evenimentelor), deci
  unele ID-uri sunt lungi/descriptive mai degrabă decât nume proprii scurte.
- Dat fiind volumul (peste 6400 de intrări), verificarea a fost sistematică/pe reguli,
  nu manuală per-entitate; fișierele de revizuire din secțiunea 4 sunt punctul de
  pornire recomandat pentru orice audit suplimentar.

## 7. Corecții post-verificare (runda 2)

### 7.1 Deduplicare ID-uri

Au fost găsite și corectate **18 ID-uri** care apăreau de două ori în interiorul
aceluiași fișier `entities_part*.json` (4 în part1, 7 în part2, 2 în part3, 5 în
part4). Fiecare pereche a fost verificată individual, cu atenție specială la cazul
`PERSON_RICKARD_STARK` semnalat explicit — s-a confirmat că ambele mențiuni se
referă la aceeași persoană (Lordul Rickard Stark, tatăl lui Eddard), nu la un
strămoș omonim, așa că a fost unificată, nu diferențiată.

| Rezultat | Nr. cazuri |
|---|---:|
| Unificate într-o singură intrare | **18** |
| Diferențiate cu sufix (confirmate ca persoane/entități distincte) | **0** |

Pentru fiecare pereche unificată s-a păstrat cea mai completă `prima_aparitie`
dintre cele două (prioritate: date reale non-`null` > carte apărută mai devreme în
ordinea saga-i). În **5 din cele 18 cazuri** una dintre cele două surse conținea o
notă de incertitudine/dezambiguizare sau un artefact de extragere (mențiune OCR,
listă de aliasuri contaminată cu nume ale altor personaje) — acest conținut a fost
mutat într-un câmp nou, `"nota"`, și **nu** a rămas în `"nume_canonic"`:
`PERSON_RICKARD_STARK`, `PERSON_SANSA_STARK`, `PERSON_BROSCOIUL`, `OBJECT_GHEARA_LUNGA`,
`TITLE_TITLUL_DREPTATEA_REGELUI`. Pentru ultimele două, lista de aliasuri din sursa
duplicat s-a dovedit a conține nume ce aparțin clar altor entități (posibilă
contaminare de extracție) — acestea nu au fost fuzionate, ci semnalate în `"nota"`
pentru verificare manuală.

Fișierele au scăzut de la 6467 la **6449** de intrări totale (−18), fără nicio
intrare duplicată rămasă (verificat programatic, atât în interiorul fiecărui
fișier cât și global, între cele 4 fișiere).

### 7.2 Nume de evenimente

Din cele 1663 de entități `eveniment`, cele **1233** cu nume mai lung de 8 cuvinte
au fost reprocesate (celelalte 430 nu au fost atinse). Pentru fiecare dintre cele
1233:
- s-a căutat un nume propriu real în text (tipare precum „Bătălia (de la) X”,
  „Nunta Roșie”, „Rebeliunea X”, „Cucerirea lui X”, inclusiv variante puse între
  ghilimele în sursă);
- fraza narativă completă a fost mutată integral în câmpul nou `"continut_narativ"`
  — conținutul care va alimenta la Pas 4 predicatul „what_happened”/„result” — și nu
  a rămas ca nume de entitate;
- unde nu exista un nume propriu identificabil, s-a generat un nume scurt
  (≤8 cuvinte, cu extensie punctuală până la 9–10 cuvinte în cazurile în care
  trunchierea strictă la 8 ar fi tăiat un nume propriu de persoană/loc la mijloc),
  iar entitatea a fost marcată explicit `"nume_generat": true`.

| Rezultat | Nr. cazuri |
|---|---:|
| Nume real găsit în sursă (`nume_generat: false`) | **11** |
| Nume generat automat, marcat `nume_generat: true` | **1222** |
| **TOTAL reprocesate** | **1233** |

Cele 11 nume reale identificate: Războiul Fiicelor, Bătălia Apei Negre, „Bătălia
Câmpurilor” (menționată alături de Pădurea Șoaptelor), Bătălia de la Furca Verde a
Tridentului, Bătălia de la Moara Arsă, Nunta Roșie (3 mențiuni separate din cărți
diferite), Cucerirea lui Aegon, Rebeliunea Blackfyre, Rebeliunea Insulelor de Fier.

Numărul mic de nume reale găsite (11 din 1233) confirmă observația deja făcută în
secțiunea 3 a acestui raport: sursa nu oferă, pentru marea majoritate a
evenimentelor, un titlu propriu-zis — sunt fraze narative de tip jurnal de
evenimente, nu evenimente „numite” istoric. Cele 1222 de nume generate sunt
etichete scurte derivate algoritmic din propoziția narativă (nu sunt atestate ca
atare în text) și trebuie tratate ca atare — motiv pentru care fiecare a fost
marcată explicit.
