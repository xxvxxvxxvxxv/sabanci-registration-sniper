"""Public, read-only seat observations. One worker; never a registration request."""
import copy
import json
import os
import re
import tempfile
import threading
import time
import choices
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener

BASE = 'https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched'
MIN_GAP = 10  # Across ALL watched CRNs, not per tab.
MAX_WATCH = 20


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def source_url(term, crn):
    if not re.fullmatch(r'[0-9]{6}', term) or not re.fullmatch(r'[0-9]{5}', crn):
        raise ValueError('Expected a six-digit term and five-digit CRN.')
    return f'{BASE}?term_in={term}&crn_in={crn}'


class Blocked(ValueError):
    """Stop the entire monitor; never evade or retry an access block."""


class SeatHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.target = 0
        self.tables = []
        self.rows = []
        self.row = None
        self.cell = None
        self.text = []
        self.links = []

    def end_cell(self):
        if self.cell is not None and self.row is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
        self.cell = None

    def end_row(self):
        self.end_cell()
        if self.row is not None:
            self.rows.append(self.row)
        self.row = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a':
            self.links.append(a.get('href', ''))
        if tag == 'table':
            self.depth += 1
            if 'seating numbers' in a.get('summary', '').lower():
                self.target = self.depth
                self.rows = []
        if self.target and self.depth == self.target:
            if tag == 'tr':
                self.end_row()  # Banner omits closing </tr> after its header.
                self.row = []
            elif tag in ('td', 'th'):
                self.end_cell()
                self.cell = []

    def handle_endtag(self, tag):
        if self.target and self.depth == self.target:
            if tag in ('td', 'th'):
                self.end_cell()
            elif tag == 'tr':
                self.end_row()
            elif tag == 'table':
                self.end_row()
                self.tables.append(self.rows)
                self.target = 0
        if tag == 'table':
            self.depth = max(0, self.depth - 1)

    def handle_data(self, data):
        self.text.append(data)
        if self.cell is not None:
            self.cell.append(data)


def parse_seats(html, term, crn):
    source_url(term, crn)
    parser = SeatHTML()
    parser.feed(html)
    full = ' '.join(' '.join(parser.text).split())
    identity = any(
        (parse_qs(urlparse(link).query).get('crn') == [crn] and
         parse_qs(urlparse(link).query).get('term') == [term]) or
        (urlparse(link).path == '/prod/bwckctlg.p_display_courses' and
         parse_qs(urlparse(link).query).get('term_in') == [term])
        for link in parser.links)
    if not identity or not re.search(r' - ' + re.escape(crn) + r' - ', full):
        raise ValueError('Course identity missing or different. Observation unavailable.')
    if len(parser.tables) != 1:
        raise ValueError('Seat table unavailable. Source may have changed.')
    rows = parser.tables[0]
    if not any(row == ['', 'Capacity', 'Actual', 'Remaining'] for row in rows):
        raise ValueError('Seat column layout changed.')
    def totals(label, required=True):
        matching = [row for row in rows if row and row[0] == label]
        if not matching and not required:
            return None
        if len(matching) != 1 or len(matching[0]) != 4:
            raise ValueError(label + ' totals unavailable.')
        if not all(re.fullmatch(r'-?[0-9]+', n) for n in matching[0][1:]):
            raise ValueError('Non-numeric ' + label + ' totals.')
        cap, actual, remaining = map(int, matching[0][1:])
        if cap < 0 or actual < 0 or cap - actual != remaining:
            raise ValueError('Inconsistent ' + label + ' totals.')
        return {'capacity': cap, 'actual': actual, 'remaining': remaining}
    result = totals('Seats')
    cross = totals('Cross List Seats', required=False)
    result.update(source=source_url(term, crn), cross_list=cross,
                  available=min(result['remaining'], cross['remaining']) if cross else result['remaining'])
    return result



class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Blocked('Source redirected. Monitoring stopped; inspect the official page.')


def fetch_seats(term, crn):
    request = Request(source_url(term, crn), headers={
        'User-Agent': 'RegistrationSniper/0.6.2 (public seat monitor)',
        'Accept': 'text/html'})
    try:
        with build_opener(NoRedirect).open(request, timeout=15) as response:
            if 'text/html' not in response.headers.get('Content-Type', ''):
                raise ValueError('Unexpected source content type.')
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                raise ValueError('Source response too large.')
            html = raw.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
    except HTTPError as exc:
        if exc.code in (401, 403, 429) or 300 <= exc.code < 400:
            raise Blocked(f'HTTP {exc.code}. Monitoring stopped. No automatic retry.') from exc
        raise ValueError(f'Source HTTP {exc.code}.') from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise ValueError('Source connection failed or timed out.') from exc
    if re.search(r'captcha|access denied|temporarily blocked', html, re.I):
        raise Blocked('Access challenge detected. Monitoring stopped.')
    return parse_seats(html, term, crn)


class Monitor:
    def __init__(self, path, fetcher=fetch_seats, on_event=None):
        self.on_event = on_event
        self.path = path
        self.fetcher = fetcher
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.closed = False
        self.thread = None
        self.running = False
        self.reason = ''
        self.generation = 0
        self.last_request = float('-inf')
        self.due = {}
        self.state = {'term': '202601', 'crns': [], 'interval': 120, 'observations': {}, 'events': [], 'serial': 0, 'follow_plan': False, 'backups': False}
        if path.exists():
            try:
                state = json.loads(path.read_text(encoding='utf-8'))
                self.validate_config(state)
                if not isinstance(state.get('observations'), dict) or not isinstance(state.get('events'), list):
                    raise ValueError('Invalid monitor data.')
                if type(state.get('serial')) is not int:
                    raise ValueError('Invalid event counter.')
                self.state = state
            except (ValueError, TypeError, KeyError):
                self.reason = 'Saved monitoring data could not be loaded. Configure the watch list again.'

    @staticmethod
    def validate_config(payload):
        if any(type(payload.get(k,False)) is not bool for k in ('follow_plan','backups')): raise ValueError('Invalid watch preference.')
        crns = payload.get('crns')
        if not isinstance(crns, list) or not 1 <= len(crns) <= MAX_WATCH or len(set(crns)) != len(crns):
            raise ValueError('Watch 1–20 unique CRNs.')
        for crn in crns:
            if not isinstance(crn, str) or not isinstance(payload.get('term'), str):
                raise ValueError('Invalid term or CRN.')
            source_url(payload['term'], crn)
        if type(payload.get('interval')) is not int or payload['interval'] not in (120, 300, 600):
            raise ValueError('Check interval must be 120, 300 or 600 seconds.')

    def _save(self):
        fd, temp = tempfile.mkstemp(dir=self.path.parent, prefix='.monitor-')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as out:
                json.dump(self.state, out, ensure_ascii=False, indent=2)
            os.replace(temp, self.path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)

    def configure(self, payload):
        self.validate_config(payload)
        with self.lock:
            if self.running:
                raise ValueError('Pause monitoring before changing the watch list.')
            same_term = self.state['term'] == payload['term']
            old = self.state['observations'] if same_term else {}
            self.state.update(term=payload['term'], crns=list(payload['crns']), interval=payload['interval'],
                              observations={c: old[c] for c in payload['crns'] if c in old},
                              follow_plan=payload.get('follow_plan',False), backups=payload.get('backups',False))
            if not same_term:
                self.state['events'] = []
            self.generation += 1
            self.reason = ''
            self._save()
        return self.snapshot()

    def sync_plan(self, plan):
        with self.lock:
            if not self.state.get('follow_plan'):return
            crns=choices.watch_crns(plan,self.state.get('backups',False))
            if not crns or len(crns)>MAX_WATCH:
                self.running=False
                self.reason='Monitoring paused: the plan must contain 1–20 watchable CRNs.'
                return False
            if crns==self.state['crns'] and plan['term']==self.state['term']:return
            running=self.running
            due=self.due.copy() if plan['term']==self.state['term'] else {}
            self.running=False
            try:
                self.configure({'term':plan['term'],'crns':crns,'interval':self.state['interval'],
                                'follow_plan':True,'backups':self.state.get('backups',False)})
            except Exception:
                self.reason='Monitoring paused: watch list could not be saved.'
                raise
            self.due={c:due.get(c,time.monotonic()) for c in crns}
            self.running=running
            self.wake.set()

    def start(self, background=True):
        with self.lock:
            self.validate_config(self.state)
            if not self.running:
                self.running = True
                self.reason = ''
                self.generation += 1
                self.due = {c: time.monotonic() for c in self.state['crns']}
            if background and self.thread is None:
                self.thread = threading.Thread(target=self._worker, daemon=True, name='public-seat-monitor')
                self.thread.start()
            self.wake.set()
        return self.snapshot()

    def stop(self):
        with self.lock:
            self.running = False
            self.generation += 1
            self.wake.set()
        return self.snapshot()

    def snapshot(self):
        with self.lock:
            result = copy.deepcopy(self.state)
            cycle = max(result['interval'], len(result['crns']) * MIN_GAP)
            result.update(running=self.running, reason=self.reason, cycle_seconds=cycle, min_gap=MIN_GAP,
                          server_time=now_iso())
            for crn, observation in result['observations'].items():
                try:
                    age = time.time() - datetime.fromisoformat(observation['checked_at']).timestamp()
                    observation['stale'] = age > cycle * 2
                except (ValueError, KeyError, TypeError):
                    observation['stale'] = True
            return result

    def _event(self, kind, crn, remaining=None):
        self.state['serial'] += 1
        self.state['events'].append({'id': self.state['serial'], 'at': now_iso(), 'kind': kind,
                                     'term': self.state['term'], 'crn': crn, 'remaining': remaining})
        self.state['events'] = self.state['events'][-100:]
        if self.on_event:
            try:self.on_event(copy.deepcopy(self.state['events'][-1]))
            except Exception:pass

    def step(self, mono=None):
        """One due observation. Clock/fetcher injection permits network-free tests."""
        mono = time.monotonic() if mono is None else mono
        with self.lock:
            if not self.running or mono - self.last_request < MIN_GAP:
                return False
            crn = min(self.state['crns'], key=lambda c: self.due.get(c, 0))
            if self.due.get(crn, 0) > mono:
                return False
            term, generation = self.state['term'], self.generation
            self.last_request = mono
        try:
            result, error, blocked = self.fetcher(term, crn), '', False
        except (ValueError, OSError) as exc:
            result, error, blocked = None, str(exc), isinstance(exc, Blocked)
        with self.lock:
            # A result from before Pause / reconfiguration cannot mutate the new plan.
            if generation != self.generation:
                return True
            old = self.state['observations'].get(crn, {})
            observation = dict(old, attempted_at=now_iso(), error=error)
            if result is not None:
                previous = old.get('available', old.get('remaining'))
                available = result.get('available', result['remaining'])
                if previous is not None and previous <= 0 < available:
                    self._event('opened', crn, available)
                observation.update(result, checked_at=now_iso(), failures=0)
            else:
                observation['failures'] = old.get('failures', 0) + 1
            self.state['observations'][crn] = observation
            self.due[crn] = mono + self.state['interval'] * (2 ** min(observation.get('failures', 0), 3))
            if blocked or observation.get('failures', 0) >= 3:
                self.running = False
                self.reason = error + ' Inspect the source before restarting.'
                self._event('stopped', crn)
            self._save()
        return True

    def _worker(self):
        while not self.closed:
            try:
                self.step()
            except Exception:
                with self.lock:
                    self.running = False
                    self.reason = 'Monitoring stopped after an internal or storage error.'
            self.wake.wait(1)
            self.wake.clear()

    def close(self):
        self.stop()
        self.closed = True
        self.wake.set()
        if self.thread:
            self.thread.join(timeout=1)
