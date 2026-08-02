# Inventar scripturi `scripts/`

> Generat automat prin analiză statică (citire cod, NU rulare).
> Data: 2026-08-02

## Legendă verdict

| Verdict | Semnificație |
|---------|-------------|
| **activ** | Script reutilizabil, poate fi rulat în siguranță (sau are gărzi) |
| **unic-deja-rulat** | Operație unică, deja aplicată — rerularea poate corupe datele |
| **utilitar de citire** | Script read-only, nu modifică niciun fișier |

## Inventar complet

| Fișier | Scrie în `data/` | Gărzi | Verdict |
|--------|:-----------------:|-------|---------|
| `_check_targets.py` | ❌ | — | utilitar de citire |
| `aggregate_import.py` | ✅ `etl_output/` | argparse, DRY_RUN flag, backup | activ |
| `audit_referential_integrity.py` | ✅ `etl_output/` (raport) | argparse, `--fix` flag | activ |
| `build_distances.py` | ✅ `distances.json` | ❌ nici una | activ |
| `check_before.py` | ❌ | — | utilitar de citire |
| `check_unresolved_distante.py` | ❌ | — | utilitar de citire |
| `compare_consolidation.py` | ❌ | — | utilitar de citire |
| `consolidation_functions.py` | ❌ (bibliotecă) | — | utilitar de citire |
| `dedup_person_entities.py` | ✅ `characters.json`, `id_map.json` | backup | unic-deja-rulat |
| `detect_duplicate_identities.py` | ❌ | — | utilitar de citire |
| `enrich_houses_part3.py` | ✅ `houses.json` | ❌ nici una | unic-deja-rulat |
| `etl_objects_titles.py` | ✅ `characters.json` | backup | unic-deja-rulat |
| `filter_self_reference_statements.py` | ✅ `_import/statements_*.json` | ❌ nici una | unic-deja-rulat |
| `find_duplicate_events.py` | ✅ `etl_output/` (raport) | hash check, size check | activ |
| `find_new_locations.py` | ❌ | — | utilitar de citire |
| `find_title_prefix_duplicates.py` | ✅ `etl_output/` (raport) | — | activ |
| `fix_compound_person_ids.py` | ✅ `characters.json`, `events.json` | backup | unic-deja-rulat |
| `inspect_narrative_pairs.py` | ❌ | — | utilitar de citire |
| `match_crests.py` | ✅ `houses.json`, `assets/sigils/` | skip dacă existent | activ |
| `merge_characters_nivel4.py` | ✅ `characters.json` | backup | unic-deja-rulat |
| `merge_events_nivel1.py` | ✅ `events.json` | backup, FileExistsError guard | unic-deja-rulat |
| `merge_houses_nivel1.py` | ✅ `houses.json` | backup parțial | unic-deja-rulat |
| `merge_locations_nivel1.py` | ✅ `locations.json` | backup | unic-deja-rulat |
| `merge_title_prefix_duplicates.py` | ✅ `characters.json`, `id_map.json` | backup, EXCLUDED_CLUSTERS | unic-deja-rulat |
| `position_locations_nivel1.py` | ✅ `locations.json` | backup | unic-deja-rulat |
| `raport_completitudine.py` | ❌ | — | utilitar de citire |
| `reconcile_aliases_relations.py` | ✅ `houses.json`, `locations.json` | ❌ nici una | unic-deja-rulat |
| `reconsolidate_titles.py` | ✅ `characters.json` | ❌ nici una | unic-deja-rulat |
| `retire_misplaced_coordinates.py` | ✅ `locations.json` | ❌ nici una | unic-deja-rulat |
| `split_entitati_apply.py` | ✅ `characters.json`, `id_map.json` | backup | unic-deja-rulat |
| `sync_id_map_and_rescan_compounds.py` | ✅ `id_map.json`, `characters.json` | backup | unic-deja-rulat |
| `test_distance_tool.py` | ❌ | — | utilitar de citire |
| `unify_events_schema.py` | ✅ `events.json` | ❌ nici una | unic-deja-rulat |
| `verify_location_subtypes.py` | ❌ | — | utilitar de citire |
| `verify_reconsolidation.py` | ❌ | — | utilitar de citire |

## Sumar

| Categorie | Număr |
|-----------|-------|
| **activ** (scrie, dar reutilizabil) | 6 |
| **unic-deja-rulat** (mutat în `archive/`) | 18 |
| **utilitar de citire** (read-only) | 11 |
| **Total** | **35** |

## Scripturi active care scriu în `data/` fără gardă completă

Aceste scripturi au primit garda `--i-know-what-im-doing`:

| Script | Ce scrie |
|--------|---------|
| `build_distances.py` | `data/locations/distances.json` |
| `match_crests.py` | `data/houses/houses.json` + `assets/sigils/` |
