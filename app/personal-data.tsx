import { useEffect, useMemo, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { FilterSelect } from '@/components/ui/filter-select';
import { includesLeague, leagueOptions } from '@/lib/league-selection';
import { profileMetrics, ranking, tint } from '@/lib/player-profile';
import type { PlayerStat } from '@/lib/dashboard-data';
const names={GK:'门将',DEF:'后卫',MID:'中场',FWD:'前锋'};
export function PersonalData({players,selectedId,onSelect,officialUpdatedAt,xgUpdatedAt}:{players:PlayerStat[];selectedId:number|null;onSelect:(id:number)=>void;officialUpdatedAt:string;xgUpdatedAt:string}) {
  const [league,setLeague]=useState('ALL');
  const [position,setPosition]=useState<PlayerStat['position']>('DEF');
  const [minimum,setMinimum]=useState(450);
  const selected=players.find(p=>p.id===selectedId);
  const activePosition=selected?.position ?? position;
  const [query,setQuery]=useState('');
  useEffect(()=>{if(selected){setLeague(current=>includesLeague(current,selected.competitionId)?current:String(selected.competitionId));setQuery('');}},[selected]);
  const choices=useMemo(()=>players.filter(p=>includesLeague(league,p.competitionId) && p.position===activePosition && `${p.fullName} ${p.team}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.fullName.localeCompare(b.fullName)),[players,league,activePosition,query]);
  const player=selected ?? choices.find(p=>p.fullName.includes('Fitzwater')) ?? choices[0];
  const peers=useMemo(()=>players.filter(p=>p.position===activePosition && includesLeague(league,p.competitionId) && Math.round(p.appearances*p.perGame.minutesPlayed)>=minimum),[players,activePosition,league,minimum]);
  const rows=useMemo(()=>player?profileMetrics[activePosition].map(metric=>{
    const eligible=(p:PlayerStat)=>metric.source==='advanced' ? (p.advanced?.mins ?? 0)>=minimum : metric.source==='xg' ? (p.xgMinutes ?? 0)>=minimum : Math.round(p.appearances*p.perGame.minutesPlayed)>=minimum;
    const value=metric.value(player);
    return {metric,value,result:eligible(player) && includesLeague(league,player.competitionId)?ranking(value,players.filter(p=>p.position===activePosition && includesLeague(league,p.competitionId) && eligible(p)).map(metric.value),metric.lower):null};
  }):[],[player,activePosition,minimum,players,league]);
  return <section className="panel personal-panel" id="personal">
    <div className="section-heading wide-heading"><div><Crosshair size={18}/><h2>个人数据</h2></div><span>同位置百分位 · 历史表现</span></div>
    <div className="personal-filters">
      <label><span>比较联赛</span><FilterSelect value={league} onValueChange={v=>{setLeague(v);if(player && !includesLeague(v,player.competitionId)){const next=players.find(p=>p.position===activePosition && includesLeague(v,p.competitionId));if(next)onSelect(next.id);}setQuery('');}}>{leagueOptions.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</FilterSelect></label>
      <label><span>位置</span><FilterSelect value={activePosition} onValueChange={v=>{setPosition(v as PlayerStat['position']);const next=players.find(p=>p.position===v && includesLeague(league,p.competitionId));if(next)onSelect(next.id);setQuery('');}}>{Object.entries(names).map(([key,name])=><option key={key} value={key}>{name}</option>)}</FilterSelect></label>
      <label><span>搜索球员</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="球员或球队"/></label>
      <label className="personal-select"><span>选择球员</span><FilterSelect value={String(player?.id ?? '')} onValueChange={v=>onSelect(Number(v))}>{player && !choices.some(p=>p.id===player.id) && <option value={String(player.id)} data-group="当前球员">{player.fullName} · {player.team}</option>}{choices.map(p=><option key={p.id} value={String(p.id)} data-group={query?'搜索结果':undefined}>{p.fullName} · {p.team}</option>)}</FilterSelect></label>
      <label><span>比较样本门槛</span><FilterSelect value={String(minimum)} onValueChange={v=>setMinimum(Number(v))}><option value="450">450 分钟</option><option value="900">900 分钟</option></FilterSelect></label>
    </div>
    {player?<><div className="personal-identity"><img src={player.teamLogo} alt={`${player.team} 队徽`} loading="lazy"/><div><h3>{player.fullName}</h3><p>{player.team} · {names[player.position]} · {player.appearances} 场</p></div><div className="personal-sample"><b>{peers.length}</b><span>官方同位置样本</span></div></div>
      <div className="personal-scale"><span>指标</span><div><span>较弱</span><span>中位</span><span>较强</span></div><span>数值 / 排名</span></div>
      <div className="profile-metrics">{rows.map(({metric,value,result})=><div className="profile-metric" key={metric.key}>
        <div className="profile-label"><strong>{metric.label}</strong><small>{metric.source==='official'?'Fantasy EFL':metric.source==='xg'?'Statz · xG':'Statz'}{metric.lower?' · 越低越好':''}</small></div>
        <div className="percentile-track" role={result?'meter':undefined} aria-label={`${metric.label}百分位`} aria-valuemin={result?0:undefined} aria-valuemax={result?100:undefined} aria-valuenow={result?Math.round(result.percentile):undefined}><div className="percentile-fill" style={{width:`${result?.percentile ?? 0}%`,background:tint(result?.percentile ?? null)}}/>{result?<span className="percentile-marker" style={{left:`${Math.max(3,Math.min(97,result.percentile))}%`,background:tint(result.percentile)}}>{Math.round(result.percentile)}</span>:<span className="percentile-unavailable">{value==null?'暂无数据':'未达到比较门槛'}</span>}</div>
        <div className="profile-value"><strong>{value==null?'—':value.toFixed(metric.percent?1:2)+(metric.percent?'%':'')}</strong><small>{result?`${result.rank} / ${result.n}`:'不参与排名'}</small></div>
      </div>)}</div>
      <p className="profile-note">按所选联赛同位置比较；并列同名次。每项排除缺失值和零分母，零封率按出场次数，扑救率 = 扑救 ÷（扑救＋失球）。动作次数也受球队打法影响。表格中的展示零值不会填充第三方缺失值。</p>
      <p className="profile-note">官方统计抓取：{officialUpdatedAt.slice(0,16).replace('T',' ')} UTC · xG 抓取：{xgUpdatedAt.slice(0,16).replace('T',' ')} UTC{player.advanced?` · 扩展统计抓取：${player.advanced.updatedAt.slice(0,16).replace('T',' ')} UTC`:''} · <a href="https://statz.ai/competitions/league-two/stats/players?group=defending" target="_blank" rel="noreferrer">Statz 数据来源 ↗</a></p>
    </>:<p className="stats-empty">没有符合条件的球员</p>}
  </section>;
}
