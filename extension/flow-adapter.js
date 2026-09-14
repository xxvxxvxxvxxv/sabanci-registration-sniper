(function(root){
 'use strict';
 if(root.RiperFlow)return;
 const trusted=u=>u.origin==='https://suis.sabanciuniv.edu'&&/^\/prod\/(?:bwskfreg|bwskflib)\.[a-z0-9_]+$/i.test(u.pathname);
 const visible=n=>!n.matches(':disabled')&&n.getClientRects().length>0&&getComputedStyle(n).visibility==='visible';
 function inspect(term){
  const here=new URL(location.href);
  if(here.origin!=='https://suis.sabanciuniv.edu')throw Error('Unsupported SUIS origin.');
  if(document.querySelector('input[type=password]'))return {kind:'login',message:'Sign in with the browser password manager, then arm again. Automatic login is pending live verification.'};
  const body=document.body.innerText||document.body.textContent;
  if(/session\s+(?:has\s+)?expired|session\s+timeout|access denied|too many requests|verify you are human|captcha/i.test(body))throw Error('Session expired or access check shown. Sign in or resolve it manually.');
  if(/no term available|term not available for registration/i.test(body))throw Error('Registration is not open for this term.');
  if(document.querySelector('input[name=crn_in]:not([type=hidden])'))return {kind:'crns'};
  const selectors=[...document.querySelectorAll('select[name=term_in]')].filter(visible);
  if(selectors.length===1){
   const select=selectors[0],form=select.form;
   if(!form||form.method.toLowerCase()!=='post'||!trusted(new URL(form.action,location.href)))throw Error('Semester form destination is unverified.');
   const options=[...select.options].filter(o=>o.value===term&&!o.disabled&&!o.parentElement.disabled);
   if(options.length!==1)throw Error('The planned semester is unavailable or ambiguous.');
   const controls=[...form.elements];
   if(controls.some(n=>n.type==='password'||n.name==='crn_in'))throw Error('Unexpected fields in semester form.');
   const submits=controls.filter(n=>['submit','image'].includes(n.type)&&visible(n));
   if(submits.length!==1||submits[0].type==='image'||submits[0].formAction&& !trusted(new URL(submits[0].formAction,location.href)))throw Error('Semester submission control is unverified.');
   return {kind:'term',select,form,submit:submits[0]};
  }
  const links=[...document.querySelectorAll('a[href]')].filter(a=>visible(a)&&/add\s*(?:\/|and|&)\s*drop|add or drop classes/i.test(a.textContent)&&trusted(new URL(a.href,location.href)));
  if(links.length===1)return {kind:'link',href:links[0].href};
  throw Error('Open the SUIS Add/Drop menu or semester selection page first.');
 }
 function next(term,act=false){
  if(!/^\d{6}$/.test(term))throw Error('Invalid semester.');
  const state=inspect(term);
  if(state.kind==='term'){
   if(act){state.select.value=term;if(state.select.value!==term)throw Error('Semester selection failed.');HTMLFormElement.prototype.requestSubmit.call(state.form,state.submit);}
   return {kind:'term',message:'Semester selected.'};
  }
  return state;
 }
 root.RiperFlow={next};
})(globalThis);
