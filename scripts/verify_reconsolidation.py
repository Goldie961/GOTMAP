#!/usr/bin/env python3
"""INDEPENDENT verification: read characters.json from disk and report."""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

PATH = r"c:\Users\andre\OneDrive\Desktop\GOT MAP\data\characters\characters.json"
BACKUP = r"c:\Users\andre\OneDrive\Desktop\GOT MAP\data\_import\etl_output\backups\characters.pre_sinonime_reale.json"

print("=" * 80)
print("INDEPENDENT VERIFICATION - Reading directly from disk")
print("=" * 80)

# Read current file
with open(PATH, "r", encoding="utf-8") as f:
    current = json.load(f)

# Read backup
with open(BACKUP, "r", encoding="utf-8") as f:
    backup = json.load(f)

print(f"\n1. Total characters in CURRENT characters.json: {len(current)}")
print(f"   Total characters in BACKUP (before):         {len(backup)}")
print(f"   Character count match: {'✓ YES' if len(current) == len(backup) else '✗ NO'}")

# Count title differences
backup_by_name = {c.get("name", c.get("id")): c for c in backup}
current_by_name = {c.get("name", c.get("id")): c for c in current}

total_before = 0
total_after = 0
changed = 0
for name, cur_char in current_by_name.items():
    bak_char = backup_by_name.get(name)
    if not bak_char:
        continue
    bak_count = len(bak_char.get("titles", []))
    cur_count = len(cur_char.get("titles", []))
    total_before += bak_count
    total_after += cur_count
    if cur_count < bak_count:
        changed += 1

print(f"\n2. Characters with reduced title count: {changed}")
print(f"   Total titles BEFORE: {total_before}")
print(f"   Total titles AFTER:  {total_after}")
print(f"   Titles eliminated:   {total_before - total_after}")

# Jon Arryn
print(f"\n{'=' * 80}")
print("3. DETAILED TITLE ARRAYS (read directly from characters.json on disk)")
print("=" * 80)

for target in ["Jon Arryn", "Catelyn Stark", "Eddard Stark"]:
    cur = current_by_name.get(target)
    bak = backup_by_name.get(target)
    if not cur:
        print(f"\n{target}: NOT FOUND")
        continue
    
    print(f"\n{'─' * 60}")
    print(f"  {target} (id: {cur.get('id')})")
    print(f"{'─' * 60}")
    
    bak_titles = [t.get("titlu", t) if isinstance(t, dict) else t for t in (bak or {}).get("titles", [])]
    cur_titles = [t.get("titlu", t) if isinstance(t, dict) else t for t in cur.get("titles", [])]
    
    print(f"  BEFORE ({len(bak_titles)} titles):")
    for i, t in enumerate(bak_titles):
        print(f"    [{i}] {t!r}")
    
    print(f"  AFTER ({len(cur_titles)} titles):")
    for i, t in enumerate(cur_titles):
        print(f"    [{i}] {t!r}")
    
    print(f"  titlu_curent: {cur.get('titlu_curent')!r}")
    
    # Highlight merged titles
    removed = [t for t in bak_titles if t not in cur_titles]
    if removed:
        print(f"  MERGED/REMOVED: {removed}")

# Specific check: Jon Arryn Eyrie variants
print(f"\n{'=' * 80}")
print("4. SPECIFIC CHECK: Jon Arryn Eyrie variants")
print("=" * 80)
jon_bak = backup_by_name.get("Jon Arryn", {})
jon_cur = current_by_name.get("Jon Arryn", {})

bak_eyrie = [t.get("titlu", "") for t in jon_bak.get("titles", []) if isinstance(t, dict) and "eyrie" in t.get("titlu", "").lower()]
cur_eyrie = [t.get("titlu", "") for t in jon_cur.get("titles", []) if isinstance(t, dict) and "eyrie" in t.get("titlu", "").lower()]

print(f"  BEFORE: {bak_eyrie}")
print(f"  AFTER:  {cur_eyrie}")
if len(cur_eyrie) == 1:
    print(f"  ✓ Jon Arryn now has exactly 1 Eyrie title: {cur_eyrie[0]!r}")
else:
    print(f"  ✗ Jon Arryn still has {len(cur_eyrie)} Eyrie variants")

# Catelyn Winterfell check
print(f"\n{'=' * 80}")
print("5. SPECIFIC CHECK: Catelyn Stark Winterfell/Doamna variants")
print("=" * 80)
cat_bak = backup_by_name.get("Catelyn Stark", {})
cat_cur = current_by_name.get("Catelyn Stark", {})

bak_wf = [t.get("titlu", "") for t in cat_bak.get("titles", []) if isinstance(t, dict) and ("winterfell" in t.get("titlu", "").lower() or "doamna" in t.get("titlu", "").lower())]
cur_wf = [t.get("titlu", "") for t in cat_cur.get("titles", []) if isinstance(t, dict) and ("winterfell" in t.get("titlu", "").lower() or "doamna" in t.get("titlu", "").lower())]

print(f"  BEFORE: {bak_wf}")
print(f"  AFTER:  {cur_wf}")

print(f"\n{'=' * 80}")
print("VERIFICATION COMPLETE")
print("=" * 80)
