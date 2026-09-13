import copy
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch
from http.server import HTTPServer
import app
from phone import Phone
from seats import Monitor, parse_seats
from test_seats import page

CRNS='10119\t10123\t13511\t10350\t10352\t10355\t12131\t10218\t10221\t10690\t10693'

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.data=Path(self.temp.name)/'plan.json'
        self.patcher=patch.multiple(app,DATA=self.data,MONITOR=None)
        self.patcher.start()
    def tearDown(self):
        self.patcher.stop();self.temp.cleanup()
    def payload(self,text=CRNS):
        return dict(text=text,term='202601',revision=app.read_plan()['revision'])
    def test_all_eleven_exact_sections_preserved_with_two_conflicts(self):
        plan,preview=app.review_import(self.payload())
        self.assertFalse(self.data.exists())
        self.assertEqual([r['crns'] for r in plan['courses']],CRNS.split())
        self.assertTrue(all(r['selected'] for r in plan['courses']))
        self.assertEqual(len(preview['errors']),2)
        self.assertTrue(all('overlap' in e for e in preview['errors']))
        self.assertFalse(any(r['verified'] for r in plan['courses']))
    def test_unknown_or_malformed_input_is_atomic(self):
        for text in ['10119 99999','10119 1234','10119oops','',None,'10119 '*81]:
            with self.subTest(text=text),self.assertRaises(ValueError):app.review_import(self.payload(text))
            self.assertFalse(self.data.exists())
    def test_deduplication_and_repeat_import_preserve_rows(self):
        plan,preview=app.review_import(self.payload('10119,10119;\n10123'))
        self.assertEqual(preview['duplicates'],1)
        app.save_plan(plan)
        before=app.read_plan()
        after,result=app.review_import(self.payload('10119 10123'))
        self.assertEqual(before,after)
        self.assertTrue(all(r['action']=='Already saved' for r in result['rows']))
    def test_alternative_does_not_replace_outcomes_locks_or_selection(self):
        initial,_=app.review_import(self.payload('10119 10123'));app.save_plan(initial)
        for status in ['planned','registered','uncertain','full']:
            p=app.read_plan();p['courses'][1]['status']=status;p['courses'][1]['locked']=True
            with patch.object(app,'read_plan',return_value=p):
                after,result=app.review_import(self.payload('12545'))
                self.assertEqual(after['courses'][:2],p['courses'])
                self.assertFalse(after['courses'][-1]['selected'])
                self.assertEqual(result['rows'][0]['action'],'Save alternative')
    def test_stale_revision_term_and_catalog_rejected(self):
        payload=self.payload()
        for changed in [dict(revision=999),dict(term='202602'),dict(catalog_stamp='old')]:
            with self.subTest(changed=changed),self.assertRaises((ValueError,app.ConflictError)):
                app.review_import(dict(payload,**changed))
    def test_http_preview_apply_and_stale_replay(self):
        server=HTTPServer(('127.0.0.1',0),app.Handler)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        def post(route,payload,auth=True):
            req=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/api/crns/'+route,
                data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-Local-Token':app.TOKEN if auth else ''})
            with urllib.request.urlopen(req,timeout=3) as response:return json.load(response)
        try:
            payload=self.payload()
            with self.assertRaises(urllib.error.HTTPError) as e:post('preview',payload,False)
            self.assertEqual(e.exception.code,403)
            preview=post('preview',payload);self.assertFalse(self.data.exists())
            payload['catalog_stamp']=preview['catalog_stamp']
            saved=post('import',payload);self.assertEqual(len(saved['courses']),11)
            with self.assertRaises(urllib.error.HTTPError) as e:post('import',payload)
            self.assertEqual(e.exception.code,409)
            self.assertEqual(len(app.read_plan()['courses']),11)
        finally:server.shutdown();server.server_close();worker.join()

class DeliveryIntegrationTests(unittest.TestCase):
    def test_parsed_seat_transition_reaches_phone_once_and_stops_when_disabled(self):
        with tempfile.TemporaryDirectory() as folder:
            messages=[];updates=[];received=threading.Event()
            def transport(token,method,payload):
                if method=='getUpdates':return updates
                messages.append(payload);received.set();return {}
            phone=Phone(Path(folder)/'phone.json',transport)
            state=phone.connect('123456:'+30*'x')
            updates.append({'message':{'chat':{'id':123,'type':'private'},'text':'/start '+state['pair_code']}})
            phone.pair();phone.configure(dict(enabled=True,details=True))
            values=iter([0,1,2,0,1])
            def fetch(term,crn):return parse_seats(page(next(values),crn,term),term,crn)
            monitor=Monitor(Path(folder)/'monitor.json',fetch,on_event=phone.enqueue)
            monitor.configure(dict(term='202601',crns=['10119'],interval=120))
            monitor.start(background=False);monitor.due={'10119':0}
            try:
                monitor.step(0);self.assertEqual(messages,[])
                monitor.step(120);self.assertTrue(received.wait(2))
                self.assertEqual(len(messages),1);self.assertIn('10119',messages[0]['text'])
                self.assertEqual(messages[0]['chat_id'],123)
                monitor.step(240);self.assertEqual(len(messages),1)
                phone.configure(dict(enabled=False,details=True))
                monitor.step(360);monitor.step(480)
                self.assertEqual(len(monitor.snapshot()['events']),2)
                self.assertEqual(len(messages),1)
            finally:monitor.close();phone.disconnect()
