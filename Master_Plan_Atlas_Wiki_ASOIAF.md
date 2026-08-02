# Master Plan – Atlas & Wiki ASOIAF

> Acest document reprezintă o analiză completă a direcției proiectului, problemele identificate și recomandările de dezvoltare.

# Filosofia proiectului

Obiectivul aplicației NU este doar afișarea unei hărți. Scopul este construirea celui mai complet Atlas interactiv și Wiki pentru universul ASOIAF, unde utilizatorul poate explora geografia, istoria și personajele fără să fie nevoit să consulte surse externe.

Din acest motiv trebuie separată clar partea de explorare vizuală de partea enciclopedică.

---

# 1. Separarea aplicației

## /map
Responsabilitate:
- explorarea lumii
- căutarea locațiilor
- timeline
- filtre
- măsurarea distanțelor
- navigare vizuală

Nu trebuie încărcată cu biografii foarte lungi.

## /wiki
Responsabilitate:
- toate informațiile complete
- biografii
- evenimente
- familii
- cronologii
- surse
- relații

Această separare va face aplicația:
- mai rapidă
- mai clară
- mai ușor de extins
- mai apropiată de Wikipedia + Google Maps.

---

# 2. Probleme identificate

## King's Landing nu apare corect
Verificare completă:
- ID
- slug
- aliasuri
- index search
- marker
- coordonate
- sincronizare JSON

---

## Search-ul este prea general

Pe hartă trebuie căutate doar elemente care există fizic:

- castele
- orașe
- fortărețe
- mări
- râuri
- insule
- munți
- păduri
- case

Personajele și evenimentele trebuie să deschidă pagina Wiki.

---

## Zoom

Personajele nu trebuie să provoace zoom pe hartă.

Zoom doar pentru:
- castele
- orașe
- porturi
- insule
- case
- ruine

---

# 3. Distance Tool

Sistemul actual trebuie înlocuit.

Flux:

1. Selectezi Distance.
2. Alegi locația A.
3. Alegi locația B.
4. Se afișează:

- distanță oficială
- timp călare
- timp pe jos
- timp dragon
- timp pe mare
- sursa

Toate datele trebuie să provină exclusiv din baza proprie.

---

# 4. Harta

## Iconografie

Refacerea completă a iconițelor.

Fiecare categorie trebuie recunoscută instant.

Nu trebuie să existe confuzie între:
- castel
- casă
- ruină
- oraș
- port
- capitală
- dragon
- bătălie

---

## Mările

Numele mărilor trebuie desenate direct pe apă în stil medieval.

Exemple:
- Narrow Sea
- Sunset Sea
- Summer Sea
- Shivering Sea

---

## Filtre

Grupare logică:

Locații

Case

Geografie

Istorie

Creaturi

Nu o listă uriașă.

---

# 5. Timeline

Sliderul ocupă prea mult spațiu.

Propunere:

Panou lateral cu:

- an
- play
- pause
- speed
- salt rapid

În viitor poate deveni un adevărat player istoric.

---

# 6. Mini Wiki

Trebuie redus drastic.

Doar:

- portret
- casă
- titlu
- dragon
- perioadă
- buton „Vezi pagina completă”.

---

# 7. Pagina Wiki

Structură recomandată:

- Header
- Biografie
- Familie
- Relații
- Dragoni
- Evenimente
- Bătălii
- Timeline
- Hartă
- Surse

---

# 8. Admin Panel

Funcții noi:

## Inbox
Elemente neclasificate.

## Validation
Detectare automată:
- coordonate lipsă
- imagini lipsă
- surse lipsă
- relații lipsă

## Duplicate Detector

Detectează automat denumiri foarte asemănătoare.

---

# 9. Surse

Sursele trebuie afișate elegant.

Exemplu:

Fire & Blood

p.120

p.145

p.200

în loc de simple numere.

---

# 10. Funcționalități viitoare

- Timeline Playback
- Layers istorice
- Relationship Graph
- Travel Planner
- Conflict Heatmap
- Bookmarks
- Compare Mode
- Context temporal
- Import Markdown -> JSON
- Filtru Epocă Targaryen
- Dashboard calitate date
- Sistem de avertizare pentru date incomplete

---

# Roadmap

## v1
Corectarea bugurilor și UX.

## v2
Separarea /map și /wiki.

## v3
Timeline avansat și animații istorice.

## v4
Relationship Graph și Travel Planner.

## v5
Atlas complet cu toate epocile.

---

# Concluzie

Recomandarea principală este transformarea proiectului într-o platformă formată din două produse integrate:

1. Atlas interactiv pentru explorarea lumii.
2. Wiki complet pentru documentare.

Această arhitectură oferă scalabilitate, claritate și o experiență mult mai profesionistă utilizatorului final.
