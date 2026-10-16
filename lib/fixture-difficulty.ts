export type FdrRates={played:number;xg:number;xga:number};
export type FdrTeam={id:number;name:string;fullName:string;abbreviation:string;logo:string;competitionId:number;overall:FdrRates|null;home?:FdrRates;away?:FdrRates};
export type FdrRound={id:number;name:string;state:'completed'|'current'|'future';games:{id:number;homeId:number;awayId:number;status:string}[]};
export type FdrCalendar={teams:FdrTeam[];rounds:FdrRound[];capturedAt:string};
export type FdrMode='overall'|'attack'|'defense';
export type FdrResult={xg:number;xga:number;attack:number;defense:number;overall:number;ownAttackIndex:number;ownDefenseIndex:number;opponentAttackIndex:number;opponentDefenseIndex:number;venueSamples:number};
const valid=(row:FdrRates|null|undefined):row is FdrRates=>!!row&&row.played>0&&Number.isFinite(row.xg)&&Number.isFinite(row.xga)&&row.xg>=0&&row.xga>=0;
const mean=(rows:FdrRates[],key:'xg'|'xga')=>rows.reduce((sum,row)=>sum+row[key]*row.played,0)/rows.reduce((sum,row)=>sum+row.played,0);
const opportunity=(signal:number)=>Math.max(0,Math.min(100,50+50*Math.tanh(signal/.55)));

// Scores describe matchup opportunity, not calibrated Fantasy points or win odds.
export function fixtureDifficulty(own:FdrTeam,opponent:FdrTeam,home:boolean,teams:FdrTeam[]):FdrResult|null {
  if(own.competitionId!==opponent.competitionId||!valid(own.overall)||!valid(opponent.overall))return null;
  const league=teams.filter(t=>t.competitionId===own.competitionId&&valid(t.overall));
  if(league.length<2)return null;
  const overall=league.map(t=>t.overall!);
  const mu=(mean(overall,'xg')+mean(overall,'xga'))/2;
  if(!(mu>0))return null;
  const homeRows=league.map(t=>t.home).filter(valid),awayRows=league.map(t=>t.away).filter(valid);
  // Use actual league venue rates; only fall back to neutral rates when no split is available.
  const muHome=homeRows.length?mean(homeRows,'xg'):mu;
  const muAway=awayRows.length?mean(awayRows,'xg'):mu;
  if(!(muHome>0&&muAway>0))return null;
  const smooth=(value:number,n:number,prior:number)=>(value*n+8*prior)/(n+8);
  const side=(team:FdrTeam,isHome:boolean)=>{
    const row=team.overall!;
    const attack=smooth(row.xg,row.played,mu),conceding=smooth(row.xga,row.played,mu);
    const split=isHome?team.home:team.away;
    const attackPrior=attack*(isHome?muHome:muAway)/mu;
    const defensePrior=conceding*(isHome?muAway:muHome)/mu;
    return {attack:valid(split)?smooth(split.xg,split.played,attackPrior):attackPrior,conceding:valid(split)?smooth(split.xga,split.played,defensePrior):defensePrior,attackIndex:100*attack/mu,defenseIndex:100*mu/conceding,n:valid(split)?split.played:0};
  };
  const a=side(own,home),b=side(opponent,!home);
  const xg=a.attack*b.conceding/(home?muHome:muAway);
  const xga=b.attack*a.conceding/(home?muAway:muHome);
  if(!(xg>0&&xga>0))return null;
  const attackSignal=Math.log(xg/mu),defenseSignal=Math.log(mu/xga);
  return {xg,xga,attack:opportunity(attackSignal),defense:opportunity(defenseSignal),overall:opportunity(.5*attackSignal+.5*defenseSignal),ownAttackIndex:a.attackIndex,ownDefenseIndex:a.defenseIndex,opponentAttackIndex:b.attackIndex,opponentDefenseIndex:b.defenseIndex,venueSamples:Math.min(a.n,b.n)};
}
export function difficultyBand(score:number|null) {
  if(score==null)return 0;
  return score>=70?1:score>=58?2:score>=42?3:score>=30?4:5;
}
const calendars=new Map<string,Promise<FdrCalendar>>();
export function loadFixtureCalendar(file:string) {
  let request=calendars.get(file);
  if(!request){request=fetch(new URL(file,document.baseURI)).then(async response=>{if(!response.ok)throw new Error('赛程矩阵加载失败，请重试或刷新页面');const result=await response.json() as FdrCalendar;if(!Array.isArray(result.teams)||!Array.isArray(result.rounds))throw new Error('赛程数据不完整');return result;}).catch(error=>{calendars.delete(file);throw error;});calendars.set(file,request);}
  return request;
}
