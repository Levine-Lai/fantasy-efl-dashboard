import {alignAdvanced} from "./align-advanced.mjs";
import {attachTransferData} from './attach-transfer-data.mjs';
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {attachAttacking,buildSetPieces} from "./attach-attacking-data.mjs";
import {writeChartHistory} from "./build-chart-history.mjs";
import { cacheChartAssets } from "./cache-chart-assets.mjs";
import {historyView,roundLabel,roundFixtures,writeRoundViews,fixtureCalendar,writeFixtureCalendar} from "./build-round-views.mjs";

await import("./update-player-snapshot.mjs");
await import("./update-fotmob-snapshot.mjs");
const sourceUrl = new URL("../lib/dashboard-data.ts", import.meta.url);
const outputUrl = new URL("../pages/dashboard.json", import.meta.url);
const xgUrl = new URL("../data/xg-snapshot.json", import.meta.url);
const source = (await readFile(sourceUrl, "utf8"))
  .replace('import { env } from "cloudflare:workers";', "const env = { DB: null };");
if (!source.includes("export async function calculateDashboard")) throw new Error("Dashboard calculation was not found");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const { calculateDashboard, selectRecommendationRounds,statKeys,scoreComponents,recentTeamForm } = await import(moduleUrl);
const snapshot = JSON.parse(await readFile(xgUrl, "utf8"));
const get=async path=>{const response=await fetch(`https://fantasy.efl.com/json/fantasy/${path}`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Fantasy EFL ${path}: ${response.status}`);return response.json();};
const [rounds,officialPlayers,officialSquads]=await Promise.all(['rounds.json','players.json','squads.json'].map(get));
const lives=new Map();
const settled=rounds.filter(r=>r.games.some(g=>g.status==='completed'&&g.isFinalized));let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<settled.length){const r=settled[cursor++];lives.set(r.id,await get(`live_scores/${r.id}.json`));}}));
const inputs={rounds,players:officialPlayers,squads:officialSquads,lives};
const {primary,upcoming}=selectRecommendationRounds(rounds);
const current=rounds.find(r=>r.status==='playing'&&r.games.length)??primary;
const latest=await calculateDashboard(snapshot,primary.id,inputs);
const data=current.id===primary.id?latest:await calculateDashboard(snapshot,current.id,inputs);
data.playerStats=latest.playerStats;data.teamStats=latest.teamStats;
data.fixtures=roundFixtures(current,officialSquads);
data.statsLabel='最新官方已结算累计数据；当前与未来 GW 共用最新样本，预测按所选轮次剩余赛程计算。';
const views=[];
for(const round of rounds) {
  if(round.status==='completed') {views.push(historyView(round,inputs,data,statKeys,scoreComponents,recentTeamForm));continue;}
  const calculated=round.id===current.id?data:round.id===primary.id?latest:round.games.length?await calculateDashboard(snapshot,round.id,inputs):null;
  views.push({meta:{...(calculated?.meta??{...data.meta,roundId:round.id,lockoutAt:round.lockoutDate,fixtureCount:0,doubleTeams:0,recentRoundName:''}),roundName:roundLabel(round)},picks:calculated?.picks??{GK:[],DEF:[],MID:[],FWD:[]},startingSeven:calculated?.startingSeven??[],teams:calculated?.teams??[],differentialCount:calculated?.differentialCount??0,scoreKind:'projection',fixtures:roundFixtures(round,officialSquads),statsLabel:data.statsLabel});
}
const next=views.find(v=>v.meta.roundId===(current.id===primary.id?upcoming?.id:primary.id));
if(next)data.upcomingRound=next;
const advanced = JSON.parse(await readFile(new URL('../data/player-advanced.json', import.meta.url),'utf8'));
let matched=alignAdvanced(data.playerStats,officialSquads,advanced);
const fotmob=JSON.parse(await readFile(new URL("../data/fotmob-attacking.json",import.meta.url),"utf8"));
attachAttacking(data,officialSquads,fotmob,advanced);
attachTransferData(data,inputs,advanced,fotmob);
matched=data.playerStats.filter(p=>p.advanced).length;
data.setPieces=await buildSetPieces(officialSquads,advanced);
const statzAccess=await readFile(new URL('../data/statz-access.json',import.meta.url),'utf8').then(JSON.parse).catch(()=>({}));
data.sourceHealth={generatedAt:new Date().toISOString(),advancedMatched:matched,playerCount:data.playerStats.length,sources:[
{name:'Fantasy EFL',capturedAt:data.meta.updatedAt},{name:'Statz xG',capturedAt:snapshot.capturedAt,access:statzAccess.xg?.status},{name:'Statz 动作',capturedAt:advanced.capturedAt,access:statzAccess.advanced?.status},{name:'FotMob',capturedAt:fotmob.capturedAt}]};
console.log(`Advanced source matched safely: ${matched}/${data.playerStats.length}`);
const calendar=fixtureCalendar(inputs,snapshot);
const scoringSource=await readFile(new URL('../lib/fixture-difficulty.ts',import.meta.url),'utf8');
const {fixtureDifficulty,gameweekExpectedPoints}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(scoringSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
let checked=0;
for(const [id,live] of lives){
  const validIds=new Set(rounds.find(r=>r.id===id).games.filter(g=>g.status==='completed'&&g.isFinalized).map(g=>g.id));
  for(const row of live.squads.filter(r=>validIds.has(r.gameId))){
    const expected=5*row.win+3*row.draw+2*row.awayWin+2*row.cleanSheet+2*(row.goalsScored>=2)+2*(row.goalsScored>=4);
    if(expected!==row.points)throw new Error(`Official club scoring mismatch: GW${id} club ${row.squadId}`);
    checked++;
  }
}
for(const round of calendar.rounds){
  const officialRound=rounds.find(r=>r.id===round.id);
  const finalized=new Set(officialRound.games.filter(g=>g.status==='completed'&&g.isFinalized).map(g=>g.id));
  round.actualPoints={};
  for(const row of lives.get(round.id)?.squads??[])if(finalized.has(row.gameId))round.actualPoints[row.squadId]=(round.actualPoints[row.squadId]??0)+row.points;
}
for(const view of views.filter(v=>v.scoreKind!=='actual')){
  const round=calendar.rounds.find(r=>r.id===view.meta.roundId);
  const remaining=round.games.filter(g=>!['completed','postponed','cancelled'].includes(g.status));
  view.teams=calendar.teams.flatMap(team=>{
    const games=remaining.filter(g=>g.homeId===team.id||g.awayId===team.id);
    if(!games.length)return [];
    const matches=games.map(g=>{const home=g.homeId===team.id;const opponent=calendar.teams.find(t=>t.id===(home?g.awayId:g.homeId));return {home,opponent,result:fixtureDifficulty(team,opponent,home,calendar.teams)};});
    const score=gameweekExpectedPoints(matches);
    if(score==null)return [];
    const fixtureBadges=matches.map(m=>({label:m.home?'主':'客',opponent:m.opponent.name,opponentLogo:m.opponent.logo}));
    return [{id:team.id,name:team.fullName,logo:team.logo,score:score,fixtures:fixtureBadges.map(f=>`${f.label} ${f.opponent}`),fixtureBadges,form:[],leaguePosition:null,projectedXg:null,projectedXga:null}];
  }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).map(team=>({...team,score:Number(team.score.toFixed(1))}));
}
data.teams=views.find(v=>v.meta.roundId===data.meta.roundId).teams;
console.log(`Official club scoring verified: ${checked} finalized team results; predictions use fixture Poisson expectations.`);
await cacheChartAssets({data,views,calendar});
data.fixtureMatrixFile=await writeFixtureCalendar(calendar);
data.chartHistoryFile=await writeChartHistory(inputs,statKeys);
data.roundIndex=await writeRoundViews(views,rounds);
await writeFile(outputUrl, `${JSON.stringify(data)}\n`, "utf8");
console.log(`Generated ${data.meta.roundName}${next ? ` + ${next.meta.roundName}` : ""} at ${fileURLToPath(outputUrl)}`);
