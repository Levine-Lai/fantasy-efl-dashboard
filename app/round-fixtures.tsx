import {useMemo,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {FilterSelect} from '@/components/ui/filter-select';
import {leagueOptions,includesLeague} from '@/lib/league-selection';
import {fixtureCounts} from '@/lib/round-view';
import type {RoundFixture} from '@/lib/dashboard-data';

const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',weekday:'short'});
const timeFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const leagues:Record<number,string>={10:'英冠',11:'英甲',12:'英乙'};
export function RoundFixtures({fixtures,roundName,updatedAt}:{fixtures:RoundFixture[];roundName:string;updatedAt:string}) {
  const [league,setLeague]=useState('ALL');
  const [doubleOnly,setDoubleOnly]=useState(false);
  const counts=useMemo(()=>fixtureCounts(fixtures),[fixtures]);
  const doubles=[...counts].filter(([,n])=>n>1);
  const groups=useMemo(()=>{
    const dates=new Map<string,RoundFixture[]>();
    for(const game of fixtures.filter(g=>includesLeague(league,g.competitionId)&&(!doubleOnly||!['postponed','cancelled'].includes(g.status)&&((counts.get(g.homeId)??0)>1||(counts.get(g.awayId)??0)>1))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id-b.id)){
      const date=dateFormat.format(new Date(game.date));dates.set(date,[...(dates.get(date)??[]),game]);
    }
    return [...dates];
  },[fixtures,league,doubleOnly,counts]);
  const names=new Map(fixtures.flatMap(g=>[[g.homeId,{name:g.homeName,logo:g.homeLogo}],[g.awayId,{name:g.awayName,logo:g.awayLogo}]] as const));
  const valid=fixtures.filter(g=>!['postponed','cancelled'].includes(g.status));
  return <section className="panel round-fixtures" id="fixtures">
    <div className="section-heading"><div><CalendarDays size={18}/><h2>{roundName} 赛程对阵</h2></div><span>{valid.length} 场 · 双赛 {doubles.length} 队</span></div>
    <div className="fixture-toolbar"><FilterSelect aria-label="赛程联赛" value={league} onValueChange={setLeague}>{leagueOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FilterSelect><button type="button" className="double-filter" aria-pressed={doubleOnly} onClick={()=>setDoubleOnly(!doubleOnly)}>只看双赛</button></div>
    <p className="fixture-guide">北京时间 · 左主右客 · <b>×2</b> 为本 GW 双赛，延期 / 取消不计入</p>
    {!!doubles.length&&<details className="double-teams"><summary>双赛球队 · {doubles.length} 队</summary><div>{doubles.map(([id,n])=><span key={id}><img src={names.get(id)?.logo} alt="" loading="lazy"/>{names.get(id)?.name}<b>×{n}</b></span>)}</div></details>}
    <div className="fixture-list" role="region" aria-label={roundName+' 赛程列表'} tabIndex={0}>
      {groups.map(([date,games])=><div className="fixture-day" key={date}><h3>{date}<small>{games.length} 场</small></h3>{games.map(game=>{
        const withdrawn=['postponed','cancelled'].includes(game.status),finished=game.status==='completed',live=['playing','live','inprogress'].includes(game.status);
        const status=withdrawn?(game.status==='postponed'?'延期':'取消'):finished?(game.finalized?'已结算':'待结算'):live?'进行中':'待赛';
        return <article className={'schedule-match'+(withdrawn?' fixture-withdrawn':'')} key={game.id}>
          <div className="fixture-side fixture-home" title={game.homeName}><span>{game.homeName}</span>{!withdrawn&&(counts.get(game.homeId)??0)>1&&<b className="double-badge">×{counts.get(game.homeId)}</b>}<img src={game.homeLogo} alt="" loading="lazy"/></div>
          <div className="fixture-center"><small>{leagues[game.competitionId]}</small><strong>{(finished||live)&&game.homeScore!=null&&game.awayScore!=null?`${game.homeScore} : ${game.awayScore}`:timeFormat.format(new Date(game.date))}</strong><small className={live?'fixture-live':''}>{status}</small></div>
          <div className="fixture-side fixture-away" title={game.awayName}><img src={game.awayLogo} alt="" loading="lazy"/>{!withdrawn&&(counts.get(game.awayId)??0)>1&&<b className="double-badge">×{counts.get(game.awayId)}</b>}<span>{game.awayName}</span></div>
        </article>;
      })}</div>)}
      {!groups.length&&<p className="stats-empty">{fixtures.length?'此筛选下暂无赛程':'官方尚未公布本 GW 赛程'}</p>}
    </div>
    <small className="fixture-updated">官方赛程 · 抓取于 {dateFormat.format(new Date(updatedAt))} {timeFormat.format(new Date(updatedAt))} · 每日更新，临场变更以官方为准</small>
  </section>;
}
