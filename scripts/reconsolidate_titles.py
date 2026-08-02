#!/usr/bin/env python3
"""Re-apply title synonym deduplication on the LIVE characters.json.

This script:
1. Backs up characters.json to data/_import/etl_output/backups/characters.pre_sinonime_reale.json
2. Loads TITLE_SYNONYMS and deduplication logic from consolidation_functions.py
3. Re-deduplicates each character's titles array in-place (not recreating from statements)
4. Writes back to characters.json
5. Verifies key characters from the re-read file on disk
"""

import json
import sys
import shutil
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from consolidation_functions import (
    _title_normalization_key,
    _titles_similar,
    is_title_noise,
    TITLE_SIMILARITY_THRESHOLD,
)

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_PATH = ROOT / "data" / "characters" / "characters.json"
BACKUP_PATH = ROOT / "data" / "_import" / "etl_output" / "backups" / "characters.pre_sinonime_reale.json"


def deduplicate_titles(titles_array):
    """Re-group and deduplicate a character's titles array using the synonym logic.
    
    Input: list of dicts like {"titlu": ..., "surse": [...], "pozitie_cronologica": {...}}
    Output: deduplicated list with merged surse and earliest pozitie_cronologica.
    """
    if not titles_array:
        return []

    # Filter out noise titles
    filtered = []
    for t in titles_array:
        titlu = t.get("titlu", "") if isinstance(t, dict) else str(t)
        if not is_title_noise(titlu):
            filtered.append(t)

    if not filtered:
        return []

    # Group similar titles
    groups = []
    for t in filtered:
        titlu = t.get("titlu", "") if isinstance(t, dict) else str(t)
        matched = False
        for group in groups:
            representative = group[0].get("titlu", "") if isinstance(group[0], dict) else str(group[0])
            if _titles_similar(titlu, representative):
                group.append(t)
                matched = True
                break
        if not matched:
            groups.append([t])

    # Build merged output
    result = []
    for group in groups:
        # Choose canonical title: most frequent, then longest
        texts = [g.get("titlu", "") if isinstance(g, dict) else str(g) for g in group]
        canonical = max(set(texts), key=lambda t: (texts.count(t), len(t)))

        # Merge surse (deduplicated)
        all_surse = []
        seen_surse = set()
        for g in group:
            if isinstance(g, dict):
                for src in g.get("surse", []):
                    key = json.dumps(src, ensure_ascii=False, sort_keys=True)
                    if key not in seen_surse:
                        seen_surse.add(key)
                        all_surse.append(src)

        # Earliest pozitie_cronologica
        def chrono_key(item):
            if not isinstance(item, dict):
                return (9999, 9999)
            pc = item.get("pozitie_cronologica", {}) or {}
            year = pc.get("an_aproximativ")
            if year is None:
                year = 9999
            frag = pc.get("fragment", "necunoscut")
            try:
                frag_num = int(str(frag).split("-")[0]) if frag != "necunoscut" else 9999
            except (ValueError, TypeError):
                frag_num = 9999
            return (year, frag_num)

        group.sort(key=chrono_key)
        earliest = group[0]
        pozitie = earliest.get("pozitie_cronologica", {}) if isinstance(earliest, dict) else {}

        result.append({
            "titlu": canonical,
            "surse": all_surse,
            "pozitie_cronologica": pozitie,
        })

    # Sort result chronologically
    def sort_key(item):
        pc = item.get("pozitie_cronologica", {}) or {}
        year = pc.get("an_aproximativ")
        if year is None:
            year = 9999
        frag = pc.get("fragment", "necunoscut")
        try:
            frag_num = int(str(frag).split("-")[0]) if frag != "necunoscut" else 9999
        except (ValueError, TypeError):
            frag_num = 9999
        return (year, frag_num)

    result.sort(key=sort_key)
    return result


def main():
    # 1. Read characters.json
    print("=" * 80)
    print("STEP 1: Loading characters.json")
    print("=" * 80)
    with open(CHARACTERS_PATH, "r", encoding="utf-8") as f:
        characters = json.load(f)
    print(f"  Total characters loaded: {len(characters)}")

    # 2. Backup
    print(f"\nSTEP 2: Creating backup at:")
    print(f"  {BACKUP_PATH}")
    BACKUP_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CHARACTERS_PATH, BACKUP_PATH)
    # Verify backup
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        backup_data = json.load(f)
    print(f"  Backup verified: {len(backup_data)} characters")
    del backup_data

    # 3. Re-deduplicate titles
    print(f"\nSTEP 3: Re-deduplicating titles for all {len(characters)} characters")
    print("=" * 80)
    
    stats = {
        "total_characters": len(characters),
        "characters_with_titles": 0,
        "characters_with_reduced_titles": 0,
        "total_titles_before": 0,
        "total_titles_after": 0,
        "changes": [],
    }
    
    for char in characters:
        old_titles = char.get("titles", [])
        if not old_titles:
            continue
        
        stats["characters_with_titles"] += 1
        stats["total_titles_before"] += len(old_titles)
        
        new_titles = deduplicate_titles(old_titles)
        stats["total_titles_after"] += len(new_titles)
        
        if len(new_titles) < len(old_titles):
            stats["characters_with_reduced_titles"] += 1
            old_names = [t.get("titlu", t) if isinstance(t, dict) else t for t in old_titles]
            new_names = [t.get("titlu", t) if isinstance(t, dict) else t for t in new_titles]
            removed = [t for t in old_names if t not in new_names]
            stats["changes"].append({
                "name": char.get("name", char.get("id")),
                "before": len(old_titles),
                "after": len(new_titles),
                "removed_or_merged": removed,
            })
        
        char["titles"] = new_titles
        # Update titlu_curent to last title chronologically
        if new_titles:
            char["titlu_curent"] = new_titles[-1]["titlu"]
        else:
            char["titlu_curent"] = None

    print(f"  Characters with titles: {stats['characters_with_titles']}")
    print(f"  Characters with REDUCED title count: {stats['characters_with_reduced_titles']}")
    print(f"  Total titles before: {stats['total_titles_before']}")
    print(f"  Total titles after:  {stats['total_titles_after']}")
    print(f"  Titles eliminated:   {stats['total_titles_before'] - stats['total_titles_after']}")
    
    if stats["changes"]:
        print(f"\n  Top changes (showing up to 30):")
        for ch in stats["changes"][:30]:
            print(f"    {ch['name']}: {ch['before']} -> {ch['after']} titles (merged/removed: {ch['removed_or_merged'][:5]})")

    # 4. Write back
    print(f"\nSTEP 4: Writing updated characters.json")
    print("=" * 80)
    with open(CHARACTERS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(characters, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  Written: {CHARACTERS_PATH}")

    # 5. VERIFY by re-reading from disk
    print(f"\nSTEP 5: VERIFICATION — Reading back from disk")
    print("=" * 80)
    with open(CHARACTERS_PATH, "r", encoding="utf-8") as f:
        verified = json.load(f)
    
    print(f"  Total characters in file: {len(verified)}")
    assert len(verified) == stats["total_characters"], \
        f"MISMATCH! Expected {stats['total_characters']}, got {len(verified)}"
    print(f"  ✓ Character count unchanged: {len(verified)}")
    
    # Check specific characters
    targets = ["Jon Arryn", "Catelyn Stark", "Eddard Stark"]
    for target_name in targets:
        char = None
        for c in verified:
            if c.get("name") == target_name:
                char = c
                break
        if not char:
            print(f"\n  ✗ {target_name}: NOT FOUND!")
            continue
        
        print(f"\n  ── {target_name} ──")
        print(f"  id: {char.get('id')}")
        print(f"  titlu_curent: {char.get('titlu_curent')!r}")
        titles = char.get("titles", [])
        print(f"  titles ({len(titles)} entries):")
        for i, t in enumerate(titles):
            if isinstance(t, dict):
                print(f"    [{i}] {t['titlu']!r}")
            else:
                print(f"    [{i}] {t!r}")
    
    # Check for Eyrie variants in Jon Arryn
    jon = None
    for c in verified:
        if c.get("name") == "Jon Arryn":
            jon = c
            break
    if jon:
        eyrie_titles = [t.get("titlu", "") for t in jon.get("titles", []) if isinstance(t, dict) and "eyrie" in t.get("titlu", "").lower()]
        print(f"\n  Jon Arryn Eyrie-related titles: {eyrie_titles}")
        if len(eyrie_titles) <= 1:
            print(f"  ✓ Eyrie variants successfully unified!")
        else:
            print(f"  ✗ Still has {len(eyrie_titles)} Eyrie variants")
    
    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Total characters: {len(verified)} (unchanged)")
    print(f"  Characters with reduced titles: {stats['characters_with_reduced_titles']}")
    print(f"  Total titles eliminated: {stats['total_titles_before'] - stats['total_titles_after']}")


if __name__ == "__main__":
    main()
