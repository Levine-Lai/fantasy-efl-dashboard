import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function cacheChartAssets(data) {
  const folder = new URL("../public/chart-assets/", import.meta.url);
  await mkdir(folder, {recursive:true});
  const references = [...data.playerStats.map(row=>({row, key:"jerseyUrl"})), ...data.teamStats.map(row=>({row, key:"logo"}))];
  const urls = [...new Set(references.map(({row,key})=>row[key]).filter(url=>url?.startsWith("https://")))];
  const local = new Map();
  let cursor=0;
  await Promise.all(Array.from({length:6},async()=>{
    while(cursor<urls.length) {
      const url=urls[cursor++];
      const name=createHash("sha256").update(url).digest("hex").slice(0,24)+".png";
      const file=new URL(name,folder);
      try {
        const existing=await readFile(file).catch(()=>null);
        if(!existing?.length) {
          const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
          if(!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
          const bytes=Buffer.from(await response.arrayBuffer());
          if(!bytes.length) continue;
          await writeFile(file,bytes);
        }
        local.set(url,"./chart-assets/"+name);
      } catch { /* preserve remote URL; export has a visible fallback */ }
    }
  }));
  for(const {row,key} of references) if(local.has(row[key])) row[key]=local.get(row[key]);
  console.log(`Cached chart assets: ${local.size}/${urls.length}`);
}
