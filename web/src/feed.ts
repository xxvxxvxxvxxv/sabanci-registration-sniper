import { db } from './db';
import snapshot from '../public/data/catalog.json';
import {parseCatalog,parseSeats,boundedHtml} from './parsers.mjs';
const iso=()=>new Date(Date.now()).toISOString();
export async function catalog(term='202601'){
 if(term!==snapshot.term)throw Error('This release supports Fall 2026–27 (202601).');
 const database=db(),key='catalog:'+term,now=Date.now();
 const cached=await database.prepare('SELECT value, expires FROM public_cache WHERE key=?').bind(key).first<any>();
 if(cached?.value&&cached.expires>now)return JSON.parse(cached.value);
 await database.prepare('INSERT OR IGNORE INTO source_gate(key) VALUES (?)').bind('catalog').run();
 const permit=await database.prepare('UPDATE source_gate SET next=? WHERE key=? AND next<=? AND blocked=0 RETURNING key').bind(now+3600000,'catalog',now).first();
 if(permit){try{const value=parseCatalog(await boundedHtml('https://sutable.vercel.app/'+term,5000000),term);await database.prepare('INSERT INTO public_cache(key,value,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires').bind(key,JSON.stringify(value),now+3600000).run();return value;}catch{}}
 return {...(cached?.value?JSON.parse(cached.value):snapshot),refresh_note:'Live catalog refresh unavailable or queued. Showing the dated snapshot.'};
}
export async function seats(term:string,crns:string[],interval=30){
 if(!/^\d{6}$/.test(term)||!crns.length||crns.length>80||crns.some(c=>!/^\d{5}$/.test(c))||![30,60,120,300,600].includes(interval))throw Error('Invalid watchlist.');
 crns=[...new Set(crns)];
 const cat=await catalog(term);if(crns.some(crn=>!cat.courses.some((c:any)=>c.offerings.some((o:any)=>o.crn===crn))))throw Error('CRN is not in the supported catalog.');
 const database=db(),now=Date.now(),keys=crns.map(c=>term+':'+c);
 await database.prepare('INSERT OR IGNORE INTO source_gate(key) VALUES (?)').bind('seats').run();
 const gate=await database.prepare('SELECT blocked FROM source_gate WHERE key=?').bind('seats').first<any>();
 if(gate?.blocked)throw Object.assign(Error('University access is blocked. Monitoring is paused.'),{blocked:true});
 const read=async()=> (await database.prepare('SELECT key,value,expires,requested FROM public_cache WHERE key IN ('+keys.map(()=>'?').join(',')+')').bind(...keys).all()).results;
 const rows=await read(),byKey=new Map(rows.map((r:any)=>[r.key,r]));
 const stale=keys.filter(k=>{const r:any=byKey.get(k);if(!r?.value)return true;const v=JSON.parse(r.value);return r.expires<=now&&(!v.checked_at||now-Date.parse(v.checked_at)>=interval*1000);});
 // Register the complete watchlist together, preserving FIFO order across visitors.
 for(let i=0;i<stale.length;i+=40){const chunk=stale.slice(i,i+40);await database.prepare('INSERT INTO public_cache(key,requested) VALUES '+chunk.map(()=>'(?,?)').join(',')+' ON CONFLICT(key) DO UPDATE SET requested=CASE WHEN requested=0 THEN excluded.requested ELSE requested END').bind(...chunk.flatMap(k=>[k,now])).run();}
 if(stale.length){
  const permit=await database.prepare('UPDATE source_gate SET next=? WHERE key=? AND next<=? AND blocked=0 RETURNING key').bind(now+30000,'seats',now).first();
  if(permit){
   const next=await database.prepare("SELECT key FROM public_cache WHERE requested>0 AND key NOT LIKE 'catalog:%' ORDER BY requested ASC,key ASC LIMIT 1").first<any>();
   if(next){const [t,c]=next.key.split(':');try{
    const html=await boundedHtml(`https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=${t}&crn_in=${c}`,1000000);
    const value={...parseSeats(html,t,c),checked_at:iso()};
    await database.prepare('UPDATE public_cache SET value=?,expires=?,requested=0 WHERE key=?').bind(JSON.stringify(value),Date.now()+30000,next.key).run();
   }catch(e:any){
    if(e.blocked){await database.prepare('UPDATE source_gate SET blocked=1 WHERE key=?').bind('seats').run();throw e;}
    await database.prepare('UPDATE public_cache SET value=?,expires=?,requested=0 WHERE key=?').bind(JSON.stringify({error:'Seat check failed. Retrying.',checked_at:null}),Date.now()+30000,next.key).run();
   }}
   await database.prepare('UPDATE source_gate SET next=? WHERE key=?').bind(Date.now()+10000,'seats').run();
  }
 }
 const result=await read();
 return {observations:Object.fromEntries(result.filter((r:any)=>r.value).map((r:any)=>[r.key.split(':')[1],JSON.parse(r.value)])),pending:result.filter((r:any)=>r.requested>0).map((r:any)=>r.key.split(':')[1]),retry_after:10};
}
export async function seat(term:string,crn:string){
 const result=await seats(term,[crn]),o=result.observations[crn];
 if(o&&!result.pending.includes(crn)){if(o.error)throw Error(o.error);return o;}
 return {pending:true,retry_after:10};
}
