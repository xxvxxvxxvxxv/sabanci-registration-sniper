import copy
import unittest
from datetime import datetime, timezone
from app import prepare, validate

NOW = datetime(2026, 9, 23, 8, tzinfo=timezone.utc)
def row(**updates):
    r = dict(course='TEST101', section='A', priority=1, crns='99991 99992', opens='2026-09-23T10:00:00+03:00', source='Synthetic test fixture only', notes='', status='planned', selected=True, verified=True)
    r.update(updates)
    return r

def plan(*rows):
    return dict(term='202601', courses=list(rows), history=[])

class PreparationTests(unittest.TestCase):
    def test_bundle_and_priority(self):
        result=prepare(plan(row(priority=2), row(course='TEST102',priority=1,crns='99993')),NOW)
        self.assertEqual(result['crns'],['99993','99991','99992'])
    def test_duplicate_alternative_blocks_output(self):
        result=prepare(plan(row(),row(section='B',crns='99994')),NOW)
        self.assertFalse(result['ready'])
        self.assertEqual(result['crns'],[])
    def test_unknown_outcome_prevents_backup(self):
        result=prepare(plan(row(selected=False,status='uncertain'),row(section='B',crns='99994')),NOW)
        self.assertFalse(result['ready'])
    def test_registered_course_excluded(self):
        result=prepare(plan(row(status='registered'),row(course='TEST102',crns='99993')),NOW)
        self.assertEqual(result['crns'],['99993'])
    def test_future_or_unverified_blocks(self):
        for r in [row(opens='2026-09-24T10:00:00+03:00'),row(verified=False),row(source='')]:
            self.assertFalse(prepare(plan(r),NOW)['ready'])
    def test_duplicate_component_crn(self):
        self.assertFalse(prepare(plan(row(crns='99991 99991')),NOW)['ready'])
    def test_timezone_required(self):
        with self.assertRaises(ValueError):
            validate(plan(row(opens='2026-09-23T10:00:00')))


class ExtendedChecks(unittest.TestCase):
    def test_draft_before_opening(self):
        p=plan(row(opens='2026-09-24T10:00:00+03:00'))
        self.assertFalse(prepare(copy.deepcopy(p),NOW)['ready'])
        result=prepare(p,NOW,draft=True)
        self.assertTrue(result['ready'])
        self.assertTrue(any('not opened' in w for w in result['warnings']))
    def test_normalize_course_spaces(self):
        self.assertFalse(prepare(plan(row(course='CS 204'),row(course='cs204',crns='99993')),NOW)['ready'])
    def test_closed_window(self):
        self.assertFalse(prepare(plan(row(closes='2026-09-23T10:30:00+03:00')),NOW)['ready'])
    def test_invalid_window(self):
        with self.assertRaises(ValueError):validate(plan(row(closes='2026-09-22T10:00:00+03:00')))
    def test_overlapping_meetings(self):
        p=plan(row(meetings='Mon 09:40-10:30'),row(course='TEST102',crns='99993',meetings='Mon 10:00-10:50'))
        self.assertFalse(prepare(p,NOW,draft=True)['ready'])
    def test_back_to_back_meetings(self):
        p=plan(row(meetings='Mon 09:40-10:30'),row(course='TEST102',crns='99993',meetings='Mon 10:30-11:20'))
        self.assertTrue(prepare(p,NOW)['ready'])
    def test_registered_course_conflict(self):
        p=plan(row(selected=False,status='registered',meetings='Mon 09:40-10:30'),row(course='TEST102',crns='99993',meetings='Mon 10:00-10:50'))
        self.assertFalse(prepare(p,NOW)['ready'])
    def test_invalid_meeting_minutes(self):
        with self.assertRaises(ValueError):validate(plan(row(meetings='Mon 09:70-10:30')))
    def test_override_length(self):
        p=plan();p['overrides']=[dict(course='TEST101',kind='Pre-Reqs. Waiving',status='draft',text='a'*255)]
        validate(p)
        p['overrides'][0]['text']+='b'
        with self.assertRaises(ValueError):validate(p)

class PersistenceTests(unittest.TestCase):
    def setUp(self):
        import app, tempfile
        from pathlib import Path
        self.app=app;self.tmp=tempfile.TemporaryDirectory();self.old=app.DATA;app.DATA=Path(self.tmp.name)/'plan.json'
    def tearDown(self):
        self.app.DATA=self.old;self.tmp.cleanup()
    def test_backup_and_revision_conflict(self):
        saved=self.app.save_plan(plan(row()))
        self.assertEqual(saved['revision'],1)
        with self.assertRaises(self.app.ConflictError):self.app.save_plan(plan(row()))
        saved['courses'][0]['notes']='changed'
        self.app.save_plan(saved)
        self.assertTrue(self.app.DATA.with_suffix('.json.bak').exists())
        self.assertEqual(self.app.read_plan()['revision'],2)
    def test_term_change_clears_verified(self):
        saved=self.app.save_plan(plan(row()))
        saved['term']='202602';saved['courses'][0]['verified']=True
        saved=self.app.save_plan(saved)
        self.assertFalse(saved['courses'][0]['verified'])
    def test_crn_change_requires_reverification(self):
        saved=self.app.save_plan(plan(row()))
        saved['courses'][0]['crns']='99999'
        saved=self.app.save_plan(saved)
        self.assertFalse(saved['courses'][0]['verified'])
        saved['courses'][0]['verified']=True
        self.assertTrue(self.app.save_plan(saved)['courses'][0]['verified'])
    def test_old_plan_loads(self):
        import json
        p=plan(row());self.app.DATA.write_text(json.dumps(p))
        loaded=self.app.read_plan()
        self.assertEqual(loaded['revision'],0)
        self.assertEqual(loaded['courses'][0]['closes'],'')

class LocalHTTPTests(PersistenceTests):
    def setUp(self):
        super().setUp()
        import threading
        self.server=self.app.HTTPServer(('127.0.0.1',0),self.app.Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();super().tearDown()
    def test_http_save_and_conflict(self):
        import urllib.request, urllib.error, json
        def post(p):return urllib.request.urlopen(urllib.request.Request(self.url+'/api/save',data=json.dumps(p).encode(),headers={'X-Local-Token':self.app.TOKEN}))
        result=json.load(post(plan(row())))
        self.assertEqual(result['revision'],1)
        with self.assertRaises(urllib.error.HTTPError) as caught:post(plan(row()))
        self.assertEqual(caught.exception.code,409)
    def test_request_guard(self):
        import urllib.request, urllib.error
        request=urllib.request.Request(self.url+'/api/save',data=b'{}')
        with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(request)
        self.assertEqual(caught.exception.code,403)
    def test_packaged_assets(self):
        import urllib.request
        for path in ['/','/ui.js','/style.css','/assets/reticle.svg','/seats-ui.js','/assets/heading.otf']:
            response=urllib.request.urlopen(self.url+path)
            self.assertEqual(response.status,200)
            self.assertGreater(len(response.read()),100)

if __name__=='__main__':
    unittest.main()
