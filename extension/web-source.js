(function(root){
 'use strict';
 const origin='https://sabanci-registration-sniper.sitegap-tools.workers.dev';
 function accepts(url){try{return new URL(url).origin===origin;}catch{return false;}}
 async function read(tabId){
  const tab=await chrome.tabs.get(tabId);
  if(!accepts(tab.url))throw Error('Open the Registration Sniper website tab and connect again.');
  const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async expectedOrigin=>{
   try{
    if(location.origin!==expectedOrigin||!window.SniperWeb)throw Error('Website is loading or this page is unsupported.');
    const p=await window.SniperWeb.api('plan'),draft=await window.SniperWeb.api('draft',p),current=await window.SniperWeb.api('plan');
    if(current.revision!==p.revision||current.term!==p.term)throw Error('Plan changed while loading. Load CRNs again.');
    return {ok:true,packet:{ready:draft.ready,term:p.term,revision:p.revision,crns:draft.crns,errors:draft.errors,warnings:draft.warnings,generated_at:new Date().toISOString()}};
   }catch(e){return {ok:false,error:e.message};}
  },args:[origin]});
  const result=results[0]?.result;
  if(!result?.ok)throw Error(result?.error||'Website did not return a plan.');
  return result.packet;
 }
 root.SniperWebSource={origin,accepts,read};
})(globalThis);
