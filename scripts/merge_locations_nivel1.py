#!/usr/bin/env python3
"""Apply the reviewed Nivel 1 location merge without changing coordinates."""

from __future__ import annotations

import copy
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "data" / "_import"
OUTPUT = IMPORT / "etl_output"
RELATION_KEYS = ("part_of", "near")


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalized(value: str | None):
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(char for char in value if not unicodedata.combining(char)).casefold()
    return re.sub(r"[^a-z0-9]+", "", value)


def relation_item(target_id, evidence, predicate):
    return {
        "id": target_id,
        "source_book": evidence.get("source_book"),
        "source_fragment": evidence.get("source_fragment"),
        "source_page": evidence.get("source_page"),
        "confidence": evidence.get("confidence", "unknown"),
        "direction": evidence.get("directie"),
        "predicate": predicate,
    }


def sourced_relations(location, canonical_index):
    """Derive only relations supported by the ETL assertion evidence."""
    relations = {key: [] for key in RELATION_KEYS}
    grouped = location.get("_afirmatii_pe_predicat") or {}
    for predicate, relation in (("near", "near"), ("region", "part_of"), ("location", "part_of")):
        for evidence in grouped.get(predicate, []):
            value = evidence.get("valoare")
            if isinstance(value, str) and value.startswith("LOCATION_"):
                targets = [value]
            elif isinstance(value, str):
                targets = canonical_index.get(normalized(value), [])
            else:
                targets = []
            for target in targets:
                if target != location.get("id_intern"):
                    relations[relation].append(relation_item(target, evidence, predicate))
    return relations


def merge_enrichment(existing, incoming):
    """Refresh ETL fields while preserving the app's coordinates and ownership history."""
    result = copy.deepcopy(existing)
    for key in (
        "id_intern", "aliasuri", "relatii", "subtip", "descriere_fizica", "evenimente",
        "_afirmatii_pe_predicat", "surse", "_completitudine",
    ):
        if key in incoming:
            result[key] = copy.deepcopy(incoming[key])
    result.pop("_etl", None)
    return result


def main():
    locations_path = ROOT / "data" / "locations" / "locations.json"
    locations = read_json(locations_path)
    incoming_locations = read_json(OUTPUT / "locations_new.json")

    entities = {}
    for path in sorted(IMPORT.glob("entities_part*.json")):
        entities.update({entity["id"]: entity for entity in read_json(path)})
    canonical_index = defaultdict(list)
    for entity in entities.values():
        key = normalized(entity.get("nume_canonic"))
        if key:
            canonical_index[key].append(entity["id"])

    existing_by_id = {location["id"]: location for location in locations}
    if len(existing_by_id) != len(locations):
        raise ValueError("Duplicate IDs in locations.json")

    enriched = added = 0
    for raw_incoming in incoming_locations:
        incoming = copy.deepcopy(raw_incoming)
        incoming["relatii"] = sourced_relations(incoming, canonical_index)
        etl = incoming.get("_etl") or {}
        app_id = etl.get("matched_app_id")
        if app_id:
            if app_id not in existing_by_id:
                raise ValueError(f"Mapped enrichment target missing: {incoming['id_intern']} -> {app_id}")
            existing_by_id[app_id] = merge_enrichment(existing_by_id[app_id], incoming)
            enriched += 1
        else:
            new_location = incoming
            # Positioning is deliberately deferred to the next prompt.
            new_location["coordinates"] = None
            new_location.pop("_etl", None)
            if new_location["id"] in existing_by_id:
                raise ValueError(f"New location ID already exists: {new_location['id']}")
            existing_by_id[new_location["id"]] = new_location
            added += 1

    original_ids = [location["id"] for location in locations]
    merged = [existing_by_id[location_id] for location_id in original_ids]
    merged.extend(existing_by_id[location_id] for location_id in sorted(set(existing_by_id) - set(original_ids)))
    write_json(locations_path, merged)
    print(json.dumps({
        "modified_enrichment": enriched,
        "added_new": added,
        "total_locations": len(merged),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
