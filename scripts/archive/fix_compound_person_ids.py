#!/usr/bin/env python3
"""
fix_compound_person_ids.py
==========================
Script pentru detectarea și repararea ID-urilor compuse (ex. PERSON_BRAN_STARK_SI_RICKON_STARK,
PERSON_BRAN_STARK_RICKON_STARK, PERSON_BAELA_SI_RHAENA_TARGARYEN) din characters.json
și alte fișiere relevante.

Reguli:
1. Înlocuiește valorile compuse cu ID-urile separate (PERSON_BRAN_STARK, PERSON_RICKON_STARK)
   dacă AMBELE persoane există ca entități separate în characters.json.
2. Dacă cel puțin o persoană din valoarea compusă NU există ca entitate separată,
   salvează cazul în data/_import/etl_output/id_uri_compuse_needecise.json pentru revizuire manuală.
3. Actualizează array-urile în mod curat (deduplicare păstrând ordinea).
"""

import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

CHARS_PATH = os.path.join(DATA_DIR, "characters", "characters.json")
EVENTS_PATH = os.path.join(DATA_DIR, "events", "events.json")
HOUSES_PATH = os.path.join(DATA_DIR, "houses", "houses.json")
OBJECTS_PATH = os.path.join(DATA_DIR, "objects", "objects.json")
TITLES_PATH = os.path.join(DATA_DIR, "titles", "titles.json")

ID_MAP_PATH = os.path.join(DATA_DIR, "_import", "etl_output", "id_map.json")
UNDECIDED_OUTPUT_PATH = os.path.join(DATA_DIR, "_import", "etl_output", "id_uri_compuse_needecise.json")


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    characters = load_json(CHARS_PATH)
    events = load_json(EVENTS_PATH)
    id_map = load_json(ID_MAP_PATH) if os.path.exists(ID_MAP_PATH) else {}

    # Set of existing character app_ids
    char_ids = {c["id"].lower() for c in characters if "id" in c}

    # Map PERSON_... format to valid char_id
    person_to_char = {}
    for cid in char_ids:
        person_to_char[f"PERSON_{cid.upper()}"] = cid

    for k, v in id_map.items():
        if isinstance(v, dict) and v.get("app_id"):
            app_id = v["app_id"].lower()
            if app_id in char_ids:
                person_to_char[k.upper()] = app_id

    def resolve_single_person(ref):
        if not isinstance(ref, str) or not ref.strip():
            return None
        u_ref = ref.strip().upper()
        if u_ref in person_to_char:
            return person_to_char[u_ref]
        if not u_ref.startswith("PERSON_"):
            u_ref = f"PERSON_{u_ref}"
            if u_ref in person_to_char:
                return person_to_char[u_ref]
        raw = u_ref[7:].lower()
        if raw in char_ids:
            return raw
        return None

    def try_decompose_compound(val):
        """
        Inspecționează val și returnează:
        - (True, [list_of_PERSON_IDs]) dacă este compus și TOATE entitățile au fost găsite.
        - (False, val) dacă este compus dar NU toate entitățile există.
        - None dacă NU este o valoare compusă.
        """
        if not isinstance(val, str) or not val.strip():
            return None

        val_clean = val.strip()

        # Dacă se rezolvă deja direct la o singură persoană existentă, nu e compus defect
        if resolve_single_person(val_clean):
            return None

        # Verificăm dacă seamănă cu un ref de persoană
        val_upper = val_clean.upper()
        if not val_upper.startswith("PERSON_"):
            return None

        raw = val_upper[7:]

        # Tipar 1: Separatori expliciți (_SI_, _ȘI_, _AND_)
        parts = re.split(r"_SI_|_ȘI_|_AND_", raw)
        if len(parts) >= 2:
            resolved_ids = []
            all_found = True
            
            # Verificăm dacă prima parte are sau nu nume de familie
            p1, p2 = parts[0].strip("_"), parts[1].strip("_")
            c1 = resolve_single_person(f"PERSON_{p1}")
            c2 = resolve_single_person(f"PERSON_{p2}")

            # Dacă p1 nu s-a găsit, dar p2 are nume de familie (ex. BAELA și RHAENA_TARGARYEN)
            if not c1 and "_" in p2:
                surname = p2.split("_")[-1]
                p1_with_surf = f"PERSON_{p1}_{surname}"
                c1 = resolve_single_person(p1_with_surf)

            if c1 and c2:
                return (True, [f"PERSON_{c1.upper()}", f"PERSON_{c2.upper()}"])
            else:
                return (False, val_clean)

        # Tipar 2: Nume alăturate fără separator (ex. BRAN_STARK_RICKON_STARK)
        for i in range(3, len(raw) - 3):
            if raw[i] == "_":
                p1 = raw[:i].strip("_")
                p2 = raw[i+1:].strip("_")
                c1 = resolve_single_person(f"PERSON_{p1}")
                c2 = resolve_single_person(f"PERSON_{p2}")
                if c1 and c2:
                    return (True, [f"PERSON_{c1.upper()}", f"PERSON_{c2.upper()}"])

        return None

    # Tablou de contorizare și colectare
    total_compounds_found = 0
    auto_fixed_count = 0
    undecided_cases = []

    # 1. Procesare characters.json
    rel_fields = ["parinti", "copii", "frati", "casatorit_cu", "membru_al", "member_of"]
    modified_chars_count = 0

    for char in characters:
        char_id = char.get("id", "<unknown>")
        char_modified = False

        for field in rel_fields:
            vals = char.get(field)
            if not vals or not isinstance(vals, list):
                continue

            new_vals = []
            field_changed = False

            for v in vals:
                res = try_decompose_compound(v)
                if res is None:
                    # Not compound
                    new_vals.append(v)
                elif res[0] is True:
                    # Auto-fixed!
                    total_compounds_found += 1
                    auto_fixed_count += 1
                    field_changed = True
                    for fixed_ref in res[1]:
                        if fixed_ref not in new_vals:
                            new_vals.append(fixed_ref)
                elif res[0] is False:
                    # Undecided
                    total_compounds_found += 1
                    undecided_cases.append({
                        "file": "characters.json",
                        "entity_id": char_id,
                        "field": field,
                        "compound_value": v,
                        "reason": "Nu toate persoanele componente au fost găsite ca entități separate în characters.json"
                    })
                    new_vals.append(v)

            if field_changed:
                # Deduplicăm păstrând ordinea
                seen = set()
                deduped = []
                for nv in new_vals:
                    if nv not in seen:
                        seen.add(nv)
                        deduped.append(nv)
                char[field] = deduped
                char_modified = True

        if char_modified:
            modified_chars_count += 1

    # 2. Procesare events.json
    modified_events_count = 0
    for ev in events:
        eid = ev.get("id", "<unknown>")
        ev_modified = False

        # Check participants (list of strings)
        parts = ev.get("participants")
        if parts and isinstance(parts, list):
            new_parts = []
            parts_changed = False
            for p in parts:
                res = try_decompose_compound(p)
                if res is None:
                    new_parts.append(p)
                elif res[0] is True:
                    total_compounds_found += 1
                    auto_fixed_count += 1
                    parts_changed = True
                    for fixed_ref in res[1]:
                        if fixed_ref not in new_parts:
                            new_parts.append(fixed_ref)
                elif res[0] is False:
                    total_compounds_found += 1
                    undecided_cases.append({
                        "file": "events.json",
                        "entity_id": eid,
                        "field": "participants",
                        "compound_value": p,
                        "reason": "Nu toate persoanele componente au fost găsite ca entități separate în characters.json"
                    })
                    new_parts.append(p)

            if parts_changed:
                seen = set()
                deduped = []
                for np in new_parts:
                    if np not in seen:
                        seen.add(np)
                        deduped.append(np)
                ev["participants"] = deduped
                ev_modified = True

        # Check participanti (list of dicts with .id)
        p_objs = ev.get("participanti")
        if p_objs and isinstance(p_objs, list):
            new_pobjs = []
            pobjs_changed = False
            for pobj in p_objs:
                if isinstance(pobj, dict) and "id" in pobj:
                    pid = pobj["id"]
                    res = try_decompose_compound(pid)
                    if res is None:
                        new_pobjs.append(pobj)
                    elif res[0] is True:
                        total_compounds_found += 1
                        auto_fixed_count += 1
                        pobjs_changed = True
                        for fixed_ref in res[1]:
                            new_item = dict(pobj)
                            new_item["id"] = fixed_ref
                            if not any(x.get("id") == fixed_ref for x in new_pobjs):
                                new_pobjs.append(new_item)
                    elif res[0] is False:
                        total_compounds_found += 1
                        undecided_cases.append({
                            "file": "events.json",
                            "entity_id": eid,
                            "field": "participanti",
                            "compound_value": pid,
                            "reason": "Nu toate persoanele componente au fost găsite ca entități separate în characters.json"
                        })
                        new_pobjs.append(pobj)
                else:
                    new_pobjs.append(pobj)

            if pobjs_changed:
                ev["participanti"] = new_pobjs
                ev_modified = True

        if ev_modified:
            modified_events_count += 1

    # Save updated files
    save_json(CHARS_PATH, characters)
    if modified_events_count > 0:
        save_json(EVENTS_PATH, events)
    save_json(UNDECIDED_OUTPUT_PATH, undecided_cases)

    print("=== REZULTATE SCRIPT FIX_COMPOUND_PERSON_IDS.PY ===")
    print(f"Total cazuri compuse găsite: {total_compounds_found}")
    print(f"Total cazuri reparate automat: {auto_fixed_count}")
    print(f"Total cazuri needecise puse deoparte: {len(undecided_cases)}")
    print(f"Număr de personaje modificate în characters.json: {modified_chars_count}")
    print(f"Număr de evenimente modificate în events.json: {modified_events_count}")
    print(f"Fișierul needecise salvat la: {UNDECIDED_OUTPUT_PATH}")


if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()

