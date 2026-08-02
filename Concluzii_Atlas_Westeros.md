# Concluzii & Plan de Îmbunătățiri – Atlas Westeros / ASOIAF

**Data analiză:** 2 august 2026  
**Scop:** Sinteza problemelor identificate din screenshot-uri, cod, date și feedback + recomandări prioritizate + arhitectură propusă

---

## 1. Probleme Critice (trebuie rezolvate primul)

### 1.1 King's Landing nu se activează
- Căutarea din search-ul hărții nu deschide panoul / pagina pentru King's Landing.
- Probabil lipsă de legătură între ID-ul locației (`kings_landing` / `king_landing`) și handler-ul de click / navigare.
- **Acțiune:** Verificare mapare ID → coordinate + event listener pe marker + fallback în search.

### 1.2 Tool-ul de distanță nu funcționează deloc
- Nu permite selectarea a 2 locații (ex. Harrenhal ↔ King's Landing).
- Nu returnează distanța din datele noastre (nu calcul geometric arbitrar).
- **Soluție corectă:**
  - Mod „Selectează 2 puncte” → click pe 2 markere.
  - Caută în `distances.json` / tabel de distanțe canonice (sau calcul pe coordinate calibrate + factor de scară din carte).
  - Afișează: leghe / zile de mers / zile călare / zile pe mare (date din canon).

### 1.3 Evenimentele din Search nu fac nimic
- Click pe un eveniment din rezultatele de search → zero acțiune.
- **Concluzie arhitecturală:** Search-ul de pe hartă trebuie să returneze **doar** entități vizibile pe hartă (castele, orașe, case, landmark-uri, dragoni).  
  Evenimente, personaje detaliate, cronologii → redirect către `/wiki/...`.

### 1.4 Zoom greșit pe personaje
- Când cauți un personaj, harta face zoom haotic.
- Personajele **nu** au coordinate geografice fixe → nu ar trebui să trigger-uiască zoom pe hartă.

---

## 2. Probleme de UX / Design

### 2.1 Panoul din dreapta (Info Panel) – prima căutare
- Prea încărcat / greu de citit la prima interacțiune.
- **Propunere:**
  - Versiune **compactă** (mini-wiki): nume, sigil, 2-3 fapte cheie, buton „Vezi pagina completă”.
  - Click pe „Vezi pagina completă” → deschide `/wiki/personaj/...` (pagină dedicată, bogată).

### 2.2 Pagina Wiki finală a personajelor
- Nu place layout-ul actual.
- Trebuie: header puternic, secțiuni clare (Biografie, Relații, Titluri, Timeline, Surse), badge-uri de încredere (canon / inferred), legături clickabile către alte entități.

### 2.3 Filtrele de pe hartă sunt prea mari / confuze
- Utilizatorul se pierde.
- **Restructurare propusă (categorii clare):**
  - Locații: Castele · Orașe · Târguri · Ruine · Landmark-uri
  - Case (sigils)
  - Ape / Mări / Râuri
  - Păduri / Munți
  - Dragoni
  - Epocă (ex. „Epocă Targaryen / Foc și Sânge”)

### 2.4 Iconițele de pe hartă (castele, case, mări)
- Nu se disting bine. Castelele nu arată a castele, casele sunt neclare, mările arată urât.
- **Necesită redesign complet** al setului de markere SVG (stil pergament + siluete clare + steaguri vizibile).

### 2.5 Slider-ul de ani (timeline)
- Ocupă prea mult spațiu jos → harta nu se vede complet.
- Logică slabă în poziția actuală.
- **Variante:**
  - Collapsible / floating minimal.
  - Mutat în toolbar-ul de sus sau lateral.
  - Activare doar când e nevoie (toggle „Timeline Mode”).

### 2.6 Sursele (pagini de carte)
- Numerotarea / referințele de pagină sunt greu de citit.
- **Opțiuni:**
  1. Ascundere implicită + tooltip / expand.
  2. Formatare elegantă (badge-uri mici + hover cu detalii complete).
  3. Eliminare din UI-ul principal și păstrare doar în pagina Wiki completă.

---

## 3. Admin Map – Îmbunătățiri necesare

- Trebuie să permită:
  - Plasare / editare coordonate castele + landmark-uri.
  - Scriere nume de mări / oceane **direct pe apă** (stil cartografic clasic).
  - Gestionare a entităților „nesigure” / incomplete → zonă separată „Pending / Uncertain”.
  - Selectare rapidă + mutare în lot a item-urilor fără direcție clară.
- Ideea ta de „programel mic” în admin care colectează tot ce nu e confirmat → foarte bună. Implementează o listă „Needs Attention”.

---

## 4. Arhitectură recomandată (ideea ta e corectă)

| Rută                   | Scop                             | Conținut principal                                      |
|------------------------|----------------------------------|---------------------------------------------------------|
| `/harta` sau `/`       | Experiență vizuală interactivă   | Hartă + markere + filtre + distanță + timeline compact  |
| `/wiki`                | Enciclopedie completă            | Personaje, Case, Evenimente, Timeline-uri, Surse        |
| `/wiki/personaj/:id`   | Pagină bogată personaj           | Toate detaliile + relații + surse                       |
| `/wiki/event/:id`      | Pagină eveniment                 | Participanți, locații, consecințe                       |
| `/admin`               | Tool intern                      | Coordonate, pending items, validare                     |

**De ce e o idee bună:**
- Separă clar „explorare vizuală” de „consultare aprofundată”.
- Search-ul de pe hartă rămâne rapid și relevant.
- Search-ul global / wiki poate fi deep (personaje, evenimente, citate).
- Performanță mai bună (harta nu încarcă tot graful de relații).

---

## 5. Idei suplimentare valoroase (din sugestii + analiză)

1. **Filtru „Epocă Targaryen”** (sau slider de epocă) → arată doar locațiile active în perioada *Foc și Sânge*.
2. **Import automat Markdown → JSON** (script Python) – extrem de util pentru actualizări viitoare.
3. **Dragoni & Battle markers** – extinde `dragons.json` + markere speciale pe hartă (cu tooltip de rider + an).
4. **Distanțe canonice** – tabel dedicat (nu doar calcul pe pixel).
5. **Confidence badges** peste tot (canon / inferred / unknown) – deja ai structura în date, trebuie doar UI consistent.
6. **Pending / Uncertain queue** în Admin – tot ce are `confidence != confirmed` sau lipsă de coordonate.

---

## 6. Prioritizare recomandată

| Prioritate | Item                                         | Impact  |
|------------|----------------------------------------------|---------|
| P0         | Fix King's Landing + Distance Tool           | Critic  |
| P0         | Events din search → redirect `/wiki`         | Critic  |
| P1         | Redesign Info Panel (compact + full wiki)    | Mare    |
| P1         | Restructurare filtre + iconițe markere       | Mare    |
| P1         | Separare rute `/harta` vs `/wiki`            | Mare    |
| P2         | Timeline slider regândit                     | Mediu   |
| P2         | Admin: mări + pending items                  | Mediu   |
| P3         | Surse mai elegante + Epocă Targaryen         | Nice    |

---

## 7. Observații din datele de personaje (exemplu Visenya / Rhaenys)

- Structura `_afirmatii_pe_predicat`, `titles`, `surse`, `confidence` este foarte bogată și bine gândită.
- Problema apare la **prezentare**: prea multe informații aruncate deodată în panoul din dreapta.
- Unele legături (părinți, copii, frați) conțin ID-uri duplicate sau confuzii de identitate între personaje omonime (ex. mai multe Rhaenys).
- Câmpul `moarte` are variante multiple – UI-ul trebuie să le afișeze clar ca „variante istorice / surse diferite”.

---

## 8. Concluzie finală

Proiectul are o bază de date foarte bogată și o viziune cartografică bună, dar UI-ul actual amestecă prea multe responsabilități pe o singură pagină (hartă + wiki + search deep + admin).

Separarea clară **Hartă (vizual + interactiv)** vs **Wiki (detaliu + surse)** + fix-urile P0 (King's Landing, distanță, events) vor transforma experiența din „confuză” în „premium și logică”.

### Următorii pași logici
1. Fix P0 (King's Landing, Distance Tool, Events → Wiki).
2. Prototip panou compact + pagină wiki personaj.
3. Restructurare filtre + markere SVG.
4. Introducere rutelor `/harta` și `/wiki`.
5. Îmbunătățiri Admin (mări + pending queue).

---

*Document generat pe baza screenshot-urilor din „Imagini dovezi”, codului MapEditor, structurii de date characters și a feedback-ului complet.*
```