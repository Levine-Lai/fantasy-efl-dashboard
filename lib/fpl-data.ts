export type FplPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type FplMatch = { fixture: number; round: number; date: string; opponent: number; home: boolean; minutes: number; points: number; goals: number; assists: number; cleanSheets: number; conceded: number; saves: number; bonus: number; bps: number; xg: number | null; xa: number | null; xgi: number | null; cbi: number | null; tackles: number | null; recoveries: number | null; defensive: number | null; starts: number; yellowCards?: number | null; redCards?: number | null };
export type FplPlayer = { id: number; name: string; fullName: string; team: number; position: FplPosition; price: number; ownership: number | null; transfersIn: number; transfersOut: number; priceChange: number; status: string; news: string; newsAt: string | null; chance: number | null; epNext: number | null; epThis: number | null; setPieces: { penalties: number | null; corners: number | null; freeKicks: number | null }; history: FplMatch[] };
export type FplTeam = { id: number; name: string; shortName: string; logo: string; jerseyUrl?: string; keeperJerseyUrl?: string };
export type FplFixture = { id: number; event: number | null; date: string | null; home: number; away: number; homeScore: number | null; awayScore: number | null; finished: boolean; provisional: boolean; started: boolean; homeDifficulty: number | null; awayDifficulty: number | null };
export type FplEvent = { id: number; name: string; deadline: string; finished: boolean; checked: boolean; current: boolean; next: boolean };
export type FplData = { schemaVersion: number; season: string; capturedAt: string; historyCapturedAt: string; stale: boolean; warning: string | null; currentEvent: number; players: FplPlayer[]; teams: FplTeam[]; fixtures: FplFixture[]; events: FplEvent[]; rules: { budget: number; squadSize: number; starters: number; teamLimit: number }; scoring: Record<string, unknown> };

export const fplPositionNames: Record<FplPosition, string> = { GK: '门将', DEF: '后卫', MID: '中场', FWD: '前锋' };
export type FplMetric = { key: string; label: string; lower?: boolean; format?: 'money' | 'percent'; value: (p: FplPlayer, matches: FplMatch[]) => number | null };
export const total = (rows: FplMatch[], key: keyof FplMatch): number | null => rows.length && rows.every(r => typeof r[key] === 'number' && Number.isFinite(r[key])) ? rows.reduce((s, r) => s + Number(r[key]), 0) : null;
const rate = (rows: FplMatch[], key: keyof FplMatch, per90 = false) => {
  const value = total(rows, key), denominator = per90 ? total(rows, 'minutes') : rows.length;
  return value == null || !denominator ? null : value * (per90 ? 90 : 1) / denominator;
};
export const fplMetrics: FplMetric[] = [
  { key: 'points', label: 'Fantasy 总分', value: (_, r) => total(r, 'points') },
  { key: 'ppg', label: 'Fantasy 得分 / 场', value: (_, r) => rate(r, 'points') },
  { key: 'points90', label: 'Fantasy 得分 / 90', value: (_, r) => rate(r, 'points', true) },
  { key: 'minutes', label: '出场分钟', value: (_, r) => total(r, 'minutes') },
  { key: 'minutesGame', label: '分钟 / 场', value: (_, r) => rate(r, 'minutes') },
  { key: 'goals', label: '进球 / 90', value: (_, r) => rate(r, 'goals', true) },
  { key: 'assists', label: '助攻 / 90', value: (_, r) => rate(r, 'assists', true) },
  { key: 'xg', label: 'xG / 90', value: (_, r) => rate(r, 'xg', true) },
  { key: 'xa', label: 'xA / 90', value: (_, r) => rate(r, 'xa', true) },
  { key: 'xgi', label: 'xGI / 90', value: (_, r) => rate(r, 'xgi', true) },
  { key: 'bonus', label: 'Bonus / 场', value: (_, r) => rate(r, 'bonus') },
  { key: 'bps', label: 'BPS / 场', value: (_, r) => rate(r, 'bps') },
  { key: 'defensive', label: '防守贡献次数 / 场', value: (p, r) => p.position === 'GK' ? null : rate(r, 'defensive') },
  { key: 'dcRate', label: '防守贡献达标率', format: 'percent', value: (p, r) => p.position === 'GK' || !r.length || r.some(m => m.defensive == null) ? null : 100 * r.filter(m => m.defensive! >= (p.position === 'DEF' ? 10 : 12)).length / r.length },
  { key: 'clean', label: '零封场次占比', format: 'percent', value: (_, r) => { const n = rate(r, 'cleanSheets'); return n == null ? null : n * 100; } },
  { key: 'conceded', label: '在场失球 / 90', lower: true, value: (_, r) => rate(r, 'conceded', true) },
  { key: 'saves', label: '扑救 / 90', value: (p, r) => p.position === 'GK' ? rate(r, 'saves', true) : null },
  { key: 'price', label: '当前价格 £m', format: 'money', value: p => p.price },
  { key: 'ownership', label: '当前持有率', format: 'percent', value: p => p.ownership },
  { key: 'transfersIn', label: '当前轮转入', value: p => p.transfersIn },
  { key: 'transfersOut', label: '当前轮转出', value: p => p.transfersOut },
  { key: 'transfersNet', label: '当前轮净转入', value: p => p.transfersIn - p.transfersOut },
  { key: 'priceChange', label: '开季至今价格变化 £m', value: p => p.priceChange },
  { key: 'value', label: '场均得分 / 当前£m', value: (p, r) => { const n = rate(r, 'points'); return n == null || p.price <= 0 ? null : n / p.price; } },
];
export function matchSample(player: FplPlayer, through: number, recent = 0): FplMatch[] {
  const rows = player.history.filter(m => m.round <= through && m.minutes > 0).sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.fixture - b.fixture);
  return recent > 0 ? rows.slice(-recent) : rows;
}
export function formatFpl(value: number | null, metric?: FplMetric): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return metric?.format === 'money' ? `£${value.toFixed(1)}m` : `${value.toFixed(metric?.format === 'percent' ? 1 : 2)}${metric?.format === 'percent' ? '%' : ''}`;
}

const teamMatchKeys = ['xg','points','assists','saves','tackles','cbi','recoveries','yellowCards','redCards'] as const;
type TeamMatchKey = typeof teamMatchKeys[number];
type TeamMatchStats = Record<TeamMatchKey, number | null> & { starters:number; valid:boolean };
const fixtureStatsCache = new WeakMap<FplData, Map<string,TeamMatchStats>>();
function fplFixtureTeamStats(data:FplData) {
  const cached=fixtureStatsCache.get(data);if(cached)return cached;
  const fixtures=new Map(data.fixtures.map(f=>[f.id,f])),result=new Map<string,TeamMatchStats>(),seen=new Set<string>();
  for(const p of data.players)for(const h of p.history){
    const f=fixtures.get(h.fixture);if(!f?.finished)continue;
    const team=h.home?f.home:f.away,key=`${f.id}:${team}`;
    const stats=result.get(key)??{...Object.fromEntries(teamMatchKeys.map(k=>[k,0])),starters:0,valid:true} as TeamMatchStats;
    result.set(key,stats);
    const identity=`${p.id}:${f.id}`;
    if(seen.has(identity)||h.opponent!==(h.home?f.away:f.home)||!Number.isFinite(h.minutes)||h.minutes<0){stats.valid=false;continue;}
    seen.add(identity);
    if(h.minutes>0){if(h.starts!==0&&h.starts!==1)stats.valid=false;stats.starters+=h.starts;}
    for(const k of teamMatchKeys){
      // Bench cards and their points count; unused players contribute no match actions.
      if(h.minutes===0&&!['points','yellowCards','redCards'].includes(k))continue;
      const value=h[k];stats[k]=stats[k]!=null&&typeof value==='number'&&Number.isFinite(value)?stats[k]!+value:null;
    }
  }
  fixtureStatsCache.set(data,result);return result;
}

// Retrospective independent-Poisson model: three points for a win, one for a draw.
export function fplExpectedLeaguePoints(xg:number|null,xga:number|null):number|null {
  if(xg==null||xga==null||![xg,xga].every(v=>Number.isFinite(v)&&v>=0))return null;
  const pmf=(lambda:number)=>{const values=[Math.exp(-lambda)];let mass=values[0];for(let k=1;k<200&&(k<lambda||1-mass>1e-12);k++){values.push(values[k-1]*lambda/k);mass+=values[k];}return mass>1-1e-9?values:null;};
  const a=pmf(xg),b=pmf(xga);if(!a||!b)return null;
  let win=0,draw=0,below=0;
  for(let i=0;i<a.length;i++){win+=a[i]*below;draw+=a[i]*(b[i]??0);below+=b[i]??0;}
  return 3*win+draw;
}

type TeamCountKey = 'fantasyPoints'|'assists'|'saves'|'tackles'|'cbi'|'recoveries'|'yellowCards'|'redCards';
type TeamRateBase = TeamCountKey|'points'|'goals'|'conceded'|'goalDifference'|'xg'|'xga'|'xgd'|'xpts'|'pointsDelta'|'finishingDelta';
export type FplTeamRow = Record<TeamCountKey,number|null> & Record<`${TeamRateBase}Game`,number|null> & {
  team:FplTeam; played:number; minutes:number; wins:number; draws:number; losses:number; cleanSheets:number;
  points:number; goals:number; conceded:number; goalDifference:number;
  xg:number|null; xga:number|null; xgd:number|null; xgShare:number|null; xpts:number|null; pointsDelta:number|null; finishingDelta:number|null;
  winRate:number|null; cleanRate:number|null; form:string[];
};
export type FplTeamMetricKey = Exclude<keyof FplTeamRow,'team'|'form'>;
export type FplTeamMetric = {key:FplTeamMetricKey;label:string;rate?:FplTeamMetricKey;unit?:string;percent?:boolean;integer?:boolean;lower?:boolean;group:string};
export const fplTeamColumns:readonly FplTeamMetric[] = [
  {key:'played',label:'已赛',integer:true,group:'战绩'},
  {key:'fantasyPoints',rate:'fantasyPointsGame',label:'球员 Fantasy 得分',integer:true,group:'战绩'},
  {key:'goals',rate:'goalsGame',label:'进球',integer:true,group:'基础表现'},
  {key:'conceded',rate:'concededGame',label:'失球',integer:true,lower:true,group:'基础表现'},
  {key:'goalDifference',rate:'goalDifferenceGame',label:'净胜球',integer:true,group:'基础表现'},
  {key:'xg',rate:'xgGame',label:'预期进球 xG',group:'预期与效率'},
  {key:'xga',rate:'xgaGame',label:'预期失球 xGA',lower:true,group:'预期与效率'},
  {key:'xgd',rate:'xgdGame',label:'xG 净差',group:'预期与效率'},
  {key:'xgShare',label:'xG 占比',percent:true,group:'预期与效率'},
  {key:'winRate',label:'胜率',percent:true,group:'战绩'},
  {key:'cleanRate',label:'零封率',percent:true,group:'战绩'},
  {key:'points',rate:'pointsGame',unit:'场',label:'联赛积分',integer:true,group:'战绩'},
  {key:'xpts',rate:'xptsGame',unit:'场',label:'模型预期积分',group:'预期与效率'},
  {key:'pointsDelta',rate:'pointsDeltaGame',unit:'场',label:'积分超预期',group:'预期与效率'},
  {key:'finishingDelta',rate:'finishingDeltaGame',label:'进球超预期',group:'预期与效率'},
  {key:'wins',label:'胜',integer:true,group:'战绩'},
  {key:'draws',label:'平',integer:true,group:'战绩'},
  {key:'losses',label:'负',integer:true,lower:true,group:'战绩'},
  {key:'cleanSheets',label:'零封场次',integer:true,group:'战绩'},
  {key:'assists',rate:'assistsGame',label:'Fantasy 助攻',integer:true,group:'基础表现'},
  {key:'saves',rate:'savesGame',label:'扑救',integer:true,group:'基础表现'},
  {key:'tackles',rate:'tacklesGame',label:'抢断',integer:true,group:'基础表现'},
  {key:'cbi',rate:'cbiGame',label:'解围＋封堵＋拦截',integer:true,group:'基础表现'},
  {key:'recoveries',rate:'recoveriesGame',label:'回收球权',integer:true,group:'基础表现'},
  {key:'yellowCards',rate:'yellowCardsGame',label:'黄牌',integer:true,lower:true,group:'基础表现'},
  {key:'redCards',rate:'redCardsGame',label:'红牌',integer:true,lower:true,group:'基础表现'},
];

export function fplTeamRows(data:FplData,through:number,recent=0):FplTeamRow[] {
  const stats=fplFixtureTeamStats(data);
  return data.teams.map(team=>{
    let games=data.fixtures.filter(f=>f.finished&&f.event!=null&&f.event<=through&&(f.home===team.id||f.away===team.id)&&f.homeScore!=null&&f.awayScore!=null).sort((a,b)=>(a.date??'').localeCompare(b.date??'')||a.id-b.id);
    if(recent)games=games.slice(-recent);
    const own=games.map(f=>stats.get(`${f.id}:${team.id}`)),opponents=games.map(f=>stats.get(`${f.id}:${f.home===team.id?f.away:f.home}`));
    const complete=(row:TeamMatchStats|undefined)=>!!row&&row.valid&&row.starters===11;
    const sum=(rows:(TeamMatchStats|undefined)[],key:TeamMatchKey)=>rows.length&&rows.every(r=>complete(r)&&r![key]!=null)?rows.reduce((n,r)=>n+r![key]!,0):null;
    let goals=0,conceded=0,points=0,wins=0,draws=0,cleanSheets=0;
    const form=games.map(f=>{const gf=f.home===team.id?f.homeScore!:f.awayScore!,ga=f.home===team.id?f.awayScore!:f.homeScore!;goals+=gf;conceded+=ga;if(!ga)cleanSheets++;const result=gf>ga?'W':gf===ga?'D':'L';if(result==='W')wins++;if(result==='D')draws++;points+=result==='W'?3:result==='D'?1:0;return result;});
    const played=games.length,xg=sum(own,'xg'),xga=sum(opponents,'xg'),xgd=xg!=null&&xga!=null?xg-xga:null;
    const expectations=own.map((r,i)=>complete(r)&&complete(opponents[i])?fplExpectedLeaguePoints(r!.xg,opponents[i]!.xg):null);
    const xpts=played&&expectations.every(v=>v!=null)?expectations.reduce<number>((n,v)=>n+v!,0):null;
    const totals={points,goals,conceded,goalDifference:goals-conceded,xg,xga,xgd,xpts,pointsDelta:xpts!=null?points-xpts:null,finishingDelta:xg!=null?goals-xg:null,
      fantasyPoints:sum(own,'points'),assists:sum(own,'assists'),saves:sum(own,'saves'),tackles:sum(own,'tackles'),cbi:sum(own,'cbi'),recoveries:sum(own,'recoveries'),yellowCards:sum(own,'yellowCards'),redCards:sum(own,'redCards')};
    const rates=Object.fromEntries(Object.entries(totals).map(([key,value])=>[key+'Game',played&&value!=null?value/played:null])) as Record<`${TeamRateBase}Game`,number|null>;
    return {team,played,minutes:90*played,wins,draws,losses:played-wins-draws,cleanSheets,...totals,...rates,xgShare:xg!=null&&xga!=null&&xg+xga>0?100*xg/(xg+xga):null,winRate:played?100*wins/played:null,cleanRate:played?100*cleanSheets/played:null,form:form.slice(-5)};
  });
}
export type FplRankedPlayer = { player: FplPlayer; score: number; minutes: number | null; actual: boolean };
export function fplRankings(data: FplData, gw: number): FplRankedPlayer[] {
  const event = data.events.find(e => e.id === gw);
  const actual = !!event?.finished;
  return data.players.flatMap(player => {
    const matches = player.history.filter(m => m.round === gw);
    const score = actual ? matches.length ? matches.reduce((s, m) => s + m.points, 0) : null : event?.current ? player.epThis : event?.next ? player.epNext : null;
    if (score == null || !Number.isFinite(score) || !actual && ['i', 's', 'u', 'n'].includes(player.status)) return [];
    return [{ player, score, minutes: actual ? matches.reduce((s, m) => s + m.minutes, 0) : null, actual }];
  }).sort((a, b) => b.score - a.score || (b.minutes ?? 0) - (a.minutes ?? 0) || a.player.id - b.player.id);
}
export function fplReferenceXI(rows: FplRankedPlayer[], teamLimit = 3): FplRankedPlayer[] {
  let best: FplRankedPlayer[] = [], bestScore = -Infinity;
  for (const def of [3, 4, 5]) for (const mid of [2, 3, 4, 5]) {
    const fwd = 10 - def - mid;
    if (fwd < 1 || fwd > 3) continue;
    const limits = { GK: 1, DEF: def, MID: mid, FWD: fwd }, counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const clubs = new Map<number, number>(), selected: FplRankedPlayer[] = [];
    for (const row of rows) {
      const p = row.player;
      if (counts[p.position] >= limits[p.position] || (clubs.get(p.team) ?? 0) >= teamLimit) continue;
      selected.push(row); counts[p.position]++; clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1);
    }
    const sum = selected.reduce((s, r) => s + r.score, 0);
    if (selected.length === 11 && sum > bestScore) { best = selected; bestScore = sum; }
  }
  return best;
}
export function fplShirt(player: Pick<FplPlayer, 'position' | 'team'>, team?: FplTeam) { return (player.position === 'GK' ? team?.keeperJerseyUrl : team?.jerseyUrl) || team?.logo || ''; }
