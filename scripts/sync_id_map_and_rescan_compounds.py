#!/usr/bin/env python3
"""
sync_id_map_and_rescan_compounds.py
===================================
Script pentru Prompt J:
Partea 1 — Sincronizare id_map.json via aliasuri din characters.json
Partea 2 — Rescanare compuneri de 3+ nume (și 2 nume) în characters, events, houses și id_map
"""

import os
import sys
import json
import shutil
import hashlib
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

CHARS_PATH   = os.path.join(DATA_DIR, "characters", "characters.json")
EVENTS_PATH  = os.path.join(DATA_DIR, "events", "events.json")
HOUSES_PATH  = os.path.join(DATA_DIR, "houses", "houses.json")
ID_MAP_PATH  = os.path.join(DATA_DIR, "_import", "etl_output", "id_map.json")

BACKUP_DIR = os.path.join(DATA_DIR, "_import", "etl_output", "backups")
ID_MAP_BACKUP_PATH = os.path.join(BACKUP_DIR, "id_map.pre_sincronizare.json")

ORPHANS_OUTPUT_PATH = os.path.join(DATA_DIR, "_import", "etl_output", "id_map_orfani_needecise.json")


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_file_hash_and_size(path):
    with open(path, "rb") as f:
        content = f.read()
    return hashlib.sha256(content).hexdigest(), len(content)


def main():
    print("=" * 70)
    print("  START PROMPT J: SINCRONIZARE ID_MAP + RESCANARE COMPUNERI 3+ NUME")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # STEP 1: BACKUP
    # -------------------------------------------------------------------------
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(ID_MAP_PATH, ID_MAP_BACKUP_PATH)
    print(f"[Backup] id_map.json salvat la: {ID_MAP_BACKUP_PATH}")

    # Load data
    characters = load_json(CHARS_PATH)
    id_map     = load_json(ID_MAP_PATH)
    events     = load_json(EVENTS_PATH)
    houses     = load_json(HOUSES_PATH)

    hash_chars_before, size_chars_before = get_file_hash_and_size(CHARS_PATH)
    print(f"[Characters Hash Înainte Partea 1] Size: {size_chars_before} bytes, SHA256: {hash_chars_before[:12]}...")

    # -------------------------------------------------------------------------
    # PARTEA 1: SINCRONIZARE ID_MAP.JSON VIA ALIASURI
    # -------------------------------------------------------------------------
    print("\n--- PARTEA 1: Sincronizare id_map.json via aliasuri ---")

    char_ids = {c["id"] for c in characters if "id" in c}

    # Build alias lookup map: map alias string -> real character id
    alias_to_real_id = {}
    for c in characters:
        real_id = c["id"]
        for a in c.get("aliasuri", []):
            if isinstance(a, str):
                a_str = a.strip()
                alias_to_real_id[a_str] = real_id
                alias_to_real_id[a_str.lower()] = real_id
                alias_to_real_id[a_str.upper()] = real_id
                if a_str.upper().startswith("PERSON_"):
                    clean = a_str[7:]
                    alias_to_real_id[clean] = real_id
                    alias_to_real_id[clean.lower()] = real_id
                    alias_to_real_id[clean.upper()] = real_id

    person_entries = {k: v for k, v in id_map.items() if k.startswith("PERSON_")}
    missing_app_id_entries = {k: v for k, v in person_entries.items() if v.get("app_id") not in char_ids}

    print(f"Total intrări PERSON_* în id_map: {len(person_entries)}")
    print(f"Total intrări PERSON_* cu app_id inexistent în characters.json: {len(missing_app_id_entries)}")

    resolved_part1 = 0
    orphans_part1 = []

    for k, v in missing_app_id_entries.items():
        app_id = v.get("app_id", "")
        real_id = (alias_to_real_id.get(k) or 
                   alias_to_real_id.get(app_id) or 
                   alias_to_real_id.get(app_id.lower()) or 
                   alias_to_real_id.get(k.upper()))

        if real_id:
            v["app_id"] = real_id
            v["status"] = "redirected"
            resolved_part1 += 1
        else:
            orphans_part1.append({
                "id_intern": k,
                "app_id_invalid": app_id,
                "motiv": "nicio entitate curentă nu-l are ca alias"
            })

    # Save updated id_map.json after Part 1
    save_json(ID_MAP_PATH, id_map)

    print(f"Partea 1 completă: {resolved_part1} re-rezolvate cu succes (redirect găsit prin alias), {len(orphans_part1)} candidați de orfane/compuse.")

    # Verify characters.json was NOT modified in Part 1
    hash_chars_after_p1, size_chars_after_p1 = get_file_hash_and_size(CHARS_PATH)
    print(f"[Characters Hash După Partea 1] Size: {size_chars_after_p1} bytes, SHA256: {hash_chars_after_p1[:12]}...")
    assert hash_chars_before == hash_chars_after_p1, "CRITICAL: characters.json WAS MODIFIED IN PART 1!"
    print("✓ Confirmat: characters.json NU a fost modificat în Partea 1!")

    # -------------------------------------------------------------------------
    # PARTEA 2: RESCANARE COMPUNERI DE 3+ NUME (ȘI 2 NUME)
    # -------------------------------------------------------------------------
    print("\n--- PARTEA 2: Rescanare compuneri de 3+ nume ---")

    # Build complete character lookup including updated id_map
    def build_alias_and_map_lookup():
        lookup = {}
        current_chars = {c["id"].lower() for c in characters if "id" in c}
        for c in characters:
            cid = c["id"].lower()
            lookup[cid] = cid
            lookup[f"person_{cid}"] = cid
            for a in c.get("aliasuri", []):
                if isinstance(a, str):
                    a_str = a.strip().lower()
                    lookup[a_str] = cid
                    if a_str.startswith("person_"):
                        lookup[a_str[7:]] = cid
                    else:
                        lookup[f"person_{a_str}"] = cid

        for k, v in id_map.items():
            if isinstance(v, dict) and v.get("app_id"):
                app_id = v["app_id"].lower()
                if app_id in current_chars:
                    lookup[k.lower()] = app_id
                    if k.lower().startswith("person_"):
                        lookup[k.lower()[7:]] = app_id

        return lookup

    lookup_map = build_alias_and_map_lookup()

    def resolve_single_person(ref):
        if not isinstance(ref, str) or not ref.strip():
            return None
        r = ref.strip().lower()
        if r in lookup_map:
            return lookup_map[r]
        if not r.startswith("person_"):
            r_p = f"person_{r}"
            if r_p in lookup_map:
                return lookup_map[r_p]
        else:
            raw = r[7:]
            if raw in lookup_map:
                return lookup_map[raw]
        return None

    def resolve_part_tokens(part_str, surname_fallback=None):
        res = resolve_single_person(f"PERSON_{part_str}")
        if res:
            return [res]
        if surname_fallback:
            res = resolve_single_person(f"PERSON_{part_str}_{surname_fallback}")
            if res:
                return [res]

        tokens = part_str.split("_")
        n = len(tokens)

        def find_spans(start_idx):
            if start_idx == n:
                return []
            for end_idx in range(n, start_idx, -1):
                sub_str = "_".join(tokens[start_idx:end_idx])
                res = resolve_single_person(f"PERSON_{sub_str}")
                if not res and surname_fallback:
                    res = resolve_single_person(f"PERSON_{sub_str}_{surname_fallback}")
                if res:
                    rest = find_spans(end_idx)
                    if rest is not None:
                        return [res] + rest
            return None

        return find_spans(0)

    def try_decompose_compound(val):
        if not isinstance(val, str) or not val.strip():
            return None

        val_clean = val.strip()
        # If it resolves directly to a single existing person, not a compound to split
        if resolve_single_person(val_clean):
            return None

        val_upper = val_clean.upper()
        if not val_upper.startswith("PERSON_"):
            return None

        raw = val_upper[7:]

        raw_cleaned = raw
        raw_cleaned = re.sub(r"FIII_SAI_|FIICELE_SALE_|GRUP_DE_PERSOANE_", "", raw_cleaned)

        surname_fallback = None
        tokens = raw_cleaned.split("_")
        if len(tokens) >= 2:
            surname_fallback = tokens[-1]

        parts = re.split(r"_(?:SI|ȘI|AND)_|,", raw_cleaned)
        if len(parts) >= 2:
            parts_clean = [p.strip("_") for p in parts if p.strip("_")]
            resolved_all = []
            for p in parts_clean:
                sub_res = resolve_part_tokens(p, surname_fallback)
                if sub_res is None:
                    return (False, val_clean)
                resolved_all.extend(sub_res)

            if resolved_all and len(resolved_all) >= 2:
                return (True, [f"PERSON_{r.upper()}" for r in resolved_all])
            else:
                return (False, val_clean)

        sub_res = resolve_part_tokens(raw_cleaned, surname_fallback)
        if sub_res and len(sub_res) >= 2:
            return (True, [f"PERSON_{r.upper()}" for r in sub_res])

        return (False, val_clean)

    # Decompose compound keys in id_map.json
    compound_keys_resolved = 0
    compound_3plus_resolved = []
    compound_2_resolved = []
    final_orphans = []

    for item in orphans_part1:
        k = item["id_intern"]
        res = try_decompose_compound(k)
        if res and res[0] is True:
            compound_keys_resolved += 1
            comps = res[1]
            first_comp_id = resolve_single_person(comps[0])
            id_map[k]["app_id"] = first_comp_id
            id_map[k]["status"] = "redirected"

            if len(comps) >= 3:
                compound_3plus_resolved.append((k, comps))
            else:
                compound_2_resolved.append((k, comps))

            # Ensure all component IDs exist in id_map
            for c_ref in comps:
                if c_ref not in id_map:
                    real_c = resolve_single_person(c_ref)
                    if real_c:
                        id_map[c_ref] = {
                            "app_id": real_c,
                            "collection": "characters",
                            "status": "enrichment",
                            "candidates": [real_c]
                        }
        else:
            final_orphans.append(item)

    # Also scan data fields in characters, events, houses
    total_data_compounds_resolved = 0
    modified_chars_count = 0
    modified_events_count = 0
    modified_houses_count = 0

    rel_fields = ["parinti", "copii", "frati", "casatorit_cu"]
    for ch in characters:
        cid = ch.get("id", "<unknown>")
        char_mod = False
        for fld in rel_fields:
            vals = ch.get(fld)
            if not vals or not isinstance(vals, list):
                continue
            new_vals = []
            fld_mod = False
            for v in vals:
                res = try_decompose_compound(v)
                if res is None:
                    new_vals.append(v)
                elif res[0] is True:
                    fld_mod = True
                    total_data_compounds_resolved += 1
                    for fixed_ref in res[1]:
                        if fixed_ref not in new_vals:
                            new_vals.append(fixed_ref)
                else:
                    new_vals.append(v)

            if fld_mod:
                seen = set()
                deduped = []
                for nv in new_vals:
                    if nv not in seen:
                        seen.add(nv)
                        deduped.append(nv)
                ch[fld] = deduped
                char_mod = True

        if char_mod:
            modified_chars_count += 1

    for ev in events:
        eid = ev.get("id", "<unknown>")
        ev_mod = False

        parts = ev.get("participants")
        if parts and isinstance(parts, list):
            new_parts = []
            parts_mod = False
            for p in parts:
                res = try_decompose_compound(p)
                if res is None:
                    new_parts.append(p)
                elif res[0] is True:
                    parts_mod = True
                    total_data_compounds_resolved += 1
                    for fixed_ref in res[1]:
                        if fixed_ref not in new_parts:
                            new_parts.append(fixed_ref)
                else:
                    new_parts.append(p)

            if parts_mod:
                seen = set()
                deduped = []
                for np in new_parts:
                    if np not in seen:
                        seen.add(np)
                        deduped.append(np)
                ev["participants"] = deduped
                ev_mod = True

        p_objs = ev.get("participanti")
        if p_objs and isinstance(p_objs, list):
            new_pobjs = []
            pobjs_mod = False
            for pobj in p_objs:
                if isinstance(pobj, dict) and "id" in pobj:
                    pid = pobj["id"]
                    res = try_decompose_compound(pid)
                    if res is None:
                        new_pobjs.append(pobj)
                    elif res[0] is True:
                        pobjs_mod = True
                        total_data_compounds_resolved += 1
                        for fixed_ref in res[1]:
                            new_item = dict(pobj)
                            new_item["id"] = fixed_ref
                            if not any(x.get("id") == fixed_ref for x in new_pobjs):
                                new_pobjs.append(new_item)
                    else:
                        new_pobjs.append(pobj)
                else:
                    new_pobjs.append(pobj)

            if pobjs_mod:
                ev["participanti"] = new_pobjs
                ev_mod = True

        if ev_mod:
            modified_events_count += 1

    for h in houses:
        hid = h.get("id", "<unknown>")
        h_mod = False
        rel = h.get("relatii")
        if rel and isinstance(rel, dict):
            for rtype in ["ally_of", "enemy_of", "vassal_of", "liege_of"]:
                entries = rel.get(rtype)
                if entries and isinstance(entries, list):
                    new_entries = []
                    entries_mod = False
                    for entry in entries:
                        if isinstance(entry, dict) and "id" in entry:
                            rid = entry["id"]
                            res = try_decompose_compound(rid)
                            if res is None:
                                new_entries.append(entry)
                            elif res[0] is True:
                                entries_mod = True
                                total_data_compounds_resolved += 1
                                for fixed_ref in res[1]:
                                    new_item = dict(entry)
                                    new_item["id"] = fixed_ref
                                    if not any(x.get("id") == fixed_ref for x in new_entries):
                                        new_entries.append(new_item)
                            else:
                                new_entries.append(entry)
                        else:
                            new_entries.append(entry)

                    if entries_mod:
                        rel[rtype] = new_entries
                        h_mod = True

        if h_mod:
            modified_houses_count += 1

    # Save final id_map.json and data files
    save_json(ID_MAP_PATH, id_map)
    save_json(ORPHANS_OUTPUT_PATH, final_orphans)

    if modified_chars_count > 0:
        save_json(CHARS_PATH, characters)
    if modified_events_count > 0:
        save_json(EVENTS_PATH, events)
    if modified_houses_count > 0:
        save_json(HOUSES_PATH, houses)

    print(f"Partea 2 completă:")
    print(f"  Chei compuse rezolvate în id_map.json: {compound_keys_resolved} (din care {len(compound_3plus_resolved)} de 3+ nume)")
    print(f"  Fișiere modificate: characters.json ({modified_chars_count}), events.json ({modified_events_count}), houses.json ({modified_houses_count})")
    print(f"  Fișier orfane final salvat la: {ORPHANS_OUTPUT_PATH} ({len(final_orphans)} orfane reale rămase)")

    # -------------------------------------------------------------------------
    # VERIFICĂRI CERUTE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  VERIFICĂRI CERUTE")
    print("=" * 70)

    print(f"1. Intrări din cele 209 re-rezolvate via alias: {resolved_part1}")
    print(f"   Intrări din cele 209 rezolvate ca ID-uri compuse: {compound_keys_resolved}")
    print(f"   Intrări din cele 209 rămase orfane (needecise):   {len(final_orphans)}")

    print(f"\n2. Cazuri noi de compunere descompuse (3+ nume): {len(compound_3plus_resolved)}")
    print("   Exemple concrete (înainte / după):")
    all_examples = compound_3plus_resolved + compound_2_resolved
    for i, (k_before, comps_after) in enumerate(all_examples[:3], 1):
        print(f"   Exemplu {i}:")
        print(f"     Înainte: {k_before}")
        print(f"     După:    {comps_after}")

    print("\n4. Verificare specifică: PERSON_LORDUL_TYWIN_LANNISTER în id_map.json:")
    tywin_entry = id_map.get("PERSON_LORDUL_TYWIN_LANNISTER")
    print(f"   Valoare citită din id_map.json: {tywin_entry}")
    if tywin_entry and tywin_entry.get("app_id") == "tywin_lannister":
        print("   ✓ CONFIRMAT: PERSON_LORDUL_TYWIN_LANNISTER indică spre tywin_lannister")
    else:
        print("   ✗ EROARE: PERSON_LORDUL_TYWIN_LANNISTER nu indică spre tywin_lannister")

    print("\n5. Verificare că characters.json NU a fost modificat de Partea 1:")
    print(f"   Hash înainte P1: {hash_chars_before[:12]}")
    print(f"   Hash după P1:   {hash_chars_after_p1[:12]}")
    print("   ✓ CONFIRMAT: Zero modificări în Partea 1 pe characters.json.")


if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
