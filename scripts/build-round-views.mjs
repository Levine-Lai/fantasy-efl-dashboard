import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';

const positions=['GK','DEF','MID','FWD'];
const excluded=new Set(['postponed','cancelled']);
export const roundLabel=round=>({'First legs':'附加赛首回合','Second legs':'附加赛次回合','Finals':'附加赛决赛'}[round.name]??round.name.replace('Gameweek','GW'));
export function roundFixtures(round,squads) {
  const byId=new Map(squads.map(team=>[team.id,team]));
  return [...round.games].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id-b.id).map(game=>{
    const home=byId.get(game.homeId),away=byId.get(game.awayId);
    return {id:game.id,date:game.date,status:game.status,finalized:!!game.isFinalized,competitionId:game.competitionId ?? home?.competitionId,homeId:game.homeId,awayId:game.awayId,homeName:home?.shortName||home?.name||'待定',awayName:away?.shortName||away?.name||'待定',homeLogo:home?.lightBadge||home?.darkBadge||'',awayLogo:away?.lightBadge||away?.darkBadge||'',homeScore:game.homeScore??null,awayScore:game.awayScore??null};
  });
}
export function countFixtures(fixtures) {
  const counts=new Map();
  for(const game of fixtures.filter(g=>!excluded.has(g.status))) for(const id of [game.homeId,game.awayId]) counts.set(id,(counts.get(id)??0)+1);
  return counts;
}
export function settledRows(round,live) {
  const ids=new Set(round.games.filter(g=>g.status==='completed'&&g.isFinalized).map(g=>g.id));
  return {players:[...new Map((live?.players??[]).filter(p=>ids.has(p.gameId)).map(p=>[`${p.playerId}:${p.gameId}`,p])).values()],squads:[...new Map((live?.squads??[]).filter(t=>ids.has(t.gameId)).map(t=>[`${t.squadId}:${t.gameId}`,t])).values()]};
}
export function historyView(round,inputs,base,statKeys,scoreComponents,recentTeamForm) {
  const fixtures=roundFixtures(round,inputs.squads),counts=countFixtures(fixtures);
  const squadById=new Map(inputs.squads.map(s=>[s.id,s]));
  const rawPlayers=new Map(inputs.players.map(p=>[p.id,p]));
  const current=settledRows(round,inputs.lives.get(round.id));
  const cutoff=Date.parse(round.lockoutDate);
  // Earlier GW assignment, not today's roster totals, defines the historical sample.
  const sample=inputs.rounds.filter(r=>Date.parse(r.lockoutDate)<=cutoff).map(r=>settledRows(r,inputs.lives.get(r.id)));
  const allPlayers=sample.flatMap(s=>s.players),allSquads=sample.flatMap(s=>s.squads);
  const aggregatePlayers=(rows,includeScored=false)=>{
    const map=new Map();
    for(const row of rows) {
      if(!(row.minutesPlayed>0)&&!(includeScored&&row.points))continue;
      const agg=map.get(row.playerId)??{squadId:row.squadId,games:0,totals:Object.fromEntries(statKeys.map(k=>[k,0]))};
      agg.games++;agg.squadId=row.squadId;
      for(const key of statKeys) agg.totals[key]+=row[key]??0;
      map.set(row.playerId,agg);
    }
    return map;
  };
  const cumulative=aggregatePlayers(allPlayers),single=aggregatePlayers(current.players,true);
  const badges=id=>fixtures.filter(g=>!excluded.has(g.status)&&(g.homeId===id||g.awayId===id)).map(g=>({label:g.homeId===id?'主':'客',opponent:g.homeId===id?g.awayName:g.homeName,opponentLogo:g.homeId===id?g.awayLogo:g.homeLogo}));
  const playerStats=[...cumulative].flatMap(([id,agg])=>{
    const p=rawPlayers.get(id),team=squadById.get(agg.squadId);if(!p||!team)return [];
    return [{id,fullName:`${p.firstName} ${p.lastName}`,team:team.shortName||team.name,jerseyUrl:team.jersey||team.lightBadge||'',teamLogo:team.lightBadge||team.darkBadge||'',competitionId:team.competitionId,position:p.position,appearances:agg.games,ownership:0,xg:null,xg90:null,xgMinutes:null,goals90:agg.totals.goalsScored*90/agg.totals.minutesPlayed,seasonGoals:agg.totals.goalsScored,perGame:Object.fromEntries(statKeys.map(key=>[key,agg.totals[key]/agg.games]))}];
  });
  const pickRows=[...single].flatMap(([id,agg])=>{
    const p=rawPlayers.get(id),team=squadById.get(agg.squadId);if(!p||!team)return [];
    const actions=current.players.filter(row=>row.playerId===id).reduce((sum,row)=>{const s=scoreComponents(row,p.position);return sum+s.attackActions+s.defenseActions;},0);
    const fixtureBadges=badges(team.id);
    return [{id,name:p.displayName,fullName:`${p.firstName} ${p.lastName}`,team:team.shortName||team.name,position:p.position,ownership:0,fixtures:fixtureBadges.map(f=>`${f.label} ${f.opponent}`),fixtureBadges,reliability:0,expectedMinutes:agg.totals.minutesPlayed,score:agg.totals.points,matchup:0,actionScore:actions/agg.games,returnScore:0,points:agg.totals.points,minutes:agg.totals.minutesPlayed,avatarUrl:team.jersey||'',teamLogo:team.lightBadge||team.darkBadge||'',fallbackImage:team.jersey||team.lightBadge||''}];
  }).sort((a,b)=>b.score-a.score||b.minutes-a.minutes||a.id-b.id);
  const picks=Object.fromEntries(positions.map(pos=>[pos,pickRows.filter(p=>p.position===pos)]));
  const used=new Map();const startingSeven=[];
  for(const pos of positions)for(const p of picks[pos]){
    if(startingSeven.filter(row=>row.position===pos).length>=(pos==='GK'?1:2))break;
    if((used.get(p.team)??0)>=2)continue;
    startingSeven.push(p);used.set(p.team,(used.get(p.team)??0)+1);
  }
  const teamStats=inputs.squads.map(team=>{
    const rows=allSquads.filter(s=>s.squadId===team.id),played=rows.length;
    const sum=key=>rows.reduce((n,r)=>n+(r[key]??0),0);
    const against=rows.reduce((n,row)=>n+(allSquads.find(other=>other.gameId===row.gameId&&other.squadId!==team.id)?.goalsScored??0),0);
    const rate=value=>played?value/played:null;
    return {id:team.id,name:team.shortName||team.name,fullName:team.name,logo:team.lightBadge||team.darkBadge||'',competitionId:team.competitionId,played,fantasyPointsPerGame:rate(sum('points')),goalsAgainstPerGame:rate(against),goalsPerGame:rate(sum('goalsScored')),winRate:rate(sum('win')*100),cleanSheetRate:rate(sum('cleanSheet')*100),pointsPerGame:rate(sum('win')*3+sum('draw')),xgPerGame:null,xgaPerGame:null,xgdPerGame:null,xgShare:null,xptsPerGame:null,pointsDeltaPerGame:null,finishingDeltaPerGame:null};
  });
  const teams=[...counts.keys()].map(id=>{
    const team=squadById.get(id),fixtureBadges=badges(id);
    return {id,name:team?.name||'待定',logo:team?.lightBadge||team?.darkBadge||'',fixtures:fixtureBadges.map(f=>`${f.label} ${f.opponent}`),fixtureBadges,form:recentTeamForm(allSquads,inputs.rounds.flatMap(r=>r.games),id),score:current.squads.filter(r=>r.squadId===id).reduce((n,r)=>n+(r.points??0),0),leaguePosition:null,projectedXg:null,projectedXga:null};
  }).sort((a,b)=>b.score-a.score||a.id-b.id).slice(0,12);
  return {meta:{...base.meta,roundId:round.id,roundName:roundLabel(round),lockoutAt:round.lockoutDate,fixtureCount:fixtures.filter(g=>!excluded.has(g.status)).length,doubleTeams:[...counts.values()].filter(n=>n>1).length,recentRoundName:'',xgUpdatedAt:''},picks,startingSeven,teams,differentialCount:0,scoreKind:'actual',fixtures,playerStats,teamStats,statsLabel:`截至 ${roundLabel(round)}，按 GW 归属累计官方已结算数据（含官方后续修正）；历史 xG、进阶数据与持有率无存档，留空，不使用当前值回填。`};
}
export async function writeRoundViews(views,rounds) {
  const folder=new URL('../public/round-data/',import.meta.url);await mkdir(folder,{recursive:true});
  const index=[];
  for(const view of views) {
    const round=rounds.find(r=>r.id===view.meta.roundId);
    const json=JSON.stringify(view),hash=createHash('sha256').update(json).digest('hex').slice(0,12);
    const file=`gw-${round.id}-${hash}.json`;await writeFile(new URL(file,folder),json);
    index.push({id:round.id,name:roundLabel(round),lockoutAt:round.lockoutDate,state:round.status==='completed'?'completed':round.status==='playing'?'current':'future',file:`./round-data/${file}`,fixtureCount:view.fixtures.filter(g=>!excluded.has(g.status)).length,doubleTeams:[...countFixtures(view.fixtures).values()].filter(n=>n>1).length});
  }
  return index;
}
