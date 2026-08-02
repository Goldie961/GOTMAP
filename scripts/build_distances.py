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

# Load locations.json
with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
    locations = json.load(f)

# Load statements_distante.json
with open('data/_import/statements_distante.json', 'r', encoding='utf-8') as f:
    statements = json.load(f)

# Load entities
entities = {}
for p in sorted(glob.glob('data/_import/entities_part*.json')):
    with open(p, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            entities[item['id']] = item

# Index locations.json
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

def resolve_location(loc_str):
    if not loc_str:
        return None
    if loc_str in loc_by_id_intern:
        return loc_by_id_intern[loc_str]
    clean_id = loc_str.replace('LOCATION_', '').lower()
    if clean_id in loc_by_id:
        return loc_by_id[clean_id]
    if norm(loc_str) in loc_by_norm:
        return loc_by_norm[norm(loc_str)]
    ent = entities.get(loc_str)
    if ent:
        e_name = ent.get('nume_canonic')
        if e_name and norm(e_name) in loc_by_norm:
            return loc_by_norm[norm(e_name)]
        for e_alias in ent.get('aliasuri', []):
            if norm(e_alias) in loc_by_norm:
                return loc_by_norm[norm(e_alias)]
    return None

transformed = []
successful_resolutions = 0
failed_resolutions = []

for idx, stmt in enumerate(statements):
    la_raw = stmt.get('location_a')
    lb_raw = stmt.get('location_b')
    
    loc_a = resolve_location(la_raw)
    loc_b = resolve_location(lb_raw)
    
    if loc_a and loc_b:
        successful_resolutions += 1
        record = {
            "id": f"dist_{idx+1}",
            "location_a_id": loc_a.get('id'),
            "location_a_intern": la_raw,
            "location_a_name": loc_a.get('name'),
            "location_b_id": loc_b.get('id'),
            "location_b_intern": lb_raw,
            "location_b_name": loc_b.get('name'),
            "distance_value": stmt.get('distance_value'),
            "direction": stmt.get('direction'),
            "travel_method": stmt.get('travel_method'),
            "context": stmt.get('context'),
            "approx": stmt.get('approx', False),
            "source_book": stmt.get('source_book'),
            "source_fragment": stmt.get('source_fragment'),
            "source_page": stmt.get('source_page'),
            "confidence": stmt.get('confidence', 'confirmed'),
            "nota": stmt.get('nota')
        }
        transformed.append(record)
    else:
        failed_resolutions.append((idx, la_raw, loc_a is not None, lb_raw, loc_b is not None))

print(f"Transformation summary:")
print(f"Total input statements: {len(statements)}")
print(f"Successfully resolved & transformed: {successful_resolutions} / {len(statements)}")
print(f"Failed resolutions count: {len(failed_resolutions)}")

with open('data/locations/distances.json', 'w', encoding='utf-8') as f:
    json.dump(transformed, f, ensure_ascii=False, indent=2)

print(f"Saved transformed dataset to data/locations/distances.json")
