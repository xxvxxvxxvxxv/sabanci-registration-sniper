const {JSDOM}=require('../web/node_modules/jsdom'),vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const script=n=>fs.readFileSync(__dirname+'/'+n,'utf8');
function fixture(){
 const d=new JSDOM('<form method="post" action="/dolly/bwskfreg.P_Registration"><input name="term_in" type="hidden" value="202601"><input name="crn_in" maxlength="5" value="10119"><button type="submit">Submit Changes</button></form>',{url:'https://suis.sabanciuniv.edu/dolly/bwskfreg.P_AltPin',runScripts:'outside-only'}),w=d.window;
 w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.getBoundingClientRect=()=>({width:50,height:20});
 for(const n of ['autofill-core.js','suis-adapter.js','flow-adapter.js'])vm.runInContext(script(n),d.getInternalVMContext());
 return d;
}
const packet=()=>({ready:true,term:'202601',revision:1,crns:['10119'],generated_at:new Date().toISOString()});
(async()=>{
 let d=fixture(),w=d.window,p=packet(),sent=0;w.HTMLFormElement.prototype.requestSubmit=function(button){assert.equal(button.textContent,'Submit Changes');sent++;};
 const ticket=w.SniperSuisAdapter.checkSubmit(p);w.SniperSuisAdapter.submit(p,ticket);assert.equal(sent,1);assert.throws(()=>w.SniperSuisAdapter.submit(p,ticket));d.window.close();
 for(const mutate of [
  w=>w.document.querySelector('button').setAttribute('formaction','https://example.com'),
  w=>w.document.querySelector('button').setAttribute('formmethod','get'),
  w=>w.document.querySelector('button').setAttribute('formtarget','_blank'),
  w=>w.document.forms[0].insertAdjacentHTML('beforeend','<button>Submit Changes</button>'),
  w=>w.document.forms[0].insertAdjacentHTML('beforeend','<select name="rsts_in"><option selected>Web Drop</option></select>'),
  w=>w.document.querySelector('[name=crn_in]').value='99999'
 ]){d=fixture();mutate(d.window);assert.throws(()=>d.window.SniperSuisAdapter.checkSubmit(packet()));d.window.close();}
 d=fixture();p=packet();const t=d.window.SniperSuisAdapter.checkSubmit(p);d.window.document.querySelector('button').setAttribute('formaction','https://example.com');assert.throws(()=>d.window.SniperSuisAdapter.submit(p,t));d.window.close();
 d=fixture();w=d.window;w.document.body.innerHTML='<p>Your session has expired</p>';assert.equal(w.RiperFlow.next('202601').kind,'login');assert.throws(()=>w.SniperSuisAdapter.preview(packet()),/session expired/);w.document.body.innerHTML='<input type="password">';assert.equal(w.RiperFlow.next('202601').kind,'login');d.window.close();
 const handlers=[],storage={};const background={chrome:{runtime:{id:'test',onMessage:{addListener:f=>handlers.push(f)}},sidePanel:{setPanelBehavior:async()=>{}},storage:{session:{get:async()=>storage,set:async v=>Object.assign(storage,v)}}},console};
 vm.runInNewContext(script('background.js'),background);
 const claim=()=>new Promise(resolve=>handlers[0]({type:'submission-claim',key:'same-plan'},{id:'test'},resolve));
 const answers=await Promise.all([claim(),claim()]);assert.equal(answers.filter(a=>!a.claimed).length,1);
 const context={};vm.runInNewContext(script('aimbot-core.js'),context);p=packet();const seats={running:true,term:p.term,crns:p.crns,events:[],cycle_seconds:30,observations:{'10119':{available:2,checked_at:new Date().toISOString(),stale:false}}};
 const run=context.RiperAimbot.arm(p,seats);assert.equal(context.RiperAimbot.decide(run,p,seats).action,'prepare');seats.observations['10119'].stale=true;assert.equal(context.RiperAimbot.decide(run,p,seats).action,'wait');
 console.log('PASS: guarded form submission, changed submit controls, drop prevention, session detection, serialized duplicate claims and available-seat trigger (simulated forms).');
})().catch(e=>{console.error(e);process.exit(1);});
