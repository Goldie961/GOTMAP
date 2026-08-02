import json

chars = json.load(open(r'c:\Users\andre\OneDrive\Desktop\GOT MAP\data\characters\characters.json', 'r', encoding='utf-8'))
ids = {c['id'] for c in chars if 'id' in c}

targets = ['bran_stark', 'rickon_stark', 'baela_targaryen', 'rhaena_targaryen', 'penny', 'oppo']
for t in targets:
    found = "EXISTS" if t in ids else "NOT FOUND"
    print(f'{t}: {found}')

# Also search fuzzy
for t in ['baela', 'rhaena', 'penny', 'oppo', 'tatal_lui']:
    matches = [cid for cid in ids if t in cid]
    print(f'  IDs containing "{t}": {matches[:5]}')

# Now also find ALL compound-like broken refs (both _SI_ and ones that look like concatenated names)
rel_fields = ['parinti', 'copii', 'frati', 'casatorit_cu', 'membru_al', 'member_of']
all_compound = set()
for char in chars:
    char_id = char.get('id', '')
    for field in rel_fields:
        vals = char.get(field, [])
        if isinstance(vals, list):
            for v in vals:
                if isinstance(v, str) and v.startswith('PERSON_'):
                    resolved = v[7:].lower()  # strip PERSON_
                    if resolved not in ids:
                        all_compound.add(v)

print(f"\nAll broken PERSON_ refs in relation fields:")
for v in sorted(all_compound):
    print(f"  {v}")
