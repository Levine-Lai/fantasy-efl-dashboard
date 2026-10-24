"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameSwitcher } from './game-switcher';
import { ChevronLeft, ChevronRight, Download, ChartScatter, Crosshair, Sparkles, Trophy } from "lucide-react";
import {loadChartHistory,recentChartStats} from "@/lib/chart-history";
import type {ChartHistory} from "@/lib/chart-history";
import {attackingMetrics,attackingColumns,attackingValue,isAttackKey} from "@/lib/attacking-metrics";
import type {AttackKey} from "@/lib/attacking-metrics";
import {SetPieceTable} from "./set-piece-table";
import { RoundFixtures } from "./round-fixtures";
import { defaultRound, loadRound, fixtureCounts } from "@/lib/round-view";
import { TeamStatsTable } from "./team-stats-table";
import { ranking, tint } from "@/lib/player-profile";
import { leagueOptions, includesLeague, leagueLabel } from "@/lib/league-selection";
import { chartDomain, formatChartTick } from "@/lib/chart-scale";
import { exportChartPng } from "@/lib/export-chart";
import { FilterSelect } from "@/components/ui/filter-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, RoundView, RoundFixture, FixtureBadge, PlayerPick, PlayerStat, StatKey, TeamStat } from "@/lib/dashboard-data";

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionName = { GK: "门将", DEF: "后卫", MID: "中场", FWD: "前锋" };
const competitionName: Record<number, string> = { 10: "英冠", 11: "英甲", 12: "英乙" };



function labelFor(player: PlayerPick) {
  if (player.ownership <= 3) return "冷门";
  if (player.ownership >= 10) return "热门";
  return "平衡";
}

function RichImage({ src, fallback, alt, className, priority = false }: { src: string; fallback?: string; alt: string; className: string; priority?: boolean }) {
  return <img className={className} src={src || fallback} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" onError={(event) => { if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback; else event.currentTarget.style.visibility = "hidden"; }} />;
}

function FixtureBadges({ fixtures }: { fixtures: FixtureBadge[] }) {
  return <span className="fixture-badges">{fixtures.map((fixture, index) => <span className="fixture-badge" key={`${fixture.opponent}-${index}`} title={`${fixture.label} ${fixture.opponent}`}><span>{fixture.label}</span><RichImage className="fixture-logo" src={fixture.opponentLogo} alt={`${fixture.opponent} 队徽`} /><span>{fixture.opponent}</span></span>)}</span>;
}

function PlayerRow({ player, rank, actual=false }: { player: PlayerPick; rank: number; actual?:boolean }) {
  return (
    <article className="player-row">
      <div className="rank">{String(rank).padStart(2, "0")}</div>
      <div className="player-visual">
        <RichImage className="player-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
        <RichImage className="mini-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
      </div>
      <div className="player-main">
        <div className="player-title"><strong>{player.name}</strong><span className={`pill pill-${labelFor(player)}`}>{actual?"已结算":labelFor(player)}</span></div>
        <div className="player-meta"><span>{player.team}</span><span>{player.fixtures.join(" · ")}</span><span title={actual?"本轮已结算比赛实际动作得分的场均值；不含进球、助攻和零封分。":"按官方逐场门槛计算关键传球、射正、解围、封堵、抢断、拦截或扑救的得分，再结合少量同位置先验估计；不含进球、助攻和零封分。"}>动作得分 {player.actionScore.toFixed(1)} / 场</span></div>
      </div>
      <div className="player-stat"><span>{actual?"本轮分钟":"预计分钟"}</span><b>{player.expectedMinutes}′</b></div>
      <div className="player-stat ownership-stat"><span>持有</span><b>{actual?"—":player.ownership+"%"}</b></div>
      <div className="player-stat desktop-stat"><span>{actual?"赛程":"对阵"}</span><b>{actual?player.fixtures.length+" 场":(player.matchup>0?"+":"")+player.matchup+"%"}</b></div>
      <div className="score"><span>{actual?"实际得分":"预期得分"}</span><b>{player.score}</b></div>
    </article>
  );
}

const statColumns: { key: StatKey; label: string }[] = [
  { key: "points", label: "得分" }, { key: "minutesPlayed", label: "分钟" },
  { key: "goalsScored", label: "进球" }, { key: "assists", label: "助攻" },
  { key: "keyPasses", label: "关键传球" }, { key: "shotsOnTarget", label: "射正" },
  { key: "cleanSheet", label: "零封" }, { key: "saves", label: "扑救" },
  { key: "penaltySaves", label: "扑点" }, { key: "goalsConceded", label: "失球" },
  { key: "clearances", label: "解围" }, { key: "blocks", label: "封堵" },
  { key: "tackles", label: "抢断" }, { key: "interceptions", label: "拦截" },

];

const keeperOnly = new Set<StatKey>(["saves", "penaltySaves"]);
const positionStats: Record<string, ReadonlySet<StatKey>> = {
  GK: new Set(["points", "minutesPlayed", "cleanSheet", "saves", "penaltySaves", "goalsConceded"]),
  DEF: new Set(["points", "minutesPlayed", "goalsScored", "assists", "cleanSheet", "goalsConceded", "clearances", "blocks", "tackles", "interceptions"]),
  MID: new Set(["points", "minutesPlayed", "goalsScored", "assists", "keyPasses", "shotsOnTarget", "tackles", "interceptions"]),
  FWD: new Set(["points", "minutesPlayed", "goalsScored", "assists", "keyPasses", "shotsOnTarget"]),
};
function applicableStat(key: string, position: string) {
  if(isAttackKey(key))return position!=="GK";
  return positionStats[position]?.has(key as StatKey) ?? false;
}

type PlayerTableKey=StatKey|"appearances"|AttackKey;
const tableValue=(player:PlayerStat,key:PlayerTableKey)=>key==="appearances"?player.appearances:isAttackKey(key)?attackingValue(player,key):player.perGame[key];
function StatsTable({ players, roundId }: { players: PlayerStat[]; roundId:number }) {
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState("ALL");
  const [team, setTeam] = useState("ALL");
  const teamKey=(player:PlayerStat)=>`${player.competitionId}:${player.team}`;
  const teamOptions=useMemo(()=>[...new Map(players.filter(p=>includesLeague(competition,p.competitionId)).map(p=>[`${p.competitionId}:${p.team}`,{key:`${p.competitionId}:${p.team}`,name:p.team,logo:p.teamLogo}])).values()].sort((a,b)=>a.name.localeCompare(b.name)),[players,competition]);
  const [position, setPosition] = useState("OUT");
  const [minimum, setMinimum] = useState(roundId<=2?1:3);
  const [sortKey, setSortKey] = useState<PlayerTableKey>("points");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const columns = [...statColumns,...attackingColumns].filter(({ key }) => position === "ALL" || (position === "OUT" ? !keeperOnly.has(key as StatKey) : applicableStat(key, position)));
  const effectiveSortKey = sortKey === "appearances" || columns.some(column => column.key === sortKey) ? sortKey : "points";
  const filtered = useMemo(() => players
    .filter((player) => (team === "ALL" || teamKey(player) === team) && player.appearances >= minimum && includesLeague(competition, player.competitionId) && (position === "ALL" || position === "OUT" && player.position !== "GK" || player.position === position) && `${player.fullName} ${player.team}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const left = tableValue(a,effectiveSortKey);
      const right = tableValue(b,effectiveSortKey);
      if(left==null)return right==null?a.fullName.localeCompare(b.fullName):1;if(right==null)return -1;
      return (descending ? right - left : left - right) || b.appearances - a.appearances || a.fullName.localeCompare(b.fullName);
    }), [players, minimum, competition, team, position, query, effectiveSortKey, descending]);
  const colorRanks = useMemo(()=>{
    const result=new Map<string,number>();
    const pool=players.filter(p=>p.appearances>=minimum && includesLeague(competition,p.competitionId));
    for(const role of positions) for(const division of [10,11,12]) {
      const group=pool.filter(p=>p.position===role && p.competitionId===division);
      for(const {key} of [...statColumns,...attackingColumns]) {
        if(!applicableStat(key,role)) continue;
        const values=group.map(p=>tableValue(p,key));
        for(const p of group) {const r=ranking(tableValue(p,key),values,key==='goalsConceded');if(r)result.set(`${p.id}:${key}`,r.percentile);}
      }
    }
    return result;
  },[players,minimum,competition]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 30));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 30, (currentPage + 1) * 30);
  const changeSort = (key: PlayerTableKey) => {
    setDescending(effectiveSortKey === key ? !descending : true);
    setSortKey(key);
    setPage(0);
  };
  const sortHeading = (key: PlayerTableKey, label: string) => (
    <th key={key} scope="col" aria-sort={effectiveSortKey === key ? (descending ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => changeSort(key)}>{label}<span aria-hidden="true">{effectiveSortKey === key ? (descending ? "↓" : "↑") : "↕"}</span></button>
    </th>
  );
  return (
    <section className="panel stats-panel" id="stats">
      <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>球员场均数据</h2></div><span>Fantasy EFL / FotMob / Statz</span></div>
      <div className="stats-toolbar">
        <label><span>搜索</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="球员或球队" /></label>
        <label><span>联赛级别</span><FilterSelect value={competition} onValueChange={(value) => { setCompetition(value); setTeam("ALL"); setPage(0); }}>{leagueOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect></label>
        <label className="stats-team-filter"><span>球队</span><FilterSelect aria-label="球员场均数据球队" value={team} onValueChange={value=>{setTeam(value);setPage(0);}}><option value="ALL">全部球队</option>{teamOptions.map(item=><option key={item.key} value={item.key}><span className="team-select-option"><img src={item.logo} alt="" loading="lazy"/>{item.name}</span></option>)}</FilterSelect></label>
        <label><span>位置</span><FilterSelect value={position} onValueChange={(value) => { setPosition(value); setPage(0); }}><option value="OUT">非门将</option><option value="ALL">全部位置</option>{positions.map((item) => <option key={item} value={item}>{positionName[item]}</option>)}</FilterSelect></label>
        <label><span>至少出场</span><FilterSelect value={minimum} onValueChange={(value) => { setMinimum(Number(value)); setPage(0); }}><option value={1}>1 场</option><option value={3}>3 场</option><option value={5}>5 场</option></FilterSelect></label>
        <span className="stats-count">{filtered.length} 人</span>
      </div>
      <p className="table-scroll-hint">左右滑动查看全部数据 · 球员列固定</p><div className="stats-scroll" role="region" aria-label="球员场均数据表，可横向滚动" tabIndex={0}>
        <table className="stats-table">
          <thead><tr><th scope="col" className="stats-name-col">球员</th><th scope="col">位置</th>{sortHeading("appearances", "出场")}{columns.map(({ key, label }) => sortHeading(key, label))}</tr></thead>
          <tbody>{visible.map((player) => <tr key={player.id}><th scope="row" className="stats-name-col"><a className="stats-player-link" href={`./personal.html?player=${player.id}&gw=${roundId}`} title={`${player.team} · 查看个人数据`}><RichImage className="stats-team-logo" src={player.teamLogo} alt={`${player.team} 队徽`} /><strong>{player.fullName}</strong></a></th><td>{player.position}</td><td>{player.appearances}</td>{columns.map(({key})=>{const value=tableValue(player,key),applicable=applicableStat(key,player.position);return <td key={key} style={{backgroundColor:tint(colorRanks.get(`${player.id}:${key}`)??null)}} title={isAttackKey(key)?`赛季来源：${key.startsWith('fm')||key.startsWith('xa')||key.startsWith('xgi')?'FotMob':'Statz'}；按来源场数/分钟计算，缺失不计作零`:undefined} className={!applicable?'stats-inapplicable':value===0?'stats-zero':undefined}>{!applicable?'0.0':value==null?'—':value===0?'0.0':value.toFixed(key==='minutesPlayed'?1:2)}</td>;})}</tr>)}</tbody>
        </table>
        {!visible.length && <div className="stats-empty">没有符合条件的球员</div>}
      </div>
      <div className="stats-footer"><span>浅绿优于同联赛同位置样本，浅红低于；0.0 = 零值或该位置未统计；— = 来源缺失；xG/xA/xGI 为 FotMob 同源赛季数据</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
    </section>
  );
}

function formatUpdated(value: string) { return value ? new Intl.DateTimeFormat("zh-CN", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai"}).format(new Date(value)) : "—"; }

type AnalyticsDatum = { id: string; name: string; image: string; x: number; y: number; subtitle: string; detail: string };

function OpportunityChart({ players, teams, fixtures, xgUpdatedAt, officialUpdatedAt, historical=false,roundId,historyFile }: { roundId:number;historyFile?:string;fixtures:RoundFixture[];players: PlayerStat[]; teams: TeamStat[]; xgUpdatedAt: string; officialUpdatedAt: string; historical?:boolean }) {
  const [mode, setMode] = useState<"team" | "player">("team");
  const [competition, setCompetition] = useState("10");
  const [position, setPosition] = useState("ATT");
  const [minimum, setMinimum] = useState(historical?90:450);
  const [doubleOnly,setDoubleOnly]=useState(false);
  const doubleTeams=useMemo(()=>{
    const counts=fixtureCounts(fixtures);
    return new Set(teams.filter(t=>(counts.get(t.id)??0)>1).flatMap(t=>[`${t.competitionId}:${t.name}`,`${t.competitionId}:${t.fullName}`]));
  },[fixtures,teams]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [loadChartImages, setLoadChartImages] = useState(false);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof IntersectionObserver === "undefined") { setLoadChartImages(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry=>entry.isIntersecting)) { setLoadChartImages(true); observer.disconnect(); } }, {rootMargin:"250px"});
    observer.observe(svg); return ()=>observer.disconnect();
  }, []);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [xKey, setXKey] = useState(historical?"goalsPerGame":"xgPerGame");
  const [yKey, setYKey] = useState(historical?"goalsAgainstPerGame":"xgaPerGame");
  const [period,setPeriod]=useState('ALL');
  const [history,setHistory]=useState<ChartHistory|null>(null);
  const [historyError,setHistoryError]=useState('');
  const [historyRetry,setHistoryRetry]=useState(0);
  useEffect(()=>{
    if(period==='ALL'||history)return;
    let cancelled=false;setHistoryError('');
    if(!historyFile){setHistoryError('近期比赛数据尚未生成');return;}
    loadChartHistory(historyFile).then(value=>{if(!cancelled)setHistory(value);}).catch(error=>{if(!cancelled)setHistoryError(error.message);});
    return ()=>{cancelled=true;};
  },[period,history,historyFile,historyRetry]);
  const periodLabel=period==='ALL'?'全部':`最近 ${period} 场`;
  const shortPeriod=period!=='ALL';
  const windowStats=useMemo(()=>shortPeriod?(history?recentChartStats(history,roundId,Number(period),players,teams):{players:[],teams:[]}):{players,teams},[shortPeriod,period,history,roundId,players,teams]);
  const eligiblePlayers=useMemo(()=>new Set(players.filter(p=>p.perGame.minutesPlayed*p.appearances>=minimum).map(p=>p.id)),[players,minimum]);

  const metrics = mode === "team" ? [
    {key:"xgPerGame",label:"预期进球 · xG / 场",group:"预期表现"},
    {key:"xgaPerGame",label:"预期失球 · xGA / 场",group:"预期表现"},
    {key:"xgdPerGame",label:"预期净胜球 · xGD / 场",group:"预期表现"},
    {key:"xgShare",label:"预期进球占比 · %",group:"预期表现"},
    {key:"xptsPerGame",label:"预期积分 · xPts / 场",group:"预期表现"},
    {key:"pointsDeltaPerGame",label:"积分超预期 / 场",group:"实际与预期偏差"},
    {key:"finishingDeltaPerGame",label:"进球超预期 / 场",group:"实际与预期偏差"},
    {key:"goalsPerGame",label:"进球 / 场",group:"比赛结果"},
    {key:"goalsAgainstPerGame",label:"失球 / 场",group:"比赛结果"},
    {key:"winRate",label:"胜率 · %",group:"比赛结果"},
    {key:"cleanSheetRate",label:"零封率 · %",group:"比赛结果"},
    {key:"pointsPerGame",label:"联赛积分 / 场",group:"比赛结果"},
  ] : [
    ...(position !== "GK" ? [{key:"xg90",label:"预期进球 / 90",group:"预期与效率"},{key:"goals90",label:"实际进球 / 90",group:"预期与效率"},{key:"goalInvolvements90",label:"进球 + 助攻 / 90",group:"预期与效率"},{key:"keyPasses90",label:"关键传球 / 90",group:"预期与效率"},{key:"shotsOnTarget90",label:"射正 / 90",group:"预期与效率"},{key:"defensiveActions90",label:"防守动作 / 90",group:"预期与效率"}] : [{key:"saveRate",label:"扑救率 · %",group:"门将效率"}]),
    ...(position!=="GK"&&!shortPeriod&&!historical?attackingMetrics:[]),
    {key:"ownership",label:"持有率 · %",group:"样本与热度"},{key:"appearances",label:"出场次数",group:"样本与热度"},
    ...statColumns.filter(({key})=>position === "ALL" || (position === "ATT" ? applicableStat(key, "MID") || applicableStat(key, "FWD") : applicableStat(key, position))).map(({key,label})=>({key,label:label+" / 场",group:keeperOnly.has(key)?"门将动作":"基础场均"}))];
  const availableMetrics=historical||shortPeriod?metrics.filter(m=>!["xgPerGame","xgaPerGame","xgdPerGame","xgShare","xptsPerGame","pointsDeltaPerGame","finishingDeltaPerGame","xg90","ownership"].includes(m.key)):metrics;
  const activeXKey = availableMetrics.some(m=>m.key===xKey) ? xKey : mode==="team"?"goalsPerGame":"points";
  const activeYKey = availableMetrics.some(m=>m.key===yKey) ? yKey : mode==="team"?"goalsAgainstPerGame":"goals90";
  const xLabel = availableMetrics.find(m=>m.key===activeXKey)?.label ?? activeXKey;
  const yLabel = availableMetrics.find(m=>m.key===activeYKey)?.label ?? activeYKey;
  const lowerBetter = (key: string) => ["xgaPerGame","goalsAgainstPerGame","goalsConceded","yellowCards","redCards","ownGoals","penaltyMisses"].includes(key);
  const valueFor = (row: TeamStat | PlayerStat, key: string): number | null => {
    if ("perGame" in row) {
      if(isAttackKey(key))return attackingValue(row,key);
      const stats = row.perGame;
      if (key in stats && !applicableStat(key as StatKey, row.position)) return null;
      const per90: Record<string, number> = {goalInvolvements90: stats.goalsScored + stats.assists, keyPasses90: stats.keyPasses, shotsOnTarget90: stats.shotsOnTarget, defensiveActions90: stats.clearances + stats.blocks + stats.tackles + stats.interceptions};
      if (key in per90) return row.position !== "GK" && stats.minutesPlayed > 0 ? per90[key] * 90 / stats.minutesPlayed : null;
      if (key === "saveRate") return row.position === "GK" && stats.saves + stats.goalsConceded > 0 ? 100 * stats.saves / (stats.saves + stats.goalsConceded) : null;
    }
    const value = "perGame" in row && key in row.perGame ? row.perGame[key as StatKey] : (row as unknown as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const candidates = mode === "team" ? windowStats.teams.filter(t=>includesLeague(competition,t.competitionId)) : windowStats.players.filter(p=>eligiblePlayers.has(p.id) && (!doubleOnly||doubleTeams.has(`${p.competitionId}:${p.team}`)) && includesLeague(competition,p.competitionId) && (position==="ALL" || position==="ATT" && ["MID","FWD"].includes(p.position) || p.position===position));
  const dots: AnalyticsDatum[] = candidates.flatMap(row=>{
    const xv=valueFor(row,activeXKey), yv=valueFor(row,activeYKey); if(xv==null || yv==null) return [];
    return [{id:mode+row.id,name:"perGame" in row ? row.fullName : row.name,image:"perGame" in row ? row.jerseyUrl : row.logo,x:xv,y:yv,subtitle:"perGame" in row ? row.team+" · "+row.appearances+" 场" : competitionName[row.competitionId]+" · "+row.played+" 场",detail:xLabel+" "+xv.toFixed(2)+" · "+yLabel+" "+yv.toFixed(2)}];
  });
  const selected = dots.find(d=>d.id===(hovered ?? pinned));
  const comparison = mode==="player" && activeXKey==="xg90" && activeYKey==="goals90";
  const playerMaximum = chartDomain(dots.flatMap(d=>[d.x,d.y]))[1];
  const xDomain: [number,number] = comparison ? chartDomain(dots.flatMap(d=>[d.x,d.y])) : chartDomain(dots.map(d=>d.x));
  const yDomain: [number,number] = comparison ? chartDomain(dots.flatMap(d=>[d.x,d.y])) : chartDomain(dots.map(d=>d.y));
  const markerRadius = 16;
  const left = 92, top = 68, size = 654, right = left + size, bottom = top + size;
  const x = (value: number) => left + (lowerBetter(activeXKey) ? 1 - (value - xDomain[0]) / (xDomain[1] - xDomain[0]) : (value - xDomain[0]) / (xDomain[1] - xDomain[0])) * size;
  const y = (value: number) => lowerBetter(activeYKey)
    ? top + (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * size
    : bottom - (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * size;
  const labels: { id: string; name: string; x: number; y: number; box: { x: number; y: number; width: number; height: number } }[] = [];
  const priority = [...dots].sort((a, b) => mode === "team" ? (b.x - b.y) - (a.x - a.y) : (b.x + b.y) - (a.x + a.y));
  for (const datum of priority) {
    if (labels.length >= (mode === "team" ? 35 : 28)) break;
    const px = x(datum.x), py = y(datum.y);
    const labelWidth = Math.min(170, Math.max(48, datum.name.length * 7));
    const candidates = [
      { x: px + 23, y: py - 19 }, { x: px - labelWidth - 23, y: py - 19 },
      { x: px + 23, y: py + 5 }, { x: px - labelWidth - 23, y: py + 5 },
    ];
    for (const box of candidates.map((candidate) => ({ ...candidate, width: labelWidth, height: 18 }))) {
      if (box.x < left || box.y < top || box.x + box.width > right || box.y + box.height > bottom) continue;
      if (labels.some((label) => box.x < label.box.x + label.box.width + 5 && box.x + box.width + 5 > label.box.x && box.y < label.box.y + label.box.height + 5 && box.y + box.height + 5 > label.box.y)) continue;
      if (dots.some((other) => other.id !== datum.id && x(other.x) > box.x - 20 && x(other.x) < box.x + box.width + 20 && y(other.y) > box.y - 20 && y(other.y) < box.y + box.height + 20)) continue;
      labels.push({ id: datum.id, name: datum.name, x: box.x, y: box.y + 13, box });
      break;
    }
  }
  const tooltipX = selected ? Math.min(right - 310, Math.max(left, x(selected.x) + 18)) : 0;
  const tooltipY = selected ? Math.min(bottom - 140, Math.max(top, y(selected.y) - 148)) : 0;
  const statzCompetition = competition === "11" ? "league-one" : competition === "12" ? "league-two" : "championship";
  const statzUrl = `https://statz.ai/competitions/${statzCompetition}/xg${mode === "player" ? "/players" : ""}`;
  const changeMode = (value: "team" | "player") => { setMode(value);setPinned(null); setXKey(value === "team" ? (historical?"goalsPerGame":"xgPerGame") : (historical?"goals90":"xg90")); setYKey(value === "team" ? (historical?"goalsAgainstPerGame":"xgaPerGame") : "goals90"); setHovered(null); };
  return <section className="panel opportunity-panel" id="chart">
    <div className="analytics-layout">
      <aside className="analytics-sidebar">
        <div className="section-heading"><div><ChartScatter size={18} /><h2>可视化表格</h2></div></div>
        <div className="analytics-switch" role="group" aria-label="图表对象">
          <button type="button" onClick={() => changeMode("player")} aria-pressed={mode === "player"}>球员</button>
          <button type="button" onClick={() => changeMode("team")} aria-pressed={mode === "team"}>球队</button>
        </div>
        {(["横轴","纵轴"] as const).map((label,index)=><label className="analytics-metric" key={label}><span>{label}</span><FilterSelect aria-label={label+"数据"} value={index===0?activeXKey:activeYKey} onValueChange={value=>{(index===0?setXKey:setYKey)(value);setHovered(null);}}>{availableMetrics.map(m=><option key={m.key} value={m.key} data-group={m.group}>{m.label}</option>)}</FilterSelect></label>)}
        <div className="chart-controls">
          <label>比赛范围<FilterSelect aria-label="图表比赛范围" value={period} onValueChange={value=>{setPeriod(value);setHovered(null);setPinned(null);}}><option value="1">最近 1 场</option><option value="3">最近 3 场</option><option value="7">最近 7 场</option><option value="ALL">全部</option></FilterSelect></label>
          <label>联赛级别<FilterSelect value={competition} onValueChange={(value) => { setCompetition(value); setHovered(null); }}>{leagueOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect></label>
          {mode === "player" && <><label>位置<FilterSelect value={position} onValueChange={(value) => { setPosition(value); setHovered(null); }}><option value="ATT">中场 + 前锋</option><option value="ALL">全部位置</option><option value="MID">中场</option><option value="FWD">前锋</option><option value="DEF">后卫</option><option value="GK">门将</option></FilterSelect></label><label>累计至少出场<FilterSelect value={minimum} onValueChange={(value) => { setMinimum(Number(value)); setHovered(null); }}><option value={90}>90 分钟</option><option value={270}>270 分钟</option><option value={450}>450 分钟</option><option value={900}>900 分钟</option></FilterSelect></label></>}
        </div>
        {mode==='player'&&<button type="button" className="double-filter" aria-pressed={doubleOnly} onClick={()=>{setDoubleOnly(v=>!v);setHovered(null);setPinned(null);}}>只看双赛球员</button>}
        <div className="analytics-count">{periodLabel} · {dots.length} {mode === "team" ? "支球队" : "名球员"} · 指标缺失 {candidates.length-dots.length}</div>
        {candidates.length>dots.length&&<p className="chart-window-note">指标缺失表示当前横轴或纵轴没有可对齐的数据，球员仍保留在数据库中。xG 与官方出场数不同步、来源未收录或姓名未匹配时暂不绘点；缺失不按零计算。</p>}
        {shortPeriod&&<p className="chart-window-note">按每支球队最近比赛 / 每名球员最近实际出场统计，少于所选场数按实际样本计算；双赛逐场计数。累计分钟门槛仍按所选 GW 的累计样本。短期 xG、xA、xGI、射门、传中与成功过人无逐场来源，暂不提供。</p>}
        <p className="chart-note">数据：<a href={statzUrl} target="_blank" rel="noreferrer">Statz xG</a> / <a href="https://fantasy.efl.com" target="_blank" rel="noreferrer">Fantasy EFL</a><br />官方抓取：{formatUpdated(officialUpdatedAt)}<br />xG 抓取：{xgUpdatedAt?formatUpdated(xgUpdatedAt):"历史无存档"}<br />{!historical&&players.find(p=>p.attacking)&&<>FotMob 抓取：{formatUpdated(players.find(p=>p.attacking)!.attacking!.updatedAt)}<br/>动作数据抓取：{formatUpdated(players.find(p=>p.attacking)!.attacking!.actionUpdatedAt)}<br/></>}每日北京时间 08:17 触发更新，GitHub 调度可能延迟；各来源以抓取时间为准。官方统计仅含确认完赛；xG 为源站赛季累计。<br />场均按出场计算；每 90 按官方比赛分钟计算（xG 除外）。缺失不计作零；失球等指标自动反向。新增 xG/xA/xGI 来自 FotMob，xGI 同源相加；射门、传中、成功过人来自 Statz，均按各自来源场数和分钟计算。</p>
        <details className="metric-methodology"><summary>进阶指标怎么看</summary><p>xGD = xG − xGA；xG 占比 = xG ÷ (xG + xGA)。xPts 来自 Statz 的逐场泊松模型。球队预期与偏差指标均使用 Statz 同一批比赛。</p><p>每 90 指标控制出场时间，但仍受战术与对手影响。防守动作 = 解围 + 封堵 + 抢断 + 拦截；扑救率 = 扑救 ÷ (扑救 + 失球)，不等于预期扑救表现。超预期指标描述结果偏差，不代表稳定能力。建议使用至少 900 分钟样本。</p></details>
      </aside>
      <div className="analytics-visual">
        <div className="analytics-visual-heading"><strong>{xLabel+" × "+yLabel}<small className="chart-period-label">{periodLabel}</small></strong><div className="chart-heading-actions"><span>{comparison?"虚线：实际进球 = xG":"虚线：当前样本均值"}</span><button className="chart-export" type="button" disabled={exporting || !dots.length} onClick={async () => {
          if (!svgRef.current) return;
          setExporting(true); setExportStatus("正在生成图片…");
          try {
            const fallbackCount = await exportChartPng(svgRef.current, { title: xLabel + " × " + yLabel, description: (mode === "team" ? "球队" : "球员") + " · " + periodLabel + " · " + leagueLabel(competition) + (mode === "player" ? " · " + (positionName[position as keyof typeof positionName] ?? (position === "ATT" ? "中场 + 前锋" : "全部位置")) + " · 至少 " + minimum + " 分钟" + (doubleOnly?" · 本轮双赛":"") : "") + " · " + dots.length + " 个有效数据点 · 缺失 " + (candidates.length - dots.length), source: "Fantasy EFL / Statz · 官方抓取 " + formatUpdated(officialUpdatedAt) + " · xG 抓取 " + formatUpdated(xgUpdatedAt) + "（北京时间）", filename: "fantasy-efl-" + mode + "-" + activeXKey + "-" + activeYKey + "-" + period + (mode==="player"&&doubleOnly?"-double":"") + ".png" });
            setExportStatus(fallbackCount ? "图片已导出，部分球衣无法加载，已以文字标记替代。" : "图片已导出");
          } catch { setExportStatus("导出失败，请重试。"); }
          finally { setExporting(false); }
        }}><Download size={15} />{exporting ? "导出中…" : "导出图片"}</button></div></div>
        {shortPeriod&&!history&&<p className="chart-export-status" role={historyError?"alert":"status"}>{historyError||"正在加载近期比赛数据…"}{historyError&&<button type="button" className="double-filter" onClick={()=>setHistoryRetry(n=>n+1)}>重试</button>}</p>}
        {exportStatus && <p className="chart-export-status" role="status">{exportStatus}</p>}
        {candidates.length > dots.length && <details className="chart-missing"><summary>{candidates.length-dots.length} 个对象缺少所选指标，查看名单</summary><p>{candidates.filter(row=>valueFor(row,activeXKey)==null || valueFor(row,activeYKey)==null).map(row=>("perGame" in row ? row.fullName : row.name)).join("、")}</p></details>}
        <div className="chart-svg-wrap"><svg ref={svgRef} className="opportunity-svg" viewBox="0 0 820 820" role="img" aria-label={xLabel+" 与 "+yLabel+" 散点图"}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const xv = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
            const yv = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
            return <g key={fraction}><line className="chart-grid" x1={x(xv)} x2={x(xv)} y1={top} y2={bottom} /><line className="chart-grid" x1={left} x2={right} y1={y(yv)} y2={y(yv)} /><text className="chart-tick" x={x(xv)} y={bottom + 24} textAnchor="middle">{formatChartTick(xv, xDomain)}</text><text className="chart-tick" x={left - 12} y={y(yv) + 4} textAnchor="end">{formatChartTick(yv, yDomain)}</text></g>;
          })}
          {!comparison ? <><line className="chart-midline" x1={x(dots.reduce((sum,d)=>sum+d.x,0)/Math.max(1,dots.length))} x2={x(dots.reduce((sum,d)=>sum+d.x,0)/Math.max(1,dots.length))} y1={top} y2={bottom} /><line className="chart-midline" x1={left} x2={right} y1={y(dots.reduce((sum,d)=>sum+d.y,0)/Math.max(1,dots.length))} y2={y(dots.reduce((sum,d)=>sum+d.y,0)/Math.max(1,dots.length))} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">{activeXKey==="xgPerGame" && activeYKey==="xgaPerGame" ? "攻强 · 守强" : ""}</text></> : <><line className="chart-midline" x1={x(Math.max(xDomain[0], yDomain[0]))} y1={y(Math.max(xDomain[0], yDomain[0]))} x2={x(playerMaximum)} y2={y(playerMaximum)} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">进球多于预期</text></>}
          <defs>{dots.filter((datum) => datum.image).map((datum) => <clipPath id={"analytics-clip-" + datum.id} key={datum.id}><circle cx={x(datum.x)} cy={y(datum.y)} r={markerRadius} /></clipPath>)}</defs>
          {dots.map((datum) => <g key={datum.id} className={"chart-jersey-dot" + ((hovered ?? pinned) === datum.id ? " chart-dot-active" : "")} tabIndex={0} role="button" aria-label={datum.name + "，" + datum.detail} onMouseEnter={() => setHovered(datum.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(datum.id)} onBlur={() => setHovered(null)} onClick={() => {setPinned(datum.id);setHovered(datum.id);}} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPinned(datum.id); setHovered(datum.id); } else if(event.key === "Escape") {setPinned(null);setHovered(null);} }}>
            <circle className="chart-jersey-bg" cx={x(datum.x)} cy={y(datum.y)} r={markerRadius + 1} />
            {datum.image && loadChartImages && <image href={datum.image} x={x(datum.x) - markerRadius} y={y(datum.y) - markerRadius} width={markerRadius * 2} height={markerRadius * 2} preserveAspectRatio="xMidYMid meet" clipPath={"url(#analytics-clip-" + datum.id + ")"} pointerEvents="none" />}
            <circle className="chart-jersey-hit" cx={x(datum.x)} cy={y(datum.y)} r={markerRadius + 6} />
          </g>)}
          {labels.filter((label) => label.id !== selected?.id).map((label) => <text className="chart-player-label" key={label.id} x={label.x} y={label.y}>{label.name}</text>)}
          {selected && <g className="chart-tooltip" transform={"translate(" + tooltipX + " " + tooltipY + ")"}>
            <rect className="tooltip-shell" width={310} height={140} rx={13} />
            <text className="chart-tooltip-name" x={14} y={26}>{selected.name}</text>
            <text className="tooltip-subtitle" x={14} y={47}>{selected.subtitle}</text>
            {[{label:xLabel,value:selected.x,x:12},{label:yLabel,value:selected.y,x:161}].map(metric=><g key={metric.x}>
              <rect className="tooltip-metric-box" x={metric.x} y={62} width={137} height={63} rx={8} />
              <text className="tooltip-metric-label" x={metric.x+10} y={81}>{metric.label}</text>
              <text className="tooltip-metric-value" x={metric.x+10} y={111}>{metric.value.toFixed(Math.abs(metric.value)<1?3:2)}</text>
            </g>)}
          </g>}

          <text className="chart-axis-label" x={left + size / 2} y={800} textAnchor="middle">{xLabel+(lowerBetter(activeXKey)?"（向右越低）":" →")}</text>
          <text className="chart-axis-label" x={19} y={top + size / 2} textAnchor="middle" transform={"rotate(-90 19 " + (top + size / 2) + ")"}>{yLabel+(lowerBetter(activeYKey)?"（向上越低）":" ↑")}</text>
        </svg>{!dots.length && <p className="stats-empty">{mode==='player'&&doubleOnly?'本轮暂无符合条件的双赛球员':'当前筛选无可用数据，请更换指标或降低出场门槛。'}</p>}</div><div className="chart-touch-detail" aria-live="polite">{selected?<><strong>{selected.name}</strong><span>{selected.detail}</span></>:<span>轻点图中球队或球员，查看完整数据</span>}</div>
      </div>
    </div>
  </section>;
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [playerQuery, setPlayerQuery] = useState("");
  const [rankPosition, setRankPosition] = useState<typeof positions[number]>("GK");
  const [rankPage, setRankPage] = useState(0);
  const roundIndex=data.roundIndex ?? [];
  const [selectedRound,setSelectedRound]=useState(()=>{
    const requested=Number(new URLSearchParams(location.search).get('gw'));
    return roundIndex.some(r=>r.id===requested)?requested:defaultRound(roundIndex)??data.meta.roundId;
  });
  const [roundView,setRoundView]=useState<RoundView|null>(null);
  const [roundError,setRoundError]=useState('');
  const [retry,setRetry]=useState(0);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    const round=roundIndex.find(r=>r.id===selectedRound);
    if(selectedRound===data.meta.roundId || !round){setRoundView(null);setLoading(false);setRoundError('');return;}
    setLoading(true);setRoundError('');
    loadRound(round).then(value=>{if(!cancelled)setRoundView(value);}).catch(error=>{if(!cancelled)setRoundError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[selectedRound,retry,data,roundIndex]);
  const active=roundView ?? data;
  const actual=active.scoreKind==='actual';
  const pending=loading||!!roundError||active.meta.roundId!==selectedRound;
  const playerStats=roundView?.playerStats ?? data.playerStats;
  const teamStats=roundView?.teamStats ?? data.teamStats;
  const roundPosition=roundIndex.findIndex(r=>r.id===selectedRound);
  const selectedEntry=roundIndex[roundPosition];
  const scoreLabel=actual?'实际得分':'预期得分';
  const chooseRound=(id:number)=>{setSelectedRound(id);setRankPage(0);setPlayerQuery('');const url=new URL(location.href);url.searchParams.set('gw',String(id));history.replaceState(null,'',url);};
  const searchResults = useMemo(() => Object.values(active.picks).flat().filter((player) => `${player.name} ${player.fullName} ${player.team}`.toLowerCase().includes(playerQuery.trim().toLowerCase())).sort((a, b) => b.score - a.score), [active.picks, playerQuery]);
  const ranked = active.picks[rankPosition];
  const rankPages = Math.max(1, Math.ceil(ranked.length / 10));
  const currentRankPage = Math.min(rankPage, rankPages - 1);
  const captain = [...active.startingSeven].sort((a, b) => b.score - a.score || b.reliability - a.reliability)[0];
  const lockout = active.meta.lockoutAt ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(active.meta.lockoutAt)) : "待公布";
  return (
    <main>
      <header className="topbar dashboard-topbar">
        <div className="fantasy-brand-group"><GameSwitcher game="efl" /><a className="brand" href="#top" aria-label="Fantasy EFL 看板首页"><img className="brand-logo" src="./official-fantasy-efl.png" alt="Fantasy EFL" /><span>FANTASY EFL</span></a></div>
        <div className="round-navigation" role="group" aria-label="切换 Gameweek"><button type="button" aria-label="上一个 GW" disabled={roundPosition<=0} onClick={()=>chooseRound(roundIndex[roundPosition-1].id)}><ChevronLeft size={17}/></button><FilterSelect aria-label="选择 GW" value={String(selectedRound)} onValueChange={value=>chooseRound(Number(value))}>{roundIndex.map(r=><option key={r.id} value={String(r.id)}>{r.name} · {r.state==="completed"?"已结束":r.state==="current"?"当前":"待赛"}</option>)}</FilterSelect><button type="button" aria-label="下一个 GW" disabled={roundPosition<0||roundPosition>=roundIndex.length-1} onClick={()=>chooseRound(roundIndex[roundPosition+1].id)}><ChevronRight size={17}/></button></div>
        <nav className="efl-nav"><a href="#recommendations">推荐</a><a href="#stats">场均数据</a><a href={"./personal.html?gw="+selectedRound}>个人数据</a><a href="#clubs">球队</a><a href="#fixtures">赛程</a><a className="grand-prix-link" href="./grand-prix-standing/">大奖赛积分榜</a></nav>
      </header>

      <div className="dashboard-shell" id="top">
        <div className="gw-status" role="status"><strong>{selectedEntry?.name ?? active.meta.roundName}</strong><span>{loading?'正在加载所选 GW…':roundError?roundError:actual?'历史回顾 · 官方实际得分；双赛得分相加':selectedEntry?.state==='current'?'当前 GW · 剩余赛程预期得分，已赛不计入剩余预测':!selectedEntry?.fixtureCount?'赛程待公布 · 暂无预测':'未来 GW · 按当前样本推演，临近比赛时每日重算'}</span>{roundError&&<button type="button" onClick={()=>setRetry(n=>n+1)}>重试</button>}</div>
        <div className={"gw-content"+(pending?' gw-content-pending':'')} aria-busy={pending} inert={pending}>
        <section className="lead-grid">
          <div className="panel selection-panel">
            <div className="section-heading"><div><Sparkles size={18} /><h2>{active.meta.roundName} {actual?"高分阵容 · 回顾":"推荐阵容"}</h2></div><span>截止 {lockout}</span></div>
            {!active.startingSeven.length&&<p className="stats-empty">本 GW 暂无可推荐的剩余赛程</p>}
            <div className={"lineup-pitch"+(!active.startingSeven.length?" lineup-empty":"")} aria-label={`${active.meta.roundName} 七人阵型`}>
              {positions.map((position) => <div className="lineup-row" key={position}>
                {active.startingSeven.filter((player) => player.position === position).map((player) => <div className="lineup-card" key={player.id}>
                  <span className="lineup-position">{position}</span>
                  <RichImage className="lineup-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
                  <RichImage priority className="lineup-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
                  <strong>{player.name}</strong><small>{player.team}</small><span className="lineup-score">{scoreLabel} <b>{player.score.toFixed(1)}</b></span>
                  <FixtureBadges fixtures={player.fixtureBadges} />
                  {!actual && player.id === captain?.id && <span className="lineup-captain" aria-label="队长">C</span>}
                </div>)}
              </div>)}
            </div>
            <div className="team-picks-heading"><Trophy size={16} /><strong>{actual?"高分球队":"推荐球队"}</strong><span>选择 2 队</span></div>
            <div className="team-picks">{active.teams.slice(0, 2).map((team, index) => <article className="team-pick" key={team.id}><span className="team-pick-rank">0{index + 1}</span><RichImage className="team-pick-logo" src={team.logo} alt={`${team.name} 队徽`} /><div className="team-pick-main"><strong>{team.name}</strong><FixtureBadges fixtures={team.fixtureBadges} /></div><b title={actual?"本轮官方实际得分":"本轮剩余赛程预期得分"}>{team.score}</b></article>)}</div>
          </div>
          <section className="panel recommendations" id="recommendations">
          <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>{active.meta.roundName} 球员{scoreLabel}</h2></div><span>截止 {lockout}</span></div>
          {!!active.meta.recentRoundName && <div className="round-data-status">已计入 {active.meta.recentRoundName} 已结算 {active.meta.recentFinalizedGames}/{active.meta.recentTotalGames} 场 · 未赛场次结束后更新预测</div>}
          <div className="pool-toolbar"><label><span>搜索全部球员</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="球员或球队" /></label>{playerQuery.trim() ? <span>{searchResults.length} 人</span> : <div className="ranking-pager" role="group" aria-label="推荐排名翻页" onKeyDown={event=>{if(event.key==="ArrowLeft" || event.key==="ArrowRight"){event.preventDefault();setRankPage(Math.max(0,Math.min(rankPages-1,currentRankPage+(event.key==="ArrowRight"?1:-1))));}}}><button type="button" aria-label="上一页推荐排名" disabled={currentRankPage===0} onClick={()=>setRankPage(currentRankPage-1)}><ChevronLeft size={16}/></button><span>{currentRankPage+1}</span><button type="button" aria-label="下一页推荐排名" disabled={currentRankPage>=rankPages-1} onClick={()=>setRankPage(currentRankPage+1)}><ChevronRight size={16}/></button></div>}</div>
          {playerQuery.trim() ? <div className="player-list">{searchResults.map((player, index) => <PlayerRow actual={actual} player={player} rank={index + 1} key={player.id} />)}{!searchResults.length && <div className="stats-empty">没有找到球员</div>}</div> : <Tabs value={rankPosition} onValueChange={value=>{setRankPosition(value as typeof rankPosition);setRankPage(0);}}>
            <TabsList className="position-tabs" aria-label="位置筛选">
              {positions.map((position) => <TabsTrigger key={position} value={position}>{positionName[position]}</TabsTrigger>)}
            </TabsList>
            {positions.map((position) => (
              <TabsContent value={position} key={position}><div className="player-list">{active.picks[position].slice(currentRankPage*10, (currentRankPage+1)*10).map((player, index) => <PlayerRow actual={actual} player={player} rank={currentRankPage*10 + index + 1} key={player.id} />)}</div></TabsContent>
            ))}
          </Tabs>}
          {!actual&&<details className="model-details"><summary>预期得分如何计算</summary><p>逐场拆成动作分、进球助攻分、零封分和其他分。列表中的“动作得分 / 场”是仅由关键传球、射正、防守动作或扑救获得的每场预期分（结合少量同位置先验估计），不含进球、助攻和零封，也不是动作次数。动作分按 <a href="https://fantasy.efl.com/team" target="_blank" rel="noreferrer">Fantasy EFL</a> 官方逐场门槛计算后求均值；稳定动作仅用约 2–3 场同位置先验收缩，波动较大的进球助攻用约 10 场先验收缩。<a href="https://statz.ai/competitions/championship/xg/players" target="_blank" rel="noreferrer">Statz</a> 球员 xG 通过同队唯一姓名或唯一缩写匹配，并核对出场次数；只对进球分预期做最多 15% 的校正，缺失或样本不足则不使用。对手 xGA 修正进攻，对手 xG 修正零封；不预测对手会制造多少解围、拦截。另乘历史出场概率和最多 ±6% 的预计分钟微调。双赛两场直接相加。</p></details>}
          </section>
        </section>

        <p className="gw-stats-note">{active.statsLabel ?? data.statsLabel}</p>
        {data.sourceHealth&&<div className="gw-stats-note" role="status">最近构建：{formatUpdated(data.sourceHealth.generatedAt)} · {data.sourceHealth.sources.map(s=>`${s.name} ${formatUpdated(s.capturedAt)}${s.access==='cloudflare_challenge'?'（源站验证拦截，沿用快照）':s.access&&s.access!=='ok'?'（抓取受阻，沿用快照）':Date.parse(data.sourceHealth!.generatedAt)-Date.parse(s.capturedAt)>36*3600000?'（沿用旧快照）':''}`).join(' · ')}<br/>动作数据严格匹配：{data.sourceHealth.advancedMatched}/{data.sourceHealth.playerCount} 人；未对齐的指标保留缺失，其他来源独立更新。</div>}
        <OpportunityChart key={"chart-"+active.meta.roundId} historical={actual} roundId={active.meta.roundId} historyFile={data.chartHistoryFile} fixtures={active.fixtures??[]} players={playerStats} teams={teamStats} xgUpdatedAt={active.meta.xgUpdatedAt} officialUpdatedAt={active.meta.updatedAt} />

        <StatsTable key={"stats-"+active.meta.roundId} players={playerStats} roundId={active.meta.roundId} />
        <TeamStatsTable key={"teams-"+active.meta.roundId} teams={teamStats} />

        <section className="lower-grid merged-teams">
          <div id="clubs"><RoundFixtures key={active.meta.roundId} calendarFile={data.fixtureMatrixFile} roundId={active.meta.roundId} roundName={active.meta.roundName}/></div>

        </section>
        {data.setPieces&&<SetPieceTable data={data.setPieces}/>}

        </div>
        <footer><span>FANTASY EFL DATA BOARD</span><span>官方数据 · GW 赛程</span></footer>
      </div>
    </main>
  );
}
