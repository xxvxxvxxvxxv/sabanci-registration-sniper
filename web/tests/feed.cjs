const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),{transformSync}=require('esbuild');
(async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('migrations/0001_public_cache.sql','utf8'));
 const db={prepare(sql){const stmt=sqlite.prepare(sql);return {first:async()=>stmt.get(),bind(...args){return {first:async()=>stmt.get(...args),run:async()=>stmt.run(...args)};}};}};
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
 const {seat}=ctx.module.exports;
 await seat(catalog.term,'10119');assert.equal(calls,1);
 let cached=sqlite.prepare('SELECT expires FROM public_cache WHERE key=?').get(catalog.term+':10119');assert.equal(cached.expires,now+30000);
 now+=29000;await seat(catalog.term,'10119');assert.equal(calls,1,'Reuse the same observation during its 30-second lifetime');
 now+=2000;await seat(catalog.term,'10119');assert.equal(calls,2,'Refresh after 30 seconds, without waiting for the old two-minute cache');
 sqlite.prepare("UPDATE source_gate SET blocked=1 WHERE key='seats'").run();
 await assert.rejects(seat(catalog.term,'10119'),/access is blocked/);assert.equal(calls,2);
 sqlite.close();console.log('PASS: Worker 30-second cache, shared cache reuse and access-block stop (mocked university).');
})().catch(e=>{console.error(e);process.exit(1);});
