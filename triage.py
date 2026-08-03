"""Triage backlog: one queue over every "undecided" list the pipeline produces.

Several phases park what they could not decide into their own file, in their own
shape. Nothing reads those files back, so the backlog only grows. This module
presents all of them as one list of items with a common shape, applies the
decisions, and records every write so it can be taken back.

Two rules shape the whole design:

  · Nothing is ever deleted. Marking a duplicate writes `duplicate_of`; splitting
    a list-shaped name creates the parts and annotates the original; rejecting an
    item touches no entity file at all. The original text always survives
    (CLAUDE.md §5.4).

  · Every write is reversible. Full-file backups cannot carry that on their own —
    the entity files run 4–12 MB and a copy per action would reach gigabytes over
    a session — so the journal stores the record before and after, which is what
    an undo actually needs, and the file snapshot is a once-a-day safety net
    underneath it.
"""
import hashlib
import json
import os
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REVIEW_DIR = ROOT / 'data/_review'
BACKUP_DIR = ROOT / 'data/_backups/triage'
JOURNAL = REVIEW_DIR / 'triage_journal.jsonl'
RESOLUTIONS = REVIEW_DIR / 'triage_resolutions.json'

# Which file holds the entities of each language-review category, and of each
# entity kind the other queues refer to.
ENTITY_FILES = {
    'characters': 'data/characters/characters.json',
    'dragons': 'data/dragons/dragons.json',
    'essos_far_lands': 'data/essos/far_lands.json',
    'essos_free_cities': 'data/essos/free_cities.json',
    'essos_free_cities_events': 'data/essos/free_cities_events.json',
    'essos_free_cities_factions': 'data/essos/free_cities_factions.json',
    'events': 'data/events/events.json',
    'houses': 'data/houses/houses.json',
    'locations': 'data/locations/locations.json',
    'objects': 'data/objects/objects.json',
    'titles': 'data/titles/titles.json',
}

LOCATION_CATEGORIES = ('locations', 'essos_free_cities', 'essos_far_lands')

# The taxonomy actually present in the data, not the six values the location
# editor accepts. Triage exists to classify the records the importer could not,
# so it has to be able to write every type those records legitimately take.
KNOWN_TYPES = (
    'castle', 'city', 'town', 'fortress', 'ruins', 'landmark', 'stronghold',
    'settlement', 'location', 'urban_feature', 'structure', 'interior',
    'region', 'island', 'watercourse', 'route', 'landform', 'water', 'non_place',
)

ACTIONS = ('assign_type', 'set_names', 'mark_duplicate', 'split', 'reject', 'archive')


def _now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default


def write_json(path, value, attempts=6):
    """Byte-identical no-op when nothing changed, matching server.write_json.

    Written to a temporary file and moved into place. The repository lives in a
    OneDrive folder, and the sync client intermittently holds a handle on a file
    it is uploading: a direct `write_bytes` then fails with EINVAL, and because
    opening 'wb' truncates first, a failure at the wrong moment would leave a
    multi-megabyte dataset empty. Writing beside the target and replacing it
    means the original is either fully there or fully replaced, and the retry
    covers the case where the lock is on the replace itself.
    """
    path = Path(path)
    serialized = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    try:
        if path.read_bytes() == serialized:
            return False
    except FileNotFoundError:
        pass

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    last_error = None
    for attempt in range(attempts):
        try:
            temporary.write_bytes(serialized)
            os.replace(temporary, path)
            return True
        except OSError as error:
            last_error = error
            time.sleep(0.15 * (attempt + 1))
    temporary.unlink(missing_ok=True)
    raise OSError(
        f'could not write {path.name} after {attempts} attempts — a sync client is '
        f'probably holding the file. Nothing was changed. ({last_error})'
    )


def snapshot(relative_path):
    """One copy of a file per day, taken before the first write of that day.

    Deliberately not per action. The journal is what makes a single decision
    reversible; this is the coarser net for the case where the journal itself is
    mistrusted, and it must not grow without bound to provide that.
    """
    source = ROOT / relative_path
    if not source.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d')
    target = BACKUP_DIR / f'{Path(relative_path).name}.{stamp}.bak'
    if not target.exists():
        shutil.copy2(source, target)
    return str(target.relative_to(ROOT)).replace('\\', '/')


# ─────────────────────────────────────────────────────────────── queue sources

def _slug(text, limit=60):
    folded = (text or '').lower()
    for a, b in (('ă', 'a'), ('â', 'a'), ('î', 'i'), ('ș', 's'), ('ş', 's'), ('ț', 't'), ('ţ', 't')):
        folded = folded.replace(a, b)
    folded = re.sub(r'[^a-z0-9]+', '_', folded).strip('_')
    return folded[:limit] or 'item'


# A name that is really a list of places, or a note the extractor left in the
# name field. Thresholds are deliberately loose: a false positive costs one
# keypress to reject, a false negative leaves a 332-character name in the data.
OCR_NOTE = re.compile(r'\[(posibil|probabil|corupt|ocr|neclar|ilizibil)[^\]]*\]', re.IGNORECASE)
SPLIT_CANDIDATE = re.compile(r'\s*[;,]\s*|\s+/\s+')


def name_shape_problem(name):
    """The reason a name looks malformed, or None."""
    if not name:
        return None
    if OCR_NOTE.search(name):
        return 'ocr_note'
    separators = len(re.findall(r'[;,]', name))
    if separators >= 2:
        return 'looks_like_a_list'
    if len(name) > 60:
        return 'name_too_long'
    return None


def _name_of(row):
    return row.get('name') or row.get('name_ro') or row.get('name_en') or ''


def _location_rows():
    for category in LOCATION_CATEGORIES:
        relative = ENTITY_FILES[category]
        for row in read_json(ROOT / relative, []) or []:
            yield category, relative, row


def _location_categories():
    """id → (category, file) for every location, built once.

    The obvious spelling of this — scanning the location files to place each
    queue row — reads 7.6 MB per row, and needs_manual_type alone has 281 of
    them. That turned building the queue into a multi-minute operation, which
    for a tool meant to be driven at one keypress per item is the same as broken.
    """
    index = {}
    for category, relative, row in _location_rows():
        if row.get('id') and row['id'] not in index:
            index[row['id']] = (category, relative)
    return index


def collect_name_shape():
    """Detected live rather than read from a file, so a fixed name leaves the
    queue the moment it is fixed and no generated list can go stale."""
    items = []
    for category, relative, row in _location_rows():
        name = _name_of(row)
        problem = name_shape_problem(name)
        if not problem:
            continue
        parts = [part.strip() for part in SPLIT_CANDIDATE.split(name) if part.strip()]
        items.append({
            'id': f'name_shape:{row.get("id")}',
            'source': 'name_shape',
            'problem': problem,
            'title': name,
            'entityId': row.get('id'),
            'category': category,
            'file': relative,
            'hint': f'{len(parts)} parts' if problem == 'looks_like_a_list' else f'{len(name)} chars',
            'splitSuggestion': parts if len(parts) > 1 else [],
        })
    return items


def collect_needs_manual_type():
    rows = read_json(REVIEW_DIR / 'needs_manual_type.json', []) or []
    categories = _location_categories()
    items = []
    for row in rows:
        entity_id = row.get('id')
        category = categories.get(entity_id, ('locations', ENTITY_FILES['locations']))[0]
        items.append({
            'id': f'needs_manual_type:{entity_id}',
            'source': 'needs_manual_type',
            'problem': 'type_undecided',
            'title': row.get('name') or entity_id,
            'entityId': entity_id,
            'category': category,
            'file': ENTITY_FILES.get(category, ENTITY_FILES['locations']),
            'hint': row.get('reason', ''),
            'proposal': row.get('proposal') or {},
        })
    return items


def collect_needs_language_review():
    payload = read_json(REVIEW_DIR / 'needs_language_review.json', {}) or {}
    items = []
    for category, rows in (payload.get('categories') or {}).items():
        relative = ENTITY_FILES.get(category)
        if not relative:
            continue
        for row in rows or []:
            reason = row.get('reason')
            items.append({
                'id': f'needs_language_review:{category}:{row.get("id")}',
                'source': 'needs_language_review',
                'problem': 'language_undecided',
                'title': row.get('name') or row.get('id'),
                'entityId': row.get('id'),
                'category': category,
                'file': relative,
                'hint': ', '.join(reason) if isinstance(reason, list) else str(reason or ''),
            })
    return items


def collect_orphan_ids():
    rows = read_json(ROOT / 'data/_import/etl_output/id_map_orfani_needecise.json', []) or []
    return [{
        'id': f'orphan_id:{row.get("id_intern")}',
        'source': 'orphan_id',
        'problem': 'unresolved_reference',
        'title': row.get('id_intern', ''),
        'entityId': None,
        'category': None,
        'file': 'data/_import/etl_output/id_map_orfani_needecise.json',
        'hint': row.get('motiv', ''),
    } for row in rows]


def collect_composite_ids():
    rows = read_json(ROOT / 'data/_import/etl_output/id_uri_compuse_needecise.json', []) or []
    return [{
        'id': f'composite_id:{_slug(json.dumps(row, ensure_ascii=False))}',
        'source': 'composite_id',
        'problem': 'composite_id_undecided',
        'title': str(row.get('id_intern') or row.get('id') or row),
        'entityId': None,
        'category': None,
        'file': 'data/_import/etl_output/id_uri_compuse_needecise.json',
        'hint': str(row.get('motiv', '')),
    } for row in rows]


def collect_needs_review_md():
    """The prose backlog. Every '- ' bullet becomes an item, keyed by a hash of
    its text so that editing the file does not renumber what is already done."""
    try:
        text = (ROOT / 'NEEDS_REVIEW.md').read_text(encoding='utf-8')
    except FileNotFoundError:
        return []
    items = []
    section = ''
    for line in text.splitlines():
        if line.startswith('#'):
            section = line.lstrip('#').strip()
            continue
        if not line.strip().startswith('- '):
            continue
        body = line.strip()[2:].strip()
        digest = hashlib.sha1(body.encode('utf-8')).hexdigest()[:10]
        items.append({
            'id': f'needs_review_md:{digest}',
            'source': 'needs_review_md',
            'problem': 'prose_note',
            'title': body[:120],
            'entityId': None,
            'category': None,
            'file': 'NEEDS_REVIEW.md',
            'hint': section,
        })
    return items


COLLECTORS = (
    collect_needs_manual_type,
    collect_needs_language_review,
    collect_name_shape,
    collect_orphan_ids,
    collect_composite_ids,
    collect_needs_review_md,
)


_QUEUE_CACHE = {'fingerprint': None, 'items': None}

# Every file the *items* are derived from. The cache key is their mtimes and
# sizes, so an edit made by this tool — or by hand, or by a script — rebuilds the
# queue, while the several rebuilds one keystroke would otherwise trigger
# collapse into one.
#
# triage_resolutions.json is deliberately absent. Which items exist does not
# depend on it; only their `status` does, and that is overlaid below on every
# call. Including it meant each decision invalidated the cache and rebuilt all
# 3383 items twice — once to find the item, once to recount progress — which at
# one keypress per item is the difference between a usable tool and a stutter.
_QUEUE_INPUTS = (
    'data/_review/needs_manual_type.json',
    'data/_review/needs_language_review.json',
    'data/_import/etl_output/id_map_orfani_needecise.json',
    'data/_import/etl_output/id_uri_compuse_needecise.json',
    'NEEDS_REVIEW.md',
    *[ENTITY_FILES[category] for category in LOCATION_CATEGORIES],
)


def _fingerprint():
    marks = []
    for relative in _QUEUE_INPUTS:
        try:
            stat = (ROOT / relative).stat()
            marks.append(f'{relative}:{stat.st_mtime_ns}:{stat.st_size}')
        except FileNotFoundError:
            marks.append(f'{relative}:missing')
    return '|'.join(marks)


def build_queue():
    fingerprint = _fingerprint()
    if _QUEUE_CACHE['fingerprint'] != fingerprint or _QUEUE_CACHE['items'] is None:
        items = []
        for collector in COLLECTORS:
            items.extend(collector())
        _QUEUE_CACHE['fingerprint'] = fingerprint
        _QUEUE_CACHE['items'] = items

    resolutions = read_json(RESOLUTIONS, {}) or {}
    for item in _QUEUE_CACHE['items']:
        resolution = resolutions.get(item['id'])
        item['status'] = (resolution or {}).get('status', 'open')
        item['resolvedAt'] = (resolution or {}).get('ts')
        item['resolvedAction'] = (resolution or {}).get('action')
    return _QUEUE_CACHE['items']


# ──────────────────────────────────────────────────────────────── item context

def find_record(relative_path, entity_id):
    rows = read_json(ROOT / relative_path, []) or []
    for index, row in enumerate(rows):
        if row.get('id') == entity_id:
            return rows, index
    return rows, None


def load_context(item_id):
    """The raw entity behind an item, verbatim. Triage decisions are only as good
    as the record the reviewer can see, so nothing here is summarised."""
    item = next((entry for entry in build_queue() if entry['id'] == item_id), None)
    if item is None:
        raise KeyError(f'unknown item: {item_id}')
    context = {'item': item, 'raw': None, 'duplicateCandidates': []}
    if item.get('file') and item.get('entityId'):
        rows, index = find_record(item['file'], item['entityId'])
        if index is not None:
            context['raw'] = rows[index]
            context['duplicateCandidates'] = _duplicate_candidates(rows, index)
    return context


def _duplicate_candidates(rows, index, limit=6):
    """Records whose name matches on a folded slug. The reviewer confirms; this
    only saves them from searching for the obvious cases by hand."""
    target = _slug(_name_of(rows[index]))
    if not target:
        return []
    hits = []
    for other_index, row in enumerate(rows):
        if other_index == index:
            continue
        if _slug(_name_of(row)) == target:
            hits.append({'id': row.get('id'), 'name': _name_of(row), 'type': row.get('type')})
            if len(hits) >= limit:
                break
    return hits


# ────────────────────────────────────────────────────────────────────── journal

def read_journal():
    if not JOURNAL.exists():
        return []
    entries = []
    for line in JOURNAL.read_text(encoding='utf-8').splitlines():
        if line.strip():
            entries.append(json.loads(line))
    return entries


def append_journal(entry):
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    with JOURNAL.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + '\n')
    return entry


def next_seq():
    entries = read_journal()
    return (max((entry.get('seq', 0) for entry in entries), default=0)) + 1


def set_resolution(item_id, status, action, seq):
    resolutions = read_json(RESOLUTIONS, {}) or {}
    if status is None:
        resolutions.pop(item_id, None)
    else:
        resolutions[item_id] = {'status': status, 'action': action, 'ts': _now(), 'seq': seq}
    write_json(RESOLUTIONS, resolutions)


# ───────────────────────────────────────────────────────────────────── actions

def _require_record(item):
    if not item.get('file') or not item.get('entityId'):
        raise ValueError(f'{item["source"]} items carry no entity to edit; use reject or archive')
    rows, index = find_record(item['file'], item['entityId'])
    if index is None:
        raise ValueError(f'{item["entityId"]} not found in {item["file"]}')
    return rows, index


def apply_action(payload):
    item_id = str(payload.get('itemId', '')).strip()
    action = str(payload.get('action', '')).strip()
    actor = str(payload.get('actor') or os.environ.get('USERNAME') or 'unknown').strip()
    if action not in ACTIONS:
        raise ValueError(f'unknown action: {action}')

    item = next((entry for entry in build_queue() if entry['id'] == item_id), None)
    if item is None:
        raise KeyError(f'unknown item: {item_id}')

    seq = next_seq()
    entry = {
        'seq': seq, 'ts': _now(), 'actor': actor, 'action': action,
        'itemId': item_id, 'source': item['source'],
        'file': item.get('file'), 'entityId': item.get('entityId'),
        'before': None, 'after': None, 'created': [], 'backup': None, 'undone': False,
    }

    if action in ('reject', 'archive'):
        entry['note'] = str(payload.get('note') or '')
        append_journal(entry)
        set_resolution(item_id, 'rejected' if action == 'reject' else 'archived', action, seq)
        return entry

    rows, index = _require_record(item)
    entry['backup'] = snapshot(item['file'])
    entry['before'] = json.loads(json.dumps(rows[index], ensure_ascii=False))

    if action == 'assign_type':
        _apply_assign_type(rows[index], payload)
    elif action == 'set_names':
        _apply_set_names(rows[index], payload)
    elif action == 'mark_duplicate':
        _apply_mark_duplicate(rows, index, payload)
    elif action == 'split':
        entry['created'] = _apply_split(rows, index, payload)

    entry['after'] = json.loads(json.dumps(rows[index], ensure_ascii=False))
    write_json(ROOT / item['file'], rows)
    append_journal(entry)
    set_resolution(item_id, 'resolved', action, seq)
    return entry


def _apply_assign_type(row, payload):
    if 'type' in payload and payload['type'] is not None:
        value = str(payload['type']).strip()
        if value not in KNOWN_TYPES:
            raise ValueError(f'type must be one of: {", ".join(KNOWN_TYPES)}')
        row['type'] = value
    if 'mappable' in payload and payload['mappable'] is not None:
        if not isinstance(payload['mappable'], bool):
            raise ValueError('mappable must be true or false')
        row['mappable'] = payload['mappable']
    if 'parent_id' in payload:
        parent = payload['parent_id']
        if parent in (None, ''):
            row['parent_id'] = None
        else:
            parent = str(parent).strip()
            if parent == row.get('id'):
                raise ValueError('a record cannot be its own parent')
            known = {r.get('id') for _, _, r in _location_rows()}
            if parent not in known:
                raise ValueError(f'parent_id {parent} is not a known location')
            row['parent_id'] = parent
    row['triaged_at'] = _now()


def _apply_set_names(row, payload):
    touched = False
    for key in ('name_ro', 'name_en'):
        if key in payload:
            value = payload[key]
            row[key] = None if value in (None, '') else str(value).strip()
            touched = True
    if not touched:
        raise ValueError('set_names needs name_ro or name_en')
    row['triaged_at'] = _now()


def _apply_mark_duplicate(rows, index, payload):
    """Records the relation; never removes the record.

    A duplicate still carries its own page provenance, and the decision that two
    records describe one place is exactly the kind that gets revisited.
    """
    target = str(payload.get('duplicateOf') or '').strip()
    if not target:
        raise ValueError('duplicateOf is required')
    if target == rows[index].get('id'):
        raise ValueError('a record cannot duplicate itself')
    if not any(row.get('id') == target for row in rows):
        raise ValueError(f'{target} is not in the same file; cross-file duplicates are not supported yet')
    rows[index]['duplicate_of'] = target
    rows[index]['triaged_at'] = _now()


def _apply_split(rows, index, payload):
    """Turn a list-shaped name into real records, keeping the original.

    The original keeps its text and gains `split_into`, because the extraction
    that produced it has a page reference and that reference is evidence for
    every part. The parts are marked `canon_status: inferred` — they were derived
    here, not read from a book.
    """
    names = [str(name).strip() for name in (payload.get('names') or []) if str(name).strip()]
    if len(names) < 2:
        raise ValueError('split needs at least two names')
    original = rows[index]
    existing = {row.get('id') for row in rows}
    created = []
    for name in names:
        base = _slug(name)
        candidate = base
        suffix = 2
        while candidate in existing:
            candidate = f'{base}_{suffix}'
            suffix += 1
        existing.add(candidate)
        record = {
            'id': candidate,
            'name': name,
            'type': str(payload.get('type') or original.get('type') or 'location'),
            'continent': original.get('continent'),
            'region': original.get('region'),
            'canon_status': 'inferred',
            'split_from': original.get('id'),
            'triaged_at': _now(),
        }
        if original.get('parent_id'):
            record['parent_id'] = original['parent_id']
        rows.append(record)
        created.append(candidate)
    original['split_into'] = created
    original['mappable'] = False
    original['triaged_at'] = _now()
    return created


# ──────────────────────────────────────────────────────────────────────── undo

def undo(seq):
    """Put a record back the way the journal says it was.

    Reverts the record rather than restoring the file, so undoing an early
    decision does not discard the decisions made after it.
    """
    entries = read_journal()
    entry = next((candidate for candidate in entries if candidate.get('seq') == seq), None)
    if entry is None:
        raise KeyError(f'no journal entry with seq {seq}')
    if entry.get('undone'):
        raise ValueError(f'entry {seq} was already undone')
    if any(other.get('action') == 'undo' and other.get('undoOf') == seq for other in entries):
        raise ValueError(f'entry {seq} was already undone')

    if entry['action'] in ('reject', 'archive'):
        set_resolution(entry['itemId'], None, None, None)
    else:
        rows, index = find_record(entry['file'], entry['entityId'])
        if index is None:
            raise ValueError(f'{entry["entityId"]} is no longer in {entry["file"]}')
        # Records created by a split are removed, and only if nothing has been
        # written to them since — a part that was itself triaged afterwards is
        # left alone and reported, rather than silently discarded.
        kept = []
        for created_id in entry.get('created') or []:
            created_rows, created_index = find_record(entry['file'], created_id)
            if created_index is None:
                continue
            if created_rows[created_index].get('triaged_at') != entry['after'].get('triaged_at'):
                kept.append(created_id)
            else:
                rows[:] = [row for row in rows if row.get('id') != created_id]
        rows, index = (rows, next((i for i, row in enumerate(rows) if row.get('id') == entry['entityId']), None))
        if index is None:
            raise ValueError(f'{entry["entityId"]} is no longer in {entry["file"]}')
        rows[index] = entry['before']
        write_json(ROOT / entry['file'], rows)
        set_resolution(entry['itemId'], None, None, None)
        if kept:
            entry = dict(entry, keptAfterUndo=kept)

    undo_entry = {
        'seq': next_seq(), 'ts': _now(),
        'actor': str(entry.get('actor') or 'unknown'),
        'action': 'undo', 'undoOf': seq,
        'itemId': entry['itemId'], 'source': entry['source'],
        'file': entry.get('file'), 'entityId': entry.get('entityId'),
        'restored': entry.get('before'), 'removed': entry.get('created') or [],
        'keptAfterUndo': entry.get('keptAfterUndo') or [],
    }
    append_journal(undo_entry)
    return undo_entry


def progress():
    queue = build_queue()
    by_source = {}
    for item in queue:
        bucket = by_source.setdefault(item['source'], {'total': 0, 'done': 0})
        bucket['total'] += 1
        if item['status'] != 'open':
            bucket['done'] += 1
    done = sum(bucket['done'] for bucket in by_source.values())
    return {'total': len(queue), 'done': done, 'bySource': by_source}
