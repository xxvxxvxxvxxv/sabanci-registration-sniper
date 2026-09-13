'use strict';
const form=document.getElementById('mock-crns'),fields=document.getElementById('mock-fields');
for(let i=1;i<=12;i++){const label=document.createElement('label');label.textContent='CRN '+i;const input=document.createElement('input');input.id='crn-'+i;input.name='crn_in';input.type='text';input.maxLength=5;input.pattern='[0-9]{5}';input.dataset.crnSlot=String(i);input.autocomplete='off';label.append(input);fields.append(label);}
function update(){document.getElementById('mock-status').textContent=[...fields.querySelectorAll('input')].filter(n=>n.value).length+' / 12 fields filled. Local test only.';}
form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',update);form.addEventListener('reset',()=>setTimeout(update,0));
