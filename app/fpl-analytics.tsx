import { useMemo, useRef, useState } from 'react';
import { ChartScatter, Download } from 'lucide-react';
import { FilterSelect } from '../components/ui/filter-select';
import { chartDomain, formatChartTick } from '../lib/chart-scale';
import { exportChartPng } from '../lib/export-chart';
import { fplMetrics, fplPositionNames, fplShirt, fplTeamRows, fplTeamColumns, matchSample, total } from '../lib/fpl-data';
import type { FplData, FplPosition, FplTeamRow } from '../lib/fpl-data';

export const teamMetrics = fplTeamColumns.flatMap(m=>[
  {key:m.key,label:m.label+(m.percent?' · %':''),lower:!!m.lower,group:m.group},
  ...(m.rate?[{key:m.rate,label:m.label+' / '+(m.unit??'90'),lower:!!m.lower,group:m.group}]:[]),
]);

type Dot = { id: string; name: string; image: string; x: number; y: number; subtitle: string; detail: string };
export function FplAnalytics({ data, gw }: { data: FplData; gw: number }) {
  const [mode, setMode] = useState<'player' | 'team'>('team');
  const [position, setPosition] = useState('ATT'), [minimum, setMinimum] = useState(450), [period, setPeriod] = useState('ALL');
  const [xKey, setXKey] = useState('goalsGame'), [yKey, setYKey] = useState('concededGame');
  const [hovered, setHovered] = useState<string | null>(null), [pinned, setPinned] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false), [message, setMessage] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const teams = useMemo(() => new Map(data.teams.map(t => [t.id, t])), [data]);
  const recent = period === 'ALL' ? 0 : Number(period), periodLabel = recent ? `最近 ${recent} 场` : '全部';
  const teamRows = useMemo(() => fplTeamRows(data, gw, recent), [data, gw, recent]);
  const playerRows = useMemo(() => data.players.filter(p => (position === 'ALL' || position === 'ATT' && ['MID', 'FWD'].includes(p.position) || p.position === position) && (total(matchSample(p, gw), 'minutes') ?? 0) >= minimum).map(player => ({player, matches:matchSample(player,gw,recent)})).filter(r=>r.matches.length), [data, gw, recent, position, minimum]);
  const playerMetrics = fplMetrics.filter(m => position === 'GK' ? !['goals','assists','xg','xa','xgi','defensive','dcRate'].includes(m.key) : m.key !== 'saves');
  const metrics = mode === 'team' ? teamMetrics : playerMetrics.map(m=>({...m,group:m.source?'补充数据':['price','ownership','transfersIn','transfersOut','transfersNet','priceChange','value'].includes(m.key)?'价格与热度':m.key.startsWith('x')?'预期与效率':'基础表现'}));
  const activeX = metrics.find(m => m.key === xKey) ?? metrics[0], activeY = metrics.find(m => m.key === yKey) ?? metrics[1];
  const lower = (key: string) => mode==='team'?!!teamMetrics.find(m=>m.key===key)?.lower:!!fplMetrics.find(m=>m.key===key)?.lower;
  const dots: Dot[] = mode === 'team' ? teamRows.flatMap(row => {
    const a = row[activeX.key as keyof FplTeamRow], b = row[activeY.key as keyof FplTeamRow];
    if (typeof a !== 'number' || typeof b !== 'number' || !row.played) return [];
    return [{id:`team-${row.team.id}`,name:row.team.name,image:row.team.logo,x:a,y:b,subtitle:`英超 · ${row.played} 场`,detail:`${activeX.label} ${a.toFixed(2)} · ${activeY.label} ${b.toFixed(2)}`}];
  }) : playerRows.flatMap(({player:p,matches})=>{
    const a = fplMetrics.find(m=>m.key===activeX.key)!.value(p,matches), b = fplMetrics.find(m=>m.key===activeY.key)!.value(p,matches);
    if(a==null || b==null || !Number.isFinite(a)||!Number.isFinite(b))return [];
    return [{id:`player-${p.id}`,name:p.name,image:fplShirt(p,teams.get(p.team)),x:a,y:b,subtitle:`${teams.get(p.team)?.name} · ${matches.length} 场`,detail:`${activeX.label} ${a.toFixed(2)} · ${activeY.label} ${b.toFixed(2)}`}];
  });
  const comparison = activeX.key==='xg' && activeY.key==='goals' || mode==='team' && activeX.key==='xgGame' && activeY.key==='goalsGame';
  const dx=chartDomain(comparison?dots.flatMap(d=>[d.x,d.y]):dots.map(d=>d.x)),dy=comparison?dx:chartDomain(dots.map(d=>d.y));
  const left=92,top=68,size=654,right=746,bottom=722,radius=16;
  const x=(v:number)=>left+(lower(activeX.key)?1-(v-dx[0])/(dx[1]-dx[0]):(v-dx[0])/(dx[1]-dx[0]))*size;
  const y=(v:number)=>lower(activeY.key)?top+(v-dy[0])/(dy[1]-dy[0])*size:bottom-(v-dy[0])/(dy[1]-dy[0])*size;
  const labels:{id:string;name:string;x:number;y:number;box:{x:number;y:number;width:number;height:number}}[]=[];
  for(const d of [...dots].sort((a,b)=>(b.x+b.y)-(a.x+a.y))) {
    if(labels.length>=(mode==='team'?35:28))break;
    const width=Math.min(170,Math.max(48,d.name.length*7)),px=x(d.x),py=y(d.y);
    for(const box of [{x:px+23,y:py-19},{x:px-width-23,y:py-19},{x:px+23,y:py+5},{x:px-width-23,y:py+5}].map(b=>({...b,width,height:18}))) {
      if(box.x<left||box.y<top||box.x+width>right||box.y+18>bottom)continue;
      if(labels.some(l=>box.x<l.box.x+l.box.width+5&&box.x+width+5>l.box.x&&box.y<l.box.y+23&&box.y+23>l.box.y))continue;
      if(dots.some(o=>o.id!==d.id&&x(o.x)>box.x-20&&x(o.x)<box.x+width+20&&y(o.y)>box.y-20&&y(o.y)<box.y+38))continue;
      labels.push({id:d.id,name:d.name,x:box.x,y:box.y+13,box});break;
    }
  }
  const selected=dots.find(d=>d.id===(hovered??pinned)),tx=selected?Math.min(right-310,Math.max(left,x(selected.x)+18)):0,ty=selected?Math.min(bottom-140,Math.max(top,y(selected.y)-148)):0;
  const changeMode=(m:'player'|'team')=>{setMode(m);setXKey(m==='team'?'goalsGame':'xg');setYKey(m==='team'?'concededGame':'goals');setPinned(null);setHovered(null);};
  async function download(){if(!svg.current)return;setExporting(true);setMessage('');try{await exportChartPng(svg.current,{title:`${activeX.label} × ${activeY.label}`,description:`FPL · GW${gw} · ${mode==='team'?'球队':'球员'} · ${periodLabel}${mode==='player'?` · ${position} · ≥${minimum}分钟`:''} · ${dots.length} 个数据点`,source:`FPL 官方 · ${new Date(data.capturedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} 北京时间`,filename:`fpl-${mode}-gw${gw}-${activeX.key}-${activeY.key}.png`});setMessage('图片已导出');}catch{setMessage('导出失败，请重试');}finally{setExporting(false);}}
  const missing=(mode==='team'?teamRows.filter(r=>r.played).length:playerRows.length)-dots.length;
  return <section className="panel opportunity-panel" id="chart"><div className="analytics-layout"><aside className="analytics-sidebar">
    <div className="section-heading"><div><ChartScatter size={18}/><h2>可视化表格</h2></div></div>
    <div className="analytics-switch" role="group" aria-label="图表对象"><button onClick={()=>changeMode('player')} aria-pressed={mode==='player'}>球员</button><button onClick={()=>changeMode('team')} aria-pressed={mode==='team'}>球队</button></div>
    {(['横轴','纵轴'] as const).map((label,i)=><label className="analytics-metric" key={label}><span>{label}</span><FilterSelect aria-label={label+'数据'} value={i===0?activeX.key:activeY.key} onValueChange={value=>{(i===0?setXKey:setYKey)(value);setPinned(null);setHovered(null);}}>{metrics.map(m=><option key={m.key} value={m.key} data-group={m.group}>{m.label}</option>)}</FilterSelect></label>)}
    <div className="chart-controls"><label>比赛范围<FilterSelect aria-label="图表比赛范围" value={period} onValueChange={v=>{setPeriod(v);setPinned(null);setHovered(null);}}><option value="1">最近 1 场</option><option value="3">最近 3 场</option><option value="7">最近 7 场</option><option value="ALL">全部</option></FilterSelect></label><label>联赛级别<FilterSelect value="PL" onValueChange={()=>{}}><option value="PL">英超</option></FilterSelect></label>{mode==='player'&&<><label>位置<FilterSelect aria-label="图表位置" value={position} onValueChange={v=>{setPosition(v);setPinned(null);setHovered(null);}}><option value="ATT">中场 + 前锋</option><option value="ALL">全部位置</option>{Object.entries(fplPositionNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</FilterSelect></label><label>累计至少出场<FilterSelect aria-label="图表最低分钟" value={minimum} onValueChange={v=>{setMinimum(Number(v));setPinned(null);setHovered(null);}}>{[90,270,450,900].map(n=><option key={n} value={n}>{n} 分钟</option>)}</FilterSelect></label></>}</div>
    <div className="analytics-count">{periodLabel} · {dots.length} {mode==='team'?'支球队':'名球员'} · 缺失 {missing}</div><p className="chart-note">FPL 官方 · Statz · {new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(data.capturedAt))}</p>
  </aside><div className="analytics-visual"><div className="analytics-visual-heading"><strong>{activeX.label} × {activeY.label}<small className="chart-period-label">{periodLabel}</small></strong><div className="chart-heading-actions"><span>虚线：{comparison?'实际进球 = xG':'样本均值'}</span><button className="chart-export" disabled={exporting||!dots.length} onClick={download}><Download size={15}/>{exporting?'导出中…':'导出图片'}</button></div></div>{message&&<p className="chart-export-status" role="status">{message}</p>}
    <div className="chart-svg-wrap"><svg ref={svg} className="opportunity-svg" viewBox="0 0 820 820" role="img" aria-label={`${activeX.label} 与 ${activeY.label} 散点图`}>
      {[0,.25,.5,.75,1].map(f=>{const a=dx[0]+f*(dx[1]-dx[0]),b=dy[0]+f*(dy[1]-dy[0]);return <g key={f}><line className="chart-grid" x1={x(a)} x2={x(a)} y1={top} y2={bottom}/><line className="chart-grid" x1={left} x2={right} y1={y(b)} y2={y(b)}/><text className="chart-tick" x={x(a)} y={bottom+24} textAnchor="middle">{formatChartTick(a,dx)}</text><text className="chart-tick" x={left-12} y={y(b)+4} textAnchor="end">{formatChartTick(b,dy)}</text></g>;})}
      {comparison?<line className="chart-midline" x1={x(dx[0])} y1={y(dx[0])} x2={x(dx[1])} y2={y(dx[1])}/>:<><line className="chart-midline" x1={x(dots.reduce((s,d)=>s+d.x,0)/Math.max(1,dots.length))} x2={x(dots.reduce((s,d)=>s+d.x,0)/Math.max(1,dots.length))} y1={top} y2={bottom}/><line className="chart-midline" x1={left} x2={right} y1={y(dots.reduce((s,d)=>s+d.y,0)/Math.max(1,dots.length))} y2={y(dots.reduce((s,d)=>s+d.y,0)/Math.max(1,dots.length))}/></>}
      <defs>{dots.map(d=><clipPath id={'fpl-clip-'+d.id} key={d.id}><circle cx={x(d.x)} cy={y(d.y)} r={radius}/></clipPath>)}</defs>
      {dots.map(d=><g key={d.id} className={'chart-jersey-dot'+(selected?.id===d.id?' chart-dot-active':'')} tabIndex={0} role="button" aria-label={`${d.name}，${d.detail}`} onMouseEnter={()=>setHovered(d.id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(d.id)} onBlur={()=>setHovered(null)} onClick={()=>setPinned(d.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPinned(d.id);}else if(e.key==='Escape'){setPinned(null);setHovered(null);}}}><circle className="chart-jersey-bg" cx={x(d.x)} cy={y(d.y)} r={radius+1}/><image href={d.image} x={x(d.x)-radius} y={y(d.y)-radius} width={radius*2} height={radius*2} preserveAspectRatio="xMidYMid meet" clipPath={`url(#fpl-clip-${d.id})`} pointerEvents="none"/><circle className="chart-jersey-hit" cx={x(d.x)} cy={y(d.y)} r={radius+6}/></g>)}
      {labels.filter(l=>l.id!==selected?.id).map(l=><text className="chart-player-label" key={l.id} x={l.x} y={l.y}>{l.name}</text>)}
      {selected&&<g className="chart-tooltip" transform={`translate(${tx} ${ty})`}><rect className="tooltip-shell" width={310} height={140} rx={13}/><text className="chart-tooltip-name" x={14} y={26}>{selected.name}</text><text className="tooltip-subtitle" x={14} y={47}>{selected.subtitle}</text>{[{label:activeX.label,value:selected.x,x:12},{label:activeY.label,value:selected.y,x:161}].map(m=><g key={m.x}><rect className="tooltip-metric-box" x={m.x} y={62} width={137} height={63} rx={8}/><text className="tooltip-metric-label" x={m.x+10} y={81}>{m.label}</text><text className="tooltip-metric-value" x={m.x+10} y={111}>{m.value.toFixed(Math.abs(m.value)<1?3:2)}</text></g>)}</g>}
      <text className="chart-axis-label" x={left+size/2} y={800} textAnchor="middle">{activeX.label}{lower(activeX.key)?'（向右越低）':' →'}</text><text className="chart-axis-label" x={19} y={top+size/2} textAnchor="middle" transform={`rotate(-90 19 ${top+size/2})`}>{activeY.label}{lower(activeY.key)?'（向上越低）':' ↑'}</text>
    </svg>{!dots.length&&<p className="stats-empty">当前筛选无可用数据</p>}</div><div className="chart-touch-detail" aria-live="polite">{selected?<><strong>{selected.name}</strong><span>{selected.detail}</span></>:<span>选择球队或球员查看数值</span>}</div>
  </div></div></section>;
}
