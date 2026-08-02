# Raport adăugări și validare finală

## Importuri precedente

- Locații noi importate: 307; case noi importate: 76.
- Embleme: 126 fișiere valide, fără lipsuri (detalii în `RAPORT_EMBLEME.md`).
- Toate cele șase tipuri de locații sunt încărcate de DataManager și acceptate de API.

## Partea E — corectare coordonate

- Au fost detectate 37 intrări cu coordonate vechi care cădeau în regiunea greșită. Toate au fost eliminate din fișierele de locații și din `data/map/catalog.json`, nu mutate prin presupunere.
- `python verify_all.py`: **0 neconcordanțe**; 47 poziții calibrate valide. Cele 37 locații sunt acum necalibrate și pot fi plasate manual în editor.

## Partea F — istoric case (AWOIAF)

- Au fost adăugate 41 câmpuri susținute de AWOIAF (blazoane și motto-uri documentate) pentru 38 de case.
- Cerwyn, Hornwood și Locke au primit cronologii canonice, fiecare eveniment având URL-ul AWOIAF ca sursă. Nu au primit date de fondare inventate.
- Au rămas 59 case cu `timeline: []`, `words: null` și `founded: null` simultan. Sunt listate ca nevoie de cercetare punctuală în `NEEDS_REVIEW.md`; datele nesusținute nu au fost fabricate.

## Partea G — UI și API

- Tab-ul Case folosește ruta relativă corectă `../assets/...` de la `/admin/map-editor.html`, deci nu solicită `/admin/assets/...`.
- Marker-ele cu emblemă păstrează un glif separat pentru fiecare tip: castle, fortress, city, town, ruins și landmark. Astfel, emblema nu mai reduce pinul la un cerc alb generic.
- Test local reușit: `GET /api/ping` → `200 {"ok": true, "server": "atlas-admin"}`; `POST /api/save-coordinates` → `200 {"updated": 0, "unknownIds": []}`.
