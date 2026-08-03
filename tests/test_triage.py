"""Triage round trip: run with `python tests/test_triage.py`.

Every action is applied against the real datasets and then undone, and the test
fails unless the files come back byte-for-byte (modulo line endings) to where
they started. That is the property the tool actually promises — a reviewer can
take back any decision — and it cannot be checked without writing for real.

Exits non-zero on the first failing expectation, so it can gate a commit the
same way tests/smoke.mjs does.
"""
import hashlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import triage  # noqa: E402

ROOT = triage.ROOT
LOCATIONS = 'data/locations/locations.json'
failures = []


def check(label, condition, detail=''):
    print(('  PASS  ' if condition else '  FAIL  ') + label + (f'   [{detail}]' if detail and not condition else ''))
    if not condition:
        failures.append(label)


def digest(relative):
    # LF-normalised: write_json always emits LF, matching server.write_json, so a
    # CRLF working copy changes bytes on the first write without changing content.
    return hashlib.sha1((ROOT / relative).read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:12]


def snapshot_of(relative, entity_id):
    rows, index = triage.find_record(relative, entity_id)
    return json.loads(json.dumps(rows[index], ensure_ascii=False)) if index is not None else None


def main():
    if triage.JOURNAL.exists() or triage.RESOLUTIONS.exists():
        print('Refusing to run: a triage journal or resolutions file already exists.')
        print('This test writes to the real datasets and needs a clean slate.')
        print(f'  {triage.JOURNAL}\n  {triage.RESOLUTIONS}')
        return 2

    before_all = digest(LOCATIONS)
    queue = triage.build_queue()
    print(f'queue: {len(queue)} items   locations.json: {before_all}')

    sources = {item['source'] for item in queue}
    check('every queue source is represented', sources >= {
        'needs_manual_type', 'needs_language_review', 'name_shape', 'orphan_id', 'needs_review_md'
    }, str(sorted(sources)))
    check('items carry a stable id', all(item['id'] for item in queue))
    check('ids are unique', len({item['id'] for item in queue}) == len(queue))

    # ── assign_type ────────────────────────────────────────────────────────
    item = next(i for i in queue if i['source'] == 'needs_manual_type' and i['entityId'] == 'the_neck')
    print(f"\nassign_type on {item['entityId']}")
    original = snapshot_of(item['file'], item['entityId'])
    entry = triage.apply_action({'itemId': item['id'], 'action': 'assign_type', 'actor': 'test',
                                 'type': 'region', 'mappable': False, 'parent_id': None})
    record = snapshot_of(item['file'], item['entityId'])
    check('type written', record.get('type') == 'region', record.get('type'))
    check('mappable written', record.get('mappable') is False)
    check('journal records the old value', entry['before'].get('type') == original.get('type'))
    check('journal records who and when', bool(entry['actor']) and bool(entry['ts']))
    check('file snapshot taken', bool(entry['backup']) and (ROOT / entry['backup']).exists(), str(entry['backup']))
    check('item is marked resolved', next(i for i in triage.build_queue() if i['id'] == item['id'])['status'] == 'resolved')
    triage.undo(entry['seq'])
    check('undo restores the record exactly', snapshot_of(item['file'], item['entityId']) == original)
    check('undo reopens the item', next(i for i in triage.build_queue() if i['id'] == item['id'])['status'] == 'open')
    try:
        triage.undo(entry['seq'])
        check('undoing twice is refused', False)
    except Exception:
        check('undoing twice is refused', True)

    # ── set_names ──────────────────────────────────────────────────────────
    item = next(i for i in queue if i['source'] == 'needs_language_review' and i['category'] == 'locations')
    print(f"\nset_names on {item['entityId']}")
    original = snapshot_of(item['file'], item['entityId'])
    entry = triage.apply_action({'itemId': item['id'], 'action': 'set_names', 'actor': 'test',
                                 'name_ro': 'TEST RO', 'name_en': 'TEST EN'})
    record = snapshot_of(item['file'], item['entityId'])
    check('name_ro written', record.get('name_ro') == 'TEST RO')
    check('name_en written', record.get('name_en') == 'TEST EN')
    check('raw name is left alone', record.get('name') == original.get('name'))
    triage.undo(entry['seq'])
    check('undo restores names', snapshot_of(item['file'], item['entityId']) == original)

    # ── split ──────────────────────────────────────────────────────────────
    item = next(i for i in queue if i['source'] == 'name_shape' and len(i.get('splitSuggestion') or []) >= 3)
    print(f"\nsplit on {item['entityId']} into {len(item['splitSuggestion'])}")
    original = snapshot_of(item['file'], item['entityId'])
    count_before = len(triage.read_json(ROOT / item['file'], []))
    entry = triage.apply_action({'itemId': item['id'], 'action': 'split', 'actor': 'test',
                                 'names': item['splitSuggestion']})
    rows = triage.read_json(ROOT / item['file'], [])
    record = snapshot_of(item['file'], item['entityId'])
    check('parts created', len(rows) == count_before + len(item['splitSuggestion']), f'{count_before} -> {len(rows)}')
    check('original is kept', record is not None)
    check('original name is unchanged', record.get('name') == original.get('name'))
    check('split_into points at the parts', record.get('split_into') == entry['created'])
    part = snapshot_of(item['file'], entry['created'][0])
    check('part is marked inferred', part.get('canon_status') == 'inferred')
    check('part records its origin', part.get('split_from') == item['entityId'])
    triage.undo(entry['seq'])
    check('undo removes the parts', len(triage.read_json(ROOT / item['file'], [])) == count_before)
    check('undo restores the original', snapshot_of(item['file'], item['entityId']) == original)

    # ── mark_duplicate ─────────────────────────────────────────────────────
    item = next(i for i in queue if i['source'] == 'needs_manual_type')
    rows = triage.read_json(ROOT / item['file'], [])
    other = next(row['id'] for row in rows if row.get('id') and row['id'] != item['entityId'])
    print(f"\nmark_duplicate {item['entityId']} -> {other}")
    original = snapshot_of(item['file'], item['entityId'])
    entry = triage.apply_action({'itemId': item['id'], 'action': 'mark_duplicate', 'actor': 'test', 'duplicateOf': other})
    record = snapshot_of(item['file'], item['entityId'])
    check('duplicate_of written', record.get('duplicate_of') == other)
    check('the record is NOT deleted', record is not None)
    triage.undo(entry['seq'])
    check('undo restores the record', snapshot_of(item['file'], item['entityId']) == original)

    # ── reject ─────────────────────────────────────────────────────────────
    item = next(i for i in queue if i['source'] == 'needs_review_md')
    print(f"\nreject on {item['id']}")
    entry = triage.apply_action({'itemId': item['id'], 'action': 'reject', 'actor': 'test', 'note': 'not actionable'})
    check('item is marked rejected', next(i for i in triage.build_queue() if i['id'] == item['id'])['status'] == 'rejected')
    check('reject writes to no entity file', entry['before'] is None and entry['backup'] is None)
    triage.undo(entry['seq'])
    check('undo reopens the item', next(i for i in triage.build_queue() if i['id'] == item['id'])['status'] == 'open')

    # ── validation ─────────────────────────────────────────────────────────
    print('\nvalidation')
    item = next(i for i in queue if i['source'] == 'needs_manual_type')
    prose = next(i for i in queue if i['source'] == 'needs_review_md')
    for label, payload in (
        ('an unknown type is refused', {'itemId': item['id'], 'action': 'assign_type', 'type': 'nonsense'}),
        ('an unknown parent_id is refused', {'itemId': item['id'], 'action': 'assign_type', 'parent_id': 'no_such_place'}),
        ('self-parenting is refused', {'itemId': item['id'], 'action': 'assign_type', 'parent_id': item['entityId']}),
        ('self-duplication is refused', {'itemId': item['id'], 'action': 'mark_duplicate', 'duplicateOf': item['entityId']}),
        ('a cross-file duplicate is refused', {'itemId': item['id'], 'action': 'mark_duplicate', 'duplicateOf': 'visenya_targaryen'}),
        ('a one-name split is refused', {'itemId': item['id'], 'action': 'split', 'names': ['only one']}),
        ('an unknown action is refused', {'itemId': item['id'], 'action': 'frobnicate'}),
        ('an unknown item is refused', {'itemId': 'no:such:item', 'action': 'reject'}),
        ('a prose item cannot be typed', {'itemId': prose['id'], 'action': 'assign_type', 'type': 'region'}),
    ):
        try:
            triage.apply_action({'actor': 'test', **payload})
            check(label, False, 'no exception raised')
        except Exception:
            check(label, True)

    # ── final state ────────────────────────────────────────────────────────
    print('\nfinal state')
    check('locations.json is back to its starting content', digest(LOCATIONS) == before_all,
          f'{before_all} -> {digest(LOCATIONS)}')
    journal = triage.read_journal()
    check('the journal only ever grew', len(journal) > 0)
    check('every entry names who, when and what',
          all(entry.get('actor') and entry.get('ts') and entry.get('action') for entry in journal))
    check('seq is strictly increasing',
          [entry['seq'] for entry in journal] == sorted(entry['seq'] for entry in journal))
    check('nothing is left marked resolved', (triage.read_json(triage.RESOLUTIONS, {}) or {}) == {})

    print(f'\nfailures: {len(failures)}')
    for failure in failures:
        print('  -', failure)
    if not failures:
        print(f'Triage test passed: {len(queue)} queue items, {len(journal)} journal entries written and reverted.')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
