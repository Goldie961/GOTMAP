import json, sys

sys.stdout.reconfigure(encoding='utf-8')

l = json.load(open('data/locations/locations.json','r',encoding='utf-8'))
print('=== LOCATION COUNT CHANGE ===')
print('Before: 1071, After: ' + str(len(l)) + ', Deleted: 6')

deleted_ids = ['debarcaderul_regelui','debarcaderul_regelui_fortareata_rosie',
               'turnul_inalt','vechiul_oras_oldtown','sfarsitul_furtunii','fortareata_rosie']
all_ids = [x['id'] for x in l]
for did in deleted_ids:
    assert did not in all_ids, did + ' still exists!'
print('All 6 duplicate IDs confirmed removed.')

n = json.load(open('data/_import/etl_output/duplicate_locations_needecise.json','r',encoding='utf-8'))
print('Uncertain cases in needecise: ' + str(len(n)) + ' entries')

d = json.load(open('data/locations/distances.json','r',encoding='utf-8'))
wl_kl = [x for x in d if {x.get('location_a_id'),x.get('location_b_id')} == {'winterfell','kings_landing'}]
print('Winterfell-KingsLanding distances: ' + str(len(wl_kl)))
for dd in d:
    for k in ['location_a_id','location_b_id']:
        assert dd[k] not in deleted_ids, 'distances still has ' + str(dd[k])
print('All distance references cleaned.')

ev = json.load(open('data/events/events.json','r',encoding='utf-8'))
ev_kl = [x for x in ev if x.get('location')=='kings_landing']
print('Events with location=kings_landing: ' + str(len(ev_kl)))
assert len(ev_kl) >= 3, 'Expected >=3 KL events'
for x in ev:
    loc = x.get('location')
    assert loc not in deleted_ids, 'events still has ' + str(loc)
print('All event references cleaned.')

kl = [x for x in l if x['id']=='kings_landing'][0]
print('King\'s Landing now has: ' + str(len(kl.get('evenimente',[]))) + ' events, ' + str(len(kl.get('descriere_fizica',[]))) + ' descriptions, ' + str(len(kl.get('aliasuri',[]))) + ' aliases')

ot = [x for x in l if x['id']=='oldtown_city'][0]
print('Oldtown now has: ' + str(len(ot.get('evenimente',[]))) + ' events, ' + str(len(ot.get('descriere_fizica',[]))) + ' descriptions, ' + str(len(ot.get('aliasuri',[]))) + ' aliases')

se = [x for x in l if x['id']=='storm_end'][0]
print('Storm\'s End now has: ' + str(len(se.get('evenimente',[]))) + ' events, has_coords=' + str('coordinates' in se))

print('=== ALL VERIFICATIONS PASSED ===')
