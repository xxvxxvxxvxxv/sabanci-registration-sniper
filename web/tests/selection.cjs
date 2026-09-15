const {JSDOM}=require('jsdom');
const vm=require('node:vm');
const fs=require('node:fs'),assert=require('node:assert/strict');
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json'));
(async()=>{
 const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://sniper.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,errors=[],copies=[];const evaluate=source=>vm.runInContext(source,dom.getInternalVMContext());
 const style=w.document.createElement('style');style.textContent=fs.readFileSync('public/style.css','utf8');w.document.head.append(style);
 w.addEventListener('error',e=>errors.push(e.error));
 w.confirm=()=>true;w.setInterval=()=>0;w.matchMedia=()=>({matches:false});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.navigator.clipboard={writeText:async text=>copies.push(text)};
 w.navigator.locks={request:async(name,options,cb)=>(cb||options)({name})};
 w.fetch=async()=>({ok:true,json:async()=>catalog});
 try{
  evaluate(fs.readFileSync('public/core.js','utf8'));
  const C=w.SniperCore,rows=['10119','10123','13511'].map(id=>{const {c,o}=C.lookup(catalog,id);return C.row(catalog,c,o);});
  rows[0].status='rejected';rows[1].status='uncertain';rows[2].status='registered';rows[2].selected=false;
  w.localStorage.setItem('sniper-web-plan-v1',JSON.stringify({term:catalog.term,courses:rows,revision:7,allow_time_conflicts:true}));
  w.localStorage.setItem('sniper-web-watch-v1',JSON.stringify({term:catalog.term,crns:['13511'],interval:120,follow_plan:false,backups:true}));
  w.localStorage.setItem('sniper-timetable-scale','comfortable');
  for(const file of ['web-api.js','ui.js','registration-data.js','registration-core.js','registration-ui.js','catalog-ui.js','seats-ui.js','phone-ui.js'])evaluate(fs.readFileSync('public/'+file,'utf8'));
  await new Promise(r=>setTimeout(r,180));
  const api=w.SniperWeb.api,$=id=>w.document.getElementById(id);
  assert.deepEqual(Array.from((await api('draft',await api('plan'))).crns),['10119','10123'],'Legacy outcomes must not block selected CRNs');
  assert.deepEqual(Array.from((await api('seats')).crns),['10119','10123'],'Old custom watchlists and backups must become selection-based');
  assert.equal($('course-rows').children.length,2);
  assert(!w.document.querySelector('.outcome'));
  for(const id of ['watch-follow','watch-backups','watch-plan','timetable-scale'])assert.equal($(id),null);
  assert(!w.document.querySelector('[name="status"]'));
  await $('copy-top').onclick();assert.equal(copies.pop(),'10119 10123');
  assert(!$('copy-top').hidden);
  for(const a of w.document.querySelectorAll('.tt-block')){
   assert.equal(a.tagName,'A');assert.equal(new URL(a.href).searchParams.get('term_in'),catalog.term);
   assert(a.querySelector('.tt-room'));assert(a.querySelector('.tt-time'));assert(a.querySelector('.registration-badge'));
  }
  assert.equal(w.document.querySelectorAll('.timetable-detail').length,2);
  assert(w.document.querySelector('.timetable-detail').textContent.includes('10119'));
  assert.equal(w.getComputedStyle(w.document.querySelector('.tt-room')).display,'block');
  evaluate("expandedCourse='CS 303';renderCatalog();");
  assert(w.document.querySelector('.section-link[href*="crn_in=10119"]'));
  assert(!w.document.querySelector('.save-fallback'));
  $('filter').value='unselected';$('filter').onchange();assert.equal($('course-rows').children.length,1);
  assert($('course-rows').textContent.includes('13511'));
  // A previously registered but unchecked section can be selected normally.
  const select=$('course-rows').querySelector('input');select.checked=true;await $('course-rows').onchange({target:select});
  assert((await api('seats')).crns.includes('13511'));
  await api('seats/config',{term:catalog.term,crns:[],interval:30});assert.equal((await api('seats')).interval,30);
  await api('seats/start');
  // Selection changes while watching reach the watchlist without a separate save/start action.
  let p=await api('plan');p.courses[0].selected=false;await api('save',p);
  assert.deepEqual(Array.from((await api('seats')).crns),['10123','13511']);assert((await api('seats')).running);
  await api('seats/stop');
  assert($('desktop-toggle').textContent.includes('notifications'));assert($('phone-open').textContent.includes('Telegram notifications'));
  assert.deepEqual(errors,[]);
  console.log('PASS: old-plan compatibility, binary selection, visible clipboard action, SUIS links, full details, automatic watchlist updates and notification labels.');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exit(1);});
