# Sincronizare id_map.json + compuneri extinse — Prompt + Ghid

Continuă după Prompturile G, H, I (toate confirmate aplicate corect pe date). Re-
rularea auditului de integritate referențială a arătat o creștere de la 331 la 540
referințe „rupte" — cauza găsită: `id_map.json` nu a fost actualizat la fiecare
fuziune de personaje făcută până acum (title-prefix, clustere, compuse). **1 prompt**,
plus ghid.

---

## Prompt J — Sincronizare id_map.json + rescanare compuneri de 3+ nume

```
Context: id_map.json conține 2458 de intrări PERSON_*, dintre care 209 (8.5%) au
app_id care nu mai există în characters.json — rămase neactualizate de la fuziunile
anterioare (curățare duplicate prefix-titlu, clustere de identitate, ID-uri compuse).
Exemplu confirmat: PERSON_LORDUL_TYWIN_LANNISTER indică spre „lordul_tywin_lannister",
entitate ștearsă quando s-a unit cu „tywin_lannister" — dar maparea n-a fost
actualizată la momentul fuziunii. Asta cauzează un val de referințe fals-rupte în
audit_integritate_referentiala.json (concentrat mai ales în events.json →
participanti/participants, houses.json → relatii.*), fiindcă orice cod care rezolvă
prin id_map ajunge la un id mort.

A mai fost găsit, în aceeași listă, cel puțin un caz de compunere extremă pe care
Promptul H (limitat la 2 nume) nu l-a prins:
PERSON_ARON_SANTAGAR_JALABHAR_XHO_GEMENII_REDWYNE_LORDUL_GYLES_SER_DONTOS_SER_BALON_SWANN
— 7 persoane diferite comprimate într-un singur ID.

Sarcină, în două părți:

### Partea 1 — Sincronizare id_map.json

1. Backup id_map.json → data/_import/etl_output/backups/id_map.pre_sincronizare.json
2. Pentru fiecare intrare PERSON_* din id_map.json al cărei `app_id` NU există ca `id`
   real în characters.json:
   - caută dacă entitatea a fost redirect-ată printr-un `aliasuri` al altei persoane
     (fuziunile anterioare au păstrat id_intern-ul vechi ca alias pe entitatea
     unificată — caută acel id_intern SPECIFIC în array-ul `aliasuri` al fiecărei
     persoane din characters.json).
   - dacă găsești persoana care are acel id_intern vechi ca alias: actualizează
     `app_id` în id_map.json la id-ul REAL, curent, al acelei persoane; schimbă
     `status` la „redirected" (sau păstrează „enrichment"/„new" cum era, dar cu
     app_id corect — alege consecvent și documentează alegerea).
   - dacă NU găsești nicio potrivire (persoana pare complet dispărută, nu doar
     redenumită): NU inventa o potrivire — pune cazul într-un fișier separat
     data/_import/etl_output/id_map_orfani_needecise.json, cu id_intern-ul afectat
     și motivul („nicio entitate curentă nu-l are ca alias").
3. NU modifica characters.json în acest pas — doar id_map.json.

### Partea 2 — Rescanare compuneri de 3+ nume

4. Extinde (sau reia) logica din fix_compound_person_ids.py: caută în TOATE câmpurile
   relevante (frati, copii, parinti, casatorit_cu, ȘI de data asta și în
   participanti/participants din events.json, și relatii din houses.json) valori
   PERSON_* care conțin tipare de compunere de 3 SAU MAI MULTE nume, nu doar 2 (cazul
   Aron Santagar are 7). Folosește un separator mai flexibil de detectare — caută
   multiple apariții de „_SI_"/virgule/„ȘI" în același ID, nu doar una.
5. Pentru fiecare caz găsit, aplică aceeași logică din Promptul H: dacă toate
   persoanele componente există deja separat ca entități, desparte ID-ul compus în
   lista corectă de ID-uri individuale, în câmpul unde a fost găsit. Dacă nu toate
   există, pune cazul deoparte needecis, nu inventa.
6. Actualizează id_map.json și pentru aceste cazuri noi rezolvate.

## Verificare cerută

1. Câte din cele 209 intrări au fost re-rezolvate cu succes (redirect găsit prin
   alias) vs. câte au rămas orfane needecise.
2. Câte cazuri noi de compunere (3+ nume) au fost găsite și rezolvate, cu 3 exemple
   concrete (înainte/după).
3. Re-rulează audit_referential_integrity.py după ambele părți — raportează noul total
   de referințe rupte (așteptat: semnificativ sub 331, ideal aproape de cele ~137 reale
   găsite inițial, minus ce s-a reparat între timp prin Promptul I).
4. Confirmă specific: PERSON_LORDUL_TYWIN_LANNISTER rezolvă acum corect spre
   tywin_lannister? Verifică citind direct valoarea din id_map.json după scriere.
5. Confirmă că characters.json NU a fost modificat de Partea 1 (doar id_map.json) —
   compară dimensiune/hash înainte-după pentru characters.json.

Raportează numerele exacte la fiecare pas, plus conținutul complet al
id_map_orfani_needecise.json dacă nu-i gol.
```

---

## Ghid de folosire

1. **Backup obligatoriu** înainte de Partea 1 — chiar dacă promptul zice să nu
   atingă `characters.json`, tot scrie în `id_map.json`, care e folosit de mult cod.
2. **Rulează Partea 1 și Partea 2 în ordinea din prompt** — sincronizarea id_map
   trebuie să existe înainte ca rescanarea de compuneri să poată verifica corect
   dacă persoanele componente „există deja separat".
3. **Nu te aștepta la 0 referințe rupte după acest prompt** — mai rămân cele ~192
   fals-pozitive din cauza scriptului de audit care nu verifică `data/essos/*.json`
   (problemă separată, nerezolvată încă, semnalată în runda trecută) + orice cazuri
   genuine needecise puse deoparte la Partea 1-2. Scopul e să scadă semnificativ, nu
   să ajungă la zero.
4. **Trimite-mi rezultatul ca de fiecare dată** — `id_map.json`,
   `audit_integritate_referentiala.json` re-generat, și `id_map_orfani_needecise.json`
   dacă există — verific direct, nu doar raportul.
5. **După acest prompt, două lucruri rămân cunoscute, neatinse, pentru altă rundă:**
   - scriptul de audit care nu verifică `data/essos/free_cities.json`/`far_lands.json`
     (motivul celor ~192 fals-pozitive rămase)
   - partea de UI a Promptului I (badge-uri vizuale Casă vs. Persoană în
     InfoPanel/WikiPage) — neverificată încă, fișierele n-au fost incluse ultima dată
