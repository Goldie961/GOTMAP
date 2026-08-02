import json
import re

def svg_path_to_points(path):
    """Extract the M/L vertices used by the hand-calibrated region paths."""
    tokens = re.findall(r'[MLZ]|-?(?:\d+\.?\d*|\.\d+)', path, re.IGNORECASE)
    points = []
    index = 0
    while index < len(tokens):
        command = tokens[index].upper()
        index += 1
        if command == 'Z':
            break
        if command not in ('M', 'L') or index + 1 >= len(tokens):
            return []
        points.append((float(tokens[index]), float(tokens[index + 1])))
        index += 2
    return points

def is_point_in_polygon(x, y, polygon):
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def main():
    # Load westeros locations
    with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
        westeros_locs = json.load(f)
        
    # Load essos locations
    with open('data/essos/free_cities.json', 'r', encoding='utf-8') as f:
        free_cities_locs = json.load(f)
    with open('data/essos/far_lands.json', 'r', encoding='utf-8') as f:
        far_lands_locs = json.load(f)
        
    all_locations = []
    for loc in westeros_locs:
        all_locations.append({
            'id': loc['id'],
            'name': loc['name'],
            'continent': 'westeros',
            'region': loc.get('region'),
            'coordinates': loc.get('coordinates')
        })
    for loc in free_cities_locs:
        all_locations.append({
            'id': loc['id'],
            'name': loc['name'],
            'continent': 'essos',
            'region': loc.get('region'),
            'coordinates': loc.get('coordinates')
        })
    for loc in far_lands_locs:
        all_locations.append({
            'id': loc['id'],
            'name': loc['name'],
            'continent': 'essos', # or far_lands
            'region': loc.get('region'),
            'coordinates': loc.get('coordinates')
        })
        
    # Load regions
    with open('data/map/regions.json', 'r', encoding='utf-8') as f:
        regions_data = json.load(f)
        
    regions = {}
    for r in regions_data['regions']:
        regions[r['id']] = {
            'name': r['name'],
            'vertices': svg_path_to_points(r['path'])
        }
        
    print(f"Loaded {len(all_locations)} total locations and {len(regions)} regions.")
    
    mismatches = []
    matched_count = 0
    not_in_any = 0
    
    # Island exclusions (expected to be outside the main land polygons)
    island_exclusions = {
        'bear_island', 'arbor', 'claw_isle', 'dragonstone', 'driftmark', 'pyke', 
        'tarth', 'skagos', 'lys', 'tyrosh', 'lorath', 'gogossos'
    }
    
    for loc in all_locations:
        loc_id = loc['id']
        loc_name = loc['name']
        expected_region = loc['region']
        continent = loc['continent']
        coords = loc['coordinates']
        
        if not coords or 'x' not in coords or 'y' not in coords:
            continue
            
        x, y = coords['x'], coords['y']
        
        # Determine actual region
        actual_region = None
        for r_id, r_info in regions.items():
            if is_point_in_polygon(x, y, r_info['vertices']):
                actual_region = r_id
                break
                
        if actual_region == expected_region:
            matched_count += 1
        else:
            if not actual_region:
                not_in_any += 1
            # Check if this is an expected island exclusion
            is_excluded = loc_id in island_exclusions
            mismatches.append({
                'id': loc_id,
                'name': loc_name,
                'continent': continent,
                'expected': expected_region,
                'actual': actual_region,
                'x': x,
                'y': y,
                'is_excluded': is_excluded
            })
            
    print(f"Matched: {matched_count}")
    print(f"Mismatches: {len(mismatches)}")
    
    westeros_mismatches = [m for m in mismatches if m['continent'] == 'westeros']
    essos_mismatches = [m for m in mismatches if m['continent'] != 'westeros']
    
    print("\nWesteros Mismatches:")
    for m in westeros_mismatches:
        status = "EXCLUDED ISLAND" if m['is_excluded'] else "ERROR"
        print(f"  [{status}] {m['name']} ({m['id']}): expected={m['expected']}, actual={m['actual']} at ({m['x']}, {m['y']})")
        
    print("\nEssos/Far Lands Mismatches:")
    for m in essos_mismatches:
        status = "EXCLUDED ISLAND" if m['is_excluded'] else "ERROR"
        print(f"  [{status}] {m['name']} ({m['id']}): expected={m['expected']}, actual={m['actual']} at ({m['x']}, {m['y']})")

if __name__ == '__main__':
    main()
