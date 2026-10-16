import type {PlayerStat,TeamStat,StatKey} from './dashboard-data';
export type ChartHistory={rounds:number[];keys:StatKey[];players:Record<string,number[][]>;teams:Record<string,number[][]>};
export function recentChartStats(history:ChartHistory,roundId:number,count:number,players:PlayerStat[],teams:TeamStat[]){
 const cutoff=history.rounds.indexOf(roundId);
 const allowed=new Set(history.rounds.slice(0,cutoff+1));
 const take=(rows:number[][])=>rows.filter(r=>allowed.has(r[0])).sort((a,b)=>b[1]-a[1]||b[2]-a[2]).slice(0,count);
 return {
  players:players.flatMap(player=>{const rows=take(history.players[player.id]??[]);if(!rows.length)return [];const perGame=Object.fromEntries(history.keys.map((key,i)=>[key,rows.reduce((sum,r)=>sum+r[i+3],0)/rows.length])) as Record<StatKey,number>;return [{...player,appearances:rows.length,perGame,xg:null,xg90:null,xgMinutes:null,advanced:undefined,attacking:undefined,goals90:perGame.minutesPlayed>0?90*perGame.goalsScored/perGame.minutesPlayed:null}];}),
  teams:teams.flatMap(team=>{const rows=take(history.teams[team.id]??[]);if(!rows.length)return [];const avg=(i:number)=>rows.reduce((sum,r)=>sum+r[i],0)/rows.length;return [{...team,played:rows.length,fantasyPointsPerGame:avg(3),goalsPerGame:avg(4),goalsAgainstPerGame:avg(5),winRate:100*avg(6),pointsPerGame:3*avg(6)+avg(7),cleanSheetRate:100*avg(8),xgPerGame:null,xgaPerGame:null,xgdPerGame:null,xgShare:null,xptsPerGame:null,pointsDeltaPerGame:null,finishingDeltaPerGame:null}];})
 };
}
const requests=new Map<string,Promise<ChartHistory>>();
export function loadChartHistory(file:string){
 let request=requests.get(file);
 if(!request){request=fetch(new URL(file,document.baseURI)).then(async r=>{if(!r.ok)throw new Error('近期比赛数据加载失败');const history=await r.json() as ChartHistory;if(!Array.isArray(history.rounds)||!Array.isArray(history.keys)||!history.players||!history.teams)throw new Error('近期比赛数据不完整');return history;}).catch(error=>{requests.delete(file);throw error;});requests.set(file,request);}
 return request;
}
