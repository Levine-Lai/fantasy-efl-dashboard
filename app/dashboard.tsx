"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartScatter, Crosshair, Newspaper, Sparkles, Trophy } from "lucide-react";
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

function RichImage({ src, fallback, alt, className }: { src: string; fallback?: string; alt: string; className: string }) {
  return <img className={className} src={src || fallback} alt={alt} loading="lazy" onError={(event) => { if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback; else event.currentTarget.style.visibility = "hidden"; }} />;
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
        <div className="player-meta"><span>{player.team}</span><span>{player.fixtures.join(" · ")}</span><span>动作 {player.actionScore.toFixed(1)} / 场</span></div>
      </div>
      <div className="player-stat"><span>预计分钟</span><b>{player.expectedMinutes}′</b></div>
      <div className="player-stat ownership-stat"><span>持有</span><b>{player.ownership}%</b></div>
      <div className="player-stat desktop-stat"><span>对阵</span><b>{player.matchup > 0 ? "+" : ""}{player.matchup}%</b></div>
      <div className="score"><span>预计分</span><b>{player.score}</b></div>
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
  { key: "yellowCards", label: "黄牌" }, { key: "redCards", label: "红牌" },
  { key: "ownGoals", label: "乌龙" }, { key: "penaltyMisses", label: "失点" },
  { key: "hatTricks", label: "帽子戏法" },
];

function StatsTable({ players }: { players: PlayerStat[] }) {
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState("ALL");
  const [position, setPosition] = useState("ALL");
  const [minimum, setMinimum] = useState(3);
  const [sortKey, setSortKey] = useState<StatKey | "appearances">("points");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => players
    .filter((player) => player.appearances >= minimum && (competition === "ALL" || player.competitionId === Number(competition)) && (position === "ALL" || player.position === position) && `${player.fullName} ${player.team}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const left = sortKey === "appearances" ? a.appearances : a.perGame[sortKey];
      const right = sortKey === "appearances" ? b.appearances : b.perGame[sortKey];
      return (descending ? right - left : left - right) || b.appearances - a.appearances || a.fullName.localeCompare(b.fullName);
    }), [players, minimum, competition, position, query, sortKey, descending]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 30));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 30, (currentPage + 1) * 30);
  const changeSort = (key: StatKey | "appearances") => {
    setDescending(sortKey === key ? !descending : true);
    setSortKey(key);
    setPage(0);
  };
  const sortHeading = (key: StatKey | "appearances", label: string) => (
    <th key={key} scope="col" aria-sort={sortKey === key ? (descending ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => changeSort(key)}>{label}<span aria-hidden="true">{sortKey === key ? (descending ? "↓" : "↑") : "↕"}</span></button>
    </th>
  );
  return (
    <section className="panel stats-panel" id="stats">
      <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>球员场均数据</h2></div><span>Fantasy EFL 官方比赛数据</span></div>
      <div className="stats-toolbar">
        <label><span>搜索</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="球员或球队" /></label>
        <label><span>联赛级别</span><select value={competition} onChange={(event) => { setCompetition(event.target.value); setPage(0); }}><option value="ALL">全部级别</option><option value="10">英冠</option><option value="11">英甲</option><option value="12">英乙</option></select></label>
        <label><span>位置</span><select value={position} onChange={(event) => { setPosition(event.target.value); setPage(0); }}><option value="ALL">全部</option>{positions.map((item) => <option key={item} value={item}>{positionName[item]}</option>)}</select></label>
        <label><span>至少出场</span><select value={minimum} onChange={(event) => { setMinimum(Number(event.target.value)); setPage(0); }}><option value={1}>1 场</option><option value={3}>3 场</option><option value={5}>5 场</option></select></label>
        <span className="stats-count">{filtered.length} 人</span>
      </div>
      <div className="stats-scroll" role="region" aria-label="球员场均数据表，可横向滚动" tabIndex={0}>
        <table className="stats-table">
          <thead><tr><th scope="col" className="stats-name-col">球员</th><th scope="col">位置</th>{sortHeading("appearances", "出场")}{statColumns.map(({ key, label }) => sortHeading(key, label))}</tr></thead>
          <tbody>{visible.map((player) => <tr key={player.id}><th scope="row" className="stats-name-col"><strong>{player.fullName}</strong><small>{player.team}</small></th><td>{player.position}</td><td>{player.appearances}</td>{statColumns.map(({ key }) => <td key={key} className={player.perGame[key] === 0 ? "stats-zero" : undefined}>{player.perGame[key] === 0 ? "—" : player.perGame[key].toFixed(key === "minutesPlayed" ? 1 : 2)}</td>)}</tr>)}</tbody>
        </table>
        {!visible.length && <div className="stats-empty">没有符合条件的球员</div>}
      </div>
      <div className="stats-footer"><span>场均 = 已完成比赛累计 ÷ 出场次数；— = 真实零次</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
    </section>
  );
}

type AnalyticsDatum = { id: string; name: string; image: string; x: number; y: number; subtitle: string; detail: string };

function chartDomain(values: number[], includeZero = false): [number, number] {
  if (!values.length) return [0, 1];
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max(0.08, (high - low) * 0.14);
  const minimum = includeZero ? 0 : Math.max(0, Math.floor((low - padding) * 10) / 10);
  const maximum = Math.ceil((high + padding) * 10) / 10;
  return [minimum, Math.max(minimum + 0.2, maximum)];
}

function OpportunityChart({ players, teams, xgUpdatedAt }: { players: PlayerStat[]; teams: TeamStat[]; xgUpdatedAt: string }) {
  const [mode, setMode] = useState<"team" | "player">("team");
  const [competition, setCompetition] = useState("10");
  const [position, setPosition] = useState("ATT");
  const [minimum, setMinimum] = useState(450);
  const [hovered, setHovered] = useState<string | null>(null);
  const dots = useMemo<AnalyticsDatum[]>(() => mode === "team"
    ? teams.filter((team) => competition === "ALL" || team.competitionId === Number(competition)).map((team) => ({
      id: "team-" + team.id, name: team.name, image: team.logo, x: team.xgPerGame, y: team.xgaPerGame,
      subtitle: competitionName[team.competitionId] + " · " + team.played + " 场",
      detail: "xG/场 " + team.xgPerGame.toFixed(2) + " · xGA/场 " + team.xgaPerGame.toFixed(2),
    }))
    : players.filter((player) => player.position !== "GK" && player.xg90 != null && player.goals90 != null && player.xgMinutes != null && player.xgMinutes >= minimum && (competition === "ALL" || player.competitionId === Number(competition)) && (position === "ALL" || position === "ATT" && player.position !== "DEF" || player.position === position)).map((player) => ({
      id: "player-" + player.id, name: player.fullName, image: player.jerseyUrl, x: player.xg90!, y: player.goals90!,
      subtitle: player.team + " · " + competitionName[player.competitionId] + " · " + Math.round(player.xgMinutes!) + " 分钟",
      detail: "xG/90 " + player.xg90!.toFixed(2) + " · 进球/90 " + player.goals90!.toFixed(2) + " · 进球 " + (player.seasonGoals ?? 0),
    })), [mode, teams, players, competition, position, minimum]);
  const selected = dots.find((datum) => datum.id === hovered);
  const playerMaximum = Math.max(0.5, Math.ceil(Math.max(...dots.flatMap((datum) => [datum.x, datum.y]), 0) * 10) / 10);
  const xDomain: [number, number] = mode === "player" ? [0, playerMaximum] : chartDomain(dots.map((datum) => datum.x));
  const yDomain: [number, number] = mode === "player" ? [0, playerMaximum] : chartDomain(dots.map((datum) => datum.y));
  const left = 76, top = 52, size = 686, right = left + size, bottom = top + size;
  const x = (value: number) => left + (value - xDomain[0]) / (xDomain[1] - xDomain[0]) * size;
  const y = (value: number) => mode === "team"
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
  const tooltipX = selected ? Math.min(right - 282, Math.max(left, x(selected.x) + 18)) : 0;
  const tooltipY = selected ? Math.min(bottom - 88, Math.max(top, y(selected.y) - 94)) : 0;
  const statzCompetition = competition === "11" ? "league-one" : competition === "12" ? "league-two" : "championship";
  const statzUrl = `https://statz.ai/competitions/${statzCompetition}/xg${mode === "player" ? "/players" : ""}`;
  const changeMode = (value: "team" | "player") => { setMode(value); setHovered(null); };
  return <section className="panel opportunity-panel" id="chart">
    <div className="analytics-layout">
      <aside className="analytics-sidebar">
        <div className="section-heading"><div><ChartScatter size={18} /><h2>可视化表格</h2></div></div>
        <div className="analytics-switch" role="group" aria-label="图表对象">
          <button type="button" onClick={() => changeMode("team")} disabled={mode === "team"} aria-label="切换到球队">‹</button>
          <strong>{mode === "team" ? "球队" : "球员"}</strong>
          <button type="button" onClick={() => changeMode("player")} disabled={mode === "player"} aria-label="切换到球员">›</button>
        </div>
        <div className="analytics-metric"><span>横轴</span><strong>{mode === "team" ? "进攻指数 · xG / 场" : "预期进球 · xG / 90"}</strong></div>
        <div className="analytics-metric"><span>纵轴</span><strong>{mode === "team" ? "防守指数 · xGA / 场" : "实际进球 / 90"}</strong></div>
        <div className="chart-controls">
          <label>联赛级别<select value={competition} onChange={(event) => { setCompetition(event.target.value); setHovered(null); }}><option value="ALL">全部级别</option><option value="10">英冠</option><option value="11">英甲</option><option value="12">英乙</option></select></label>
          {mode === "player" && <><label>位置<select value={position} onChange={(event) => { setPosition(event.target.value); setHovered(null); }}><option value="ATT">中场 + 前锋</option><option value="ALL">全部非门将</option><option value="MID">中场</option><option value="FWD">前锋</option><option value="DEF">后卫</option></select></label><label>至少出场<select value={minimum} onChange={(event) => { setMinimum(Number(event.target.value)); setHovered(null); }}><option value={270}>270 分钟</option><option value={450}>450 分钟</option><option value={900}>900 分钟</option></select></label></>}
        </div>
        <div className="analytics-count">{dots.length} {mode === "team" ? "支球队" : "名球员"}</div>
        <p className="chart-note">数据：<a href={statzUrl} target="_blank" rel="noreferrer">Statz</a>{mode === "player" ? " · 实际进球：Fantasy EFL" : ""}<br />更新：{xgUpdatedAt ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(xgUpdatedAt)) : "—"}</p>
      </aside>
      <div className="analytics-visual">
        <div className="analytics-visual-heading"><strong>{mode === "team" ? "球队进攻 × 防守" : "球员 xG × 实际进球"}</strong><span>{mode === "team" ? "右上：攻强守强" : "虚线：实际进球 = xG"}</span></div>
        <div className="chart-svg-wrap"><svg className="opportunity-svg" viewBox="0 0 820 820" role="img" aria-label={mode === "team" ? "横轴球队场均xG越右越强，纵轴场均xGA越上越低、防守越强" : "横轴球员每90分钟xG，纵轴每90分钟实际进球"}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const xv = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
            const yv = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
            return <g key={fraction}><line className="chart-grid" x1={x(xv)} x2={x(xv)} y1={top} y2={bottom} /><line className="chart-grid" x1={left} x2={right} y1={y(yv)} y2={y(yv)} /><text className="chart-tick" x={x(xv)} y={bottom + 24} textAnchor="middle">{xv.toFixed(1)}</text><text className="chart-tick" x={left - 12} y={y(yv) + 4} textAnchor="end">{yv.toFixed(1)}</text></g>;
          })}
          {mode === "team" ? <><line className="chart-midline" x1={x((xDomain[0] + xDomain[1]) / 2)} x2={x((xDomain[0] + xDomain[1]) / 2)} y1={top} y2={bottom} /><line className="chart-midline" x1={left} x2={right} y1={y((yDomain[0] + yDomain[1]) / 2)} y2={y((yDomain[0] + yDomain[1]) / 2)} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">攻强 · 守强</text></> : <><line className="chart-midline" x1={x(0)} y1={y(0)} x2={x(playerMaximum)} y2={y(playerMaximum)} /><text className="chart-quadrant" x={right - 12} y={top + 21} textAnchor="end">进球多于预期</text></>}
          <defs>{dots.filter((datum) => datum.image).map((datum) => <clipPath id={"analytics-clip-" + datum.id} key={datum.id}><circle cx={x(datum.x)} cy={y(datum.y)} r={11} /></clipPath>)}</defs>
          {dots.map((datum) => <g key={datum.id} className={"chart-jersey-dot" + (hovered === datum.id ? " chart-dot-active" : "")} tabIndex={0} role="button" aria-label={datum.name + "，" + datum.detail} onMouseEnter={() => setHovered(datum.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(datum.id)} onBlur={() => setHovered(null)} onClick={() => setHovered(datum.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHovered(datum.id); } }}>
            <circle className="chart-jersey-bg" cx={x(datum.x)} cy={y(datum.y)} r={12} />
            {datum.image && <image href={datum.image} x={x(datum.x) - 11} y={y(datum.y) - 11} width={22} height={22} preserveAspectRatio="xMidYMid meet" clipPath={"url(#analytics-clip-" + datum.id + ")"} pointerEvents="none" />}
            <circle className="chart-jersey-hit" cx={x(datum.x)} cy={y(datum.y)} r={16} />
          </g>)}
          {labels.filter((label) => label.id !== hovered).map((label) => <text className="chart-player-label" key={label.id} x={label.x} y={label.y}>{label.name}</text>)}
          {selected && <g className="chart-tooltip" transform={"translate(" + tooltipX + " " + tooltipY + ")"}><rect width={282} height={88} rx={9} /><text className="chart-tooltip-name" x={11} y={22}>{selected.name}</text><text x={11} y={43}>{selected.subtitle}</text><text x={11} y={65}>{selected.detail}</text></g>}
          <text className="chart-axis-label" x={left + size / 2} y={800} textAnchor="middle">{mode === "team" ? "进攻指数 · xG / 场 →" : "预期进球 · xG / 90 →"}</text>
          <text className="chart-axis-label" x={19} y={top + size / 2} textAnchor="middle" transform={"rotate(-90 19 " + (top + size / 2) + ")"}>{mode === "team" ? "防守指数 · xGA / 场（越上越好）" : "实际进球 / 90 ↑"}</text>
        </svg></div>
      </div>
    </div>
  </section>;
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [playerQuery, setPlayerQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const active = data.upcomingRound && now >= Date.parse(data.upcomingRound.meta.lockoutAt) ? data.upcomingRound : data;
  const searchResults = useMemo(() => Object.values(active.picks).flat().filter((player) => `${player.name} ${player.fullName} ${player.team}`.toLowerCase().includes(playerQuery.trim().toLowerCase())).sort((a, b) => b.score - a.score), [active.picks, playerQuery]);
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
                  <RichImage className="lineup-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
                  <strong>{player.name}</strong><small>{player.team}</small>
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
          <div className="pool-toolbar"><label><span>搜索全部球员</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="球员或球队" /></label><span>{playerQuery.trim() ? `${searchResults.length} 人` : "各位置前 10 人"}</span></div>
          {playerQuery.trim() ? <div className="player-list">{searchResults.map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}{!searchResults.length && <div className="stats-empty">没有找到球员</div>}</div> : <Tabs defaultValue="GK">
            <TabsList className="position-tabs" aria-label="位置筛选">
              {positions.map((position) => <TabsTrigger key={position} value={position}>{positionName[position]}</TabsTrigger>)}
            </TabsList>
            {positions.map((position) => (
              <TabsContent value={position} key={position}><div className="player-list">{active.picks[position].slice(0, 10).map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}</div></TabsContent>
            ))}
          </Tabs>}
          <details className="model-details"><summary>预期得分如何计算</summary><p>逐场拆成动作分、进球助攻分、零封分和其他分。动作分按 <a href="https://fantasy.efl.com/team" target="_blank" rel="noreferrer">Fantasy EFL</a> 官方逐场门槛计算后求均值；稳定动作仅用约 2–3 场同位置先验收缩，波动较大的进球助攻用约 10 场先验收缩。<a href="https://statz.ai/competitions/championship/xg/players" target="_blank" rel="noreferrer">Statz</a> 球员 xG 只对进球分预期做最多 15% 的校正，缺失或样本不足则不使用。对手 xGA 修正进攻，对手 xG 修正零封；不预测对手会制造多少解围、拦截。另乘历史出场概率和最多 ±6% 的预计分钟微调。双赛两场直接相加。</p></details>
          </section>
        </section>

        <OpportunityChart players={data.playerStats} teams={data.teamStats} xgUpdatedAt={data.meta.xgUpdatedAt} />

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
              {data.news.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${item.title}`}><div><span>{item.source}</span><time>{item.date}</time></div><strong>{item.title}</strong></a>)}
            </div>
          </div>
        </section>

        <footer><span>FANTASY EFL DATA BOARD</span><span>官方数据 · EFL 新闻</span></footer>
      </div>
    </main>
  );
}
