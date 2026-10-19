// Keep denied responses observable without logging cookies or request credentials.
export async function statzRequest(url,options={}) {
  const response=await fetch(url,options);
  if(!response.ok) {
    const body=(await response.text()).slice(0,12000);
    const title=body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const headers=Object.fromEntries(['server','content-type','cf-mitigated','cf-ray','retry-after','x-cache'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v));
    const detail=body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,700);
    console.warn('Statz response diagnostics: '+JSON.stringify({url,status:response.status,headers,title,detail}));
    throw new Error(`${new URL(url).pathname}: HTTP ${response.status}${title?' ('+title+')':''}`);
  }
  return response;
}
