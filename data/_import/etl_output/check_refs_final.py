import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

deleted_ids = ['debarcaderul_regelui','debarcaderul_regelui_fortareata_rosie',
               'turnul_inalt','vechiul_oras_oldtown','sfarsitul_furtunii','fortareata_rosie']

found = 0
roots = ['data/locations', 'data/events', 'data/_import', 'data/houses', 'data/map']
for root in roots:
    if not os.path.exists(root):
        continue
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.endswith('.json'):
                continue
            fpath = os.path.join(dirpath, fn)
            if 'backups' in fpath or 'node_modules' in fpath:
                continue
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                for did in deleted_ids:
                    if did in content:
                        print('REFERENCE FOUND: "' + did + '" in ' + fpath)
                        found += 1
            except Exception as e:
                pass

if found == 0:
    print('No remaining references to deleted IDs found in any non-backup file.')
else:
    print('Total references found: ' + str(found))
