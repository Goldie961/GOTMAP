import json, sys, os, shutil
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = 'data/_import/etl_output/backups'
os.makedirs(BACKUP_DIR, exist_ok=True)

# ============================================================
# 1. LOAD ALL DATA
# ============================================================
print('='*60)
print('LOADING DATA FILES')
print('='*60)

with open('data/locations/locations.json', 'r', encoding='utf-8') as f:
    locations = json.load(f)
loc_by_id = {}
for l in locations:
    loc_by_id[l['id']] = l
print(f'locations.json: {len(locations)} entries')

with open('data/locations/distances.json', 'r', encoding='utf-8') as f:
    distances = json.load(f)
print(f'distances.json: {len(distances)} entries')

with open('data/events/events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)
print(f'events.json: {len(events)} entries')

with open('data/_import/etl_output/id_map.json', 'r', encoding='utf-8') as f:
    id_map = json.load(f)
print(f'id_map.json: {len(id_map)} entries')

# ============================================================
# 2. DEFINE MERGE PAIRS
# ============================================================
print('\n' + '='*60)
print('DEFINING MERGE PAIRS')
print('='*60)

# (source_id, target_id, reason)
merge_pairs = [
    ('debarcaderul_regelui', 'kings_landing', 'Romanian name of King\'s Landing, 61 events and 38 descriptions stranded'),
    ('debarcaderul_regelui_fortareata_rosie', 'kings_landing', 'Combined reference King\'s Landing + Red Keep, no separate red_keep location'),
    ('turnul_inalt', 'oldtown_city', 'Romanian name of Hightower (part of Oldtown), 1 event and 3 descriptions stranded'),
    ('vechiul_oras_oldtown', 'oldtown_city', 'Romanian name Oldtown, duplicate of main Oldtown entry'),
    ('sfarsitul_furtunii', 'storm_end', 'Romanian name of Storm\'s End, stranded narrative content'),
    ('fortareata_rosie', 'kings_landing', 'Red Keep is part of King\'s Landing, no separate red_keep location, 40 events and 43 descriptions stranded'),
]

for src, tgt, reason in merge_pairs:
    src_loc = loc_by_id.get(src)
    tgt_loc = loc_by_id.get(tgt)
    print(f'  {src} -> {tgt}')
    print(f'    Source exists: {bool(src_loc)}, Target exists: {bool(tgt_loc)}')
    print(f'    Reason: {reason}')
    if src_loc:
        has_coords = 'coordinates' in src_loc
        print(f'    Source: evts={len(src_loc.get("evenimente",[]))}, desc={len(src_loc.get("descriere_fizica",[]))}, coords={has_coords}')
    if tgt_loc:
        has_coords = 'coordinates' in tgt_loc
        print(f'    Target: evts={len(tgt_loc.get("evenimente",[]))}, desc={len(tgt_loc.get("descriere_fizica",[]))}, coords={has_coords}')

# ============================================================
# 3. DEFINE 20 ESSOS LOCATIONS FOR STATUS UPDATE
# ============================================================
essos_locs = [
    'astapor', 'braavos', 'volantis', 'meereen', 'pentos',
    'tyrosh', 'myr', 'lys', 'qohor', 'norvos', 'lorath',
    'elysen', 'portul_ibben', 'selhorys', 'valysar', 'volon_therys',
    'vechiul_volantis', 'qarth', 'noul_ghis', 'vechiul_ghis'
]
print(f'\nEssos locations for status update: {len(essos_locs)}')

# ============================================================
# 4. PERFORM MERGES
# ============================================================
print('\n' + '='*60)
print('PERFORMING MERGES')
print('='*60)

merge_stats = {
    'events_merged': 0,
    'desc_merged': 0,
    'aliases_added': 0,
    'id_intern_added': 0,
    'predicates_merged': 0,
    'distances_updated': 0,
    'events_updated': 0,
    'id_map_updated': 0,
}

for src_id, tgt_id, _ in merge_pairs:
    src = loc_by_id.get(src_id)
    tgt = loc_by_id.get(tgt_id)
    if not src or not tgt:
        print(f'  SKIP {src_id} -> {tgt_id}: source or target not found')
        continue
    
    print(f'\n  --- Merging {src_id} -> {tgt_id} ---')
    
    # 4a. Merge evenimente
    src_events = src.get('evenimente', []) or []
    tgt_events = tgt.get('evenimente', []) or []
    if src_events:
        # Deduplicate by checking for overlapping event titles/text
        tgt_texts = set()
        for e in tgt_events:
            if isinstance(e, dict):
                tgt_texts.add(str(e.get('nume', e.get('text', ''))))
        for e in src_events:
            if isinstance(e, dict):
                key = str(e.get('nume', e.get('text', '')))
                if key not in tgt_texts:
                    tgt_events.append(e)
                    tgt_texts.add(key)
            else:
                if str(e) not in tgt_texts:
                    tgt_events.append(e)
                    tgt_texts.add(str(e))
        tgt['evenimente'] = tgt_events
        merge_stats['events_merged'] += len(tgt_events) - len(src_events)
        print(f'    evenimente: {len(src_events)} source -> {len(tgt_events)} total')
    
    # 4b. Merge descriere_fizica
    src_desc = src.get('descriere_fizica', []) or []
    tgt_desc = tgt.get('descriere_fizica', []) or []
    if src_desc:
        tgt_desc_set = set(str(d) for d in tgt_desc)
        for d in src_desc:
            if str(d) not in tgt_desc_set:
                tgt_desc.append(d)
                tgt_desc_set.add(str(d))
        tgt['descriere_fizica'] = tgt_desc
        merge_stats['desc_merged'] += len(src_desc)
        print(f'    descriere_fizica: {len(src_desc)} source -> {len(tgt_desc)} total')
    
    # 4c. Merge aliasuri
    src_aliases = src.get('aliasuri', []) or []
    tgt_aliases = tgt.get('aliasuri', []) or []
    if src_aliases:
        tgt_alias_set = set(str(a) for a in tgt_aliases)
        for a in src_aliases:
            if str(a) not in tgt_alias_set:
                tgt_aliases.append(a)
                tgt_alias_set.add(str(a))
        tgt['aliasuri'] = tgt_aliases
        merge_stats['aliases_added'] += len(src_aliases)
        print(f'    aliasuri: {len(src_aliases)} source -> {len(tgt_aliases)} total')
    
    # 4d. Add id_intern
    src_intern = src.get('id_intern')
    tgt_intern = tgt.get('id_intern')
    if src_intern and not tgt_intern:
        tgt['id_intern'] = src_intern
        merge_stats['id_intern_added'] += 1
        print(f'    id_intern added: {src_intern}')
    elif src_intern and tgt_intern and src_intern not in (tgt_intern or []):
        # Store as additional intern ID - could add to a list or to aliases
        if isinstance(tgt_intern, str):
            # If target has a single id_intern, convert to list
            tgt['id_intern'] = [tgt_intern, src_intern]
        elif isinstance(tgt_intern, list) and src_intern not in tgt_intern:
            tgt['id_intern'].append(src_intern)
        print(f'    id_intern preserved: target={tgt_intern}, additional={src_intern}')
    
    # 4e. Merge _afirmatii_pe_predicat
    src_pred = src.get('_afirmatii_pe_predicat', {}) or {}
    tgt_pred = tgt.get('_afirmatii_pe_predicat', {}) or {}
    if src_pred:
        for key, val in src_pred.items():
            if key not in tgt_pred:
                tgt_pred[key] = val
            elif isinstance(tgt_pred[key], list) and isinstance(val, list):
                existing = set(str(x) for x in tgt_pred[key])
                for v in val:
                    if str(v) not in existing:
                        tgt_pred[key].append(v)
                        existing.add(str(v))
        tgt['_afirmatii_pe_predicat'] = tgt_pred
        merge_stats['predicates_merged'] += 1
        print(f'    _afirmatii_pe_predicat merged')
    
    # 4f. Merge relatii
    src_rel = src.get('relatii', []) or []
    tgt_rel = tgt.get('relatii', []) or []
    if src_rel:
        tgt_rel_strs = set(str(r) for r in tgt_rel)
        for r in src_rel:
            if str(r) not in tgt_rel_strs:
                tgt_rel.append(r)
                tgt_rel_strs.add(str(r))
        tgt['relatii'] = tgt_rel
        print(f'    relatii: {len(src_rel)} source -> {len(tgt_rel)} total')
    
    # 4g. Merge coordinates (keep target if exists)
    if 'coordinates' not in tgt and 'coordinates' in src:
        tgt['coordinates'] = src.get('coordinates')
        tgt['sursa_coordonate'] = src.get('sursa_coordonate', '')
        print(f'    coordinates transferred from source')
    
    # 4h. Merge descriere_narativa/istorie if present
    for field in ['descriere_narativa', 'istorie']:
        src_val = src.get(field)
        tgt_val = tgt.get(field)
        if src_val and not tgt_val:
            tgt[field] = src_val
            print(f'    {field} transferred')

print('\nMerge stats so far:')
for k, v in merge_stats.items():
    print(f'  {k}: {v}')

# ============================================================
# 5. UPDATE DISTANCES.JSON
# ============================================================
print('\n' + '='*60)
print('UPDATING distances.json')
print('='*60)

src_to_tgt = {src: tgt for src, tgt, _ in merge_pairs}

distance_updates = 0
for dd in distances:
    for key in ['location_a_id', 'location_b_id']:
        val = dd.get(key)
        if val in src_to_tgt:
            dd[key] = src_to_tgt[val]
            distance_updates += 1

print(f'Distance entries updated: {distance_updates}')
merge_stats['distances_updated'] = distance_updates

# ============================================================
# 6. UPDATE EVENTS.JSON
# ============================================================
print('\n' + '='*60)
print('UPDATING events.json')
print('='*60)

event_updates = 0
for ev in events:
    loc = ev.get('location')
    if loc in src_to_tgt:
        ev['location'] = src_to_tgt[loc]
        event_updates += 1

print(f'Events updated: {event_updates}')
merge_stats['events_updated'] = event_updates

# ============================================================
# 7. UPDATE ID_MAP.JSON
# ============================================================
print('\n' + '='*60)
print('UPDATING id_map.json')
print('='*60)

# 7a. Update merge pairs
id_map_updates = 0
for src_id, tgt_id, _ in merge_pairs:
    for k, v in id_map.items():
        if v.get('collection') == 'locations' and v.get('app_id') == src_id:
            old_status = v.get('status')
            v['status'] = 'enrichment'
            v['app_id'] = tgt_id
            if 'candidates' not in v or not v['candidates']:
                v['candidates'] = [tgt_id]
            id_map_updates += 1
            print(f'  id_map key {k}: status {old_status} -> enrichment, app_id {src_id} -> {tgt_id}')

print(f'id_map entries updated for merge pairs: {id_map_updates}')

# 7b. Update 20 Essos locations
essos_updates = 0
for k, v in id_map.items():
    if v.get('collection') == 'locations' and v.get('status') == 'new' and v.get('app_id') in essos_locs:
        v['status'] = 'enrichment'
        essos_updates += 1

print(f'Essos locations updated to enrichment: {essos_updates}')

# ============================================================
# 8. DELETE DUPLICATE LOCATIONS
# ============================================================
print('\n' + '='*60)
print('DELETING DUPLICATE LOCATIONS')
print('='*60)

src_ids = set(src for src, _, _ in merge_pairs)
new_locations = [l for l in locations if l['id'] not in src_ids]
deleted_count = len(locations) - len(new_locations)
print(f'Locations before: {len(locations)}, after: {len(new_locations)}, deleted: {deleted_count}')

# ============================================================
# 9. SAVE ALL FILES
# ============================================================
print('\n' + '='*60)
print('SAVING FILES')
print('='*60)

with open('data/locations/locations.json', 'w', encoding='utf-8') as f:
    json.dump(new_locations, f, indent=2, ensure_ascii=False)
print('locations.json saved')

with open('data/locations/distances.json', 'w', encoding='utf-8') as f:
    json.dump(distances, f, indent=2, ensure_ascii=False)
print('distances.json saved')

with open('data/events/events.json', 'w', encoding='utf-8') as f:
    json.dump(events, f, indent=2, ensure_ascii=False)
print('events.json saved')

with open('data/_import/etl_output/id_map.json', 'w', encoding='utf-8') as f:
    json.dump(id_map, f, indent=2, ensure_ascii=False)
print('id_map.json saved')

# ============================================================
# 10. REPORT
# ============================================================
print('\n' + '='*60)
print('MERGE REPORT')
print('='*60)
print(f'Locations deleted: {deleted_count}')
print(f'Distance references updated: {distance_updates}')
print(f'Event references updated: {event_updates}')
print(f'id_map entries updated: {id_map_updates}')
print(f'Essos status updates: {essos_updates}')

# ============================================================
# 11. VERIFY KEY TEST: winterfell - kings_landing distances
# ============================================================
print('\n' + '='*60)
print('VERIFICATION: Winterfell <-> King\'s Landing distances')
print('='*60)

count_wl_kl = 0
for dd in distances:
    if dd.get('location_a_id') == 'winterfell' and dd.get('location_b_id') == 'kings_landing':
        count_wl_kl += 1
        print(f'  FOUND: {json.dumps(dd, ensure_ascii=False)}')
    elif dd.get('location_a_id') == 'kings_landing' and dd.get('location_b_id') == 'winterfell':
        count_wl_kl += 1
        print(f'  FOUND: {json.dumps(dd, ensure_ascii=False)}')

print(f'Total winterfell <-> kings_landing distances: {count_wl_kl}')

# Verify deleted locations no longer exist
print('\n' + '='*60)
print('VERIFICATION: Deleted locations absent')
print('='*60)
all_ids = [l['id'] for l in new_locations]
for src_id, _, _ in merge_pairs:
    exists = src_id in all_ids
    print(f'  {src_id}: {"STILL EXISTS (ERROR!)" if exists else "CORRECTLY DELETED"}')

# Verify events with updated locations
print('\n' + '='*60)
print('VERIFICATION: Events with updated locations')
print('='*60)
for ev in events:
    loc = ev.get('location')
    if loc == 'kings_landing':
        print(f'  Event location=king_landing: {json.dumps(ev, ensure_ascii=False)[:100]}')

print('\nDONE')
