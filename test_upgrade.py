import copy
import json
import unittest
import test_catalog
import app,catalog

class UpgradeTests(unittest.TestCase):
    def fixture(self):return test_catalog.SolverTests().fixture()
    def test_saved_scope_never_chooses_unsaved_section(self):
        c,p=self.fixture();p['solver_scope']='saved'
        self.assertFalse(catalog.solve(p,c)['found'])
        r=catalog.catalog_row(c['courses'][0],c['courses'][0]['offerings'][1],p['term']);r['selected']=False;p['courses'].append(r)
        self.assertTrue(catalog.solve(p,c)['found'])
    def test_ranked_fallbacks(self):
        c,p=self.fixture();p['solver_scope']='saved'
        o=copy.deepcopy(c['courses'][0]['offerings'][1]);o['crn']='99994';o['section']='C';c['courses'][0]['offerings'].append(o)
        for rank,offering in [(9,c['courses'][0]['offerings'][1]),(1,o)]:
            r=catalog.catalog_row(c['courses'][0],offering,p['term']);r.update(selected=False,fallback_rank=rank);p['courses'].append(r)
        result=catalog.solve(p,c)
        self.assertTrue(result['found']);self.assertIn('99994',[r['row']['crns'] for r in result['choices']])
    def test_lock_prevents_moving_conflicting_target(self):
        c,p=self.fixture();p['courses'][0]['locked']=True
        self.assertFalse(catalog.solve(p,c)['found'])
    def test_duplicate_active_component_blocked(self):
        c,p=self.fixture();p['courses'].append(copy.deepcopy(p['courses'][0]));p['courses'][0]['locked']=True
        with self.assertRaises(ValueError):catalog.solve(p,c)
    def test_diff_added_removed_and_changed(self):
        old,_=self.fixture();new=copy.deepcopy(old)
        new['courses'][0]['offerings'][0]['meetings'][0]['start']=600
        new['courses'][0]['offerings'].pop(1)
        added=copy.deepcopy(new['courses'][1]['offerings'][0]);added['crn']='99999';new['courses'][1]['offerings'].append(added)
        diff=catalog.compare_catalogs(old,new)
        self.assertEqual({d['kind'] for d in diff},{'added','removed','changed'})
        self.assertIn('meetings',next(d for d in diff if d['kind']=='changed')['fields'])
        self.assertEqual(catalog.compare_catalogs(old,copy.deepcopy(old)),[])
    def test_cross_term_diff_not_compared(self):
        c,_=self.fixture();new=copy.deepcopy(c);new['term']='202602'
        self.assertEqual(catalog.compare_catalogs(c,new),[])
    def test_old_plan_preserves_legacy_drafts(self):
        _,p=self.fixture();p['overrides']=[dict(course='TEST101',kind='Approval Needed',text='Legacy draft.',status='draft')]
        r=app.validate(p)
        self.assertEqual(r['overrides'][0]['text'],'Legacy draft.')
        self.assertEqual(r['courses'][0]['fallback_rank'],50)
        self.assertFalse(r['courses'][0]['locked'])

if __name__=='__main__':unittest.main()
