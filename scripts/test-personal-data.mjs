import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const load=async path=>{
 const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace('import { env } from "cloudflare:workers";','const env={DB:null};');
 return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
};
const {ranking,tint,profileMetrics}=await load('../lib/player-profile.ts');
assert.deepEqual(ranking(3,[1,2,3,null,NaN]),{rank:1,n:3,percentile:100});
assert.deepEqual(ranking(1,[1,2,3],true),{rank:1,n:3,percentile:100});
assert.deepEqual(ranking(2,[1,2,2,3]),{rank:2,n:4,percentile:50});
assert.equal(ranking(.1+.2,[.3,.1+.2,.1]).rank,1);
assert.equal(ranking(.1+.2,[.3,.1+.2,.1]).percentile,75);
assert.equal(ranking(null,[1,2]),null);assert.equal(ranking(1,[1]),null);
assert.deepEqual(ranking(0,[0,0,0]),{rank:1,n:3,percentile:50});
assert.equal(tint(null),'#ffffff');assert.equal(tint(50),'rgb(255,255,255)');
for(const p of [0,25,75,100])assert.ok(tint(p).match(/\d+/g).every(channel=>Number(channel)>=180));
const {projectTeamMatch,recentTeamForm}=await load('../lib/dashboard-data.ts');
const base={rank:12,opponentRank:12,own:{played:10,xg_per_game:1.4,xga_per_game:1.4},opposing:{played:10,xg_per_game:1.4,xga_per_game:1.4},league:{attack:1.4,defense:1.4},home:true,wins:4,games:10};
const score=projectTeamMatch(base).score;
assert.ok(projectTeamMatch({...base,rank:1}).score>score);
assert.ok(projectTeamMatch({...base,own:{...base.own,xg_per_game:2}}).score>score);
assert.ok(projectTeamMatch({...base,own:{...base.own,xga_per_game:.8}}).score>score);
assert.ok(Number.isFinite(projectTeamMatch({home:false,wins:0,games:0}).score));
const data=JSON.parse(await readFile(new URL('../pages/dashboard.json',import.meta.url),'utf8'));
assert.ok(data.playerStats.filter(p=>p.advanced).length>1000);
for(const p of data.playerStats) {
 assert.ok(p.teamLogo);
 if(p.advanced)assert.equal(p.appearances,p.advanced.apps);
 for(const metric of profileMetrics[p.position]) {const value=metric.value(p);assert.ok(value===null || Number.isFinite(value));if(metric.percent && value!=null)assert.ok(value>=0 && value<=100);}
}
assert.deepEqual(Object.values(profileMetrics).map(rows=>rows.length),[5,14,14,6]);
assert.ok(data.teams.every(t=>(t.leaguePosition==null || t.leaguePosition>=1 && t.leaguePosition<=24) && (t.projectedXg==null || t.projectedXg>0) && (t.projectedXga==null || t.projectedXga>0)));
console.log('Personal data checks passed: ties, reversed rankings, missing values, subtle tints, model monotonicity, source alignment and all position metrics');

assert.equal(new Set(data.teamStats.map(t=>t.id)).size,72);
for(const t of data.teamStats.filter(t=>t.played>0)) {
 assert.ok(Number.isFinite(t.fantasyPointsPerGame));
 assert.ok(Number.isFinite(t.goalsAgainstPerGame) && t.goalsAgainstPerGame>=0);
}
for(const league of [10,11,12]) {
 const teams=data.teamStats.filter(t=>t.competitionId===league);
 const scored=teams.reduce((sum,t)=>sum+(t.goalsPerGame??0)*t.played,0);
 const conceded=teams.reduce((sum,t)=>sum+(t.goalsAgainstPerGame??0)*t.played,0);
 assert.ok(Math.abs(scored-conceded)<1e-6,'Every league goal must also be conceded by an opponent');
}
console.log('Team aggregates passed: 72 unique clubs, finite per-game values and balanced league goals');

const fixtures=Array.from({length:7},(_,i)=>({id:i+1,date:`2026-10-${String(i+1).padStart(2,'0')}T12:00:00Z`}));
const results=fixtures.map((g,i)=>({gameId:g.id,squadId:1,win:i%3===0?1:0,draw:i%3===1?1:0}));
assert.deepEqual(recentTeamForm([...results].reverse().concat(results[6]),fixtures,1),['L','W','D','L','W']);
assert.deepEqual(recentTeamForm(results,fixtures,2),[]);
for(const round of [data,data.upcomingRound].filter(Boolean))for(const team of round.teams){assert.ok(team.form.length<=5);assert.ok(team.form.every(v=>['W','D','L'].includes(v)));}
console.log('Recent team form passed: calendar order, deduplicated games, last five results and upcoming round');
