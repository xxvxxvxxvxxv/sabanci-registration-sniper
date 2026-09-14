'use strict';
if(window.riperFirstVisit)view('home');
// Show the mark only while the initial workspace is being loaded, without a minimum delay.
const bootTimer=setInterval(()=>{if(loaded||document.getElementById('save-state').textContent==='Load failed'){document.getElementById('boot-screen').hidden=true;clearInterval(bootTimer);}},40);
