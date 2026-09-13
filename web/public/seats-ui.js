'use strict';
let alarmUntil=0,seatRevision=0,seatState=null,seatBusy=false,watchDirty=false,seatInitial=null,soundEnabled=false,desktopEnabled=false,audioCtx=null;
const seatTime=value=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
function seatLabel(crn){
 const c=catalogData?.term===seatState?.term?catalogData.courses.find(c=>c.offerings.some(o=>o.crn===crn)):null;
 const o=c?.offerings.find(o=>o.crn===crn);
 return c?`${c.code}${o.type} · ${o.section}`:crn;
}
function monitorMessage(text,error=false){$('monitor-message').textContent=text;$('monitor-message').classList.toggle('error',error);}
function renderSeats(sync=false){
 if(!seatState)return;
 const s=seatState;
 if(sync){$('watch-crns').value=s.crns.join(' ');$('watch-interval').value=s.interval;$('watch-follow').checked=Boolean(s.follow_plan);$('watch-backups').checked=Boolean(s.backups);watchDirty=false;}
 $('monitor-state').textContent=s.running?'Watching':'Paused';$('monitor-state').classList.toggle('on',s.running);
 $('seat-nav').textContent=s.running?'On':'Paused';
 $('monitor-cycle').textContent=`Term ${s.term} · ~${s.cycle_seconds}s minimum cycle · ≥${s.min_gap}s between requests`;
 $('monitor-start').textContent=s.running?'Pause':'Start';$('monitor-start').disabled=seatBusy;
 for(const id of ['watch-crns','watch-interval','watch-plan','watch-save','watch-follow','watch-backups'])$(id).disabled=s.running||seatBusy;
 $('seats-empty').hidden=s.crns.length>0;
 $('seat-rows').innerHTML=s.crns.map(crn=>{const o=s.observations[crn]||{},unknown=o.remaining===undefined,unreliable=unknown||Boolean(o.error)||o.stale;
 const count=o.available??o.remaining,remaining=unreliable?'Unknown':count;
 return `<tr><td><strong>${esc(seatLabel(crn))}</strong><a class="seat-source" href="https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=${esc(s.term)}&amp;crn_in=${esc(crn)}" target="_blank" rel="noreferrer">${esc(crn)} ↗</a></td><td><strong class="seat-number ${!unreliable&&count>0?'available':''}">${remaining}</strong>${unreliable&&!unknown?`<small>Last observed: ${count}</small>`:''}</td><td>${unknown?'—':`${o.actual} / ${o.capacity}`}${o.cross_list?`<details><summary>Shared limit</summary><small>${o.cross_list.remaining} remaining</small></details>`:''}</td><td><time>${seatTime(o.checked_at)}</time>${o.error?`<small class="seat-error">${esc(o.error)}</small>`:o.stale?'<small>Stale observation</small>':unknown?'<small>Awaiting first check</small>':''}</td></tr>`;
 }).join('');
 renderCombinations();
 $('seat-event-count').textContent=s.events.length||'';
 $('seat-events').innerHTML=[...s.events].reverse().slice(0,30).map(e=>`<div class="seat-event"><time>${seatTime(e.at)}</time><span>${e.kind==='opened'?`${esc(seatLabel(e.crn))} · ${e.remaining} seat(s) observed`:`Monitoring stopped · ${esc(e.crn)}`}</span>${e.kind==='opened'?`<button class="review-choice" data-choice="${esc(e.crn)}">Review section</button>`:''}</div>`).join('')||'<p>No alerts yet.</p>';
 if(s.reason)monitorMessage(s.reason,true);
}
async function alarm(){
 if(!soundEnabled||!audioCtx)return;
 await audioCtx.resume();
 if(audioCtx.state!=='running'){monitorMessage('Sound is suspended. Click Sound off, then enable it again.',true);return;}
 const start=audioCtx.currentTime;
 if(start<alarmUntil)return;
 alarmUntil=start+.95;
 for(let i=0;i<3;i++){
  const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),at=start+i*.33;
  osc.type='sine';osc.frequency.setValueAtTime(880,at);osc.frequency.linearRampToValueAtTime(1320,at+.14);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.14,at+.015);gain.gain.linearRampToValueAtTime(0,at+.23);
  osc.connect(gain);gain.connect(audioCtx.destination);osc.start(at);osc.stop(at+.24);
 }
}
async function deliverSeatEvent(e){
 if(!soundEnabled&&!desktopEnabled)return;
 // The shared cursor and origin lock prevent several app tabs sounding together.
 const claim=async()=>{
  const storageKey='sniper-seat-alert:'+location.port+':'+e.term;
  let previous=0;
  try{previous=Number(localStorage.getItem(storageKey)||0);}catch{}
  if(e.id<=previous)return;
  try{localStorage.setItem(storageKey,String(e.id));}catch{}
  const text=e.kind==='opened'?`${seatLabel(e.crn)} · CRN ${e.crn} · ${e.remaining} seat(s)${seatState.opportunities?.some(c=>c.to===e.crn)?' · Fits timetable':''}`:'Seat monitoring stopped. Open the Seats tab.';
  monitorMessage(text,e.kind!=='opened');
  if(soundEnabled)try{await alarm();}catch{monitorMessage('Audio unavailable. Check the browser sound settings.',true);}
  if(desktopEnabled&&'Notification' in window&&Notification.permission==='granted'){
   try{const n=new Notification(e.kind==='opened'?'Seat available':'Monitor paused',{body:text,tag:'sniper-'+e.term+'-'+e.id});n.onclick=()=>{window.focus();view('seats');n.close();};}catch{monitorMessage('Desktop notification failed. The alert is saved below.',true);}
  }
 };
 if(navigator.locks)await navigator.locks.request('sniper-seat-alert',claim);else await claim();
}
async function pollSeats(){
 try{
  const revision=seatRevision,result=await api('seats');
  if(seatBusy||revision!==seatRevision)return;
  const first=!seatState;seatState=result;
  if(seatInitial===null)seatInitial=result.serial;
  const pending=result.events.filter(e=>e.id>seatInitial);
  seatInitial=Math.max(seatInitial,result.serial);
  renderSeats(first&&!watchDirty);
  for(const e of pending)await deliverSeatEvent(e);
 }catch(e){$('monitor-state').textContent='Disconnected';$('seat-nav').textContent='Offline';$('monitor-state').classList.remove('on');monitorMessage('Browser monitoring unavailable. Reload and check the watch list.',true);}
 finally{setTimeout(pollSeats,2500);}
}
async function saveWatch(){
 const crns=[...new Set($('watch-crns').value.trim().split(/[\s,;]+/).filter(Boolean))];
 if(!crns.length&&!$('watch-follow').checked)throw Error('Add at least one CRN.');
 seatState=await api('seats/config',{term:plan.term,crns,interval:Number($('watch-interval').value),follow_plan:$('watch-follow').checked,backups:$('watch-backups').checked});renderSeats(true);
}
async function seatAction(action){
 if(seatBusy||!loaded)return;
 seatBusy=true;seatRevision++;renderSeats();
 try{await action();monitorMessage(seatState.reason||'');}
 catch(e){monitorMessage(e.message,true);}
 finally{seatBusy=false;renderSeats();}
}
$('watch-crns').oninput=()=>{watchDirty=true;$('watch-follow').checked=false;};
for(const id of ['watch-interval','watch-follow','watch-backups'])$(id).onchange=()=>{watchDirty=true;};
$('watch-plan').onclick=()=>{
 if(!loaded||seatState?.running)return;
 const crns=[...new Set(plan.courses.filter(r=>r.selected&&r.status!=='registered').flatMap(r=>r.crns.split(/\s+/).filter(Boolean)))];
 $('watch-crns').value=crns.join(' ');$('watch-follow').checked=true;watchDirty=true;
 monitorMessage(crns.length?'Watch list updated. Save or Start to apply.':'No unregistered sections selected.',!crns.length);
};
$('watch-save').onclick=()=>seatAction(saveWatch);
$('monitor-start').onclick=()=>seatAction(async()=>{
 if(seatState?.running){seatState=await api('seats/stop',{});return;}
 if(watchDirty||!seatState?.crns.length||seatState.term!==plan.term)await saveWatch();
 seatState=await api('seats/start',{});
});
$('sound-toggle').onclick=async()=>{
 try{
  if(!soundEnabled){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Audio unavailable in this browser.');audioCtx??=new Context();await audioCtx.resume();if(audioCtx.state!=='running')throw Error('Sound could not be enabled.');}
  soundEnabled=!soundEnabled;$('sound-toggle').textContent=soundEnabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(soundEnabled));$('sound-test').disabled=!soundEnabled;
  if(soundEnabled)await alarm();
 }catch(e){monitorMessage(e.message,true);}
};
$('sound-test').onclick=()=>alarm().catch(()=>monitorMessage('Audio unavailable.',true));
$('desktop-toggle').onclick=async()=>{
 if(!('Notification' in window)){monitorMessage('Desktop notifications unavailable in this browser.',true);return;}
 try{
  if(desktopEnabled){desktopEnabled=false;}else{desktopEnabled=(await Notification.requestPermission())==='granted';if(!desktopEnabled)monitorMessage('Allow notifications for this page in Chrome and macOS settings.',true);}
  $('desktop-toggle').textContent=desktopEnabled?'Desktop on':'Desktop off';$('desktop-toggle').setAttribute('aria-pressed',String(desktopEnabled));
 }catch{monitorMessage('Notification permission could not be requested.',true);}
};
let choiceReview=null,choiceSequence=0;
function renderCombinations(){
 const names={available:'Selected components have seats',full:'A component is full',unknown:'Waiting for fresh counts',registered:'Registered'};
 $('combination-list').innerHTML=(seatState.combinations||[]).map(g=>`<article class="combination"><strong>${esc(g.course)}</strong><span class="combination-state ${esc(g.state)}">${names[g.state]}</span><div>${g.components.map(c=>`<span class="component-chip ${esc(c.state)}">${esc(c.course)} ${esc(c.section)} · ${esc(c.state)}</span>`).join('')}</div><small>Counts observed separately. Official component requirements and eligibility remain unverified.</small></article>`).join('');
 $('opportunity-list').innerHTML=(seatState.opportunities||[]).map(c=>`<article class="opportunity"><span><strong>${esc(c.course)} ${esc(c.section)}</strong> · seats observed · fits timetable</span><button data-choice="${esc(c.to)}">Review replacement</button></article>`).join('');
}
async function reviewChoice(crn){
 if(busy||!loaded)return;const seq=++choiceSequence;choiceReview=null;$('choice-apply').disabled=true;$('choice-error').textContent='';$('choice-summary').textContent='Checking…';if(!$('choice-dialog').open)$('choice-dialog').showModal();
 try{const c=await api('choice/review',{crn,revision:plan.revision});if(seq!==choiceSequence)return;choiceReview=c;$('choice-summary').innerHTML=`<p><strong>${esc(c.course)} ${esc(c.section)}</strong></p><p>${c.from?`Replace ${esc(c.from)} → ${esc(c.to)}`:`Select ${esc(c.to)}`}</p><p>Prepared CRNs: <code>${esc(c.crns.join(' '))}</code></p><details><summary>Eligibility checks</summary>${c.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</details>`;$('choice-apply').disabled=false;}
 catch(e){if(seq!==choiceSequence)return;$('choice-summary').textContent='Section cannot be selected yet.';$('choice-error').textContent=e.message;}
}
for(const id of ['opportunity-list','seat-events'])$(id).onclick=e=>{const b=e.target.closest('[data-choice]');if(b)reviewChoice(b.dataset.choice);};
$('choice-close').onclick=()=>{choiceSequence++;choiceReview=null;$('choice-dialog').close();};
$('choice-apply').onclick=async()=>{
 if(!choiceReview||busy)return;busy=true;$('choice-apply').disabled=true;
 try{plan=await api('choice/apply',{crn:choiceReview.to,revision:choiceReview.revision});invalidate();render();saveLabel('Saved');$('choice-dialog').close();view('plan');notify('Section selected. CRNs updated.');}
 catch(e){$('choice-error').textContent=e.message;}
 finally{busy=false;schedulePrepare();$('choice-apply').disabled=false;}
};
pollSeats();
