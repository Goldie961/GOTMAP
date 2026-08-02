#!/usr/bin/env python3
"""Apply the reviewed Nivel 4 character merge to data/characters/characters.json."""

from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "data" / "_import"
OUTPUT = IMPORT / "etl_output"
CHARACTERS_PATH = ROOT / "data" / "characters" / "characters.json"
BACKUP_PATH = OUTPUT / "backups" / "characters_backup.json"

ARRAY_RELATION_KEYS = ("parinti", "copii", "frati", "casatorit_cu", "possible_parent_of", "age_at", "member_of")


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def is_missing(value):
    return value is None or value == "" or value == [] or value == {}


def exact_unique(items):
    result, seen = [], set()
    for item in items:
        marker = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if marker not in seen:
            result.append(copy.deepcopy(item))
            seen.add(marker)
    return result


def merge_character_enrichment(existing: dict, incoming: dict) -> dict:
    result = copy.deepcopy(existing)
    
    # 1. Scalar fields: preserve existing if present, otherwise take incoming
    for key in ("titlu_curent", "membru_al", "locatie_asociata", "description", "house", "born", "died", "canon"):
        if is_missing(result.get(key)) and not is_missing(incoming.get(key)):
            result[key] = copy.deepcopy(incoming[key])
            
    # 2. moarte field handling
    if is_missing(result.get("moarte")) or is_missing(result.get("moarte", {}).get("descriere")):
        if incoming.get("moarte"):
            result["moarte"] = copy.deepcopy(incoming["moarte"])

    # 3. Array fields (relational + titles)
    for key in ARRAY_RELATION_KEYS:
        curr_vals = result.get(key) or []
        inc_vals = incoming.get(key) or []
        if isinstance(curr_vals, list) and isinstance(inc_vals, list):
            result[key] = list(dict.fromkeys(curr_vals + inc_vals))

    # Titles handling (combine string titles and object titles cleanly)
    curr_titles = result.get("titles") or []
    inc_titles = incoming.get("titles") or []
    if curr_titles or inc_titles:
        result["titles"] = exact_unique(curr_titles + inc_titles)

    # Timeline handling
    curr_timeline = result.get("timeline") or []
    inc_timeline = incoming.get("timeline") or []
    if curr_timeline or inc_timeline:
        result["timeline"] = exact_unique(curr_timeline + inc_timeline)

    # 4. Refresh ETL audit and evidence fields
    for key in ("_afirmatii_pe_predicat", "surse", "_completitudine", "id_intern", "aliasuri"):
        if key in incoming:
            if key in {"surse", "aliasuri"} and result.get(key):
                result[key] = exact_unique((result.get(key) or []) + (incoming.get(key) or []))
            else:
                result[key] = copy.deepcopy(incoming[key])
                
    result.pop("_etl", None)
    return result


def main():
    # Step 1: Backup characters.json
    if CHARACTERS_PATH.exists():
        BACKUP_PATH.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(CHARACTERS_PATH, BACKUP_PATH)
        print(f"Backup created at: {BACKUP_PATH}")

    existing_chars = read_json(CHARACTERS_PATH) if CHARACTERS_PATH.exists() else []
    incoming_chars = read_json(OUTPUT / "characters_new.json")
    id_map = read_json(OUTPUT / "id_map.json") if (OUTPUT / "id_map.json").exists() else {}

    existing_by_id = {c["id"]: c for c in existing_chars}
    incoming_by_internal_id = {c["id_intern"]: c for c in incoming_chars if "id_intern" in c}

    enriched = 0
    added = 0

    # Step 2: Merge according to id_map
    for entity_id, mapping in id_map.items():
        if mapping.get("collection") != "characters" or entity_id not in incoming_by_internal_id:
            continue
        incoming = incoming_by_internal_id[entity_id]
        status = mapping.get("status")
        
        if status == "enrichment":
            app_id = mapping["app_id"]
            if app_id not in existing_by_id:
                raise ValueError(f"Mapped enrichment target missing: {entity_id} -> {app_id}")
            existing_by_id[app_id] = merge_character_enrichment(existing_by_id[app_id], incoming)
            enriched += 1
        elif status == "new":
            new_char = copy.deepcopy(incoming)
            new_char["id_intern"] = entity_id
            new_char.pop("_etl", None)
            if new_char["id"] in existing_by_id:
                existing_by_id[new_char["id"]] = merge_character_enrichment(existing_by_id[new_char["id"]], new_char)
                enriched += 1
            else:
                existing_by_id[new_char["id"]] = new_char
                added += 1

    # Also check any incoming characters that might not be in id_map
    for incoming in incoming_chars:
        cid = incoming["id"]
        if cid not in existing_by_id:
            new_char = copy.deepcopy(incoming)
            new_char.pop("_etl", None)
            existing_by_id[cid] = new_char
            added += 1

    # Preserve original 33 ordering first, append new ones deterministically sorted by ID
    original_ids = [c["id"] for c in existing_chars]
    merged = [existing_by_id[cid] for cid in original_ids if cid in existing_by_id]
    new_ids = sorted(set(existing_by_id) - set(original_ids))
    merged.extend(existing_by_id[cid] for cid in new_ids)

    # Step 3: Write merged JSON
    write_json(CHARACTERS_PATH, merged)
    print(json.dumps({
        "original_characters": len(existing_chars),
        "enriched": enriched,
        "added_new": added,
        "total_final_characters": len(merged)
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
