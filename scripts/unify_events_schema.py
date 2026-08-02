#!/usr/bin/env python3
"""Normalize imported event fields to the runtime event schema.

The original 20 application events are intentionally left untouched.  Imported
events retain their Romanian ETL fields as evidence, while gaining the runtime
fields consumed by TimelineEngine and Timeline.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVENTS_PATH = ROOT / "data" / "events" / "events.json"
ID_MAP_PATH = ROOT / "data" / "_import" / "etl_output" / "id_map.json"


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def application_id(internal_id, id_map):
    """Resolve an imported ID only through the reviewed, deterministic map."""
    mapping = id_map.get(internal_id) or {}
    return mapping.get("app_id")


def main():
    events = read_json(EVENTS_PATH)
    id_map = read_json(ID_MAP_PATH)
    updated = location_resolved = location_null = 0

    normalized_events = []
    for raw_event in events:
        event = copy.deepcopy(raw_event)
        if not event.get("id_intern", "").startswith("EVENT_"):
            normalized_events.append(event)
            continue

        # Always materialize `year`.  Null is intentional and keeps these
        # records searchable in the Wiki while TimelineEngine can exclude them.
        event["year"] = event.get("an_aproximativ")

        internal_location_id = event.get("locatie_id")
        event["location"] = application_id(internal_location_id, id_map) if internal_location_id else None
        if event["location"] is None:
            location_null += 1
        else:
            location_resolved += 1

        # No PERSON_* map exists yet.  Use an application ID when one becomes
        # available; otherwise retain the source registry ID as the documented
        # safe fallback rather than guessing a character identity.
        event["participants"] = [
            application_id(participant.get("id"), id_map) or participant.get("id")
            for participant in event.get("participanti", [])
            if participant.get("id")
        ]
        normalized_events.append(event)
        updated += 1

    write_json(EVENTS_PATH, normalized_events)
    print(json.dumps({
        "normalized_imported_events": updated,
        "location_resolved": location_resolved,
        "location_null": location_null,
        "year_null": sum(event.get("year") is None for event in normalized_events
                         if event.get("id_intern", "").startswith("EVENT_")),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
