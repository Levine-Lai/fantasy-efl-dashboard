import {uniquePlayer} from './attach-attacking-data.mjs';

// Official per-match player/squad IDs establish each stint before any source lookup.
export function attachTransferData(data,inputs,advanced,fotmob) {
 const squads=new Map(inputs.squads.map(s=>[s.id,s])),players=new Map(inputs.players.map(p=>[p.id,p]));
 const stints=new Map(),rosters=new Map();
 for(const round of inputs.rounds){
  const settled=new Set(round.games.filter(g=>g.status==='completed'&&g.isFinalized).map(g=>g.id));
  for(const row of inputs.lives.get(round.id)?.players??[]){
   if(!settled.has(row.gameId))continue;
   const p=players.get(row.playerId),s=squads.get(row.squadId);if(!p||!s)continue;
   const byTeam=stints.get(p.id)??new Map(),games=byTeam.get(s.id)??new Set();games.add(row.gameId);byTeam.set(s.id,games);stints.set(p.id,byTeam);
   const roster=rosters.get(s.id)??new Map();roster.set(p.id,{id:p.id,fullName:`${p.firstName} ${p.lastName}`.trim(),team:s.shortName||s.name,competitionId:s.competitionId});rosters.set(s.id,roster);
  }
 }
 const sum=(rows,key)=>rows.every(r=>typeof r[key]==='number'&&Number.isFinite(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
 const sourceParts=(id,source)=>[...stints.get(id)].map(([squadId,games])=>{
  const squad=squads.get(squadId),roster=[...rosters.get(squadId).values()],p=roster.find(p=>p.id===id);
  const row=uniquePlayer(source.players,p,squad.name,roster);
  return row?.apps===games.size&&row.mins>0?row:null;
 });
 let restored=0;
 for(const p of data.playerStats){
  const byTeam=stints.get(p.id);if(!byTeam?.size)continue;
  const current=players.get(p.id);
  if(byTeam.size===1&&byTeam.has(current.squadId))continue;
  if([...byTeam.values()].reduce((n,games)=>n+games.size,0)!==p.appearances)continue;
  const a=sourceParts(p.id,advanced),f=sourceParts(p.id,fotmob);
  if(a.every(Boolean)){
   p.advanced=Object.fromEntries(['apps','mins','tkl','int','aer','due','duw','pas','apas','drp','cc','sdrb'].map(key=>[key,sum(a,key)]));
   p.advanced.updatedAt=advanced.capturedAt;
   if(p.attacking)Object.assign(p.attacking,{shots:sum(a,'sh'),crosses:sum(a,'crs'),dribbles:sum(a,'sdrb'),actionMins:sum(a,'mins'),actionApps:sum(a,'apps')});
   restored++;
  }
  if(f.every(Boolean)&&p.attacking){
   const xg=sum(f,'xg'),xa=sum(f,'xa');
   Object.assign(p.attacking,{xg,xa,xgi:xg!=null&&xa!=null?xg+xa:null,mins:sum(f,'mins'),apps:sum(f,'apps')});
  }
 }
 console.log(`Verified historical club stints: ${restored} advanced player records assembled from same-source parts.`);
 return restored;
}
