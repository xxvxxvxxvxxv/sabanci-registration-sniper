const vm=require('node:vm');const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');const fs=require('fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8'),cat=JSON.parse(fs.readFileSync('public/data/catalog.json'));const source=n=>fs.readFileSync('public/'+n,'utf8');
(async()=>{
 const errors=[],requests=[],intervals=[],notifications=[],registered=[];let seatCount=0;const dom=new JSDOM(html,{url:'https://sniper.test/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.confirm=()=>true;w.matchMedia=()=>({matches:false});w.AbortSignal.timeout=()=>undefined;
 w.setInterval=f=>{intervals.push(f);return intervals.length;};
 const held=new Set();w.navigator.locks={request:async(name,options,cb)=>{if(typeof options==='function'){cb=options;options={};}if(held.has(name)&&options.ifAvailable)return cb(null);held.add(name);try{return await cb({name});}finally{held.delete(name);}}};
 w.document.modelContext={registerTool:t=>registered.push(t)};
 w.fetch=async(url,opts={})=>{requests.push([url,opts]);let data;if(url.startsWith('/api/catalog'))data=cat;else if(url.startsWith('/api/seat'))data={capacity:20,actual:20-seatCount,remaining:seatCount,available:seatCount,checked_at:new Date(w.Date.now()).toISOString()};else throw Error('Unexpected network destination '+url);return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};};
 for(const f of ['boot.js','core.js','web-api.js','ui.js','registration-data.js','registration-core.js','registration-ui.js','catalog-ui.js','seats-ui.js','phone-ui.js','welcome.js'])vm.runInContext(source(f),dom.getInternalVMContext());
 await new Promise(r=>setTimeout(r,250));const api=w.SniperWeb.api,C=w.SniperCore;assert(!w.document.getElementById('view-home').hidden);for(const tick of intervals)tick();assert(w.document.getElementById('boot-screen').hidden);w.document.querySelector('[data-view="catalog"]').click();let p=await api('plan');assert.equal(p.courses.length,0);
 const text='10119 10123 13511 10350 10352 10355 12131 10218 10226';const preview=await api('crns/preview',{text,term:p.term,revision:p.revision});assert.equal(preview.rows.length,9);assert.equal(preview.errors.length,0);assert.equal((await api('plan')).courses.length,0);
 p=await api('crns/import',{text,term:p.term,revision:p.revision,catalog_stamp:preview.catalog_stamp});assert.equal(p.courses.length,9);assert.equal((await api('draft',p)).crns.length,9);
 await assert.rejects(api('save',{...p,revision:0}),/another tab/);
 await assert.rejects(api('crns/import',{text:'10119 99999',term:p.term,revision:p.revision}),/Nothing was added/);assert.equal((await api('plan')).courses.length,9);
 vm.runInContext('plan=JSON.parse(localStorage.getItem("sniper-web-plan-v1"));render();',dom.getInternalVMContext());assert.equal(w.document.querySelectorAll('.tt-block').length,14);assert(new Set([...w.document.querySelectorAll('.tt-block')].map(n=>n.style.getPropertyValue('--course-bg'))).size>=5);
 const withClash=await api('crns/import',{text:'13646',term:p.term,revision:p.revision});assert(!(await api('draft',withClash)).ready);vm.runInContext('plan=JSON.parse(localStorage.getItem("sniper-web-plan-v1"));render();',dom.getInternalVMContext());assert.equal(w.document.querySelectorAll('.tt-warning').length,2);
 // Fit mode uses the same minute scale for grid cells and meetings, without losing overlaps.
 const scroll=w.document.querySelector('.timetable-scroll');
 scroll.getBoundingClientRect=()=>({top:300});
 Object.defineProperty(w,'innerHeight',{value:900,writable:true,configurable:true});
 vm.runInContext('renderTimetable();',dom.getInternalVMContext());
 const day=w.document.querySelector('.tt-day');
 assert(parseFloat(day.style.height)+42<=parseFloat(scroll.style.height)+0.01);
 const block=w.document.querySelector('.tt-block');
 const lessonHeight=parseFloat(scroll.style.getPropertyValue('--lesson-height'));
 assert(Math.abs(parseFloat(block.style.height)/lessonHeight-Math.round(parseFloat(block.style.height)/lessonHeight*10)/10)<0.001);
 const fitHeight=parseFloat(day.style.height);
 const sizing=w.document.getElementById('timetable-scale');sizing.value='comfortable';sizing.onchange();
 assert(parseFloat(w.document.querySelector('.tt-day').style.height)>fitHeight);
 assert.equal(w.localStorage.getItem('sniper-timetable-scale'),'comfortable');
 sizing.value='fit';sizing.onchange();w.innerHeight=700;w.dispatchEvent(new w.Event('resize'));
 assert(parseFloat(w.document.querySelector('.tt-day').style.height)<fitHeight);
 assert.equal(w.document.querySelectorAll('.tt-warning').length,2);

 // Major selection updates selected courses and every meeting without altering the plan.
 const major=w.document.getElementById('registration-major'),senior=w.document.getElementById('registration-senior');
 major.value='EE';senior.value='no';major.onchange();
 assert(w.document.querySelector('.registration-course').textContent.includes('CS 303'));
 assert(w.document.querySelector('.registration-course').textContent.includes('D2 · D3'));
 assert.equal(w.document.querySelectorAll('.tt-block > .registration-badge').length,w.document.querySelectorAll('.tt-block').length);
 assert.equal(JSON.parse(w.localStorage.getItem('sniper-registration-profile-v1')).major,'EE');
 const labChip=[...w.document.querySelectorAll('.tt-block')].find(n=>n.textContent.includes('CS 303L'));
 assert(labChip.querySelector('.registration-badge').textContent.includes('D2 · D3'));
 assert(!w.document.querySelector('.sidebar-bottom #bridge-open'));
 w.document.getElementById('bridge-open').click();
 assert(!w.document.getElementById('view-extension').hidden);
 assert(w.document.getElementById('view-catalog').hidden);
 assert(w.document.getElementById('paste-crns').hidden);
 assert.equal(w.document.querySelectorAll('.guide-card img').length,3);
 assert(w.document.querySelector('nav a[href$="20260914.pdf"]'));
 w.document.querySelector('[data-view="catalog"]').click();
 assert(!w.document.getElementById('view-catalog').hidden);
 assert.equal(w.document.querySelectorAll('.tt-warning').length,2);

 // Opt-in conflicts persist in the plan and reach the existing extension bridge.
 const toggle=w.document.getElementById('allow-time-conflicts');assert.equal(toggle.checked,false);
 const beforeOverride=await api('plan');
 toggle.checked=true;await toggle.onchange();
 const allowed=await api('plan');assert.equal(allowed.allow_time_conflicts,true);assert.equal(allowed.revision,beforeOverride.revision+1);
 assert.deepEqual(JSON.parse(JSON.stringify(allowed.courses)),JSON.parse(JSON.stringify(beforeOverride.courses)));
 const draft=await api('draft',allowed);assert(draft.ready);assert.equal(draft.crns.length,10);assert(draft.warnings.some(x=>x.startsWith('Time conflict:')));
 assert((await api('prepare',allowed)).ready);
 await vm.runInContext('runCheck()',dom.getInternalVMContext());
 assert(!w.document.getElementById('copy').disabled);assert(w.document.getElementById('prep-details').textContent.includes('allowed for this plan'));
 assert.equal(w.document.querySelectorAll('.tt-warning').length,2);
 // Use the released extension's actual reader with a simulated Chrome injection.
 dom.reconfigure({url:'https://sabanci-registration-sniper.sitegap-tools.workers.dev/'});
 const bridge={chrome:{tabs:{get:async()=>({url:w.location.href})},scripting:{executeScript:async({func,args})=>[{result:await vm.runInContext('('+func.toString()+')('+JSON.stringify(args[0])+')',dom.getInternalVMContext())}]}}};
 vm.createContext(bridge);bridge.URL=URL;vm.runInContext(fs.readFileSync('../extension/web-source.js','utf8'),bridge);
 const packet=await bridge.SniperWebSource.read(1);assert(packet.ready);assert.equal(packet.crns.length,10);assert.equal(packet.revision,allowed.revision);assert(packet.warnings.some(x=>x.startsWith('Time conflict:')));
 const wrongTerm={...allowed,term:'202602'};assert(!(await api('draft',wrongTerm)).ready);
 const duplicated=JSON.parse(JSON.stringify(allowed));duplicated.courses.push({...duplicated.courses[0]});assert(!(await api('draft',duplicated)).ready);
 await assert.rejects(api('draft',{...allowed,allow_time_conflicts:'true'}),/Invalid time conflict/);
 vm.runInContext('plan=JSON.parse(localStorage.getItem("sniper-web-plan-v1"));render();',dom.getInternalVMContext());assert(toggle.checked);
 toggle.checked=false;await toggle.onchange();await vm.runInContext('runCheck()',dom.getInternalVMContext());
 assert(!(await api('draft',await api('plan'))).ready);assert(w.document.getElementById('copy').disabled);assert(!(await bridge.SniperWebSource.read(1)).ready);

 // A pending feed observation must clear its banner after recovery, without erasing other notices.
 vm.runInContext("seatState={crns:[],observations:{},events:[],combinations:[],running:true,reason:'Public feed is busy. Checks are queued; timestamps show freshness.'};renderSeats();",dom.getInternalVMContext());
 assert(w.document.getElementById('monitor-message').textContent.includes('queued'));
 assert(!w.document.getElementById('monitor-message').classList.contains('error'));
 vm.runInContext("seatState.reason='';renderSeats();",dom.getInternalVMContext());
 assert.equal(w.document.getElementById('monitor-message').textContent,'');
 vm.runInContext("seatState.reason='Public feed is busy.';renderSeats();monitorMessage('Desktop notification failed.',true);seatState.reason='';renderSeats();",dom.getInternalVMContext());
 assert.equal(w.document.getElementById('monitor-message').textContent,'Desktop notification failed.');
 const bad=JSON.parse(JSON.stringify(withClash));bad.courses[0].crns='oops';await assert.rejects(api('save',bad),/Invalid course/);
 await api('seats/config',{term:'202601',crns:['10119'],interval:120,follow_plan:false,backups:false});await api('seats/start',{});await intervals[0]();let s=await api('seats');assert.equal(s.events.length,0);assert.equal(s.observations['10119'].available,0);
 const now=w.Date.now();w.Date.now=()=>now+121000;seatCount=1;await intervals[0]();s=await api('seats');assert.equal(s.events.length,1);assert.equal(s.events[0].kind,'opened');await api('seats/stop',{});assert.equal((await api('seats')).running,false);
 assert(requests.every(([u,o])=>!o.body),'No private plans leave the browser.');assert(requests.every(([u])=>u.startsWith('/api/catalog')||u.startsWith('/api/seat')));
 assert.equal(JSON.parse(w.localStorage.getItem('sniper-web-plan-v1')).courses.length,10);
 dom.window.close();console.log('PASS: plan storage, atomic import, conflict geometry/colors, preparation, revision protection, monitor transitions, private network boundary.');
 await require('./monitor.cjs')();
})().catch(e=>{console.error(e);process.exit(1);});
