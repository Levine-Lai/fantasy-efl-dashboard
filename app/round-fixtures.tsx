import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,X} from 'lucide-react';
import {FilterSelect} from '@/components/ui/filter-select';
import {leagueOptions,includesLeague} from '@/lib/league-selection';
import {difficultyBand,fixtureDifficulty,loadFixtureCalendar} from '@/lib/fixture-difficulty';
import type {FdrCalendar,FdrMode,FdrResult,FdrTeam} from '@/lib/fixture-difficulty';

type Match={id:number;own:FdrTeam;opponent:FdrTeam;home:boolean;roundName:string;past:boolean;result:FdrResult|null};
const modes:{key:FdrMode;label:string}[]=[{key:'overall',label:'综合'},{key:'attack',label:'进攻'},{key:'defense',label:'防守'}];
const labels=['未评级','容易','较易','均衡','较难','困难'];
export function RoundFixtures({calendarFile,roundId,roundName}:{calendarFile?:string;roundId:number;roundName:string}) {
  const root=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(false);
  const [calendar,setCalendar]=useState<FdrCalendar|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [league,setLeague]=useState('ALL');
  const [query,setQuery]=useState('');
  const [doubleOnly,setDoubleOnly]=useState(false);
  const [horizon,setHorizon]=useState(3);
  const [mode,setMode]=useState<FdrMode>('overall');
  const [selected,setSelected]=useState<Match|null>(null);
  useEffect(()=>{
    if(!root.current||typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'250px'});
    observer.observe(root.current);return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible)return;
    let cancelled=false;setError('');
    if(!calendarFile){setError('赛程矩阵尚未生成，请刷新页面');return;}
    loadFixtureCalendar(calendarFile).then(value=>{if(!cancelled)setCalendar(value);}).catch(error=>{if(!cancelled)setError(error.message);});
    return ()=>{cancelled=true;};
  },[visible,calendarFile,retry]);
  useEffect(()=>{
    if(calendar&&location.hash==='#fixtures'&&root.current&&root.current.getBoundingClientRect().top>140)root.current.scrollIntoView({block:'start',behavior:'smooth'});
  },[calendar]);
  const columns=useMemo(()=>{
    if(!calendar)return [];
    const start=calendar.rounds.findIndex(r=>r.id===roundId);
    return start<0?[]:calendar.rounds.slice(start,start+horizon);
  },[calendar,roundId,horizon]);
  const matches=useMemo(()=>{
    const result=new Map<number,Map<number,Match[]>>();
    if(!calendar)return result;
    const teams=new Map(calendar.teams.map(t=>[t.id,t]));
    for(const round of columns){
      const rows=new Map<number,Match[]>();
      for(const game of round.games){
        if(['postponed','cancelled'].includes(game.status))continue;
        for(const home of [true,false]){
          const own=teams.get(home?game.homeId:game.awayId),opponent=teams.get(home?game.awayId:game.homeId);
          if(!own||!opponent)continue;
          const past=round.state==='completed'||game.status==='completed';
          const match={id:game.id,own,opponent,home,roundName:round.name,past,result:past?null:fixtureDifficulty(own,opponent,home,calendar.teams)};
          rows.set(own.id,[...(rows.get(own.id)??[]),match]);
        }
      }
      result.set(round.id,rows);
    }
    return result;
  },[calendar,columns]);
  const teams=useMemo(()=>calendar?.teams.filter(t=>includesLeague(league,t.competitionId)&&`${t.name} ${t.fullName} ${t.abbreviation}`.toLowerCase().includes(query.trim().toLowerCase())&&(!doubleOnly||(matches.get(roundId)?.get(t.id)?.length??0)>1)).sort((a,b)=>a.name.localeCompare(b.name))??[],[calendar,league,query,doubleOnly,matches,roundId]);
  const hasFixtures=columns.some(r=>r.games.some(g=>!['postponed','cancelled'].includes(g.status)));
  return <section ref={root} className="panel round-fixtures fdr-panel" id="fixtures">
    <div className="section-heading"><div><CalendarDays size={18}/><h2>{roundName} 起 · 赛程难度</h2></div><span>{teams.length} 支球队</span></div>
    <div className="fdr-toolbar"><FilterSelect aria-label="赛程联赛" value={league} onValueChange={setLeague}>{leagueOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FilterSelect><label className="fdr-search"><input aria-label="搜索赛程球队" placeholder="搜索球队" value={query} onChange={e=>setQuery(e.target.value)}/></label><FilterSelect aria-label="展示轮数" value={horizon} onValueChange={value=>setHorizon(Number(value))}><option value={3}>3 轮</option><option value={5}>5 轮</option></FilterSelect></div>
    <div className="fdr-controls"><div className="fdr-modes" role="group" aria-label="赛程着色方式">{modes.map(item=><button type="button" key={item.key} aria-pressed={mode===item.key} onClick={()=>setMode(item.key)}>{item.label}</button>)}</div><button type="button" className="double-filter" aria-pressed={doubleOnly} onClick={()=>setDoubleOnly(!doubleOnly)}>本轮双赛</button></div>
    <div className="fdr-legend" aria-label="难度等级：1容易，5困难">{[1,2,3,4,5].map(band=><span key={band}><i className={'fdr-band-'+band}/>{band} {labels[band]}</span>)}</div>
    <p className="fixture-guide">主 / 客表示场地 · 双赛逐场着色 · 轻点对手查看攻防依据</p>
    {selected&&<div className="fdr-detail" aria-live="polite"><button type="button" aria-label="关闭攻防详情" onClick={()=>setSelected(null)}><X size={15}/></button><strong>{selected.own.name} → {selected.opponent.name}（{selected.home?'主':'客'}）<small>{selected.roundName}</small></strong>{selected.result?<><div className="fdr-detail-scores">{modes.map(m=><span key={m.key} className={'fdr-band-'+difficultyBand(selected.result![m.key])}>{m.label} {labels[difficultyBand(selected.result![m.key])]}<b>{selected.result![m.key].toFixed(0)}</b></span>)}</div><p>模型预期进球 <b>{selected.result.xg.toFixed(2)}</b> · 预期失球 <b>{selected.result.xga.toFixed(2)}</b></p><p>己方进攻 / 防守指数 <b>{selected.result.ownAttackIndex.toFixed(0)} / {selected.result.ownDefenseIndex.toFixed(0)}</b><br/>对手进攻 / 防守指数 <b>{selected.result.opponentAttackIndex.toFixed(0)} / {selected.result.opponentDefenseIndex.toFixed(0)}</b><br/>联赛均值 = 100；两个指数均为越高越强</p><small>机会指数 0–100，越高越有利；不是胜率或百分位。主客场最少样本 {selected.result.venueSamples} 场，已做收缩。</small></>:<p>{selected.past?'已赛未保存赛前 xG 快照，保留对阵，不用当前数据回填历史难度。':'Statz 指标缺失，保留对阵，不强行评级。'}</p>}</div>}
    {error?<div className="stats-empty" role="alert">{error}<button className="double-filter" type="button" onClick={()=>setRetry(n=>n+1)}>重试</button></div>:!calendar?<p className="stats-empty" role="status">正在加载赛程矩阵…</p>:!hasFixtures?<p className="stats-empty">官方尚未公布这几轮的赛程</p>:<div className="fdr-scroll" role="region" aria-label="球队 FDR 赛程矩阵，可滚动" tabIndex={0}><table className={'fdr-table'+(horizon===5?' fdr-five':'')}><thead><tr><th scope="col" className="fdr-team-col">球队</th>{columns.map(round=><th scope="col" key={round.id}>{round.name}{round.id===roundId&&<small>所选轮次</small>}</th>)}</tr></thead><tbody>{teams.map(team=><tr key={team.id}><th scope="row" className="fdr-team-col"><img src={team.logo} alt="" loading="lazy"/><span title={team.fullName}>{team.name}</span></th>{columns.map(round=>{
      const games=matches.get(round.id)?.get(team.id)??[];
      return <td key={round.id}>{games.length>1&&<small className="fdr-double-label">{games.length===2?'双赛':games.length+'赛'}</small>}<div className="fdr-opponents">{games.map(game=>{
        const band=difficultyBand(game.result?.[mode]??null),active=selected?.id===game.id&&selected.own.id===team.id;
        return <button type="button" key={game.id} className={'fdr-opponent fdr-band-'+band} aria-pressed={active} aria-label={`${team.name}，${round.name}，${game.home?'主场迎战':'客场对阵'} ${game.opponent.name}，${labels[band]}`} title={`${game.opponent.fullName}（${game.home?'主':'客'}） · ${game.result?modes.find(m=>m.key===mode)?.label+'机会指数 '+game.result[mode].toFixed(0):game.past?'已赛无赛前快照':'指标缺失'}`} onClick={()=>setSelected(game)}><span><img src={game.opponent.logo} alt="" loading="lazy"/><b>{game.opponent.abbreviation}</b></span><small>{game.home?'主':'客'}{band>0?' · '+band:game.past?' · 已赛':' · —'}</small></button>;
      })}{!games.length&&<span className="fdr-blank">{round.games.length?'轮空':'待公布'}</span>}</div></td>;
    })}</tr>)}</tbody></table>{!teams.length&&<p className="stats-empty">没有符合筛选的球队</p>}</div>}
    <details className="fdr-method"><summary>攻防难度如何计算</summary><p>使用 Statz 赛季 xG/场与 xGA/场，分别形成进攻指数和防守指数（联赛均值 = 100，越高越强）。先向同联赛均值收缩 8 场，再把主客场分项向总体实力及联赛主客场均值收缩 8 场；分项缺失时回到总体实力。</p><p>预期进球 λ进 = 己方进攻率 × 对手失球率 ÷ 对应主客场联赛进球均值；预期失球 λ失 = 对手进攻率 × 己方失球率 ÷ 对应均值。</p><p>进攻信号 = ln(λ进 / 联赛均值)，防守信号 = ln(联赛均值 / λ失)。综合信号两者各占 50%；机会指数 = 50 + 50 × tanh(信号 / 0.55)。指数 ≥70 / ≥58 / ≥42 / ≥30 / &lt;30 对应难度 1–5。</p><p>不把双赛数量当作容易程度；两场分别着色。已赛无赛前快照、缺失数据均灰色。颜色为当前样本的对阵机会，并非纯对手排名，也不是官方 FDR 或经过回测校准的胜率。场均动作分与球员出场概率未纳入。</p></details>
    {calendar&&<small className="fixture-updated">Statz 抓取：{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(calendar.capturedAt))}（北京时间）· 每日更新 · <a href="https://statz.ai/competitions/championship/xg" target="_blank" rel="noreferrer">数据来源 ↗</a></small>}
  </section>;
}
