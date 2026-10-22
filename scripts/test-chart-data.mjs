import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const importTs = async(source)=>import("data:text/javascript;base64,"+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64"));
const {chartDomain, formatChartTick}=await importTs(await readFile(new URL("../lib/chart-scale.ts",import.meta.url),"utf8"));
const data=JSON.parse(await readFile(new URL("../pages/dashboard.json",import.meta.url),"utf8"));
const source=(await readFile(new URL("../lib/dashboard-data.ts",import.meta.url),"utf8")).replace('import { env } from "cloudflare:workers";','const env={DB:null};').replace('async function getXgRows','export async function getXgRows');
const {abbreviatedPlayerKey,middlePlayerKey,matchKey,getXgRows}=await importTs(source);
const {normalize}=await import('./attach-attacking-data.mjs');
for(const [name,canonical] of [['Joshua Brendan David Magennis','Josh Magennis'],['Onel Lázaro Hernández Mayea','Onel Hernández'],['Emmanuel Monthe','Manny Monthé'],['Ben Brereton Díaz','Ben Brereton'],['Cameron McJannett','Cameron McJannet'],['Taty Castellanos','Valentín Castellanos'],['Fábio André Tavares Desidério','Fábio Tavares'],['Emil Riis Jakobsen','Emil Riis'],['Olutobi Adebayo-Rowling','Tobi Adebayo-Rowling'],['Jordan Gabriel','Jordan Lawrence-Gabriel'],['Luther Wildin','Luther James-Wildin'],['Mike Fondop-Talum','Mike Fondop'],['Chris Forino-Joseph','Chris Forino'],['Andri Guðjohnsen','Andri Gudjohnsen']]) {
 assert.equal(matchKey(name),matchKey(canonical),name);
 assert.equal(normalize(name),normalize(canonical),name);
 assert.equal(matchKey(name),normalize(name),'Core and build matching must use the same identities');
}
assert.equal(abbreviatedPlayerKey("Jack Fitzwater"),abbreviatedPlayerKey("J. Fitzwater"));
assert.notEqual(abbreviatedPlayerKey("Jack Fitzwater"),abbreviatedPlayerKey("Joe Smith"));
assert.equal(middlePlayerKey('Pelly Mpanzu'),middlePlayerKey('Pelly Ruddock Mpanzu'));
assert.notEqual(middlePlayerKey('Toti Gomes'),middlePlayerKey('Rodrigo Gomes'),'Different first names never match as middle-name variants');
assert.equal(middlePlayerKey('Max Weiß'),middlePlayerKey('Max Weiss'));
assert.equal(matchKey('Toti'),matchKey('Toti Gomes'));
assert.equal(normalize('Toti'),normalize('Toti Gomes'));
assert.notEqual(matchKey('Toti'),matchKey('Rodrigo Gomes'),'Wolves players with the same surname remain distinct');
const snapshot=JSON.parse(await readFile(new URL("../data/xg-snapshot.json",import.meta.url),"utf8"));
const {rows:canonicalRows}=await getXgRows(snapshot.season,snapshot);
const mk=snapshot.players.find(p=>p.team_name==='Milton Keynes Dons'&&p.minutes>0);
assert.ok(mk);
assert.ok([...canonicalRows.keys()].some(key=>key.startsWith(`${mk.competitionId}:mkdons:`)),'MK Dons team aliases must resolve');
const example={competitionId:12,team_name:'Example FC',player_name:'Alex John Example',apps:10,xg:1,minutes:900};
const middleCollision=await getXgRows(snapshot.season,{...snapshot,players:[...snapshot.players,example,{...example,player_name:'Alex James Example'}]});
assert.equal(middleCollision.middleNames.get('12:examplefc:alexexample'),null,'Ambiguous middle-name variants must not match');
const canonicalCollision=await getXgRows(snapshot.season,{...snapshot,players:[...snapshot.players,{...example,player_name:'Géza Turi'},{...example,player_name:'Géza Dávid Turi'}]});
assert.equal(canonicalCollision.rows.get('12:examplefc:gezaturi'),null,'Duplicate verified variants remain ambiguous');
for(const [name,key,team] of [['Géza Dávid Turi','gezaturi','grimsbytown'],['Matthew Max Dibley-Dias','mattdibleydias','newportcounty']]) {
  const row=snapshot.players.find(p=>p.player_name===name);
  assert.ok(row,`Source identity: ${name}`);
  assert.equal(canonicalRows.get(`12:${team}:${key}`).xg,row.xg,'Verified full-name variants must retain source values');
}
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
