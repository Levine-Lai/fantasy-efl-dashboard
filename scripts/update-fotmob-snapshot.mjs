import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../data/fotmob-attacking.json',import.meta.url);
const now=new Date(),year=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0),season=`${year}/${year+1}`;
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`FotMob ${r.status}`);return r;};
try{
 const players=(await Promise.all([[10,48],[11,108],[12,109]].map(async([competitionId,id])=>{
  const html=await (await get(`https://www.fotmob.com/leagues/${id}/stats`)).text();
  const encoded=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!encoded)throw new Error('Missing FotMob page data');
  const p=JSON.parse(encoded).props.pageProps;if(p.details.selectedSeason!==season)throw new Error('Wrong FotMob season');
  const datasets=await Promise.all(['expected_goals','expected_assists'].map(async key=>{const url=p.stats.players.find(s=>s.name===key)?.fetchAllUrl;if(!url||!url.startsWith('https://data.fotmob.com/stats/'))throw new Error('Missing public stats URL');const j=await (await get(url)).json();const rows=j.TopLists.find(t=>t.StatName===key)?.StatList;if(!rows||rows.length<100)throw new Error('Incomplete FotMob standings');return rows;}));
  const [xgs,xas]=datasets;const xaMap=new Map(xas.map(r=>[r.ParticiantId,r]));
  const xgMap=new Map(xgs.map(r=>[r.ParticiantId,r]));
  return [...new Set([...xgMap.keys(),...xaMap.keys()])].map(id=>{const g=xgMap.get(id),a=xaMap.get(id),r=g??a;const aligned=!g||!a||a.TeamId===g.TeamId&&a.MinutesPlayed===g.MinutesPlayed&&a.MatchesPlayed===g.MatchesPlayed;return {id,competitionId,name:r.ParticipantName,team:r.TeamName,mins:r.MinutesPlayed,apps:r.MatchesPlayed,xg:g?.StatValue??null,xa:aligned?a?.StatValue??null:null};});
 }))).flat();
 await writeFile(file,JSON.stringify({season,capturedAt:now.toISOString(),players})+'\n');console.log(`FotMob attacking snapshot: ${players.length} players`);
}catch(error){const prior=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);if(!prior||prior.season!==season||prior.players.length<1000)throw error;console.warn(`FotMob retained from ${prior.capturedAt}: ${error.message}`);}
