#!/usr/bin/env python3
"""Position Nivel 1 locations without fabricating map calibration.

The world map uses SVG units.  Numeric distance statements can only be
converted to those units when ``data/map/catalog.json`` defines a positive
``maps.world.coordinates.milesPerUnit`` value.  Until then this script leaves
triangulation candidates unpinned, rather than guessing a scale.

Run normally to update locations.json, or use --dry-run to inspect the report.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCATIONS_PATH = ROOT / "data" / "locations" / "locations.json"
DISTANCES_PATH = ROOT / "data" / "_import" / "statements_distante.json"
REGIONS_PATH = ROOT / "data" / "map" / "regions.json"
CATALOG_PATH = ROOT / "data" / "map" / "catalog.json"

# A league is three miles in the frontend (DistanceTool.js).
KM_PER_MILE = 1.609344
MILES_PER_LEAGUE = 3.0
MIN_PIN_GAP = 7.0  # SVG units; keeps approximate regional pins readable.


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def path_to_polygon(svg_path: str) -> list[tuple[float, float]]:
    """Extract point pairs from the M/L polygon format used by regions.json."""
    values = [float(value) for value in re.findall(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", svg_path)]
    if len(values) < 6 or len(values) % 2:
        raise ValueError(f"Invalid region SVG path: {svg_path[:80]!r}")
    return list(zip(values[::2], values[1::2]))


def point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
    """Ray-casting test, equivalent to DataManager.isPointInPolygon."""
    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        if (current_y > y) != (previous_y > y):
            intersection_x = (previous_x - current_x) * (y - current_y) / (previous_y - current_y) + current_x
            if x < intersection_x:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def polygon_bounds(polygon: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs, ys = zip(*polygon)
    return min(xs), min(ys), max(xs), max(ys)


def stable_region_point(location_id: str, polygon: list[tuple[float, float]], occupied: list[dict]) -> dict:
    """Deterministically select an interior, non-overlapping point for a region pin."""
    left, top, right, bottom = polygon_bounds(polygon)
    digest = hashlib.sha256(location_id.encode("utf-8")).digest()
    # A deterministic pseudo-random sequence avoids all region pins stacking at
    # labelPosition while remaining identical on repeat runs.
    seed = int.from_bytes(digest[:8], "big")
    for attempt in range(1, 20_001):
        seed = (6364136223846793005 * seed + 1442695040888963407) & ((1 << 64) - 1)
        x = left + (seed / (1 << 64)) * (right - left)
        seed = (6364136223846793005 * seed + 1442695040888963407) & ((1 << 64) - 1)
        y = top + (seed / (1 << 64)) * (bottom - top)
        if not point_in_polygon(x, y, polygon):
            continue
        if all(math.hypot(x - point["x"], y - point["y"]) >= MIN_PIN_GAP for point in occupied):
            return {"x": round(x, 2), "y": round(y, 2)}
    raise RuntimeError(f"Could not find a free interior point for {location_id}")


def number_from_words(text: str) -> float | None:
    """Handle the small Romanian number vocabulary occurring in distance data."""
    normalized = normalize(text)
    words = {
        "jumatate": 0.5, "un": 1, "o": 1, "doi": 2, "doua": 2, "trei": 3,
        "patru": 4, "cinci": 5, "sase": 6, "sapte": 7, "opt": 8, "noua": 9,
        "zece": 10, "cincizeci": 50, "saizeci": 60, "o suta": 100,
        "o mie": 1000, "o mie cinci sute": 1500, "doua mii": 2000,
        "trei mii": 3000,
    }
    # Longest wording first because e.g. "o mie cinci sute" contains "o mie".
    for phrase, value in sorted(words.items(), key=lambda item: len(item[0]), reverse=True):
        if normalize(phrase) in normalized:
            return value
    return None


def parse_distance_miles(value: str | None) -> float | None:
    """Return an explicit horizontal distance in miles, or None when ambiguous."""
    text = (value or "").casefold().replace(",", ".")
    if any(word in text for word in ("înălțime", "inaltime", "vertical", "grosime", "lățime", "latime")):
        return None
    unit_match = re.search(r"(?P<number>\d+(?:\.\d+)?)\s*(?P<unit>kilometri|kilometru|km|leghe|legh?e|mile)\b", text)
    if unit_match:
        amount = float(unit_match.group("number"))
        unit = unit_match.group("unit")
    else:
        unit_word = re.search(r"\b(kilometri|kilometru|km|leghe|legh?e|mile)\b", text)
        if not unit_word:
            return None
        amount = number_from_words(text)
        unit = unit_word.group(1)
        if amount is None:
            return None
    if amount <= 0 or amount > 2_000:  # catches clearly unusable/exaggerated statements.
        return None
    if unit.startswith("k"):
        return amount / KM_PER_MILE
    if unit.startswith("leg"):
        return amount * MILES_PER_LEAGUE
    return amount


def direction_vector(direction: str | None) -> tuple[float, float] | None:
    """Read an unambiguous cardinal direction; SVG y grows towards the south."""
    text = normalize(direction)
    # Explicit vertical descriptions cannot be represented on this 2D map.
    if any(term in text for term in ("vertical", "deasupra", "dedesubt", "injos", "sus")):
        return None
    directions = (
        (("nordvest", "nordvest"), (-1, -1)), (("nordest",), (1, -1)),
        (("sudvest",), (-1, 1)), (("sudest",), (1, 1)),
        (("miazanoapte", "nord"), (0, -1)), (("miazazi", "sud"), (0, 1)),
        (("rasarit", "est"), (1, 0)), (("apus", "vest"), (-1, 0)),
    )
    for terms, vector in directions:
        if any(term in text for term in terms):
            length = math.hypot(*vector)
            return vector[0] / length, vector[1] / length
    return None


def location_indexes(locations: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    by_internal, by_normalized = {}, {}
    for location in locations:
        for key in (location.get("id_intern"),):
            if key:
                by_internal[key] = location
        for key in (location.get("id"), location.get("name"), *(location.get("aliasuri") or [])):
            normalized = normalize(key)
            if normalized and normalized not in by_normalized:
                by_normalized[normalized] = location
    return by_internal, by_normalized


def as_location(reference: str, by_internal: dict, by_normalized: dict) -> dict | None:
    return by_internal.get(reference) or by_normalized.get(normalize(reference))


def triangulate(locations: list[dict], statements: list[dict], miles_per_unit: float | None) -> tuple[list[dict], Counter]:
    """Place only statements with an explicit distance, scale, and 2D direction.

    The source dataset records directions as free text.  Its documented
    convention is interpreted as location_b relative to location_a; any
    statement not expressible as one cardinal vector is intentionally skipped.
    """
    report, skipped = [], Counter()
    if not miles_per_unit:
        skipped["missing_map_scale"] = len(statements)
        return report, skipped
    by_internal, by_normalized = location_indexes(locations)
    for statement in statements:
        first = as_location(statement["location_a"], by_internal, by_normalized)
        second = as_location(statement["location_b"], by_internal, by_normalized)
        if not first or not second:
            skipped["unmatched_location"] += 1
            continue
        first_point, second_point = first.get("coordinates"), second.get("coordinates")
        if bool(first_point) == bool(second_point):
            skipped["not_one_positioned_endpoint"] += 1
            continue
        miles = parse_distance_miles(statement.get("distance_value"))
        vector = direction_vector(statement.get("direction"))
        if miles is None:
            skipped["non_numeric_or_non_horizontal_distance"] += 1
            continue
        if vector is None:
            skipped["ambiguous_direction"] += 1
            continue
        distance_units = miles / miles_per_unit
        if distance_units > 500:  # reject a bad scale/data combination before writing a false pin.
            skipped["distance_outside_map"] += 1
            continue
        if first_point:
            anchor, target, sign = first, second, 1
        else:
            anchor, target, sign = second, first, -1
        # Level 2 means a measurement from a fixed, existing anchor.  Do not
        # compound an already approximate pin, and never fill a legacy AWOIAF
        # record whose source coordinates are out of scope for this pass.
        if anchor.get("sursa_coordonate") != "AWOIAF":
            skipped["anchor_not_fixed_awoiaf"] += 1
            continue
        if target.get("sursa_coordonate") == "AWOIAF":
            skipped["legacy_awoiaf_target_untouched"] += 1
            continue
        point = {
            "x": round(anchor["coordinates"]["x"] + sign * vector[0] * distance_units, 2),
            "y": round(anchor["coordinates"]["y"] + sign * vector[1] * distance_units, 2),
        }
        target["coordinates"] = point
        target["sursa_coordonate"] = "triangulat"
        target["approximate"] = True
        target["coordinate_evidence"] = {
            "method": "triangulated",
            "anchor_id": anchor["id"],
            "statement": {key: statement.get(key) for key in ("location_a", "location_b", "distance_value", "direction", "source_book", "source_fragment", "source_page")},
            "calculation": f"{miles:.2f} mi / {miles_per_unit:g} mi per SVG unit = {distance_units:.2f} SVG units",
        }
        report.append({"location": target["id"], "anchor": anchor["id"], "coordinates": point, "calculation": target["coordinate_evidence"]["calculation"], "statement": statement})
    return report, skipped


def position_by_region(locations: list[dict], regions: dict[str, list[tuple[float, float]]]) -> list[str]:
    occupied_by_region = {
        region_id: [item["coordinates"] for item in locations if item.get("region") == region_id and item.get("coordinates")]
        for region_id in regions
    }
    placed = []
    for location in locations:
        region_id = location.get("region")
        # The 333 legacy AWOIAF records are immutable in this pass.  Some of
        # them currently carry a null coordinate, but they are still anchors,
        # not enrichment records to be assigned an approximate regional pin.
        if location.get("coordinates") or not region_id or location.get("sursa_coordonate") == "AWOIAF":
            continue
        polygon = regions.get(region_id)
        if not polygon:
            continue
        point = stable_region_point(location["id"], polygon, occupied_by_region[region_id])
        location["coordinates"] = point
        location["sursa_coordonate"] = "manual"
        location["approximate"] = True
        location["coordinate_evidence"] = {"method": "region_polygon", "region": region_id}
        occupied_by_region[region_id].append(point)
        placed.append(location["id"])
    return placed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing locations.json")
    args = parser.parse_args()

    locations = read_json(LOCATIONS_PATH)
    statements = read_json(DISTANCES_PATH)
    regions = {item["id"]: path_to_polygon(item["path"]) for item in read_json(REGIONS_PATH)["regions"]}
    catalog = read_json(CATALOG_PATH)
    miles_per_unit = catalog["maps"]["world"]["coordinates"].get("milesPerUnit")
    if not isinstance(miles_per_unit, (int, float)) or miles_per_unit <= 0:
        miles_per_unit = None

    anchors = sum(bool(item.get("coordinates")) for item in locations)
    legacy_awoiaf = [item for item in locations if item.get("sursa_coordonate") == "AWOIAF"]
    triangulated, skipped = triangulate(locations, statements, miles_per_unit)
    regional = position_by_region(locations, regions)
    no_region_new = [item for item in locations if not item.get("region")]
    report = {
        "dry_run": args.dry_run,
        "map_miles_per_unit": miles_per_unit,
        "levels": {
            "1_fixed_existing_coordinates": anchors,
            "1_legacy_awoiaf_records_untouched": len(legacy_awoiaf),
            "1_legacy_awoiaf_records_currently_null": sum(not item.get("coordinates") for item in legacy_awoiaf),
            "2_triangulated": len(triangulated),
            "coordinates_after_level_2": anchors + len(triangulated),
            "3_region_approximate": len(regional),
            "coordinates_after_level_3": anchors + len(triangulated) + len(regional),
            "4_unpositioned": sum(not item.get("coordinates") for item in locations),
        },
        "new_without_region": {
            "total": len(no_region_new),
            "triangulated": sum(item.get("sursa_coordonate") == "triangulat" for item in no_region_new),
            "without_pin": sum(not item.get("coordinates") for item in no_region_new),
        },
        "triangulation_skipped": dict(skipped),
        "triangulation_examples": triangulated[:3],
    }
    if not args.dry_run:
        write_json(LOCATIONS_PATH, locations)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
