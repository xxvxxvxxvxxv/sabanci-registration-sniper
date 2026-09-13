'use strict';
let phoneState=null,phoneBusy=false;
function renderPhone(s){
 phoneState=s;
 $('phone-pairing').hidden=!s.pair_code;$('phone-command').textContent=s.pair_code?'/start '+s.pair_code:'';
 $('phone-enabled').checked=s.enabled;$('phone-details').checked=s.details;
 $('phone-enabled').disabled=$('phone-details').disabled=$('phone-test').disabled=!s.paired||phoneBusy;
 $('phone-status').textContent=s.last||'Phone delivery is off.';
 $('phone-open').textContent=s.enabled?'Phone on':'Phone';
}
async function phoneAction(path,payload={}){
 if(phoneBusy)return;phoneBusy=true;let failure='';
 for(const id of ['phone-connect','phone-pair','phone-test','phone-disconnect','phone-enabled','phone-details'])$(id).disabled=true;
 try{const s=await api('phone/'+path,payload);phoneBusy=false;renderPhone(s);return s;}
 catch(e){failure=e.message;}
 finally{phoneBusy=false;for(const id of ['phone-connect','phone-pair','phone-test','phone-disconnect','phone-enabled','phone-details'])$(id).disabled=false;if(phoneState)renderPhone(phoneState);if(failure)$('phone-status').textContent=failure;}
}
$('phone-open').onclick=async()=>{$('phone-dialog').showModal();try{renderPhone(await api('phone'));}catch(e){$('phone-status').textContent=e.message;}};
$('phone-close').onclick=()=>{$('phone-dialog').dataset.dirty='false';$('phone-dialog').close();};
$('phone-connect').onclick=async()=>{const tokenValue=$('phone-token').value.trim();$('phone-token').value='';await phoneAction('connect',{token:tokenValue});};
$('phone-pair').onclick=()=>phoneAction('pair');
$('phone-test').onclick=()=>phoneAction('test');
$('phone-disconnect').onclick=()=>phoneAction('disconnect');
$('phone-enabled').onchange=$('phone-details').onchange=()=>phoneAction('config',{enabled:$('phone-enabled').checked,details:$('phone-details').checked});

api('phone').then(renderPhone).catch(()=>{});
