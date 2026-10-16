import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {countFixtures,settledRows,historyView} from './build-round-views.mjs';
const source=(await readFile(new URL('../lib/dashboard-data.ts',import.meta.url),'utf8')).replace('import { env } from "cloudflare:workers";','const env={DB:null};');
const {statKeys,scoreComponents,recentTeamForm}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const roundSource=await readFile(new URL('../lib/round-view.ts',import.meta.url),'utf8');
const {defaultRound,fixtureCounts}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(roundSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
assert.equal(defaultRound([{id:1,state:'completed'},{id:2,state:'current'},{id:3,state:'future',lockoutAt:'2026-11-01'}],Date.parse('2026-10-16')),2);
assert.equal(defaultRound([{id:1,state:'completed'},{id:2,state:'future',lockoutAt:'2026-11-01'}],Date.parse('2026-10-16')),2);
const squads=[{id:1,competitionId:10,name:'Home',shortName:'Home'},{id:2,competitionId:10,name:'Away',shortName:'Away'},{id:3,competitionId:10,name:'Third',shortName:'Third'}];
const game=(id,awayId,status='completed',isFinalized=true)=>({id,homeId:1,awayId,competitionId:10,date:`2026-09-${id}T12:00:00Z`,status,isFinalized});
const round={id:1,name:'Gameweek 1',status:'completed',lockoutDate:'2026-09-01T00:00:00Z',games:[game(10,2),game(11,3),game(12,2,'postponed'),game(13,3,'completed',false)]};
const player={id:9,squadId:1,competitionId:10,firstName:'Test',lastName:'Player',displayName:'T. Player',position:'DEF'};
const live={players:[{playerId:9,squadId:1,gameId:10,points:8,minutesPlayed:90,goalsScored:1},{playerId:9,squadId:1,gameId:11,points:4,minutesPlayed:60},{playerId:9,squadId:1,gameId:11,points:4,minutesPlayed:60},{playerId:9,squadId:1,gameId:13,points:99,minutesPlayed:90}],squads:[{squadId:1,gameId:10,points:5,win:1,goalsScored:2},{squadId:2,gameId:10,points:0,goalsScored:0},{squadId:1,gameId:11,points:3,draw:1,goalsScored:1},{squadId:3,gameId:11,points:3,draw:1,goalsScored:1}]};
assert.equal(settledRows(round,live).players.length,2,'Unfinalized and duplicate rows must not count');
const inputs={players:[player],squads,rounds:[round,{...round,id:2,lockoutDate:'2026-09-20T00:00:00Z'}],lives:new Map([[1,live],[2,{players:[{...live.players[0],points:999}],squads:[]}]])};
const historical=historyView(round,inputs,{meta:{updatedAt:'2026-10-16T00:00:00Z'}},statKeys,scoreComponents,recentTeamForm);
assert.equal(historical.picks.DEF[0].score,12,'Double gameweek actual points are added, not averaged');
assert.equal(historical.playerStats[0].perGame.points,6,'Later GW points must never enter the historical sample');
assert.equal(historical.playerStats[0].appearances,2);
assert.equal(historical.playerStats[0].xg,null,'Current xG must not backfill history');
assert.equal(historical.teamStats[0].fantasyPointsPerGame,4);
assert.equal(historical.teams[0].score,8);
assert.equal(countFixtures(historical.fixtures).get(1),3,'Postponed games excluded; completed but unfinalized games remain scheduled fixtures');
assert.deepEqual([...fixtureCounts(historical.fixtures)],[...countFixtures(historical.fixtures)],'Client and generator agree on double-gameweek membership');
const data=JSON.parse(await readFile(new URL('../pages/dashboard.json',import.meta.url),'utf8'));
assert.equal(data.roundIndex.length,42);
assert.equal(new Set(data.roundIndex.map(r=>r.id)).size,42);
for(const entry of data.roundIndex){
  const view=JSON.parse(await readFile(new URL('../public/'+entry.file.replace(/^\.\//,''),import.meta.url),'utf8'));
  assert.equal(view.meta.roundId,entry.id);
  assert.equal(entry.doubleTeams,[...countFixtures(view.fixtures).values()].filter(n=>n>1).length);
  assert.equal(entry.fixtureCount,view.fixtures.filter(g=>!['postponed','cancelled'].includes(g.status)).length);
  assert.ok(view.fixtures.every(g=>g.homeName&&g.awayName&&Number.isFinite(Date.parse(g.date))));
  if(entry.state==='completed'){
    assert.equal(view.scoreKind,'actual');
    assert.ok(view.playerStats.every(p=>p.xg===null&&!p.advanced));
    assert.ok(view.teams.every(t=>t.leaguePosition===null&&t.projectedXg===null));
  }else{
    assert.equal(view.scoreKind,'projection');
    assert.equal(view.playerStats,undefined,'Future rounds reuse the latest sample instead of copying it');
    if(!entry.fixtureCount)assert.equal(view.startingSeven.length,0);
  }
}
console.log('GW views passed: all 42 rounds, finalized-only scores, double fixtures, no future leakage, missing archives and empty schedules');
