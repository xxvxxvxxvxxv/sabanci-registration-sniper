const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../extension');
vm.runInThisContext(fs.readFileSync(root+'/aimbot-core.js','utf8'));
const now=Date.now(),p={ready:true,term:'202601',revision:1,crns:['10119','10123']};
const fresh=(count=1)=>({available:count,checked_at:new Date(now).toISOString(),stale:false});
const base={running:true,term:p.term,crns:p.crns,events:[],observations:{'10119':fresh(),'10123':fresh()},cycle_seconds:120};
const copy=o=>JSON.parse(JSON.stringify(o));let s=copy(base),r=RiperAimbot.arm(p,s,now);
assert.equal(RiperAimbot.decide(r,p,s,now).action,'wait');
s.events=[{id:1,kind:'opened',term:p.term,crn:'10119',at:new Date(now+1).toISOString()}];
assert.equal(RiperAimbot.decide(r,p,s,now+5).action,'prepare');
let f=copy(s);f.observations['10123'].available=0;assert.equal(RiperAimbot.decide(r,p,f,now+5).action,'wait');
f=copy(s);f.observations['10123'].stale=true;assert.equal(RiperAimbot.decide(r,p,f,now+5).action,'wait');
f=copy(s);f.observations['10123'].checked_at=new Date(now-500000).toISOString();assert.equal(RiperAimbot.decide(r,p,f,now+5).action,'wait');
f=copy(s);f.events[0].at=new Date(now-100).toISOString();assert.equal(RiperAimbot.decide(r,p,f,now+5).action,'wait');
assert.equal(RiperAimbot.decide(r,{...p,revision:2},s,now).action,'stop');
assert.equal(RiperAimbot.decide(r,p,{...s,running:false},now).action,'stop');
assert.equal(RiperAimbot.decide(r,p,s,now+31*60000).action,'stop');
assert.equal(RiperAimbot.decide({...r,state:'preparing'},p,s,now).action,'none');
assert.throws(()=>RiperAimbot.arm(p,{...s,crns:['10119']},now));
function fixture(html,url='https://suis.sabanciuniv.edu/prod/bwskfreg.P_AltPin'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let submissions=0;
 w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLFormElement.prototype.requestSubmit=()=>submissions++;
 w.eval(fs.readFileSync(root+'/flow-adapter.js','utf8'));
 return {dom,w,submissions:()=>submissions,api:w.RiperFlow};
}
let d=fixture('<a href="/prod/bwskfreg.P_AltPin">Add / Drop</a>');assert.equal(d.api.next('202601').kind,'link');d.dom.window.close();
d=fixture('<form method="post" action="/prod/bwskfreg.P_Regs"><select name="term_in"><option value="202602">Spring</option><option value="202601">Fall</option></select><input type="submit" value="Submit"></form>');
assert.equal(d.api.next('202601').kind,'term');assert.equal(d.submissions(),0);d.api.next('202601',true);assert.equal(d.submissions(),1);assert.equal(d.w.document.querySelector('select').value,'202601');assert.throws(()=>d.api.next('202501',true));d.dom.window.close();
for(const html of ['<p>Session expired</p>','<p>No term available</p>','<p>captcha</p>','<a href="https://example.org/">Add / Drop</a>','<form method="post" action="https://example.org/"><select name="term_in"><option>202601</option></select><button>Submit</button></form>']){d=fixture(html);assert.throws(()=>d.api.next('202601',true));assert.equal(d.submissions(),0);d.dom.window.close();}
d=fixture('<input type="password" value="never-read">');assert.equal(d.api.next('202601',true).kind,'login');assert.equal(d.submissions(),0);d.dom.window.close();
// Panel integration: one seat event causes one preview/fill, never a registration submission.
(async()=>{
 const panel=new JSDOM(fs.readFileSync(root+'/popup.html','utf8'),{url:'https://extension.test',runScripts:'outside-only'}),w=panel.window;
 let interval,fillCount=0,previewCount=0;let obs=copy(base);
 w.setInterval=cb=>{interval=cb;};w.config={kind:'website',tabId:7};
 w.$=id=>w.document.getElementById(id);w.fetchPacket=async()=>({...copy(p),generated_at:new Date().toISOString()});
 w.SniperWebSource={origin:'https://sabanci-registration-sniper.sitegap-tools.workers.dev',accepts:()=>true};w.SniperFillCore={samePacket:(a,b)=>a.revision===b.revision};
 w.adapter=async(id,kind,method)=>{assert.equal(id,8);if(method==='preview'){previewCount++;return {};}if(method==='fill'){fillCount++;return {};}throw Error('Unexpected method');};
 w.chrome={tabs:{get:async id=>({id,url:id===7?w.SniperWebSource.origin:'https://suis.sabanciuniv.edu/prod/bwskfreg.P_Regs',status:'complete'}),query:async()=>[{id:8,url:'https://suis.sabanciuniv.edu/prod/bwskfreg.P_Regs'}],update:async()=>{}},scripting:{executeScript:async o=>o.files?[]:o.target.tabId===7?[{result:copy(obs)}]:[{result:{ok:true,value:{kind:'crns'}}}]}};
 w.eval(fs.readFileSync(root+'/aimbot-core.js','utf8'));w.eval(fs.readFileSync(root+'/aimbot-panel.js','utf8'));
 await w.$('aimbot-target').onclick();w.$('aimbot-enabled').checked=true;await w.$('aimbot-enabled').onchange();await interval();assert.equal(fillCount,0);
 obs.events=[{id:1,kind:'opened',term:p.term,crn:'10119',at:new Date(Date.now()+1).toISOString()}];await interval();assert.equal(fillCount,1);assert.equal(previewCount,1);assert.equal(w.$('aimbot-enabled').checked,false);await interval();assert.equal(fillCount,1);assert(w.$('aimbot-status').textContent.includes('submit in SUIS'));
 panel.window.close();console.log('PASS: Aimbot new-opening trigger, freshness, all-component requirement, expiry, plan changes, navigation guards, one-shot panel fill and manual final submission.');
})().catch(e=>{console.error(e);process.exit(1);});
