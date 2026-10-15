import type { PlayerStat } from './dashboard-data';
export type ProfileMetric = { key:string; label:string; lower?:boolean; percent?:boolean; source:'official'|'xg'|'advanced'; value:(p:PlayerStat)=>number|null };
const per90 = (p:PlayerStat,key:keyof PlayerStat['perGame']) => p.perGame.minutesPlayed>0 ? p.perGame[key]*90/p.perGame.minutesPlayed : null;
const advanced90 = (p:PlayerStat,key:'aer'|'drp'|'cc'|'sdrb'|'tkl'|'int') => p.advanced && p.advanced[key]!=null && p.advanced.mins>0 ? p.advanced[key]! *90/p.advanced.mins : null;
const ratio = (a:number|null|undefined,b:number|null|undefined) => a!=null && b!=null && b>0 ? a/b*100 : null;
const metric = (key:string,label:string,value:ProfileMetric['value'],source:ProfileMetric['source']='official',lower=false,percent=false):ProfileMetric=>({key,label,value,source,lower,percent});
const goals=metric('goals90','进球 / 90',p=>per90(p,'goalsScored'));
const assists=metric('assists90','助攻 / 90',p=>per90(p,'assists'));
const ga=metric('ga90','进球＋助攻 / 90',p=>p.perGame.minutesPlayed>0?(p.perGame.goalsScored+p.perGame.assists)*90/p.perGame.minutesPlayed:null);
const fantasy=metric('fantasy','场均 Fantasy 得分',p=>p.perGame.points);
const fantasy90=metric('fantasy90','Fantasy 得分 / 90',p=>per90(p,'points'));
const xg=metric('xg90','xG / 90',p=>p.xg!=null && p.xgMinutes!=null && p.xgMinutes>0?p.xg*90/p.xgMinutes:null,'xg');
const shots=metric('shots90','射正 / 90',p=>per90(p,'shotsOnTarget'));
const tackles=metric('tackles90','抢断 / 90',p=>advanced90(p,'tkl'),'advanced');
const interceptions=metric('interceptions90','拦截 / 90',p=>advanced90(p,'int'),'advanced');
const clean=metric('clean','零封率',p=>p.perGame.cleanSheet*100,'official',false,true);
const passing=metric('passing','传球成功率',p=>ratio(p.advanced?.apas,p.advanced?.pas),'advanced',false,true);
const duels=metric('duels','对抗成功率',p=>ratio(p.advanced?.duw,p.advanced?.due),'advanced',false,true);
export const profileMetrics:Record<PlayerStat['position'],ProfileMetric[]>={
  GK:[metric('saves90','扑救 / 90',p=>per90(p,'saves')),metric('saveRate','扑救率',p=>ratio(p.perGame.saves,p.perGame.saves+p.perGame.goalsConceded),'official',false,true),clean,metric('conceded90','失球 / 90',p=>per90(p,'goalsConceded'),'official',true),fantasy],
  DEF:[metric('clearances90','解围 / 90',p=>per90(p,'clearances')),metric('blocks90','封堵 / 90',p=>per90(p,'blocks')),tackles,interceptions,clean,goals,assists,ga,metric('aerial90','争顶成功 / 90',p=>advanced90(p,'aer'),'advanced'),duels,passing,metric('dribbled90','被过 / 90',p=>advanced90(p,'drp'),'advanced',true),fantasy,fantasy90],
  MID:[metric('keyPasses90','关键传球 / 90',p=>per90(p,'keyPasses')),tackles,interceptions,shots,xg,goals,assists,ga,metric('created90','创造机会 / 90',p=>advanced90(p,'cc'),'advanced'),metric('dribbles90','成功过人 / 90',p=>advanced90(p,'sdrb'),'advanced'),passing,duels,fantasy,fantasy90],
  FWD:[xg,goals,shots,ga,fantasy,fantasy90],
};
export function ranking(value:number|null, values:(number|null)[],lower=false) {
  const valid=values.filter((v):v is number=>v!=null && Number.isFinite(v));
  if(value==null || !Number.isFinite(value) || valid.length<2) return null;
  const better=valid.filter(v=>lower?v<value-1e-9:v>value+1e-9).length;
  const equal=valid.filter(v=>Math.abs(v-value)<=1e-9).length;
  return {rank:better+1,n:valid.length,percentile:100*(valid.length-1-better-Math.max(0,equal-1)/2)/(valid.length-1)};
}
export function tint(percentile:number|null) {
  if(percentile==null) return '#ffffff';
  const endpoint=percentile>=50?[229,243,232]:[250,232,232];
  const weight=Math.min(1,Math.abs(percentile-50)/50);
  return `rgb(${endpoint.map(v=>Math.round(255+(v-255)*weight)).join(',')})`;
}
