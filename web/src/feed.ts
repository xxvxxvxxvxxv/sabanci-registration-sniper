import { db } from './db';
import snapshot from '../public/data/catalog.json';
import {parseCatalog,parseSeats,boundedHtml} from './parsers.mjs';
const iso=()=>new Date().toISOString();
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
export async function seat(term:string,crn:string){
 if(!/^\d{6}$/.test(term)||!/^\d{5}$/.test(crn))throw Error('Invalid term or CRN.');
 const cat=await catalog(term);if(!cat.courses.some((c:any)=>c.offerings.some((o:any)=>o.crn===crn)))throw Error('CRN is not in the supported catalog.');
 const database=db(),now=Date.now(),key=term+':'+crn;
 await database.prepare('INSERT OR IGNORE INTO source_gate(key) VALUES (?)').bind('seats').run();
 const gate=await database.prepare('SELECT blocked FROM source_gate WHERE key=?').bind('seats').first<any>();
 if(gate?.blocked)throw Object.assign(Error('University access is blocked for this public feed. Monitoring is paused until the operator reviews it.'),{blocked:true});
 const current=await database.prepare('SELECT value,expires FROM public_cache WHERE key=?').bind(key).first<any>();
 if(current?.value&&current.expires>now)return JSON.parse(current.value);
 await database.prepare('INSERT INTO public_cache(key,requested) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET requested=CASE WHEN requested=0 THEN excluded.requested ELSE requested END').bind(key,now).run();
 // One global source request at a time. Queue ordering is shared across all visitors.
 const permit=await database.prepare('UPDATE source_gate SET next=? WHERE key=? AND next<=? AND blocked=0 RETURNING key').bind(now+30000,'seats',now).first();
 if(permit){const next=await database.prepare("SELECT key FROM public_cache WHERE requested>0 AND key NOT LIKE 'catalog:%' ORDER BY requested ASC LIMIT 1").first<any>();
  if(next){const [t,c]=next.key.split(':');try{const html=await boundedHtml(`https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=${t}&crn_in=${c}`,1000000);const value={...parseSeats(html,t,c),checked_at:iso()};await database.prepare('UPDATE public_cache SET value=?,expires=?,requested=0 WHERE key=?').bind(JSON.stringify(value),Date.now()+120000,next.key).run();}catch(e:any){if(e.blocked){await database.prepare('UPDATE source_gate SET blocked=1 WHERE key=?').bind('seats').run();throw e;}await database.prepare('UPDATE public_cache SET value=?,expires=?,requested=0 WHERE key=?').bind(JSON.stringify({error:'Public seat data is temporarily unavailable.',checked_at:null}),Date.now()+120000,next.key).run();}}
  await database.prepare('UPDATE source_gate SET next=? WHERE key=?').bind(Date.now()+10000,'seats').run();
 }
 const result=await database.prepare('SELECT value,expires FROM public_cache WHERE key=?').bind(key).first<any>();
 if(result?.value&&result.expires>Date.now()){const v=JSON.parse(result.value);if(v.error)throw Error(v.error);return v;}
 return {pending:true,retry_after:10};
}
