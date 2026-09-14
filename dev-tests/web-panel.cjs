const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../extension'),origin='https://sabanci-registration-sniper.sitegap-tools.workers.dev';
const settle=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 const panel=new JSDOM(fs.readFileSync(root+'/popup.html','utf8'),{url:'https://extension.test/',runScripts:'outside-only'});
 const page=new JSDOM('',{url:origin,runScripts:'outside-only'}),w=panel.window;
 let current={id:7,url:origin+'/'},sourceTab=current,activate,update,stored={},copied='',injections=0;
 let plan={term:'202601',revision:1},crns=['10119','10123'],ready=true,changedDuringDraft=false;
 page.window.SniperWeb={api:async method=>{
  if(method==='plan')return {...plan};
  if(method==='draft'){if(changedDuringDraft)plan.revision++;return {ready,crns,errors:ready?[]:['Time conflict'],warnings:['Eligibility unverified'],secret:'must-not-cross-bridge'};}
  throw Error('Unexpected website action');
 }};
 w.navigator.clipboard={writeText:async text=>{copied=text;}};
 w.chrome={storage:{session:{get:async()=>stored,set:async value=>{stored=value;},remove:async()=>{stored={};}}},
  tabs:{query:async()=>[current],get:async id=>{assert.equal(id,7);if(!sourceTab)throw Error('Tab closed');return sourceTab;},create:async()=>{},onActivated:{addListener:f=>{activate=f;}},onUpdated:{addListener:f=>{update=f;}}},
  scripting:{executeScript:async options=>{
   injections++;assert.equal(options.target.tabId,7);assert.equal(options.world,'MAIN');
   const fn=page.window.eval('('+options.func.toString()+')');
   return [{result:await fn(...options.args)}];
  }}};
 try{
  for(const f of ['autofill-core.js','web-source.js','popup.js'])w.eval(fs.readFileSync(root+'/'+f,'utf8'));
  await settle();w.document.getElementById('website-connect').click();await settle();
  assert.equal(stored.connection.tabId,7);assert.equal(stored.connection.kind,'website');
  assert.match(w.document.getElementById('crn-list').textContent,/10119\s+10123/);
  const packet=await w.SniperWebSource.read(7);assert(!JSON.stringify(packet).includes('must-not-cross-bridge'));
  current={id:8,url:'https://suis.sabanciuniv.edu/'};activate({tabId:8});
  assert(!w.document.getElementById('copy-crns').disabled,'CRNs stay available when switching to SUIS');
  crns=['13511'];plan.revision++;
  w.document.getElementById('copy-crns').click();await settle();assert.equal(copied,'13511','Copy must reload the current source plan');
  changedDuringDraft=true;w.document.getElementById('load-crns').click();await settle();
  assert.match(w.document.getElementById('status').textContent,/Plan changed/);assert(w.document.getElementById('copy-crns').disabled);
  changedDuringDraft=false;ready=false;w.document.getElementById('load-crns').click();await settle();
  assert.match(w.document.getElementById('status').textContent,/Time conflict/);
  ready=true;w.document.getElementById('load-crns').click();await settle();
  update(7,{status:'loading'});assert(w.document.getElementById('copy-crns').disabled,'Source reload invalidates visible CRNs');
  sourceTab={id:7,url:'https://example.org/'};const before=injections;
  w.document.getElementById('load-crns').click();await settle();assert.equal(injections,before,'Do not inject into a different origin');
  assert(!w.SniperWebSource.accepts(origin+'.evil.test/'));
  sourceTab=null;w.document.getElementById('load-crns').click();await settle();assert.match(w.document.getElementById('status').textContent,/Tab closed/);
  console.log('PASS: hosted side-panel transfer, current-plan copy, tab switching, blocked plans, revision races, source navigation and origin checks (Chrome APIs simulated).');
 }finally{panel.window.close();page.window.close();}
})().catch(e=>{console.error(e);process.exit(1);});
