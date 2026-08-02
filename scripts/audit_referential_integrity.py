#!/usr/bin/env python3
"""
audit_referential_integrity.py
==============================
Auditează integritatea referențială a tuturor fișierelor de date GOT MAP.
NU modifică niciun fișier — doar raportează referințele rupte.

Verifică sistematic:
  a) events.json      — location / locatie_id / participants / participanti
  b) characters.json  — membru_al / parinti / copii / frati / casatorit_cu
  c) houses.json      — relatii (ally_of / enemy_of / vassal_of / liege_of)
  d) locations.json   — evenimente (text liber? → confirmă cu exemple)
  e) distances.json   — location_a_id / location_b_id
  f) objects.json      — made_by[].creator / owned_by[].proprietar
  g) titles.json       — purtatori[].persoana_id

Scrie raportul în data/_import/etl_output/audit_integritate_referentiala.json
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

EVENTS_PATH     = os.path.join(DATA_DIR, "events",     "events.json")
CHARS_PATH      = os.path.join(DATA_DIR, "characters", "characters.json")
HOUSES_PATH     = os.path.join(DATA_DIR, "houses",     "houses.json")
LOCATIONS_PATH  = os.path.join(DATA_DIR, "locations",  "locations.json")
DISTANCES_PATH  = os.path.join(DATA_DIR, "locations",  "distances.json")
OBJECTS_PATH    = os.path.join(DATA_DIR, "objects",     "objects.json")
TITLES_PATH     = os.path.join(DATA_DIR, "titles",      "titles.json")
ID_MAP_PATH     = os.path.join(DATA_DIR, "_import", "etl_output", "id_map.json")
OUTPUT_PATH     = os.path.join(DATA_DIR, "_import", "etl_output",
                               "audit_integritate_referentiala.json")


def load_json(path):
    """Load a JSON file with UTF-8 encoding."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_id_set(data, key="id"):
    """Return the set of all `key` values from a list of dicts."""
    return {item[key] for item in data if key in item}


# ─── Resolution helpers ──────────────────────────────────────────────────────

def resolve_via_id_map(intern_id, id_map):
    """
    Resolve an internal ID (PERSON_*, HOUSE_*, LOCATION_*) through id_map.
    Returns (app_id, found_in_map).
    If the ID is not in id_map, returns (None, False).
    """
    entry = id_map.get(intern_id)
    if entry is None:
        return None, False
    return entry.get("app_id"), True


def suggest_correction(intern_id, id_map):
    """
    If intern_id is in id_map and has status 'redirect', return the app_id
    it redirects to. Otherwise return None.
    """
    entry = id_map.get(intern_id)
    if entry and entry.get("status") == "redirect":
        return entry.get("app_id")
    return None


# ─── Issue collector ──────────────────────────────────────────────────────────

class AuditReport:
    def __init__(self):
        # key = (file, field) → list of issue dicts
        self.issues = defaultdict(list)
        # key = (file, field) → int (total refs checked)
        self.counts_checked = defaultdict(int)
        self.counts_broken  = defaultdict(int)

    def add_issue(self, file_label, field, entity_id, broken_value,
                  reason, suggestion=None):
        key = (file_label, field)
        issue = {
            "entity_id": entity_id,
            "field": field,
            "broken_value": broken_value,
            "reason": reason,
        }
        if suggestion:
            issue["suggested_fix"] = suggestion
        self.issues[key].append(issue)
        self.counts_broken[key] += 1

    def tick(self, file_label, field, n=1):
        """Record that n references were checked for this (file, field)."""
        self.counts_checked[(file_label, field)] += n

    def to_dict(self):
        """Produce the final JSON-serializable report."""
        groups = defaultdict(lambda: defaultdict(dict))
        all_keys = set(self.counts_checked.keys()) | set(self.counts_broken.keys())
        for (file_label, field) in sorted(all_keys):
            groups[file_label][field] = {
                "total_checked": self.counts_checked[(file_label, field)],
                "total_broken":  self.counts_broken[(file_label, field)],
                "broken_refs":   self.issues.get((file_label, field), []),
            }

        total_checked = sum(self.counts_checked.values())
        total_broken  = sum(self.counts_broken.values())

        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_references_checked": total_checked,
                "total_broken_references":  total_broken,
            },
            "by_file": dict(groups),
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  AUDIT FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def audit_events(events, location_ids, char_ids, id_map, report):
    """
    Audit events.json:
      - location (string slug) → must exist as id in locations.json
      - locatie_id (LOCATION_*) → resolve via id_map → app_id must exist in locations.json
      - participants (list of strings) → can be slug-style (check directly in characters.json)
                                         or PERSON_* (resolve via id_map)
      - participanti (list of {id, rol}) → extract .id (PERSON_*), resolve via id_map
    """
    FILE = "events.json"

    for ev in events:
        eid = ev.get("id", "<unknown>")

        # ── location (simple slug) ──
        loc = ev.get("location")
        if loc is not None:
            report.tick(FILE, "location")
            if loc not in location_ids:
                suggestion = None
                # Maybe it's in id_map as LOCATION_*?
                possible_key = "LOCATION_" + loc.upper()
                sug = suggest_correction(possible_key, id_map)
                if sug:
                    suggestion = f"id_map redirect: {possible_key} → {sug}"
                report.add_issue(FILE, "location", eid, loc,
                                 "location slug not found in locations.json",
                                 suggestion)

        # ── locatie_id (LOCATION_*) ──
        lid = ev.get("locatie_id")
        if lid is not None:
            report.tick(FILE, "locatie_id")
            app_id, found = resolve_via_id_map(lid, id_map)
            if not found:
                report.add_issue(FILE, "locatie_id", eid, lid,
                                 "locatie_id not found in id_map.json")
            elif app_id not in location_ids:
                suggestion = suggest_correction(lid, id_map)
                sug_text = f"id_map redirect → {suggestion}" if suggestion else None
                report.add_issue(FILE, "locatie_id", eid, lid,
                                 f"resolved app_id '{app_id}' not in locations.json",
                                 sug_text)

        # ── participants (list of strings — mixed format) ──
        participants = ev.get("participants")
        if participants and isinstance(participants, list):
            for p in participants:
                if not isinstance(p, str):
                    continue
                report.tick(FILE, "participants")
                if p.startswith("PERSON_"):
                    # Resolve through id_map
                    app_id, found = resolve_via_id_map(p, id_map)
                    if not found:
                        report.add_issue(FILE, "participants", eid, p,
                                         "PERSON_* ID not found in id_map.json")
                    elif app_id not in char_ids:
                        sug = suggest_correction(p, id_map)
                        sug_text = f"id_map redirect → {sug}" if sug else None
                        report.add_issue(FILE, "participants", eid, p,
                                         f"resolved app_id '{app_id}' not in characters.json",
                                         sug_text)
                else:
                    # Slug-style — check directly
                    if p not in char_ids:
                        report.add_issue(FILE, "participants", eid, p,
                                         "participant slug not found in characters.json")

        # ── participanti (list of {id, rol} objects) ──
        participanti = ev.get("participanti")
        if participanti and isinstance(participanti, list):
            for pobj in participanti:
                if not isinstance(pobj, dict):
                    continue
                pid = pobj.get("id")
                if not pid or not isinstance(pid, str):
                    continue
                report.tick(FILE, "participanti")
                app_id, found = resolve_via_id_map(pid, id_map)
                if not found:
                    report.add_issue(FILE, "participanti", eid, pid,
                                     "PERSON_* ID not found in id_map.json")
                elif app_id not in char_ids:
                    sug = suggest_correction(pid, id_map)
                    sug_text = f"id_map redirect → {sug}" if sug else None
                    report.add_issue(FILE, "participanti", eid, pid,
                                     f"resolved app_id '{app_id}' not in characters.json",
                                     sug_text)


def audit_characters(characters, char_ids, house_ids, id_map, report):
    """
    Audit characters.json:
      - membru_al (HOUSE_*) → resolve via id_map → app_id must exist in houses.json
      - parinti / copii / frati / casatorit_cu (lists of PERSON_* strings)
        → resolve via id_map → app_id must exist in characters.json
    """
    FILE = "characters.json"

    for ch in characters:
        cid = ch.get("id", "<unknown>")

        # ── membru_al ──
        membru = ch.get("membru_al")
        if membru is not None and isinstance(membru, str) and membru:
            report.tick(FILE, "membru_al")
            if membru.startswith("HOUSE_"):
                app_id, found = resolve_via_id_map(membru, id_map)
                if not found:
                    report.add_issue(FILE, "membru_al", cid, membru,
                                     "HOUSE_* ID not found in id_map.json")
                elif app_id not in house_ids:
                    sug = suggest_correction(membru, id_map)
                    sug_text = f"id_map redirect → {sug}" if sug else None
                    report.add_issue(FILE, "membru_al", cid, membru,
                                     f"resolved app_id '{app_id}' not in houses.json",
                                     sug_text)
            else:
                # Direct slug
                if membru not in house_ids:
                    report.add_issue(FILE, "membru_al", cid, membru,
                                     "house slug not found in houses.json")

        # ── Relation fields: parinti, copii, frati, casatorit_cu ──
        for field_name in ("parinti", "copii", "frati", "casatorit_cu"):
            refs = ch.get(field_name)
            if not refs or not isinstance(refs, list):
                continue
            for ref in refs:
                if not isinstance(ref, str) or not ref:
                    continue
                report.tick(FILE, field_name)
                if ref.startswith("PERSON_"):
                    app_id, found = resolve_via_id_map(ref, id_map)
                    if not found:
                        report.add_issue(FILE, field_name, cid, ref,
                                         "PERSON_* ID not found in id_map.json")
                    elif app_id not in char_ids:
                        sug = suggest_correction(ref, id_map)
                        sug_text = f"id_map redirect → {sug}" if sug else None
                        report.add_issue(FILE, field_name, cid, ref,
                                         f"resolved app_id '{app_id}' not in characters.json",
                                         sug_text)
                else:
                    # Direct slug
                    if ref not in char_ids:
                        report.add_issue(FILE, field_name, cid, ref,
                                         "person slug not found in characters.json")


def audit_houses(houses, house_ids, char_ids, id_map, report):
    """
    Audit houses.json:
      - relatii.ally_of / enemy_of / vassal_of / liege_of — each entry is an
        object with .id (PERSON_* or HOUSE_*) → resolve via id_map → check
        existence in the appropriate collection.
    """
    FILE = "houses.json"

    for h in houses:
        hid = h.get("id", "<unknown>")
        relatii = h.get("relatii")
        if not relatii or not isinstance(relatii, dict):
            continue

        for rel_type in ("ally_of", "enemy_of", "vassal_of", "liege_of"):
            entries = relatii.get(rel_type)
            if not entries or not isinstance(entries, list):
                continue
            field = f"relatii.{rel_type}"
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                rid = entry.get("id")
                if not rid or not isinstance(rid, str):
                    continue
                report.tick(FILE, field)

                app_id, found = resolve_via_id_map(rid, id_map)
                if not found:
                    report.add_issue(FILE, field, hid, rid,
                                     f"{rid} not found in id_map.json")
                else:
                    # Determine target collection based on prefix
                    if rid.startswith("HOUSE_"):
                        if app_id not in house_ids:
                            sug = suggest_correction(rid, id_map)
                            sug_text = f"id_map redirect → {sug}" if sug else None
                            report.add_issue(FILE, field, hid, rid,
                                             f"resolved app_id '{app_id}' not in houses.json",
                                             sug_text)
                    elif rid.startswith("PERSON_"):
                        if app_id not in char_ids:
                            sug = suggest_correction(rid, id_map)
                            sug_text = f"id_map redirect → {sug}" if sug else None
                            report.add_issue(FILE, field, hid, rid,
                                             f"resolved app_id '{app_id}' not in characters.json",
                                             sug_text)
                    else:
                        # Unknown prefix — report as warning
                        report.add_issue(FILE, field, hid, rid,
                                         f"unknown ID prefix, cannot determine target collection")


def audit_locations(locations, report):
    """
    Audit locations.json:
      - evenimente — inspect to confirm it is free text (descriptive prose),
        not ID references. Report finding with examples.
    """
    FILE = "locations.json"
    field = "evenimente"

    examples = []
    total_locs_with_ev = 0
    total_items = 0
    looks_like_id = 0

    for loc in locations:
        lid = loc.get("id", "<unknown>")
        ev_list = loc.get("evenimente")
        if not ev_list or not isinstance(ev_list, list):
            continue
        total_locs_with_ev += 1
        for item in ev_list:
            total_items += 1
            if isinstance(item, str):
                # Heuristic: if it's short (< 40 chars), has no spaces, and
                # looks like a slug, treat as potential ID
                if len(item) < 40 and " " not in item and "_" in item:
                    looks_like_id += 1
                elif len(examples) < 5:
                    examples.append({"location_id": lid, "value": item[:200]})

    report.tick(FILE, "evenimente (text liber — confirmare)", total_items)

    return {
        "total_locations_with_evenimente": total_locs_with_ev,
        "total_items_in_evenimente":       total_items,
        "items_that_look_like_ids":        looks_like_id,
        "confirmed_text_liber":            looks_like_id == 0,
        "examples":                        examples,
    }


def audit_distances(distances, location_ids, report):
    """
    Audit distances.json:
      - location_a_id / location_b_id — simple slugs, check directly
        in locations.json (no id_map resolution).
    """
    FILE = "distances.json"

    for d in distances:
        did = d.get("id", "<unknown>")

        for field in ("location_a_id", "location_b_id"):
            val = d.get(field)
            if val is None or not isinstance(val, str):
                continue
            report.tick(FILE, field)
            if val not in location_ids:
                report.add_issue(FILE, field, did, val,
                                 f"location slug not found in locations.json")


def audit_objects(objects, char_ids, id_map, report):
    """
    Audit objects.json:
      - made_by[].creator (PERSON_*) → resolve via id_map
      - owned_by[].proprietar (PERSON_*) → resolve via id_map
      - given_by[].donator → skip (free-text name, not an ID reference)
    """
    FILE = "objects.json"

    for obj in objects:
        oid = obj.get("id", "<unknown>")

        # ── made_by[].creator ──
        made_by = obj.get("made_by")
        if made_by and isinstance(made_by, list):
            for entry in made_by:
                if not isinstance(entry, dict):
                    continue
                creator = entry.get("creator")
                if not creator or not isinstance(creator, str):
                    continue
                report.tick(FILE, "made_by[].creator")
                if creator.startswith("PERSON_"):
                    app_id, found = resolve_via_id_map(creator, id_map)
                    if not found:
                        report.add_issue(FILE, "made_by[].creator", oid, creator,
                                         "PERSON_* ID not found in id_map.json")
                    elif app_id not in char_ids:
                        sug = suggest_correction(creator, id_map)
                        sug_text = f"id_map redirect → {sug}" if sug else None
                        report.add_issue(FILE, "made_by[].creator", oid, creator,
                                         f"resolved app_id '{app_id}' not in characters.json",
                                         sug_text)
                else:
                    # Slug-style direct check
                    if creator not in char_ids:
                        report.add_issue(FILE, "made_by[].creator", oid, creator,
                                         "creator slug not found in characters.json")

        # ── owned_by[].proprietar ──
        owned_by = obj.get("owned_by")
        if owned_by and isinstance(owned_by, list):
            for entry in owned_by:
                if not isinstance(entry, dict):
                    continue
                prop = entry.get("proprietar")
                if not prop or not isinstance(prop, str):
                    continue
                report.tick(FILE, "owned_by[].proprietar")
                if prop.startswith("PERSON_"):
                    app_id, found = resolve_via_id_map(prop, id_map)
                    if not found:
                        report.add_issue(FILE, "owned_by[].proprietar", oid, prop,
                                         "PERSON_* ID not found in id_map.json")
                    elif app_id not in char_ids:
                        sug = suggest_correction(prop, id_map)
                        sug_text = f"id_map redirect → {sug}" if sug else None
                        report.add_issue(FILE, "owned_by[].proprietar", oid, prop,
                                         f"resolved app_id '{app_id}' not in characters.json",
                                         sug_text)
                else:
                    if prop not in char_ids:
                        report.add_issue(FILE, "owned_by[].proprietar", oid, prop,
                                         "proprietar slug not found in characters.json")

        # ── given_by[].donator — SKIP (free-text, not an ID reference) ──


def audit_titles(titles, char_ids, house_ids, id_map, report):
    """
    Audit titles.json:
      - purtatori[].persoana_id — PERSON_* or HOUSE_* → resolve via id_map
        Also handle cases where persoana_id is free text (not a PERSON_*/HOUSE_* ID).
    """
    FILE = "titles.json"
    field = "purtatori[].persoana_id"

    for t in titles:
        tid = t.get("id", "<unknown>")
        purtatori = t.get("purtatori")
        if not purtatori or not isinstance(purtatori, list):
            continue
        for entry in purtatori:
            if not isinstance(entry, dict):
                continue
            pid = entry.get("persoana_id")
            if not pid or not isinstance(pid, str):
                continue
            report.tick(FILE, field)

            if pid.startswith("PERSON_"):
                app_id, found = resolve_via_id_map(pid, id_map)
                if not found:
                    report.add_issue(FILE, field, tid, pid,
                                     "PERSON_* ID not found in id_map.json")
                elif app_id not in char_ids:
                    sug = suggest_correction(pid, id_map)
                    sug_text = f"id_map redirect → {sug}" if sug else None
                    report.add_issue(FILE, field, tid, pid,
                                     f"resolved app_id '{app_id}' not in characters.json",
                                     sug_text)
            elif pid.startswith("HOUSE_"):
                app_id, found = resolve_via_id_map(pid, id_map)
                if not found:
                    report.add_issue(FILE, field, tid, pid,
                                     "HOUSE_* ID not found in id_map.json")
                elif app_id not in house_ids:
                    sug = suggest_correction(pid, id_map)
                    sug_text = f"id_map redirect → {sug}" if sug else None
                    report.add_issue(FILE, field, tid, pid,
                                     f"resolved app_id '{app_id}' not in houses.json",
                                     sug_text)
            else:
                # Free-text persoana_id (not a structured ID) — report as
                # informational, not necessarily broken
                report.add_issue(FILE, field, tid, pid,
                                 "persoana_id is free text, not PERSON_*/HOUSE_* format "
                                 "(cannot validate through id_map)")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("  AUDIT INTEGRITATE REFERENȚIALĂ — GOT MAP")
    print("=" * 70)
    print()

    # ── Load data ──
    print("Loading data files...")
    events     = load_json(EVENTS_PATH)
    characters = load_json(CHARS_PATH)
    houses     = load_json(HOUSES_PATH)
    locations  = load_json(LOCATIONS_PATH)
    distances  = load_json(DISTANCES_PATH)
    objects    = load_json(OBJECTS_PATH)
    titles     = load_json(TITLES_PATH)
    id_map     = load_json(ID_MAP_PATH)
    print(f"  events:     {len(events):>5}")
    print(f"  characters: {len(characters):>5}")
    print(f"  houses:     {len(houses):>5}")
    print(f"  locations:  {len(locations):>5}")
    print(f"  distances:  {len(distances):>5}")
    print(f"  objects:    {len(objects):>5}")
    print(f"  titles:     {len(titles):>5}")
    print(f"  id_map:     {len(id_map):>5} entries")
    print()

    # ── Build lookup sets ──
    char_ids     = build_id_set(characters)
    house_ids    = build_id_set(houses)
    location_ids = build_id_set(locations)

    report = AuditReport()

    # ── Run audits ──
    print("Auditing events.json...")
    audit_events(events, location_ids, char_ids, id_map, report)

    print("Auditing characters.json...")
    audit_characters(characters, char_ids, house_ids, id_map, report)

    print("Auditing houses.json...")
    audit_houses(houses, house_ids, char_ids, id_map, report)

    print("Auditing locations.json (evenimente — text liber check)...")
    evenimente_analysis = audit_locations(locations, report)

    print("Auditing distances.json...")
    audit_distances(distances, location_ids, report)

    print("Auditing objects.json...")
    audit_objects(objects, char_ids, id_map, report)

    print("Auditing titles.json...")
    audit_titles(titles, char_ids, house_ids, id_map, report)

    # ── Build final report ──
    result = report.to_dict()
    result["locations_evenimente_analysis"] = evenimente_analysis

    # ── Write output ──
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # ── Console summary ──
    print()
    print("=" * 70)
    print("  SUMAR")
    print("=" * 70)
    print(f"  Total referințe verificate: {result['summary']['total_references_checked']}")
    print(f"  Total referințe rupte:      {result['summary']['total_broken_references']}")
    print()

    print("  ┌─ Per fișier / câmp ──────────────────────────────────────────")
    for file_label, fields in sorted(result["by_file"].items()):
        print(f"  │")
        print(f"  ├─ {file_label}")
        for field, info in sorted(fields.items()):
            status = "✓" if info["total_broken"] == 0 else "✗"
            print(f"  │   {status}  {field}: "
                  f"{info['total_broken']}/{info['total_checked']} broken")
    print(f"  └──────────────────────────────────────────────────────────────")
    print()

    # ── Evenimente text liber analysis ──
    ea = evenimente_analysis
    print("  ┌─ locations.json → evenimente (text liber confirmare) ──────")
    print(f"  │  Locații cu evenimente: {ea['total_locations_with_evenimente']}")
    print(f"  │  Total intrări:        {ea['total_items_in_evenimente']}")
    print(f"  │  Par a fi ID-uri:      {ea['items_that_look_like_ids']}")
    print(f"  │  Confirmat text liber: {'DA' if ea['confirmed_text_liber'] else 'NU'}")
    if ea["examples"]:
        print(f"  │  Exemple:")
        for ex in ea["examples"]:
            val = ex["value"][:100]
            print(f"  │    [{ex['location_id']}] → \"{val}\"")
    print(f"  └──────────────────────────────────────────────────────────────")
    print()

    # ── Top 5 broken examples per most common issue types ──
    print("  ┌─ Top 5 cele mai frecvente tipuri de referințe rupte ───────")
    # Rank by count of broken refs
    ranked = sorted(
        [(k, v) for k, v in report.counts_broken.items() if v > 0],
        key=lambda x: -x[1]
    )
    for i, ((file_label, field), count) in enumerate(ranked[:5]):
        print(f"  │")
        print(f"  │  #{i+1}: {file_label} / {field} — {count} broken")
        examples = report.issues[(file_label, field)][:5]
        for ex in examples:
            sug = f" [sugestie: {ex['suggested_fix']}]" if ex.get("suggested_fix") else ""
            print(f"  │     entity={ex['entity_id']}, "
                  f"val={ex['broken_value']}: "
                  f"{ex['reason']}{sug}")
    print(f"  └──────────────────────────────────────────────────────────────")
    print()

    print(f"Raport complet scris în:\n  {OUTPUT_PATH}")
    print()

    return result["summary"]["total_broken_references"]


if __name__ == "__main__":
    broken_count = main()
    sys.exit(0 if broken_count == 0 else 1)
