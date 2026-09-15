'use strict';
(()=>{
 let targetId=null,run=null,checking=false,epoch=0;
 const output=$('aimbot-status'),toggle=$('aimbot-enabled');
 function stop(message){epoch++;run=null;toggle.checked=false;output.textContent=message;}
 async function observations(){
  if(config?.kind!=='website')throw Error('Connect the website tab first.');
  const source=await chrome.tabs.get(config.tabId);if(!SniperWebSource.accepts(source.url))throw Error('Planner tab changed or closed.');
  const result=await chrome.scripting.executeScript({target:{tabId:config.tabId},world:'MAIN',func:async origin=>{
   if(location.origin!==origin||!window.SniperWeb)throw Error('Planner unavailable.');
   const s=await SniperWeb.api('seats');
   return {running:s.running,term:s.term,crns:s.crns,cycle_seconds:s.cycle_seconds,events:s.events.map(e=>({id:e.id,kind:e.kind,crn:e.crn,term:e.term,at:e.at})),observations:Object.fromEntries(Object.entries(s.observations).map(([crn,o])=>[crn,{available:o.available,stale:o.stale,checked_at:o.checked_at}]))};
  },args:[SniperWebSource.origin]});
  if(!result[0]?.result)throw Error('Seat monitor unavailable.');return result[0].result;
 }
 async function flow(act,term){
  const tab=await chrome.tabs.get(targetId);
  if(new URL(tab.url).origin!=='https://suis.sabanciuniv.edu')throw Error('SUIS target changed.');
  await chrome.scripting.executeScript({target:{tabId:targetId},files:['flow-adapter.js']});
  const result=await chrome.scripting.executeScript({target:{tabId:targetId},func:(term,act)=>{try{return {ok:true,value:RiperFlow.next(term,act)};}catch(e){return {ok:false,error:e.message};}},args:[term,act]});
  const r=result[0]?.result;if(!r?.ok)throw Error(r?.error||'SUIS page unavailable.');return r.value;
 }
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function prepare(savedEpoch){
  const valid=()=>{if(epoch!==savedEpoch||!run)throw Error('Aimbot stopped.');};
  const visited=new Set();
  await chrome.tabs.update(targetId,{active:true});
  for(let step=0;step<5;step++){
   valid();const packet=await fetchPacket();valid();if(RiperAimbot.identity(packet)!==run.identity)throw Error('Plan changed. Nothing further will be filled.');
   const tab=await chrome.tabs.get(targetId),state=await flow(false,packet.term);valid();
   if(state.kind==='login')throw Error(state.message);
   if(state.kind==='crns'){
    await chrome.scripting.executeScript({target:{tabId:targetId},files:['autofill-core.js','suis-adapter.js']});valid();
    const preview=await adapter(targetId,'suis','preview',packet);valid();
    const current=await fetchPacket();valid();if(!SniperFillCore.samePacket(packet,current))throw Error('Plan changed before fill.');
    const latest=await observations();valid();if(RiperAimbot.decide({...run,state:'watching'},current,latest).action!=='prepare')throw Error('Seat data changed. Review before filling.');
    await adapter(targetId,'suis','fill',current,preview);valid();
    stop('CRNs filled. Review and submit in SUIS.');return;
   }
   const signature=tab.url+'|'+state.kind;
   if(visited.has(signature))throw Error('Navigation did not advance. Review SUIS manually.');visited.add(signature);
   if(state.kind==='link')await chrome.tabs.update(targetId,{url:state.href});else if(state.kind==='term')await flow(true,packet.term);else throw Error('Unrecognized page.');
   await delay(900);valid();
   for(let i=0;i<15;i++){const t=await chrome.tabs.get(targetId);valid();if(t.status==='complete')break;await delay(1000);if(i===14)throw Error('Page load timed out. Review SUIS manually.');}
  }
  throw Error('Navigation limit reached. Review SUIS manually.');
 }
 toggle.onchange=async()=>{
  if(!toggle.checked){stop('Aimbot off.');return;}const id=++epoch;
  try{const tabs=await chrome.tabs.query({currentWindow:true}),suis=tabs.filter(t=>isSuis(t.url));const target=suis.find(t=>t.active)||(suis.length===1?suis[0]:null);if(!target)throw Error('Open the SUIS Add/Drop tab you want to use.');targetId=target.id;const packet=await fetchPacket(),seats=await observations();if(epoch!==id)return;const page=await flow(false,packet.term);if(epoch!==id)return;if(page.kind==='login')throw Error(page.message);run=RiperAimbot.arm(packet,seats);output.textContent='Waiting for a seat opening.';}catch(e){if(epoch===id)stop(e.message);}
 };
 setInterval(async()=>{
  if(!run||checking||run.state!=='watching')return;checking=true;const id=epoch;
  try{const packet=await fetchPacket(),seats=await observations();if(epoch!==id||!run)return;const decision=RiperAimbot.decide(run,packet,seats);
   if(decision.action==='stop')stop(decision.reason);
   if(decision.action==='prepare'){run.state='preparing';output.textContent='Opening detected. Preparing the SUIS form…';await prepare(id);}
  }catch(e){if(epoch===id)stop(e.message);}finally{checking=false;}
 },2000);
 window.addEventListener('pagehide',()=>stop('Aimbot off.'));
})();
