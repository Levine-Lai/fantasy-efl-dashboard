import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import sharp from "sharp";
import ts from "typescript";
import {summarizeArticle} from "./enrich-news.mjs";
const js=ts.transpileModule(await readFile(new URL("../lib/league-selection.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {leagueOptions,includesLeague,leagueLabel}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
assert.equal(leagueOptions.length,7);
assert.equal(leagueLabel("ALL"),"总计");
assert.equal(new Set(leagueOptions.map(o=>[10,11,12].filter(id=>includesLeague(o.value,id)).join(","))).size,7);
assert.ok(includesLeague("10,12",10) && includesLeague("10,12",12) && !includesLeague("10,12",11));
const fake={url:"https://www.efl.com/news/example/",title:"Team injury news",body:"Alex Example returned from injury. Brian Sample was sent off.",date:"10/15",source:"EFL"};
const result=summarizeArticle(fake,[{fullName:"Alex Example",name:"A. Example",position:"MID"},{fullName:"Brian Sample",name:"B. Sample",position:"DEF"}]);
assert.ok(result.impacts.some(i=>i.kind==="positive"));
assert.ok(result.impacts.some(i=>i.kind==="negative"));
const unreadable=summarizeArticle({...fake,body:""},[]);
assert.ok(unreadable.impacts.every(i=>i.kind==="watch"));
assert.ok(!unreadable.impacts.some(i=>i.kind==="injury"));
const d=JSON.parse(await readFile(new URL("../pages/dashboard.json",import.meta.url),"utf8"));
for(const news of d.news) { assert.match(news.titleZh,/[\u4e00-\u9fff]/); assert.ok(news.summary);assert.ok(news.impacts.length>0);assert.ok(news.url.startsWith("https://www.efl.com/")); }
const metric=JSON.parse(await readFile(new URL("../public/chart-assets/image-metrics.json",import.meta.url),"utf8"));
assert.ok(metric.optimizedBytes<metric.originalBytes);
for(const row of d.playerStats.slice(0,20)) {
 assert.ok(row.jerseyUrl.endsWith(".webp"));
 const meta=await sharp(await readFile(new URL("../public/"+row.jerseyUrl.replace(/^\.\//,""),import.meta.url))).metadata();
 assert.ok(meta.width<=96 && meta.height<=96);
}
console.log("Dashboard feature checks passed: seven unique league combinations, Chinese source-linked news, cautious injury rules and 96px image assets");
