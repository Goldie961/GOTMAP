# scripts/archive/ — Scripturi unice, deja aplicate

> ⚠️ **NU rerulați aceste scripturi!** Rerularea lor peste date deja procesate
> poate corupe `data/`.

## De ce sunt aici?

Aceste scripturi au fost operații **unice** (one-shot) — merge, dedup, fix, split,
retire, filter, unify, reconsolidate — care au fost rulate **o singură dată** pentru
a transforma datele din `data/`. Rezultatele lor sunt deja aplicate.

Rerularea oricăruia dintre ele ar putea:
- Duplica sau pierde date
- Suprascrie fișiere JSON cu transformări deja aplicate
- Corupe id_map.json sau referințele între entități

## Ce fac?

| Script | Operație |
|--------|----------|
| `dedup_person_entities.py` | Deduplicare personaje |
| `enrich_houses_part3.py` | Îmbogățire case (partea 3) |
| `etl_objects_titles.py` | ETL titluri obiecte |
| `filter_self_reference_statements.py` | Filtrare afirmații auto-referențiale |
| `fix_compound_person_ids.py` | Reparare ID-uri compuse persoane |
| `merge_characters_nivel4.py` | Merge personaje nivel 4 |
| `merge_events_nivel1.py` | Merge evenimente nivel 1 |
| `merge_houses_nivel1.py` | Merge case nivel 1 |
| `merge_locations_nivel1.py` | Merge locații nivel 1 |
| `merge_title_prefix_duplicates.py` | Merge duplicate cu prefix titlu |
| `position_locations_nivel1.py` | Poziționare locații pe hartă |
| `reconcile_aliases_relations.py` | Reconciliere aliasuri și relații |
| `reconsolidate_titles.py` | Reconsolidare titluri |
| `retire_misplaced_coordinates.py` | Retragere coordonate greșite |
| `split_entitati_apply.py` | Splitting entități comasate |
| `sync_id_map_and_rescan_compounds.py` | Sincronizare id_map + rescanare |
| `unify_events_schema.py` | Unificare schemă evenimente |

## Dacă trebuie totuși să rerul un script

1. Restaurează backup-ul corespunzător (dacă scriptul a creat unul)
2. Verifică starea curentă a datelor
3. Înțelege exact ce face scriptul
4. Rulează cu maximă precauție
