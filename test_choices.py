import copy
import tempfile
import unittest
from pathlib import Path
from datetime import datetime,timezone
from unittest.mock import patch
import app,choices
from seats import Monitor
from phone import Phone


def row(course,crn,selected=True,meeting='Mon 09:40-10:30',status='planned'):
    return dict(course=course,section=crn,crns=crn,selected=selected,status=status,priority=1,meetings=meeting,
                catalog_base='CS303',catalog_type='L' if course.endswith('L') else '',catalog_term='202601',
                fallback_rank=50,locked=False,verified=False,source='',notes='',opens='',closes='')


def fixture():
    plan=app.blank();plan['courses']=[row('CS303','10119'),row('CS303L','10123',meeting='Tue 09:40-10:30'),row('CS303L','12545',False,meeting='Wed 09:40-10:30')]
    snap=dict(term='202601',cycle_seconds=120,observations={c:{'remaining':2,'available':2,'checked_at':datetime.now(timezone.utc).isoformat()} for c in ['10119','10123','12545']})
    return plan,snap


class ChoiceTests(unittest.TestCase):
    def test_watch_only_relevant_backups(self):
        p,s=fixture();p['courses'].append(row('HUM101','99999',False))
        self.assertEqual(choices.watch_crns(p),['10119','10123'])
        self.assertEqual(choices.watch_crns(p,True),['10119','10123','12545'])
        p['courses'][1]['status']='registered'
        self.assertEqual(choices.watch_crns(p,True),['10119'])

    def test_combination_full_unknown_and_registered(self):
        p,s=fixture();self.assertEqual(choices.combinations(p,s)[0]['state'],'available')
        s['observations']['10123']['available']=0
        self.assertEqual(choices.combinations(p,s)[0]['state'],'full')
        p['courses'][1]['status']='registered';self.assertEqual(choices.combinations(p,s)[0]['state'],'available')
        s['observations']['10119']['error']='timeout';self.assertEqual(choices.combinations(p,s)[0]['state'],'unknown')

    def test_explicit_replacement_does_not_mutate_input_or_compare_names(self):
        p,s=fixture();before=copy.deepcopy(p);p['courses'][0]['notes']='Instructor X';p['courses'][2]['notes']='Instructor Y'
        updated,change=choices.candidate(p,'12545',s,app.parse_meetings)
        self.assertEqual(change['from'],'10123');self.assertTrue(updated['courses'][2]['selected'])
        self.assertFalse(updated['courses'][1]['selected']);self.assertFalse(p['courses'][2]['selected'])

    def test_full_companion_blocks_replacement(self):
        p,s=fixture();s['observations']['10119']['available']=0
        with self.assertRaisesRegex(ValueError,'Other selected'):choices.candidate(p,'12545',s,app.parse_meetings)

    def test_stale_error_conflict_locked_and_registered_rejected(self):
        for mode in ['stale','error','conflict','locked','registered','uncertain']:
            p,s=fixture()
            if mode=='stale':s['observations']['12545']['checked_at']='2020-01-01T00:00:00+00:00'
            elif mode=='error':s['observations']['12545']['error']='timeout'
            elif mode=='conflict':p['courses'][2]['meetings']=p['courses'][0]['meetings']
            elif mode=='locked':p['courses'][1]['locked']=True
            else:p['courses'][1]['status']=mode
            with self.subTest(mode=mode),self.assertRaises(ValueError):choices.candidate(p,'12545',s,app.parse_meetings)

    def test_incomplete_meetings_do_not_claim_fit(self):
        p,s=fixture();cat={'courses':[{'offerings':[{'crn':'12545','unknown_times':True}]}]}
        with self.assertRaisesRegex(ValueError,'incomplete'):choices.candidate(p,'12545',s,app.parse_meetings,cat)

    def test_following_plan_preserves_monitor_spacing(self):
        p,s=fixture()
        with tempfile.TemporaryDirectory() as folder:
            m=Monitor(Path(folder)/'monitor.json');m.configure(dict(term='202601',crns=['10119','10123'],interval=120,follow_plan=True,backups=True));m.start(background=False)
            before=m.due['10119'];m.sync_plan(p)
            self.assertTrue(m.running);self.assertEqual(m.state['crns'],['10119','10123','12545']);self.assertEqual(m.due['10119'],before)
            p['courses']=[];self.assertIs(m.sync_plan(p),False);self.assertFalse(m.running);m.close()

    def test_review_rejects_stale_revision(self):
        p,s=fixture()
        with patch.object(app,'read_plan',return_value=p):
            with self.assertRaises(app.ConflictError):app.review_choice({'revision':99,'crn':'12545'})


class PhoneTests(unittest.TestCase):
    def test_pairing_requires_matching_private_command_and_never_returns_token(self):
        with tempfile.TemporaryDirectory() as folder:
            updates=[];calls=[]
            def transport(token,method,payload):
                calls.append((method,payload));return updates if method=='getUpdates' else {}
            f=Phone(Path(folder)/'test.phone.json',transport)
            status=f.connect('123456:'+('x'*30));self.assertNotIn('token',status)
            with self.assertRaises(ValueError):f.pair()
            updates.append({'message':{'chat':{'id':12,'type':'private'},'text':'/start '+status['pair_code']}})
            self.assertTrue(f.pair()['paired']);f.configure({'enabled':True,'details':False})
            f.enqueue({'kind':'opened','term':'202601','crn':'10119','remaining':2});f.jobs.join()
            text=calls[-1][1]['text'];self.assertNotIn('10119',text);self.assertNotIn('202601',text)
            self.assertEqual(f.path.stat().st_mode&0o777,0o600)
            f.configure({'enabled':False,'details':False});count=len(calls)
            f.enqueue({'kind':'stopped'});self.assertEqual(len(calls),count)
            f.disconnect();self.assertFalse(f.path.exists())

    def test_group_chat_does_not_pair(self):
        with tempfile.TemporaryDirectory() as folder:
            f=Phone(Path(folder)/'phone.json');state=f.connect('123456:'+('y'*30))
            f.transport=lambda *args:[{'message':{'chat':{'id':-99,'type':'group'},'text':'/start '+state['pair_code']}}]
            with self.assertRaises(ValueError):f.pair()

if __name__=='__main__':unittest.main()
