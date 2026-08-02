#!/usr/bin/env python3
"""Targeted reconciliation for aliases and relations only.

No entity is regenerated: all fields except ``aliasuri`` and ``relatii`` are
left byte-for-byte equivalent after JSON serialization.  Unproven claims are
retained in a review file rather than asserted in the public relation fields.
"""

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
HOUSE_RELATIONS = ("ally_of", "enemy_of", "vassal_of", "liege_of")


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalized(value: str | None):
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch)).casefold()
    value = re.sub(r"^[\s\-–—]*(house|casa|the)\s+", "", value)
    return re.sub(r"[^a-z0-9]+", "", value)


def relation_item(target_id, evidence, predicate=None):
    """Keep every evidence row, including repeated IDs from different passages."""
    return {
        "id": target_id,
        "source_book": evidence.get("source_book"),
        "source_fragment": evidence.get("source_fragment"),
        "source_page": evidence.get("source_page"),
        "confidence": evidence.get("confidence", "unknown"),
        "direction": evidence.get("directie"),
        "predicate": predicate or evidence.get("predicat_original") or evidence.get("predicate"),
    }


def other_entity_targets(alias, self_id, canonical_index):
    """Resolve clear canonical names and truncated relation fragments only."""
    key = normalized(alias)
    exact = [entity_id for entity_id in canonical_index.get(key, []) if entity_id != self_id]
    if exact:
        return exact
    # E.g. "Mallister (case-stegar Stark" is a broken relation fragment, not an alias.
    if "(" in alias or "," in alias:
        matches = []
        for canonical, entity_ids in canonical_index.items():
            if len(canonical) >= 4 and key.startswith(canonical):
                matches.extend(entity_id for entity_id in entity_ids if entity_id != self_id)
        return matches
    return []


def known_relation_targets(record):
    targets = set()
    for entries in (record.get("relatii_detaliate") or {}).values():
        targets.update(entry.get("valoare") for entry in entries if entry.get("valoare"))
    for entries in (record.get("_afirmatii_pe_predicat") or {}).values():
        targets.update(entry.get("valoare") for entry in entries if entry.get("valoare"))
    return targets


def review_entry(collection, record, relation, target_id, evidence, reason, alias=None):
    return {
        "collection": collection,
        "id": record.get("id"),
        "id_intern": record.get("id_intern"),
        "nume": record.get("name"),
        "relatie": relation,
        "target_id": target_id,
        "alias_redirectionat": alias,
        "evidence": copy.deepcopy(evidence),
        "motiv": reason,
    }


def clean_aliases(record, entities, canonical_index, collection, review, source_aliases=None):
    entity = entities.get(record.get("id_intern"), {})
    canonical = normalized(entity.get("nume_canonic") or record.get("name"))
    clean = []
    for alias in (source_aliases if source_aliases is not None else record.get("aliasuri") or []):
        targets = other_entity_targets(alias, record.get("id_intern"), canonical_index)
        malformed = alias.count("(") != alias.count(")")
        if targets or malformed:
            for target in targets or [None]:
                review.append(review_entry(
                    collection, record, "alias_redirection", target, {},
                    "Aliasul identifică o altă entitate sau este un fragment relațional; nu este păstrat ca alias.", alias,
                ))
            continue
        # Keep self names and non-entity variants already present in Pas 0.
        if normalized(alias) == canonical or alias not in clean:
            clean.append(alias)
    record["aliasuri"] = clean


def reconcile_houses(houses, entities, canonical_index, review, alias_sources):
    for house in houses:
        clean_aliases(house, entities, canonical_index, "houses", review, alias_sources.get(house.get("id")))
        details = house.get("relatii_detaliate") or {}
        old_flat = house.get("relatii") or {}
        relations = {name: [] for name in HOUSE_RELATIONS}

        for relation in ("ally_of", "enemy_of"):
            for evidence in details.get(relation, []):
                target = evidence.get("valoare")
                if target:
                    relations[relation].append(relation_item(target, evidence, relation))
            # Older entries without source evidence are retained for review, not asserted.
            detailed_targets = {entry.get("valoare") for entry in details.get(relation, [])}
            for raw_target in old_flat.get(relation, []):
                target = raw_target.get("id") if isinstance(raw_target, dict) else raw_target
                if target not in detailed_targets:
                    review.append(review_entry(
                        "houses", house, relation, target, {},
                        "Relație plată moștenită fără statement sursat; necesită verificare manuală.",
                    ))

        for relation in ("vassal_of", "liege_of"):
            # The import carries a page citation but no quoted/contextual proof of
            # subordination.  Conservatively move every such assertion to review.
            evidence_rows = details.get(relation, [])
            detailed_targets = {entry.get("valoare") for entry in evidence_rows}
            for evidence in evidence_rows:
                review.append(review_entry(
                    "houses", house, relation, evidence.get("valoare"), evidence,
                    "Afirmație de vasalitate fără citat/context explicit de subordonare; neafirmată automat.",
                ))
            for raw_target in old_flat.get(relation, []):
                target = raw_target.get("id") if isinstance(raw_target, dict) else raw_target
                if target not in detailed_targets:
                    review.append(review_entry(
                        "houses", house, relation, target, {},
                        "Relație plată de vasalitate fără sursă explicită; necesită verificare manuală.",
                    ))
        house["relatii"] = relations


def reconcile_locations(locations, entities, canonical_index, review, alias_sources):
    name_to_ids = canonical_index
    for location in locations:
        clean_aliases(location, entities, canonical_index, "locations", review, alias_sources.get(location.get("id")))
        relations = {"part_of": [], "near": []}
        grouped = location.get("_afirmatii_pe_predicat") or {}
        for predicate, relation in (("near", "near"), ("region", "part_of"), ("location", "part_of")):
            for evidence in grouped.get(predicate, []):
                value = evidence.get("valoare")
                targets = []
                if isinstance(value, str) and value.startswith("LOCATION_"):
                    targets = [value]
                elif isinstance(value, str):
                    targets = name_to_ids.get(normalized(value), [])
                for target in targets:
                    if target != location.get("id_intern"):
                        relations[relation].append(relation_item(target, evidence, predicate))
        location["relatii"] = relations


def main():
    houses_path = ROOT / "data" / "houses" / "houses.json"
    locations_path = OUTPUT / "locations_new.json"
    houses, locations = read_json(houses_path), read_json(locations_path)
    backup_dir = OUTPUT / "backups"
    house_alias_source_path = backup_dir / "houses.pre_alias_relatii_reconciliere.json"
    location_alias_source_path = backup_dir / "locations_new.pre_alias_relatii_reconciliere.json"
    house_alias_sources = {item["id"]: item.get("aliasuri", []) for item in read_json(house_alias_source_path)} if house_alias_source_path.exists() else {}
    location_alias_sources = {item["id"]: item.get("aliasuri", []) for item in read_json(location_alias_source_path)} if location_alias_source_path.exists() else {}
    entities = {}
    for path in sorted(IMPORT.glob("entities_part*.json")):
        entities.update({entity["id"]: entity for entity in read_json(path)})
    canonical_index = defaultdict(list)
    for entity in entities.values():
        key = normalized(entity.get("nume_canonic"))
        if key:
            canonical_index[key].append(entity["id"])

    review = []
    reconcile_houses(houses, entities, canonical_index, review, house_alias_sources)
    reconcile_locations(locations, entities, canonical_index, review, location_alias_sources)
    write_json(houses_path, houses)
    write_json(locations_path, locations)
    write_json(OUTPUT / "relatii_de_verificat.json", review)
    print(json.dumps({
        "houses": len(houses), "locations": len(locations),
        "alias_redirects": sum(entry["relatie"] == "alias_redirection" for entry in review),
        "relations_for_review": sum(entry["relatie"] != "alias_redirection" for entry in review),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
