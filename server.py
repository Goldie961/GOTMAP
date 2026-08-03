"""Local Atlas server: static files plus durable admin API.

Run: python server.py  (then open http://localhost:8000/admin/map-editor.html)
"""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCATION_FILES = [ROOT / 'data/locations/locations.json', ROOT / 'data/essos/free_cities.json', ROOT / 'data/essos/far_lands.json']
HOUSES_FILE = ROOT / 'data/houses/houses.json'
CATALOG = ROOT / 'data/map/catalog.json'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    """Write only when the serialized result differs from what is on disk.

    Every admin action used to rewrite each file it touched unconditionally.
    Saving one pin therefore rewrote locations.json — 7.5 MB — even when not a
    byte of it had changed, which churned git history and made a one-pin move
    look like a bulk data edit.  Returns True when the file was actually written.

    Compared and written as bytes with explicit LF.  Text mode translates
    newlines on write but not on read, so re-saving identical content produced a
    different file on Windows and the check could never settle.
    """
    serialized = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    try:
        if path.read_bytes() == serialized:
            return False
    except FileNotFoundError:
        pass
    path.write_bytes(serialized)
    return True


class AtlasHandler(SimpleHTTPRequestHandler):
    def read_body(self):
        length = int(self.headers.get('Content-Length', '0'))
        return json.loads(self.rfile.read(length) or b'{}')

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def location_record(self, location_id):
        for path in LOCATION_FILES:
            rows = read_json(path)
            for index, row in enumerate(rows):
                if row.get('id') == location_id:
                    return path, rows, index
        return None, None, None

    def do_GET(self):
        if self.path.rstrip('/') == '/api/ping':
            return self.reply(200, {'ok': True, 'server': 'atlas-admin'})
        return super().do_GET()

    def do_POST(self):
        try:
            payload = self.read_body()
            if self.path == '/api/save-coordinates':
                coordinates = payload.get('coordinates', {})
                if not isinstance(coordinates, dict):
                    raise ValueError('coordinates must be an object')

                # The location files are read to validate ids and never written.
                # catalog.json is the authoritative registry for anything that
                # carries a pin (CLAUDE.md §4.1): MapRenderer.getLocationCoordinate()
                # reads it and nothing else.  The root-level `coordinates` field is
                # deprecated — kept because it is still the only position source for
                # the locations that have no pin (the fly-to fallback at
                # js/app.js:356), but no longer written, because two writable copies
                # of one fact do not stay in sync.  They already had not: 7 of the
                # free cities carried root coordinates that disagreed with the
                # catalog.  See docs/raport_coordonate_desincronizate.md.
                known_ids = set()
                for path in LOCATION_FILES:
                    known_ids.update(row.get('id') for row in read_json(path))

                saved_coordinates = {}
                unknown_ids = []
                for location_id, point in coordinates.items():
                    if location_id not in known_ids:
                        unknown_ids.append(location_id)
                    elif point is None:
                        saved_coordinates[location_id] = None
                    elif isinstance(point, dict) and isinstance(point.get('x'), (int, float)) and isinstance(point.get('y'), (int, float)):
                        saved_coordinates[location_id] = {'x': point['x'], 'y': point['y']}
                    else:
                        raise ValueError(f'invalid coordinate for {location_id}')

                catalog = read_json(CATALOG)
                stored = catalog['maps']['world']['coordinates']
                for location_id, point in saved_coordinates.items():
                    if point is None:
                        stored.pop(location_id, None)
                    else:
                        stored[location_id] = {'x': point['x'], 'y': point['y'], 'source': 'admin/map-editor.html', 'method': 'admin-editor'}
                written = write_json(CATALOG, catalog)
                return self.reply(200, {'updated': len(saved_coordinates), 'unknownIds': unknown_ids, 'filesWritten': ['data/map/catalog.json'] if written else []})

            if self.path == '/api/locations':
                location_id = str(payload.get('id', '')).strip()
                if not location_id:
                    raise ValueError('id is required')
                if self.location_record(location_id)[0]:
                    return self.reply(409, {'error': 'A location with this id already exists.'})
                row = self.clean_location(payload, location_id)
                # Westerosi locations belong in the main file; Essos entries retain their source files.
                target = LOCATION_FILES[1] if row['continent'] == 'essos' and row['region'] == 'free_cities' else LOCATION_FILES[2] if row['continent'] == 'essos' else LOCATION_FILES[0]
                rows = read_json(target); rows.append(row); write_json(target, rows)
                return self.reply(201, {'location': row})
            if self.path == '/api/houses':
                house_id = str(payload.get('id', '')).strip()
                if not house_id:
                    raise ValueError('id is required')
                rows = read_json(HOUSES_FILE)
                if any(row.get('id') == house_id for row in rows):
                    return self.reply(409, {'error': 'A house with this id already exists.'})
                house = self.clean_house(payload, house_id)
                rows.append(house); write_json(HOUSES_FILE, rows)
                return self.reply(201, {'house': house})
            return self.send_error(404)
        except Exception as exc:
            return self.reply(400, {'error': str(exc)})

    def do_PUT(self):
        try:
            payload = self.read_body()
            if self.path.startswith('/api/locations/'):
                location_id = self.path.rsplit('/', 1)[-1]
                path, rows, index = self.location_record(location_id)
                if path is None: return self.reply(404, {'error': 'Location not found.'})
                rows[index] = self.clean_location(payload, location_id, rows[index])
                write_json(path, rows)
                return self.reply(200, {'location': rows[index]})
            if self.path.startswith('/api/houses/'):
                house_id = self.path.rsplit('/', 1)[-1]; rows = read_json(HOUSES_FILE)
                index = next((i for i, row in enumerate(rows) if row.get('id') == house_id), None)
                if index is None: return self.reply(404, {'error': 'House not found.'})
                rows[index] = self.clean_house(payload, house_id, rows[index])
                write_json(HOUSES_FILE, rows)
                return self.reply(200, {'house': rows[index]})
            return self.send_error(404)
        except Exception as exc:
            return self.reply(400, {'error': str(exc)})

    def do_DELETE(self):
        try:
            if self.path.startswith('/api/locations/'):
                location_id = self.path.rsplit('/', 1)[-1]
                path, rows, index = self.location_record(location_id)
                if path is None: return self.reply(404, {'error': 'Location not found.'})
                rows.pop(index); write_json(path, rows)
                catalog = read_json(CATALOG); catalog['maps']['world']['coordinates'].pop(location_id, None); write_json(CATALOG, catalog)
                return self.reply(200, {'deleted': location_id})
            if self.path.startswith('/api/houses/'):
                house_id = self.path.rsplit('/', 1)[-1]; rows = read_json(HOUSES_FILE)
                index = next((i for i, row in enumerate(rows) if row.get('id') == house_id), None)
                if index is None: return self.reply(404, {'error': 'House not found.'})
                rows.pop(index); write_json(HOUSES_FILE, rows)
                return self.reply(200, {'deleted': house_id})
            return self.send_error(404)
        except Exception as exc:
            return self.reply(400, {'error': str(exc)})

    @staticmethod
    def clean_location(payload, location_id, existing=None):
        row = dict(existing or {})
        for key in ('name', 'type', 'continent', 'region', 'canon_status'):
            if key in payload: row[key] = str(payload[key]).strip()
        row['id'] = location_id
        if not row.get('name'): raise ValueError('name is required')
        if row.get('type') not in ('castle', 'city', 'town', 'fortress', 'ruins', 'landmark'):
            raise ValueError('type must be castle, city, town, fortress, ruins, or landmark')
        return row

    @staticmethod
    def clean_house(payload, house_id, existing=None):
        row = dict(existing or {})
        meta = dict(row.get('metadata') or {})
        incoming_meta = payload.get('metadata') or {}
        row['id'] = house_id
        row['name'] = str(payload.get('name', row.get('name', ''))).strip()
        if not row['name']: raise ValueError('name is required')
        row.setdefault('type', 'house'); row.setdefault('continent', 'westeros'); row.setdefault('region', 'unknown')
        row.setdefault('coordinates', None); row.setdefault('ownership_history', []); row.setdefault('canon_status', 'inferred'); row.setdefault('tags', ['house'])
        row.setdefault('crest', f'assets/sigils/{house_id}.png'); row.setdefault('crest_is_custom', False)
        for key in ('words', 'seat', 'sigil', 'founded'):
            if key in incoming_meta: meta[key] = str(incoming_meta[key])
        colors = dict(meta.get('colors') or {})
        for key in ('primary', 'secondary'):
            if key in (incoming_meta.get('colors') or {}): colors[key] = str(incoming_meta['colors'][key])
        meta['colors'] = colors; meta.setdefault('timeline', [])
        row['metadata'] = meta
        return row


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Atlas server')
    parser.add_argument('--host', default='127.0.0.1', help='Host address to bind to (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8000, help='Port to listen on (default: 8000)')
    args = parser.parse_args()

    print(f'Atlas server listening on http://{args.host}:{args.port}/ (admin: http://{args.host}:{args.port}/admin/map-editor.html)')
    ThreadingHTTPServer((args.host, args.port), AtlasHandler).serve_forever()
