 'use strict';
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>console.warn('Could not enable the side panel.'));
// Serialize claims across panels. Reserve before dispatch: uncertain results never auto-retry.
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!['submission-status','submission-claim'].includes(message?.type)||typeof message.key!=='string'||message.key.length>2000)return;
 queue=queue.then(async()=>{
  const stored=await chrome.storage.session.get('submissions'),entries=stored.submissions||{};
  if(message.type==='submission-status')return {claimed:!!entries[message.key]};
  if(entries[message.key])return {claimed:true};
  entries[message.key]=Date.now();await chrome.storage.session.set({submissions:entries});return {claimed:false};
 }).then(respond,e=>respond({error:e.message}));return true;
});
