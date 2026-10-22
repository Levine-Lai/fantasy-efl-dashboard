import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

export async function cacheChartAssets(data) {
  const folder = new URL("../public/chart-assets/", import.meta.url);
  await mkdir(folder, {recursive:true});
  const references=[];
  const imageKeys=new Set(["jerseyUrl","keeperJerseyUrl","teamLogo","fallbackImage","avatarUrl","logo","opponentLogo"]);
  const visit=value=>{
    if(!value || typeof value!=="object") return;
    for(const [key,child] of Object.entries(value)) {
      if(imageKeys.has(key) && typeof child==="string" && child.startsWith("https://")) references.push({row:value,key});
      else if(typeof child==="object") visit(child);
    }
  };
  visit(data);
  const urls=[...new Set(references.map(({row,key})=>row[key]))];
  const local=new Map(); let cursor=0; let before=0,after=0;
  await Promise.all(Array.from({length:6},async()=>{
    while(cursor<urls.length) {
      const url=urls[cursor++];
      const hash=createHash("sha256").update("thumb96-v2:"+url).digest("hex").slice(0,24);
      const name=hash+".webp", file=new URL(name,folder), info=new URL(hash+".json",folder);
      try {
        let bytes=await readFile(file).catch(()=>null);
        let originalSize=(await readFile(info,"utf8").then(JSON.parse).catch(()=>null))?.originalBytes;
        if(!bytes?.length) {
          const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
          if(!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
          const original=Buffer.from(await response.arrayBuffer()); originalSize=original.length;
          bytes=await sharp(original).resize(96,96,{fit:"inside",withoutEnlargement:true}).webp({quality:82,alphaQuality:90,effort:5}).toBuffer();
          await writeFile(file,bytes); await writeFile(info,JSON.stringify({originalBytes:originalSize,optimizedBytes:bytes.length}));
        }
        before+=originalSize ?? bytes.length; after+=bytes.length;
        local.set(url,"./chart-assets/"+name);
      } catch { /* preserve source URL instead of dropping any image */ }
    }
  }));
  for(const {row,key} of references) if(local.has(row[key])) row[key]=local.get(row[key]);
  console.log(`Optimized image assets: ${local.size}/${urls.length}; ${before} -> ${after} bytes (${before ? ((1-after/before)*100).toFixed(1) : 0}% smaller). ${references.length} references share ${urls.length} files.`);
  await writeFile(new URL("image-metrics.json",folder),JSON.stringify({images:local.size,references:references.length,originalBytes:before,optimizedBytes:after}));
}
