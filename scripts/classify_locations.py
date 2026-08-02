#!/usr/bin/env python3
"""Classify location records according to docs/TAXONOMIE_v2.md.

The command is deliberately read-only unless --apply is supplied.  The
classifier is conservative: a low-confidence proposal is written only to the
human review queue, never to a source location file.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LOCATION_FILES = (
    ROOT / "data" / "locations" / "locations.json",
    ROOT / "data" / "essos" / "free_cities.json",
    ROOT / "data" / "essos" / "far_lands.json",
)
CATALOG = ROOT / "data" / "map" / "catalog.json"
REVIEW_FILE = ROOT / "data" / "_review" / "needs_manual_type.json"
BACKUP_DIR = ROOT / "data" / "_backups" / "classify_locations"

# The taxonomy calls these out as evidence that can contradict a noisy subtip.
# Keeping them explicit makes corrections auditable rather than hiding lore in a
# broad lexical rule.
OVERRIDES: dict[str, dict[str, Any]] = {
    "kings_landing": {"type": "settlement", "subtype": "city", "mappable": True},
    "oldtown": {"type": "stronghold", "subtype": "tower", "mappable": True},
    "valyria": {"type": "region", "subtype": "region", "mappable": True, "state": "ruined"},
    "yi_ti": {"type": "region", "subtype": "region", "mappable": True},
    "naath": {"type": "island", "subtype": "island", "mappable": True},
    "the_wall": {"type": "structure", "subtype": "fortification", "mappable": True},
    "riverrun": {"type": "stronghold", "subtype": "castle", "mappable": True},
    "pyke": {"type": "stronghold", "subtype": "castle", "mappable": True},
    "highgarden": {"type": "stronghold", "subtype": "castle", "mappable": True},
    "stoney_sept": {"type": "settlement", "subtype": "town", "mappable": True},
    "skagos": {"type": "island", "subtype": "island", "mappable": True},
    "gods_eye": {"type": "water", "subtype": "lake", "mappable": True},
    "aegonfort": {"type": "stronghold", "subtype": "castle", "mappable": True, "state": "former"},
    "selaesori_qhoran": {"type": "non_place", "subtype": "vessel", "mappable": False},
    "turnir_din_harrenhal": {"type": "non_place", "subtype": "event_record", "mappable": False, "state": "historic"},
    "banca_de_fier": {"type": "non_place", "subtype": "institution", "mappable": False},
    "nota_ocr": {"type": "non_place", "subtype": "extraction_artifact", "mappable": False},
    "capatul_furtunii_si_piatra_dragonului": {"type": "non_place", "subtype": "compound_row", "mappable": False},
}

PARENT_HINTS = {
    "winterfell": "winterfell", "fortaretei rosii": "kings_landing",
    "debarcaderul regelui": "kings_landing", "dragonstone": "dragonstone",
    "turnul sabiei albe": "turnul_sabiei_albe",
}

RULES = [
    # Each tuple is (type, subtype, mappable, patterns).  This ordering is the
    # documented signal priority within a text: specific non-places first,
    # then natural forms and constructed/contained places.
    ("non_place", "vessel", False, (r"\bnava\b", r"\bcorab")),
    ("non_place", "institution", False, (r"institutie", r"banca")),
    ("non_place", "event_record", False, (r"eveniment", r"turnir")),
    ("non_place", "compound_row", False, (r"\bcastele/regiuni\b",)),
    ("watercourse", "river", True, (r"\brau\b", r"fluvi", r"parau", r"canal", r"cascad")),
    ("water", "lake", True, (r"\blac\b",)),
    ("water", "bay", True, (r"\bgolf\b", r"\bmare\b", r"ocean", r"stramtoare")),
    ("island", "island", True, (r"insula", r"arhipelag")),
    ("landform", "forest", True, (r"padure", r"wood\b", r"jungl")),
    ("landform", "mountain_range", True, (r"lant muntos", r"munt")),
    ("landform", "hills", True, (r"colin",)),
    ("route", "road", True, (r"drum", r"ruta", r"trecatoare", r"poteca")),
    ("urban_feature", "street", False, (r"strada", r"calea", r"poarta", r"piata", r"docuri", r"cartier")),
    ("urban_feature", "alley", False, (r"alee",)),
    ("interior", "crypt", False, (r"cript",)),
    ("interior", "hall", False, (r"\bsala\b", r"audiente", r"consiliu")),
    ("interior", "armoury", False, (r"armurar",)),
    ("interior", "chamber", False, (r"camera", r"incapere", r"dormitor", r"apartament")),
    ("interior", "kitchen", False, (r"bucatar",)),
    ("interior", "stable", False, (r"grajd",)),
    ("interior", "greenhouse", False, (r"sera", r"gradina de sticla")),
    ("structure", "brothel", False, (r"bordel",)),
    ("structure", "keep", False, (r"marea fortareata",)),
    ("structure", "tower", False, (r"\bturn",)),
    ("settlement", "town", True, (r"localitate",)),
    ("stronghold", "castle", True, (r"castel", r"cetate", r"fortareata")),
    ("settlement", "village", True, (r"sat", r"satuc", r"catun")),
    ("settlement", "town", True, (r"oras", r"targ")),
    ("region", "region", True, (r"regiune", r"regat", r"continent", r"imperiu", r"tinut")),
]


def folded(value: Any) -> str:
    """Return accent-insensitive text for deterministic Romanian matching."""
    text = value if isinstance(value, str) else ""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def all_text(record: dict[str, Any], field: str) -> str:
    value = record.get(field)
    if isinstance(value, list):
        return " ".join(str(v) for v in value)
    return str(value or "")


def catalog_ids() -> set[str]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    return set(catalog["maps"]["world"].get("coordinates", {}))


def infer_parent(record: dict[str, Any], ids: set[str]) -> str | None:
    text = folded(" ".join((all_text(record, "name"), all_text(record, "subtip"))))
    for phrase, parent in PARENT_HINTS.items():
        if phrase in text and parent in ids and parent != record.get("id"):
            return parent
    return None


def classify(record: dict[str, Any], pins: set[str], ids: set[str]) -> dict[str, Any]:
    """Return an additive proposal and the evidence used for it.

    Signals are consulted in the required order: subtip, name, physical
    description, pin presence, then relation/containment hints.
    """
    if record["id"] in OVERRIDES:
        result = dict(OVERRIDES[record["id"]])
        result.update(confidence="high", evidence=["taxonomy_override"])
        result["parent_id"] = infer_parent(record, ids)
        return result

    fields = [("subtip", folded(all_text(record, "subtip"))),
              ("name", folded(all_text(record, "name"))),
              ("descriere_fizica", folded(all_text(record, "descriere_fizica")))]
    for source, text in fields:
        if not text:
            continue
        for kind, subtype, mappable, patterns in RULES:
            if any(re.search(pattern, text) for pattern in patterns):
                # A structure inside another named place is not world-mappable.
                parent = infer_parent(record, ids)
                if kind == "structure" and parent:
                    mappable = False
                if kind == "landform" and "winterfell" in folded(all_text(record, "name")):
                    # A godswood inside a castle has no separate world geometry.
                    mappable = False
                confidence = "high" if source == "subtip" else "medium"
                return {"type": kind, "subtype": subtype, "mappable": mappable,
                        "parent_id": parent, "confidence": confidence,
                        "evidence": [source]}

    # Existing legacy types are useful only as a fallback.  A pin increases
    # confidence in mappability, not in an otherwise unknown semantic type.
    legacy = record.get("type")
    fallback = {"city": ("settlement", "city"), "town": ("settlement", "town"),
                "castle": ("stronghold", "castle"), "fortress": ("stronghold", "fortress"),
                "ruins": ("point_of_interest", "ruin")}.get(legacy)
    if fallback:
        return {"type": fallback[0], "subtype": fallback[1], "mappable": record["id"] in pins,
                "parent_id": infer_parent(record, ids), "confidence": "medium", "evidence": ["legacy_type", "catalog" if record["id"] in pins else ""]}
    return {"type": None, "subtype": None, "mappable": False, "parent_id": infer_parent(record, ids),
            "confidence": "low", "evidence": ["no_reliable_signal"]}


def load_sources() -> list[tuple[Path, list[dict[str, Any]]]]:
    sources = []
    for path in LOCATION_FILES:
        contents = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(contents, list):
            raise ValueError(f"Expected a JSON array in {path}")
        sources.append((path, contents))
    return sources


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def backup(path: Path, stamp: str) -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUP_DIR / f"{path.stem}.{stamp}{path.suffix}")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report_sample(path: Path, pins: set[str], ids: set[str]) -> dict[str, Any]:
    sample = json.loads(path.read_text(encoding="utf-8"))
    rows = [row for group in sample["grupuri"].values() for row in group]
    results = []
    correct_type = correct_mappable = exact = 0
    for row in rows:
        current = dict(row["stare_curenta"], id=row["id"], name=row["name_curent"])
        got, expected = classify(current, pins, ids), row["propunere"]
        type_ok, mappable_ok = got["type"] == expected["type"], got["mappable"] == expected["mappable"]
        exact_ok = type_ok and mappable_ok and got["subtype"] == expected.get("subtype") and got.get("state") == expected.get("state")
        correct_type += type_ok; correct_mappable += mappable_ok; exact += exact_ok
        results.append({"id": row["id"], "expected": expected, "predicted": got,
                        "type_correct": type_ok, "mappable_correct": mappable_ok, "exact": exact_ok})
    total = len(rows)
    return {"sample": str(path), "total": total, "type_accuracy": correct_type / total,
            "mappable_accuracy": correct_mappable / total, "exact_accuracy": exact / total,
            "results": results}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Preview only (default).")
    mode.add_argument("--apply", action="store_true", help="Write medium/high confidence proposals.")
    parser.add_argument("--report", type=Path, help="Write JSON report to PATH.")
    parser.add_argument("--sample", type=Path, help="Evaluate a taxonomie sample without changing data.")
    parser.add_argument("--retype-all", action="store_true", help="Also replace existing non-location legacy types.")
    args = parser.parse_args()
    if args.retype_all and not args.apply:
        parser.error("--retype-all requires --apply")
    if args.report and args.report.resolve() in {*LOCATION_FILES, CATALOG, REVIEW_FILE}:
        parser.error("--report must not point at an authoritative data file")

    sources, pins = load_sources(), catalog_ids()
    ids = {item["id"] for _, records in sources for item in records}
    if args.sample:
        result = report_sample(args.sample, pins, ids)
        print(f"Sample: {result['total']} rows | type: {result['type_accuracy']:.1%} | mappable: {result['mappable_accuracy']:.1%} | exact: {result['exact_accuracy']:.1%}")
        if args.report:
            write_json(args.report, result)
        return 0

    before = {str(path.relative_to(ROOT)): digest(path) for path, _ in sources}
    changes: dict[Path, list[dict[str, Any]]] = {}
    review: list[dict[str, Any]] = []
    counts = Counter()
    for path, records in sources:
        changed = copy.deepcopy(records)
        altered = False
        for original, record in zip(records, changed):
            proposal = classify(record, pins, ids)
            counts[proposal["confidence"]] += 1
            existing = original.get("type")
            eligible = args.retype_all or existing in (None, "location")
            if proposal["confidence"] == "low":
                review.append({"id": record["id"], "name": record.get("name"), "proposal": proposal,
                               "reason": "low confidence: manual triage required"})
                continue
            if not eligible:
                counts["preserved_existing_type"] += 1
                continue
            for key in ("type", "subtype", "mappable", "parent_id", "state"):
                if key in proposal and proposal[key] is not None:
                    record[key] = proposal[key]
            record["classification_confidence"] = proposal["confidence"]
            if record != original:
                altered = True
        if altered:
            changes[path] = changed

    report = {"mode": "apply" if args.apply else "dry-run", "retype_all": args.retype_all,
              "records": sum(len(r) for _, r in sources), "proposals_by_confidence": dict(counts),
              "files_to_change": [str(p.relative_to(ROOT)) for p in changes], "manual_review_count": len(review),
              "checksums_before": before}
    if args.apply:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for path in changes:
            backup(path, stamp)
        if REVIEW_FILE.exists():
            backup(REVIEW_FILE, stamp)
        for path, records in changes.items():
            write_json(path, records)
        write_json(REVIEW_FILE, review)
        report["backups"] = str(BACKUP_DIR.relative_to(ROOT))
    else:
        after = {str(path.relative_to(ROOT)): digest(path) for path, _ in sources}
        report["checksums_after"] = after
        report["checksum_unchanged"] = before == after
    if args.report:
        write_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
