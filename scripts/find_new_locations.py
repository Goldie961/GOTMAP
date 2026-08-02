"""
Final comprehensive analysis - identify ALL true duplicates of existing map locations.
"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/_import/etl_output/id_map.json', 'r', encoding='utf-8') as f:
    id_map = json.load(f)

with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
    locations = json.load(f)

with open('data/locations/distances.json', 'r', encoding='utf-8') as f:
    distances = json.load(f)

with open('data/events/events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

with open('data/map/catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

world_coords = catalog.get('maps', {}).get('world', {}).get('coordinates', {})
loc_by_id = {loc['id']: loc for loc in locations}

# Enriched (already matched) locations
enriched = {k: v for k, v in id_map.items() 
            if v.get('collection') == 'locations' and v.get('status') == 'enrichment'}

# Get all original location IDs that were enrichment-matched
original_ids = {v['app_id'] for v in enriched.values()}

# New locations
new_locs = {k: v for k, v in id_map.items() 
            if v.get('collection') == 'locations' and v.get('status') == 'new'}

# CATEGORY 1: debarcaderul_regelui -> kings_landing (confirmed, Turnul Înalt -> oldtown pattern)
# These are locations where the Romanian name created a new entry instead of matching existing English one

# CATEGORY 2: Essos locations that have coordinates but are status "new" in id_map
# These seem to be from a different import and should be status "enrichment"
print("="*80)
print("ESSOS LOCATIONS: status=new but HAVE coordinates (should be enrichment)")
print("="*80)
for intern_key, v in sorted(new_locs.items()):
    app_id = v['app_id']
    if app_id in world_coords:
        print(f"  {intern_key} -> {app_id}")

# Now check: events.json location references that point to new/duplicate locations
print("\n" + "="*80)
print("EVENTS referencing debarcaderul_regelui or turnul_inalt")
print("="*80)
for evt in events:
    loc = evt.get('location')
    if loc and isinstance(loc, str) and loc in ('debarcaderul_regelui', 'turnul_inalt'):
        print(f"  Event: {evt['id'][:60]}... -> location={loc}")
    elif loc and isinstance(loc, list):
        for l in loc:
            if isinstance(l, str) and l in ('debarcaderul_regelui', 'turnul_inalt'):
                print(f"  Event: {evt['id'][:60]}... -> location list contains {l}")

# Count distances referencing debarcaderul_regelui
print("\n" + "="*80)
print("DISTANCES referencing debarcaderul_regelui or turnul_inalt")
print("="*80)
deb_count = 0
turn_count = 0
for d in distances:
    if d.get('location_a_id') == 'debarcaderul_regelui' or d.get('location_b_id') == 'debarcaderul_regelui':
        deb_count += 1
    if d.get('location_a_id') == 'turnul_inalt' or d.get('location_b_id') == 'turnul_inalt':
        turn_count += 1
print(f"  Distances referencing debarcaderul_regelui: {deb_count}")
print(f"  Distances referencing turnul_inalt: {turn_count}")

# Check winterfell<->kings_landing distance specifically
print("\n" + "="*80)
print("DISTANCES: winterfell <-> kings_landing (should find 2)")
print("="*80)
for d in distances:
    a = d.get('location_a_id', '')
    b = d.get('location_b_id', '')
    if ('winterfell' in (a,b) and 'kings_landing' in (a,b)):
        print(f"  FOUND: {a} <-> {b}")
        print(f"    {json.dumps(d, ensure_ascii=False)[:200]}")

# Check winterfell<->debarcaderul_regelui
print("\n" + "="*80)
print("DISTANCES: winterfell <-> debarcaderul_regelui")
print("="*80)
for d in distances:
    a = d.get('location_a_id', '')
    b = d.get('location_b_id', '')
    if ('winterfell' in (a,b) and 'debarcaderul_regelui' in (a,b)):
        print(f"  FOUND: {a} <-> {b}")
        print(f"    {json.dumps(d, ensure_ascii=False)[:300]}")

# Check if there are OTHER potential duplicates where a "new" location
# has an app_id that's the same as an enrichment app_id (suggesting dual-name)
print("\n" + "="*80)
print("CHECK: new locations whose app_id matches an enrichment app_id")
print("(These are 'new' entries that resolve to an already-matched original)")
print("="*80)
# We already know the enrichment locations, let's check if any "new" has the same app_id
for intern_key, v in sorted(new_locs.items()):
    app_id = v['app_id']
    if app_id in original_ids:
        print(f"  *** {intern_key} -> {app_id} (also matched by enrichment!)")
