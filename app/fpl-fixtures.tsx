import { Fragment, useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { FilterSelect } from '../components/ui/filter-select';
import { ranking } from '../lib/player-profile';
import { fplTeamRows } from '../lib/fpl-data';
import type { FplData, FplFixture } from '../lib/fpl-data';
import { FplImage } from './fpl-tables';

const date=(value:string|null)=>value?new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(value)):'时间待定';
export function FplFixtures({data,gw}:{data:FplData;gw:number}) {
  const [query,setQuery]=useState(''),[doubleOnly,setDoubleOnly]=useState(false),[mode,setMode]=useState('overall'),[selected,setSelected]=useState<{fixture:FplFixture;team:number}|null>(null),[range,setRange]=useState('1');
  const teams=useMemo(()=>new Map(data.teams.map(t=>[t.id,t])),[data]);
  const performance=useMemo(()=>fplTeamRows(data,gw),[data,gw]);
  const columns=data.events.filter(e=>e.id>=gw).slice(0,Number(range));
  const band=(f:FplFixture,id:number)=>{
    if(mode==='overall')return (f.home===id?f.homeDifficulty:f.awayDifficulty)??0;
    const opponent=performance.find(t=>t.team.id===(f.home===id?f.away:f.home)),key=mode==='attack'?'concededGame':'goalsGame';
    const rank=ranking(opponent?.[key]??null,performance.map(r=>r[key]),mode==='attack');
    return rank?Math.min(5,Math.max(1,Math.floor(rank.percentile/20)+1)):0;
  };
  const matchesFor=(id:number,event:number)=>data.fixtures.filter(f=>f.event===event&&(f.home===id||f.away===id));
  const meanBand=(id:number)=>{const matches=columns.flatMap(e=>matchesFor(id,e.id)),values=matches.map(f=>band(f,id)).filter(n=>n>0);return values.length?values.reduce((s,n)=>s+n,0)/values.length:null;};
  const rows=data.teams.filter(t=>`${t.name} ${t.shortName}`.toLowerCase().includes(query.toLowerCase())&&(!doubleOnly||matchesFor(t.id,gw).length>1)).sort((a,b)=>(meanBand(a.id)??99)-(meanBand(b.id)??99)||a.name.localeCompare(b.name));
  function analysis(){
    if(!selected)return <div className="fdr-analysis-empty"><CalendarDays size={24}/><h3>对阵解析</h3></div>;
    const {fixture:f,team:id}=selected,own=teams.get(id),opponent=teams.get(f.home===id?f.away:f.home),a=performance.find(r=>r.team.id===id),b=performance.find(r=>r.team.id===opponent?.id);
    return <div className="fdr-detail"><div className="fdr-detail-heading"><strong>{own?.shortName} {f.started?`${f.home===id?f.homeScore:f.awayScore} : ${f.home===id?f.awayScore:f.homeScore}`:'VS'} {opponent?.shortName}</strong><button type="button" aria-label="关闭对阵解析" onClick={()=>setSelected(null)}><X size={16}/></button></div><p>{f.home===id?'主场':'客场'} · {date(f.date)} · 北京时间</p><div className="fpl-fixture-crests"><FplImage src={own?.logo??''} alt={own?.name??''} className="team-pick-logo"/><span>VS</span><FplImage src={opponent?.logo??''} alt={opponent?.name??''} className="team-pick-logo"/></div><div className="fdr-detail-scores">{[{label:'官方难度',value:f.home===id?f.homeDifficulty:f.awayDifficulty},{label:'本队进球 / 场',value:a?.goalsGame},{label:'本队失球 / 场',value:a?.concededGame},{label:'对手进球 / 场',value:b?.goalsGame},{label:'对手失球 / 场',value:b?.concededGame},{label:'对手零封率',value:b?.cleanRate}].map(m=><span key={m.label}><small>{m.label}</small><b>{m.value==null?'—':m.value.toFixed(m.label==='官方难度'?0:2)}{m.label.endsWith('率')&&m.value!=null?'%':''}</b></span>)}</div></div>;
  }
  return <section className="panel round-fixtures fdr-panel" id="fixtures"><div className="section-heading"><div><CalendarDays size={18}/><h2>GW{gw} · 球队与赛程</h2></div><span>{rows.length} 支球队</span></div><div className="fdr-toolbar"><FilterSelect aria-label="赛程联赛" value="PL" onValueChange={()=>{}}><option value="PL">英超</option></FilterSelect><label className="fdr-search"><input aria-label="搜索赛程球队" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} placeholder="搜索球队"/></label></div>
    <div className="fdr-controls"><div className="fdr-modes" role="group" aria-label="赛程着色方式">{[['overall','综合'],['attack','进攻'],['defense','防守']].map(([key,label])=><button type="button" key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</button>)}</div><button className="double-filter" aria-pressed={doubleOnly} onClick={()=>setDoubleOnly(v=>!v)}>本轮双赛</button><FilterSelect aria-label="赛程轮数" value={range} onValueChange={setRange}><option value="1">本轮</option><option value="6">未来6轮</option></FilterSelect></div><div className="fdr-legend">{['容易','较易','均衡','较难','困难'].map((name,i)=><span key={name}><i className={'fdr-band-'+(i+1)}/>{i+1} {name}</span>)}</div>
    <div className="fdr-workspace"><div className="fdr-list-pane"><div className="fdr-scroll" role="region" aria-label="FPL 赛程矩阵" tabIndex={0}><table className={`fdr-table ${range==='1'?'fdr-single':'fpl-multi-fixtures'}`}><thead><tr><th scope="col" className="fdr-team-col">球队 / 难度</th>{columns.map(e=><th scope="col" key={e.id}>{e.name} 对手</th>)}</tr></thead><tbody>{rows.map(t=><Fragment key={t.id}><tr><th scope="row" className="fdr-team-col"><FplImage src={t.logo} alt={t.name} className="stats-team-logo"/><span>{t.shortName}</span><b className="fdr-total-points">{meanBand(t.id)?.toFixed(1)??'—'}</b></th>{columns.map(e=>{const games=matchesFor(t.id,e.id);return <td key={e.id}>{games.length>1&&<small className="fdr-double-label">双赛</small>}<div className={'fdr-opponents'+(games.length>1?' fdr-double':'')}>{games.map(f=>{const opp=teams.get(f.home===t.id?f.away:f.home),rating=band(f,t.id);return <button type="button" key={f.id} className={'fdr-opponent fdr-band-'+rating} aria-pressed={selected?.fixture.id===f.id&&selected.team===t.id} aria-label={`${t.name}，${e.name}，${f.home===t.id?'主场':'客场'} ${opp?.name}`} onClick={()=>setSelected({fixture:f,team:t.id})}><span className="fdr-opponent-identity"><FplImage src={opp?.logo??''} alt="" className="fixture-logo"/><b>{range==='1'?opp?.name:opp?.shortName}</b></span><small className="fdr-venue">{f.home===t.id?'主场':'客场'} · {rating||'—'}</small><small>{f.started?`${f.homeScore??'—'} : ${f.awayScore??'—'}`:date(f.date)}</small></button>;})}{!games.length&&<span className="fdr-blank">轮空</span>}</div></td>;})}</tr>{selected?.team===t.id&&<tr className="fdr-inline-row"><td colSpan={columns.length+1}>{analysis()}</td></tr>}</Fragment>)}</tbody></table>{!rows.length&&<p className="stats-empty">没有符合条件的球队</p>}</div></div><aside className="fdr-analysis-pane" aria-label="对阵解析">{analysis()}</aside></div>
    {data.fixtures.some(f=>f.event==null)&&<details className="fdr-method"><summary>GW 待定赛程</summary>{data.fixtures.filter(f=>f.event==null).map(f=><p key={f.id}>{teams.get(f.home)?.name} — {teams.get(f.away)?.name} · {date(f.date)}</p>)}</details>}
    <details className="fdr-method"><summary>难度口径</summary><p>综合采用官方 FDR。进攻按对手已完赛场均失球，防守按对手已完赛场均进球在英超的百分位分为五档；1易、5难，缺失不评级。双赛逐场展示，汇总取平均。该分档描述对手已发生表现，不是预期得分或胜率。</p></details>
  </section>;
}
