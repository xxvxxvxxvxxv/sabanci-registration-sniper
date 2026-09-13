import {catalog,seat} from './feed';
export default {
 async fetch(request:Request,env:any):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   if(request.method!=='GET')return Response.json({error:'Method not allowed.'},{status:405,headers:{Allow:'GET'}});
   try{let value;
    if(url.pathname==='/api/catalog')value=await catalog(url.searchParams.get('term')||'202601');
    else if(url.pathname==='/api/seat')value=await seat(url.searchParams.get('term')||'',url.searchParams.get('crn')||'');
    else return Response.json({error:'Not found.'},{status:404});
    return Response.json(value,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }catch(e:any){return Response.json({error:e.message||'Public feed unavailable.',blocked:!!e.blocked},{status:e.blocked?503:400,headers:{'Cache-Control':'no-store'}});}
  }
  return env.ASSETS.fetch(request);
 }
};
