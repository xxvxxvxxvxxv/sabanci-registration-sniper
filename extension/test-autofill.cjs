'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),core=require('./autofill-core.js');
function fixture(){return {packet:{ready:true,term:'202601',revision:1,crns:['99991','99992'],generated_at:new Date().toISOString()},form:{term:'202601',fields:Array.from({length:3},(_,i)=>({id:'crn-'+i,value:'',type:'text',maxLength:5,disabled:false,readOnly:false,visible:true}))}};}
test('maps independent CRNs to distinct fields',()=>{const {packet,form}=fixture();assert.deepEqual(core.prepare(packet,form).mapping.map(m=>m.crn),packet.crns);assert.equal(form.fields[0].value,'');});
test('term mismatch blocks',()=>{const {packet,form}=fixture();form.term='202602';assert.throws(()=>core.prepare(packet,form),/term/);});
test('partial or unrelated occupied values block',()=>{const {packet,form}=fixture();form.fields[2].value='88888';assert.throws(()=>core.prepare(packet,form),/contain values/);});
test('matching filled form is idempotent',()=>{const {packet,form}=fixture();form.fields[0].value='99991';form.fields[1].value='99992';assert.equal(core.prepare(packet,form).already,true);});
test('insufficient fields block',()=>{const {packet,form}=fixture();form.fields.length=1;assert.throws(()=>core.prepare(packet,form),/Insufficient/);});
test('hidden, disabled, readonly and wrong-type fields block',()=>{for(const patch of [{visible:false},{disabled:true},{readOnly:true},{type:'password'},{maxLength:10}]){const {packet,form}=fixture();Object.assign(form.fields[0],patch);assert.throws(()=>core.prepare(packet,form),/layout/);}});
test('stale packet blocks',()=>{const {packet,form}=fixture();packet.generated_at=new Date(Date.now()-61000).toISOString();assert.throws(()=>core.prepare(packet,form),/expired/);});
test('changed DOM after preview blocks',()=>{const {packet,form}=fixture();const preview=core.prepare(packet,form);form.fields.reverse();assert.throws(()=>core.unchanged(preview,form),/changed/);});
test('duplicate CRNs and blocked packets fail',()=>{const {packet,form}=fixture();packet.crns=['99991','99991'];assert.throws(()=>core.prepare(packet,form));packet.crns=['99991'];packet.ready=false;assert.throws(()=>core.prepare(packet,form));});
test('new revision invalidates handoff',()=>{const {packet}=fixture();assert.equal(core.samePacket(packet,{...packet,revision:2}),false);});
