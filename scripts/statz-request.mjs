import {readFile,writeFile} from 'node:fs/promises';
const statusFile=new URL('../data/statz-access.json',import.meta.url);
async function report(source,result) {
  const previous=await readFile(statusFile,'utf8').then(JSON.parse).catch(()=>({}));
  previous[source]={...result,checkedAt:new Date().toISOString()};
  await writeFile(statusFile,JSON.stringify(previous)+'\n');
}
export function createStatzClient({fetchImpl=fetch,record=report}={}) {
  let queue=Promise.resolve(),blocked=null;
  return function request(url,options={},source='xg') {
    const task=queue.then(async()=>{
      if(blocked)throw blocked;
      const {timeoutMs=20000,...requestOptions}=options;
      let response;
      try {response=await fetchImpl(url,{...requestOptions,signal:requestOptions.signal??AbortSignal.timeout(timeoutMs)});}
      catch(error){await record(source,{status:'network_error',url});throw error;}
      if(response.ok){await record(source,{status:'ok'});return response;}
      const body=(await response.text()).slice(0,12000);
      const title=body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      const challenge=response.headers.get('cf-mitigated')==='challenge';
      const status=challenge?'cloudflare_challenge':response.status===429?'rate_limited':'http_error';
      const detail={status,httpStatus:response.status,url,title,ray:response.headers.get('cf-ray')};
      await record(source,detail);
      console.warn('Statz access: '+JSON.stringify(detail));
      const error=new Error(`${new URL(url).pathname}: HTTP ${response.status}${challenge?' (Cloudflare verification required; source permission needed)':''}`);
      if(challenge || response.status===429)blocked=error;
      throw error;
    });
    queue=task.catch(()=>{});
    return task;
  };
}
// Serialize requests; stop the batch on a challenge or rate limit instead of retrying it.
export const statzRequest=createStatzClient();
