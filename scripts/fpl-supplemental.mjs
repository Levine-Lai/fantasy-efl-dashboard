import {readFile,writeFile,rename} from 'node:fs/promises';
import {statzRequest} from './statz-request.mjs';

const file=new URL('../data/fpl/supplemental.json',import.meta.url);
const source='https://statz.ai/competitions/premier-league/stats';
export const teamFields={bigChances:'bigc',bigChancesAgainst:'bigc-against',bigChancesMissed:'bigc-missed',bigChancesScored:'bigc-scored',shots:'shots',shotsAgainst:'shots-against',shotsOnTarget:'sot',shotsOnTargetAgainst:'sot-against',shotsInBox:'sib',corners:'corners',cornersAgainst:'corners-against',chancesCreated:'key-passes',interceptions:'ints',passes:'passes',accuratePasses:'succ-passes',crosses:'crosses',accurateCrosses:'acc-crosses',duelsWon:'duels'};
export const playerFields={bigChancesCreated:'bcc',bigChancesMissed:'bcm',chancesCreated:'cc',shots:'sh',shotsOnTarget:'sot',crosses:'crs',successfulDribbles:'sdrb'};
const numeric=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const alias={'mancity':'manchestercity','manutd':'manchesterunited','spurs':'tottenhamhotspur','nottmforest':'nottinghamforest','brighton':'brightonhovealbion','bournemouth':'afcbournemouth'};
const identity=s=>alias[normalize(s)]??normalize(s);
const ids=rows=>rows.map(f=>f.id??f.fixture).sort((a,b)=>a-b);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function alignSupplemental(data,snapshot){
  if(snapshot?.season!==data.season)return {teams:0,players:0};
  let teams=0,players=0;
  for(const row of snapshot.teams??[]){
    const team=data.teams.find(t=>t.id===row.id);if(!team)continue;
    const games=data.fixtures.filter(f=>f.finished&&(f.home===row.id||f.away===row.id));
    if(same(ids(games),row.fixtureIds))teams++;
  }
  for(const player of data.players){
    delete player.supplemental;
    const row=snapshot.players?.find(r=>r.id===player.id),matches=player.history.filter(h=>h.minutes>0);
    if(row&&row.team===player.team&&same(ids(matches),row.fixtureIds)&&matches.reduce((n,h)=>n+h.minutes,0)===row.officialMinutes){player.supplemental=row;players++;}
  }
  data.supplemental={...snapshot,stale:!!snapshot.stale};
  return {teams,players};
}

export function normalizeSupplemental(data,teamPage,playerPage,capturedAt=new Date().toISOString()){
  const season=data.season.slice(0,4)+'/'+(Number(data.season.slice(0,4))+1);
  if([teamPage,playerPage].some(p=>p.competition?.id!==8||p.hero?.season!==season))throw Error('Supplemental season or competition mismatch');
  if(teamPage.teamRows?.length!==20||playerPage.playerRows?.length<100)throw Error('Incomplete supplemental source');
  const teams=[],players=[];
  for(const team of data.teams){
    const candidates=teamPage.teamRows.filter(r=>[r.name,r.short].some(n=>n&&identity(n)===identity(team.name)));
    if(candidates.length!==1)continue;
    const row=candidates[0],games=data.fixtures.filter(f=>f.finished&&(f.home===team.id||f.away===team.id));
    const goals=games.reduce((n,f)=>n+(f.home===team.id?f.homeScore:f.awayScore),0),against=games.reduce((n,f)=>n+(f.home===team.id?f.awayScore:f.homeScore),0);
    const points=games.reduce((n,f)=>{const gf=f.home===team.id?f.homeScore:f.awayScore,ga=f.home===team.id?f.awayScore:f.homeScore;return n+(gf>ga?3:gf===ga?1:0);},0);
    if(!games.length||row.played!==games.length||row.stats.goals?.tot!==goals||row.stats.ga?.tot!==against||row.stats.points?.tot!==points)continue;
    teams.push({id:team.id,sourceId:row.team_id,fixtureIds:ids(games),played:row.played,metrics:Object.fromEntries(Object.entries(teamFields).map(([key,field])=>[key,numeric(row.stats[field]?.tot)]))});
    const sourcePlayers=playerPage.playerRows.filter(r=>r.team_id===row.team_id);
    for(const player of data.players.filter(p=>p.team===team.id)){
      const candidates=sourcePlayers.filter(r=>[player.fullName,player.name].some(n=>normalize(n)===normalize(r.name))||(normalize(r.name).length>=8&&normalize(player.fullName).startsWith(normalize(r.name))));
      if(candidates.length!==1)continue;
      const r=candidates[0],matches=player.history.filter(h=>h.minutes>0),minutes=matches.reduce((n,h)=>n+h.minutes,0);
      // A transfer or incomplete source must not silently acquire a whole-season rate.
      if(!minutes||r.apps!==matches.length||numeric(r.mins)==null||Math.abs(r.mins-minutes)>Math.max(5,matches.length)||r.g!==matches.reduce((n,h)=>n+h.goals,0))continue;
      if(matches.some(h=>{const f=data.fixtures.find(f=>f.id===h.fixture);return !f||(h.home?f.home:f.away)!==team.id;}))continue;
      players.push({id:player.id,team:team.id,fixtureIds:ids(matches),minutes:r.mins,officialMinutes:minutes,metrics:Object.fromEntries(Object.entries(playerFields).map(([key,field])=>[key,numeric(r[field])]))});
    }
  }
  if(!teams.length)throw Error('No supplemental teams align with official match sample');
  return {season:data.season,capturedAt,source,teams,players};
}

async function page(url){
  const response=await statzRequest(url,{timeoutMs:15000},'fpl');
  const html=await response.text(),encoded=html.match(/data-page="([^"]+)"/)?.[1];
  if(!encoded)throw Error('Supplemental page data missing');
  return JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#039;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')).props;
}
export async function updateFplSupplemental(data){
  let snapshot;
  try{
    const teams=await page(source+'?group=attacking'),players=await page(source+'/players?group=attacking');
    snapshot=normalizeSupplemental(data,teams,players);
    const temporary=new URL(file.href+'.tmp');
    await writeFile(temporary,JSON.stringify(snapshot)+'\n');await rename(temporary,file);
  }catch(error){
    console.warn('FPL supplemental:',error.message);
    snapshot=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);
    if(snapshot)snapshot={...snapshot,stale:true};
  }
  const coverage=alignSupplemental(data,snapshot);
  console.log(`FPL supplemental: ${coverage.teams}/20 teams, ${coverage.players} players aligned`);
}
