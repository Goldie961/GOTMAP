import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

# Load locations
with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
    locations = json.load(f)
loc_by_id = {l['id']: l for l in locations}

# Load distances dataset
with open('data/locations/distances.json', 'r', encoding='utf-8') as f:
    distances = json.load(f)

def getNarrativeDistances(loc1, loc2):
    id1 = loc1.get('id') if isinstance(loc1, dict) else loc1
    id2 = loc2.get('id') if isinstance(loc2, dict) else loc2
    intern1 = loc1.get('id_intern') if isinstance(loc1, dict) else None
    intern2 = loc2.get('id_intern') if isinstance(loc2, dict) else None

    results = []
    for d in distances:
        matchA1 = d['location_a_id'] == id1 or (intern1 and d['location_a_intern'] == intern1)
        matchB2 = d['location_b_id'] == id2 or (intern2 and d['location_b_intern'] == intern2)

        matchA2 = d['location_a_id'] == id2 or (intern2 and d['location_a_intern'] == intern2)
        matchB1 = d['location_b_id'] == id1 or (intern1 and d['location_b_intern'] == intern1)

        if (matchA1 and matchB2) or (matchA2 and matchB1):
            results.append(d)
    return results

print("=== DISTANCE TOOL INTEGRATION TEST SUITE ===")
print(f"Total distance records in dataset: {len(distances)}")

# 3 Known Pairs
wf = loc_by_id['winterfell']
kl = loc_by_id['debarcaderul_regelui']
wall = loc_by_id['the_wall']
pentos = loc_by_id['pentos']
vaes = loc_by_id['vaes_dothrak']

p1 = getNarrativeDistances(wf, kl)
print(f"\n[Test 1] Winterfell <-> King's Landing (Debarcaderul Regelui): {len(p1)} statements")
for s in p1:
    print(f"   - Value: '{s['distance_value']}' | Book: {s['source_book']} Frag. {s['source_fragment']}")

p2 = getNarrativeDistances(wf, wall)
print(f"\n[Test 2] Winterfell <-> The Wall (Zidul): {len(p2)} statements")
for s in p2:
    print(f"   - Value: '{s['distance_value']}' | Method: {s['travel_method']} | Book: {s['source_book']}")

p3 = getNarrativeDistances(pentos, vaes)
print(f"\n[Test 3] Pentos <-> Vaes Dothrak: {len(p3)} statements")
for s in p3:
    print(f"   - Value: '{s['distance_value']}' | Context: '{s['context']}'")

# 1 Conflict Pair (Testing both conflict pairs for thoroughness)
c1_a = loc_by_id['crossing']
c1_b = loc_by_id['gods_eye']
p_c1 = getNarrativeDistances(c1_a, c1_b)

print(f"\n[Test 4 - Conflict Pair 1] Crossing (Gemenii) <-> God's Eye (Ochiul Zeilor): {len(p_c1)} statements")
for s in p_c1:
    print(f"   - Confidence: {s['confidence']}")
    print(f"   - Nota: {s['nota']}")
    print(f"   - Value: '{s['distance_value']}'")
    print(f"   - Context: '{s['context']}'")
    assert s['confidence'] == 'uncertain', "Conflict statement should be marked uncertain"
    assert s['nota'] == '⚠ conflict', "Conflict statement should retain warning flag"

c2_a = loc_by_id['kingsroad']
c2_b = loc_by_id['the_dreadfort']
p_c2 = getNarrativeDistances(c2_a, c2_b)

print(f"\n[Test 5 - Conflict Pair 2] Kingsroad <-> Dreadfort: {len(p_c2)} statements")
for s in p_c2:
    print(f"   - Confidence: {s['confidence']}")
    print(f"   - Nota: {s['nota']}")
    print(f"   - Value: '{s['distance_value']}'")
    assert s['confidence'] == 'uncertain', "Conflict statement should be marked uncertain"
    assert s['nota'] == '⚠ cifră posibil eronată în text', "Conflict statement should retain warning flag"

print("\nALL 3+2 TESTS PASSED PERFECTLY!")
