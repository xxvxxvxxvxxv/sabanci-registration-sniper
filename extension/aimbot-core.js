(function(root){
 'use strict';
 const identity=p=>JSON.stringify([p.term,p.revision,p.crns]);
 function arm(packet,seats,now=Date.now()){
  if(!packet?.ready||!packet.crns?.length)throw Error('Prepare a valid CRN plan first.');
  if(!seats?.running||seats.term!==packet.term||packet.crns.some(c=>!seats.crns.includes(c)))throw Error('Start seat monitoring for every CRN in this plan and the same term.');
  return {identity:identity(packet),term:packet.term,crns:[...packet.crns],armedAt:now,baseline:Math.max(0,...seats.events.map(e=>Number(e.id)||0)),state:'watching'};
 }
 function decide(run,packet,seats,now=Date.now()){
  if(run.state!=='watching')return {action:'none'};
  if(identity(packet)!==run.identity||!packet.ready)return {action:'stop',reason:'Plan changed. Review and arm again.'};
  if(!seats.running||seats.term!==run.term||run.crns.some(c=>!seats.crns.includes(c)))return {action:'stop',reason:'Seat monitor stopped or the watch list changed.'};
  const available=run.crns.every(crn=>{const o=seats.observations[crn];const age=now-Date.parse(o?.checked_at);return o&&o.available>0&&!o.stale&&Number.isFinite(age)&&age>=-5000&&age<=Math.max(120,seats.cycle_seconds||120)*1000;});
  return available?{action:'prepare'}:{action:'wait'};
 }
 root.RiperAimbot={arm,decide,identity};
})(globalThis);
