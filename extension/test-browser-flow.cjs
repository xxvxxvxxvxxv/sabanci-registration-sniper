'use strict';
const {JSDOM}=require('../web/node_modules/jsdom'),vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=__dirname,code=n=>fs.readFileSync(root+'/'+n,'utf8');
const pause=()=>new Promise(r=>setTimeout(r,15));
function page(env='dolly',term='202601',destination=env){
 const d=new JSDOM(`<form method="post" action="/${destination}/bwskfreg.P_Registration"><input type="hidden" name="term_in" value="${term}"><input name="crn_in" maxlength="5"><input name="crn_in" maxlength="5"><input name="crn_in" maxlength="5"><button type="submit">Submit Changes</button></form>`,{url:`https://suis.sabanciuniv.edu/${env}/bwskfreg.P_AltPin`,runScripts:'outside-only'});
 const w=d.window;w.HTMLElement.prototype.getBoundingClientRect=()=>({width:70,height:20});w.HTMLElement.prototype.getClientRects=()=>[{}];
 for(const n of ['autofill-core.js','suis-adapter.js'])vm.runInContext(code(n),d.getInternalVMContext());return d;
}
const packet=()=>({ready:true,term:'202601',revision:1,crns:['10119','10123'],generated_at:new Date().toISOString()});
(async()=>{
 for(const env of ['prod','dolly']){
  const d=page(env),w=d.window,p=packet();let submits=0;w.document.forms[0].addEventListener('submit',()=>submits++);
  const pre=w.SniperSuisAdapter.preview(p);assert.equal(w.SniperSuisAdapter.fill(p,pre).filled,2);assert.equal(submits,0);
  assert.deepEqual([...w.document.querySelectorAll('[name=crn_in]')].map(x=>x.value),['10119','10123','']);
  assert(w.SniperSuisAdapter.preview(p).already);d.window.close();
 }
 for(const args of [['dolly','202602'],['dolly','202601','prod']]){const d=page(...args);assert.throws(()=>d.window.SniperSuisAdapter.preview(packet()));d.window.close();}
 const replaced=page();const p=packet(),pre=replaced.window.SniperSuisAdapter.preview(p);replaced.window.document.querySelector('[name=crn_in]').outerHTML='<input name="crn_in" maxlength="5">';assert.throws(()=>replaced.window.SniperSuisAdapter.fill(p,pre),/changed/);replaced.window.close();
 const dom=new JSDOM(code('popup.html'),{url:'https://extension.test',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
 const plan=new JSDOM('',{url:'https://sabanci-registration-sniper.sitegap-tools.workers.dev',runScripts:'outside-only'}),suis=page();
 let active=2,closed=false,blocked=false,revision=1,copies=[],submits=0;
 suis.window.document.forms[0].addEventListener('submit',e=>{submits++;e.preventDefault();});
 plan.window.SniperWeb={api:async path=>path==='plan'?{term:'202601',revision,courses:[{selected:true,crns:'10119'},{selected:true,crns:'10123'},{selected:false,crns:'13511'}]}:{ready:!blocked,crns:blocked?[]:['10119','10123'],errors:blocked?['Time conflict']:[],warnings:[]}};
 const tablist=()=>[{id:1,url:plan.window.location.href},{id:2,url:suis.window.location.href}].filter(t=>!closed||t.id!==1).map(t=>({...t,active:t.id===active,status:'complete'}));
 const event={addListener:()=>{}};
 w.chrome={tabs:{query:async q=>tablist().filter(t=>!q.active||t.active),get:async id=>{const t=tablist().find(t=>t.id===id);if(!t)throw Error('closed');return t;},onActivated:event,onUpdated:event,onRemoved:event},storage:{session:{remove:async()=>{},get:async()=>({}),set:async()=>{}},local:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async o=>{const d=o.target.tabId===1?plan:suis,c=d.getInternalVMContext();if(o.files){for(const n of o.files)vm.runInContext(code(n),c);return [];}return [{result:await vm.runInContext('('+o.func.toString()+')(...'+JSON.stringify(o.args||[])+')',c)}];}}};
 const submissions=new Set();w.chrome.runtime={sendMessage:async m=>{const claimed=submissions.has(m.key);if(m.type==='submission-claim')submissions.add(m.key);return {claimed};}};
 suis.window.HTMLFormElement.prototype.requestSubmit=function(button){this.dispatchEvent(new suis.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));};
 w.setInterval=()=>0;w.navigator.clipboard={writeText:async t=>copies.push(t)};
 for(const n of ['autofill-core.js','web-source.js','popup.js'])vm.runInContext(code(n),ctx);
 await pause();await vm.runInContext('refresh()',ctx);
 assert.equal(w.document.querySelector('#crn-list').textContent,'10119 10123');
 assert.deepEqual([...suis.window.document.querySelectorAll('[name=crn_in]')].map(x=>x.value),['10119','10123','']);assert.equal(submits,0);
 assert.equal(w.document.querySelectorAll('button').length,2);assert(w.document.querySelector('#open-website').hidden);
 assert(!w.document.getElementById('connect'));assert(!w.document.getElementById('preview'));
 // Auto submit is opt-in, then dispatches once even after panel refresh/navigation.
 const auto=w.document.getElementById('auto-submit');assert(!auto.checked);auto.checked=true;auto.onchange();await pause();await vm.runInContext('refresh()',ctx);
 assert.equal(submits,1);await vm.runInContext('pageGeneration++;lastFilled=null;refresh()',ctx);assert.equal(submits,1);
 // Copy stays usable when preparation is blocked, and autofill does not touch occupied values.
 blocked=true;revision++;suis.window.document.querySelector('[name=crn_in]').value='99999';await vm.runInContext('refresh()',ctx);
 assert(w.document.getElementById('status').textContent.includes('Time conflict'));await w.document.getElementById('copy-crns').onclick();assert.equal(copies.pop(),'10119 10123');
 blocked=false;revision++;await vm.runInContext('refresh()',ctx);assert(w.document.getElementById('status').textContent.includes('contain values'));assert.equal(suis.window.document.querySelector('[name=crn_in]').value,'99999');
 closed=true;await vm.runInContext('refresh()',ctx);assert(w.document.getElementById('copy-crns').disabled);assert(!w.document.getElementById('open-website').hidden);
 // Aimbot waits through a login page, resumes after sign-in, fills and submits once.
 closed=false;blocked=false;revision++;active=2;
 const originalApi=plan.window.SniperWeb.api;
 plan.window.SniperWeb.api=async path=>path==='seats'?{running:true,term:'202601',crns:['10119','10123'],cycle_seconds:30,events:[],observations:Object.fromEntries(['10119','10123'].map(id=>[id,{available:2,stale:false,checked_at:new Date().toISOString()}]))}:originalApi(path);
 const formHTML=suis.window.document.body.innerHTML;
 suis.window.document.body.innerHTML='<input type="password">';
 let aimTick;w.setInterval=f=>{aimTick=f;};w.chrome.tabs.update=async id=>{active=id;return tablist().find(t=>t.id===id);};
 for(const n of ['aimbot-core.js','aimbot-panel.js'])vm.runInContext(code(n),ctx);
 const aim=w.document.getElementById('aimbot-enabled');aim.checked=true;await aim.onchange();assert(aim.checked);
 await aimTick();assert.equal(submits,1);assert(w.document.getElementById('aimbot-status').textContent.includes('Sign in'));
 suis.window.document.body.innerHTML=formHTML;for(const n of suis.window.document.querySelectorAll('[name=crn_in]'))n.value='';
 suis.window.document.forms[0].addEventListener('submit',e=>{submits++;e.preventDefault();});
 await aimTick();assert.equal(submits,2);assert(!aim.checked);await aimTick();assert.equal(submits,2);
 for(const d of [dom,plan,suis])d.window.close();
 console.log('PASS: automatic discovery, real DOM field writes/readback, production/trial isolation, term and DOM guards, copy through conflicts, closed-tab recovery opt-in submission exactly once, and Aimbot resumes after login (Chrome APIs simulated).');
})().catch(e=>{console.error(e);process.exit(1);});
