"""Public Sutable catalog adapter. Reads page data; never contacts SUIS."""
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'data' / 'catalog.json'
SOURCE = 'https://sutable.vercel.app/'
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
_last_refresh = 0

def minutes(value):
    try:
        t = datetime.strptime(value, '%I:%M %p')
        return t.hour * 60 + t.minute
    except (ValueError, TypeError):
        return None

def normalize(courses, term):
    if not isinstance(courses, dict) or not courses:
        raise ValueError('No course catalog found in the public page.')
    result, crns = [], set()
    for code, course in courses.items():
        if not isinstance(course, dict) or not isinstance(course.get('offerings'), list):
            raise ValueError('Public catalog format changed.')
        offerings = []
        for o in course['offerings']:
            crn = o.get('crn', '')
            if not re.fullmatch(r'\d{5}', crn) or crn in crns:
                raise ValueError('Invalid or duplicate CRN in catalog: ' + str(crn))
            crns.add(crn)
            meetings, unknown = [], False
            for m in o.get('schedule', []):
                start, end = minutes(m.get('start')), minutes(m.get('end'))
                if m.get('day') not in DAYS or start is None or end is None or end <= start:
                    unknown = True
                    continue
                meetings.append(dict(day=DAYS.index(m['day']), start=start, end=end, place=m.get('place', '')))
            offerings.append(dict(crn=crn, type=o.get('type', ''), section=o.get('group', ''),
                                  instructor=o.get('instructors', ''), meetings=meetings,
                                  unknown_times=unknown or not meetings))
        result.append(dict(code=code, name=course.get('name', code), offerings=offerings))
    return dict(term=term, source=SOURCE+term, fetched_at=datetime.now(timezone.utc).isoformat(),
                courses=result, section_count=len(crns), pairing_rules_available=False)

def parse_page(html, term):
    chunks = []
    for raw in re.findall(r'self\.__next_f\.push\((\[1,.*?\])\)</script>', html, re.S):
        item = json.loads(raw)
        if isinstance(item[1], str): chunks.append(item[1])
    stream = ''.join(chunks)
    if not re.search(r'"id","'+re.escape(term)+r'","d"', stream):
        raise ValueError('Returned page does not confirm the requested term.')
    marker = '"courses":'
    i = stream.find(marker)
    if i < 0: raise ValueError('Public catalog format changed; cached data was kept.')
    courses, _ = json.JSONDecoder().raw_decode(stream[i+len(marker):])
    return normalize(courses, term)

def read_catalog():
    return json.loads(CACHE.read_text(encoding='utf-8'))

def compare_catalogs(old, new):
    if not old or old['term'] != new['term']: return []
    def index(cat):
        return {o['crn']: dict(o, course=c['code'], title=c['name']) for c in cat['courses'] for o in c['offerings']}
    before, after = index(old), index(new)
    changes=[]
    for crn in sorted(before.keys() | after.keys()):
        a,b=before.get(crn),after.get(crn)
        if a==b: continue
        changes.append(dict(crn=crn,kind='added' if not a else 'removed' if not b else 'changed',
                            course=(b or a)['course'],before=a,after=b,
                            fields=[k for k in (a or b) if a and b and a.get(k)!=b.get(k)]))
    return changes

def refresh(term):
    global _last_refresh
    if not re.fullmatch(r'\d{6}', term): raise ValueError('Invalid term.')
    if time.monotonic() - _last_refresh < 60: raise ValueError('Wait one minute between public catalog refreshes.')
    _last_refresh = time.monotonic()
    with urllib.request.urlopen(SOURCE+term, timeout=20) as response:
        raw = response.read(5000001)
        if len(raw) > 5000000: raise ValueError('Catalog page is unexpectedly large.')
    catalog = parse_page(raw.decode('utf-8'), term)
    previous = read_catalog() if CACHE.exists() else None
    catalog['changes'] = compare_catalogs(previous, catalog)
    catalog['previous_fetched_at'] = previous.get('fetched_at') if previous else None
    CACHE.parent.mkdir(exist_ok=True)
    temp = CACHE.with_suffix('.tmp')
    temp.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
    temp.replace(CACHE)
    return catalog

def meeting_text(offering):
    return '; '.join(f"{DAYS[m['day']][:3]} {m['start']//60:02}:{m['start']%60:02}-{m['end']//60:02}:{m['end']%60:02}" for m in offering['meetings'])

def catalog_row(course, offering, term, priority=1):
    return dict(course=course['code']+offering['type'], section=offering['section'], crns=offering['crn'],
                priority=priority, selected=True, verified=False, status='planned', opens='', closes='',
                source=SOURCE+term, notes=offering['instructor'], meetings=meeting_text(offering),
                catalog_base=course['code'], catalog_type=offering['type'], catalog_term=term)

def catalog_checks(plan, catalog):
    errors, warnings = [], []
    active = [r for r in plan['courses'] if r['selected'] or r['status']=='registered']
    index = {o['crn']:(c,o) for c in catalog['courses'] for o in c['offerings']}
    for r in active:
        if not r.get('catalog_base'): continue
        name = r['course']
        if r.get('catalog_term') != plan['term'] or catalog['term'] != plan['term']:
            errors.append(name+': selected CRN belongs to a different catalog term. Choose sections again.')
            continue
        found = index.get(r['crns'])
        if not found:
            errors.append(name+': CRN is absent from the cached catalog. Review this selection.')
            continue
        c,o = found
        if c['code'] != r['catalog_base'] or o['type'] != r['catalog_type'] or o['section'] != r['section'] or meeting_text(o) != r['meetings']:
            errors.append(name+': saved selection differs from the catalog. Reselect the section.')
        if o['unknown_times']: warnings.append(name+': some meeting times are TBA; conflict checking is incomplete.')
        types = set(s['type'] for s in c['offerings'])
        chosen = {a.get('catalog_type') for a in active if a.get('catalog_base')==c['code']}
        missing = types-chosen
        if missing:
            warnings.append(c['code']+': catalog also lists '+', '.join(t or 'main section' for t in sorted(missing))+'. Check whether those components are required.')
        if len(types)>1 and not r['verified']:
            warnings.append(c['code']+': lecture/component pairing and corequisite rules still need verification; Sutable does not supply them.')
    return list(dict.fromkeys(errors)), list(dict.fromkeys(warnings))

def solve(plan, catalog):
    """Bounded timetable search for the component types the user already selected."""
    if catalog['term'] != plan['term']: raise ValueError('Catalog term does not match plan.')
    errors,_ = catalog_checks(plan,catalog)
    if errors: raise ValueError(errors[0])
    from app import parse_meetings, course_key
    active_names=[course_key(r['course']) for r in plan['courses'] if r['selected'] or r['status']=='registered']
    if len(active_names)!=len(set(active_names)): raise ValueError('Select one section per component before searching.')
    days = {d[:3].lower():i for i,d in enumerate(DAYS)}
    def intervals(row): return [(days[d],s,e) for d,s,e in parse_meetings(row['meetings'])]
    def fits(a,b): return not any(x[0]==y[0] and max(x[1],y[1])<min(x[2],y[2]) for x in a for y in b)
    fixed, groups = [], []
    cmap = {c['code']:c for c in catalog['courses']}
    secured = {r['course'] for r in plan['courses'] if r['status'] in {'registered','uncertain'}}
    for i,r in enumerate(plan['courses']):
        if r['status']=='uncertain': raise ValueError('Reconcile uncertain registration outcomes before generating alternatives.')
        if not r['selected'] and r['status']!='registered': continue
        if r['status']=='registered' or r.get('locked') or not r.get('catalog_base'):
            if r.get('catalog_base'):
                matching=[o for c in catalog['courses'] for o in c['offerings'] if o['crn']==r['crns']]
                if any(o['unknown_times'] for o in matching): raise ValueError('Fixed section has incomplete meeting times: '+r['course'])
            if not r['meetings']: raise ValueError('Fixed section has unknown meeting times: '+r['course'])
            fixed.append((r['course'], intervals(r))); continue
        if r['status']!='planned' or r['course'] in secured: raise ValueError('Review recorded outcomes before generating alternatives.')
        if r.get('catalog_term')!=plan['term']: raise ValueError('Selection term mismatch.')
        c=cmap.get(r['catalog_base'])
        if not c: raise ValueError('Selected course missing from catalog.')
        rejected={x['crns'] for x in plan['courses'] if x['status'] in {'full','rejected'} and x['course']==r['course']}
        options=[o for o in c['offerings'] if o['type']==r['catalog_type'] and not o['unknown_times'] and o['crn'] not in rejected]
        saved={x['crns']:x.get('fallback_rank',50) for x in plan['courses'] if x.get('catalog_base')==r['catalog_base'] and x.get('catalog_type')==r['catalog_type'] and x.get('catalog_term')==plan['term'] and x['status']=='planned'}
        if plan.get('solver_scope','saved')=='saved': options=[o for o in options if o['crn'] in saved]
        options.sort(key=lambda o:(o['crn']!=r['crns'],saved.get(o['crn'],99),o['crn']))
        groups.append((i,r,c,options))
    for i,(name,slots) in enumerate(fixed):
        for other,other_slots in fixed[i+1:]:
            if not fits(slots,other_slots): raise ValueError('Fixed meetings conflict: '+name+' / '+other)
    if not groups: raise ValueError('Select catalog sections first.')
    if len({r['course'] for _,r,_,_ in groups})!=len(groups): raise ValueError('Select one section per component first.')
    groups.sort(key=lambda g:(g[1]['priority'],len(g[3])))
    nodes=0; deadline=time.monotonic()+2
    def visit(pos, occupied, chosen):
        nonlocal nodes
        nodes+=1
        if nodes>40000 or time.monotonic()>deadline: return None
        if pos==len(groups): return chosen
        i,r,c,options=groups[pos]
        for o in options:
            slots=[(m['day'],m['start'],m['end']) for m in o['meetings']]
            if fits(slots,occupied):
                answer=visit(pos+1,occupied+slots,chosen+[dict(index=i,old_crn=r['crns'],row=catalog_row(c,o,plan['term'],r['priority']))])
                if answer is not None:return answer
        return None
    answer=visit(0,[s for _,slots in fixed for s in slots],[])
    return dict(found=answer is not None, choices=answer or [], explored=nodes,
                note='Candidate uses selected component types. Pairing, seats and eligibility are unverified. Preferred sections are tried first in priority order; global optimality is not guaranteed.' if answer is not None else 'No candidate found within the search limit. This does not prove no valid schedule exists.')
