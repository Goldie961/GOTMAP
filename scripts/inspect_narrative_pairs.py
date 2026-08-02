import json
from collections import defaultdict
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/_import/statements_distante.json', 'r', encoding='utf-8') as f:
    statements = json.load(f)

# Load mapped locations
with open('scripts/check_unresolved_distante.py') as f:
    exec(f.read()) # runs resolution logic

pair_counts = defaultdict(list)

for stmt in statements:
    la = stmt.get('location_a')
    lb = stmt.get('location_b')
    res_a = resolve_location(la)
    res_b = resolve_location(lb)
    name_a = res_a.get('name') if res_a else la
    name_b = res_b.get('name') if res_b else lb
    
    key = tuple(sorted([name_a, name_b]))
    pair_counts[key].append(stmt)

print("\n--- TOP PAIRS IN NARRATIVE DISTANCES ---")
for pair, stmts in sorted(pair_counts.items(), key=lambda x: len(x[1]), reverse=True)[:15]:
    print(f"{pair[0]} <-> {pair[1]}: {len(stmts)} statements")
    for s in stmts:
        print(f"   - [{s.get('confidence')}] {s.get('distance_value')} | Book: {s.get('source_book')}")

print("\n--- UNCERTAIN / CONFLICT PAIRS ---")
for stmt in statements:
    if stmt.get('confidence') == 'uncertain' or stmt.get('nota'):
        la = stmt.get('location_a')
        lb = stmt.get('location_b')
        res_a = resolve_location(la)
        res_b = resolve_location(lb)
        name_a = res_a.get('name') if res_a else la
        name_b = res_b.get('name') if res_b else lb
        print(f"Conflict pair: {name_a} ({la}) <-> {name_b} ({lb})")
        print(f"   Details: {stmt}")
