(function(root){
 'use strict';
 function prepare(packet,form,now=Date.now()){
  if(!packet||packet.ready!==true||!/^\d{6}$/.test(packet.term)||!Array.isArray(packet.crns)||packet.crns.length===0||packet.crns.length>80||packet.crns.some(c=>!/^\d{5}$/.test(c))||new Set(packet.crns).size!==packet.crns.length)throw Error('Invalid or blocked CRN packet.');
  const age=now-Date.parse(packet.generated_at);if(!Number.isFinite(age)||age< -5000||age>60000)throw Error('Preview expired. Load the current plan again.');
  if(!Number.isInteger(packet.revision)||packet.revision<0)throw Error('Invalid plan revision.');
  if(form.term!==packet.term)throw Error('Form term does not match the plan.');
  const fields=form.fields;
  if(!Array.isArray(fields)||fields.length<packet.crns.length)throw Error('Insufficient CRN fields. Nothing filled.');
  if(new Set(fields.map(f=>f.id)).size!==fields.length||fields.some(f=>!f.id||f.type!=='text'||f.disabled||f.readOnly||!f.visible||f.maxLength!==5))throw Error('Unexpected CRN field layout. Nothing filled.');
  const already=fields.every((f,i)=>f.value===(packet.crns[i]||''));
  if(!already&&fields.some(f=>f.value!==''))throw Error('CRN fields already contain values. Clear or review them first.');
  return {term:form.term,revision:packet.revision,already,signature:JSON.stringify(form),mapping:packet.crns.map((crn,i)=>({id:fields[i].id,crn}))};
 }
 function unchanged(preview,form){if(preview.signature!==JSON.stringify(form))throw Error('Form changed after preview. Preview again.');}
 function samePacket(a,b){return a.term===b.term&&a.revision===b.revision&&JSON.stringify(a.crns)===JSON.stringify(b.crns)&&b.ready===true;}
 root.SniperFillCore={prepare,unchanged,samePacket};
 if(typeof module==='object')module.exports=root.SniperFillCore;
})(globalThis);
