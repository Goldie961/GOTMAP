"""Retire legacy editor coordinates that fail region-polygon validation.

The affected values were written by the pre-grid editor and are not calibrated
map positions.  Removing both copies is intentional: the map editor will list
the locations as uncalibrated instead of silently displaying a false pin.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from verify_all import is_point_in_polygon, svg_path_to_points


LOCATION_FILES = (
    ROOT / "data/locations/locations.json",
    ROOT / "data/essos/free_cities.json",
    ROOT / "data/essos/far_lands.json",
)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    regions = {
        item["id"]: svg_path_to_points(item["path"])
        for item in load_json(ROOT / "data/map/regions.json")["regions"]
    }
    documents = []
    records = []
    for path in LOCATION_FILES:
        data = load_json(path)
        locations = data["locations"] if isinstance(data, dict) else data
        documents.append((path, data))
        records.extend(locations)

    misplaced = set()
    for location in records:
        point = location.get("coordinates")
        if not point or "x" not in point or "y" not in point:
            continue
        actual = next(
            (region_id for region_id, polygon in regions.items()
             if is_point_in_polygon(point["x"], point["y"], polygon)),
            None,
        )
        if actual != location.get("region"):
            misplaced.add(location["id"])
            location.pop("coordinates", None)

    catalog_path = ROOT / "data/map/catalog.json"
    catalog = load_json(catalog_path)
    coordinates = catalog["maps"]["world"]["coordinates"]
    for location_id in misplaced:
        coordinates.pop(location_id, None)

    for path, data in documents:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Retired {len(misplaced)} invalid legacy coordinate records.")


if __name__ == "__main__":
    main()
