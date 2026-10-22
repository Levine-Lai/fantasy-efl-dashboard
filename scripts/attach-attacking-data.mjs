import {readFile,writeFile} from 'node:fs/promises';
export const normalize=name=>{
 const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('ß','ss').replaceAll('ð','d').replaceAll('ø','o').replaceAll('ł','l').replace(/[^a-z0-9]/g,'').replace('miltonkeynesdons','mkdons');
 return ({gezadavidturi:'gezaturi',matthewmaxdibleydias:'mattdibleydias',brendansarpongwiredu:'brendanwiredu',
  joshuabrendandavidmagennis:'joshmagennis',onellazarohernandezmayea:'onelhernandez',emmanuelmonthe:'mannymonthe',
  benbreretondiaz:'benbrereton',cameronmcjannett:'cameronmcjannet',tatycastellanos:'valentincastellanos',fabioandretavaresdesiderio:'fabiotavares',
  emilriisjakobsen:'emilriis',olutobiadebayorowling:'tobiadebayorowling',
  jordangabriel:'jordanlawrencegabriel',lutherwildin:'lutherjameswildin',mikefondoptalum:'mikefondop',chrisforinojoseph:'chrisforino'
 })[key]??key;
};
const alias=name=>{const parts=name.trim().split(/\s+/);return parts.length>1?normalize(parts[0][0]+parts.slice(1).join('')):'';};
const middle=name=>{const parts=name.trim().split(/\s+/);return parts.length>1?normalize(parts[0]+' '+parts.at(-1)):'';};
export function uniquePlayer(rows,player,team,official){
 const candidates=rows.filter(r=>r.competitionId===player.competitionId&&normalize(r.team)===normalize(team));
 const exact=candidates.filter(r=>normalize(r.name)===normalize(player.fullName));
 if(exact.length)return exact.length===1&&official.filter(p=>p.competitionId===player.competitionId&&p.team===player.team&&normalize(p.fullName)===normalize(player.fullName)).length===1?exact[0]:null;
 const short=alias(player.fullName),matches=candidates.filter(r=>alias(r.name)===short);
 if(short&&matches.length===1&&official.filter(p=>p.competitionId===player.competitionId&&p.team===player.team&&alias(p.fullName)===short).length===1)return matches[0];
 const key=middle(player.fullName),long=candidates.filter(r=>middle(r.name)===key);
 return key&&long.length===1&&official.filter(p=>p.competitionId===player.competitionId&&p.team===player.team&&middle(p.fullName)===key).length===1?long[0]:null;
}
export function attachAttacking(data,squads,fotmob,advanced){
 let fm=0,actions=0;
 for(const player of data.playerStats){
  const squad=squads.find(s=>s.competitionId===player.competitionId&&(s.shortName===player.team||s.name===player.team));if(!squad)continue;
  const f=uniquePlayer(fotmob.players,player,squad.name,data.playerStats),a=uniquePlayer(advanced.players,player,squad.name,data.playerStats);
  const validF=f&&f.mins>0,validA=a&&a.mins>0;
  player.attacking={xg:validF?f.xg:null,xa:validF?f.xa:null,xgi:validF&&f.xg!=null&&f.xa!=null?f.xg+f.xa:null,mins:validF?f.mins:null,apps:validF?f.apps:null,shots:validA?a.sh:null,crosses:validA?a.crs:null,dribbles:validA?a.sdrb:null,actionMins:validA?a.mins:null,actionApps:validA?a.apps:null,updatedAt:fotmob.capturedAt,actionUpdatedAt:advanced.capturedAt};
  if(validF)fm++;if(validA)actions++;
 }
 console.log(`Attacking sources matched: FotMob ${fm}, Statz ${actions}/${data.playerStats.length}`);
}
export async function buildSetPieces(squads,advanced){
 const file=new URL('../data/set-piece-reference.json',import.meta.url);let snapshot;
 try{const rows=(await Promise.all(['championship','league-one','league-two'].map(async slug=>{const source=`https://www.efl.com/fantasy-efl/set-piece-takers/${slug}/`;const r=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Set piece reference unavailable');const html=await r.text();const items=[...html.matchAll(/title:"([^"]+)",body:"((?:\\.|[^"\\])*)"/g)].map(m=>({team:m[1],body:JSON.parse('"'+m[2]+'"'),source})).filter(r=>r.body.includes('Penalties'));if(items.length!==24)throw new Error('Incomplete set piece reference');return items;}))).flat();snapshot={capturedAt:new Date().toISOString(),rows};await writeFile(file,JSON.stringify(snapshot)+'\n');}catch(error){snapshot=await readFile(file,'utf8').then(JSON.parse).catch(()=>null);if(!snapshot||snapshot.rows?.length!==72)throw error;console.warn('Set pieces: retained previous reference');}
 const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&amp;/g,' ').replace(/\s+/g,' ').trim();
 return {capturedAt:snapshot.capturedAt,penaltyCapturedAt:advanced.capturedAt,teams:squads.map(team=>{
  const ref=snapshot.rows.find(r=>normalize(r.team)===normalize(team.name));const fields=ref?[...ref.body.matchAll(/<h6>([\s\S]*?)<\/h6>([\s\S]*?)(?=<h6>|$)/g)].map(m=>({type:clean(m[1]),names:clean(m[2])})):[];
  const names=term=>fields.filter(f=>f.type.toLowerCase().includes(term)).map(f=>term==='free-kick'?(f.type.includes('Direct')?'直接：'+f.names:f.type.includes('Indirect')?'间接：'+f.names:f.names):f.names).join('；');
  const penalties=advanced.players.filter(p=>p.competitionId===team.competitionId&&normalize(p.team)===normalize(team.name)&&p.pentaken>0).map(p=>({name:p.name,taken:p.pentaken,scored:p.pen})).sort((a,b)=>b.taken-a.taken||a.name.localeCompare(b.name));
  return {id:team.id,name:team.shortName||team.name,competitionId:team.competitionId,logo:team.lightBadge||team.darkBadge||'',penalties,penaltyReference:names('penalt'),freeKicks:names('free-kick'),corners:names('corners'),source:ref?.source??null};
 })};
}
