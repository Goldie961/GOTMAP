# Rafinare finală — Prompturi + Ghid

Continuă după `AUDIT_FINAL_v2_Stare_Reala.md`. Toate cele 5 niveluri sunt integrate;
acum urmează rafinarea calității, nu import de date noi. **6 prompturi**, în ordinea
recomandată la final.

---

## Tabel de ansamblu

| # | Prompt | Scop | Risc |
|---|---|---|---|
| A | Audit de integritate referențială | Găsește legături „moarte" către entități șterse/unificate | Mic (doar raport) |
| B | Căutare pe alias, afișare canonică | „Cetatea Roșie" găsește King's Landing, dar 1 rezultat, nu 14 | Mic |
| C | Raport de completitudine + țintire rafinare | Folosește `_completitudine` ca să știi unde să investești timpul | Mic (doar raport) |
| D | Dicționar de sinonime pentru titluri | Unește „Stăpân al Eyrie"/„Lord de Eyrie" la aceeași persoană | Mic |
| E | Consecvență vizuală pentru incertitudine | Badge de încredere peste tot unde există `confidence`, nu doar la moarte | Mic-Mediu (UI) |
| F | Decizie pagini-schelet | Ce faci cu entitățile cu aproape zero date | Mic (decizie + implementare simplă) |

---

## Ghid de folosire

1. **Ordinea recomandată: A → C → restul, în orice ordine.** A și C sunt „prompturi
   de raport" — nu schimbă nimic, doar îți arată exact ce merită atins. Fă-le primele,
   ca să nu rafinezi la întâmplare.
2. **Backup înainte de B, D, E, F** — astea chiar scriu în date/cod.
3. **Verifică fiecare, ca de obicei** — trimite-mi rezultatul (fișierul, nu doar
   raportul) înainte să treci la următorul.
4. **F cere o decizie a ta înainte de implementare** — promptul include o secțiune de
   analiză care se oprește și așteaptă răspunsul tău, nu implementează orbește.
5. **Nu combina prompturile** — chiar dacă par mici, fiecare atinge fișiere/module
   diferite; separat, e mai ușor de izolat dacă ceva merge prost.

---

## Prompt A — Audit de integritate referențială

```
Context: după multiple runde de unificare de duplicate (locații: King's Landing,
Oldtown, Storm's End; personaje: Jon Arryn + 157 alte cazuri), există risc real ca
legături existente către ID-urile șterse să fi rămas nesincronizate în alte fișiere
decât cele atinse direct de scripturile de merge.

Sarcină:
1. Scrie scripts/audit_referential_integrity.py — NU modifică nimic, doar raportează.
2. Verifică sistematic, pentru fiecare fișier de date:
   - data/events/events.json: câmpul `location` — există în locations.json?
     `participants` — fiecare id există în characters.json (sau e id_intern PERSON_*
     valid, verifică ambele formate)?
   - data/characters/characters.json: `membru_al` — există în houses.json?
     `parinti`/`copii`/`frati`/`casatorit_cu` — fiecare id există (ca id sau id_intern)
     în characters.json?
   - data/houses/houses.json: `relatii` (ally_of/enemy_of/vassal_of/liege_of) —
     fiecare id există?
   - data/locations/locations.json: `evenimente` — fiecare id există în events.json?
   - data/locations/distances.json: location_a_id/location_b_id — există în
     locations.json?
   - data/objects/objects.json și data/titles/titles.json: orice referință la
     personaje/case/locații — există?
3. Pentru fiecare referință ruptă găsită, notează: fișierul sursă, entitatea, câmpul,
   valoarea ruptă, și — dacă poți deduce — ce ID ar fi trebuit să fie (verifică
   id_map.json, poate ID-ul vechi a fost redirect-at acolo dar referința originală
   n-a fost actualizată).
4. Scrie raportul în data/_import/etl_output/audit_integritate_referentiala.json,
   grupat pe fișier și tip de problemă, cu numărul total de referințe verificate și
   numărul de rupte, per categorie.

NU repara nimic în acest prompt — doar raportează. Reparăm separat, după ce văd
amploarea reală.

Raportează: numărul total de referințe rupte găsite, grupate pe fișier/câmp, și 5
exemple concrete din cele mai frecvente tipuri găsite.
```

---

## Prompt B — Căutare pe alias, afișare canonică

```
Context: SearchEngine.js caută în prezent inclusiv prin array-ul `aliasuri` al
fiecărei entități, dar fiecare alias pare să genereze un rezultat vizual separat în
listă (verifică asta întâi — dacă nu-i deja așa, comportamentul curent poate fi deja
diferit de ce descriu aici, raportează ce găsești înainte de a repara). Rezultatul
dorit: căutarea „Cetatea Roșie" trebuie să găsească King's Landing, dar în lista de
rezultate afișată trebuie să apară UN SINGUR rând (King's Landing, numele canonic),
nu un rând per alias care se potrivește.

Sarcină:
1. Verifică comportamentul curent exact în SearchEngine.js/SearchBar.js — descrie ce
   găsești înainte de orice modificare.
2. Dacă găsești duplicare de rezultate (același id apărând de mai multe ori în listă
   fiindcă mai multe alias-uri se potrivesc): deduplică pe id înainte de afișare,
   păstrează un singur rând per entitate, indiferent câte alias-uri s-au potrivit.
3. Căutarea propriu-zisă (potrivirea text) rămâne neschimbată — tot căutăm și în
   `aliasuri`, `nume_canonic`, id_intern etc., NU restrânge la doar numele principal
   (asta ar reduce găsibilitatea, nu vrem asta).
4. Opțional, dacă simplu de adăugat: quando rezultatul e găsit printr-un alias, nu
   prin numele principal, poți afișa mic, secundar, „(găsit ca: Cetatea Roșie)" lângă
   rezultat — nu obligatoriu, doar dacă nu complică mult codul.
5. Verifică că fenomenul se aplică la toate tipurile căutabile (locații, personaje,
   case), nu doar la unul.

Verificare cerută: testează căutarea „Cetatea Roșie", „Ser Barristan" (dacă mai există
undeva ca alias după dedup), și un alias de locație cunoscut de-al tău — confirmă un
singur rezultat per entitate, cu numele canonic afișat.

Raportează: comportamentul găsit inițial, ce s-a schimbat, rezultatul celor 3 teste.
```

---

## Prompt C — Raport de completitudine + țintire rafinare

```
Context: fiecare entitate are deja un câmp `_completitudine.scor_total`, calculat la
ETL, dar nefolosit practic până acum pentru a ghida rafinarea. Vrem un raport care să
arate exact unde merită investit timpul.

Sarcină:
1. Scrie scripts/raport_completitudine.py — citește toate cele 6 fișiere de date
   (houses, locations, characters, events, objects, titles).
2. Pentru fiecare categorie, calculează:
   - distribuția scorurilor (histogram simplu: 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
   - lista celor mai slabe 30 de entități (scor cel mai mic), DAR filtrează din listă
     entitățile care sunt legitim minore (ex. o locație menționată o singură dată în
     treacăt nu trebuie să aibă scor mare, nu-i o problemă de rafinat) — folosește ca
     semnal secundar numărul de afirmații sursă (`surse`/`_afirmatii_pe_predicat`): o
     entitate cu scor mic DAR și puține surse brute probabil chiar are puține date
     disponibile în cărți, nu-i un eșec de extragere.
   - separat, lista entităților cu scor mic DAR MULTE surse brute — astea sunt
     suspecte de eșec de extragere/agregare, nu de sărăcie reală a sursei, prioritate
     mai mare de verificat.
3. Scrie raportul în data/_import/etl_output/raport_completitudine.json.

Raportează: distribuția pe fiecare categorie, și lista de 10-15 entități cu „scor mic,
surse multe" (cele mai suspecte), ca să pot decide pe ce să ne concentrăm primii.
```

---

## Prompt D — Dicționar de sinonime pentru titluri

```
Context: consolidarea title_at (Promptul 9, Nivel 4) deduplică pe similaritate de
text, prag 0.80, dar nu prinde sinonime — „Stăpân al Eyrie" și „Lord de Eyrie" rămân
titluri separate pentru aceeași persoană, deși înseamnă identic același lucru.

Sarcină:
1. Găsește funcția de consolidare title_at (scripts/consolidation_functions.py sau
   unde a ajuns integrată).
2. Adaugă un pas de normalizare ÎNAINTE de compararea de similaritate: un mic
   dicționar de sinonime — Stăpân=Lord, Doamnă=Lady, Cavaler=Ser, Rege=Suveran
   (verifică și alte perechi comune pe care le găsești efectiv în date, nu doar lista
   asta) — și elimină/normalizează prepozițiile „de"/„al"/„a"/„ai"/„ale" înainte de
   comparație.
3. IMPORTANT: normalizarea e DOAR pentru comparație (decizia de grupare) — textul
   afișat rămâne exact cum era în sursă, nu înlocui „Stăpân" cu „Lord" în ce se arată
   utilizatorului.
4. Rulează din nou consolidarea pe toate personajele (nu doar Nivel 4 la prima
   rulare), verifică ce s-a schimbat.

Verificare cerută: confirmă că „Stăpân al Eyrie"/„Lord de Eyrie"/„Lord al Eyrie-i" se
unesc acum într-un singur titlu la Jon Arryn (sau la orice altă persoană cu acest
tipar). Raportează câte personaje au avut titluri unificate suplimentar față de
rularea anterioară, cu 5 exemple.
```

---

## Prompt E — Consecvență vizuală pentru incertitudine

```
Context: InfoPanel.js/WikiPage.js afișează deja un badge de încredere pentru câmpul
`moarte` (confirmed/probable/uncertain). Verifică dacă același tratament vizual
există și pentru alte câmpuri disputate.

Sarcină:
1. Inventariază toate câmpurile cu `confidence` din schemă: `titles[].surse[].confidence`,
   `relatii` (case), `_afirmatii_pe_predicat` (orice predicat), afirmații de tip
   `possible_parent_of`, evenimente cu `confidence: uncertain` pe distanțe/relații.
2. Pentru fiecare, verifică dacă InfoPanel.js/WikiPage.js arată vizual diferența (chiar
   dacă minoră — o iconiță, o culoare, un „?" lângă text) sau tratează totul identic,
   indiferent de încredere.
3. Aplică același stil vizual deja folosit la `moarte` (badge, nu inventa un stil nou)
   pe toate câmpurile unde lipsește, păstrând consecvența.
4. Pentru relațiile de familie „posibile" (`possible_parent_of`) — asigură-te că apar
   vizual distinct de relațiile confirmate, nu amestecate în aceeași listă fără
   marcaj.

Raportează: lista câmpurilor verificate, care aveau deja tratament vizual corect, care
nu aveau și au fost reparate acum, cu o captură/descriere per caz reparat.
```

---

## Prompt F — Decizie + implementare pagini-schelet

```
Context: multe din cele ~738 de locații noi și ~2000 de personaje noi au foarte
puține date (menționate o singură dată în treacăt). Trebuie decis cum se tratează
vizibilitatea lor.

Sarcină, ÎN DOUĂ PAȘI — oprește-te după Pasul 1 și așteaptă decizia utilizatorului
înainte de Pasul 2:

PASUL 1 — Analiză, fără implementare:
1. Folosind raportul de completitudine (Promptul C, dacă a rulat deja) sau calculând
   direct, numără câte entități din fiecare categorie au scor_total sub un prag mic
   (ex. <0.15) ȘI puține surse (<2 afirmații brute).
2. Prezintă 2-3 opțiuni concrete, cu avantaje/dezavantaje pentru fiecare:
   a) le ascunzi din search/hartă complet, rămân doar accesibile prin legături
      directe de la alte pagini (ex. dintr-un eveniment).
   b) le arăți normal, dar cu un marcaj vizual clar „pagină minimă" / „date limitate".
   c) le arăți normal, fără marcaj, tratate identic cu restul.
3. NU implementa nimic încă — prezintă analiza și oprește-te.

PASUL 2 (după ce utilizatorul alege) — implementare:
Implementează opțiunea aleasă, cu pragul de completitudine ca variabilă configurabilă
ușor de ajustat ulterior (nu hardcodat adânc în cod).

Raportează la Pasul 1: numerele exacte per categorie, și cele 3 opțiuni clar descrise.
Așteaptă răspuns înainte de Pasul 2.
```
