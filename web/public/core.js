'use strict';
window.SniperCore=(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x)), key=x=>String(x).replace(/[\s-]+/g,'').toUpperCase(), days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const hm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const ids=r=>String(r.crns||'').trim().split(/\s+/).filter(Boolean);
 const active=r=>r.selected;
 function validate(p){
  if(!p||!/^\d{6}$/.test(p.term)||!Array.isArray(p.courses)||p.courses.length>80||!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('Invalid plan. Expected a term and at most 80 sections.');
  if(p.allow_time_conflicts!==undefined&&typeof p.allow_time_conflicts!=='boolean')throw Error('Invalid time conflict preference.');
  for(const r of p.courses){
   if(!r||typeof r.course!=='string'||!r.course.trim()||typeof r.crns!=='string'||ids(r).some(x=>!/^\d{5}$/.test(x)))throw Error('Invalid course or CRN.');
   if(typeof r.selected!=='boolean'||!Number.isInteger(r.priority)||r.priority<1||r.priority>99)throw Error('Invalid section selection or priority.');
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
  validate(p);const errors=[],warnings=[],out=[],seen=new Set(),used=new Set(),rows=p.courses.filter(active),selected=rows;
  if(cat.term!==p.term)errors.push('Catalog term differs from this plan.');
  for(const r of rows){const k=key(r.course);if(used.has(k))errors.push('Several sections selected for '+r.course);used.add(k);if(!slots(r).length||slots(r).length!==String(r.meetings||'').split(';').filter(s=>s.trim()).length)warnings.push(r.course+': meeting times are incomplete.');}
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(clash(rows[i],rows[j]))(p.allow_time_conflicts===true?warnings:errors).push('Time conflict: '+rows[i].course+' / '+rows[j].course);
  for(const r of selected){
   if(!ids(r).length)errors.push(r.course+': missing CRN.');
   for(const id of ids(r)){if(seen.has(id))errors.push('Duplicate CRN '+id);seen.add(id);out.push(id);const found=lookup(cat,id);if(!found)errors.push(id+': not found in this term’s catalog.');else if(r.catalog_base){const fresh=row(cat,found.c,found.o);if(['course','section','meetings','catalog_base','catalog_type','catalog_term'].some(k=>fresh[k]!==r[k]))errors.push(id+': saved section differs from the catalog. Reselect it.');}}
   if(!r.verified)warnings.push(r.course+': eligibility and component pairing are unverified.');
   if(r.opens&&Date.now()<Date.parse(r.opens))(mode==='draft'?warnings:errors).push(r.course+': registration window has not opened.');
   if(r.closes&&Date.now()>Date.parse(r.closes))(mode==='draft'?warnings:errors).push(r.course+': registration window has closed.');
  }
  if(!out.length)errors.push('Select sections first.');
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
  for(const id of new Set(raw)){const f=lookup(cat,id);if(!f)throw Error('CRN '+id+' is not in the catalog. Nothing was added.');const r=row(cat,f.c,f.o);let action='Already saved';if(!next.courses.some(o=>ids(o).includes(id))){r.selected=!next.courses.some(o=>key(o.course)===key(r.course)&&active(o));action=r.selected?'Selected':'Not selected (another section is selected)';next.courses.push(r);}rows.push({crn:id,course:r.course,section:r.section,meetings:r.meetings,unknown_times:f.o.unknown_times,action});}
  const check=prepare(next,cat);return {next,rows,duplicates:raw.length-new Set(raw).size,revision:p.revision,catalog_stamp:cat.fetched_at,errors:check.errors,warnings:check.warnings};
 }
 function availability(r,s){let missing=false;for(const id of ids(r)){const o=s.observations[id];if(!o||o.error||o.stale||Date.now()-Date.parse(o.checked_at)>s.cycle_seconds*2000){missing=true;continue;}if(o.available<=0)return 'full';}return missing||!ids(r).length?'unknown':'available';}
 function combinations(p,s){const groups=new Map();for(const r of p.courses.filter(active)){const base=r.catalog_base||r.course;if(!groups.has(base))groups.set(base,[]);groups.get(base).push({course:r.course,section:r.section,state:availability(r,s)});}return [...groups].map(([course,components])=>({course,components,state:components.some(c=>c.state==='full')?'full':components.some(c=>c.state==='unknown')?'unknown':components.every(c=>c.state==='registered')?'registered':'available'}));}
 return {copy,key,ids,active,validate,slots,clash,lookup,row,prepare,importCRNs,availability,combinations};
})();
