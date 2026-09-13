'use strict';
window.SniperCore=(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x)), key=x=>String(x).replace(/[\s-]+/g,'').toUpperCase(), days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const hm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const ids=r=>String(r.crns||'').trim().split(/\s+/).filter(Boolean);
 const active=r=>r.selected||r.status==='registered';
 function validate(p){
  if(!p||!/^\d{6}$/.test(p.term)||!Array.isArray(p.courses)||p.courses.length>80||!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('Invalid plan. Expected a term and at most 80 sections.');
  for(const r of p.courses){
   if(!r||typeof r.course!=='string'||!r.course.trim()||typeof r.crns!=='string'||ids(r).some(x=>!/^\d{5}$/.test(x)))throw Error('Invalid course or CRN.');
   if(!['planned','full','registered','rejected','uncertain'].includes(r.status)||typeof r.selected!=='boolean'||!Number.isInteger(r.priority)||r.priority<1||r.priority>99)throw Error('Invalid section status or priority.');
   for(const f of ['section','meetings','notes','source','opens','closes'])if(r[f]!==undefined&&(typeof r[f]!=='string'||r[f].length>2000))throw Error('Invalid section details.');
   for(const f of ['opens','closes'])if(r[f]&&!Number.isFinite(Date.parse(r[f])))throw Error('Invalid opening or closing time.');
  }return copy(p);
 }
 function slots(r){if(!r.meetings?.trim())return [];return r.meetings.split(';').filter(x=>x.trim()).map(x=>{const m=x.trim().match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d):(\d\d)-(\d\d):(\d\d)$/i);if(!m)return null;const a=+m[2]*60+(+m[3]),b=+m[4]*60+(+m[5]);return +m[2]<24&&+m[4]<24&&+m[3]<60&&+m[5]<60&&a<b?{day:days.findIndex(d=>d.toLowerCase()===m[1].toLowerCase()),start:a,end:b}:null;}).filter(Boolean);}
 const overlap=(a,b)=>a.day===b.day&&a.start<b.end&&b.start<a.end;
 const clash=(a,b)=>slots(a).some(x=>slots(b).some(y=>overlap(x,y)));
 const lookup=(cat,crn)=>{for(const c of cat.courses){const o=c.offerings.find(o=>o.crn===crn);if(o)return {c,o};}return null;};
 function row(cat,c,o){return {course:c.code+o.type,section:o.section,crns:o.crn,meetings:o.meetings.map(m=>`${days[m.day]} ${hm(m.start)}-${hm(m.end)}`).join('; '),catalog_base:c.code,catalog_type:o.type,catalog_term:cat.term,source:cat.source,notes:o.instructor,priority:1,fallback_rank:50,locked:false,selected:true,verified:false,status:'planned',opens:'',closes:''};}
 function prepare(p,cat,mode='draft'){
  validate(p);const errors=[],warnings=[],out=[],seen=new Set(),used=new Set(),rows=p.courses.filter(active),selected=rows.filter(r=>r.selected&&r.status!=='registered').sort((a,b)=>a.priority-b.priority);
  if(cat.term!==p.term)errors.push('Catalog term differs from this plan.');
  for(const r of rows){const k=key(r.course);if(used.has(k))errors.push('Several sections selected for '+r.course);used.add(k);if(!slots(r).length||slots(r).length!==String(r.meetings||'').split(';').filter(s=>s.trim()).length)warnings.push(r.course+': meeting times are incomplete.');}
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(clash(rows[i],rows[j]))errors.push('Time conflict: '+rows[i].course+' / '+rows[j].course);
  for(const r of selected){
   if(r.status!=='planned')errors.push(r.course+': reconcile '+r.status+' status first.');
   if(p.courses.some(o=>o!==r&&key(o.course)===key(r.course)&&['registered','uncertain'].includes(o.status)))errors.push(r.course+': registered or uncertain alternative exists.');
   if(!ids(r).length)errors.push(r.course+': missing CRN.');
   for(const id of ids(r)){if(seen.has(id))errors.push('Duplicate CRN '+id);seen.add(id);out.push(id);const found=lookup(cat,id);if(!found)errors.push(id+': not found in this term’s catalog.');else if(r.catalog_base){const fresh=row(cat,found.c,found.o);if(['course','section','meetings','catalog_base','catalog_type','catalog_term'].some(k=>fresh[k]!==r[k]))errors.push(id+': saved section differs from the catalog. Reselect it.');}}
   if(!r.verified)warnings.push(r.course+': eligibility and component pairing are unverified.');
   if(r.opens&&Date.now()<Date.parse(r.opens))(mode==='draft'?warnings:errors).push(r.course+': registration window has not opened.');
   if(r.closes&&Date.now()>Date.parse(r.closes))(mode==='draft'?warnings:errors).push(r.course+': registration window has closed.');
  }
  if(!out.length)errors.push('Select unregistered sections first.');
  warnings.push('Required companion sections and pairing rules must be verified in SUIS.');
  return {ready:!errors.length,crns:errors.length?[]:out,errors:[...new Set(errors)],warnings:[...new Set(warnings)],mode};
 }
 function importCRNs(p,cat,b){
  if(b.term!==p.term||b.revision!==p.revision)throw Error('Plan changed. Preview again.');
  if(cat.term!==p.term)throw Error('Catalog term mismatch.');
  if(b.catalog_stamp&&b.catalog_stamp!==cat.fetched_at)throw Error('Catalog changed. Preview again.');
  const text=String(b.text||'');const raw=text.trim().split(/[\s,;]+/).filter(Boolean);
  if(text.length>4000||!raw.length||raw.length>80||raw.some(x=>!/^\d{5}$/.test(x)))throw Error('Paste up to 80 five-digit CRNs.');
  const next=copy(p),rows=[];
  for(const id of new Set(raw)){const f=lookup(cat,id);if(!f)throw Error('CRN '+id+' is not in the catalog. Nothing was added.');const r=row(cat,f.c,f.o);let action='Already saved';if(!next.courses.some(o=>ids(o).includes(id))){r.selected=!next.courses.some(o=>key(o.course)===key(r.course)&&(active(o)||o.locked||o.status==='uncertain'));action=r.selected?'Selected':'Saved alternative';next.courses.push(r);}rows.push({crn:id,course:r.course,section:r.section,meetings:r.meetings,unknown_times:f.o.unknown_times,action});}
  const check=prepare(next,cat);return {next,rows,duplicates:raw.length-new Set(raw).size,revision:p.revision,catalog_stamp:cat.fetched_at,errors:check.errors,warnings:check.warnings};
 }
 function solve(p,cat){
  validate(p);if(cat.term!==p.term)throw Error('Catalog term mismatch.');if(p.courses.some(r=>r.status==='uncertain'))throw Error('Reconcile uncertain outcomes before searching.');const selected=p.courses.map((r,index)=>({r,index})).filter(x=>active(x.r));const deadline=performance.now()+1500;let nodes=0,timed=false;
  const groups=selected.map(({r,index})=>{let options=[r];if(!r.locked&&!['registered','uncertain'].includes(r.status)){options=p.courses.filter(o=>key(o.course)===key(r.course)&&o.status==='planned');if(p.solver_scope==='catalog'&&r.catalog_base){const c=cat.courses.find(c=>c.code===r.catalog_base);if(c)options.push(...c.offerings.filter(o=>o.type===r.catalog_type).map(o=>({...row(cat,c,o),priority:r.priority})));}const excluded=new Set(p.courses.filter(o=>key(o.course)===key(r.course)&&['full','rejected'].includes(o.status)).map(o=>o.crns));options=[r,...options].filter((o,i,a)=>['planned','registered'].includes(o.status)&&!excluded.has(o.crns)&&a.findIndex(v=>v.crns===o.crns)===i);}
   return {index,r,options:options.filter(o=>slots(o).length&&slots(o).length===o.meetings.split(';').filter(s=>s.trim()).length)};});
  const picked=[];function walk(i){if(++nodes>40000||performance.now()>deadline){timed=true;return false;}if(i===groups.length)return true;for(const o of groups[i].options){if(picked.every(x=>!clash(x,o))){picked.push(o);if(walk(i+1))return true;picked.pop();}}return false;}
  const found=groups.length>0&&walk(0);return {found,choices:found?groups.map((g,i)=>({index:g.index,old_crn:g.r.crns,row:{...copy(picked[i]),selected:true}})):[],note:found?'Conflict-free candidate for the selected component types.':timed?'Search limit reached. Narrow the alternatives.':'No conflict-free combination found among these alternatives.'};
 }
 function availability(r,s){if(r.status==='registered')return 'registered';let missing=false;for(const id of ids(r)){const o=s.observations[id];if(!o||o.error||o.stale||Date.now()-Date.parse(o.checked_at)>s.cycle_seconds*2000){missing=true;continue;}if(o.available<=0)return 'full';}return missing||!ids(r).length?'unknown':'available';}
 function combinations(p,s){const groups=new Map();for(const r of p.courses.filter(active)){const base=r.catalog_base||r.course;if(!groups.has(base))groups.set(base,[]);groups.get(base).push({course:r.course,section:r.section,state:availability(r,s)});}return [...groups].map(([course,components])=>({course,components,state:components.some(c=>c.state==='full')?'full':components.some(c=>c.state==='unknown')?'unknown':components.every(c=>c.state==='registered')?'registered':'available'}));}
 function choice(p,cat,s,crn){const r=p.courses.find(r=>r.crns===crn);if(!r||!['planned','full'].includes(r.status)||availability(r,s)!=='available')throw Error('Save this section as an alternative and wait for fresh available seats.');const current=p.courses.find(o=>active(o)&&key(o.course)===key(r.course));if(current?.locked||p.courses.some(o=>key(o.course)===key(r.course)&&['registered','uncertain'].includes(o.status)))throw Error('This component is locked, registered or uncertain.');const next=copy(p);next.courses.forEach(o=>{if(key(o.course)===key(r.course))o.selected=o.crns===crn;});const target=next.courses.find(o=>o.crns===crn);target.status='planned';if(!slots(target).length||next.courses.filter(active).some(o=>!slots(o).length))throw Error('Meeting times are incomplete.');const check=prepare(next,cat);if(!check.ready)throw Error(check.errors.join(' '));if(next.courses.filter(o=>active(o)&&(o.catalog_base||o.course)===(r.catalog_base||r.course)).some(o=>!['available','registered'].includes(availability(o,s))))throw Error('A selected companion lacks fresh available seats.');return {next,to:crn,from:current?.crns||'',course:r.course,section:r.section,revision:p.revision,...check};}
 return {copy,key,ids,active,validate,slots,clash,lookup,row,prepare,importCRNs,solve,availability,combinations,choice};
})();
