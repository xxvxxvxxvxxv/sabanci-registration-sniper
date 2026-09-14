(function(root){
 'use strict';
 if(root.SniperSuisAdapter)return;
 let pending=null;
 const registrationPath=p=>/^\/prod\/bwskfreg\.[a-z0-9_]+$/i.test(p);
 function inspect(){
  const url=new URL(location.href);
  if(url.origin!=='https://suis.sabanciuniv.edu'||!registrationPath(url.pathname))throw Error('Open the SUIS Add/Drop registration form. This page is unsupported.');
  const forms=[...document.forms].filter(f=>[...f.elements].some(n=>n instanceof HTMLInputElement&&n.name==='crn_in'&&n.type==='text'));
  if(forms.length!==1)throw Error('One CRN registration form could not be identified. Nothing filled.');
  const form=forms[0],action=new URL(form.action,location.href);
  if(action.origin!==url.origin||!registrationPath(action.pathname)||form.method.toLowerCase()!=='post')throw Error('Unexpected registration form destination. Nothing filled.');
  const nodes=[...form.elements].filter(n=>n instanceof HTMLInputElement&&n.name==='crn_in'&&n.type!=='hidden');
  if(!nodes.length||nodes.length>80)throw Error('CRN field layout is unsupported.');
  const terms=[...form.elements].filter(n=>n instanceof HTMLInputElement&&['term_in','term'].includes(n.name)).map(n=>n.value);
  for(const name of ['term_in','term'])terms.push(...url.searchParams.getAll(name));
  const distinct=[...new Set(terms.filter(Boolean))];
  if(distinct.length!==1||!/^\d{6}$/.test(distinct[0]))throw Error('Registration term could not be verified. Nothing filled.');
  const fields=nodes.map((n,i)=>{
   const style=getComputedStyle(n),rect=n.getBoundingClientRect();
   if(n.type!=='text'||!(n.maxLength===5||(n.maxLength===-1&&n.size===5)))throw Error('Unexpected CRN field format. Nothing filled.');
   return {id:'CRN '+(i+1),value:n.value,type:n.type,maxLength:5,disabled:n.matches(':disabled'),readOnly:n.readOnly,visible:rect.width>0&&rect.height>0&&n.getClientRects().length>0&&style.visibility==='visible'&&style.display!=='none',htmlId:n.id,htmlName:n.name,htmlMaxLength:n.maxLength,htmlSize:n.size};
  });
  return {form,nodes,state:{term:distinct[0],url:url.href,action:action.href,fields}};
 }
 function preview(packet){
  pending=null;
  const found=inspect(),result=root.SniperFillCore.prepare(packet,found.state);
  const token=crypto.randomUUID();
  pending={...found,token,packet:JSON.stringify([packet.term,packet.revision,packet.crns])};
  return {...result,token};
 }
 function fill(packet,previous){
  const saved=pending;pending=null;
  if(!saved||saved.token!==previous?.token||saved.packet!==JSON.stringify([packet.term,packet.revision,packet.crns]))throw Error('Preview is missing or expired. Preview fields again.');
  const found=inspect();
  if(found.form!==saved.form||found.nodes.length!==saved.nodes.length||found.nodes.some((n,i)=>n!==saved.nodes[i]))throw Error('Registration fields changed after preview. Nothing filled.');
  root.SniperFillCore.unchanged(previous,found.state);
  const checked=root.SniperFillCore.prepare(packet,found.state);
  if(checked.already)return {filled:0,verified:packet.crns.length,message:'CRNs already match. Nothing changed or submitted.'};
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  const originals=found.nodes.slice(0,packet.crns.length).map(n=>({node:n,value:n.value}));
  try{
   // Native form values only: no clicks, keyboard events, change handlers, or submission.
   originals.forEach((x,i)=>setter.call(x.node,packet.crns[i]));
   const after=inspect();
   if(after.form!==found.form||after.nodes.length!==found.nodes.length||after.nodes.some((n,i)=>n!==found.nodes[i])||after.state.term!==found.state.term||after.state.action!==found.state.action||after.state.fields.some((f,i)=>f.value!==(packet.crns[i]||'')))throw Error('Read-back verification failed.');
   return {filled:packet.crns.length,verified:packet.crns.length,message:`${packet.crns.length} CRNs filled and verified. Review the form, then submit yourself.`};
  }catch(e){
   for(const x of originals)if(x.node.isConnected)setter.call(x.node,x.value);
   throw Error(e.message+' Original values restored in attached fields. Review the form.');
  }
 }
 root.SniperSuisAdapter={preview,fill};
})(globalThis);
