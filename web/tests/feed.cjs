const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),{transformSync}=require('esbuild');
(async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('migrations/0001_public_cache.sql','utf8'));
 const db={prepare(sql){const stmt=sqlite.prepare(sql);return {first:async()=>stmt.get(),bind(...args){return {first:async()=>stmt.get(...args),run:async()=>stmt.run(...args),all:async()=>({results:stmt.all(...args)})};}};}};
 let now=Date.parse('2026-09-15T10:00:00Z'),calls=0;
 const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json'));
 sqlite.prepare('INSERT INTO public_cache(key,value,expires) VALUES (?,?,?)').run('catalog:'+catalog.term,JSON.stringify(catalog),now+3600000);
 const ctx={module:{exports:{}},Date:class extends Date{static now(){return now;}},require(name){
  if(name==='./db')return {db:()=>db};
  if(name.endsWith('catalog.json'))return catalog;
  if(name==='./parsers.mjs')return {boundedHtml:async()=>{calls++;return '';},parseSeats:()=>({available:5,remaining:5,capacity:10,actual:5})};
  throw Error(name);
 }};
 vm.runInNewContext(transformSync(fs.readFileSync('src/feed.ts','utf8'),{loader:'ts',format:'cjs'}).code,ctx);
 const {seat,seats}=ctx.module.exports;
 await seat(catalog.term,'10119');assert.equal(calls,1);
 let cached=sqlite.prepare('SELECT expires FROM public_cache WHERE key=?').get(catalog.term+':10119');assert.equal(cached.expires,now+30000);
 now+=29000;await seat(catalog.term,'10119');assert.equal(calls,1,'Reuse the same observation during its 30-second lifetime');
 now+=2000;await seat(catalog.term,'10119');assert.equal(calls,2,'Refresh after 30 seconds, without waiting for the old two-minute cache');
 // A complete watchlist is queued once and every completed observation is returned,
 // including results older than the short shared cache TTL.
 const ids=['10119','10123','13511','10350','10352','10355','12131','10218','10221'];
 now+=120000;let batch;
 for(let i=0;i<ids.length;i++){batch=await seats(catalog.term,ids,120);now+=10000;}
 assert.equal(Object.keys(batch.observations).length,ids.length);
 assert.equal(batch.pending.length,0);
 assert(now-Date.parse(batch.observations['10119'].checked_at)>30000,'Earlier completed results survive the cache TTL');
 assert(Object.values(batch.observations).every(o=>o.available===5));
 // Each interval controls when an observed section becomes due again.
 for(const interval of [30,60,120]){
  now+=interval*1000;await seats(catalog.term,['10119'],interval);const before=calls;
  now+=(interval-1)*1000;await seats(catalog.term,['10119'],interval);assert.equal(calls,before);
  now+=1000;await seats(catalog.term,['10119'],interval);assert.equal(calls,before+1,interval+' second interval refreshes when due');
 }
 const beforeBlocked=calls;
 sqlite.prepare("UPDATE source_gate SET blocked=1 WHERE key='seats'").run();
 await assert.rejects(seat(catalog.term,'10119'),/access is blocked/);assert.equal(calls,beforeBlocked);
 sqlite.close();console.log('PASS: full-watchlist collection, retained observations, 30/60/120-second intervals, shared cache and access-block stop (mocked university).');
})().catch(e=>{console.error(e);process.exit(1);});
