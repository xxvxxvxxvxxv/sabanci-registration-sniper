"""Plan-aware seat observations. Selection is explicit; enrollment is untouched."""
import copy
import re
from datetime import datetime, timezone


def key(row):
    return re.sub(r'[\s-]+', '', row['course']).upper()


def base(row):
    return row.get('catalog_base') or key(row)


def watch_crns(plan, backups=False):
    active = [r for r in plan['courses'] if r['selected'] and r['status'] not in ('registered','uncertain','rejected')]
    components = {key(r) for r in active}
    rows = sorted(active, key=lambda r:r['priority'])
    if backups:
        rows += sorted((r for r in plan['courses'] if not r['selected'] and key(r) in components
                       and r['status'] in ('planned','full') and r.get('catalog_term',plan['term'])==plan['term']),
                       key=lambda r:(r['priority'],r.get('fallback_rank',50)))
    return list(dict.fromkeys(c for r in rows for c in r['crns'].split()))


def availability(row, snapshot, term):
    if row['status']=='registered': return 'registered'
    if snapshot['term']!=term: return 'unknown'
    values=[]
    for crn in row['crns'].split():
        o=snapshot['observations'].get(crn,{})
        try:
            age=(datetime.now(timezone.utc)-datetime.fromisoformat(o['checked_at'])).total_seconds()
            if o.get('error') or o.get('stale') or age< -30 or age>snapshot['cycle_seconds']*2:return 'unknown'
            values.append(o.get('available',o['remaining']))
        except (KeyError,TypeError,ValueError):return 'unknown'
    if not values:return 'unknown'
    return 'available' if all(v>0 for v in values) else 'full'


def combinations(plan,snapshot):
    active=[r for r in plan['courses'] if r['selected'] or r['status']=='registered']
    result=[]
    for code in dict.fromkeys(base(r) for r in active):
        rows=[r for r in active if base(r)==code]
        states=[availability(r,snapshot,plan['term']) for r in rows]
        state='registered' if all(s=='registered' for s in states) else 'full' if 'full' in states else 'unknown' if 'unknown' in states else 'available'
        result.append({'course':code,'state':state,'components':[{'course':r['course'],'section':r['section'],
                      'crns':r['crns'],'state':s} for r,s in zip(rows,states)]})
    return result


def candidate(plan,crn,snapshot,parse_meetings,catalog_data=None):
    rows=[r for r in plan['courses'] if r['crns']==crn and r.get('catalog_term',plan['term'])==plan['term']]
    if len(rows)!=1:raise ValueError('Choose a single saved section for this CRN.')
    target=rows[0]
    if target['status'] not in ('planned','full'):raise ValueError('This section has a registered, uncertain or rejected outcome.')
    if availability(target,snapshot,plan['term'])!='available':raise ValueError('A fresh available-seat observation is required.')
    others=[r for r in plan['courses'] if r is not target and key(r)==key(target)]
    if any(r['status'] in ('registered','uncertain') for r in others):raise ValueError('A registered or uncertain section cannot be replaced.')
    if any(r['selected'] and r.get('locked') for r in others):raise ValueError('The selected section is locked.')
    if not target['meetings']:raise ValueError('Meeting times are unknown.')
    current=next((r for r in others if r['selected']),None)
    result=copy.deepcopy(plan)
    for row in result['courses']:
        if key(row)==key(target):row['selected']=False
    new=result['courses'][plan['courses'].index(target)]
    new.update(selected=True,status='planned')
    active=[r for r in result['courses'] if r['selected'] or r['status']=='registered']
    if catalog_data:
        unknown={o['crn'] for c in catalog_data['courses'] for o in c['offerings'] if o.get('unknown_times')}
        if any(c in unknown for r in active for c in r['crns'].split()):raise ValueError('A selected section has incomplete catalog meeting times.')
    for other in active:
        if other is new:continue
        if not other['meetings']:raise ValueError('Another selected section has unknown meeting times.')
        if any(a[0]==b[0] and max(a[1],b[1])<min(a[2],b[2]) for a in parse_meetings(new['meetings']) for b in parse_meetings(other['meetings'])):
            raise ValueError('Conflicts with '+other['course']+' '+other['section']+'.')
    group=next(g for g in combinations(result,snapshot) if g['course']==base(new))
    if group['state']!='available':raise ValueError('Other selected components of this course are full or unknown.')
    return result, {'course':target['course'],'from':current['crns'] if current else None,'to':crn,
                    'section':target['section'],'group':group}
