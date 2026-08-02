"""Match downloaded AWOIAF house crests to local Atlas houses.

Run from the project root: python scripts/match_crests.py
"""
import difflib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOUSES = ROOT / 'data/houses/houses.json'
SOURCE = ROOT / 'data/List of Houses - A Wiki of Ice and Fire'
DESTINATION = ROOT / 'assets/sigils'
REPORT = ROOT / 'RAPORT_EMBLEME.md'
IGNORE = ('none', 'default', 'close-btn', 'advlblw')


def normalise(value):
    value = re.sub(r'^house\s+', '', value, flags=re.I)
    return re.sub(r'[^a-z0-9]+', '', value.lower())


def source_index():
    indexed = {}
    for path in SOURCE.iterdir():
        if not path.is_file() or path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        lower = path.name.lower()
        if any(token in lower for token in IGNORE):
            continue
        # Wikimedia names contain both the image index and its pixel size.
        stem = re.sub(r'^imgi_\d+_\d+px-', '', path.stem, flags=re.I)
        key = normalise(stem.replace('_', ' '))
        if key:
            indexed.setdefault(key, []).append(path)
    return indexed


def resolution(path):
    match = re.search(r'_(\d+)px-', path.name, re.I)
    return int(match.group(1)) if match else 0


def choose_match(name, indexed):
    key = normalise(name)
    choices = [candidate for candidate in indexed if candidate == key or key in candidate or candidate in key]
    if not choices:
        choices = difflib.get_close_matches(key, indexed.keys(), n=1, cutoff=.8)
    if not choices:
        return None
    return max(indexed[choices[0]], key=resolution)


def main():
    houses = json.loads(HOUSES.read_text(encoding='utf-8'))
    indexed = source_index()
    DESTINATION.mkdir(parents=True, exist_ok=True)
    matched, skipped, missing = 0, 0, []
    for house in houses:
        target = ROOT / str(house.get('crest') or '')
        if house.get('crest') and target.is_file() and target.stat().st_size > 0:
            skipped += 1
            continue
        source = choose_match(house.get('name', ''), indexed)
        if source is None:
            house['crest'] = None
            missing.append((house.get('name', house['id']), house['id']))
            continue
        output = DESTINATION / f"{house['id']}.png"
        shutil.copyfile(source, output)
        house['crest'] = output.relative_to(ROOT).as_posix()
        house['crest_is_custom'] = False
        matched += 1
    HOUSES.write_text(json.dumps(houses, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = ['# Raport embleme', '', f'- Case procesate: {len(houses)}', f'- Embleme potrivite automat: {matched}', f'- Embleme valide păstrate: {skipped}', f'- Fără emblemă: {len(missing)}', '', '## Fără emblemă']
    lines.extend([f'- {name} (`{house_id}`)' for name, house_id in missing] or ['- Niciuna.'])
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'processed={len(houses)} matched={matched} skipped={skipped} missing={len(missing)}')


if __name__ == '__main__':
    main()
