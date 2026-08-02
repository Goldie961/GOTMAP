#!/usr/bin/env python3
"""Apply the reviewed Nivel 1 house merge without touching import sources."""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "data" / "_import"
OUTPUT = IMPORT / "etl_output"
RELATION_KEYS = ("ally_of", "enemy_of", "vassal_of", "liege_of")
AMBIGUOUS_IDS = {"HOUSE_CHARLTON", "HOUSE_PAEGE", "HOUSE_PARREN"}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def is_missing(value):
    return value is None or value == ""


def exact_unique(items):
    result, seen = [], set()
    for item in items:
        marker = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if marker not in seen:
            result.append(copy.deepcopy(item))
            seen.add(marker)
    return result


def merge_metadata(existing, incoming):
    result = copy.deepcopy(existing or {})
    incoming = incoming or {}
    for key, value in incoming.items():
        if key == "timeline":
            # Only exactly identical entries collapse; near-matches remain evidence.
            result[key] = exact_unique((result.get(key) or []) + (value or []))
        elif key not in result or is_missing(result[key]):
            result[key] = copy.deepcopy(value)
    return result


def merge_enrichment(existing, incoming):
    result = copy.deepcopy(existing)
    for key, value in incoming.items():
        if key in {"metadata", "ownership_history", "relatii", "_etl"}:
            continue
        if key not in result or is_missing(result[key]):
            result[key] = copy.deepcopy(value)

    # The ETL candidate starts from the old record, so exact historical entries
    # are retained once while genuinely new import entries are appended.
    result["ownership_history"] = exact_unique(
        (existing.get("ownership_history") or []) + (incoming.get("ownership_history") or [])
    )
    result["metadata"] = merge_metadata(existing.get("metadata"), incoming.get("metadata"))

    current_relations = existing.get("relatii") or {}
    imported_relations = incoming.get("relatii") or {}
    result["relatii"] = {
        relation: list(dict.fromkeys((current_relations.get(relation) or []) + (imported_relations.get(relation) or [])))
        for relation in RELATION_KEYS
    }
    # Keep any non-standard legacy relationship arrays as well.
    for relation, values in current_relations.items():
        if relation not in result["relatii"]:
            result["relatii"][relation] = copy.deepcopy(values)

    # These are ETL-derived audit/evidence fields and should be refreshed.
    for key in ("_afirmatii_pe_predicat", "surse", "relatii_detaliate", "_completitudine", "id_intern", "aliasuri"):
        if key in incoming:
            if key in {"surse", "aliasuri"} and result.get(key):
                result[key] = exact_unique((result.get(key) or []) + (incoming.get(key) or []))
            else:
                result[key] = copy.deepcopy(incoming[key])
    result.pop("_etl", None)
    return result


def decision_payload(entity_id, incoming, entities, statements, existing_by_id):
    entity = entities[entity_id]
    candidates = incoming.get("_etl", {}).get("candidate_app_ids", [])
    context = [statement for statement in statements
               if statement.get("subject") == entity_id or statement.get("object") == entity_id]
    return {
        "id_intern": entity_id,
        "nume_canonic": entity.get("nume_canonic"),
        "aliasuri": entity.get("aliasuri", []),
        "registru_entitate": entity,
        "candidati_app_id": candidates,
        "inregistrari_existente_candidat": [existing_by_id[candidate] for candidate in candidates if candidate in existing_by_id],
        "context_statements": context,
        "candidate_etl": incoming,
        "actiune": "NEAPLICAT — necesită decizie manuală; nu a fost adăugat sau îmbogățit automat."
    }


def main():
    houses_path = ROOT / "data" / "houses" / "houses.json"
    houses = read_json(houses_path)
    incoming_houses = read_json(OUTPUT / "houses_new.json")
    id_map = read_json(OUTPUT / "id_map.json")
    entities = {}
    for path in sorted(IMPORT.glob("entities_part*.json")):
        entities.update({entity["id"]: entity for entity in read_json(path)})
    statements = []
    for path in sorted(IMPORT.glob("statements_case_nobile_part*.json")):
        statements.extend(read_json(path))

    existing_by_id = {house["id"]: house for house in houses}
    incoming_by_internal_id = {house["id_intern"]: house for house in incoming_houses}
    enriched = added = 0
    manual = []

    for entity_id, mapping in id_map.items():
        if mapping.get("collection") != "houses" or entity_id not in incoming_by_internal_id:
            continue
        incoming = incoming_by_internal_id[entity_id]
        if entity_id in AMBIGUOUS_IDS:
            manual.append(decision_payload(entity_id, incoming, entities, statements, existing_by_id))
            continue
        if mapping["status"] == "enrichment":
            app_id = mapping["app_id"]
            if app_id not in existing_by_id:
                raise ValueError(f"Mapped enrichment target missing: {entity_id} -> {app_id}")
            existing_by_id[app_id] = merge_enrichment(existing_by_id[app_id], incoming)
            enriched += 1
        elif mapping["status"] == "new":
            new_house = copy.deepcopy(incoming)
            new_house["id_intern"] = entity_id
            new_house["coordinates"] = None
            new_house.pop("_etl", None)
            if new_house["id"] in existing_by_id:
                raise ValueError(f"New house ID already exists: {new_house['id']}")
            existing_by_id[new_house["id"]] = new_house
            added += 1

    # Preserve the existing order and append only actual new records deterministically.
    original_ids = [house["id"] for house in houses]
    merged = [existing_by_id[house_id] for house_id in original_ids]
    merged.extend(existing_by_id[house_id] for house_id in sorted(set(existing_by_id) - set(original_ids)))
    write_json(houses_path, merged)
    write_json(OUTPUT / "case_de_decis_manual.json", manual)
    print(json.dumps({"modified_enrichment": enriched, "added_new": added, "manual_ambiguous": len(manual),
                      "total_houses": len(merged)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
