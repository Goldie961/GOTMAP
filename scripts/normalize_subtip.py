#!/usr/bin/env python3
"""Normalize free-text location ``subtip`` values into a closed UI vocabulary.

No location data is written unless ``--apply`` is passed.  Original values are
copied verbatim to ``subtip_descriere`` before ``subtip`` is replaced.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (ROOT / "data/locations/locations.json", ROOT / "data/essos/free_cities.json", ROOT / "data/essos/far_lands.json")
CATALOG = ROOT / "data/map/catalog.json"
REPORT = ROOT / "docs/raport_subtip.md"
BACKUPS = ROOT / "data/_backups/normalize_subtip"

# Closed vocabulary.  Values deliberately match the Romanian labels used by
# the subtype filter; no free text is emitted by this script.
VOCABULARY = frozenset({
    "castel", "oraș", "sat", "ruine", "turn", "han", "port", "câmp de luptă", "fortăreață", "reședință", "templu", "repere naturale",
    "insulă", "regiune", "pădure", "munte", "coline", "apă", "râu", "drum", "stradă", "alee", "poartă", "piață", "docuri",
    "sală", "încăpere", "criptă", "curte", "bucătărie", "grajd", "beci", "armurărie", "bordel", "pod", "moară", "arenă", "ghildă", "monument", "fortificație",
    "instituție", "eveniment", "corabie", "nespecificat",
})

# Most-specific rules first.  They are applied to the old subtip, then name,
# then physical description, in that order.
RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("corabie", (r"\bnava\b", r"corab", r"vas\b")),
    ("instituție", (r"institut", r"banca", r"ghilda")),
    ("eveniment", (r"eveniment", r"turnir", r"batal", r"asediu")),
    ("criptă", (r"cript",)), ("armurărie", (r"armurar",)), ("bucătărie", (r"bucatar",)),
    ("grajd", (r"grajd",)), ("beci", (r"beci", r"pivnit")), ("sală", (r"\bsala\b", r"audient", r"consiliu")),
    ("încăpere", (r"incapere", r"camera", r"dormitor", r"apartament", r"chamber")), ("curte", (r"\bcurte",)),
    ("stradă", (r"strada", r"calea",)), ("alee", (r"alee",)), ("poartă", (r"poarta",)), ("piață", (r"piata",)), ("docuri", (r"doc",)),
    ("bordel", (r"bordel",)), ("han", (r"han\b", r"taverna", r"carciuma")), ("templu", (r"templ", r"sept")),
    ("pod", (r"pod\b",)), ("moară", (r"moar",)), ("arenă", (r"arena",)), ("turn", (r"\bturn", r"hightower")),
    ("fortificație", (r"\bzid\b",)), ("fortăreață", (r"fortareata", r"fort\b")), ("castel", (r"castel", r"cetate", r"keep")),
    ("râu", (r"\brau\b", r"fluvi", r"parau", r"canal", r"cascad")), ("apă", (r"\blac\b", r"\bmare\b", r"ocean", r"golf", r"stramtoare")),
    ("insulă", (r"insula", r"arhipelag")), ("repere naturale", (r"padure", r"wood\b", r"jungl", r"munt", r"colin")),
    ("drum", (r"drum", r"ruta", r"trecatoare", r"poteca")), ("regiune", (r"regiune", r"regat", r"continent", r"imperiu", r"tinut")),
    ("port", (r"port\b", r"harbor", r"portul")), ("oraș", (r"oras", r"city",)), ("sat", (r"sat\b", r"satuc", r"catun", r"localitate", r"targ")),
    ("ruine", (r"ruin",)), ("reședință", (r"resedinta", r"sediu de casa")), ("câmp de luptă", (r"camp de lupta",)),
    ("repere naturale", (r"copac", r"stanca", r"movila", r"vad", r"pestera")),
)
LEGACY = {"castle": "castel", "city": "oraș", "town": "sat", "ruins": "ruine", "fortress": "fortăreață", "landmark": "repere naturale"}
CANONICAL_TYPE_TO_FILTER = {
    # P2.2's type is authoritative when present.  ``subtype`` remains the
    # detailed taxonomy field; ``subtip`` is deliberately the compact filter
    # facet so the world-map UI cannot grow a checkbox per extracted phrase.
    "settlement": "oraș", "stronghold": "castel", "structure": "repere naturale",
    "interior": "încăpere", "urban_feature": "stradă", "region": "regiune",
    "landform": "repere naturale", "island": "insulă", "water": "apă",
    "watercourse": "râu", "route": "drum", "point_of_interest": "repere naturale",
    "non_place": "nespecificat",
}


def fold(value: Any) -> str:
    text = value if isinstance(value, str) else ""
    return "".join(ch for ch in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(ch) != "Mn")


def text(record: dict[str, Any], key: str) -> str:
    value = record.get(key)
    return " ".join(map(str, value)) if isinstance(value, list) else str(value or "")


def normalized(record: dict[str, Any]) -> tuple[str, str, bool]:
    """Return ``(closed_value, evidence, was_lexically_unmapped)``."""
    canonical = CANONICAL_TYPE_TO_FILTER.get(record.get("type"))
    if canonical:
        # Preserve a useful settlement distinction without adding another
        # family for every detailed subtype.
        if canonical == "oraș" and record.get("subtype") == "village":
            canonical = "sat"
        if canonical == "repere naturale" and record.get("subtype") == "tower":
            canonical = "turn"
        return canonical, "taxonomy_type", False
    for source in ("subtip", "name", "descriere_fizica"):
        candidate = fold(text(record, source))
        if not candidate:
            continue
        for value, patterns in RULES:
            if any(re.search(pattern, candidate) for pattern in patterns):
                return value, source, False
    fallback = LEGACY.get(record.get("type"))
    if fallback:
        return fallback, "legacy_type", bool(record.get("subtip"))
    return "nespecificat", "unmapped", bool(record.get("subtip"))


def read_sources() -> list[tuple[Path, list[dict[str, Any]]]]:
    return [(path, json.loads(path.read_text(encoding="utf-8"))) for path in SOURCES]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def backup(path: Path, stamp: str) -> None:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUPS / f"{path.stem}.{stamp}{path.suffix}")


def is_mappable(record: dict[str, Any], pins: set[str]) -> bool:
    # catalog.json is the authoritative source of currently visible map pins.
    # Once P2.2 has populated the explicit field it takes precedence; until
    # then, a coordinate stored on an entity is not enough to make a filter
    # affect the world map.
    return record.get("mappable") is True or record.get("id") in pins


def build_report(mapping: dict[str, Counter[str]], unmapped: Counter[str], records: list[dict[str, Any]], pins: set[str], dry_run: bool) -> str:
    mappable = Counter(normalized(record)[0] for record in records if is_mappable(record, pins))
    lines = ["# Raport normalizare `subtip`", "", f"Mod: `{'dry-run' if dry_run else 'apply'}`.", "",
             "## Valori vechi → vocabular închis", "", "| Valoare veche | Valoare nouă | Locații |", "|---|---|---:|"]
    for old in sorted(mapping, key=lambda item: (item is None, str(item))):
        label = "`null`" if old == "<null>" else f"`{old}`"
        for new, count in sorted(mapping[old].items()):
            lines.append(f"| {label} | `{new}` | {count} |")
    lines += ["", "## Valori care nu au putut fi mapate lexical", ""]
    if unmapped:
        lines += ["| Valoare veche | Locații |", "|---|---:|"]
        lines += [f"| `{value}` | {count} |" for value, count in sorted(unmapped.items())]
    else:
        lines.append("Niciuna.")
    lines += ["", "## Verificare filtru hartă", "", f"Valori distincte pentru locații mappable: **{len(mappable)}**.", "",
              "| Subtip | Locații mappable |", "|---|---:|"]
    lines += [f"| `{value}` | {count} |" for value, count in sorted(mappable.items())]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Preview only (default).")
    mode.add_argument("--apply", action="store_true", help="Write normalized data and report.")
    parser.add_argument("--report", type=Path, default=REPORT, help="Markdown report path (default: docs/raport_subtip.md).")
    args = parser.parse_args()
    if args.report.resolve() in {*SOURCES, CATALOG}:
        parser.error("--report must not overwrite source data")

    sources = read_sources()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    pins = set(catalog["maps"]["world"].get("coordinates", {}))
    mapping: dict[str, Counter[str]] = defaultdict(Counter)
    unmapped: Counter[str] = Counter()
    changed: dict[Path, list[dict[str, Any]]] = {}
    all_after: list[dict[str, Any]] = []
    before = {str(path.relative_to(ROOT)): sha256(path) for path, _ in sources}

    for path, records in sources:
        output = json.loads(json.dumps(records))
        file_changed = False
        for original, record in zip(records, output):
            value, evidence, failed = normalized(record)
            assert value in VOCABULARY
            old = original.get("subtip")
            mapping[old if old is not None else "<null>"][value] += 1
            if failed and old is not None:
                unmapped[str(old)] += 1
            # Do not replace the provenance on a second --apply run.
            if old is not None and "subtip_descriere" not in record:
                record["subtip_descriere"] = old
            if record.get("subtip") != value:
                record["subtip"] = value
            record["subtip_source"] = evidence
            file_changed |= record != original
            all_after.append(record)
        if file_changed:
            changed[path] = output

    report = build_report(mapping, unmapped, all_after, pins, not args.apply)
    if args.apply:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for path in changed:
            backup(path, stamp)
        if args.report.exists():
            backup(args.report, stamp)
        for path, output in changed.items():
            write_json(path, output)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report, encoding="utf-8")
    after = {str(path.relative_to(ROOT)): sha256(path) for path, _ in sources}
    mappable_count = len({normalized(record)[0] for record in all_after if is_mappable(record, pins)})
    print(f"mode={'apply' if args.apply else 'dry-run'} records={len(all_after)} changed_files={len(changed)} mappable_subtypes={mappable_count} unmapped_values={len(unmapped)}")
    if not args.apply:
        print(f"checksum_unchanged={before == after}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
