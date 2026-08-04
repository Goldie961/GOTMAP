"""Mark the SUSPECT bilingual pairs with `name_review_status: "contested"`.

Adds fields, removes none (CLAUDE.md §5.4): `name_ro` and `name_en` are left
byte-identical. What is added is the statement that the *pair* has not been
confirmed, plus the evidence for saying so, so that a reviewer opening the
record in admin/triage.html sees why it is in their queue without leaving it.

Dry-run unless `--apply` is passed; `--apply` takes a dated backup first
(CLAUDE.md §6). Writing goes through `triage.write_json`, which writes beside
the target and replaces it — a direct write to this repository intermittently
fails because it is OneDrive-synced, and a failed truncating write on a 7.6 MB
dataset would be unrecoverable.

The suspect set is NOT re-derived here. It is read from the read-only report, so
the classification rule lives in exactly one place:

    node scripts/report_bilingual_name_conflicts.mjs --json > report.json
    python scripts/mark_contested_bilingual_names.py --input report.json
    python scripts/mark_contested_bilingual_names.py --input report.json --apply

Reversible without this script: delete the two added keys, or let triage's
`set_names` action clear the status when a reviewer settles the pair.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import triage  # noqa: E402  — reuses write_json / snapshot / ROOT

# The console here is cp1250, which has no ț. Every id and every piece of
# evidence printed below comes out of Romanian data, so the report would die on
# its second line without this.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = 'data/locations/locations.json'
DETECTED_BY = 'scripts/report_bilingual_name_conflicts.mjs'
AUDIT_DOC = 'docs/VERIFICARE_FINALA.md CRITICAL-1'


def build_block(item, detected_at):
    """The `name_review` value for one contested record."""
    block = {
        'reason': 'bilingual_name_conflict',
        'detected_by': DETECTED_BY,
        'detected_at': detected_at,
        'name_ro_at_detection': item['name_ro'],
        'name_en_at_detection': item['name_en'],
    }
    if item['conflicts_with']:
        block['conflicts_with'] = item['conflicts_with']
        block['evidence'] = item['evidence']
    if item['audit']:
        block['source_doc'] = AUDIT_DOC
        block['audit_note'] = item['audit']
    return block


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True,
                        help='JSON produced by report_bilingual_name_conflicts.mjs --json')
    parser.add_argument('--date', default=None,
                        help='detected_at stamp (default: today, UTC)')
    parser.add_argument('--apply', action='store_true',
                        help='write. Without it nothing is touched.')
    args = parser.parse_args()

    detected_at = args.date or triage._now()[:10]
    report = json.loads(Path(args.input).read_text(encoding='utf-8'))
    suspects = {item['id']: item for item in report['items'] if item['bucket'] == 'SUSPECT'}

    rows = triage.read_json(triage.ROOT / TARGET, [])
    before_count = len(rows)

    planned, missing = [], []
    for entity_id, item in suspects.items():
        index = next((i for i, row in enumerate(rows) if row.get('id') == entity_id), None)
        if index is None:
            missing.append(entity_id)
            continue
        row = rows[index]
        block = build_block(item, detected_at)
        already = row.get('name_review_status') == 'contested' and row.get('name_review') == block
        planned.append((index, entity_id, block, already))

    if missing:
        raise SystemExit(f'nu sunt în {TARGET}: {", ".join(missing)}')

    print(f'{TARGET}: {before_count} înregistrări')
    print(f'perechi în raport: {report["pairs"]} · SUSPECT: {len(suspects)}\n')
    for _, entity_id, block, already in planned:
        mark = 'deja marcat' if already else '+ name_review_status="contested"'
        reason = block.get('audit_note') or (block.get('evidence') or [''])[0]
        print(f'  {entity_id:<24} {mark:<32} {reason}')

    changes = sum(1 for *_, already in planned if not already)
    print(f'\n{changes} de scris, {len(planned) - changes} deja la zi.')

    if not args.apply:
        print('\nDRY-RUN. Nimic nu a fost scris. Adaugă --apply.')
        return

    backup = triage.snapshot(TARGET)
    for index, _, block, _ in planned:
        rows[index]['name_review_status'] = 'contested'
        rows[index]['name_review'] = block

    if len(rows) != before_count:
        raise SystemExit('numărul de înregistrări s-a schimbat — nu se scrie')

    wrote = triage.write_json(triage.ROOT / TARGET, rows)
    print(f'\nbackup: {backup}')
    print(f'scris: {wrote} · înregistrări înainte {before_count} · după {len(rows)}')


if __name__ == '__main__':
    main()
