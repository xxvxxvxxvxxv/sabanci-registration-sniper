import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from seats import Blocked, Monitor, parse_seats


def page(remaining=0, crn='10119', term='202601'):
    return f'''<table><tr><th>Course - {crn} - CS 303 - A
    <a href="https://www.sabanciuniv.edu/syllabus/?crn={crn}&amp;term={term}">Syllabus</a></th></tr>
    <tr><td><table summary="This layout table is used to present the seating numbers.">
    <caption>Registration Availability</caption><tr><td>&nbsp;</td><th>Capacity</th><th>Actual</th><th>Remaining</th>
    <tr><th><span>Seats</span></th><td>200</td><td>{200-remaining}</td><td>{remaining}</td></tr>
    <tr><th>Waitlist Seats</th><td>10</td><td>0</td><td>10</td></tr></table></td></tr></table>'''


class ParserTests(unittest.TestCase):
    def test_banner_implicit_header_row_close_and_waitlist(self):
        self.assertEqual(parse_seats(page(), '202601', '10119')['remaining'], 0)
        self.assertEqual(parse_seats(page(2), '202601', '10119')['remaining'], 2)

    def test_wrong_term_crn_and_login_never_become_zero(self):
        for html in (page(term='202602'), page(crn='99999'), '<html>Login</html>'):
            with self.assertRaises(ValueError):
                parse_seats(html, '202601', '10119')

    def test_changed_columns_or_inconsistent_counts_rejected(self):
        for html in (page().replace('Actual', 'Reserved'), page().replace('<td>200</td>', '<td>199</td>', 1), page()+page()):
            with self.assertRaises(ValueError):
                parse_seats(html, '202601', '10119')

    def test_negative_remaining_is_full_not_parse_failure(self):
        self.assertEqual(parse_seats(page(-1), '202601', '10119')['remaining'], -1)

    def test_lab_without_syllabus_and_shared_capacity(self):
        html=page(5).replace('https://www.sabanciuniv.edu/syllabus/?crn=10119&amp;term=202601', '/prod/bwckctlg.p_display_courses?term_in=202601')
        html=html.replace('<tr><th>Waitlist Seats', '<tr><th>Cross List Seats</th><td>200</td><td>200</td><td>0</td></tr><tr><th>Waitlist Seats')
        result=parse_seats(html,'202601','10119')
        self.assertEqual(result['remaining'],5)
        self.assertEqual(result['available'],0)
        self.assertEqual(result['cross_list']['capacity'],200)


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'watch.json'
        self.responses = []
        self.calls = []
        def fetch(term, crn):
            self.calls.append((term, crn))
            result = self.responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return parse_seats(page(result, crn), term, crn)
        self.monitor = Monitor(self.path, fetch)
        self.monitor.configure({'term':'202601','crns':['10119'],'interval':120})
        self.monitor.start(background=False)
        self.monitor.due = {'10119':0}

    def tearDown(self):
        self.monitor.close()
        self.temp.cleanup()

    def test_baseline_and_transitions_no_duplicate_alerts(self):
        self.responses = [3, 2, 0, 1, 2, 0, 4]
        for at in range(0, 840, 120):
            self.assertTrue(self.monitor.step(at))
        events = self.monitor.snapshot()['events']
        self.assertEqual([e['remaining'] for e in events], [1,4])
        self.assertEqual(len({e['id'] for e in events}), 2)

    def test_single_global_gap_between_different_crns(self):
        self.monitor.stop()
        self.monitor.configure({'term':'202601','crns':['10119','10123'],'interval':120})
        self.monitor.start(background=False)
        self.monitor.due = {'10119':0,'10123':0}
        self.responses = [0,0]
        self.assertTrue(self.monitor.step(0))
        self.assertFalse(self.monitor.step(9))
        self.assertTrue(self.monitor.step(10))
        self.assertFalse(self.monitor.step(20))
        self.assertEqual(self.calls,[('202601','10119'),('202601','10123')])

    def test_block_stops_all_and_never_retries_automatically(self):
        self.responses = [Blocked('HTTP 429')]
        self.monitor.step(0)
        self.assertFalse(self.monitor.snapshot()['running'])
        self.assertFalse(self.monitor.step(10000))
        self.assertEqual(len(self.calls),1)
        self.assertEqual(self.monitor.snapshot()['events'][0]['kind'],'stopped')
        self.assertNotIn('remaining',self.monitor.snapshot()['observations']['10119'])

    def test_error_preserves_last_success_and_backoff(self):
        self.responses = [0, ValueError('timeout'),1]
        self.monitor.step(0)
        self.monitor.step(120)
        observation = self.monitor.snapshot()['observations']['10119']
        self.assertEqual(observation['remaining'],0)
        self.assertEqual(observation['error'],'timeout')
        self.assertFalse(self.monitor.step(240))
        self.monitor.step(360)
        self.assertEqual(self.monitor.snapshot()['events'][0]['remaining'],1)

    def test_three_errors_pause(self):
        self.responses = [ValueError('timeout')]*3
        for at in [0,240,720]: self.monitor.step(at)
        self.assertFalse(self.monitor.snapshot()['running'])
        self.assertEqual(len(self.calls),3)

    def test_restart_is_paused_with_observations_and_events_saved(self):
        self.responses = [0,1]
        self.monitor.step(0);self.monitor.step(120)
        restored = Monitor(self.path)
        self.assertFalse(restored.snapshot()['running'])
        self.assertEqual(restored.snapshot()['observations']['10119']['remaining'],1)
        self.assertEqual(restored.snapshot()['serial'],1)
        self.assertIsNone(restored.thread)
        restored.close()

    def test_pause_during_fetch_discards_inflight_result(self):
        def fetch(term, crn):
            self.monitor.stop()
            return parse_seats(page(10), term, crn)
        self.monitor.fetcher=fetch
        self.monitor.step(0)
        self.assertEqual(self.monitor.snapshot()['observations'],{})

    def test_term_change_clears_old_observations(self):
        self.responses=[0];self.monitor.step(0);self.monitor.stop()
        self.monitor.configure({'term':'202602','crns':['10119'],'interval':120})
        self.assertEqual(self.monitor.snapshot()['observations'],{})

    def test_configuration_cannot_change_while_running(self):
        with self.assertRaises(ValueError):
            self.monitor.configure({'term':'202601','crns':['10123'],'interval':120})

    def test_stale_is_independent_from_zero(self):
        self.responses=[0];self.monitor.step(0)
        self.monitor.state['observations']['10119']['checked_at']='2020-01-01T00:00:00+00:00'
        observation=self.monitor.snapshot()['observations']['10119']
        self.assertTrue(observation['stale']);self.assertEqual(observation['remaining'],0)


class SeatHTTPTests(unittest.TestCase):
    def test_read_only_snapshot_and_authenticated_controls(self):
        import app
        import json
        import threading
        import urllib.request
        import urllib.error
        from http.server import HTTPServer
        with tempfile.TemporaryDirectory() as directory:
            monitor=Monitor(Path(directory)/'watch.json',lambda term,crn:parse_seats(page(),term,crn))
            with patch.object(app,'MONITOR',monitor):
                server=HTTPServer(('127.0.0.1',0),app.Handler)
                worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
                url=f'http://127.0.0.1:{server.server_port}'
                def post(path,payload,authorized=True):
                    headers={'Content-Type':'application/json'}
                    if authorized:headers['X-Local-Token']=app.TOKEN
                    request=urllib.request.Request(url+path,data=json.dumps(payload).encode(),headers=headers)
                    with urllib.request.urlopen(request) as response:return json.load(response)
                try:
                    with urllib.request.urlopen(url+'/api/seats') as response:
                        self.assertFalse(json.load(response)['running'])
                    self.assertIsNone(monitor.thread)
                    with self.assertRaises(urllib.error.HTTPError) as error:post('/api/seats/start',{},False)
                    self.assertEqual(error.exception.code,403)
                    saved=post('/api/seats/config',{'term':'202601','crns':['10119'],'interval':120})
                    self.assertEqual(saved['crns'],['10119'])
                    with patch.object(monitor,'start',lambda:Monitor.start(monitor,background=False)):
                        self.assertTrue(post('/api/seats/start',{})['running'])
                    self.assertFalse(post('/api/seats/stop',{})['running'])
                finally:
                    monitor.close();server.shutdown();server.server_close();worker.join()

if __name__=='__main__': unittest.main()
