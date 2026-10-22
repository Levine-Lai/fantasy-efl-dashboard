import {readFile,writeFile} from 'node:fs/promises';
import {uniquePlayer,normalize} from './attach-attacking-data.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [data,xg,advanced,fotmob,fpl]=await Promise.all(['../pages/dashboard.json','../data/xg-snapshot.json','../data/player-advanced.json','../data/fotmob-attacking.json','../public/fpl/dashboard.json'].map(read));
const xgRows=xg.players.map(p=>({...p,name:p.player_name,team:p.team_name}));
const groups=[
 {key:'xg',rows:xgRows,present:p=>p.xg90!=null,value:r=>r.xg,aligned:true},
 {key:'advanced',rows:advanced.players,present:p=>!!p.advanced,value:r=>r.mins,aligned:true},
 {key:'xa',rows:fotmob.players,present:p=>p.attacking?.xa!=null,value:r=>r.xa,aligned:false},
];
const leagues={10:'英冠',11:'英甲',12:'英乙'};
const efl=groups.map(group=>{
 const missing=data.playerStats.filter(p=>!group.present(p)).map(p=>{
  const team=data.teamStats.find(t=>t.competitionId===p.competitionId&&normalize(t.name)===normalize(p.team))?.fullName??p.team;
  const row=uniquePlayer(group.rows,p,team,data.playerStats);
  const reason=!row?'identity_unmatched':group.aligned&&row.apps!==p.appearances?'appearance_mismatch':group.value(row)==null?'source_metric_missing':(row.minutes??row.mins??0)<=0?'source_minutes_missing':'alignment_unresolved';
  return {id:p.id,name:p.fullName,team:p.team,league:leagues[p.competitionId],position:p.position,minutes:Math.round(p.perGame.minutesPlayed*p.appearances),officialApps:p.appearances,sourceApps:row?.apps??null,sourceName:row?.name??null,reason};
 });
 const summarize=rows=>Object.fromEntries([...new Set(rows.map(r=>r.reason))].map(reason=>[reason,rows.filter(r=>r.reason===reason).length]));
 return {metric:group.key,total:data.playerStats.length,available:data.playerStats.length-missing.length,missing:missing.length,reasons:summarize(missing),over450:{total:data.playerStats.filter(p=>p.perGame.minutesPlayed*p.appearances>=450).length,missing:missing.filter(p=>p.minutes>=450).length,reasons:summarize(missing.filter(p=>p.minutes>=450))},rows:missing};
});
const appearances=fpl.players.flatMap(p=>p.history.filter(h=>h.minutes>0).map(h=>({...h,position:p.position})));
const report={generatedAt:new Date().toISOString(),eflCapturedAt:data.meta.updatedAt,sourceHealth:data.sourceHealth,efl,fpl:{capturedAt:fpl.capturedAt,players:fpl.players.length,withAppearances:fpl.players.filter(p=>p.history.some(h=>h.minutes>0)).length,withoutAppearances:fpl.players.filter(p=>!p.history.some(h=>h.minutes>0)).length,settledRows:fpl.players.reduce((n,p)=>n+p.history.length,0),missingFields:Object.fromEntries(['xg','xa','xgi','cbi','tackles','recoveries','defensive'].map(key=>[key,appearances.filter(h=>h.position!=='GK'&&h[key]==null).length]))}};
await writeFile(new URL('../data/coverage-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const {rows,...summary} of efl)console.log(JSON.stringify(summary));
console.log(JSON.stringify(report.fpl));
