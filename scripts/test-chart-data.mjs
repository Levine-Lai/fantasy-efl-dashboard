import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const importTs = async(source)=>import("data:text/javascript;base64,"+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64"));
const {chartDomain, formatChartTick}=await importTs(await readFile(new URL("../lib/chart-scale.ts",import.meta.url),"utf8"));
const data=JSON.parse(await readFile(new URL("../pages/dashboard.json",import.meta.url),"utf8"));
const source=(await readFile(new URL("../lib/dashboard-data.ts",import.meta.url),"utf8")).replace('import { env } from "cloudflare:workers";','const env={DB:null};').replace('async function getXgRows','export async function getXgRows');
const {abbreviatedPlayerKey,getXgRows}=await importTs(source);
assert.equal(abbreviatedPlayerKey("Jack Fitzwater"),abbreviatedPlayerKey("J. Fitzwater"));
assert.notEqual(abbreviatedPlayerKey("Jack Fitzwater"),abbreviatedPlayerKey("Joe Smith"));
const snapshot=JSON.parse(await readFile(new URL("../data/xg-snapshot.json",import.meta.url),"utf8"));
const fitzSource=snapshot.players.find(p=>p.player_name==="J. Fitzwater");
const fitz=data.playerStats.find(p=>p.fullName==="Jack Fitzwater");
if(fitzSource && fitz && fitzSource.apps===fitz.appearances) assert.equal(fitz.xg,fitzSource.xg,"Abbreviated player must retain xG");
if(fitzSource) {
  const collision={...snapshot,players:[...snapshot.players,{...fitzSource,player_name:"Joe Fitzwater"}]};
  const {aliases}=await getXgRows(snapshot.season,collision);
  assert.equal(aliases.get("12:exetercity:jfitzwater"),null,"Ambiguous initials must not match");
}
const series=[[0],[15.2],[0,12.9,15.2],[0,.002,.217],[-1.2,.8],[],...Object.keys(data.playerStats[0].perGame).map(k=>data.playerStats.map(p=>p.perGame[k])),...['xgdPerGame','xgPerGame','xptsPerGame'].map(k=>data.teamStats.map(t=>t[k]).filter(Number.isFinite))];
for(const values of series) {
  const domain=chartDomain(values);
  assert.ok(domain[1]>domain[0]);
  for(const value of values) assert.ok(value>=domain[0] && value<=domain[1],`Clipped ${value} in ${domain}`);
  const labels=[0,.25,.5,.75,1].map(f=>formatChartTick(domain[0]+f*(domain[1]-domain[0]),domain));
  assert.equal(new Set(labels).size,5,"Axis labels must be distinct");
  if(values.length && values.every(v=>v>=0)) assert.ok(domain[0]>=0);
}
console.log("Chart regression checks passed: shortened names, ambiguous names, outliers, negative/zero values and tick precision");
