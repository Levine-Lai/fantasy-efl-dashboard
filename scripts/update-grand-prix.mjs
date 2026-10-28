import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Authenticated responses are collected through the browser and kept outside the published site.
const directory=process.argv[2];
if(!directory)throw Error('Usage: node scripts/update-grand-prix.mjs <official-input-directory> [--write]');
const read=async name=>JSON.parse(await fs.readFile(path.join(directory,name+'.json'),'utf8'));
const [input,players,rounds,live]=await Promise.all(['official-members','players','rounds','live'].map(read));
const context={window:{}};vm.createContext(context);
for(const name of ['data','rules','fastest'])vm.runInContext(await fs.readFile(new URL(`../league-standings/${name}.js`,import.meta.url),'utf8'),context);
const data=context.window.LEAGUE_DATA,laps=context.window.FASTEST_LAPS,week=input.week;
assert.ok(week===data.orders.length+1 || week===data.orders.length,'Only append or refresh the latest week');
assert.equal(input.leagueId,365,'Grand Prix results must use league 365');assert.equal(input.weekly.nextPage,false);
const round=rounds.find(r=>r.id===week);assert.ok(round);
assert.ok(round.games.every(g=>g.status==='completed'),'Do not finalize captain fallback before all fixtures finish');
const gameIds=new Set(round.games.map(g=>g.id)),playerScores=new Map(),minutes=new Map(),clubScores=new Map();
for(const [rows,idKey,target] of [[live.players,'playerId',playerScores],[live.squads,'squadId',clubScores]]){
 const seen=new Set();for(const row of rows){assert.ok(gameIds.has(row.gameId));const key=`${row[idKey]}:${row.gameId}`;assert.ok(!seen.has(key),'Duplicate match score');seen.add(key);target.set(row[idKey],(target.get(row[idKey])??0)+row.points);if(idKey==='playerId')minutes.set(row.playerId,(minutes.get(row.playerId)??0)+(row.minutesPlayed??0));}
}
const playerById=new Map(players.map(p=>[p.id,p]));
const memberIds=new Set(),entries=data.people.map((person,i)=>{
 const matches=input.weekly.rankings.filter(r=>r.teamName===person[2]);assert.equal(matches.length,1,`Unique member ${person[2]}`);
 const official=matches[0];assert.ok(!memberIds.has(official.userId));memberIds.add(official.userId);
 const saved=input.teams.find(t=>t.driverId===i+1);assert.equal(saved.userId,official.userId);assert.equal(saved.team.roundId,week);
 const team=saved.team,ids=Object.values(team.lineup.players).flat();assert.equal(ids.length,7);assert.equal(new Set(ids).size,7);
 let captain=team.captainId;
 if(team.maxCaptainEnabled){captain=[...ids].sort((a,b)=>(playerScores.get(b)??0)-(playerScores.get(a)??0)||ids.indexOf(a)-ids.indexOf(b))[0];}
 else if(!(minutes.get(captain)>0))captain=team.viceCaptainId;
 const picks=ids.map(id=>{assert.ok(playerById.has(id));const base=playerScores.get(id)??0,multiplier=id===captain?2:1;return {playerId:id,name:[playerById.get(id).firstName,playerById.get(id).lastName].join(' '),base,multiplier,points:base*multiplier};});
 const clubPoints=team.lineup.squads.reduce((s,id)=>s+(clubScores.get(id)??0),0);
 assert.equal(picks.reduce((s,p)=>s+p.points,0)+clubPoints,official.roundPoints,`Official total mismatch: ${person[0]}`);
 return {id:i+1,rank:official.rank,score:official.roundPoints,viceName:[playerById.get(team.viceCaptainId)?.firstName,playerById.get(team.viceCaptainId)?.lastName].join(' '),vicePoints:playerScores.get(team.viceCaptainId)??0,picks};
});
entries.sort((a,b)=>a.rank-b.rank);const order=entries.map(e=>e.id);
data.orders[week-1]=order;data.scores[week-1]=entries.map(e=>e.score);
const adjusted=context.scoringOrder(week,data.orders),maximum=Math.max(...entries.flatMap(e=>e.picks.map(p=>p.points)));
const holders=entries.filter(e=>e.picks.some(p=>p.points===maximum));
const candidates=holders.filter(e=>adjusted.indexOf(e.id)<10).map(e=>({id:e.id,rank:adjusted.indexOf(e.id)+1,viceName:e.viceName,vicePoints:e.vicePoints,players:e.picks.filter(p=>p.points===maximum)})).sort((a,b)=>b.vicePoints-a.vicePoints||a.rank-b.rank);
const winner=candidates[0];
laps.weeks[week-1]={week,maximum,winnerId:winner?.id??null,holders:holders.map(e=>e.id),candidates,winningPlayers:winner?.players??[],viceName:winner?.viceName??null,vicePoints:winner?.vicePoints??null};
laps.capturedAt=input.capturedAt;
const overall=input.overall.filter(r=>memberIds.has(r.userId)).sort((a,b)=>a.rank-b.rank);
for(const person of data.people)person[3]=overall.findIndex(r=>r.teamName===person[2])+1;
const accepted=process.argv.includes('--accept-current-as-final');
data.update={week,capturedAt:input.capturedAt,leagueId:input.leagueId,completedGames:round.games.filter(g=>g.status==='completed').length,finalizedGames:round.games.filter(g=>g.isFinalized).length,totalGames:round.games.length,provisional:!accepted&&(round.status!=='completed'||round.games.some(g=>!g.isFinalized)),finalBasis:accepted?'user-confirmed-current-scores':'official-status'};
const audit={...data.update,scoring:'25,18,15,12,10,8,6,4,2,1; fastest lap +1',entries,fastest: laps.weeks[week-1]};
await fs.writeFile(path.join(directory,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({update:data.update,topTen:entries.slice(0,10).map(e=>[data.people[e.id-1][0],e.score]),fastest:{maximum,winner:winner?data.people[winner.id-1][0]:null,vicePoints:winner?.vicePoints}},null,2));
if(process.argv.includes('--write')){
 await fs.writeFile(new URL('../league-standings/data.js',import.meta.url),'window.LEAGUE_DATA = '+JSON.stringify(data,null,2)+';\n');
 await fs.writeFile(new URL('../league-standings/fastest.js',import.meta.url),'window.FASTEST_LAPS = '+JSON.stringify(laps)+';\n');
}
