#!/usr/bin/env python3
"""Merge reviewed event ETL output into the app data, with a one-time backup."""

from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "_import" / "etl_output"
EVENTS_PATH = ROOT / "data" / "events" / "events.json"
BACKUP_PATH = OUTPUT / "backups" / "events.pre_nivel1_merge.json"


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def merge_enrichment(existing, incoming):
    """Refresh ETL evidence while retaining all pre-existing app event data."""
    result = copy.deepcopy(existing)
    for key in (
        "id_intern", "aliasuri", "participanti", "locatie_id", "an_aproximativ",
        "nume_generat", "_afirmatii_pe_predicat", "surse", "_completitudine",
    ):
        if key in incoming:
            result[key] = copy.deepcopy(incoming[key])
    result.pop("_etl", None)
    return result


def main():
    events = read_json(EVENTS_PATH)
    incoming_events = read_json(OUTPUT / "events_new.json")
    existing_by_id = {event["id"]: event for event in events}
    if len(existing_by_id) != len(events):
        raise ValueError("Duplicate IDs in events.json")

    # A backup is taken before the only write to the live application data.
    if BACKUP_PATH.exists():
        raise FileExistsError(f"Refusing to overwrite existing backup: {BACKUP_PATH}")
    BACKUP_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(EVENTS_PATH, BACKUP_PATH)

    enriched = added = 0
    for raw_incoming in incoming_events:
        incoming = copy.deepcopy(raw_incoming)
        etl = incoming.get("_etl") or {}
        app_id = etl.get("matched_app_id")
        if app_id:
            if app_id not in existing_by_id:
                raise ValueError(f"Mapped enrichment target missing: {incoming['id_intern']} -> {app_id}")
            existing_by_id[app_id] = merge_enrichment(existing_by_id[app_id], incoming)
            enriched += 1
        else:
            incoming.pop("_etl", None)
            if incoming["id"] in existing_by_id:
                raise ValueError(f"New event ID already exists: {incoming['id']}")
            existing_by_id[incoming["id"]] = incoming
            added += 1

    original_ids = [event["id"] for event in events]
    merged = [existing_by_id[event_id] for event_id in original_ids]
    merged.extend(existing_by_id[event_id] for event_id in sorted(set(existing_by_id) - set(original_ids)))
    write_json(EVENTS_PATH, merged)
    print(json.dumps({
        "backup": str(BACKUP_PATH.relative_to(ROOT)),
        "modified_enrichment": enriched,
        "added_new": added,
        "total_events": len(merged),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
