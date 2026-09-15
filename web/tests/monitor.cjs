const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');

module.exports=async function testMonitor(){
 const dom=new JSDOM('',{url:'https://sniper.test/',runScripts:'outside-only'}),w=dom.window;
 let now=Date.parse('2026-09-14T00:00:00Z'),tick,pending=true,count=80,failTelegram=false;
 const requested=[],messages=[],cat=JSON.parse(fs.readFileSync('public/data/catalog.json'));
 w.Date.now=()=>now;w.setInterval=f=>{tick=f;};w.AbortSignal.timeout=()=>undefined;
 w.navigator.locks={request:async(name,options,cb)=>(cb||options)({name})};
 // Synthetic credentials only; all HTTP calls are intercepted below.
 w.sessionStorage.setItem('sniper-web-telegram-v1',JSON.stringify({token:'123456:synthetic_test_token_only',chat:42,enabled:true,details:true}));
 w.fetch=async(url,options={})=>{
  let data;
  if(url==='/api/catalog')data=cat;
  else if(url.startsWith('/api/seat?')){
   requested.push(new URL(url,'https://sniper.test').searchParams.get('crn'));
   data=pending?{pending:true,retry_after:10}:{capacity:80,actual:80-count,remaining:count,available:count,checked_at:new Date(now).toISOString()};
  }else if(url==='https://api.telegram.org/bot123456:synthetic_test_token_only/sendMessage'){
   messages.push(Object.fromEntries(options.body));
   if(failTelegram)throw Error('Simulated network outage');
   data={ok:true,result:{message_id:messages.length}};
  }else throw Error('Unexpected request: '+url);
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};
 };
 try{
  for(const f of ['core.js','web-api.js'])w.eval(fs.readFileSync('public/'+f,'utf8'));
  const api=w.SniperWeb.api;
  const ids=['13511','10350','10352','10355','12131','10218','10221','10690','10693'];
  let plan=await api('plan');plan=await api('crns/import',{text:ids.join(' '),term:plan.term,revision:plan.revision});
  await api('seats/config',{term:'202601',crns:[],interval:30,follow_plan:true,backups:false});
  await api('seats/start');
  for(let i=0;i<ids.length;i++){await tick();now+=10000;}
  assert.deepEqual(requested,ids,'Pending retries must not starve later CRNs, including HUM 207/D');
  pending=false;
  for(let i=0;i<ids.length;i++){await tick();now+=10000;}
  let state=await api('seats');
  assert.equal(state.observations['10690'].available,80);
  assert.equal(state.observations['10693'].available,80);
  assert.equal(messages.length,0,'Initial available observations establish a baseline, without alerts');
  await api('seats/stop');
  plan=await api('plan');plan.courses.forEach(r=>r.selected=r.crns==='10690');await api('save',plan);
  await api('seats/config',{term:'202601',crns:[],interval:30,follow_plan:true,backups:false});
  await api('seats/start');
  const check=async n=>{count=n;now+=31000;await tick();await new Promise(r=>setImmediate(r));};
  await check(0);assert.equal(messages.length,0);
  await check(1);assert.equal(messages.length,1);
  assert.equal(messages[0].chat_id,'42');assert.match(messages[0].text,/CRN 10690: 1 seat/);
  assert.match((await api('phone')).last,/Last alert sent/);
  await check(1);await check(2);assert.equal(messages.length,1,'Remaining open must not repeatedly notify');
  await api('phone/config',{enabled:false,details:true});await check(0);await check(1);
  assert.equal(messages.length,1,'Disabled phone alerts must not send');
  await api('phone/config',{enabled:true,details:false});await check(0);await check(1);
  assert.equal(messages.length,2);assert(!messages[1].text.includes('10690'),'Default alerts omit course details');
  failTelegram=true;await check(0);await check(1);
  assert.match((await api('phone')).last,/Telegram connection failed/);
  assert.equal((await api('seats')).running,true,'Delivery failure must not stop seat checks');
  console.log('PASS: fair pending retries, HUM first checks, automatic Telegram transitions, deduplication, opt-out and delivery errors (mocked network).');
 }finally{dom.window.close();}
};
