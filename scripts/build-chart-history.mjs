import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {settledRows} from './build-round-views.mjs';
export async function writeChartHistory(inputs,keys){
 const history={rounds:inputs.rounds.map(r=>r.id),keys,players:{},teams:{}};
 const add=(target,id,row)=>{(target[id]??=[]).push(row);};
 for(const round of inputs.rounds){
  const rows=settledRows(round,inputs.lives.get(round.id));
  const dates=new Map(round.games.map(g=>[g.id,Date.parse(g.date)]));
  for(const p of rows.players)if(p.minutesPlayed>0)add(history.players,p.playerId,[round.id,dates.get(p.gameId),p.gameId,...keys.map(k=>p[k]??0)]);
  for(const t of rows.squads){const other=rows.squads.find(o=>o.gameId===t.gameId&&o.squadId!==t.squadId);if(!other)throw new Error('Missing opponent in finalized chart history');add(history.teams,t.squadId,[round.id,dates.get(t.gameId),t.gameId,t.points,t.goalsScored,other.goalsScored,t.win,t.draw,t.cleanSheet]);}
 }
 const json=JSON.stringify(history),name=createHash('sha256').update(json).digest('hex').slice(0,16)+'.json';
 const folder=new URL('../public/chart-history/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL(name,folder),json);
 console.log(`Lazy chart history: ${Buffer.byteLength(json)} bytes; ${Object.keys(history.players).length} players`);
 return './chart-history/'+name;
}
