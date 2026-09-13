(function(root){
 'use strict';
 function inspect(){
  const u=new URL(location.href);
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.pathname!=='/mock'||u.search||u.hash)throw Error('Only the bundled localhost /mock form is supported. Live SUIS adapter unavailable.');
  const forms=document.querySelectorAll('form[data-sniper-mock="1"]');
  if(forms.length!==1)throw Error('Recognized mock form not found.');
  const form=forms[0];if(form.id!=='mock-crns')throw Error('Unexpected form identity.');
  const nodes=[...form.querySelectorAll('input[data-crn-slot]')];
  const fields=nodes.map(n=>({id:n.id,value:n.value,type:n.type,maxLength:n.maxLength,disabled:n.disabled,readOnly:n.readOnly,visible:n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden'}));
  if(nodes.some(n=>n.form!==form||n.name!=='crn_in'))throw Error('Unexpected field ownership.');
  return {term:form.dataset.term,fields};
 }
 function preview(packet){return root.SniperFillCore.prepare(packet,inspect());}
 async function fill(packet,previous){
  const form=inspect();root.SniperFillCore.unchanged(previous,form);
  const checked=root.SniperFillCore.prepare(packet,form);
  if(checked.already)return {filled:0,verified:packet.crns.length,message:'Already filled and verified. No submission.'};
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  const originals=checked.mapping.map(m=>({node:document.getElementById(m.id),value:document.getElementById(m.id).value}));
  try{
   for(const m of checked.mapping)setter.call(document.getElementById(m.id),m.crn);
   for(const x of originals){x.node.dispatchEvent(new Event('input',{bubbles:true}));x.node.dispatchEvent(new Event('change',{bubbles:true}));}
   await new Promise(resolve=>setTimeout(resolve,40));
   const after=inspect();
   if(after.fields.length!==form.fields.length||after.term!==form.term||after.fields.some((f,i)=>f.id!==form.fields[i].id||f.value!==(packet.crns[i]||'')))throw Error('Read-back verification failed.');
   return {filled:checked.mapping.length,verified:checked.mapping.length,message:'All CRNs filled and verified. No submission.'};
  }catch(e){for(const x of originals)if(x.node.isConnected)setter.call(x.node,x.value);throw Error(e.message+' Original CRN values restored where fields remain attached.');}
 }
 root.SniperMockAdapter={preview,fill};
})(globalThis);
