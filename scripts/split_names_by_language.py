#!/usr/bin/env python3
"""Classify existing entity names as Romanian/English; never translates names.

The command is deliberately a dry run unless ``--apply`` is supplied.  On an
apply run it preserves the original ``name`` (or legacy ``nume``) field,
backs up every changed source file, and writes unresolved cases to
``data/_review/needs_language_review.json``.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REVIEW_FILE = DATA / "_review" / "needs_language_review.json"
DEFAULT_REPORT = DATA / "_review" / "name_language_report.json"
BACKUP_ROOT = DATA / "_backups" / "split_names_by_language"

# These are maintained canonical entity collections.  Import material,
# backups and relationship/geometry derivatives are intentionally excluded.
CATEGORY_FILES = {
    "characters": DATA / "characters" / "characters.json",
    "dragons": DATA / "dragons" / "dragons.json",
    "essos_far_lands": DATA / "essos" / "far_lands.json",
    "essos_free_cities": DATA / "essos" / "free_cities.json",
    "essos_free_cities_events": DATA / "essos" / "free_cities_events.json",
    "essos_free_cities_factions": DATA / "essos" / "free_cities_factions.json",
    "events": DATA / "events" / "events.json",
    "houses": DATA / "houses" / "houses.json",
    "locations": DATA / "locations" / "locations.json",
    "map_world_features": DATA / "map" / "world_features.json",
    "objects": DATA / "objects" / "objects.json",
    "titles": DATA / "titles" / "titles.json",
}

ROMANIAN_DIACRITICS = re.compile(r"[ăâîșşțţ]", re.IGNORECASE)
EN_POSSESSIVE = re.compile(r"\b[\w-]+['’]s\b", re.IGNORECASE)
# A suffix alone is not conclusive (e.g. English 'castle'), so it is only a
# signal when the word is otherwise a Romanian-looking word or phrase.
RO_DEFINITE = re.compile(r"\b[\wăâîșșțț-]{3,}(?:ului|ului|elor|ilor|ul|le|ea|ua|ii|lor)\b", re.IGNORECASE)
TOKEN_RE = re.compile(r"[a-z0-9ăâîșşțţ]+", re.IGNORECASE)
ROMANIAN_WORDS = {
    "al", "ale", "a", "ai", "cel", "cea", "cei", "cele", "cu", "de", "din", "dintre",
    "în", "in", "la", "lui", "pe", "pentru", "și", "si", "spre", "sub", "un", "o",
    "bătălia", "batalia", "bătălie", "batalie", "casa", "castel", "cetatea", "cronica",
    "distrugerea", "domnul", "doamna", "fiul", "fiica", "fortăreața", "fortareata",
    "insula", "mare", "marea", "muntele", "nunta", "orașul", "orasul", "pădurea",
    "padurea", "portul", "prăbușirea", "printul", "prințul", "regele", "regina",
    "râul", "raul", "războiul", "razboiul", "turnul", "zidul",
}
ENGLISH_WORDS = {
    "a", "an", "and", "at", "battle", "black", "burning", "castle", "city", "of", "for",
    "from", "gold", "great", "house", "in", "island", "king", "landing", "little", "mount",
    "north", "on", "queen", "red", "river", "road", "sea", "seven", "south", "stone", "the",
    "tower", "wall", "west", "white", "winter", "with", "woods",
}
ID_ENGLISH_WORDS = ENGLISH_WORDS | {"blackwater", "gulltown", "harrenhal", "winterfell", "kingsroad"}


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalise(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower())
    ascii_value = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", ascii_value))


def tokens(value: str) -> list[str]:
    return TOKEN_RE.findall(value.lower())


def is_machine_alias(value: str) -> bool:
    """Avoid internal aliases such as PERSON_REGELE_NED_STARK."""
    return bool(re.fullmatch(r"[A-Z0-9_]+", value))


def classify(value: Any, entity_id: str = "") -> tuple[str | None, list[str]]:
    """Return language and auditable evidence, or None when evidence conflicts/is weak."""
    if not isinstance(value, str) or not value.strip():
        return None, ["empty_or_non_string"]
    value = value.strip()
    words = tokens(value)
    word_set = set(words)
    ro: list[str] = []
    en: list[str] = []

    if ROMANIAN_DIACRITICS.search(value):
        ro.append("romanian_diacritic")
    if EN_POSSESSIVE.search(value):
        en.append("english_possessive")

    ro_word_hits = sorted(word_set & ROMANIAN_WORDS)
    en_word_hits = sorted(word_set & ENGLISH_WORDS)
    if ro_word_hits:
        ro.append("romanian_words:" + ",".join(ro_word_hits))
    if en_word_hits:
        en.append("english_words:" + ",".join(en_word_hits))
    # The suffix is deliberately corroborative, never sufficient by itself:
    # English proper names such as "Baelor" and "Humble" can end in -lor/-le.
    if RO_DEFINITE.search(value) and ro_word_hits:
        ro.append("romanian_enclitic_article")

    # IDs are usually English-derived.  Use this only when the normalized name
    # actually occurs in the ID and it contains an English lexical token; an ID
    # match such as 'aegon' is language-neutral and remains undecided.
    normalized = normalise(value)
    id_words = set(entity_id.lower().split("_"))
    if normalized and normalized.replace(" ", "_") in entity_id.lower() and id_words & ID_ENGLISH_WORDS:
        en.append("english_derived_id")

    if ro and not en:
        return "ro", ro
    if en and not ro:
        return "en", en
    if ro and en:
        return None, ["conflicting_signals", *ro, *en]
    return None, ["insufficient_language_evidence"]


def aliases(entity: dict[str, Any]) -> Iterable[str]:
    for key in ("aliasuri", "aliases", "alias", "alternative_names", "nume_alternative"):
        values = entity.get(key)
        if isinstance(values, str):
            values = [values]
        if isinstance(values, list):
            for value in values:
                if isinstance(value, str) and value.strip() and not is_machine_alias(value.strip()):
                    yield value.strip()


def choose_other_language(candidates: Iterable[str], target: str, entity_id: str, original: str) -> tuple[str | None, list[dict[str, Any]]]:
    inspected = []
    original_norm = normalise(original)
    for candidate in candidates:
        language, evidence = classify(candidate, entity_id)
        inspected.append({"value": candidate, "language": language, "evidence": evidence})
        if language == target and normalise(candidate) != original_norm:
            return candidate, inspected
    return None, inspected


def process_entity(entity: dict[str, Any], name_key: str) -> tuple[str, dict[str, Any] | None]:
    """Classify one row and prepare changes/review entry without mutating it."""
    name = entity.get(name_key)
    entity_id = str(entity.get("id", ""))
    language, evidence = classify(name, entity_id)
    if not isinstance(name, str) or not name.strip():
        return "undecided", {"id": entity_id, "name": name, "reason": evidence}

    other = "en" if language == "ro" else "ro" if language == "en" else None
    alias_value, inspected_aliases = (choose_other_language(aliases(entity), other, entity_id, name) if other else (None, []))
    if language == "ro":
        result = {"name_ro": name, "name_en": alias_value}
        outcome = "both" if alias_value else "ro_only"
    elif language == "en":
        result = {"name_ro": alias_value, "name_en": name}
        outcome = "both" if alias_value else "en_only"
    else:
        return "undecided", {
            "id": entity_id, "name": name, "reason": evidence,
            "aliases_inspected": inspected_aliases,
        }

    # This invariant guards against an accidental duplicate assignment.
    if result["name_ro"] is not None and normalise(result["name_ro"]) == normalise(result["name_en"] or ""):
        return "undecided", {
            "id": entity_id, "name": name, "reason": ["same_name_would_fill_both_languages"],
            "aliases_inspected": inspected_aliases,
        }
    return outcome, {"updates": result, "evidence": evidence, "aliases_inspected": inspected_aliases}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write source files, backups and review JSON")
    parser.add_argument("--report", nargs="?", const=str(DEFAULT_REPORT), metavar="PATH", help="write JSON report (default: data/_review/name_language_report.json)")
    args = parser.parse_args()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report: dict[str, Any] = {"generated_at": timestamp, "mode": "apply" if args.apply else "dry_run", "categories": {}, "totals": {}}
    reviews: dict[str, list[dict[str, Any]]] = {}
    totals: Counter[str] = Counter()
    changed_files: list[Path] = []

    for category, path in CATEGORY_FILES.items():
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            continue
        counts: Counter[str] = Counter()
        review_rows: list[dict[str, Any]] = []
        changed = False
        for entity in data:
            if not isinstance(entity, dict):
                counts["not_entity"] += 1
                continue
            name_key = "name" if "name" in entity else "nume" if "nume" in entity else None
            if not name_key:
                counts["without_name_field"] += 1
                continue
            outcome, detail = process_entity(entity, name_key)
            counts[outcome] += 1
            if outcome == "undecided":
                review_rows.append(detail or {"id": entity.get("id"), "name": entity.get(name_key)})
            elif detail:
                updates = detail["updates"]
                # Clear previously generated values too: re-running must not retain stale values.
                if entity.get("name_ro") != updates["name_ro"] or entity.get("name_en") != updates["name_en"]:
                    entity.update(updates)
                    changed = True
        total = sum(counts[key] for key in ("both", "ro_only", "en_only", "undecided"))
        report["categories"][category] = {
            "source": str(path.relative_to(ROOT)).replace("\\", "/"), "total": total,
            "both": counts["both"], "ro_only": counts["ro_only"], "en_only": counts["en_only"], "undecided": counts["undecided"],
            "name_ro_coverage": counts["both"] + counts["ro_only"],
            "name_en_coverage": counts["both"] + counts["en_only"],
            "name_ro_coverage_percent": round(100 * (counts["both"] + counts["ro_only"]) / total, 2) if total else 0.0,
            "name_en_coverage_percent": round(100 * (counts["both"] + counts["en_only"]) / total, 2) if total else 0.0,
        }
        reviews[category] = review_rows
        totals.update(counts)
        if args.apply and changed:
            backup = BACKUP_ROOT / timestamp / path.relative_to(DATA)
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup)
            json_dump(path, data)
            changed_files.append(path)

    report["totals"] = {key: totals[key] for key in ("both", "ro_only", "en_only", "undecided")}
    report["changed_files"] = [str(p.relative_to(ROOT)).replace("\\", "/") for p in changed_files]
    report["review_file"] = str(REVIEW_FILE.relative_to(ROOT)).replace("\\", "/") if args.apply else None
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.apply:
        json_dump(REVIEW_FILE, {"generated_at": timestamp, "categories": reviews})
    if args.report:
        json_dump(Path(args.report), report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
