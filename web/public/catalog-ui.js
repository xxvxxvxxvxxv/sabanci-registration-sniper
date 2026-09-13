'use strict';
let catalogData=null, expandedCourse='', solverCandidate=null;
const typeName=t=>({'':'Main section',R:'Recitation',L:'Lab',D:'Discussion'}[t]||'Component '+t);
const hm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const offerText=o=>o.meetings.map(m=>`${dayNames[m.day]} ${hm(m.start)}–${hm(m.end)} · ${m.place}`).join('\n')+(o.unknown_times?'\nTBA / incomplete meeting times':'');
const catalogRow=(c,o)=>({...defaultCourse(),course:c.code+o.type,section:o.section,crns:o.crn,meetings:o.meetings.map(m=>`${dayNames[m.day]} ${hm(m.start)}-${hm(m.end)}`).join('; '),source:catalogData.source,notes:o.instructor,catalog_base:c.code,catalog_type:o.type,catalog_term:catalogData.term});
function isActive(r){return r.selected||r.status==='registered';}
function selectionFor(c,t){return plan.courses.find(r=>isActive(r)&&r.catalog_base===c&&r.catalog_type===t&&r.catalog_term===plan.term);}
function sectionSlots(r){return r.meetings.split(';').filter(x=>x.trim()).map(x=>{const m=x.trim().match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d):(\d\d)-(\d\d):(\d\d)$/i);return m?{day:dayNames.findIndex(d=>d.toLowerCase()===m[1].toLowerCase()),start:+m[2]*60+(+m[3]),end:+m[4]*60+(+m[5]),row:r}:null;}).filter(Boolean);}
function overlaps(a,b){return a.day===b.day&&Math.max(a.start,b.start)<Math.min(a.end,b.end);}
function renderCatalog(){
 if(!catalogData)return;
 const mismatch=catalogData.term!==plan.term;
 $('search-entire-catalog').checked=plan.solver_scope==='catalog';
 $('catalog-meta').title='Catalog snapshot: '+new Date(catalogData.fetched_at).toLocaleString('en-GB',{timeZone:'Europe/Istanbul'});
 $('catalog-meta').textContent=`${catalogData.courses.length} courses · ${catalogData.section_count} sections · updated ${new Date(catalogData.fetched_at).toLocaleString('en-GB',{timeZone:'Europe/Istanbul',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} Istanbul`;
 $('catalog-alert').hidden=!mismatch&&!catalogData.refresh_note;
 $('catalog-alert').textContent=mismatch?'Catalog and workspace terms differ. Refresh the catalog for your workspace term before selecting sections.':(catalogData.refresh_note||'');
 const raw=$('catalog-search').value.toLowerCase().trim(),q=key(raw),plannedOnly=$('catalog-selected').checked;
 const rows=catalogData.courses.filter(c=>(!plannedOnly||plan.courses.some(r=>r.catalog_base===c.code||key(r.course)===key(c.code)))&&(!raw||key(c.code).includes(q)||(c.name+' '+c.offerings.map(o=>o.instructor+' '+o.crn).join(' ')).toLowerCase().includes(raw)));
 $('catalog-list').innerHTML=rows.map(c=>{const active=plan.courses.filter(r=>isActive(r)&&r.catalog_base===c.code).length;return `<article class="catalog-course"><button class="catalog-course-title" data-course="${esc(c.code)}" aria-expanded="${expandedCourse===c.code}"><span><b>${esc(c.code)}</b><small>${esc(c.name)}</small></span><span class="badge">${active?active+' selected':c.offerings.length+' sections'}</span></button>${expandedCourse===c.code?`<div class="component-list">${[...new Set(c.offerings.map(o=>o.type))].map(t=>`<h3>${esc(typeName(t))}</h3>${c.offerings.filter(o=>o.type===t).map(o=>{const chosen=selectionFor(c.code,t),on=chosen?.crns===o.crn,protectedRow=plan.courses.some(r=>key(r.course)===key(c.code+t)&&['registered','uncertain'].includes(r.status));return `<button class="section-option ${on?'chosen':''}" data-crn="${esc(o.crn)}" ${mismatch||protectedRow||busy?'disabled':''} aria-pressed="${on}"><span class="section-option-head"><b>${esc(o.section)} <span>${on?'✓':''}</span></b><code>${esc(o.crn)}</code></span><span>${esc(o.instructor)}</span><small>${esc(offerText(o)).replaceAll('\n','<br>')}</small></button>${!plan.courses.some(r=>r.catalog_base===c.code&&r.crns===o.crn)?`<button class="save-fallback" data-fallback="${esc(o.crn)}" ${mismatch||busy?'disabled':''}>＋ Save fallback</button>`:''}`;}).join('')}`).join('')}</div>`:''}</article>`;}).join('')||'<p class="panel-intro">No matching courses.</p>';
 renderTimetable();
 if(solverCandidate&&solverCandidate.generation!==generation){solverCandidate=null;$('solver-result').hidden=true;}
}
window.renderCatalog=renderCatalog;
const coursePalette=[
 ['#192e43','#78b8ee'],['#17352f','#65ccb4'],['#30233e','#ba96e3'],
 ['#3b2c1c','#deb477'],['#253720','#98c780'],['#38243a','#d599cc'],
 ['#222e46','#99b3f4'],['#33331d','#c5c77d'],['#17333c','#78c7d9'],['#382c29','#d0ac9d']
];
const colorKey=r=>key(r.catalog_base||r.course);
function timetableColors(rows){
 const colors=new Map(),used=new Set();
 for(const name of [...new Set(rows.map(colorKey))].sort()){
  let hash=2166136261;for(const ch of name)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  let slot=hash%coursePalette.length;
  if(used.size<coursePalette.length)while(used.has(slot))slot=(slot+1)%coursePalette.length;
  used.add(slot);colors.set(name,coursePalette[slot]);
 }
 return colors;
}
const conflictIcon='<svg class="tt-warning" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 2 23 21H1Z" fill="#ffdb59"/><path d="M12 8v6" stroke="#332300" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.3" fill="#332300"/></svg>';
function renderTimetable(){
 const active=plan.courses.filter(isActive),slots=active.flatMap(sectionSlots),clashes=[];
 for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)if(slots[i].row!==slots[j].row&&overlaps(slots[i],slots[j]))clashes.push([slots[i],slots[j]]);
 const conflictSlots=new Set(clashes.flat()),colors=timetableColors(plan.courses);
 $('schedule-summary').textContent=`${active.length} sections · ${new Set(active.flatMap(r=>r.crns.split(/\s+/).filter(Boolean))).size} CRNs · ${new Set(clashes.map(p=>p.map(s=>s.row.course).sort().join(' / '))).size} conflicting pairs`;
 const dayCount=slots.some(s=>s.day>4)?7:5,start=Math.min(520,...slots.map(s=>Math.floor((s.start-40)/60)*60+40)),end=Math.max(1240,...slots.map(s=>Math.ceil((s.end-40)/60)*60+40)),scale=1.4;
 const grid=$('timetable');grid.replaceChildren();grid.style.gridTemplateColumns=`58px repeat(${dayCount},minmax(100px,1fr))`;
 const corner=document.createElement('div');corner.className='tt-head';grid.append(corner);
 for(let day=0;day<dayCount;day++){const h=document.createElement('div');h.className='tt-head';h.textContent=dayNames[day];grid.append(h);}
 const times=document.createElement('div');times.className='tt-times';times.style.height=(end-start)*scale+'px';for(let t=start;t<end;t+=60){const label=document.createElement('span');label.innerHTML=hm(t)+`<small>${hm(t+50)}</small>`;label.style.top=(t-start)*scale+'px';times.append(label);}grid.append(times);
 for(let day=0;day<dayCount;day++){
  const col=document.createElement('div');col.className='tt-day';col.style.height=(end-start)*scale+'px';
  for(let t=start;t<end;t+=60){const cell=document.createElement('div');cell.className='tt-cell';cell.style.top=(t-start)*scale+'px';cell.style.height=50*scale+'px';col.append(cell);}
  const meetings=slots.filter(s=>s.day===day).sort((a,b)=>a.start-b.start||a.end-b.end);
  // Allocate separate lanes in each connected overlap group so neither class is hidden.
  let group=[],until=-1;const clusters=[];for(const s of meetings){if(group.length&&s.start>=until){clusters.push(group);group=[];until=-1;}group.push(s);until=Math.max(until,s.end);}if(group.length)clusters.push(group);
  for(const cluster of clusters){const lanes=[];for(const s of cluster){let lane=lanes.findIndex(e=>e<=s.start);if(lane<0)lane=lanes.length;lanes[lane]=s.end;s.lane=lane;}
   for(const s of cluster){const conflict=conflictSlots.has(s),block=document.createElement('button');block.className='tt-block '+(conflict?'tt-conflict':'');const [bg,accent]=colors.get(colorKey(s.row));block.style.setProperty('--course-bg',bg);block.style.setProperty('--course-accent',accent);block.dataset.course=colorKey(s.row);block.style.top=(s.start-start)*scale+'px';block.style.height=(s.end-s.start)*scale+'px';block.style.width=`calc(${100/lanes.length}% - 4px)`;block.style.left=`calc(${s.lane*100/lanes.length}% + 2px)`;
    const offering=catalogData.courses.flatMap(c=>c.offerings).find(o=>o.crn===s.row.crns);const place=offering?.meetings.find(m=>m.day===s.day&&m.start===s.start)?.place||'';
    block.innerHTML=`<b class="tt-block-title">${conflict?conflictIcon:''}<span>${esc(s.row.course)}</span></b><span>${esc(s.row.section)} · ${esc(s.row.crns)}</span><small>${hm(s.start)}–${hm(s.end)}<br>${esc(place)}</small>`;block.title=`${conflict?'Time conflict · ':''}${dayNames[s.day]} · ${s.row.course} ${s.row.section}\n${s.row.crns}\n${hm(s.start)}–${hm(s.end)} ${place}`;block.setAttribute('aria-label',block.title);block.onclick=()=>{expandedCourse=s.row.catalog_base||'';if(expandedCourse){$('catalog-search').value=expandedCourse;renderCatalog();}else openCourse(plan.courses.indexOf(s.row));};col.append(block);
   }
  }grid.append(col);
 }
 const issues=[...new Set(clashes.map(p=>p.map(s=>s.row.course+' '+s.row.section).join(' / ')+': '+dayNames[p[0].day]+' '+hm(Math.max(p[0].start,p[1].start))+'–'+hm(Math.min(p[0].end,p[1].end))))];
 const cm=new Map(catalogData.courses.map(c=>[c.code,c]));for(const base of new Set(active.map(r=>r.catalog_base).filter(Boolean))){const c=cm.get(base);if(!c)continue;const missing=[...new Set(c.offerings.map(o=>o.type))].filter(t=>!active.some(r=>r.catalog_base===base&&r.catalog_type===t));if(missing.length)issues.push(base+': also offers '+missing.map(typeName).join(', ')+'. Check which components you need.');}
 for(const r of active){const o=cm.get(r.catalog_base)?.offerings.find(o=>o.crn===r.crns);if(!r.meetings||o?.unknown_times)issues.push(r.course+': TBA or incomplete meeting times.');}
 $('schedule-issues').innerHTML=issues.length?issues.map(x=>`<p>${esc(x)}</p>`).join(''):'';
}
async function chooseSection(crn){
 if(!loaded||busy||!catalogData||catalogData.term!==plan.term)return;
 const c=catalogData.courses.find(c=>c.offerings.some(o=>o.crn===crn)),o=c?.offerings.find(o=>o.crn===crn);if(!o)return;
 const next=clone(plan),existing=next.courses.find(r=>r.catalog_term===plan.term&&r.crns===crn&&r.catalog_base===c.code),current=selectionFor(c.code,o.type);
 if(next.courses.some(r=>key(r.course)===key(c.code+o.type)&&['registered','uncertain'].includes(r.status))){notify('Review the registered or uncertain result in CRNs before changing this component.',true);return;}
 if(current?.crns===crn){existing.selected=false;}else{
  for(const r of next.courses)if(key(r.course)===key(c.code+o.type))r.selected=false;
  if(existing){if(existing.status!=='planned'){notify('This section has a recorded outcome. Review it in CRNs first.',true);return;}const fresh=catalogRow(c,o);if(existing.meetings!==fresh.meetings||existing.section!==fresh.section){existing.meetings=fresh.meetings;existing.section=fresh.section;existing.verified=false;}existing.selected=true;}
  else{const r=catalogRow(c,o);r.priority=current?.priority||1;next.courses.push(r);}
 }
 await commit(next);
}
$('catalog-list').onclick=e=>{const fallback=e.target.closest('[data-fallback]');if(fallback){saveFallback(fallback.dataset.fallback);return;}const section=e.target.closest('[data-crn]');if(section){chooseSection(section.dataset.crn);return;}const title=e.target.closest('[data-course]');if(title){expandedCourse=expandedCourse===title.dataset.course?'':title.dataset.course;renderCatalog();}};
$('catalog-search').oninput=()=>{const q=key($('catalog-search').value);const exact=catalogData?.courses.find(c=>key(c.code)===q||c.offerings.some(o=>o.crn===q));if(exact)expandedCourse=exact.code;renderCatalog();};$('catalog-selected').onchange=renderCatalog;
$('catalog-queue').onclick=async()=>{view('plan');await runCheck('draft');};
$('catalog-refresh').onclick=async()=>{if(busy||!loaded)return;busy=true;$('catalog-refresh').disabled=true;notify('Fetching one public Sutable page…');try{catalogData=await api('catalog-refresh',{term:plan.term});invalidate();renderCatalog();notify('Catalog refreshed. Saved selections are checked against the new data when you prepare CRNs.');}catch(e){notify(e.message+' Previous catalog kept.',true);}finally{busy=false;$('catalog-refresh').disabled=false;renderCatalog();schedulePrepare();}};
$('catalog-generate').onclick=async()=>{if(busy||!loaded)return;$('settings-dialog').close();view('catalog');const version=generation;$('catalog-generate').disabled=true;try{const result=await api('solve',clone(plan));if(version!==generation||busy){notify('Plan changed during search. Run it again.',true);return;}solverCandidate={...result,generation:version};const changed=result.choices.filter(c=>c.old_crn!==c.row.crns);$('solver-result').hidden=false;$('solver-result').innerHTML=`<h2>${result.found?'TIMETABLE CANDIDATE':'SEARCH FINISHED'}</h2><p>${esc(result.note)}</p>${result.found?(changed.length?`<p>${changed.map(c=>`${esc(c.row.course)}: ${esc(c.old_crn)} → ${esc(c.row.crns)} (${esc(c.row.section)})`).join('<br>')}</p><button id="apply-candidate" class="primary">Use these alternatives</button>`:'<p>Current selected sections fit. No changes proposed.</p>'):''}<small>Search covers selected component types only. Registered sections stay fixed. Locked sections stay fixed. TBA and sections marked full/rejected are excluded. Saved alternatives only unless expanded search is enabled.</small>`;if($('apply-candidate'))$('apply-candidate').onclick=applyCandidate;
 }catch(e){notify(e.message,true);}finally{$('catalog-generate').disabled=false;}};
async function saveFallback(crn){if(busy||!loaded||catalogData.term!==plan.term)return;const c=catalogData.courses.find(c=>c.offerings.some(o=>o.crn===crn)),o=c?.offerings.find(o=>o.crn===crn);if(!o||plan.courses.some(r=>r.catalog_term===plan.term&&r.crns===crn))return;const r=catalogRow(c,o);r.selected=false;r.fallback_rank=50;const next=clone(plan);next.courses.push(r);await commit(next);}
$('search-entire-catalog').onchange=async()=>{if(busy||!loaded){renderCatalog();return;}const next=clone(plan);next.solver_scope=$('search-entire-catalog').checked?'catalog':'saved';await commit(next);};
async function applyCandidate(){if(!solverCandidate||solverCandidate.generation!==generation||busy)return;const next=clone(plan);for(const change of solverCandidate.choices){if(change.old_crn===change.row.crns)continue;const old=next.courses[change.index];old.selected=false;let alternative=next.courses.find(r=>r.catalog_term===plan.term&&r.catalog_base===change.row.catalog_base&&r.crns===change.row.crns);if(alternative){const rank=alternative.fallback_rank||50;Object.assign(alternative,change.row);alternative.fallback_rank=rank;alternative.selected=true;alternative.verified=false;}else next.courses.push(change.row);}await commit(next);}
api('catalog').then(c=>{catalogData=c;renderCatalog();schedulePrepare();}).catch(e=>notify('Catalog load failed: '+e.message,true));
view('catalog');

// Paste a complete Sutable CRN selection with a review before saving.
let importPreview=null, importSequence=0, importPending=false;
function clearImportPreview(){importSequence++;importPreview=null;$('crn-import-apply').disabled=true;$('crn-import-result').replaceChildren();}
$('paste-crns').onclick=()=>{if(!loaded||busy||importPending)return;clearImportPreview();$('crn-import-error').textContent='';$('crn-import-dialog').showModal();$('crn-import-text').focus();};
$('crn-import-close').onclick=()=>{clearImportPreview();$('crn-import-dialog').close();};
$('crn-import-dialog').addEventListener('cancel',clearImportPreview);
$('crn-import-text').oninput=()=>{clearImportPreview();$('crn-import-error').textContent='';};
$('crn-import-preview').onclick=async()=>{
 if(!loaded||busy||importPending)return;clearImportPreview();const sequence=importSequence;
 const payload={text:$('crn-import-text').value,term:plan.term,revision:plan.revision};
 importPending=true;$('crn-import-preview').disabled=true;$('crn-import-error').textContent='';
 try{const result=await api('crns/preview',payload);
  if(sequence!==importSequence||payload.revision!==plan.revision||payload.term!==plan.term)return;
  importPreview={...payload,catalog_stamp:result.catalog_stamp};
  $('crn-import-result').innerHTML=`<p>${result.rows.length} sections · catalog ${esc(new Date(result.catalog_stamp).toLocaleString('en-GB',{timeZone:'Europe/Istanbul'}))}${result.duplicates?' · '+result.duplicates+' duplicates removed':''}</p><div class="table-scroll"><table><thead><tr><th>Section / CRN</th><th>Meetings · Istanbul</th><th>Action</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td><b>${esc(r.course)} ${esc(r.section)}</b><br><code>${esc(r.crn)}</code></td><td>${esc(r.meetings)}${r.unknown_times?'<br>TBA / incomplete':''}</td><td>${esc(r.action)}</td></tr>`).join('')}</tbody></table></div>${result.errors.length?`<div class="form-error"><b>Preparation blocked</b>${result.errors.map(x=>`<p>${esc(x)}</p>`).join('')}<p>The plan can be saved for editing.</p></div>`:''}<details><summary>Checks and limitations</summary>${result.warnings.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`;
  $('crn-import-apply').disabled=false;
 }catch(e){if(sequence===importSequence)$('crn-import-error').textContent=e.message;}
 finally{importPending=false;$('crn-import-preview').disabled=false;}
};
$('crn-import-apply').onclick=async()=>{
 if(!importPreview||busy||importPending)return;
 if(importPreview.revision!==plan.revision||importPreview.term!==plan.term){clearImportPreview();$('crn-import-error').textContent='Plan changed. Preview again.';return;}
 busy=true;importPending=true;$('crn-import-apply').disabled=true;saveLabel('Saving…');
 try{plan=await api('crns/import',importPreview);unsaved=null;invalidate();render();saveLabel('Saved');clearImportPreview();$('crn-import-dialog').close();view('catalog');notify('CRNs imported. Existing selections preserved.');}
 catch(e){saveLabel('Import failed',true);clearImportPreview();$('crn-import-error').textContent=e.message;}
 finally{busy=false;importPending=false;renderCatalog();schedulePrepare();}
};
