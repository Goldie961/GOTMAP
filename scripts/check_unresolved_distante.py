import sys
import json
import glob
import re
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

def norm(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '', text)

with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
    locations = json.load(f)

with open('data/_import/statements_distante.json', 'r', encoding='utf-8') as f:
    statements = json.load(f)

# Index locations.json by various keys
loc_by_id = {}
loc_by_id_intern = {}
loc_by_norm = {}

for loc in locations:
    loc_id = loc.get('id')
    loc_intern = loc.get('id_intern')
    name = loc.get('name')
    nume_canonic = loc.get('nume_canonic')
    aliases = loc.get('aliasuri', [])
    
    if loc_id:
        loc_by_id[loc_id] = loc
        loc_by_norm[norm(loc_id)] = loc
    if loc_intern:
        loc_by_id_intern[loc_intern] = loc
        loc_by_norm[norm(loc_intern)] = loc
    if name:
        loc_by_norm[norm(name)] = loc
    if nume_canonic:
        loc_by_norm[norm(nume_canonic)] = loc
    for a in aliases:
        if a:
            loc_by_norm[norm(a)] = loc

print(f"Total locations: {len(locations)}")

# Also load entities
entities = {}
for p in sorted(glob.glob('data/_import/entities_part*.json')):
    with open(p, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            entities[item['id']] = item

# Function to resolve a statement location ID string (e.g., 'LOCATION_WINTERFELL')
def resolve_location(loc_str):
    if not loc_str:
        return None
    # 1. Direct id_intern match
    if loc_str in loc_by_id_intern:
        return loc_by_id_intern[loc_str]
    # 2. Direct id match (e.g. without LOCATION_)
    clean_id = loc_str.replace('LOCATION_', '').lower()
    if clean_id in loc_by_id:
        return loc_by_id[clean_id]
    # 3. Normalized string match on loc_str
    if norm(loc_str) in loc_by_norm:
        return loc_by_norm[norm(loc_str)]
    # 4. Check entities.json for entity with ID = loc_str
    ent = entities.get(loc_str)
    if ent:
        e_name = ent.get('nume_canonic')
        if e_name and norm(e_name) in loc_by_norm:
            return loc_by_norm[norm(e_name)]
        for e_alias in ent.get('aliasuri', []):
            if norm(e_alias) in loc_by_norm:
                return loc_by_norm[norm(e_alias)]
    return None

resolved_count = 0
unresolved_pairs = []

unresolved_loc_ids = set()

for idx, stmt in enumerate(statements):
    loc_a = stmt.get('location_a')
    loc_b = stmt.get('location_b')
    res_a = resolve_location(loc_a)
    res_b = resolve_location(loc_b)
    
    if res_a and res_b:
        resolved_count += 1
    else:
        unresolved_pairs.append((idx, loc_a, res_a is not None, loc_b, res_b is not None))
        if not res_a:
            unresolved_loc_ids.add(loc_a)
        if not res_b:
            unresolved_loc_ids.add(loc_b)

print(f"Successfully resolved statement pairs: {resolved_count} / {len(statements)}")
print(f"Unresolved location IDs ({len(unresolved_loc_ids)}): {sorted(unresolved_loc_ids)}")
