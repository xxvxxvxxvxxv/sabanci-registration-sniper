'use strict';
const $=id=>document.getElementById(id);
let config=null,working=false,pageGeneration=0,lastFilled=null,automatic=true;
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
async function refresh(){
 if(working)return;working=true;
 try{
  const packet=await fetchPacket(true);showPacket(packet);
  if(!packet.crns.length){status('Choose your courses in the planner.');return;}
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if($('aimbot-enabled').checked){status('Aimbot is watching for an opening.');return;}
  if(!automatic){status('Autofill off.');return;}
  if(!isSuis(tab?.url)){status('Open SUIS Add/Drop to fill these CRNs.');return;}
  if(tab.status==='loading'){status('Waiting for SUIS…');return;}
  const stamp=JSON.stringify([tab.id,tab.url,pageGeneration,packet.term,packet.revision,packet.crns]);
  if(lastFilled===stamp)return;
  const generation=pageGeneration,current=await fetchPacket();
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['autofill-core.js','suis-adapter.js']});
  const preview=await adapter(tab.id,'suis','preview',current);
  const fresh=await fetchPacket(),[active]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!automatic||generation!==pageGeneration||active?.id!==tab.id||active.url!==tab.url)return;
  if(!SniperFillCore.samePacket(current,fresh))throw Error('Plan changed. Reloading CRNs…');
  const result=await adapter(tab.id,'suis','fill',fresh,preview);
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
chrome.storage.local.get('autofill').then(v=>{automatic=v.autofill!==false;$('autofill').checked=automatic;refresh();}).catch(e=>status(e.message));
setInterval(refresh,2000);
