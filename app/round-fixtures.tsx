import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,X} from 'lucide-react';
import {FilterSelect} from '@/components/ui/filter-select';
import {leagueOptions,includesLeague} from '@/lib/league-selection';
import {difficultyBand,fixtureDifficulty,gameweekExpectedPoints,expectedTeamPoints,loadFixtureCalendar} from '@/lib/fixture-difficulty';
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
    return calendar.rounds.filter(r=>r.id===roundId);
  },[calendar,roundId]);
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
  const historical=columns[0]?.state==='completed';
  const opportunities=useMemo(()=>new Map((calendar?.teams??[]).map(team=>[team.id,historical?(columns[0]?.actualPoints?.[team.id]??null):gameweekExpectedPoints((matches.get(roundId)?.get(team.id)??[]).filter(game=>!game.past))])),[calendar,matches,roundId,historical,columns]);
  const teams=useMemo(()=>calendar?.teams.filter(t=>includesLeague(league,t.competitionId)&&`${t.name} ${t.fullName} ${t.abbreviation}`.toLowerCase().includes(query.trim().toLowerCase())&&(!doubleOnly||(matches.get(roundId)?.get(t.id)?.length??0)>1)).sort((a,b)=>{
    const av=opportunities.get(a.id),bv=opportunities.get(b.id);
    if(av==null)return bv==null?a.name.localeCompare(b.name):1;
    if(bv==null)return -1;
    return bv-av||a.name.localeCompare(b.name);
  })??[],[calendar,league,query,doubleOnly,matches,roundId,opportunities]);
  const hasFixtures=columns.some(r=>r.games.some(g=>!['postponed','cancelled'].includes(g.status)));
  return <section ref={root} className="panel round-fixtures fdr-panel" id="fixtures">
    <div className="section-heading"><div><CalendarDays size={18}/><h2>{roundName} · 球队选择与赛程</h2></div><span>{teams.length} 支球队</span></div>
    <div className="fdr-toolbar"><FilterSelect aria-label="赛程联赛" value={league} onValueChange={value=>{setLeague(value);setSelected(null);}}>{leagueOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FilterSelect><label className="fdr-search"><input aria-label="搜索赛程球队" placeholder="搜索球队" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}}/></label></div>
    <div className="fdr-controls"><div className="fdr-modes" role="group" aria-label="赛程着色方式">{modes.map(item=><button type="button" key={item.key} aria-pressed={mode===item.key} onClick={()=>setMode(item.key)}>{item.label}</button>)}</div><button type="button" className="double-filter" aria-pressed={doubleOnly} onClick={()=>{setDoubleOnly(!doubleOnly);setSelected(null);}}>本轮双赛</button></div>
    <div className="fdr-legend" aria-label="难度等级：1容易，5困难">{[1,2,3,4,5].map(band=><span key={band}><i className={'fdr-band-'+band}/>{band} {labels[band]}</span>)}</div>
    <p className="fixture-guide">{historical?'官方实际得分从高到低 · 双赛相加':'预期得分从高到低 · 双赛相加 · 仅预测剩余比赛'} · 轻点对手查看攻防依据</p>
    <div className="fdr-workspace"><div className="fdr-list-pane">
    {error?<div className="stats-empty" role="alert">{error}<button className="double-filter" type="button" onClick={()=>setRetry(n=>n+1)}>重试</button></div>:!calendar?<p className="stats-empty" role="status">正在加载赛程矩阵…</p>:!hasFixtures?<p className="stats-empty">官方尚未公布本 GW 的赛程</p>:<div className="fdr-scroll" role="region" aria-label="球队 FDR 赛程矩阵，可滚动" tabIndex={0}><table className="fdr-table fdr-single"><thead><tr><th scope="col" className="fdr-team-col">{historical?"实际得分":"预期得分"}</th>{columns.map(round=><th scope="col" key={round.id}>{round.name} 对手<small>{historical?"本轮对阵":"逐场预期得分 · 攻防难度"}</small></th>)}</tr></thead><tbody>{teams.map(team=><Fragment key={team.id}><tr><th scope="row" className="fdr-team-col" aria-label={team.fullName}><img src={team.logo} alt={team.fullName} title={team.fullName} loading="lazy"/><b className="fdr-total-points">{opportunities.get(team.id)?.toFixed(1)??'—'}</b><small>{historical?'实际得分':'预期得分'}</small></th>{columns.map(round=>{
      const games=matches.get(round.id)?.get(team.id)??[];
      return <td key={round.id}>{games.length>1&&<small className="fdr-double-label">{games.length===2?'双赛':games.length+'赛'}</small>}<div className={"fdr-opponents"+(games.length>1?" fdr-double":"")}>{games.map(game=>{
        const band=difficultyBand(game.result?.[mode]??null),active=selected?.id===game.id&&selected.own.id===team.id;
        return <button type="button" key={game.id} className={'fdr-opponent fdr-band-'+band} aria-pressed={active} aria-label={`${team.name}，${round.name}，${game.home?'主场迎战':'客场对阵'} ${game.opponent.name}，${labels[band]}`} title={`${game.opponent.fullName}（${game.home?'主':'客'}） · ${game.result?modes.find(m=>m.key===mode)?.label+'机会指数 '+game.result[mode].toFixed(0):game.past?'已赛无赛前快照':'指标缺失'}`} onClick={()=>setSelected(active?null:game)}><span className="fdr-opponent-identity"><img src={game.opponent.logo} alt="" loading="lazy"/><b>{game.opponent.name}</b></span><small className="fdr-venue">{game.home?'主场':'客场'} · {labels[band]}</small>{game.result?<><span className="fdr-match-points"><b>{expectedTeamPoints(game.result,game.home)!.total.toFixed(1)}</b><small>预期得分</small></span><span className="fdr-match-rates"><span><small>预期进球</small><b>{game.result.xg.toFixed(2)}</b></span><span><small>预期失球</small><b>{game.result.xga.toFixed(2)}</b></span></span><span className="fdr-match-signals"><small className={'fdr-band-'+difficultyBand(game.result.attack)}>攻 · {labels[difficultyBand(game.result.attack)]}</small><small className={'fdr-band-'+difficultyBand(game.result.defense)}>防 · {labels[difficultyBand(game.result.defense)]}</small></span></>:<small className="fdr-match-missing">{game.past?'已赛 · 无赛前快照':'攻防指标缺失'}</small>}</button>;
      })}{!games.length&&<span className="fdr-blank">{round.games.length?'轮空':'待公布'}</span>}</div></td>;
    })}</tr>{selected?.own.id===team.id&&<tr className="fdr-inline-row"><td colSpan={2}><MatchAnalysis match={selected} onClose={()=>setSelected(null)}/></td></tr>}</Fragment>)}</tbody></table>{!teams.length&&<p className="stats-empty">没有符合筛选的球队</p>}</div>}
    </div><aside className="fdr-analysis-pane" aria-label="对阵解析">{selected?<MatchAnalysis match={selected} onClose={()=>setSelected(null)}/>:<div className="fdr-analysis-empty"><CalendarDays size={24}/><h3>对阵解析</h3><p>点击左侧任意对手，在这里对照查看预期得分、胜率和攻防依据。</p><small>双赛逐场分析，总预期得分相加。<br/>绿色代表更有利的对阵。</small></div>}</aside></div>
    <details className="fdr-method"><summary>预期得分与攻防颜色如何计算</summary><p>根据下方对阵预期进球 / 失球建立独立泊松分布，计算胜、平、零封和至少进 2 球的概率。单场预期得分 = 5 × 胜率 + 3 × 平率 + 2 × 客胜率 + 2 × 零封率 + 2 × 至少进 2 球概率 + 2 × 至少进 4 球概率。本轮剩余比赛逐场相加；已完成 GW 显示官方实际得分。缺失攻防数据不估分。</p><p>使用 Statz 赛季 xG/场与 xGA/场，分别形成进攻指数和防守指数（联赛均值 = 100，越高越强）。先向同联赛均值收缩 8 场，再把主客场分项向总体实力及联赛主客场均值收缩 8 场；分项缺失时回到总体实力。</p><p>预期进球 λ进 = 己方进攻率 × 对手失球率 ÷ 对应主客场联赛进球均值；预期失球 λ失 = 对手进攻率 × 己方失球率 ÷ 对应均值。</p><p>进攻信号 = ln(λ进 / 联赛均值)，防守信号 = ln(联赛均值 / λ失)。综合信号两者各占 50%；机会指数 = 50 + 50 × tanh(信号 / 0.55)。指数 ≥70 / ≥58 / ≥42 / ≥30 / &lt;30 对应难度 1–5。</p><p>双赛预期得分相加；两场仍分别着色。已赛无赛前快照、缺失数据均灰色。颜色为当前样本的对阵机会，并非纯对手排名，也不是官方 FDR 或经过回测校准的胜率。模型尚未经过样本外回测校准；不考虑每队赛季最多选择次数及个人已用次数。</p></details>
    {calendar&&<small className="fixture-updated">Statz 抓取：{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(calendar.capturedAt))}（北京时间）· 每日更新 · <a href="https://statz.ai/competitions/championship/xg" target="_blank" rel="noreferrer">数据来源 ↗</a></small>}
  </section>;
}

function MatchAnalysis({match,onClose}:{match:Match;onClose:()=>void}) {
  const result=match.result,points=expectedTeamPoints(result,match.home);
  const breakdown=points?[
    {label:'获胜',probability:points.win,points:5*points.win},
    {label:'平局',probability:points.draw,points:3*points.draw},
    ...(!match.home?[{label:'客胜奖励',probability:points.win,points:2*points.win}]:[]),
    {label:'零封',probability:points.cleanSheet,points:2*points.cleanSheet},
    {label:'进球 ≥ 2',probability:points.twoGoals,points:2*points.twoGoals},
    {label:'进球 ≥ 4',probability:points.fourGoals,points:2*points.fourGoals},
  ]:[];
  return <div className="fdr-detail" aria-live="polite"><button type="button" aria-label="关闭攻防详情" onClick={onClose}><X size={16}/></button>
    <span className="fdr-analysis-eyebrow">{match.roundName} · {match.home?'主场':'客场'}</span>
    <strong className="fdr-analysis-title"><img src={match.own.logo} alt=""/>{match.own.name}<span>vs</span><img src={match.opponent.logo} alt=""/>{match.opponent.name}</strong>
    {result&&points?<>
      <div className="fdr-analysis-total"><span>单场预期得分</span><b>{points.total.toFixed(1)}</b></div>
      <div className="fdr-detail-scores">{modes.map(m=><span key={m.key} className={'fdr-band-'+difficultyBand(result[m.key])}>{m.label} · {labels[difficultyBand(result[m.key])]}<b>{result[m.key].toFixed(0)}</b></span>)}</div>
      <div className="fdr-analysis-rates"><span>预期进球<b>{result.xg.toFixed(2)}</b></span><span>预期失球<b>{result.xga.toFixed(2)}</b></span></div>
      <h4>预期得分构成</h4><div className="fdr-breakdown"><div className="fdr-breakdown-heading"><span>计分事件</span><span>概率</span><span>预期贡献</span></div>{breakdown.map(row=><div key={row.label}><span>{row.label}</span><span>{(row.probability*100).toFixed(0)}%</span><b>+{row.points.toFixed(2)}</b></div>)}</div>
      <h4>双方攻防实力</h4><div className="fdr-index-table"><div><span>指数</span><span>己方</span><span>对手</span></div><div><span>进攻</span><b>{result.ownAttackIndex.toFixed(0)}</b><b>{result.opponentAttackIndex.toFixed(0)}</b></div><div><span>防守</span><b>{result.ownDefenseIndex.toFixed(0)}</b><b>{result.opponentDefenseIndex.toFixed(0)}</b></div></div>
      <small>实力指数以联赛均值 100 为基准，越高越强。机会指数 0–100 为对阵有利程度，不是胜率。主客场最少样本 {result.venueSamples} 场，已收缩；预期贡献先相加再四舍五入。</small>
    </>:<p>{match.past?'已赛未保存赛前 xG 快照，保留对阵，不用当前数据回填历史预测。':'Statz 指标缺失，保留对阵，不强行估分。'}</p>}
  </div>;
}
