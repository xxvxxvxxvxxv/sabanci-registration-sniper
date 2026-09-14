const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../extension');
const packet=()=>({ready:true,term:'202601',revision:2,crns:['10119','10123','13511'],generated_at:new Date().toISOString()});
function fixture({url='https://suis.sabanciuniv.edu/prod/bwskfreg.P_Regs',size=false}={}){
 const html=`<form method="post" action="/prod/bwskfreg.P_AddDropCrse"><input type="hidden" name="term_in" value="202601"><input name="unrelated" value="untouched"><input type="password" name="pin" value="not-read"><input type="hidden" name="crn_in" value=""><div id="slots">${Array.from({length:5},(_,i)=>`<input name="crn_in" ${size?'size="5"':`id="crn_id${i+1}" maxlength="5"`}>`).join('')}</div><button type="submit">Submit</button></form>`;
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let submitted=0,changed=0;
 w.HTMLFormElement.prototype.submit=()=>submitted++;w.HTMLFormElement.prototype.requestSubmit=()=>submitted++;
 w.document.addEventListener('submit',e=>{submitted++;e.preventDefault();});
 for(const type of ['input','change','click','keydown'])w.document.addEventListener(type,()=>changed++);
 w.fetch=()=>{throw Error('Adapter must not send requests');};
 w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:this.hidden?0:60,height:24};};
 for(const file of ['autofill-core.js','suis-adapter.js'])w.eval(fs.readFileSync(root+'/'+file,'utf8'));
 return {dom,w,api:w.SniperSuisAdapter,inputs:[...w.document.querySelectorAll('#slots input')],submits:()=>submitted,changes:()=>changed};
}
let cases=0;
function test(name,fn,opts){const f=fixture(opts);try{fn(f);cases++;console.log('PASS: '+name);}finally{f.dom.window.close();}}
test('independent fields filled and read back; no submission, events, or unrelated mutations',f=>{
 const p=packet(),before=f.w.document.querySelector('[name=pin]').value,preview=f.api.preview(p);
 assert.deepEqual(JSON.parse(JSON.stringify(preview.mapping)).map(x=>x.crn),p.crns);
 assert.equal(f.api.fill(p,preview).verified,3);
 assert.deepEqual(f.inputs.map(x=>x.value),[...p.crns,'','']);
 assert.equal(f.w.document.querySelector('[name=unrelated]').value,'untouched');
 assert.equal(f.w.document.querySelector('[name=pin]').value,before);
 assert.equal(f.submits(),0);assert.equal(f.changes(),0);
 assert.equal(f.api.fill(p,f.api.preview(p)).filled,0);
 assert.throws(()=>f.api.fill(p,preview),/Preview/);
});
test('legacy CRN inputs with size 5 and no IDs',f=>{const p=packet();assert.equal(f.api.fill(p,f.api.preview(p)).filled,3);assert(f.inputs.every(n=>!n.id));},{size:true});
test('unsupported domain',f=>assert.throws(()=>f.api.preview(packet()),/unsupported/),{url:'https://example.org/prod/bwskfreg.P_Regs'});
test('login page cannot be filled',f=>assert.throws(()=>f.api.preview(packet()),/unsupported/),{url:'https://suis.sabanciuniv.edu/prod/twbkwbis.P_SabanciLogin'});
for(const [name,change,pattern] of [
 ['wrong term',f=>{f.w.document.querySelector('[name=term_in]').value='202602';},/term does not match/],
 ['missing term',f=>{f.w.document.querySelector('[name=term_in]').remove();},/term could not be verified/],
 ['ambiguous term',f=>{f.w.document.forms[0].insertAdjacentHTML('beforeend','<input name="term" value="202602">');},/term could not be verified/],
 ['external form destination',f=>{f.w.document.forms[0].action='https://example.org/';},/destination/],
 ['occupied CRN',f=>{f.inputs[1].value='99999';},/already contain/],
 ['hidden CRN',f=>{f.inputs[1].hidden=true;},/layout/],
 ['readonly CRN',f=>{f.inputs[1].readOnly=true;},/layout/],
 ['disabled fieldset',f=>{const box=f.w.document.createElement('fieldset');box.disabled=true;f.inputs[1].replaceWith(box);box.append(f.inputs[1]);},/layout/],
 ['too few fields',f=>{f.inputs.slice(2).forEach(n=>n.remove());},/Insufficient/],
 ['multiple candidate forms',f=>{f.w.document.body.append(f.w.document.forms[0].cloneNode(true));},/One CRN/],
 ['unexpected field format',f=>{f.inputs[1].maxLength=20;},/format/]
])test(name,f=>{change(f);assert.throws(()=>f.api.preview(packet()),pattern);assert.equal(f.submits(),0);});
test('replaced elements invalidate preview even with identical markup',f=>{const p=packet(),preview=f.api.preview(p);f.inputs[0].replaceWith(f.inputs[0].cloneNode(true));assert.throws(()=>f.api.fill(p,preview),/changed after preview/);});
test('edited field invalidates preview',f=>{const p=packet(),preview=f.api.preview(p);f.inputs[1].value='55555';assert.throws(()=>f.api.fill(p,preview),/Form changed/);assert.equal(f.inputs[0].value,'');});
test('plan changes and expired packets block filling',f=>{const p=packet(),preview=f.api.preview(p);assert.throws(()=>f.api.fill({...p,revision:3},preview),/Preview/);const old={...p,generated_at:new Date(Date.now()-61000).toISOString()};assert.throws(()=>f.api.preview(old),/expired/);});
test('failed partial write restores original values',f=>{
 const p=packet(),preview=f.api.preview(p),proto=f.w.HTMLInputElement.prototype,descriptor=Object.getOwnPropertyDescriptor(proto,'value');let calls=0;
 Object.defineProperty(proto,'value',{...descriptor,set(v){if(++calls===2)throw Error('Synthetic setter failure');descriptor.set.call(this,v);}});
 assert.throws(()=>f.api.fill(p,preview),/Original values restored/);assert(f.inputs.every(n=>n.value===''));assert.equal(f.submits(),0);
});
console.log(`${cases} SUIS adapter fixture checks passed. Real SUIS markup has not been verified.`);
