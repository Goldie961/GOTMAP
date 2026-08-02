#!/usr/bin/env python3
"""Offline ETL for the curated GOT import statements.

The script never writes the application's live JSON files.  It writes reviewable
`*_new.json` candidates plus `id_map.json` below data/_import/etl_output.
By default it processes only noble houses.  A category run updates only that
category's review output and preserves prior category results in the report and
ID map.
"""

from __future__ import annotations

import argparse
import copy
import glob
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

# Import consolidation_functions from the same directory
sys.path.append(str(Path(__file__).resolve().parent))
import consolidation_functions

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "data" / "_import"
OUTPUT = IMPORT / "etl_output"
CONFIDENCE = {"confirmed": "canon", "probable": "inferred", "uncertain": "unknown"}
ENTITY_KIND = {
    "casa": ("houses", "houses.json"),
    "locatie": ("locations", "locations.json"),
    "persoana": ("characters", "characters.json"),
    "eveniment": ("events", "events.json"),
    "obiect": ("objects", "objects.json"),
    "titlu": ("titles", "titles.json"),
}
RELATIONS = {"ally_of", "enemy_of", "vassal_of", "liege_of", "branch_of"}
INVERSE_RELATION = {
    "ally_of": "ally_of", "enemy_of": "enemy_of", "branch_of": "branch_of",
    "vassal_of": "liege_of", "liege_of": "vassal_of",
}

# The import's Romanian book labels are the chronology authority.  These are
# deliberately book-level estimates: the source does not provide a reliable
# absolute date for every individual scene in the main series.
MAIN_SERIES_YEARS = {
    "urzeala tronurilor": 298,
    "inlestar ea regilor": 299,
    "inclestarea regilor": 299,
    "iuresul sabiilor": 300,
    "festinul ciorilor": 301,
    "dansul dragonilor": 302,
}
FIRE_AND_BLOOD = {"focul si sangele", "foc si sange"}
KNIGHT_OF_SEVEN_KINGDOMS = "cavalerul celor sapte regate"


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalized(value: str | None) -> str:
    """Comparison key resilient to Romanian diacritics and House/Casa prefixes."""
    value = value or ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold().replace("ă", "a").replace("â", "a").replace("î", "i").replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t")
    value = re.sub(r"^(house|casa|the)\s+", "", value)
    return re.sub(r"[^a-z0-9]+", "", value)


def normalized_book(value: str | None) -> str:
    """Normalize a book title without removing its word boundaries."""
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value.casefold()).strip()


def approximate_event_year(entity, grouped):
    """Return the audit-approved AC estimate, or ``None`` when unanchored.

    Fire & Blood is intentionally handled first and only receives a year when
    its own period assertion contains an explicit D.C./I.C. date.  This avoids
    inventing dates for its undated passages.
    """
    source_books = [entry.get("source_book") for entries in grouped.values() for entry in entries]
    source_books.append(entity.get("prima_aparitie", {}).get("carte"))
    books = [normalized_book(book) for book in source_books if book]

    if FIRE_AND_BLOOD & set(books):
        for entry in grouped.get("period_approx", []):
            period = entry.get("valoare") or ""
            # Both forms occur in the curated source: "54 D.C." and
            # "D.C. 54".  I.C. means before the Conquest, hence negative AC.
            match = re.search(r"(?i)(\d+)\s*(D\.?C\.?|Î\.?C\.?)|(D\.?C\.?|Î\.?C\.?)\s*(\d+)", period)
            if match:
                number = int(match.group(1) or match.group(4))
                era = match.group(2) or match.group(3)
                return -number if normalized_book(era).startswith("i") else number
        return None

    if KNIGHT_OF_SEVEN_KINGDOMS in books:
        return 209
    for book in books:
        if book in MAIN_SERIES_YEARS:
            return MAIN_SERIES_YEARS[book]
    return None


def app_id_for(entity_id: str) -> str:
    """Registry IDs use TYPE_NAME; application IDs are lower snake_case names."""
    return re.sub(r"^(HOUSE|LOCATION|PERSON|EVENT|OBJECT|TITLE)_", "", entity_id).lower()


def load_entities():
    # There is no monolithic entities.json in this import; the parts are its registry.
    entities = []
    for filename in sorted(glob.glob(str(IMPORT / "entities*.json"))):
        entities.extend(read_json(Path(filename)))
    unique = {}
    for entity in entities:
        if entity["id"] in unique:
            raise ValueError(f"Duplicate entity ID in registry: {entity['id']}")
        unique[entity["id"]] = entity
    return unique


def load_statements():
    statements = []
    for filename in sorted(glob.glob(str(IMPORT / "statements_*.json"))):
        for statement in read_json(Path(filename)):
            # Distance statements are a pair-based source, unlike the other
            # predicate triples.  Materialize both directions for the common
            # aggregation index while preserving its original evidence fields.
            if "subject" not in statement and {"location_a", "location_b"} <= set(statement):
                for subject, obj in ((statement["location_a"], statement["location_b"]),
                                     (statement["location_b"], statement["location_a"])):
                    statements.append({"subject": subject, "predicate": "distance_to", "object": obj,
                                       "source_book": statement.get("source_book"),
                                       "source_fragment": statement.get("source_fragment"),
                                       "source_page": statement.get("source_page"),
                                       "confidence": statement.get("confidence"),
                                       "distance_value": statement.get("distance_value"),
                                       "direction": statement.get("direction"),
                                       "approx": statement.get("approx")})
            else:
                statements.append(statement)
    return statements


def application_candidates(kind: str):
    collection, filename = ENTITY_KIND[kind]
    if not filename:
        return []
    path = ROOT / "data" / collection / filename
    return read_json(path) if path.exists() else []


def find_candidates(entity, existing):
    # The registry ID convention (HOUSE_STARK -> stark) is the strongest,
    # deterministic bridge.  Prefer it before broad aliases: existing aliases
    # sometimes contain related-house labels and are not all identity aliases.
    expected_id = app_id_for(entity["id"])
    id_matches = [item for item in existing if item.get("id") == expected_id]
    if id_matches:
        return id_matches
    names = {normalized(entity.get("nume_canonic"))}
    names.update(normalized(alias) for alias in entity.get("aliasuri", []))
    names.discard("")
    primary_matches = [item for item in existing if names & {normalized(item.get("name")), normalized(item.get("nume"))}]
    if primary_matches:
        return primary_matches
    matches = []
    for item in existing:
        app_names = {normalized(item.get("name")), normalized(item.get("nume"))}
        app_names.update(normalized(alias) for alias in item.get("aliasuri", []))
        if names & app_names:
            matches.append(item)
    return matches


def compact_statement(statement, direction, effective_predicate=None):
    result = {
        "directie": direction,
        "predicat_original": statement["predicate"],
        "predicate": effective_predicate or statement["predicate"],
        "valoare": statement["object"] if direction == "subject" else statement["subject"],
        "confidence": CONFIDENCE.get(statement.get("confidence"), "unknown"),
        "source_book": statement.get("source_book"),
        "source_fragment": statement.get("source_fragment"),
        "source_page": statement.get("source_page"),
    }
    for key in ("distance_value", "direction", "travel_method", "context", "approx", "role"):
        if key in statement:
            result[key] = statement[key]
    return result


def unique_by_json(items):
    output, seen = [], set()
    for item in items:
        key = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            output.append(item)
            seen.add(key)
    return output


def first_top_level_segment(value: str | None) -> str | None:
    """Return the first comma-separated segment without breaking parentheses.

    Source `type` values may use a top-level comma to append an independent
    detail (for example, ``castel mic, ziduri de piatră``).  `subtip` uses the
    first such segment.  Commas inside balanced parentheses remain part of the
    subtype, so explanatory text such as ``zonă de mare (calmă / fără vânt,
    apoi lovită de furtună)`` is preserved intact.
    """
    if not value:
        return None
    depth = 0
    for index, character in enumerate(value):
        if character == "(":
            depth += 1
        elif character == ")" and depth:
            depth -= 1
        elif character == "," and depth == 0:
            value = value[:index]
            break
    value = value.strip()
    return value or None


def sources(grouped):
    values = []
    for entries in grouped.values():
        for entry in entries:
            source = {key: entry.get(key) for key in ("source_book", "source_fragment", "source_page")}
            if source.get("source_book"):
                values.append(source)
    return unique_by_json(values)


def entity_skeleton(entity, collection):
    entity_id = app_id_for(entity["id"])
    name = entity.get("nume_canonic", entity_id)
    if collection == "houses":
        return {"id": entity_id, "name": name, "type": "house", "coordinates": None,
                "ownership_history": [], "metadata": {"timeline": []}}
    if collection == "locations":
        return {"id": entity_id, "name": name, "type": "location", "coordinates": None,
                "evenimente": [], "descriere_fizica": []}
    if collection == "objects":
        return {"id": entity_id, "nume": name, "categorie": None, "material": None, "owned_by": [], "sursa": None}
    if collection == "titles":
        return {"id": entity_id, "nume": name, "purtatori": []}
    if collection == "events":
        return {"id": entity_id, "name": name, "participanti": [], "locatie_id": None,
                "an_aproximativ": None, "nume_generat": bool(entity.get("nume_generat", False))}
    if collection == "characters":
        return {
            "id": entity_id,
            "name": name,
            "titles": [],
            "born": [],
            "died": None,
            "description": "",
            "timeline": [],
            "house": None,
            "canon": "canon",
            "locatie_asociata": None,
            "titlu_curent": None,
            "membru_al": None,
            "parinti": [],
            "copii": [],
            "frati": [],
            "casatorit_cu": [],
            "possible_parent_of": [],
            "age_at": [],
            "moarte": {
                "descriere": None,
                "confidence": None
            }
        }
    return {"id": entity_id, "name": name}


def apply_schema(record, entity, collection, grouped, entities, char_records=None, earliest_locs=None, valid_houses=None):
    """Populate the documented schema fields while retaining all source statements."""
    record["id_intern"] = entity["id"]
    record["aliasuri"] = entity.get("aliasuri", [])
    record["_afirmatii_pe_predicat"] = dict(sorted(grouped.items()))
    record["surse"] = sources(grouped)

    if collection == "houses":
        metadata = record.setdefault("metadata", {})
        relations = {key: [] for key in ("ally_of", "enemy_of", "vassal_of", "liege_of")}
        for predicate in RELATIONS:
            if predicate in grouped:
                values = [item["valoare"] for item in grouped[predicate] if item["valoare"].startswith(("HOUSE_", "PERSON_"))]
                if predicate in relations:
                    relations[predicate] = list(dict.fromkeys(values))
        record["relatii"] = relations
        record["relatii_detaliate"] = {key: grouped[key] for key in RELATIONS if key in grouped}
        for predicate in ("seat", "region", "words", "sigil", "founded"):
            if predicate in grouped:
                metadata[predicate] = grouped[predicate]
        timeline = []
        for statement in grouped.get("status_at", []):
            timeline.append({"year": None, "event": statement["valoare"], "canon": statement["confidence"],
                             "source_fragment": statement["source_fragment"], "source_page": statement["source_page"],
                             "source_book": statement["source_book"]})
        if timeline:
            metadata["timeline"] = timeline
    elif collection == "locations":
        # The entity registry can contain a presentation-oriented, truncated
        # subtype.  Prefer the complete source assertion from predicate `type`.
        # If no assertion exists, retain the registry value as a fallback.
        type_values = [entry["valoare"] for entry in grouped.get("type", [])]
        record["subtip"] = first_top_level_segment(type_values[0]) if type_values else entity.get("subtip")
        record["evenimente"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("event_here", [])))
        record["descriere_fizica"] = [item["valoare"] for item in grouped.get("physical_description", [])]
    elif collection == "events":
        record["an_aproximativ"] = approximate_event_year(entity, grouped)
        record["nume_generat"] = bool(entity.get("nume_generat", False))
        # These IDs deliberately remain registry IDs: the audit specifies that
        # events point to a location's `id_intern`, not to a display label.
        record["participanti"] = [
            {"id": item["valoare"], "rol": item.get("role")}
            for item in grouped.get("participant", [])
            if item["valoare"] in entities
        ]
        locations = grouped.get("event_here", []) + grouped.get("location", [])
        valid_locations = [item["valoare"] for item in locations
                           if entities.get(item["valoare"], {}).get("tip") == "locatie"]
        record["locatie_id"] = valid_locations[0] if valid_locations else None
    elif collection == "characters":
        # Relational family predicates (consolidated)
        record["parinti"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("child_of", [])))
        record["copii"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("parent_of", [])))
        record["frati"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("sibling_of", [])))
        record["casatorit_cu"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("married_to", [])))
        
        # Simple aggregation for others
        record["possible_parent_of"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("possible_parent_of", [])))
        record["age_at"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("age_at", [])))
        
        born_vals = list(dict.fromkeys(item["valoare"] for item in grouped.get("born", [])))
        if born_vals:
            record["born"] = born_vals
            
        record["member_of"] = list(dict.fromkeys(item["valoare"] for item in grouped.get("member_of", [])))
        
        # Retrieve pre-consolidated titles and death details
        rec_id = entity["id"]
        pre_rec = char_records.get(rec_id, {}) if char_records else {}
        record["titlu_curent"] = pre_rec.get("titlu_curent")
        record["titles"] = pre_rec.get("titles", [])
        
        moarte_rec = pre_rec.get("moarte", {}) if pre_rec else {}
        record["moarte"] = {
            "descriere": moarte_rec.get("descriere"),
            "confidence": moarte_rec.get("confidence"),
            "variante": moarte_rec.get("variante")
        }
        
        # Associated location
        p_app_id = record["id"]
        p_reg_id = entity["id"]
        loc = None
        if earliest_locs:
            loc = earliest_locs.get(p_app_id.lower()) or earliest_locs.get(p_reg_id.lower())
        record["locatie_asociata"] = loc
        
        # House membership
        membru_al_val = None
        member_of_stmts = grouped.get("member_of", [])
        if member_of_stmts:
            first_val = member_of_stmts[0]["valoare"]
            if valid_houses and first_val in valid_houses:
                membru_al_val = first_val
            else:
                membru_al_val = "needecis"
        record["membru_al"] = membru_al_val
    elif collection == "objects":
        cats = [s["valoare"] for s in grouped.get("category", [])]
        record["categorie"] = cats[0] if cats else None
        mats = [s["valoare"] for s in grouped.get("material", [])]
        record["material"] = mats[0] if mats else None
        record["owned_by"] = [
            {"proprietar": s["valoare"], "an_aproximativ": approximate_event_year(entity, grouped),
             "sursa": s.get("source_book"), "confidence": CONFIDENCE.get(s.get("confidence"), "unknown")}
            for s in grouped.get("owned_by", [])
        ]
        if "given_by" in grouped:
            record["given_by"] = [
                {"donator": s["valoare"], "an_aproximativ": approximate_event_year(entity, grouped),
                 "sursa": s.get("source_book"), "confidence": CONFIDENCE.get(s.get("confidence"), "unknown")}
                for s in grouped.get("given_by", [])
            ]
        if "made_by" in grouped:
            record["made_by"] = [
                {"creator": s["valoare"], "sursa": s.get("source_book"),
                 "confidence": CONFIDENCE.get(s.get("confidence"), "unknown")}
                for s in grouped.get("made_by", [])
            ]
        descs = [s["valoare"] for s in grouped.get("description", [])]
        if descs:
            record["descrieri"] = descs
        surse = record.get("surse", [])
        record["sursa"] = surse[0]["source_book"] if surse else None
    elif collection == "titles":
        record["purtatori"] = [
            {"persoana_id": s["valoare"], "an_start": approximate_event_year(entity, grouped),
             "an_sfarsit": None, "sursa": s.get("source_book")}
            for s in grouped.get("owned_by", [])
        ]
        cats = [s["valoare"] for s in grouped.get("category", [])]
        if cats:
            record["categorie"] = cats[0]
        descs = [s["valoare"] for s in grouped.get("description", [])]
        if descs:
            record["descrieri"] = descs
    return record


def completeness(record, grouped):
    if "categorie" in record and "owned_by" in record and "purtatori" not in record:
        details = {
            "nume": bool(record.get("nume")),
            "categorie": bool(record.get("categorie")),
            "material": bool(record.get("material")),
            "owned_by": bool(record.get("owned_by")),
            "surse": bool(record.get("surse")),
        }
        details["scor_total"] = round(sum(details.values()) / len(details), 2)
        return details
    if "purtatori" in record:
        details = {
            "nume": bool(record.get("nume")),
            "purtatori": bool(record.get("purtatori")),
            "surse": bool(record.get("surse")),
        }
        details["scor_total"] = round(sum(details.values()) / len(details), 2)
        return details
    if "parinti" in record and "titles" in record:
        details = {
            "titles": bool(record.get("titles")),
            "membru_al": bool(record.get("membru_al")),
            "parinti": bool(record.get("parinti")),
            "copii": bool(record.get("copii")),
            "frati": bool(record.get("frati")),
            "casatorit_cu": bool(record.get("casatorit_cu")),
            "moarte": bool(record.get("moarte", {}).get("descriere")),
            "surse": bool(record.get("surse")),
        }
        details["scor_total"] = round(sum(details.values()) / len(details), 2)
        return details
    if "participanti" in record and "an_aproximativ" in record:
        details = {
            "participanti": bool(record["participanti"]),
            "locatie": bool(record.get("locatie_id")),
            "an_aproximativ": record.get("an_aproximativ") is not None,
            "descriere": bool(grouped.get("what_happened") or grouped.get("consequence")),
            "tip_eveniment": bool(grouped.get("event_type")),
            "surse": bool(record.get("surse")),
        }
        details["scor_total"] = round(sum(details.values()) / len(details), 2)
        return details
    coordinates = bool(record.get("coordinates"))
    description = bool(record.get("description") or record.get("descriere") or record.get("descriere_fizica"))
    image = bool(record.get("image") or record.get("crest"))
    owner_history = bool(record.get("ownership_history") or record.get("metadata", {}).get("timeline"))
    events = grouped.get("event_here", []) + grouped.get("participant", [])
    distances = grouped.get("distance_to", []) + grouped.get("distance", [])
    details = {
        "coordonate": coordinates,
        "descriere": description,
        "imagine": image,
        "istoric_proprietari": owner_history,
        "evenimente": f"{len(events)}/{len(events)}",
        "distante": f"{len(distances)}/{len(distances)}",
        "surse": bool(record.get("surse")),
    }
    populated = sum((coordinates, description, image, owner_history, bool(events), bool(distances), bool(record.get("surse"))))
    details["scor_total"] = round(populated / 7, 2)
    return details


def main():
    parser = argparse.ArgumentParser(description="Build review-only JSON candidates from import statements.")
    parser.add_argument("--category", choices=["houses", "locations", "events", "characters", "objects", "titles", "all"], default="houses",
                        help="Generate a single review category, or all categories.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Process at most this many entities in the requested category (for review samples).")
    parser.add_argument("--output-only", action="store_true",
                        help="Write only the requested category candidate, leaving report and ID-map files unchanged.")
    args = parser.parse_args()
    entities, statements = load_entities(), load_statements()
    by_subject, by_object = defaultdict(list), defaultdict(list)
    for statement in statements:
        by_subject[statement["subject"]].append(statement)
        by_object[statement["object"]].append(statement)

    category_kinds = {
        "houses": {"casa"},
        "locations": {"locatie"},
        "events": {"eveniment"},
        "characters": {"persoana"},
        "objects": {"obiect"},
        "titles": {"titlu"},
        "all": set(ENTITY_KIND),
    }
    allowed = category_kinds[args.category]

    # A later category pass must not erase the already-reviewed houses report
    # or its source-to-application ID bridge.
    report_path = OUTPUT / "aggregation_report.json"
    id_map_path = OUTPUT / "id_map.json"
    report = read_json(report_path) if report_path.exists() else {"categories": {}, "ambiguous_mappings": []}
    id_map = read_json(id_map_path) if id_map_path.exists() else {}
    report.setdefault("categories", {})
    report.setdefault("ambiguous_mappings", [])
    outputs = defaultdict(list)
    processed_collections = {ENTITY_KIND[kind][0] for kind in allowed if kind in ENTITY_KIND}
    # Replace ambiguity records only for the collection currently being rebuilt.
    processed_prefixes = {"houses": "HOUSE_", "locations": "LOCATION_", "characters": "PERSON_",
                          "events": "EVENT_", "objects": "OBJECT_", "titles": "TITLE_"}
    processed_id_prefixes = tuple(processed_prefixes[collection] for collection in processed_collections)
    report["ambiguous_mappings"] = [entry for entry in report["ambiguous_mappings"]
                                    if not entry.get("id_intern", "").startswith(processed_id_prefixes)]
    id_map = {entity_id: entry for entity_id, entry in id_map.items()
              if not entity_id.startswith(processed_id_prefixes)}
    existing_cache = {kind: application_candidates(kind) for kind in ENTITY_KIND}

    # Load events data for earliest location resolving
    events_path = ROOT / "data" / "events" / "events.json"
    events_data = []
    if events_path.exists():
        events_data = read_json(events_path)

    # Resolve earliest locations map for all characters
    person_to_earliest_loc = {}
    if events_data:
        def get_event_year(ev):
            yr = ev.get("an_aproximativ")
            if yr is not None:
                try: return int(yr)
                except (ValueError, TypeError): pass
            yr = ev.get("year")
            if yr is not None:
                try: return int(yr)
                except (ValueError, TypeError): pass
            return None

        def get_event_location_app_id(ev):
            loc_id = ev.get("locatie_id")
            if loc_id:
                return app_id_for(loc_id)
            loc = ev.get("location")
            if loc:
                if loc.startswith("LOCATION_"):
                    return app_id_for(loc)
                return loc
            return None

        for event in events_data:
            loc = get_event_location_app_id(event)
            if not loc:
                continue
            yr = get_event_year(event)
            if yr is None:
                continue
            seq = event.get("sequence")
            seq_val = int(seq) if seq is not None else 9999
            
            participants = event.get("participants") or []
            participanti = event.get("participanti") or []
            event_participants = set()
            for p in participants:
                event_participants.add(p)
            for p_dict in participanti:
                p_id = p_dict.get("id")
                if p_id:
                    event_participants.add(p_id)
            
            for p in event_participants:
                p_norm = p.lower()
                if p_norm not in person_to_earliest_loc:
                    person_to_earliest_loc[p_norm] = []
                person_to_earliest_loc[p_norm].append((yr, seq_val, loc, event.get("id", "")))
                
        for p in person_to_earliest_loc:
            person_to_earliest_loc[p].sort(key=lambda x: (x[0], x[1], x[3]))
            person_to_earliest_loc[p] = person_to_earliest_loc[p][0][2]

    # Load houses data to validate membership
    houses_path = ROOT / "data" / "houses" / "houses.json"
    valid_houses = set()
    if houses_path.exists():
        houses_data = read_json(houses_path)
        for h in houses_data:
            id_int = h.get("id_intern")
            if id_int:
                valid_houses.add(id_int)

    # Perform global consolidation and inverse grouping for characters
    char_records = {}
    char_grouped = {}
    
    INVERSE_RELATION_ALL = {
        "ally_of": "ally_of", "enemy_of": "enemy_of", "branch_of": "branch_of",
        "vassal_of": "liege_of", "liege_of": "vassal_of",
        "parent_of": "child_of",
        "child_of": "parent_of",
        "sibling_of": "sibling_of",
        "married_to": "married_to",
    }
    
    if "persoana" in allowed:
        for entity in entities.values():
            if entity.get("tip") == "persoana":
                entity_id = entity["id"]
                grouped = defaultdict(list)
                for statement in by_subject[entity_id]:
                    grouped[statement["predicate"]].append(consolidation_functions._compact_statement(statement, "subject"))
                for statement in by_object[entity_id]:
                    predicate = INVERSE_RELATION_ALL.get(statement["predicate"], statement["predicate"])
                    grouped[predicate].append(consolidation_functions._compact_statement(statement, "object", predicate))
                
                for predicate in grouped:
                    grouped[predicate] = unique_by_json(grouped[predicate])
                    
                char_grouped[entity_id] = grouped
                
                flat_statements = []
                for pred_stmts in grouped.values():
                    flat_statements.extend(pred_stmts)
                    
                title_result = consolidation_functions.consolidate_title_at(flat_statements)
                died_result = consolidation_functions.consolidate_died(flat_statements)
                
                char_records[entity_id] = {
                    "name": entity.get("nume_canonic", entity_id),
                    "titlu_curent": title_result["titlu_curent"],
                    "titles": title_result["titles"],
                    "moarte": died_result,
                }
                
        # Run family consolidation
        consolidation_functions.consolidate_family_relations(char_records, char_grouped)
        
        # Export family relations contradictions
        contradictions_out = []
        seen_pairs = set()
        for entity_id, grouped in char_grouped.items():
            if "contradictii_relatii_familie" in grouped:
                for c in grouped["contradictii_relatii_familie"]:
                    target_id = c["valoare"]
                    pair = tuple(sorted([entity_id, target_id]))
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        subiect_name = entities.get(entity_id, {}).get("nume_canonic", entity_id)
                        obiect_name = entities.get(target_id, {}).get("nume_canonic", target_id)
                        contradictions_out.append({
                            "subiect": entity_id,
                            "subiect_nume": subiect_name,
                            "obiect": target_id,
                            "obiect_nume": obiect_name,
                            "surse": {
                                "parent_of_sources": c["parent_of_sources"],
                                "child_of_sources": c["child_of_sources"]
                            }
                        })
        # Write contradictions
        write_json(OUTPUT / "contradictii_familie_needs_review.json", {"contradictii_familie": contradictions_out})

    # Limit setup with Daenerys and Alicent forced inclusion for testing
    entity_list = list(entities.values())
    if args.category == "characters" and args.limit is not None:
        target_ids = {"PERSON_DAENERYS_TARGARYEN", "PERSON_ALICENT_HIGHTOWER"}
        specials = [e for e in entity_list if e.get("id") in target_ids]
        others = [e for e in entity_list if e.get("id") not in target_ids and e.get("tip") == "persoana"]
        slice_len = max(0, args.limit - len(specials))
        selected_entities = specials + others[:slice_len]
    else:
        selected_entities = entity_list

    processed_count = 0
    for entity in selected_entities:
        kind = entity.get("tip")
        if kind not in allowed or kind not in ENTITY_KIND:
            continue
        if entity.get("id") in {"EVENT_", ""}:
            report.setdefault("skipped_invalid_entities", []).append(entity.get("id"))
            continue
        if args.limit is not None and args.category != "characters" and processed_count >= args.limit:
            break
            
        collection, _ = ENTITY_KIND[kind]
        candidates = find_candidates(entity, existing_cache[kind])
        ambiguity = len(candidates) > 1
        matched = candidates[0] if len(candidates) == 1 else None
        record = copy.deepcopy(matched) if matched else entity_skeleton(entity, collection)
        
        if kind == "persoana":
            grouped = char_grouped[entity["id"]]
            record = apply_schema(record, entity, collection, grouped, entities,
                                  char_records=char_records, earliest_locs=person_to_earliest_loc,
                                  valid_houses=valid_houses)
        else:
            grouped = defaultdict(list)
            for statement in by_subject[entity["id"]]:
                grouped[statement["predicate"]].append(compact_statement(statement, "subject"))
            for statement in by_object[entity["id"]]:
                predicate = INVERSE_RELATION.get(statement["predicate"], statement["predicate"])
                grouped[predicate].append(compact_statement(statement, "object", predicate))
            for predicate in grouped:
                grouped[predicate] = unique_by_json(grouped[predicate])
            record = apply_schema(record, entity, collection, grouped, entities)
            
        record["_completitudine"] = completeness(record, grouped)
        record["_etl"] = {"import_status": "enrichment" if matched else "new",
                           "matched_app_id": matched.get("id") if matched else None,
                           "match_method": "unique normalized name/alias" if matched else ("ambiguous normalized name/alias" if ambiguity else "no match"),
                           "candidate_app_ids": [candidate.get("id") for candidate in candidates]}
        outputs[collection].append(record)
        id_map[entity["id"]] = {"app_id": record["id"], "collection": collection,
                                 "status": record["_etl"]["import_status"],
                                 "candidates": record["_etl"]["candidate_app_ids"]}
        if ambiguity:
            report["ambiguous_mappings"].append({"id_intern": entity["id"], "candidates": record["_etl"]["candidate_app_ids"]})
        processed_count += 1

    for collection, records in outputs.items():
        records.sort(key=lambda item: item["id"])
        write_json(OUTPUT / f"{collection}_new.json", records)
        scores = [item["_completitudine"]["scor_total"] for item in records]
        report["categories"][collection] = {"processed": len(records),
            "enrichment": sum(item["_etl"]["import_status"] == "enrichment" for item in records),
            "new": sum(item["_etl"]["import_status"] == "new" for item in records),
            "average_completitudine": round(sum(scores) / len(scores), 2) if scores else 0,
            "min_completitudine": min(scores) if scores else 0,
            "max_completitudine": max(scores) if scores else 0,
            "score_distribution": {"gte_0_7": sum(score >= .7 for score in scores), "0_4_to_0_69": sum(.4 <= score < .7 for score in scores), "lt_0_4": sum(score < .4 for score in scores)}}
    if not args.output_only:
        write_json(OUTPUT / "id_map.json", dict(sorted(id_map.items())))
        write_json(OUTPUT / "aggregation_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
