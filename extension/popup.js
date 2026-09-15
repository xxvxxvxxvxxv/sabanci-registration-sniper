'use strict';
const $=id=>document.getElementById(id);
let config=null,working=false,pageGeneration=0,lastFilled=null,automatic=true,autoSubmit=false;
function status(text){$('status').textContent=text;}
async function planner(){
 const tabs=await chrome.tabs.query({currentWindow:true});
 const sources=tabs.filter(t=>SniperWebSource.accepts(t.url));
 const chosen=sources.find(t=>t.active)||(sources.length===1?sources[0]:null);
 if(!chosen){config=null;throw Error(sources.length?'Open the planner tab you want to use.':'Open the planner to load your CRNs.');}
 config={kind:'website',tabId:chosen.id};return chosen;
}
async function fetchPacket(copyOnly=false){
 // Keep the chosen planner while the user switches to SUIS; never guess among plans.
 if(config){try{const t=await chrome.tabs.get(config.tabId);if(!SniperWebSource.accepts(t.url))config=null;}catch{config=null;}}
 const active=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
 if(active&&SniperWebSource.accepts(active.url))config={kind:'website',tabId:active.id};
 if(!config)await planner();
 const packet=await SniperWebSource.read(config.tabId,copyOnly);
 if(!copyOnly&&!packet.ready)throw Error((packet.errors||['Check your selected courses in the planner.']).join('\n'));
 return packet;
}
async function adapter(tabId,kind,method,...args){
 const results=await chrome.scripting.executeScript({target:{tabId},func:async(method,args)=>{try{return {ok:true,result:await globalThis.SniperSuisAdapter[method](...args)};}catch(e){return {ok:false,error:e.message};}},args:[method,args]});
 const answer=results[0]?.result;if(!answer?.ok)throw Error(answer?.error||'SUIS page changed. Reopen Add/Drop.');return answer.result;
}
function showPacket(p){
 const fields=p.crns.map((_,i)=>({id:String(i),value:'',type:'text',maxLength:5,disabled:false,readOnly:false,visible:true}));
 if(p.crns.length)SniperFillCore.prepare(p,{term:p.term,fields});
 $('crn-list').textContent=p.crns.join(' ');$('copy-crns').disabled=!p.crns.length;
 $('open-website').hidden=true;
}
function isSuis(url){try{return new URL(url).origin==='https://suis.sabanciuniv.edu';}catch{return false;}}
function submissionKey(tab,packet){return JSON.stringify([tab.id,new URL(tab.url).pathname.split('/')[1],packet.term,packet.revision,packet.crns]);}
async function submissionState(type,key){const result=await chrome.runtime.sendMessage({type,key});if(!result||result.error)throw Error(result?.error||'Submission status unavailable.');return result;}
async function submitPacket(tabId,packet,allowed=()=>true){
 const [active]=await chrome.tabs.query({active:true,currentWindow:true});
 if(active?.id!==tabId||!isSuis(active.url)||!allowed())throw Error('Submission paused.');
 const ticket=await adapter(tabId,'suis','checkSubmit',packet);
 const current=await fetchPacket();if(!allowed()||!SniperFillCore.samePacket(packet,current))throw Error('Plan or options changed before submission.');
 const key=submissionKey(active,current),claim=await submissionState('submission-claim',key);
 if(claim.claimed)return {message:'Already attempted this plan. Check the SUIS result.'};
 const [again]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!allowed()||again?.id!==tabId||again.url!==active.url)throw Error('Page changed. Check SUIS before retrying.');
 try{return await adapter(tabId,'suis','submit',current,ticket);}catch(e){throw Error('Submission could not be confirmed. Check SUIS. '+e.message);}
}
async function refresh(){
 if(working)return;working=true;
 try{
  const packet=await fetchPacket(true);showPacket(packet);
  if(!packet.crns.length){status('Choose your courses in the planner.');return;}
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if($('aimbot-enabled').checked){status('Aimbot is watching for an opening.');return;}
  if(!automatic&&!autoSubmit){status('Autofill off.');return;}
  if(!isSuis(tab?.url)){status('Open SUIS Add/Drop to fill these CRNs.');return;}
  if(tab.status==='loading'){status('Waiting for SUIS…');return;}
  if(autoSubmit&&(await submissionState('submission-status',submissionKey(tab,packet))).claimed){status('Submission already attempted. Check the SUIS result.');return;}
  const stamp=JSON.stringify([tab.id,tab.url,pageGeneration,packet.term,packet.revision,packet.crns]);
  if(lastFilled===stamp)return;
  const generation=pageGeneration,current=await fetchPacket();
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['autofill-core.js','suis-adapter.js']});
  const preview=automatic?await adapter(tab.id,'suis','preview',current):null;
  const fresh=await fetchPacket(),[active]=await chrome.tabs.query({active:true,currentWindow:true});
  if((!automatic&&!autoSubmit)||generation!==pageGeneration||active?.id!==tab.id||active.url!==tab.url)return;
  if(!SniperFillCore.samePacket(current,fresh))throw Error('Plan changed. Reloading CRNs…');
  const result=automatic?await adapter(tab.id,'suis','fill',fresh,preview):{filled:0};
  if(autoSubmit){const sent=await submitPacket(tab.id,fresh,()=>autoSubmit&&generation===pageGeneration&&!$('aimbot-enabled').checked);lastFilled=stamp;status(sent.message);return;}
  lastFilled=stamp;status(result.filled?'CRNs filled. Review and submit in SUIS.':'CRNs already filled. Review and submit in SUIS.');
 }catch(e){status(e.message);if(!config){$('crn-list').textContent='';$('copy-crns').disabled=true;$('open-website').hidden=false;}}
 finally{working=false;}
}
$('copy-crns').onclick=async()=>{try{const p=await fetchPacket(true);showPacket(p);if(p.crns.length){await navigator.clipboard.writeText(p.crns.join(' '));status('Copied.');}}catch(e){status(e.message);}};
$('open-website').onclick=()=>chrome.tabs.create({url:SniperWebSource.origin+'/'}).catch(e=>status(e.message));
$('autofill').onchange=()=>{automatic=$('autofill').checked;pageGeneration++;lastFilled=null;chrome.storage.local.set({autofill:automatic}).catch(e=>status(e.message));refresh();};
chrome.tabs.onActivated.addListener(()=>{pageGeneration++;lastFilled=null;refresh();});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='loading'){pageGeneration++;lastFilled=null;}if(change.status==='complete')refresh();});
chrome.tabs.onRemoved.addListener(id=>{if(config?.tabId===id){config=null;lastFilled=null;refresh();}});
// Discard keys left by older local-app versions.
chrome.storage.session.remove('connection').catch(()=>{});
$('auto-submit').onchange=()=>{autoSubmit=$('auto-submit').checked;pageGeneration++;lastFilled=null;chrome.storage.session.set({autoSubmit}).catch(e=>status(e.message));refresh();};
Promise.all([chrome.storage.local.get('autofill'),chrome.storage.session.get('autoSubmit')]).then(([v,s])=>{automatic=v.autofill!==false;autoSubmit=s.autoSubmit===true;$('autofill').checked=automatic;$('auto-submit').checked=autoSubmit;refresh();}).catch(e=>status(e.message));
setInterval(refresh,2000);
