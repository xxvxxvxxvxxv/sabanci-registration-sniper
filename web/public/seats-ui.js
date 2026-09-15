'use strict';
let displayedMonitorReason='',alarmUntil=0,seatRevision=0,seatState=null,seatBusy=false,watchDirty=false,seatInitial=null,soundEnabled=false,desktopEnabled=false,audioCtx=null;
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

 $('monitor-state').textContent=s.running?'Watching':'Paused';$('monitor-state').classList.toggle('on',s.running);
 $('seat-nav').textContent=s.running?'On':'Paused';
 $('monitor-start').textContent=s.running?'Pause':'Start';$('monitor-start').disabled=seatBusy;

 $('seats-empty').hidden=s.crns.length>0;
 $('seat-rows').innerHTML=s.crns.map(crn=>{const o=s.observations[crn]||{},unknown=o.remaining===undefined,unreliable=unknown||Boolean(o.error)||o.stale;
 const count=o.available??o.remaining,remaining=unreliable?'Unknown':count;
 return `<tr><td><strong>${esc(seatLabel(crn))}</strong><a class="seat-source" href="https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=${esc(s.term)}&amp;crn_in=${esc(crn)}" target="_blank" rel="noreferrer">${esc(crn)} ↗</a></td><td><strong class="seat-number ${!unreliable&&count>0?'available':''}">${remaining}</strong>${unreliable&&!unknown?`<small>Last observed: ${count}</small>`:''}</td><td>${unknown?'—':`${o.actual} / ${o.capacity}`}${o.cross_list?`<details><summary>Shared limit</summary><small>${o.cross_list.remaining} remaining</small></details>`:''}</td><td><time>${seatTime(o.checked_at)}</time>${o.error?`<small class="seat-error">${esc(o.error)}</small>`:o.stale?'<small>Stale observation</small>':unknown?'<small>Awaiting first check</small>':''}</td></tr>`;
 }).join('');

 $('seat-event-count').textContent=s.events.length||'';
 $('seat-events').innerHTML=[...s.events].reverse().slice(0,30).map(e=>`<div class="seat-event"><time>${seatTime(e.at)}</time><span>${e.kind==='opened'?`${esc(seatLabel(e.crn))} · ${e.remaining} seat(s) observed`:`Monitoring stopped · ${esc(e.crn)}`}</span>${e.kind==='opened'?`<a href="${courseURL(s.term,e.crn)}" target="_blank" rel="noreferrer">Course page ↗</a>`:''}</div>`).join('')||'<p>No alerts yet.</p>';
 if(s.reason){monitorMessage(s.reason,!s.reason.startsWith('Public feed is busy.'));displayedMonitorReason=s.reason;}
 else if(displayedMonitorReason){if($('monitor-message').textContent===displayedMonitorReason)monitorMessage('');displayedMonitorReason='';}
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
 seatState=await api('seats/config',{term:plan.term,crns:[],interval:30,follow_plan:true,backups:false});renderSeats(true);
}
async function seatAction(action){
 if(seatBusy||!loaded)return;
 seatBusy=true;seatRevision++;renderSeats();
 try{await action();monitorMessage(seatState.reason||'');}
 catch(e){monitorMessage(e.message,true);}
 finally{seatBusy=false;renderSeats();}
}
$('monitor-start').onclick=()=>seatAction(async()=>{
 if(seatState?.running){seatState=await api('seats/stop',{});return;}
 await saveWatch();
 seatState=await api('seats/start',{});
});
$('sound-toggle').onclick=async()=>{
 try{
  if(!soundEnabled){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Audio unavailable in this browser.');audioCtx??=new Context();await audioCtx.resume();if(audioCtx.state!=='running')throw Error('Sound could not be enabled.');}
  soundEnabled=!soundEnabled;$('sound-toggle').textContent=soundEnabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
  if(soundEnabled)await alarm();
 }catch(e){monitorMessage(e.message,true);}
};
$('desktop-toggle').onclick=async()=>{
 if(!('Notification' in window)){monitorMessage('Desktop notifications unavailable in this browser.',true);return;}
 try{
  if(desktopEnabled){desktopEnabled=false;}else{desktopEnabled=(await Notification.requestPermission())==='granted';if(!desktopEnabled)monitorMessage('Allow notifications for this page in Chrome and macOS settings.',true);}
  $('desktop-toggle').textContent=desktopEnabled?'Desktop notifications on':'Desktop notifications off';$('desktop-toggle').setAttribute('aria-pressed',String(desktopEnabled));
 }catch{monitorMessage('Notification permission could not be requested.',true);}
};
pollSeats();
