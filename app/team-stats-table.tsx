import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { FilterSelect } from '@/components/ui/filter-select';
import { includesLeague, leagueOptions } from '@/lib/league-selection';
import { ranking, tint } from '@/lib/player-profile';
import type { TeamStat } from '@/lib/dashboard-data';
const columns = [
  {key:'played',label:'已赛'},
  {key:'fantasyPointsPerGame',label:'Fantasy 得分'},
  {key:'goalsPerGame',label:'进球'},
  {key:'goalsAgainstPerGame',label:'失球',lower:true},
  {key:'xgPerGame',label:'xG'},
  {key:'xgaPerGame',label:'xGA',lower:true},
  {key:'xgdPerGame',label:'xG 净差'},
  {key:'winRate',label:'胜率',percent:true},
  {key:'cleanSheetRate',label:'零封率',percent:true},
  {key:'pointsPerGame',label:'联赛积分'},
  {key:'xptsPerGame',label:'预期积分'},
] as const;
type Key=typeof columns[number]['key'];
export function TeamStatsTable({teams}:{teams:TeamStat[]}) {
  const [query,setQuery]=useState('');
  const [league,setLeague]=useState('ALL');
  const [sort,setSort]=useState<Key>('fantasyPointsPerGame');
  const [descending,setDescending]=useState(true);
  const rows=useMemo(()=>teams.filter(t=>includesLeague(league,t.competitionId) && `${t.name} ${t.fullName}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>{
    const av=a[sort],bv=b[sort];if(av==null)return bv==null?0:1;if(bv==null)return -1;
    return (descending?bv-av:av-bv)||a.name.localeCompare(b.name);
  }),[teams,query,league,sort,descending]);
  return <section className="panel stats-panel team-stats-panel" id="team-stats">
    <div className="section-heading wide-heading"><div><Trophy size={18}/><h2>球队场均数据</h2></div><span>Fantasy EFL / Statz</span></div>
    <div className="stats-toolbar"><label><span>搜索球队</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="球队名称"/></label><label><span>联赛级别</span><FilterSelect value={league} onValueChange={setLeague}>{leagueOptions.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</FilterSelect></label><span className="stats-count">{rows.length} 支球队</span></div>
    <p className="table-scroll-hint">左右滑动查看全部数据 · 球队列固定</p><div className="stats-scroll" role="region" aria-label="球队场均数据表，可横向滚动" tabIndex={0}><table className="stats-table">
      <thead><tr><th scope="col" className="stats-name-col">球队</th>{columns.map(c=><th key={c.key} scope="col" aria-sort={sort===c.key?(descending?'descending':'ascending'):'none'}><button type="button" onClick={()=>{setSort(c.key);setDescending(sort===c.key?!descending:true);}}>{c.label}<span>{sort===c.key?(descending?'↓':'↑'):'↕'}</span></button></th>)}</tr></thead>
      <tbody>{rows.map(t=><tr key={t.id}><th scope="row" className="stats-name-col"><span className="stats-player-link"><img className="stats-team-logo" src={t.logo} alt="" loading="lazy"/><strong>{t.name}</strong></span></th>{columns.map(c=>{
        const value=t[c.key];const result=value!=null && c.key!=='played'?ranking(value,teams.filter(p=>p.competitionId===t.competitionId).map(p=>p[c.key]),'lower' in c && c.lower):null;
        return <td key={c.key} style={{backgroundColor:tint(result?.percentile??null)}} title={result?`同联赛百分位 ${Math.round(result.percentile)}`:undefined}>{value==null?'—':c.key==='played'?value:value.toFixed('percent' in c?1:2)+('percent' in c?'%':'')}</td>;
      })}</tr>)}</tbody>
    </table>{!rows.length && <div className="stats-empty">没有符合条件的球队</div>}</div>
    <div className="stats-footer">除已赛、胜率和零封率外，均为每场平均；Fantasy 得分与联赛积分分开展示，联赛积分按胜3平1计算。官方仅含确认完赛，Statz 按其赛季已赛场数；缺失显示 —，不参与着色。</div>
  </section>;
}
