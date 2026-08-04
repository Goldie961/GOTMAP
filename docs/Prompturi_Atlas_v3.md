# Prompturi de reparație — Atlas of Westeros v3

Derivat mecanic din `docs/VERIFICARE_FINALA.md` (audit 2026-08-04, HEAD `7d82dc5`).
Fiecare secțiune de mai jos conține **un singur bloc de copiat integral** în agent. Blocul include deja contextul, contractul de verificare, diagnosticul, cerințele și criteriile de acceptanță — nu trebuie să lipești nimic altceva.

**Ordinea:** R0.1 → R1.3 → R1.2 → R1.1 → R2.1 → R2.2 → R2.3 → R3.2 → R3.1 → R3.3 → R4.3 → R4.1 → R4.2 → R4.5 → R4.4 → R5.1 → R5.2 → R6.1 → R7.1

**Dacă ai timp doar pentru trei:** R0.1, R1.3, R1.1.

---

## R0.1 — Arborele de lucru și eras.json

`Claude Code` · fără dependențe · ~30min · repară HIGH-6

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Datele vin din extragere manuală și semi-automată
din traducerile românești, cu proveniență la nivel de pagină. Baza de date este
partea valoroasă; stratul de legătură date<->aplicație este partea fragilă.
Citește CLAUDE.md întâi. Ghidul complet de fază: docs/GHID_Implementare_Atlas_v2.md
Auditul care a generat sarcina: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită. Multe sunt
   operații unice deja aplicate; rerularea corupe datele.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă în datele proiectului = null.
3. Nu traduce automat nume proprii de univers. Merg la triaj manual.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi, marchează-le pe cele vechi ca
   deprecate. Textul original se păstrează întotdeauna undeva.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta o sarcină terminată fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează. Nu improviza.

CONTRACT DE VERIFICARE:
1. Rulează `git status --short` înainte de orice modificare. Dacă arborele nu e
   curat, oprește-te și raportează. Nu lucra peste modificări necommitate.
2. Orice transformare de date: backup automat + dry-run implicit. Scrierea cere un
   flag explicit (--apply). Raportează dry-run-ul înainte de a scrie.
3. La final raportează, obligatoriu:
   a. lista exactă a fișierelor modificate
   b. linii adăugate / șterse per fișier
   c. criteriul de acceptanță ca IEȘIRE DE COMANDĂ, nu ca afirmație
   d. orice premisă din sarcină care s-a dovedit inexactă
4. `node tests/smoke.mjs` trebuie să dea exit code 0 după modificare.
5. O sarcină = un commit. Nu amesteca faze.

SARCINĂ: fă repo-ul pornibil dintr-o clonă curată și arborele verificabil.

DIAGNOSTIC (măsurat în audit, secțiunea A1):
data/timeline/eras.json este UNTRACKED, dar js/data/DataManager.js:51 îl cere în
loadAll() alături de celelalte 16 seturi, cu gardă pe response.ok. Deci un
`git clone` proaspăt + `python server.py` NU pornește: fetch-ul dă 404, loadAll
aruncă, ecranul de loading rămâne blocat.
Pe lângă asta sunt 12 fișiere modificate necommitate, două dintre ele FIȘIERE DE
DATE (data/dragons/dragons.json 136 linii, data/houses/houses.json 32 linii).
tests/smoke.mjs NU citește eras.json, deci nu prinde regresia.

CERINȚE:
1. Verifică ce conțin cele 12 modificări necommitate. Grupează-le pe faze logice și
   commite-le separat, cu mesaje care spun ce fac. NU face un commit unic "wip".
   Dacă vreo modificare pare neintenționată, RAPORTEAZĂ înainte de commit.
2. `git add data/timeline/eras.json` — devine fișier urmărit. Verifică întâi că cele
   6 epoci din el sunt cele intenționate:
     age_of_heroes -114..0, conquest 1..37, targaryen_era 1..282,
     dance_of_dragons 129..131, roberts_rebellion 282..283,
     narrative_present 284..302
3. Decide ce faci cu data/_backups/ (untracked): sau intră în .gitignore, sau se
   commite. Nu-l lăsa în limb.
4. Adaugă data/timeline/eras.json în lista de fișiere citite de tests/smoke.mjs
   (blocul `temp` de la linia 23) și o aserțiune că are >=1 epocă și că fiecare
   epocă are id, start_year, end_year numerice cu start <= end.

CRITERIU DE ACCEPTANȚĂ:
   git status --short                    -> gol
   git stash list                        -> gol
   node tests/smoke.mjs; echo $?         -> 0
   ȘI, într-un director temporar, dintr-o clonă curată:
   git clone <repo> /tmp/atlas-test && cd /tmp/atlas-test && node tests/smoke.mjs
                                         -> exit 0
   Lipește ieșirea ambelor rulări.
````

---

## R1.3 — metadata.seat ca array de obiecte (26 de case)

`Claude Code` · depinde de R0.1 · ~2h · repară CRITICAL-3

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Datele vin din extragere manuală și semi-automată
din traducerile românești, cu proveniență la nivel de pagină. Baza de date este
partea valoroasă; stratul de legătură date<->aplicație este partea fragilă.
Citește CLAUDE.md întâi. Auditul care a generat sarcina: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi, marchează-le pe cele vechi ca
   deprecate.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. Rulează `git status --short` înainte de orice modificare. Dacă arborele nu e
   curat, oprește-te și raportează.
2. Orice transformare de date: backup automat + dry-run implicit. Scrierea cere
   --apply. Raportează dry-run-ul înainte de a scrie.
3. La final raportează: fișierele modificate, liniile adăugate/șterse per fișier,
   criteriul de acceptanță ca IEȘIRE DE COMANDĂ, și orice premisă inexactă.
4. `node tests/smoke.mjs` trebuie să dea exit code 0 după modificare.
5. O sarcină = un commit.

SARCINĂ: normalizează `seat` la încărcare, exact cum s-a făcut pentru `id_intern`.

DIAGNOSTIC (măsurat în audit, CRITICAL-3):
26 din cele 152 de case care au metadata.seat îl au ca ARRAY DE ÎNREGISTRĂRI DE
PROVENIENȚĂ, nu ca string:
  "seat": [{"directie":"subject","predicat_original":"seat","predicate":"seat",
            "valoare":"LOCATION_BLACKTYDE","confidence":"canon",
            "source_book":"Înclestarea Regilor","source_fragment":null,
            "source_page":null}, {...}]
Casele afectate (toate 26):
blacktyde, butterwell, casele_slate_long_holt_ashwood, casterly, caswell, chester,
durrandon, footly, franklyn, greystark, humble, loraq, merlyn, orkwood, pahl,
piper, plumm, poole, pryor, reyne, saltcliffe, serry, sunderland, sunderly,
tarbeck, webber
ACEASTA ESTE EXACT ACEEAȘI CLASĂ DE BUG ca `id_intern` string-sau-array
(CLAUDE.md §4.2), reparată pentru id_intern prin normalizare la încărcare și
RATATĂ pentru seat.
Cauza e în DATE (schema neuniformă), dar reparația corectă e în COD, în același loc
unde se rezolvă deja id_intern: js/data/DataManager.js:124-144, funcția
mapCompatibility. js/utils/entities.js are deja tiparul: toInternIds().

CERINȚE:
1. Adaugă în js/utils/entities.js o funcție resolveSeat(value) care întoarce
   { id: string|null, sources: array }:
      - string  -> { id: value, sources: [] }
      - array   -> { id: <primul `valoare` non-null>, sources: <toate înregistrările> }
      - altceva -> { id: null, sources: [] }
   Cu un comentariu care explică DE CE există, ca cel de la toInternIds.
2. Aplic-o în mapCompatibility (DataManager.js:124), pe același tipar ca id_intern:
   `seat` devine întotdeauna string sau null la rădăcină, iar proveniența ajunge
   într-un câmp nou `seat_sources`. NU șterge metadata.seat — rămâne sursa de
   adevăr pe disc.
3. Verifică toate cele 4 locuri de consum și lasă-le să citească forma normalizată:
      js/data/SearchEngine.js:48
      js/map/mapTarget.js:57
      js/ui/panels/houseSummary.js:25
      js/ui/WikiPage.js:735, 742
4. Alimentează SourceCite cu seat_sources în houseSummary.js — proveniența există
   deja în date și azi se pierde. Este exact tipul de câștig pe care P5.3 îl urmărea.
5. Mirror-uiește normalizarea în tests/smoke.mjs (funcția mapCompatibility locală,
   linia 50), altfel testul agreează cu el însuși și nu cu aplicația.

CRITERIU DE ACCEPTANȚĂ:
   node -e "…case cu typeof seat !== 'string' && seat !== null după mapCompatibility…"
       -> 0
   node -e "…dm.getLocation(dm.getHouse('blacktyde').seat)…"
       -> întoarce locația blacktyde, nu undefined
   node tests/smoke.mjs -> exit 0
   Zero modificări în data/houses/houses.json (git diff --stat -> fișierul nu apare)
````

---

## R1.2 — Dragonii duplicați între dragons.json și objects.json

`Claude Code` · depinde de R0.1 · ~3h · repară CRITICAL-2 + HIGH-4

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Datele au proveniență la nivel de pagină.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi, marchează-le pe cele vechi ca
   deprecate.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup automat + dry-run implicit; scrierea cere
   --apply; raportează dry-run-ul înainte de a scrie.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: unifică dragonii într-o singură colecție și extinde-o la ce susțin datele.

DIAGNOSTIC (măsurat în audit, CRITICAL-2 și HIGH-4):
1. data/dragons/dragons.json are 5 înregistrări: balerion, vhagar, meraxes,
   caraxes, syrax. Schema e cea bilingvă nouă (name_ro/name_en/birth/death/riders/
   events/surse). Cele 10 referințe din events[] rezolvă toate (10/10).
2. data/objects/objects.json conține 7 dragoni cu categorie "obiect / ființă
   (dragon)" sau categorie null:
      balerion, cannibal, dreamfyre, meraxes, silverwing, vermithor, vhagar
3. DECI: balerion, vhagar, meraxes există în AMBELE fișiere, CU ACELAȘI id.
   Search-ul indexează ambele. /wiki/object/balerion și /wiki/dragon/balerion sunt
   două pagini pentru același Balerion.
4. Înregistrările din objects.json sunt SURSA MAI BOGATĂ: au `descrieri` cu
   fragmente citate și `surse` cu source_book/source_page. Cele din dragons.json au
   structura (birth/death/riders) dar descrieri sărace.
5. În events.json apar 26 de nume de dragoni:
   Balerion, Vhagar, Meraxes, Caraxes, Syrax, Vermithor, Silverwing, Seasmoke,
   Sunfyre, Moondancer, Tessarion, Vermax, Arrax, Tyraxes, Stormcloud, Morghul,
   Shrykos, Dreamfyre, Meleys, Cannibal, Sheepstealer, Grey Ghost, Drogon, Rhaegal,
   Viserion, Quicksilver
   Deci wiki-ul de dragoni e la ~19% din ce susțin datele proiectului.

CERINȚE:
1. FAZA DE RAPORT, fără scriere. Pentru fiecare din cele 26 de nume, extrage din
   events.json, characters.json, objects.json, locations.json tot ce se poate:
   călăreț, an de naștere, an de moarte, locul morții, evenimente în care apare,
   sursă (carte + pagină). Produce un tabel: nume | câmpuri găsite | surse | ID-uri
   de evenimente. RAPORTEAZĂ-L ÎNAINTE de a scrie ceva. Eu îl aprob.
2. NU INVENTA. Un dragon pentru care datele nu spun anul nașterii primește
   birth: null, nu anul din memoria ta sau de pe wiki-uri externe. Asta e
   interdicția permanentă nr. 2 și e motivul pentru care fișierul are 5 intrări și
   nu 20 de intrări inventate.
3. Migrează cei 7 din objects.json în dragons.json, PĂSTRÂND `descrieri` și `surse`.
   Pentru cei 3 care există în ambele, fuzionează: structura din dragons.json +
   descrierile/sursele din objects.json.
4. NU șterge din objects.json (CLAUDE.md §5.4). Marchează cele 7 înregistrări cu
   deprecated: true și superseded_by: "dragon/<id>". Exclude-le din indexarea de
   search printr-un filtru explicit în js/data/SearchEngine.js, comentat cu motivul.
5. Adaugă restul dragonilor pentru care ai găsit măcar un fapt sursat. Câmpurile
   fără sursă rămân null. Fiecare câmp completat are source_book + source_page sau e
   marcat `inferred`.
6. Verifică ce se întâmplă cu stratul de dragoni de pe hartă: markerele se generează
   din dragon.events[].event_id (js/map/MapRenderer.js:653-661), deci dragonii noi
   apar pe hartă doar dacă au events[] cu id-uri care rezolvă.

CRITERIU DE ACCEPTANȚĂ:
   node -e "…intersecție de id-uri între dragons.json și objects.json activi…" -> 0
   node tests/smoke.mjs -> 'Search index: dragon' arată noul număr, iar
       'Search index: object' scade cu exact 7
   Numărul de înregistrări din objects.json -> NESCHIMBAT (276), doar marcate
   Fiecare câmp non-null din dragons.json are sursă sau flag `inferred` —
       demonstrează cu un script care numără câmpurile fără nici una.
````

---

## R1.1 — Numele românești greșite de locație

`Claude Code (analiză) + TU (decizia)` · depinde de R0.1 · ~2h · repară CRITICAL-1

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki bilingv RO/EN pentru ASOIAF. Datele au proveniență la nivel de
pagină. Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers. Merg la triaj manual.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi, marchează-le pe cele vechi ca
   deprecate.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: oprește afișarea de nume de canon GREȘITE în interfața românească.

DIAGNOSTIC (măsurat în audit, CRITICAL-1):
Din 56 de locații care au și name_ro și name_en, cel puțin 7 perechi denumesc
LOCURI DIFERITE. Cauza este în DATE (split-ul de nume din P3.2), NU în cod:
js/i18n/entityName.js:resolveName() face corect ce i se cere — pasul 1 al scării de
fallback preferă name_<lang> scris explicit, iar acela e greșit.

  id                     | name_ro (GREȘIT)      | name_en                    | ce e greșit
  kings_landing          | Fortăreața Roșie      | King's Landing (Aegonfort) | Fortăreața Roșie e o clădire ÎN oraș
  white_harbor_city      | Gâtul                 | White Harbor               | Gâtul e o regiune la 1000 mile
  garda_apei_cenusii     | Garda Apei Cenușii    | Stone Door                 | perechi complet nelegate
  fundatura_puricilor    | Fundătura Puricilor   | King's Landing             | Flea Bottom != orașul
  strada_otelului        | Strada Oțelului       | King's Landing             | idem
  casa_celor_nemuritori  | Casa Celor Nemuritori | House of Dust              | e House of the Undying
  the_eyrie              | Ținutul Eyrie         | The Eyrie                  | "Ținutul" = regiunea, nu castelul
  white_harbor           | Portul Alb            | New Keep (White Harbor)    | nepotrivite

Interfața pornește pe RO. Capitala Westerosului se afișează azi ca "Fortăreața
Roșie" în panou, în wiki și în rezultatele de căutare.

CERINȚE:
1. Scrie un script READ-ONLY care listează TOATE cele 56 de perechi
   (id, name, name_ro, name_en, type) și le clasifică în trei coșuri:
      OK      — traduceri plauzibile ale aceluiași loc
      SUSPECT — perechi unde un capăt e evident alt loc
      NEDECIS — nu se poate stabili automat
   Criteriul de suspiciune NU e euristic pe text: e faptul că numele englez sau
   român apare ca nume principal la ALTĂ înregistrare din locations.json.
   RAPORTEAZĂ tabelul complet. NU modifica nimic în pasul ăsta.
2. Nu repara automat. Perechile SUSPECT merg la triaj manual — mecanismul există
   deja: admin/triage.html + triage.py. Adaugă-le în coada de triaj ca tip nou de
   sarcină ("nume bilingv contradictoriu"), cu ambele variante și cu sursele.
3. Adaugă în date, NU șterge (CLAUDE.md §5.4): marchează perechile SUSPECT cu
   name_review_status: "contested" la nivel de înregistrare. Câmpurile name_ro și
   name_en rămân neatinse.
4. Repară în COD comportamentul de afișare pentru cazul contestat:
   js/i18n/entityName.js:resolveName() — dacă name_review_status === "contested",
   pasul 1 se sare și rezolvarea cade pe pasul 4 (numele brut `name`), cu badge de
   limbă. Un nume brut corect e mai bun decât un nume tradus greșit.
   Documentează asta în docs/I18N_ARHITECTURA.md ca a treia excepție a scării.

CRITERIU DE ACCEPTANȚĂ:
   node -e "…displayName(getLocation('kings_landing'),'ro')…"
       -> NU mai întoarce "Fortăreața Roșie"
   Deschide aplicația pe RO, click pe King's Landing -> panoul NU mai scrie
   "Fortăreața Roșie". Lipește textul randat.
   node tests/smoke.mjs -> exit 0
   Numărul de înregistrări din locations.json, înainte și după -> identic.
````

---

## R2.1 — „[OBJECT OBJECT]" în interfață

`Codex` · depinde de R1.3 · ~45min · repară HIGH-1

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: fă imposibilă randarea unui obiect ca text în panourile de sumar.

DIAGNOSTIC (observat live în audit, HIGH-1):
js/ui/panels/parts.js:126-129:
    export function formatStatus(status) {
      if (!status) return null;
      return String(status).replace(/_/g, ' ').toUpperCase();
    }
Apelat din js/ui/panels/houseSummary.js:25-27 cu `seat`, care pentru 26 de case e
un array de obiecte. String([{...},{...}]) -> "[object Object],[object Object]".
Text randat, capturat din browser:
    ×Casa Blacktyde HOUSE Fișă sumară · Regiune THE IRON ISLANDS
    Reședință / Capitală [OBJECT OBJECT],[OBJECT OBJECT] · Vezi pagina completă →
Badge-ul verde îl prezintă ca informație sursată canon.
R1.3 elimină CAUZA. Sarcina asta elimină CLASA de bug, ca să nu reapară pe alt câmp.

CERINȚE:
1. formatStatus() și formatRegionName() primesc o gardă de tip: dacă valoarea nu e
   string sau number, întoarce null și loghează o dată cu console.warn, numind
   câmpul și entitatea. Un rând lipsă e mai bun decât un rând corupt.
2. createMetaRow() (parts.js:52) face String(value) necondiționat la linia 56.
   Aceeași gardă: dacă valoarea nu e primitivă, nu construi rândul deloc.
3. Caută în js/ui/ toate locurile care fac String(x) sau interpolare pe o valoare
   venită direct din date și listează-le în raport. Aplică aceeași gardă unde e
   cazul.
4. NU rezolva problema convertind array-ul la primul element aici — asta ar ascunde
   schema neuniformă în stratul de prezentare. Normalizarea e treaba lui R1.3, la
   încărcare.

CRITERIU DE ACCEPTANȚĂ:
   grep -rn "OBJECT OBJECT" în ieșirea randată a celor 26 de case -> 0
   Deschide Casa Blacktyde în browser -> rândul "Reședință / Capitală" arată
       "BLACKTYDE" cu citarea sursei, sau lipsește. Lipește textul randat.
   node tests/smoke.mjs -> exit 0
````

---

## R2.2 — Cele 26 de case fără poziție pe hartă

`Codex` · depinde de R1.3 · ~30min · repară HIGH-2

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: verifică și dovedește că cele 26 de case își recuperează sediul pe hartă.

DIAGNOSTIC (măsurat în audit, HIGH-2):
js/map/mapTarget.js:57-60:
    const seatId = entity.seat || entity.city || entity.metadata?.seat || null;
    const locationId = seatId ? stripEntityPrefix(String(seatId)) : entity.id;
    const location = manager.getLocation?.(locationId);
    if (!location) return null;
String(seatId) pe array -> "[object object],[object object]" -> getLocation() ->
undefined -> resolveMapTarget() -> null -> hasMapPosition() fals -> butonul
"arată pe hartă" lipsește și camera nu zboară la sediu, DEȘI sediul este în date
(LOCATION_BLACKTYDE există ca locație validă).
R1.3 ar trebui să repare asta automat. Sarcina e să DOVEDEȘTI că a reparat-o, nu să
presupui.

CERINȚE:
1. Scrie o verificare în tests/ care iterează toate casele cu `seat` și raportează
   câte au hasMapPosition() === true. Rulează-o înainte și după R1.3.
2. Pentru cele care rămân fără poziție după R1.3, stabilește motivul real (sediu
   care chiar nu are pin, sediu care nu există ca locație, sediu care e sub-locație
   fără ancoră) și raportează-l pe categorii. NU forța un rezultat.
3. mapTarget.js:57 — după R1.3, entity.metadata?.seat din lanțul de fallback devine
   ramură moartă (rădăcina e mereu populată). Verifică și, dacă e moartă, șterge-o
   cu comentariu, ca ramura `hightower` din P4.1.

CRITERIU DE ACCEPTANȚĂ:
   node tests/<noul-test>.mjs
       -> "case cu seat: N | cu poziție pe hartă: M" — M crește cu ~26 față de
          rularea dinainte de R1.3. Lipește AMBELE rulări.
   Deschide Casa Blacktyde în browser -> butonul de hartă există și camera zboară.
````

---

## R2.3 — getEntityById() rezolvă fără tip peste 46 de coliziuni

`Codex` · depinde de R0.1 · ~1h · repară M-6

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: elimină rezolvarea ambiguă de entități în linkurile interne.

DIAGNOSTIC (măsurat în audit, O-4 și M-6):
46 de id-uri există simultan ca LOCAȚIE și ca CASĂ (iar `wyl` și ca PERSONAJ):
crakehall, yronwood, hornwood, darry, redfort, sarsfield, banefort, cuy, blackmont,
vaith, wyl, tarth, estermont, rosby, stokeworth, hayford, volmark, harlaw,
saltcliffe, blacktyde, … (26 în plus)
Asta e LEGITIM în date: Casa Darry și castelul Darry sunt entități diferite. Rutele
/wiki/:kind/:id sunt corecte și dezambiguizează.
Problema e js/ui/panels/parts.js:38-45:
    function getEntityById(id) {
      const cleanId = stripEntityPrefix(id);
      const matches = item => item.id === id || matchesInternId(item, id) || item.id === cleanId;
      return window.atlasDataManager?.getAllLocations?.().find(matches)
        || data?.houses?.find(matches)
        || data?.characters?.find(matches) || null;
    }
Caută locations -> houses -> characters, fără tip. Un link intern către CASA `darry`
deschide CASTELUL `darry`. Pentru toate cele 46.

CERINȚE:
1. getEntityById() primește un parametru de tip obligatoriu la apelanții care îl
   cunosc (majoritatea îl cunosc — relația din care vine linkul spune dacă e casă
   sau locație).
2. Acolo unde tipul chiar nu e cunoscut, funcția trebuie să RAPORTEZE ambiguitatea
   (console.warn cu ambele candidate), nu să aleagă tăcut prima.
3. Scrie o verificare care listează, pentru toate cele 46 de id-uri, ce entitate
   întoarce fiecare call site. Raporteaz-o înainte și după.
4. .find() liniar peste getAllLocations() la fiecare link — folosește indexul care
   există deja (DataManager.locationIndex, O(1)).

CRITERIU DE ACCEPTANȚĂ:
   node -e "…pentru cele 46 de id-uri, getEntityById(id,'house').type === 'house'…"
       -> 46/46
   node tests/smoke.mjs -> exit 0
````

---

## R3.2 — Cele 217 locații încă type:"location"

`Antigravity` · depinde de R0.1 · ~3h · repară M-4

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Datele au proveniență la nivel de pagină.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup automat + dry-run implicit; scrierea cere
   --apply; raportează dry-run-ul înainte de a scrie.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: termină clasificarea taxonomică începută în P2.3.

DIAGNOSTIC (măsurat în audit, D2/D3):
217 din 1099 de înregistrări au încă type:"location" — bucketul netriajat. Ele sunt
excluse din getAllLocations(), din hartă și din search, dar RĂMÂN selectabile ca
capete de distanță — deci utilizatorul poate alege un capăt pe care nu-l poate găsi
altfel nicăieri.
În plus, 608 din 1099 nu au deloc classification_confidence:
  {"(absent)":608, "high":401, "medium":90}   — zero "low", corect
Clasificarea din P2.3 a acoperit 45% din date.
Histograma completă de tipuri e în docs/VERIFICARE_FINALA.md §D.

CERINȚE:
1. Rulează clasificatorul din P2.2 pe cele 217, în DRY-RUN. Raportează distribuția
   propusă și câte rămân nedecise.
2. Cele nedecise merg în coada de triaj, nu într-o ghicire.
3. Fiecare înregistrare clasificată primește și classification_confidence. Cele cu
   `low` NU intră în datele live (regula D3 din audit, azi respectată — păstreaz-o).
4. ATENȚIE la regresie: auditul verifică 8 cazuri (kings_landing, crakehall,
   acorn_hall, brightwater_keep, maidenpool, blackpool, harroway_town, boneway).
   Niciun castel nu are voie să devină `interior`, `chamber`, `lake` sau `road`.
   Azi toate 8 sunt corecte. Verifică-le după.

CRITERIU DE ACCEPTANȚĂ:
   node -e "…locations cu type==='location'…" -> raportează noua cifră
   node tests/smoke.mjs -> 'getAllLocations()' arată noua cifră; exit 0
   Cele 8 cazuri de regresie -> tipurile lor, lipite ca ieșire
````

---

## R3.1 — Stratul de bătălii ratează 19 din 21

`Antigravity + triaj manual` · depinde de R0.1 · ~3h · repară HIGH-3

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Datele au proveniență la nivel de pagină.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup automat + dry-run implicit; scrierea cere
   --apply; raportează dry-run-ul înainte de a scrie.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: completează câmpul `type` la evenimente, ca stratul de bătălii să
funcționeze.

DIAGNOSTIC (măsurat în audit, HIGH-3):
js/map/MapRenderer.js:649-651 filtrează event.type === 'battle'. Codul e corect.
Problema e în DATE: din 1689 de evenimente, 1662 NU AU DELOC câmpul `type`.
  histograma: [["(none)",1662],["battle",8],["political",8],["conquest",5],
               ["coronation",2],["founding",1],["death",1],["catastrophe",1],
               ["war",1]]
Din 21 de evenimente al căror NUME e o bătălie sau un asediu, doar 2 au
type:"battle"; 19 nu au tip deloc, inclusiv:
  batalia_de_la_apa_neagra, batalia_campiilor_de_foc, batalia_clopotelor,
  asediul_raventree_ului, batalia_de_la_coarnele_lui_hazzat,
  asediul_si_arderea_vizuinii_lupilor, batalia_apei_negre_stannis_prins…
Stratul randează 7 markere.

CERINȚE:
1. NU repara filtrul lărgindu-l cu regex pe nume. Asta ar inventa o taxonomie din
   text liber și e exact greșeala pe care `subtip` o ilustrează (572 de valori, 497
   unicate). Cauza e în date; se repară în date.
2. Definește un vocabular ÎNCHIS de `type` pentru evenimente, pornind de la cele 9
   valori care există deja. Documentează-l în docs/TAXONOMIE_v2.md.
3. Scrie un clasificator cu dry-run care propune un `type` pentru evenimentele fără
   el, pe baza câmpurilor structurate existente (factions, participanti, location,
   predicatele din _afirmatii_pe_predicat) — NU pe baza numelui. Raportează
   distribuția propusă și rata de acoperire ÎNAINTE de a scrie.
4. Tot ce clasificatorul nu poate decide cu încredere merge în coada de triaj
   (admin/triage.html), nu într-o ghicire.
5. Adaugă `type` ca ADĂUGARE de câmp. Nu atinge celelalte câmpuri.
6. Verifică apoi câte dintre evenimentele type:"battle" au și o locație rezolvabilă
   prin getMappableAnchor() — numai acelea primesc marker.

CRITERIU DE ACCEPTANȚĂ:
   node -e "…evenimente cu type absent…"  -> scade semnificativ; raportează cifra
   node -e "…evenimente type='battle' cu locație rezolvabilă…" -> raportează
   În browser, stratul "Bătălii" -> numărul de markere; lipește-l.
   Numărul de înregistrări din events.json, înainte/după -> identic (1682)
````

---

## R3.3 — Locații fragmentate și aliasuri corupte

`Claude Code (analiză) + triaj manual` · depinde de R3.2 · ~4h · repară M-5, M-7

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki bilingv pentru ASOIAF. Datele au proveniență la nivel de pagină.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON. Adaugă câmpuri noi, marchează-le pe cele vechi ca
   deprecate.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: identifică înregistrările care descriu ACELAȘI loc și aliasurile rupte.

DIAGNOSTIC (măsurat în audit, M-5 și M-7):
A) FRAGMENTARE — 12 grupuri de nume, 27 de înregistrări pentru 12 locuri reale:
   "fortareata rosie" x4 : fortareata_rosie_debarcaderul_regelui[stronghold],
                           fortareata_rosie_fortareata_lui_maegor[stronghold],
                           fortareata_rosie_implicit_locul_scenei_cu_kevan…[stronghold],
                           fortareata_rosie_turnul_mainii[structure]
   "Maegor's Holdfast" x3: cetatuia_lui_maegor, citadela_lui_maegor,
                           fortareata_lui_maegor
   "sunspear" x3         : sunspear[castle], sunspear_dorne[stronghold],
                           sunspear_palatul_vechi_din_sunspear[stronghold]
   "insulele de fier" x2 : insulele_de_fier[island], insulele_de_fier_pyke[stronghold]
   plus: driftmark, gatul, golful_negustorilor_de_sclavi, insula_cedrilor,
         marea_fumeganda, muntii_rosii, poarta, poarta_raului, sothoryos
   Tiparul de id A_B (unde A și B sunt locuri diferite) arată artefacte de extragere:
   mențiunea "Fortăreața Roșie / Turnul Mâinii" a devenit o entitate. Cea mai lungă
   are 317 caractere și înșiră 17 toponime.
B) ALIASURI RUPTE — 22 de aliasuri pe 14 locații au paranteze dezechilibrate:
   kings_landing :: ["Debarcaderul Regelui (malul apei", "Red Keep)", "cheiul)", "orașul"]
   riverrun      :: ["Sera Lordului Hoster (glass garden", "balcon)"]
   bitterbridge  :: ["Bitterbridge)", "Podul Amar (Stonebridge"]
   Sunt INDEXATE în search, deci apar ca "potrivit pe alias: cheiul)".

CERINȚE:
1. FĂRĂ FUZIUNE AUTOMATĂ. Fuziunea de entități e ireversibilă și pierde proveniență.
   Produce un RAPORT cu grupurile candidate și propunerea pentru fiecare (fuziune /
   părinte-copil prin parent_id / entități distincte). Amintește-ți P4.4: Oldtown a
   fost rezolvat prin parent_id, nu prin fuziune, și a fost decizia corectă.
2. Pentru aliasuri: detectează cele cu paranteze dezechilibrate și cele care sunt
   evident fragmente ("orașul", "cheiul)", "balcon)"). NU le șterge (CLAUDE.md §5.4).
   Mută-le într-un câmp `aliases_rejected` și exclude acel câmp din indexarea de
   search (js/i18n/entityName.js:allAliases).
3. Detectorul de fragmente NU e o listă de cuvinte: e regula "alias care nu apare
   niciodată ca nume propriu în corpus + are paranteză dezechilibrată".
4. Extinde acoperirea dincolo de cele 12 grupuri: rulează gruparea și pe name_ro și
   pe aliasuri, nu doar pe `name`, și raportează câte grupuri noi apar.

CRITERIU DE ACCEPTANȚĂ:
   Raportul de grupuri candidate, complet, în docs/
   node -e "…aliasuri cu paranteze dezechilibrate rămase în allAliases()…" -> 0
   node tests/smoke.mjs -> exit 0
   Numărul de înregistrări din locations.json -> NESCHIMBAT
````

---

## R4.3 — Randarea depinde de requestAnimationFrame

`Codex` · depinde de R0.1 · ~1h · repară M-8

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: harta trebuie să aibă markere și fără un cadru de animație.

DIAGNOSTIC (măsurat în audit, M-8 — atenție, e subtil):
js/map/MapRenderer.js:590-599, updateWorldState() programează TOATĂ randarea de
markere în requestAnimationFrame. Într-un context fără compoziție (tab în fundal,
pagină ascunsă, captură automată, print) rAF NU se declanșează și harta rămâne cu
ZERO pinuri pe termen nelimitat.
Dovadă din audit:
  {"visibilityState":"hidden","hidden":true,"rafFiredWithin500ms":false}
  #layer-locations -> 0 copii, renderedPositions.size -> 0
  în timp ce getRenderableLocations() întorcea 53 de puncte
Se repară singur la focalizare, deci NU e un bug care se vede în uz normal. Dar:
straturile de bătălii și dragoni NU au problema (sunt randate sincron din
setEventRange), ceea ce face simptomul derutant — harta arată markere de eveniment
fără niciun oraș sub ele.
ACEASTA A FOST APROAPE RAPORTATĂ CA "CRITICAL: zero markere pe hartă". Nu este.
Verifică document.visibilityState înainte de a diagnostica orice problemă de randare
în context automatizat.

CERINȚE:
1. Prima randare (când _markerCache.size === 0) se face SINCRON. Doar actualizările
   ulterioare — scrubbing pe timeline — se coalescează în rAF. Motivul rAF-ului era
   coalescarea scrubbing-ului rapid, nu prima randare.
2. Ca plasă de siguranță, dacă rAF nu s-a declanșat într-un interval rezonabil și
   există stare în așteptare, randează sincron.
3. NU strica coalescarea: scrubbing-ul rapid pe timeline trebuie să rămână un singur
   render per cadru. Verifică cu un contor de apeluri.

CRITERIU DE ACCEPTANȚĂ:
   Într-un context cu document.hidden === true, după init:
     document.querySelectorAll('#layer-locations > *').length -> 53, nu 0
   Scrubbing rapid pe timeline (50 de evenimente input în 500 ms)
     -> numărul de apeluri renderLocationMarkers <= numărul de cadre. Lipește cifra.
   node tests/smoke.mjs -> exit 0
````

---

## R4.1 — Iconografia: contra-scalare la zoom și letterboxing

`Claude Code` · depinde de R0.1 · ~4h · repară Anexa 2 (reclamația vizuală)

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: repară motivul real pentru care "harta pare mică și iconițele mari".

DIAGNOSTIC (măsurat live în audit, Anexa 2 — contrazice ipoteza inițială):
Fereastră 1280x720, viewBox "0 0 1500 1000":
  {"elementPx":"1280x720","drawnMapPx":"1080x720","letterboxPx":"200 horizontal",
   "pxPerWorldUnit":0.72}
Anatomia unui marker, în unități de lume:
  zonă de click (marker-hit-area)       30 x 30      -> 21.6 px
  siluetă de tip (location-type-castle) 18 x 16      -> 13 x 11.5 px
  badge de emblemă                      10.4 x 10.4  -> 7.5 px
  etichetă ("Winterfell")               76.5 x 13.9  -> 55 x 10 px
  extindere verticală totală            ~43          -> ~31 px
TREI CAUZE, în ordinea impactului:
1. LETTERBOXING. viewBox e 1500x1000 (raport 1.5), containerul 1280x720 (1.78). Cu
   preserveAspectRatio="xMidYMid meet" scala e limitată de înălțime (720/1000=0.72),
   harta se desenează pe 1080x720 și rămân 200 px goi. HARTA CHIAR ESTE mai mică
   decât fereastra — nu e o iluzie produsă de iconițe.
2. MARKERELE NU CONTRA-SCALEAZĂ. js/map/MapInteraction.js:64 face zoom modificând
   EXCLUSIV viewBox. Dimensiunile markerelor sunt constante în unități de lume, deci
   raportul iconiță/hartă e FIX. La zoom x2 o iconiță de 13 px devine 26 px; la x4,
   52 px. Nu câștigă informație, doar suprafață.
3. SPAȚIEREA E MAI MICĂ DECÂT O ETICHETĂ. js/map/MapRenderer.js:700-701 are
   threshold=22 / minDistance=24 unități, dar o etichetă are 76.5 unități lățime —
   de 3.2x mai mult. Coliziunile sunt STRUCTURALE, iar updateLabelVisibility() le
   rezolvă ascunzând: din 89 de etichete, 49 vizibile, 40 suprimate (45%).

CERINȚE:
1. CONTRA-SCALARE. Aplică pe grupul fiecărui marker
   transform: translate(x,y) scale(k) cu k = clamp(0.45, 1/zoom, 1), unde
   zoom = 1500 / viewBox.width. Markerele își păstrează dimensiunea PE ECRAN la
   orice zoom. Recalculează la fiecare schimbare de viewBox, dar coalescat în rAF-ul
   existent, nu la fiecare eveniment de wheel.
   ATENȚIE: renderedPositions conține poziții post-declutter; scale-ul se aplică
   PESTE translate, nu în locul lui.
2. ELIMINĂ LETTERBOXING-UL. Recalculează viewBox la `resize` ca să potrivească
   raportul containerului, păstrând centrul și acoperind cel puțin canvasul
   1500x1000. Cei 200 px recuperați sunt +18% lățime utilă, gratis.
3. LEAGĂ minDistance DE LĂȚIMEA REALĂ A ETICHETEI. updateLabelVisibility() deja
   măsoară textul și memorează în _labelMeasurementCache. Aceeași măsurătoare
   trebuie să alimenteze decluttering-ul, ca pinurile să nu fie împinse la 24 de
   unități când eticheta cere 76.
4. TREPTE DE DENSITATE în loc de ascundere binară. La zoom mic: doar tier 1 cu
   etichetă, tier 2-3 ca puncte de 2-3 unități fără etichetă. Pe măsură ce zoom-ul
   crește, promovează treptat. Azi tot ce nu încape dispare complet, ceea ce face
   harta să pară și goală, și aglomerată în același timp.
5. NU strica P4.3: cele 14 CAPITAL_LOCATIONS au azi 14/14 etichete vizibile la zoom
   implicit. Este un criteriu de acceptanță câștigat cu greu. Verifică-l după.
6. Raportează cu descriere la trei niveluri de zoom, nu cu afirmația că arată bine.

CRITERIU DE ACCEPTANȚĂ:
   La zoom implicit: 14/14 CAPITAL_LOCATIONS au etichetă vizibilă (neschimbat)
   La zoom x2 și x4: dimensiunea pe ecran a unei siluete de castel rămâne în
       intervalul 11-16 px. Măsoară cu getBoundingClientRect(), lipește cifrele.
   drawnMapPx === elementPx (fără letterboxing). Lipește măsurătoarea.
   Numărul de etichete suprimate scade sub 30% (azi 45%). Lipește ambele cifre.
   Rezultatul e identic la două randări succesive (determinism).
````

---

## R4.2 — Bugetul de încărcare: 74 MB → sub 40 MB

`Antigravity` · depinde de R0.1 · ~2h · repară HIGH-5

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF, servit de un server.py local de dezvoltare.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: adu încărcarea inițială sub ținta din Anexa C.

DIAGNOSTIC (măsurat live în audit, secțiunea R):
  {"requests":98,"transferKB":76071,"decodedMB":74.26,
   "dataRequestCount":21,"dataStartSpreadMs":404.9,
   "byExt":{"png":"45523KB","json":"29948KB","js":"378KB","woff2":"135KB","css":"58KB"}}
Ținta Anexa C: "< 40 MB paralel". Paralelismul E ATINS (21 de cereri în 405 ms, prin
Promise.all). Volumul NU: 74.26 MB, de 1.86x peste țintă.
Top assets:
  assets/Mapa/HARTA LUMII.png     45 357 KB   <- 61% din total
  data/characters/characters.json 12 350 KB
  data/locations/locations.json    7 444 KB
  data/events/events.json          5 789 KB
  data/houses/houses.json          3 673 KB
DOUĂ CAUZE INDEPENDENTE:
1. Harta PNG are 45 MB pentru o suprafață randată la maximum 1080x720 px. Este ~40x
   peste necesar.
2. transferKB ~= decodedKB => SERVERUL NU COMPRIMĂ NIMIC. characters.json 12.35 MB
   -> sub 2 MB cu gzip.

CERINȚE:
1. Re-encodează harta. Variante, în ordinea preferinței:
   a) AVIF sau WebP la rezoluție potrivită pentru zoom maxim real (nu pentru zoom
      infinit) — verifică întâi ce zoom maxim permite MapInteraction
   b) tiling la nivele de zoom, dacă (a) nu ajunge
   NU degrada lizibilitatea la zoom maxim. Compară vizual înainte/după și raportează
   cu descriere.
2. Adaugă Content-Encoding: gzip în server.py, cu negociere pe Accept-Encoding. Este
   un server de dezvoltare, dar cifra din Anexa C se măsoară pe el.
3. NU reduce datele prin ștergere de câmpuri (CLAUDE.md §5.4). Dacă vrei o încărcare
   mai mică de characters.json, discută separat despre un index subțire încărcat
   întâi și înregistrările complete la cerere — este o schimbare de arhitectură, nu o
   optimizare, și nu intră în sarcina asta.

CRITERIU DE ACCEPTANȚĂ:
   În browser, după hard reload:
     performance.getEntriesByType('resource').reduce((a,r)=>a+r.transferSize,0)
     -> sub 40 MB. Lipește cifra.
   Harta rămâne lizibilă la zoom maxim — descriere, nu afirmație.
   node tests/smoke.mjs -> exit 0
````

---

## R4.5 — Sliderul de timeline se întinde pe 902 ani

`Antigravity` · depinde de R0.1 · ~1h · repară M-3

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki + timeline pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: fă sliderul de timeline utilizabil.

DIAGNOSTIC (măsurat live în audit, C6 și M-3):
  {"sliderMin":"-600","sliderMax":"302","eventBounds":{"min":-600,"max":302},
   "eventsWithYear":1568,"reachableOnSlider":1568}
maxYear este corect 302 (criteriul C6 trece). Dar minYear ajunge -600 dintr-un
SINGUR eveniment: uncloaking_of_uthero din data/essos/free_cities_events.json.
js/ui/Timeline.js:245-249 calculează eventBounds din min/max brut al anilor. Între
-600 și -115 există EXACT 1 EVENIMENT. 54% din slider acoperă un singur punct.
Epocile din eras.json încep la -114, deci intervalul -600…-115 nu e acoperit de
nicio epocă — este inaccesibil prin selectorul de epocă și inutil prin slider.

CERINȚE:
1. eventBounds nu se mai calculează din min/max brut. Folosește una din:
   a) minimul epocilor declarate în eras.json (-114), sau
   b) un percentil (ex. p1) al anilor, cu outlierii accesibili prin altă cale
   Recomandă una, cu argumente, și implementeaz-o.
2. Evenimentele din afara intervalului NU dispar din wiki și din search — rămân
   accesibile, doar nu prin slider. Este exact tratamentul pe care îl primesc deja
   evenimentele nedatate (comentariul de la Timeline.js:260).
3. Dacă alegi (a), adaugă o epocă pentru antichitatea Essosului sau declară explicit
   că evenimentele pre -114 sunt doar-wiki. Nu le lăsa în limb.
4. NU schimba logica de calcul al anilor per se — a fost reparată în P1.6.

CRITERIU DE ACCEPTANȚĂ:
   În browser: {slider.min, slider.max} -> lipește
   Numărul de evenimente datate accesibile prin slider -> nu scade sub 1560
   Selectorul de epocă acoperă tot intervalul sliderului -> demonstrează
   node tests/smoke.mjs -> exit 0
````

---

## R4.4 — Pinuri lipsă: castle_black și ținta de 150

`TU (plasare manuală) + Claude Code (pregătire)` · depinde de R3.2 · ~2h · repară F3, B-c2

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF, cu editor de pinuri în admin/map-editor.html și un
server.py local. Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF. Câmp fără sursă = null.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: pregătește și verifică fluxul de plasare, apoi raportează lista completă.

DIAGNOSTIC (măsurat în audit, F3 și B-c2):
  highgarden       pin=true
  storm_end        pin=true
  castle_black     pin=false   <- P4.4 îl cerea explicit, alături de celelalte două
Total pinuri în catalog: 80. Ținta Anexa C: >= 150.
Silueta custom a lui castle_black din MapRenderer rămâne cod care nu se execută.
NOTĂ: F1 din audit (mutarea de pin rescrie DOAR catalog.json) a rămas BLOCKED —
testul runtime a fost respins de clasificatorul de sandbox al sesiunii de audit.
Codul o susține (server.py:177-178 citește locațiile doar pentru validare,
server.py:199 scrie exclusiv CATALOG, write_json compară bytes înainte de scriere),
dar NU a fost demonstrat prin rulare. Sarcina asta îl demonstrează.

CERINȚE:
1. Demonstrează F1 prin rulare. Checksum-uri înregistrate în audit, înainte:
     locations.json  bbfee731fe9179ad3597f6fb6bd312114f7d9b9047176d7a40d1ab9be06bdcfa
     catalog.json    5abcae4158e51e0bd19c02d8f56b9988579da1054c7183eb9d5f12813800af03
   Pornește serverul, mută un pin în admin/map-editor.html, recalculează ambele
   checksum-uri. locations.json TREBUIE să fie identic.
2. Raportează lista COMPLETĂ a locațiilor-ancoră fără pin: cele din
   CAPITAL_LOCATIONS (js/map/MapRenderer.js:10-13) și cele din `seats`
   (js/data/TimelineEngine.js:157-167). Azi capitalele sunt 14/14 cu pin prin ancoră;
   verifică dacă rămâne așa după R3.2, care schimbă tipurile.
3. Propune-mi o listă prioritizată de ~70 de locații pentru care merită plasat un pin
   ca să atingem 150, ordonată după: apariții în evenimente, apariții ca sediu de
   casă, apariții în afirmațiile de distanță. NU plasa tu pinurile — coordonatele le
   pun eu manual în editor.
4. Verifică fluxul de salvare pentru id-uri necunoscute (server.py:183-184 întoarce
   unknownIds) — editorul trebuie să le arate, nu să le înghită.

CRITERIU DE ACCEPTANȚĂ:
   sha256sum data/locations/locations.json  -> identic cu cel de mai sus, după o
       mutare de pin
   sha256sum data/map/catalog.json          -> DIFERIT
   Lista completă a ancorelor fără pin, lipită
   Lista prioritizată de ~70, lipită, cu cifrele care justifică ordinea
````

---

## R5.1 — Serverul expune tot repo-ul

`Codex` · depinde de R0.1 · ~1h · repară M-1

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF, servit de server.py (dezvoltare, loopback).
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: limitează ce servește server.py.

DIAGNOSTIC (măsurat în audit, G5):
Ieșirea din rădăcină E BLOCATĂ CORECT de SimpleHTTPRequestHandler:
  /../../../Windows/win.ini    -> 404
  /..%2f..%2fWindows/win.ini   -> 404
Dar TOT conținutul repo-ului este servit:
  /data/../server.py           -> 200  16007b  text/x-python
  /.git/config                 -> 200  332b
  /CLAUDE.md                   -> 200  9212b
  /triage.py                   -> 200  26332b
  /data/_backups/              -> 200  470b    (listare de director)
Pe loopback riscul e mic. --host este un flag public (server.py:301) și mută asta în
LAN instant.

CERINȚE:
1. Allowlist de prefixe servite: /js, /css, /data, /assets, /i18n, /admin,
   /index.html, /favicon. Orice altceva -> 404.
2. Dezactivează listarea de directoare.
3. Exclude explicit /.git, indiferent de allowlist.
4. NU strica SPA fallback-ul (server.py:73-96) — /wiki/:kind/:id și /harta/:id
   trebuie să întoarcă în continuare index.html, iar /api/* să rămână 404 la endpoint
   necunoscut. Ambele sunt verificate în audit și trec.

CRITERIU DE ACCEPTANȚĂ:
   curl -s -o /dev/null -w "%{http_code}" pentru fiecare:
     /.git/config                 -> 404
     /server.py                   -> 404
     /CLAUDE.md                   -> 404
     /data/_backups/              -> 404
     /data/map/catalog.json       -> 200
     /wiki/character/eddard_stark -> 200
     /api/nope                    -> 404
   Lipește toate cele 7.
````

---

## R5.2 — API-ul de scriere nu are autentificare sau protecție CSRF

`Codex` · depinde de R0.1 · ~1h · repară M-2 · **premisă neconfirmată prin rulare**

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki pentru ASOIAF, servit de server.py (dezvoltare, loopback), cu
interfețe de admin în admin/map-editor.html și admin/triage.html.
Citește CLAUDE.md întâi. Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează. Nu improviza.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: protejează endpointurile care scriu pe disc.

DIAGNOSTIC (din citirea codului, audit M-2):
ATENȚIE — această constatare NU a fost confirmată prin rulare. Testul runtime a fost
respins de clasificatorul de sandbox al sesiunii de audit. Verific-o tu întâi prin
rulare, ÎNAINTE de a repara. Dacă premisa e falsă, oprește-te și raportează.
Ce spune codul:
server.py:47-49, read_body() face json.loads(self.rfile.read(length)) fără să
verifice Content-Type. Nimic din do_POST / do_PUT / do_DELETE nu verifică Origin,
Referer, vreun token sau vreo autentificare.
Un formular cross-origin cu enctype="text/plain" este o "simple request" (fără
preflight CORS) al cărei corp poate fi construit ca JSON valid. Deci orice site
deschis în paralel în browser ar putea apela /api/locations, /api/houses și
/api/save-coordinates. DELETE e protejat incidental de preflight; POST nu.
Endpointurile care scriu: /api/save-coordinates, /api/locations, /api/houses
(POST/PUT/DELETE). Scriu în catalog.json, locations.json, free_cities.json,
far_lands.json, houses.json.

CERINȚE:
1. ÎNTÂI verifică premisa. Construiește o pagină HTML locală cu un formular
   enctype="text/plain" care postează către /api/save-coordinates cu un id INEXISTENT
   (deci fără efect de scriere — server.py:183-184 îl pune în unknownIds și write_json
   nu scrie nimic). Raportează dacă cererea trece.
2. Dacă premisa se confirmă: respinge cererile al căror Content-Type nu e exact
   application/json, și cele cu antet Origin prezent și diferit de
   http://127.0.0.1:<port> / http://localhost:<port>.
3. Adaugă un token de sesiune generat la pornire, afișat în consola serverului și
   citit de admin/map-editor.js și admin/triage.js. Simplu, nu OAuth — este un server
   de dezvoltare pe loopback.
4. NU strica fluxul de admin existent: mutarea de pin, triajul și CRUD-ul de
   locații/case trebuie să funcționeze după.

CRITERIU DE ACCEPTANȚĂ:
   Cererea cross-origin simulată -> respinsă. Lipește codul de status.
   Mutarea unui pin din admin/map-editor.html -> funcționează. Lipește răspunsul.
   Un ciclu complet de triaj din admin/triage.html -> funcționează.
   python -m pytest tests/test_triage.py -> toate trec
````

---

## R6.1 — Curățenie fără risc

`Antigravity` · depinde de R0.1 · ~1h · repară L-1…L-4

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki bilingv RO/EN pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers. Merg la triaj manual.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit. Aici: patru curățenii independente, fiecare cu commit
   separat.

SARCINĂ: patru curățenii independente, fiecare cu commit separat.

DIAGNOSTIC (măsurat în audit):
L-2: data/characters/characters.backup_compound_fix.json — 11.9 MB, în arborele
     SERVIT, urmărit în git, nereferențiat de niciun cod.
L-3: .git/objects are 19 fișiere tmp_obj_* și 490 MB garbage; 40 de obiecte dangling.
     Scrieri întrerupte (probabil OneDrive).
L-1: 50 addEventListener în js/, 0 removeEventListener. Majoritatea sunt pe
     singletoni cu viață cât pagina — inofensive. Excepția reală:
     js/ui/panels/parts.js:139, createFullPageButton() atașează un listener la
     FIECARE randare de panou, iar panoul se re-randează la fiecare selectEntity.
     Scurgere lentă, nu permanentă (nodurile vechi sunt colectate prin innerHTML='').
L-4: Panoul de filtre, cu interfața pe RO, afișează simultan "Casa Lannister",
     "Casa Stark", "Casa Tully" și "House Bracken", "House Dustin", "House Grafton",
     "House Greyjoy", "House Hightower", "House Qoherys", "House Smallwood".
     Cauza e în DATE (unele case au name_ro, altele nu), NU în t().

CERINȚE:
1. L-2: mută backupul în afara arborelui servit sau în data/_backups/ (care e deja
   untracked). Scoate-l din git cu `git rm --cached`, adaugă-l în .gitignore.
   NU-l șterge de pe disc fără să mă întrebi.
2. L-3: `git gc --prune=now`. Raportează `git count-objects -v` înainte și după.
   Verifică `git fsck` după.
3. L-1: în createFullPageButton(), folosește delegare de evenimente pe containerul
   panoului în loc de un listener per buton. NU adăuga removeEventListener peste tot
   — nu e problema.
4. L-4: NU traduce automat numele de case (interdicția permanentă nr. 3). Adaugă
   casele fără name_ro în coada de triaj. Până sunt traduse, afișează-le cu badge de
   limbă — mecanismul există deja în js/i18n/langBadge.js și resolveName() întoarce
   deja badgeLang. Verifică de ce nu se aplică în panoul de filtre.

CRITERIU DE ACCEPTANȚĂ:
   git count-objects -v          -> garbage: 0, înainte/după lipite
   git fsck                      -> fără erori
   du -sh .git                   -> înainte/după
   Panoul de filtre pe RO        -> casele fără traducere au badge de limbă, nu se
                                    amestecă mut. Descrie ce vezi.
   node tests/smoke.mjs          -> exit 0
````

---

## R7.1 — Invarianții auditului intră în smoke test

`Claude Code` · depinde de R1.1, R1.2, R1.3, R2.3 · ~2h

````
CONTEXT: Atlas of Westeros. JS vanilla, module ES, fără framework/bundler.
Hartă SVG + wiki bilingv pentru ASOIAF. Citește CLAUDE.md întâi.
Audit: docs/VERIFICARE_FINALA.md

INTERDICȚII PERMANENTE:
1. Nu rula scripturi din scripts/ sau scratch/ fără cerere explicită.
2. Nu inventa fapte de canon ASOIAF.
3. Nu traduce automat nume proprii de univers.
4. Nu șterge câmpuri din JSON.
5. Nu repara în date o problemă a cărei cauză e în cod, și invers.
6. Nu raporta terminat fără ieșirea comenzii din criteriul de acceptanță.
7. Dacă premisa sarcinii se dovedește falsă, oprește-te și raportează.

CONTRACT DE VERIFICARE:
1. `git status --short` înainte de orice modificare; dacă nu e curat, oprește-te.
2. Orice transformare de date: backup + dry-run implicit; scrierea cere --apply.
3. La final: fișiere modificate, linii +/- per fișier, criteriul ca IEȘIRE DE
   COMANDĂ, premise inexacte.
4. `node tests/smoke.mjs` -> exit 0.
5. O sarcină = un commit.

SARCINĂ: fă imposibilă reapariția tăcută a problemelor din acest audit.

MOTIV: auditul a găsit 21 de probleme, dintre care CRITICAL-3 (`seat` array) este
literalmente aceeași clasă cu un bug reparat anterior pentru `id_intern`. A reapărut
pe alt câmp pentru că invariantul nu a fost scris ca test, ci ca reparație punctuală.

CERINȚE. Adaugă în tests/smoke.mjs aserțiuni (nu doar metrici raportate — aserțiuni
care fac exit code 1):
1. SCHEMĂ. Pentru fiecare câmp care e consumat ca string în cod (seat, city, region,
   membru_al, ruling_house, location, locatie_id), zero entități în care câmpul există
   și NU e string sau null, DUPĂ mapCompatibility. Aceasta este generalizarea lui
   CRITICAL-3.
2. UNICITATE CROSS-TIP. Numărul de id-uri care apar în >1 colecție este raportat și
   comparat cu o linie de bază declarată (azi 46, legitim pentru perechile
   casă/castel). O creștere = eșec, ca să nu apară tăcut alt caz ca dragonii.
3. DRAGONI. Zero id-uri comune între dragons.json și înregistrările NEdepreciate din
   objects.json. Aceasta este CRITICAL-2 ca invariant.
4. NUME BILINGVE. Zero locații în care name_ro sau name_en este identic cu numele
   principal al ALTEI locații. Aceasta este CRITICAL-1 ca invariant.
5. ALIASURI. Zero aliasuri cu paranteze dezechilibrate în ce ajunge în allAliases().
6. ERAS. data/timeline/eras.json este citit; fiecare epocă are id/start/end numerice
   cu start <= end; epocile acoperă tot intervalul sliderului.
7. RANDARE FĂRĂ rAF. Un test separat (tests/map-render.mjs) care verifică faptul că
   prima randare de markere nu depinde de requestAnimationFrame.
8. Fiecare aserțiune are un comentariu care spune CE bug a existat și DE CE testul e
   acolo — în stilul comentariilor existente din smoke.mjs, care sunt deja bune la asta.

CRITERIU DE ACCEPTANȚĂ:
   node tests/smoke.mjs -> exit 0 pe starea reparată
   ȘI: introdu temporar fiecare dintre cele 7 regresii (una câte una) și demonstrează
   că testul dă exit 1 pentru fiecare. Lipește cele 7 rulări.
   Fără dovada asta, testul nu e demonstrat că prinde ceva.
````

---

## Anexă — Cifrele de referință, după audit (`7d82dc5`)

| Metrică | Măsurat | Țintă | Prompt |
|---|---|---|---|
| Locații încărcate | 1099 | 1099 | — |
| getAllLocations() | 694 | de stabilit | R3.2 |
| Locații cu pin | 80 | ≥ 150 | R4.4 |
| Locații type:"location" | 217 | ~0 | R3.2 |
| Checkbox-uri vizibile la deschidere | 8 (13 controale) | < 12 | ✅ atins |
| Capitale cu etichetă vizibilă | 14 / 14 | 14 | ✅ atins |
| Evenimente accesibile prin timeline | 1568 | 1561 | ✅ atins |
| Evenimente cu locație rezolvată | 875 / 875 | 875 | ✅ atins |
| Evenimente fără câmp type | 1662 / 1689 | mult mai puține | R3.1 |
| Personaje cu casă rezolvată | 631 / 631 | 631 | ✅ atins |
| Obiecte + titluri în search | 370 | 370 | ✅ atins |
| Entități care crapă la click | 0 / 185 | 0 | ✅ atins |
| Dragoni în dragons.json | 5 | ~26 din date | R1.2 |
| Case cu seat nefolosibil | 26 | 0 | R1.3 |
| Chei i18n de interfață | 322 / 322 | egale | ✅ atins |
| Entități cu nume localizat | 46 / 5282 | mult mai multe | R1.1 + triaj |
| Încărcare inițială | 74.26 MB | < 40 MB | R4.2 |
| Etichete suprimate de coliziune | 40 / 89 (45%) | < 30% | R4.1 |
| Letterboxing orizontal | 200 px din 1280 | 0 | R4.1 |
| Erori de rețea | 0 / 98 cereri | 0 | ✅ atins |

## Anexă — Ce NU trebuie să facă niciun agent

1. Nu fuziona entități automat. Fuziunea pierde proveniență și e ireversibilă. (R3.3)
2. Nu completa câmpuri de canon din memorie sau de pe wiki-uri externe. Câmp fără sursă = null. (R1.2, R3.1)
3. Nu lărgi un filtru cu regex pe text liber ca să compensezi date incomplete. (R3.1)
4. Nu repara în stratul de prezentare o schemă neuniformă. Normalizează la încărcare. (R2.1 vs R1.3)
5. Nu marca o verificare PASS fără ieșirea comenzii.
6. Nu diagnostica probleme de randare fără să verifici întâi `document.visibilityState`. (R4.3)
7. Dacă premisa unei sarcini se dovedește falsă — și R5.2 are o premisă neconfirmată — oprește-te și raportează.
