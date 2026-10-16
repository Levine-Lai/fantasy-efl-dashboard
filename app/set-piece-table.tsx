import {useState} from 'react';
import {Crosshair} from 'lucide-react';
import {FilterSelect} from '@/components/ui/filter-select';
import type {SetPieces} from '@/lib/dashboard-data';
export function SetPieceTable({data}:{data:SetPieces}){
 const [league,setLeague]=useState('10');
 const teams=data.teams.filter(t=>t.competitionId===Number(league)).sort((a,b)=>a.name.localeCompare(b.name));
 const date=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(new Date(value));
 return <section className="panel stats-panel set-piece-panel" id="set-pieces"><div className="section-heading wide-heading"><div><Crosshair size={18}/><h2>球队定位球主罚</h2></div><FilterSelect aria-label="定位球联赛" value={league} onValueChange={setLeague}><option value="10">英冠</option><option value="11">英甲</option><option value="12">英乙</option></FilterSelect></div>
 <p className="set-piece-note">点球为 Statz 本赛季实际主罚记录，不能据此确定下一次首选；角球及任意球为 EFL 官方参考名单，存在旧赛季内容，均待核验。按当前球队级别展示；此表为最新资料，不回填历史 GW。</p>
 <div className="stats-scroll" role="region" aria-label="球队定位球主罚表，可横向滚动" tabIndex={0}><table className="stats-table set-piece-table"><thead><tr><th scope="col" className="stats-name-col">球队</th><th scope="col">点球</th><th scope="col">任意球</th><th scope="col">角球</th></tr></thead><tbody>{teams.map(team=><tr key={team.id}><th scope="row" className="stats-name-col"><span className="stats-player-link"><img className="stats-team-logo" src={team.logo} alt="" loading="lazy"/><strong>{team.name}</strong></span></th><td>{team.penalties.length?<><span className="set-piece-status">本赛季实罚</span>{team.penalties.map(p=><div className="set-piece-player" key={p.name}><strong>{p.name}</strong><small>{p.taken} 次{p.scored!=null?` · 罚进 ${p.scored}`:''}</small></div>)}</>:<span>暂无实际主罚记录</span>}{team.penaltyReference&&<small className="set-piece-reference">官方参考 · 待核验：{team.penaltyReference}</small>}</td><td><span className="set-piece-status reference">参考 · 待核验</span><p>{team.freeKicks||'暂无可靠名单'}</p>{team.source&&<a href={team.source} target="_blank" rel="noreferrer">EFL 来源 ↗</a>}</td><td><span className="set-piece-status reference">参考 · 待核验</span><p>{team.corners||'暂无可靠名单'}</p></td></tr>)}</tbody></table></div>
 <div className="stats-footer">{teams.length} 支球队 · 点球记录抓取 {date(data.penaltyCapturedAt)} · 官方参考抓取 {date(data.capturedAt)}（抓取日期不等于名单更新日期） · <a href={`https://statz.ai/competitions/${league==='10'?'championship':league==='11'?'league-one':'league-two'}/stats/players?group=attacking`} target="_blank" rel="noreferrer">点球数据来源 ↗</a></div></section>;
}
