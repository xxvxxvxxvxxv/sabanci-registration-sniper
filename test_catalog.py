import copy
import unittest
from pathlib import Path
import catalog
import app

class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=catalog.read_catalog()
        cls.cs=next(c for c in cls.catalog['courses'] if c['code']=='CS 303')
    def test_snapshot_integrity(self):
        crns=[o['crn'] for c in self.catalog['courses'] for o in c['offerings']]
        self.assertEqual(len(crns),len(set(crns)))
        self.assertEqual(len(crns),self.catalog['section_count'])
        self.assertGreater(len(self.catalog['courses']),400)
    def test_lecture_crn_owns_multiple_meetings(self):
        o=next(o for o in self.cs['offerings'] if o['crn']=='10119')
        r=catalog.catalog_row(self.cs,o,'202601')
        self.assertEqual(r['crns'],'10119')
        self.assertEqual(len(app.parse_meetings(r['meetings'])),2)
        self.assertIn('Thu 12:40-14:30',r['meetings'])
    def test_independent_lab_and_lecture(self):
        choices=[next(o for o in self.cs['offerings'] if o['crn']==crn) for crn in ['10119','10123']]
        p=app.blank();p['courses']=[catalog.catalog_row(self.cs,o,'202601') for o in choices]
        result=app.prepare(p,draft=True)
        self.assertEqual(result['crns'],['10119','10123'])
        self.assertTrue(any('pairing' in w for w in result['warnings']))
    def test_term_mismatch_blocks_draft(self):
        p=app.blank();p['courses']=[catalog.catalog_row(self.cs,self.cs['offerings'][0],'202601')];p['term']='202602'
        self.assertFalse(app.prepare(p,draft=True)['ready'])
    def test_changed_meeting_detected(self):
        p=app.blank();p['courses']=[catalog.catalog_row(self.cs,self.cs['offerings'][0],'202601')]
        p['courses'][0]['meetings']='Mon 08:00-09:00'
        self.assertFalse(app.prepare(p,draft=True)['ready'])
    def test_public_html_parser_and_wrong_term(self):
        import json
        courses={'TEST 101':{'name':'Test','offerings':[{'crn':'99991','type':'','group':'A','instructors':'Test','schedule':[{'day':'Monday','start':'9:40 AM','end':'10:30 AM','place':'Test room'}]}]}}
        flight='0:["id","202601","d"]\n7:{"courses":'+json.dumps(courses)+'}'
        html='<script>self.__next_f.push('+json.dumps([1,flight])+')</script>'
        self.assertEqual(catalog.parse_page(html,'202601')['section_count'],1)
        with self.assertRaises(ValueError):catalog.parse_page(html,'202602')
    def test_tba_is_not_faked_as_midnight(self):
        c=catalog.normalize({'TEST 101':{'offerings':[{'crn':'99991','schedule':[{'day':'TBA','start':'','end':'$undefined'}]}]}},'202601')
        o=c['courses'][0]['offerings'][0]
        self.assertEqual(o['meetings'],[]);self.assertTrue(o['unknown_times'])

class SolverTests(unittest.TestCase):
    def fixture(self):
        raw={code:{'name':code,'offerings':[dict(crn=crn,type='',group=section,instructors='',schedule=[dict(day='Monday',start=start,end=end,place='Test')]) for crn,section,start,end in rows]} for code,rows in {
          'TEST 101':[('99991','A','9:00 AM','10:00 AM'),('99992','B','11:00 AM','12:00 PM')],
          'TEST 102':[('99993','A','9:30 AM','10:30 AM')]}.items()}
        cat=catalog.normalize(raw,'202601');p=app.blank();p['solver_scope']='catalog';p['courses']=[catalog.catalog_row(c,c['offerings'][0],'202601') for c in cat['courses']]
        return cat,p
    def test_resolves_conflict_without_mutating_plan(self):
        c,p=self.fixture();before=copy.deepcopy(p);r=catalog.solve(p,c)
        self.assertTrue(r['found']);self.assertEqual(p,before)
        self.assertEqual({x['row']['crns'] for x in r['choices']},{'99992','99993'})
    def test_registered_section_is_fixed(self):
        c,p=self.fixture();p['courses'][0]['status']='registered'
        self.assertFalse(catalog.solve(p,c)['found'])
    def test_uncertain_outcome_blocks_search(self):
        c,p=self.fixture();p['courses'][0]['status']='uncertain'
        with self.assertRaises(ValueError):catalog.solve(p,c)
    def test_tba_candidate_not_selected(self):
        c,p=self.fixture();c['courses'][0]['offerings'][1]['unknown_times']=True
        self.assertFalse(catalog.solve(p,c)['found'])
    def test_full_backup_is_not_suggested(self):
        c,p=self.fixture();backup=catalog.catalog_row(c['courses'][0],c['courses'][0]['offerings'][1],'202601');backup.update(selected=False,status='full');p['courses'].append(backup)
        self.assertFalse(catalog.solve(p,c)['found'])

if __name__=='__main__':unittest.main()
