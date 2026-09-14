'use strict';
const $=id=>document.getElementById(id);let pageGeneration=0,config=null,candidate=null,working=false;
function status(t){$('status').textContent=t;}
async function fetchPacket(){if(!config)throw Error('Connection required.');if(config.kind==='website'){const p=await SniperWebSource.read(config.tabId);if(!p.ready)throw Error((p.errors||['Preparation blocked.']).join('\n'));return p;}const r=await fetch(`http://127.0.0.1:${config.port}/api/bridge/plan`,{headers:{'X-Bridge-Key':config.key},cache:'no-store',signal:AbortSignal.timeout(8000)});const p=await r.json();if(!r.ok)throw Error(p.error||'Local app request failed.');if(!p.ready)throw Error((p.errors||['Preparation blocked.']).join('\n'));return p;}
async function adapter(tabId,method,...args){const result=await chrome.scripting.executeScript({target:{tabId},func:async(method,args)=>{try{return {ok:true,result:await globalThis.SniperMockAdapter[method](...args)};}catch(e){return {ok:false,error:e.message};}},args:[method,args]});const answer=result[0]?.result;if(!answer?.ok)throw Error(answer?.error||'No adapter response.');return answer.result;}
async function task(fn){if(working)return;working=true;$('fill').disabled=true;$('preview').disabled=true;try{await fn();}catch(e){candidate=null;$('crn-list').textContent='';$('copy-crns').disabled=true;status(e.message);}finally{working=false;$('preview').disabled=false;$('fill').disabled=!candidate;}}
$('connect').onclick=()=>task(async()=>{const port=Number($('port').value),key=$('key').value.trim();if(!Number.isInteger(port)||port<1024||port>65535||key.length<30)throw Error('Enter a valid local port and connection key.');config={port,key};candidate=null;$('crn-list').textContent='';$('copy-crns').disabled=true;await chrome.storage.session.set({connection:config});$('key').value='';status('Connected settings saved for this browser session. Load plan to verify.');$('connection').open=false;});
$('disconnect').onclick=()=>task(async()=>{config=null;candidate=null;$('crn-list').textContent='';$('copy-crns').disabled=true;await chrome.storage.session.remove('connection');$('key').value='';$('mapping').textContent='';status('Disconnected.');});
$('preview').onclick=()=>task(async()=>{candidate=null;$('mapping').textContent='';status('Loading…');const version=pageGeneration,packet=await fetchPacket();const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=new URL(tab.url||'about:blank');if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.port!==String(config.port||8765)||url.pathname!=='/mock')throw Error('Open the local app mock form first. Live SUIS is unsupported.');await chrome.scripting.executeScript({target:{tabId:tab.id},files:['autofill-core.js','mock-adapter.js']});const preview=await adapter(tab.id,'preview',packet);if(version!==pageGeneration)throw Error('Active page changed. Preview again.');candidate={packet,preview,tabId:tab.id};$('mapping').textContent=preview.mapping.map(m=>m.id+' ← '+m.crn).join('\n');$('warnings').textContent=(packet.warnings||[]).join('\n');status(`Term ${packet.term} · revision ${packet.revision} · ${packet.crns.length} CRNs. ${preview.already?'Already filled.':'Ready for local test fill.'}`);});
$('fill').onclick=()=>task(async()=>{if(!candidate)throw Error('Preview required.');const current=await fetchPacket();if(!SniperFillCore.samePacket(candidate.packet,current))throw Error('Plan changed after preview. Preview again.');const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab.id!==candidate.tabId)throw Error('Active tab changed. Preview again.');const result=await adapter(tab.id,'fill',candidate.packet,candidate.preview);candidate=null;status(result.message);});
chrome.storage.session.get('connection').then(v=>{config=v.connection||null;if(config){if(config.port)$('port').value=config.port;status(config.kind==='website'?'Website connected. Refresh CRNs to load the current plan.':'Connection settings loaded.');}else $('connection').open=true;}).catch(e=>status(e.message));

function clearPreview(){pageGeneration++;candidate=null;$('fill').disabled=true;$('mapping').textContent='';if(config)status(config.kind==='website'?'Website CRNs remain available. Copy reloads the current plan.':'Active page changed. Preview fields again.');}
chrome.tabs.onActivated.addListener(clearPreview);
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status!=='loading')return;if(candidate?.tabId===id)clearPreview();if(config?.kind==='website'&&config.tabId===id){candidate=null;$('fill').disabled=true;$('crn-list').textContent='';$('copy-crns').disabled=true;status('Website reloading. Refresh CRNs when it finishes.');}});

function showPacket(packet){
 const fields=packet.crns.map((crn,i)=>({id:'packet-'+i,value:'',type:'text',maxLength:5,disabled:false,readOnly:false,visible:true}));
 SniperFillCore.prepare(packet,{term:packet.term,fields});
 $('crn-list').textContent=packet.crns.join('\t');$('copy-crns').disabled=false;
 $('warnings').textContent=(packet.warnings||[]).join('\n');
 status(`Term ${packet.term} · revision ${packet.revision} · ${packet.crns.length} CRNs. Ready to copy.`);
}
$('website-connect').onclick=()=>task(async()=>{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab||!SniperWebSource.accepts(tab.url))throw Error('Open the Registration Sniper website, then click Use this website tab.');
 const packet=await SniperWebSource.read(tab.id);showPacket(packet);
 config={kind:'website',tabId:tab.id};candidate=null;
 await chrome.storage.session.set({connection:config});$('connection').open=false;
});
$('open-website').onclick=()=>chrome.tabs.create({url:SniperWebSource.origin+'/'}).catch(e=>status(e.message));
$('load-crns').onclick=()=>task(async()=>showPacket(await fetchPacket()));
$('copy-crns').onclick=()=>task(async()=>{const packet=await fetchPacket();showPacket(packet);await navigator.clipboard.writeText(packet.crns.join('\t'));status(`${packet.crns.length} current CRNs copied.`);});
