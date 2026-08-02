#!/usr/bin/env python3
"""Check generated location subtypes for an unmatched opening parenthesis."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "data" / "_import" / "etl_output" / "locations_new.json"


def has_unclosed_opening_parenthesis(value: str | None) -> bool:
    """True when the value ends while at least one opening parenthesis remains."""
    if not isinstance(value, str):
        return False
    depth = 0
    for character in value:
        if character == "(":
            depth += 1
        elif character == ")" and depth:
            depth -= 1
    return depth > 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    with args.path.open(encoding="utf-8") as handle:
        locations = json.load(handle)
    invalid = [location["id"] for location in locations
               if has_unclosed_opening_parenthesis(location.get("subtip"))]
    print(len(invalid))
    return 1 if invalid else 0


if __name__ == "__main__":
    raise SystemExit(main())
