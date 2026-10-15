"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ChartScatter, Crosshair, Newspaper, Sparkles, Trophy } from "lucide-react";
import { leagueOptions, includesLeague, leagueLabel } from "@/lib/league-selection";
import { chartDomain, formatChartTick } from "@/lib/chart-scale";
import { exportChartPng } from "@/lib/export-chart";
import { FilterSelect } from "@/components/ui/filter-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, FixtureBadge, PlayerPick, PlayerStat, StatKey, TeamStat } from "@/lib/dashboard-data";

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

function PlayerRow({ player, rank }: { player: PlayerPick; rank: number }) {
  return (
    <article className="player-row">
      <div className="rank">{String(rank).padStart(2, "0")}</div>
      <div className="player-visual">
        <RichImage className="player-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
        <RichImage className="mini-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
      </div>
      <div className="player-main">
        <div className="player-title"><strong>{player.name}</strong><span className={`pill pill-${labelFor(player)}`}>{labelFor(player)}</span></div>
        <div className="player-meta"><span>{player.team}</span><span>{player.fixtures.join(" · ")}</span><span title="按官方逐场门槛计算关键传球、射正、解围、封堵、抢断、拦截或扑救的得分，再结合少量同位置先验估计；不含进球、助攻和零封分。">动作得分 {player.actionScore.toFixed(1)} / 场</span></div>
      </div>
      <div className="player-stat"><span>预计分钟</span><b>{player.expectedMinutes}′</b></div>
      <div className="player-stat ownership-stat"><span>持有</span><b>{player.ownership}%</b></div>
      <div className="player-stat desktop-stat"><span>对阵</span><b>{player.matchup > 0 ? "+" : ""}{player.matchup}%</b></div>
      <div className="score"><span>预期得分</span><b>{player.score}</b></div>
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
function applicableStat(key: StatKey, position: string) {
  return positionStats[position]?.has(key) ?? false;
}

function StatsTable({ players }: { players: PlayerStat[] }) {
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState("ALL");
  const [position, setPosition] = useState("OUT");
  const [minimum, setMinimum] = useState(3);
  const [sortKey, setSortKey] = useState<StatKey | "appearances">("points");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const columns = statColumns.filter(({ key }) => position === "ALL" || (position === "OUT" ? !keeperOnly.has(key) : applicableStat(key, position)));
  const effectiveSortKey = sortKey === "appearances" || columns.some(column => column.key === sortKey) ? sortKey : "points";
  const filtered = useMemo(() => players
    .filter((player) => player.appearances >= minimum && includesLeague(competition, player.competitionId) && (position === "ALL" || position === "OUT" && player.position !== "GK" || player.position === position) && `${player.fullName} ${player.team}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const left = effectiveSortKey === "appearances" ? a.appearances : a.perGame[effectiveSortKey];
      const right = effectiveSortKey === "appearances" ? b.appearances : b.perGame[effectiveSortKey];
      return (descending ? right - left : left - right) || b.appearances - a.appearances || a.fullName.localeCompare(b.fullName);
    }), [players, minimum, competition, position, query, effectiveSortKey, descending]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 30));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 30, (currentPage + 1) * 30);
  const changeSort = (key: StatKey | "appearances") => {
    setDescending(effectiveSortKey === key ? !descending : true);
    setSortKey(key);
    setPage(0);
  };
  const sortHeading = (key: StatKey | "appearances", label: string) => (
    <th key={key} scope="col" aria-sort={effectiveSortKey === key ? (descending ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => changeSort(key)}>{label}<span aria-hidden="true">{effectiveSortKey === key ? (descending ? "↓" : "↑") : "↕"}</span></button>
    </th>
  );
  return (
    <section className="panel stats-panel" id="stats">
      <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>球员场均数据</h2></div><span>Fantasy EFL 官方比赛数据</span></div>
      <div className="stats-toolbar">
        <label><span>搜索</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="球员或球队" /></label>
        <label><span>联赛级别</span><FilterSelect value={competition} onValueChange={(value) => { setCompetition(value); setPage(0); }}>{leagueOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect></label>
        <label><span>位置</span><FilterSelect value={position} onValueChange={(value) => { setPosition(value); setPage(0); }}><option value="OUT">非门将</option><option value="ALL">全部位置</option>{positions.map((item) => <option key={item} value={item}>{positionName[item]}</option>)}</FilterSelect></label>
        <label><span>至少出场</span><FilterSelect value={minimum} onValueChange={(value) => { setMinimum(Number(value)); setPage(0); }}><option value={1}>1 场</option><option value={3}>3 场</option><option value={5}>5 场</option></FilterSelect></label>
        <span className="stats-count">{filtered.length} 人</span>
      </div>
      <div className="stats-scroll" role="region" aria-label="球员场均数据表，可横向滚动" tabIndex={0}>
        <table className="stats-table">
          <thead><tr><th scope="col" className="stats-name-col">球员</th><th scope="col">位置</th>{sortHeading("appearances", "出场")}{columns.map(({ key, label }) => sortHeading(key, label))}</tr></thead>
          <tbody>{visible.map((player) => <tr key={player.id}><th scope="row" className="stats-name-col"><strong>{player.fullName}</strong><small>{player.team}</small></th><td>{player.position}</td><td>{player.appearances}</td>{columns.map(({ key }) => <td key={key} className={!applicableStat(key, player.position) ? "stats-inapplicable" : player.perGame[key] === 0 ? "stats-zero" : undefined} aria-label={!applicableStat(key, player.position) ? "该位置不适用" : undefined}>{!applicableStat(key, player.position) ? "" : player.perGame[key] === 0 ? "—" : player.perGame[key].toFixed(key === "minutesPlayed" ? 1 : 2)}</td>)}</tr>)}</tbody>
        </table>
        {!visible.length && <div className="stats-empty">没有符合条件的球员</div>}
      </div>
      <div className="stats-footer"><span>场均 = 已完成比赛累计 ÷ 出场次数；— = 真实零次；空白 = 该位置不适用</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
    </section>
  );
}

function formatUpdated(value: string) { return value ? new Intl.DateTimeFormat("zh-CN", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai"}).format(new Date(value)) : "—"; }

type AnalyticsDatum = { id: string; name: string; image: string; x: number; y: number; subtitle: string; detail: string };

function OpportunityChart({ players, teams, xgUpdatedAt, officialUpdatedAt }: { players: PlayerStat[]; teams: TeamStat[]; xgUpdatedAt: string; officialUpdatedAt: string }) {
  const [mode, setMode] = useState<"team" | "player">("team");
  const [competition, setCompetition] = useState("10");
  const [position, setPosition] = useState("ATT");
  const [minimum, setMinimum] = useState(450);
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
  const [xKey, setXKey] = useState("xgPerGame");
  const [yKey, setYKey] = useState("xgaPerGame");
  const metrics = mode === "team" ? [
    {key:"xgPerGame",label:"预期进球 · xG / 场",group:"预期表现"},
    {key:"xgaPerGame",label:"预期失球 · xGA / 场",group:"预期表现"},
    {key:"xgdPerGame",label:"预期净胜球 · xGD / 场",group:"预期表现"},
    {key:"xgShare",label:"预期进球占比 · %",group:"预期表现"},
    {key:"xptsPerGame",label:"预期积分 · xPts / 场",group:"预期表现"},
    {key:"pointsDeltaPerGame",label:"积分超预期 / 场",group:"实际与预期偏差"},
    {key:"finishingDeltaPerGame",label:"进球超预期 / 场",group:"实际与预期偏差"},
    {key:"goalsPerGame",label:"进球 / 场",group:"比赛结果"},
    {key:"winRate",label:"胜率 · %",group:"比赛结果"},
    {key:"cleanSheetRate",label:"零封率 · %",group:"比赛结果"},
    {key:"pointsPerGame",label:"联赛积分 / 场",group:"比赛结果"},
  ] : [
    ...(position !== "GK" ? [{key:"xg90",label:"预期进球 / 90",group:"预期与效率"},{key:"goals90",label:"实际进球 / 90",group:"预期与效率"},{key:"goalInvolvements90",label:"进球 + 助攻 / 90",group:"预期与效率"},{key:"keyPasses90",label:"关键传球 / 90",group:"预期与效率"},{key:"shotsOnTarget90",label:"射正 / 90",group:"预期与效率"},{key:"defensiveActions90",label:"防守动作 / 90",group:"预期与效率"}] : [{key:"saveRate",label:"扑救率 · %",group:"门将效率"}]),
    {key:"ownership",label:"持有率 · %",group:"样本与热度"},{key:"appearances",label:"出场次数",group:"样本与热度"},
    ...statColumns.filter(({key})=>position === "ALL" || (position === "ATT" ? applicableStat(key, "MID") || applicableStat(key, "FWD") : applicableStat(key, position))).map(({key,label})=>({key,label:label+" / 场",group:keeperOnly.has(key)?"门将动作":"基础场均"}))];
  const activeXKey = metrics.some(m=>m.key===xKey) ? xKey : "points";
  const activeYKey = metrics.some(m=>m.key===yKey) ? yKey : "minutesPlayed";
  const xLabel = metrics.find(m=>m.key===activeXKey)?.label ?? activeXKey;
  const yLabel = metrics.find(m=>m.key===activeYKey)?.label ?? activeYKey;
  const lowerBetter = (key: string) => ["xgaPerGame","goalsConceded","yellowCards","redCards","ownGoals","penaltyMisses"].includes(key);
  const valueFor = (row: TeamStat | PlayerStat, key: string): number | null => {
    if ("perGame" in row) {
      const stats = row.perGame;
      if (key in stats && !applicableStat(key as StatKey, row.position)) return null;
      const per90: Record<string, number> = {goalInvolvements90: stats.goalsScored + stats.assists, keyPasses90: stats.keyPasses, shotsOnTarget90: stats.shotsOnTarget, defensiveActions90: stats.clearances + stats.blocks + stats.tackles + stats.interceptions};
      if (key in per90) return row.position !== "GK" && stats.minutesPlayed > 0 ? per90[key] * 90 / stats.minutesPlayed : null;
      if (key === "saveRate") return row.position === "GK" && stats.saves + stats.goalsConceded > 0 ? 100 * stats.saves / (stats.saves + stats.goalsConceded) : null;
    }
    const value = "perGame" in row && key in row.perGame ? row.perGame[key as StatKey] : (row as unknown as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const candidates = mode === "team" ? teams.filter(t=>includesLeague(competition,t.competitionId)) : players.filter(p=>p.perGame.minutesPlayed*p.appearances>=minimum && includesLeague(competition,p.competitionId) && (position==="ALL" || position==="ATT" && ["MID","FWD"].includes(p.position) || p.position===position));
  const dots: AnalyticsDatum[] = candidates.flatMap(row=>{
    const xv=valueFor(row,activeXKey), yv=valueFor(row,activeYKey); if(xv==null || yv==null) return [];
    return [{id:mode+row.id,name:"perGame" in row ? row.fullName : row.name,image:"perGame" in row ? row.jerseyUrl : row.logo,x:xv,y:yv,subtitle:"perGame" in row ? row.team+" · "+row.appearances+" 场" : competitionName[row.competitionId]+" · "+row.played+" 场",detail:xLabel+" "+xv.toFixed(2)+" · "+yLabel+" "+yv.toFixed(2)}];
  });
  const selected = dots.find(d=>d.id===hovered);
  const comparison = mode==="player" && activeXKey==="xg90" && activeYKey==="goals90";
  const playerMaximum = chartDomain(dots.flatMap(d=>[d.x,d.y]))[1];
  const xDomain: [number,number] = comparison ? chartDomain(dots.flatMap(d=>[d.x,d.y])) : chartDomain(dots.map(d=>d.x));
  const yDomain: [number,number] = comparison ? chartDomain(dots.flatMap(d=>[d.x,d.y])) : chartDomain(dots.map(d=>d.y));
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
      { x: px + 17, y: py - 19 }, { x: px - labelWidth - 17, y: py - 19 },
      { x: px + 17, y: py + 5 }, { x: px - labelWidth - 17, y: py + 5 },
    ];
    for (const box of candidates.map((candidate) => ({ ...candidate, width: labelWidth, height: 18 }))) {
      if (box.x < left || box.y < top || box.x + box.width > right || box.y + box.height > bottom) continue;
      if (labels.some((label) => box.x < label.box.x + label.box.width + 5 && box.x + box.width + 5 > label.box.x && box.y < label.box.y + label.box.height + 5 && box.y + box.height + 5 > label.box.y)) continue;
      if (dots.some((other) => other.id !== datum.id && x(other.x) > box.x - 14 && x(other.x) < box.x + box.width + 14 && y(other.y) > box.y - 14 && y(other.y) < box.y + box.height + 14)) continue;
      labels.push({ id: datum.id, name: datum.name, x: box.x, y: box.y + 13, box });
      break;
    }
  }
  const tooltipX = selected ? Math.min(right - 310, Math.max(left, x(selected.x) + 18)) : 0;
  const tooltipY = selected ? Math.min(bottom - 140, Math.max(top, y(selected.y) - 148)) : 0;
  const statzCompetition = competition === "11" ? "league-one" : competition === "12" ? "league-two" : "championship";
  const statzUrl = `https://statz.ai/competitions/${statzCompetition}/xg${mode === "player" ? "/players" : ""}`;
  const changeMode = (value: "team" | "player") => { setMode(value); setXKey(value === "team" ? "xgPerGame" : "xg90"); setYKey(value === "team" ? "xgaPerGame" : "goals90"); setHovered(null); };
  return <section className="panel opportunity-panel" id="chart">
    <div className="analytics-layout">
      <aside className="analytics-sidebar">
        <div className="section-heading"><div><ChartScatter size={18} /><h2>可视化表格</h2></div></div>
        <div className="analytics-switch" role="group" aria-label="图表对象">
          <button type="button" onClick={() => changeMode("player")} aria-pressed={mode === "player"}>球员</button>
          <button type="button" onClick={() => changeMode("team")} aria-pressed={mode === "team"}>球队</button>
        </div>
        {(["横轴","纵轴"] as const).map((label,index)=><label className="analytics-metric" key={label}><span>{label}</span><FilterSelect aria-label={label+"数据"} value={index===0?activeXKey:activeYKey} onValueChange={value=>{(index===0?setXKey:setYKey)(value);setHovered(null);}}>{metrics.map(m=><option key={m.key} value={m.key} data-group={m.group}>{m.label}</option>)}</FilterSelect></label>)}
        <div className="chart-controls">
          <label>联赛级别<FilterSelect value={competition} onValueChange={(value) => { setCompetition(value); setHovered(null); }}>{leagueOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect></label>
          {mode === "player" && <><label>位置<FilterSelect value={position} onValueChange={(value) => { setPosition(value); setHovered(null); }}><option value="ATT">中场 + 前锋</option><option value="ALL">全部位置</option><option value="MID">中场</option><option value="FWD">前锋</option><option value="DEF">后卫</option><option value="GK">门将</option></FilterSelect></label><label>至少出场<FilterSelect value={minimum} onValueChange={(value) => { setMinimum(Number(value)); setHovered(null); }}><option value={270}>270 分钟</option><option value={450}>450 分钟</option><option value={900}>900 分钟</option></FilterSelect></label></>}
        </div>
        <div className="analytics-count">{dots.length} {mode === "team" ? "支球队" : "名球员"} · 缺失 {candidates.length-dots.length}</div>
        <p className="chart-note">数据：<a href={statzUrl} target="_blank" rel="noreferrer">Statz xG</a> / <a href="https://fantasy.efl.com" target="_blank" rel="noreferrer">Fantasy EFL</a><br />官方抓取：{formatUpdated(officialUpdatedAt)}<br />xG 抓取：{formatUpdated(xgUpdatedAt)}<br />每小时尝试更新，以源站发布为准。官方统计仅含确认完赛；xG 为源站赛季累计。<br />场均按出场计算；每 90 按官方比赛分钟计算（xG 除外）。缺失不计作零；失球等指标自动反向。</p>
        <details className="metric-methodology"><summary>进阶指标怎么看</summary><p>xGD = xG − xGA；xG 占比 = xG ÷ (xG + xGA)。xPts 来自 Statz 的逐场泊松模型。球队预期与偏差指标均使用 Statz 同一批比赛。</p><p>每 90 指标控制出场时间，但仍受战术与对手影响。防守动作 = 解围 + 封堵 + 抢断 + 拦截；扑救率 = 扑救 ÷ (扑救 + 失球)，不等于预期扑救表现。超预期指标描述结果偏差，不代表稳定能力。建议使用至少 900 分钟样本。</p></details>
      </aside>
      <div className="analytics-visual">
        <div className="analytics-visual-heading"><strong>{xLabel+" × "+yLabel}</strong><div className="chart-heading-actions"><span>{comparison?"虚线：实际进球 = xG":"虚线：当前样本均值"}</span><button className="chart-export" type="button" disabled={exporting || !dots.length} onClick={async () => {
          if (!svgRef.current) return;
          setExporting(true); setExportStatus("正在生成图片…");
          try {
            const fallbackCount = await exportChartPng(svgRef.current, { title: xLabel + " × " + yLabel, description: (mode === "team" ? "球队" : "球员") + " · " + leagueLabel(competition) + (mode === "player" ? " · " + (positionName[position as keyof typeof positionName] ?? (position === "ATT" ? "中场 + 前锋" : "全部位置")) + " · 至少 " + minimum + " 分钟" : "") + " · " + dots.length + " 个有效数据点 · 缺失 " + (candidates.length - dots.length), source: "Fantasy EFL / Statz · 官方抓取 " + formatUpdated(officialUpdatedAt) + " · xG 抓取 " + formatUpdated(xgUpdatedAt) + "（北京时间）", filename: "fantasy-efl-" + mode + "-" + activeXKey + "-" + activeYKey + ".png" });
            setExportStatus(fallbackCount ? "图片已导出，部分球衣无法加载，已以文字标记替代。" : "图片已导出");
          } catch { setExportStatus("导出失败，请重试。"); }
          finally { setExporting(false); }
        }}><Download size={15} />{exporting ? "导出中…" : "导出图片"}</button></div></div>
        {exportStatus && <p className="chart-export-status" role="status">{exportStatus}</p>}
        {candidates.length > dots.length && <details className="chart-missing"><summary>{candidates.length-dots.length} 个对象缺少所选指标，查看名单</summary><p>{candidates.filter(row=>valueFor(row,activeXKey)==null || valueFor(row,activeYKey)==null).map(row=>("perGame" in row ? row.fullName : row.name)).join("、")}</p></details>}
        <div className="chart-svg-wrap"><svg ref={svgRef} className="opportunity-svg" viewBox="0 0 820 820" role="img" aria-label={xLabel+" 与 "+yLabel+" 散点图"}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const xv = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
            const yv = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
            return <g key={fraction}><line className="chart-grid" x1={x(xv)} x2={x(xv)} y1={top} y2={bottom} /><line className="chart-grid" x1={left} x2={right} y1={y(yv)} y2={y(yv)} /><text className="chart-tick" x={x(xv)} y={bottom + 24} textAnchor="middle">{formatChartTick(xv, xDomain)}</text><text className="chart-tick" x={left - 12} y={y(yv) + 4} textAnchor="end">{formatChartTick(yv, yDomain)}</text></g>;
          })}
          {!comparison ? <><line className="chart-midline" x1={x(dots.reduce((sum,d)=>sum+d.x,0)/Math.max(1,dots.length))} x2={x(dots.reduce((sum,d)=>sum+d.x,0)/Math.max(1,dots.length))} y1={top} y2={bottom} /><line className="chart-midline" x1={left} x2={right} y1={y(dots.reduce((sum,d)=>sum+d.y,0)/Math.max(1,dots.length))} y2={y(dots.reduce((sum,d)=>sum+d.y,0)/Math.max(1,dots.length))} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">{activeXKey==="xgPerGame" && activeYKey==="xgaPerGame" ? "攻强 · 守强" : ""}</text></> : <><line className="chart-midline" x1={x(Math.max(xDomain[0], yDomain[0]))} y1={y(Math.max(xDomain[0], yDomain[0]))} x2={x(playerMaximum)} y2={y(playerMaximum)} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">进球多于预期</text></>}
          <defs>{dots.filter((datum) => datum.image).map((datum) => <clipPath id={"analytics-clip-" + datum.id} key={datum.id}><circle cx={x(datum.x)} cy={y(datum.y)} r={11} /></clipPath>)}</defs>
          {dots.map((datum) => <g key={datum.id} className={"chart-jersey-dot" + (hovered === datum.id ? " chart-dot-active" : "")} tabIndex={0} role="button" aria-label={datum.name + "，" + datum.detail} onMouseEnter={() => setHovered(datum.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(datum.id)} onBlur={() => setHovered(null)} onClick={() => setHovered(datum.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHovered(datum.id); } }}>
            <circle className="chart-jersey-bg" cx={x(datum.x)} cy={y(datum.y)} r={12} />
            {datum.image && loadChartImages && <image href={datum.image} x={x(datum.x) - 11} y={y(datum.y) - 11} width={22} height={22} preserveAspectRatio="xMidYMid meet" clipPath={"url(#analytics-clip-" + datum.id + ")"} pointerEvents="none" />}
            <circle className="chart-jersey-hit" cx={x(datum.x)} cy={y(datum.y)} r={16} />
          </g>)}
          {labels.filter((label) => label.id !== hovered).map((label) => <text className="chart-player-label" key={label.id} x={label.x} y={label.y}>{label.name}</text>)}
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
        </svg>{!dots.length && <p className="stats-empty">当前筛选无可用数据，请更换指标或降低出场门槛。</p>}</div>
      </div>
    </div>
  </section>;
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [playerQuery, setPlayerQuery] = useState("");
  const [rankPosition, setRankPosition] = useState<typeof positions[number]>("GK");
  const [rankPage, setRankPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const active = data.upcomingRound && now >= Date.parse(data.upcomingRound.meta.lockoutAt) ? data.upcomingRound : data;
  const searchResults = useMemo(() => Object.values(active.picks).flat().filter((player) => `${player.name} ${player.fullName} ${player.team}`.toLowerCase().includes(playerQuery.trim().toLowerCase())).sort((a, b) => b.score - a.score), [active.picks, playerQuery]);
  const ranked = active.picks[rankPosition];
  const rankPages = Math.max(1, Math.ceil(ranked.length / 10));
  const currentRankPage = Math.min(rankPage, rankPages - 1);
  const captain = [...active.startingSeven].sort((a, b) => b.score - a.score || b.reliability - a.reliability)[0];
  const lockout = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(active.meta.lockoutAt));
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fantasy EFL 看板首页"><img className="brand-logo" src="https://fantasy.efl.com/apple-touch-icon.png" alt="Fantasy EFL" /><span>FANTASY EFL</span></a>
        <nav><a href="#recommendations">推荐</a><a href="#stats">场均数据</a><a href="#clubs">球队</a><a href="#news">新闻</a></nav>
      </header>

      <div className="dashboard-shell" id="top">
        <section className="lead-grid">
          <div className="panel selection-panel">
            <div className="section-heading"><div><Sparkles size={18} /><h2>{active.meta.roundName} 推荐阵容</h2></div><span>截止 {lockout}</span></div>
            <div className="lineup-pitch" aria-label={`${active.meta.roundName} 七人阵型`}>
              {positions.map((position) => <div className="lineup-row" key={position}>
                {active.startingSeven.filter((player) => player.position === position).map((player) => <div className="lineup-card" key={player.id}>
                  <span className="lineup-position">{position}</span>
                  <RichImage className="lineup-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
                  <RichImage priority className="lineup-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
                  <strong>{player.name}</strong><small>{player.team}</small><span className="lineup-score">预期得分 <b>{player.score.toFixed(1)}</b></span>
                  <FixtureBadges fixtures={player.fixtureBadges} />
                  {player.id === captain?.id && <span className="lineup-captain" aria-label="队长">C</span>}
                </div>)}
              </div>)}
            </div>
            <div className="team-picks-heading"><Trophy size={16} /><strong>推荐球队</strong><span>选择 2 队</span></div>
            <div className="team-picks">{active.teams.slice(0, 2).map((team, index) => <article className="team-pick" key={team.id}><span className="team-pick-rank">0{index + 1}</span><RichImage className="team-pick-logo" src={team.logo} alt={`${team.name} 队徽`} /><div className="team-pick-main"><strong>{team.name}</strong><FixtureBadges fixtures={team.fixtureBadges} /></div><b>{team.score}</b></article>)}</div>
          </div>
          <section className="panel recommendations" id="recommendations">
          <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>{active.meta.roundName} 球员预期得分</h2></div><span>截止 {lockout}</span></div>
          {!!active.meta.recentRoundName && <div className="round-data-status">已计入 {active.meta.recentRoundName} 已结算 {active.meta.recentFinalizedGames}/{active.meta.recentTotalGames} 场 · 未赛场次结束后更新预测</div>}
          <div className="pool-toolbar"><label><span>搜索全部球员</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="球员或球队" /></label>{playerQuery.trim() ? <span>{searchResults.length} 人</span> : <div className="ranking-pager" role="group" aria-label="推荐排名翻页" onKeyDown={event=>{if(event.key==="ArrowLeft" || event.key==="ArrowRight"){event.preventDefault();setRankPage(Math.max(0,Math.min(rankPages-1,currentRankPage+(event.key==="ArrowRight"?1:-1))));}}}><button type="button" aria-label="上一页推荐排名" disabled={currentRankPage===0} onClick={()=>setRankPage(currentRankPage-1)}><ChevronLeft size={16}/></button><span>{currentRankPage*10+1}–{Math.min((currentRankPage+1)*10,ranked.length)} <small>/ {ranked.length}</small></span><button type="button" aria-label="下一页推荐排名" disabled={currentRankPage>=rankPages-1} onClick={()=>setRankPage(currentRankPage+1)}><ChevronRight size={16}/></button></div>}</div>
          {playerQuery.trim() ? <div className="player-list">{searchResults.map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}{!searchResults.length && <div className="stats-empty">没有找到球员</div>}</div> : <Tabs value={rankPosition} onValueChange={value=>{setRankPosition(value as typeof rankPosition);setRankPage(0);}}>
            <TabsList className="position-tabs" aria-label="位置筛选">
              {positions.map((position) => <TabsTrigger key={position} value={position}>{positionName[position]}</TabsTrigger>)}
            </TabsList>
            {positions.map((position) => (
              <TabsContent value={position} key={position}><div className="player-list">{active.picks[position].slice(currentRankPage*10, (currentRankPage+1)*10).map((player, index) => <PlayerRow player={player} rank={currentRankPage*10 + index + 1} key={player.id} />)}</div></TabsContent>
            ))}
          </Tabs>}
          <details className="model-details"><summary>预期得分如何计算</summary><p>逐场拆成动作分、进球助攻分、零封分和其他分。列表中的“动作得分 / 场”是仅由关键传球、射正、防守动作或扑救获得的每场预期分（结合少量同位置先验估计），不含进球、助攻和零封，也不是动作次数。动作分按 <a href="https://fantasy.efl.com/team" target="_blank" rel="noreferrer">Fantasy EFL</a> 官方逐场门槛计算后求均值；稳定动作仅用约 2–3 场同位置先验收缩，波动较大的进球助攻用约 10 场先验收缩。<a href="https://statz.ai/competitions/championship/xg/players" target="_blank" rel="noreferrer">Statz</a> 球员 xG 只对进球分预期做最多 15% 的校正，缺失或样本不足则不使用。对手 xGA 修正进攻，对手 xG 修正零封；不预测对手会制造多少解围、拦截。另乘历史出场概率和最多 ±6% 的预计分钟微调。双赛两场直接相加。</p></details>
          </section>
        </section>

        <OpportunityChart players={data.playerStats} teams={data.teamStats} xgUpdatedAt={data.meta.xgUpdatedAt} officialUpdatedAt={data.meta.updatedAt} />

        <StatsTable players={data.playerStats} />

        <section className="lower-grid">
          <div className="panel" id="clubs">
            <div className="section-heading"><div><Trophy size={18} /><h2>球队选择</h2></div><span>前五</span></div>
            <div className="club-list">
              {active.teams.map((team, index) => (
                <article className="club-row" key={team.id}>
                  <span className="club-rank">{index + 1}</span><RichImage className="club-logo" src={team.logo} alt={`${team.name} 队徽`} /><div><strong>{team.name}</strong><small>{team.fixtures.join(" · ")}</small></div>
                  <div className="club-form">{team.form.map((item, i) => <i key={`${item}-${i}`}>{item}</i>)}</div><b>{team.score}</b>
                </article>
              ))}
            </div>
          </div>

          <div className="panel" id="news">
            <div className="section-heading"><div><Newspaper size={18} /><h2>EFL 新闻</h2></div><span>{data.news.length} 条</span></div>
            <div className="news-list">
              {data.news.map(item=><article className="news-card" key={item.url}>
                <div className="news-card-meta"><span>{item.category ?? "赛场动态"}</span><time>{item.date}</time><a href={item.url} target="_blank" rel="noreferrer">原文 ↗</a></div>
                <h3>{item.titleZh ?? "EFL 最新赛场动态"}</h3><p className="news-summary">{item.summary ?? "查看原文了解赛场信息。"}</p>
                <div className="news-impacts">{item.impacts?.map((impact,index)=><div className={"news-impact news-impact-"+impact.kind} key={index}><span>{impact.kind==="positive"?"利好观察":impact.kind==="negative"?"风险提醒":impact.kind==="injury"?"伤停动态":"选人提示"}</span><p>{impact.text}</p></div>)}</div>
                <small className="news-analysis-note">消息来源：{item.source} · Fantasy 影响为判断，不自动调整模型分数</small>
              </article>)}
            </div>
          </div>
        </section>

        <footer><span>FANTASY EFL DATA BOARD</span><span>官方数据 · EFL 新闻</span></footer>
      </div>
    </main>
  );
}
