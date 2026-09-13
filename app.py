"""Registration Sniper 0.6.2. Local timetable, autofill bridge and public seat monitor."""
import argparse
import json
import os
import re
import secrets
import shutil
import tempfile
import webbrowser
import catalog
import seats
import choices
import phone
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'plan.json'
STATUSES = {'planned', 'registered', 'full', 'rejected', 'uncertain'}
TOKEN = secrets.token_urlsafe(32)
BRIDGE_TOKEN = secrets.token_urlsafe(32)
MONITOR = None
PHONE = None

def phone_alerts():
    global PHONE
    if PHONE is None: PHONE = phone.Phone(DATA.with_name(DATA.stem + ".phone.json"))
    return PHONE


def seat_monitor():
    global MONITOR
    if MONITOR is None:
        MONITOR = seats.Monitor(DATA.with_name(DATA.stem + '.monitor.json'), on_event=lambda e:phone_alerts().enqueue(e))
    return MONITOR

ASSETS = {'/phone-ui.js': ('phone-ui.js', 'text/javascript'),'/seats-ui.js': ('seats-ui.js', 'text/javascript'), '/assets/reticle.svg': ('assets/reticle.svg', 'image/svg+xml'),'/mock.js': ('mock.js', 'text/javascript'),'/catalog-ui.js': ('catalog-ui.js', 'text/javascript'),
          '/data/spring-registration-days.pdf': ('data/spring-registration-days.pdf', 'application/pdf'),
          '/assets/heading.otf': ('assets/heading.otf', 'font/otf'),
          '/style.css': ('style.css', 'text/css'), '/ui.js': ('ui.js', 'text/javascript')}

class ConflictError(ValueError):
    pass

def blank():
    return {'term': '202601', 'courses': [], 'history': [], 'overrides': [], 'revision': 0}

def course_key(name):
    return re.sub(r'[\s-]+', '', name).upper()

def timestamp(value):
    try:
        result = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        raise ValueError('Use an ISO date/time with timezone: YYYY-MM-DDTHH:MM:SS+03:00.')
    if result.tzinfo is None:
        raise ValueError('Opening/closing time requires a timezone such as +03:00.')
    return result

def parse_meetings(value):
    """Manually entered meetings: Mon 09:40-10:30; Thu 12:40-14:30."""
    result = []
    for item in value.split(';'):
        if not item.strip():
            continue
        match = re.fullmatch(r'\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*', item, re.I)
        if not match:
            raise ValueError('Meeting format: Mon 09:40-10:30; Thu 12:40-14:30.')
        day, sh, sm, eh, em = match.groups()
        sh, sm, eh, em = map(int, (sh, sm, eh, em))
        if sh > 23 or eh > 23 or sm > 59 or em > 59 or sh*60+sm >= eh*60+em:
            raise ValueError('Meeting times must be valid and finish after they start.')
        result.append((day.lower(), sh*60+sm, eh*60+em))
    return result

def validate(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get('term'), str) or not re.fullmatch(r'\d{6}', plan['term']):
        raise ValueError('Term must contain six digits. Verify it in SUIS.')
    if not isinstance(plan.get('courses'), list) or len(plan['courses']) > 80:
        raise ValueError('Expected up to 80 course alternatives.')
    plan.setdefault('solver_scope','saved')
    if plan['solver_scope'] not in {'saved','catalog'}: raise ValueError('Invalid fallback search scope.')
    plan.setdefault('revision', 0)
    plan.setdefault('overrides', [])
    plan.setdefault('history', [])
    if not isinstance(plan['history'], list):
        raise ValueError('History must be a list.')
    if type(plan['revision']) is not int or plan['revision'] < 0:
        raise ValueError('Invalid plan revision.')
    for row in plan['courses']:
        if not isinstance(row, dict):
            raise ValueError('Invalid course entry.')
        for field in ('catalog_base', 'catalog_type', 'catalog_term'):
            if field in row and (not isinstance(row[field], str) or len(row[field]) > 100):
                raise ValueError('Invalid catalog metadata.')
        row.setdefault('fallback_rank',50)
        row.setdefault('locked',False)
        if type(row['fallback_rank']) is not int or not 1 <= row['fallback_rank'] <= 99: raise ValueError('Fallback rank must be 1–99.')
        if type(row['locked']) is not bool: raise ValueError('Invalid section lock.')
        row.setdefault('closes', '')
        row.setdefault('meetings', '')
        for key in ('course', 'section', 'crns', 'opens', 'closes', 'source', 'notes', 'meetings'):
            if not isinstance(row.get(key), str) or len(row[key]) > 2000:
                raise ValueError('Invalid or missing field: ' + key)
        if not course_key(row['course']):
            raise ValueError('Course name is required.')
        if row.get('status') not in STATUSES:
            raise ValueError('Unknown registration status.')
        if type(row.get('priority')) is not int or not 1 <= row['priority'] <= 99:
            raise ValueError('Priority must be an integer from 1 to 99.')
        if type(row.get('selected')) is not bool or type(row.get('verified')) is not bool:
            raise ValueError('Invalid selection or verification.')
        if row['crns'] and not all(re.fullmatch(r'\d{5}', x) for x in row['crns'].split()):
            raise ValueError('Enter five-digit CRNs separated by spaces.')
        for key in ('opens', 'closes'):
            if row[key]: timestamp(row[key])
        if row['opens'] and row['closes'] and timestamp(row['closes']) <= timestamp(row['opens']):
            raise ValueError('Closing time must be later than opening time.')
        parse_meetings(row['meetings'])
    if not isinstance(plan['overrides'], list) or len(plan['overrides']) > 80:
        raise ValueError('Expected up to 80 override drafts.')
    for item in plan['overrides']:
        if not isinstance(item, dict): raise ValueError('Invalid override.')
        for key in ('course', 'kind', 'text', 'status'):
            if not isinstance(item.get(key), str): raise ValueError('Invalid override field.')
        if not item['course'].strip() or len(item['course']) > 100: raise ValueError('Override needs a course.')
        if item['kind'] not in {'Pre-Reqs. Waiving', 'Co-Reqs. Waiving', 'Approval Needed'}:
            raise ValueError('Unknown override type.')
        if item['status'] not in {'draft', 'submitted', 'approved', 'denied'}:
            raise ValueError('Unknown override status.')
        if not item['text'].strip() or len(item['text']) > 255:
            raise ValueError('Override explanation must contain 1–255 characters.')
    return plan

def prepare(plan, now=None, draft=False):
    validate(plan)
    now = now or datetime.now(timezone.utc)
    rows = sorted((r for r in plan['courses'] if r['selected']), key=lambda r: r['priority'])
    errors, warnings, numbers, seen_courses, seen_crns = [], [], [], set(), set()
    secured = {course_key(r['course']) for r in plan['courses'] if r['status'] in {'registered', 'uncertain'}}
    for r in rows:
        course = course_key(r['course'])
        if r['status'] == 'registered': continue
        if course in secured:
            errors.append(course + ': registered or uncertain result exists. Reconcile SUIS first.')
        if course in seen_courses: errors.append(course + ': select only one alternative.')
        seen_courses.add(course)
        if r['status'] != 'planned': errors.append(course + ': review the recorded outcome before preparing another attempt.')
        conditional = warnings if draft else errors
        if not r['verified'] or not r['source'].strip():
            conditional.append(course + ': eligibility and CRN bundle are not verified for this term.')
        if not r['opens']: conditional.append(course + ': opening time is unknown.')
        elif timestamp(r['opens']) > now: conditional.append(course + ': registration window has not opened.')
        if r['closes'] and timestamp(r['closes']) <= now: conditional.append(course + ': registration window has closed.')
        elif not r['closes']: warnings.append(course + ': closing time is unknown.')
        if not r['meetings']: warnings.append(course + ': meeting times are missing; conflicts cannot be fully checked.')
        if not r['crns'].strip(): errors.append(course + ': missing CRNs.')
        for crn in r['crns'].split():
            if crn in seen_crns: errors.append('Duplicate CRN: ' + crn)
            seen_crns.add(crn)
            numbers.append(crn)
    # Check selected meetings and manually confirmed registered courses.
    active = [r for r in plan['courses'] if r['selected'] or r['status'] == 'registered']
    for i, first in enumerate(active):
        for second in active[i+1:]:
            if course_key(first['course']) == course_key(second['course']): continue
            overlap = any(a[0] == b[0] and max(a[1], b[1]) < min(a[2], b[2])
                          for a in parse_meetings(first['meetings']) for b in parse_meetings(second['meetings']))
            if overlap: errors.append(first['course'] + ' / ' + second['course'] + ': entered meeting times overlap.')
    if any(r.get('catalog_base') for r in active):
        catalog_errors, catalog_warnings = catalog.catalog_checks(plan, catalog.read_catalog())
        errors.extend(catalog_errors)
        warnings.extend(catalog_warnings)
    if not numbers and not errors: errors.append('Select at least one unregistered CRN bundle.')
    return {'ready': not errors, 'errors': list(dict.fromkeys(errors)), 'warnings': list(dict.fromkeys(warnings)),
            'crns': numbers if not errors else [], 'mode': 'draft' if draft else 'readiness',
            'note': 'Local checks only. Seat availability, credit limits, prerequisites and SUIS registration are not verified by this app.'}

def read_plan():
    return validate(json.loads(DATA.read_text(encoding='utf-8'))) if DATA.exists() else blank()

def save_plan(plan):
    validate(plan)
    previous = read_plan()
    if plan['revision'] != previous['revision']:
        raise ConflictError('Another tab saved a newer plan. Export your changes before reloading.')
    if plan['term'] != previous['term']:
        for row in plan['courses']: row['verified'] = False
    old_rows = {(course_key(r['course']), r['section']): r for r in previous['courses']}
    for row in plan['courses']:
        old = old_rows.get((course_key(row['course']), row['section']))
        if old and any(row[k] != old[k] for k in ('crns', 'opens', 'closes', 'source', 'meetings')):
            row['verified'] = False
    plan['revision'] = previous['revision'] + 1
    plan['history'] = previous.get('history', [])[-99:] + [{
        'at': datetime.now(timezone.utc).isoformat(), 'revision': plan['revision'],
        'courses': [{'course': r['course'], 'section': r['section'], 'status': r['status']} for r in plan['courses']]}]
    fd, name = tempfile.mkstemp(dir=DATA.parent, prefix='.plan-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(plan, f, indent=2, ensure_ascii=False)
        if DATA.exists(): shutil.copy2(DATA, DATA.with_suffix('.json.bak'))
        os.replace(name, DATA)
    finally:
        if os.path.exists(name): os.unlink(name)
    if MONITOR:
        try: MONITOR.sync_plan(plan)
        except (ValueError,OSError): pass
    return plan

def review_import(payload):
    """Resolve pasted CRNs atomically; preserve all existing rows and outcomes."""
    current = read_plan()
    if payload.get('revision') != current['revision']:
        raise ConflictError('Plan changed. Preview the CRNs again.')
    if payload.get('term') != current['term']:
        raise ValueError('Term changed. Preview the CRNs again.')
    data = catalog.read_catalog()
    if data['term'] != current['term']:
        raise ValueError('Refresh the catalog for the selected term first.')
    if 'catalog_stamp' in payload and payload['catalog_stamp'] != data['fetched_at']:
        raise ConflictError('Catalog changed. Preview the CRNs again.')
    raw = payload.get('text')
    if not isinstance(raw, str) or len(raw) > 4000:
        raise ValueError('Paste up to 80 five-digit CRNs.')
    tokens = re.split(r'[\s,;]+', raw.strip())
    if not tokens or len(tokens) > 80 or any(not re.fullmatch(r'[0-9]{5}', x) for x in tokens):
        raise ValueError('Use five-digit CRNs separated by spaces, tabs, newlines or commas.')
    numbers = list(dict.fromkeys(tokens))
    index = {o['crn']: (c, o) for c in data['courses'] for o in c['offerings']}
    missing = [n for n in numbers if n not in index]
    if missing:
        raise ValueError('CRNs absent from this catalog: ' + ', '.join(missing) + '. Nothing imported.')
    next_plan = json.loads(json.dumps(current))
    resolved = []
    for number in numbers:
        c, o = index[number]
        matching = [x for x in next_plan['courses'] if number in x['crns'].split()]
        if matching:
            action = 'Already saved'
        else:
            row = catalog.catalog_row(c, o, current['term'])
            occupied = any(course_key(x['course']) == course_key(row['course']) and
                           (x['selected'] or x['status'] in {'registered', 'uncertain'} or x.get('locked'))
                           for x in next_plan['courses'])
            row['selected'] = not occupied
            next_plan['courses'].append(row)
            action = 'Save alternative' if occupied else 'Add to timetable'
        resolved.append(dict(crn=number, course=c['code']+o['type'], section=o['section'],
                             meetings=catalog.meeting_text(o), unknown_times=o['unknown_times'], action=action))
    validate(next_plan)
    check = prepare(next_plan, draft=True)
    return next_plan, dict(rows=resolved, revision=current['revision'], term=current['term'],
                           catalog_stamp=data['fetched_at'], duplicates=len(tokens)-len(numbers),
                           errors=check['errors'], warnings=check['warnings'])

def monitor_view():
    snap=seat_monitor().snapshot();p=read_plan();cat=catalog.read_catalog()
    snap['combinations']=choices.combinations(p,snap)
    snap['opportunities']=[]
    for crn in snap['crns']:
        try:
            _,change=choices.candidate(p,crn,snap,parse_meetings,cat)
            if change['from']:snap['opportunities'].append(change)
        except ValueError:pass
    return snap

def review_choice(payload):
    p=read_plan()
    if payload.get('revision')!=p['revision']:raise ConflictError('Plan changed. Review the choice again.')
    updated,change=choices.candidate(p,payload.get('crn',''),seat_monitor().snapshot(),parse_meetings,catalog.read_catalog())
    checked=prepare(updated,draft=True)
    if not checked['ready']:raise ValueError('; '.join(checked['errors']))
    return updated,dict(change,revision=p['revision'],warnings=checked['warnings'],crns=checked['crns'])

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def reply(self, value, code=200, mime='application/json'):
        body = value if isinstance(value, bytes) else value.encode() if isinstance(value, str) else json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', mime + ('; charset=utf-8' if mime.startswith('text/') or mime == 'application/json' else ''))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()
        self.wfile.write(body)
    def host_ok(self): return self.headers.get('Host') == '127.0.0.1:' + str(self.server.server_port)
    def do_GET(self):
        if not self.host_ok(): return self.reply({'error': 'Invalid host'}, 403)
        try:
            if self.path == '/api/bridge/plan':
                if not secrets.compare_digest(self.headers.get('X-Bridge-Key',''),BRIDGE_TOKEN): return self.reply({'error':'Reconnect the extension from the local app.'},403)
                p=read_plan();result=prepare(p,draft=True)
                return self.reply(dict(result,term=p['term'],revision=p['revision'],generated_at=datetime.now(timezone.utc).isoformat()))
            if self.path == '/mock':
                return self.reply((ROOT/'mock.html').read_text(encoding='utf-8').replace('__TERM__',read_plan()['term']),mime='text/html')
            if self.path == '/':
                return self.reply((ROOT / 'index.html').read_text(encoding='utf-8').replace('__TOKEN__', TOKEN), mime='text/html')
            if self.path in ASSETS:
                path, mime = ASSETS[self.path]
                return self.reply((ROOT / path).read_bytes(), mime=mime)
            if self.path == '/api/phone': return self.reply(phone_alerts().status())
            if self.path == '/api/seats': return self.reply(monitor_view())
            if self.path == '/api/catalog': return self.reply(catalog.read_catalog())
            if self.path == '/api/rules': return self.reply(json.loads((ROOT / 'data/spring-rules.json').read_text(encoding='utf-8')))
            if self.path == '/api/plan': return self.reply(read_plan())
        except (ValueError, OSError) as exc:
            return self.reply({'error': 'Could not load local file: ' + str(exc)}, 500)
        return self.reply({'error': 'Not found'}, 404)
    def do_POST(self):
        if not self.host_ok() or self.headers.get('X-Local-Token') != TOKEN:
            return self.reply({'error': 'Invalid local request'}, 403)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 1000000: raise ValueError('Request size invalid.')
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload,dict): raise ValueError('Expected JSON object.')
            if self.path == '/api/crns/preview': return self.reply(review_import(payload)[1])
            if self.path == '/api/crns/import':
                if not payload.get('catalog_stamp'): raise ValueError('Preview the CRNs before importing.')
                return self.reply(save_plan(review_import(payload)[0]))
            if self.path == '/api/phone/connect': return self.reply(phone_alerts().connect(payload.get('token')))
            if self.path == '/api/phone/pair': return self.reply(phone_alerts().pair())
            if self.path == '/api/phone/config': return self.reply(phone_alerts().configure(payload))
            if self.path == '/api/phone/test': return self.reply(phone_alerts().test())
            if self.path == '/api/phone/disconnect': return self.reply(phone_alerts().disconnect())
            if self.path == '/api/choice/review': return self.reply(review_choice(payload)[1])
            if self.path == '/api/choice/apply': return self.reply(save_plan(review_choice(payload)[0]))
            if self.path == '/api/seats/config':
                if payload.get('follow_plan'):
                    current=read_plan();payload['term']=current['term'];payload['crns']=choices.watch_crns(current,payload.get('backups',False))
                return self.reply(seat_monitor().configure(payload))
            if self.path == '/api/seats/start':
                if seat_monitor().sync_plan(read_plan()) is False: raise ValueError(seat_monitor().reason)
                return self.reply(seat_monitor().start())
            if self.path == '/api/seats/stop': return self.reply(seat_monitor().stop())
            if self.path == '/api/bridge-key': return self.reply({'key':BRIDGE_TOKEN})
            if self.path == '/api/catalog-refresh':
                return self.reply(catalog.refresh(payload.get('term', '')))
            plan = validate(payload)
            if self.path == '/api/solve': return self.reply(catalog.solve(plan, catalog.read_catalog()))
            if self.path == '/api/save': return self.reply(save_plan(plan))
            if self.path in {'/api/prepare', '/api/draft'}:
                return self.reply(prepare(plan, draft=self.path.endswith('draft')))
            return self.reply({'error': 'Not found'}, 404)
        except ConflictError as exc: return self.reply({'error': str(exc)}, 409)
        except (ValueError, TypeError, KeyError, OSError) as exc: return self.reply({'error': str(exc)}, 400)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--data', type=Path, help='Optional plan file; default: plan.json beside app.py')
    args = parser.parse_args()
    if args.data: DATA = args.data.resolve()
    try: server = HTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as exc:
        raise SystemExit('Could not start. Stop the older app with Ctrl+C, then try again. Details: ' + str(exc))
    url = 'http://127.0.0.1:' + str(server.server_port)
    print('Registration Sniper 0.6.2 — local app\n' + url + '\nCtrl+C to stop.')
    if not args.no_browser: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        if MONITOR: MONITOR.close()
        server.server_close()
