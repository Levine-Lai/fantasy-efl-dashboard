"use client";

import { useMemo, useState } from "react";
import { ChartScatter, Crosshair, Newspaper, Sparkles, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, PlayerPick, PlayerStat, StatKey } from "@/lib/dashboard-data";

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

function OpportunityChart({ players, xgUpdatedAt }: { players: PlayerStat[]; xgUpdatedAt: string }) {
  const [competition, setCompetition] = useState("ALL");
  const [position, setPosition] = useState("ATT");
  const [hovered, setHovered] = useState<number | null>(null);
  const dots = useMemo(() => players.flatMap((player) => {
    const minutes = player.perGame.minutesPlayed * player.appearances;
    if (minutes < 450 || player.xg90 == null || player.xgMinutes == null || player.xgMinutes < 450 || player.xgPoints90 == null || player.position === "GK" || (competition !== "ALL" && player.competitionId !== Number(competition)) || (position === "ATT" && player.position === "DEF") || (position !== "ATT" && position !== "ALL" && player.position !== position)) return [];
    return [{ ...player, minutes: player.xgMinutes, xg90: player.xg90, points: player.xgPoints90, goals: player.seasonGoals ?? 0 }];
  }), [players, competition, position]);
  const selected = dots.find((player) => player.id === hovered);
  const maxX = Math.max(0.5, Math.ceil(Math.max(...dots.map((player) => player.xg90), 0.5) * 4) / 4);
  const maxY = Math.max(2, Math.ceil(Math.max(...dots.map((player) => player.points), 2) / 2) * 2);
  const left = 70, top = 20, width = 1140, height = 430;
  const x = (value: number) => left + value / maxX * width;
  const y = (value: number) => top + height - value / maxY * height;
  const xMid = dots.length ? [...dots].sort((a, b) => a.xg90 - b.xg90)[Math.floor(dots.length / 2)].xg90 : 0;
  const yMid = dots.length ? [...dots].sort((a, b) => a.points - b.points)[Math.floor(dots.length / 2)].points : 0;
  const point = (player: typeof dots[number]) => ({ x: x(player.xg90), y: y(player.points) });
  const labels: { id: number; name: string; x: number; y: number; box: { x: number; y: number; width: number; height: number } }[] = [];
  for (const player of [...dots].sort((a, b) => Math.abs((b.points - yMid) / maxY - (b.xg90 - xMid) / maxX) - Math.abs((a.points - yMid) / maxY - (a.xg90 - xMid) / maxX))) {
    if (labels.length >= 28) break;
    const center = point(player);
    const labelWidth = Math.min(150, Math.max(54, player.fullName.length * 7));
    const placements = [
      { x: center.x + 10, y: center.y - 20 }, { x: center.x - labelWidth - 10, y: center.y - 20 },
      { x: center.x + 10, y: center.y + 6 }, { x: center.x - labelWidth - 10, y: center.y + 6 },
    ];
    for (const box of placements.map(({ x: boxX, y: boxY }) => ({ x: boxX, y: boxY, width: labelWidth, height: 18 }))) {
      if (box.x < left || box.y < top || box.x + box.width > left + width || box.y + box.height > top + height) continue;
      if (labels.some((label) => box.x < label.box.x + label.box.width + 4 && box.x + box.width + 4 > label.box.x && box.y < label.box.y + label.box.height + 4 && box.y + box.height + 4 > label.box.y)) continue;
      if (dots.some((other) => other.id !== player.id && point(other).x > box.x - 4 && point(other).x < box.x + box.width + 4 && point(other).y > box.y - 4 && point(other).y < box.y + box.height + 4)) continue;
      labels.push({ id: player.id, name: player.fullName, x: box.x, y: box.y + 13, box });
      break;
    }
  }
  const tooltipX = selected ? Math.min(left + width - 236, Math.max(left, x(selected.xg90) + 12)) : 0;
  const tooltipY = selected ? Math.min(top + height - 86, Math.max(top, y(selected.points) - 90)) : 0;
  return <section className="panel opportunity-panel" id="chart">
    <div className="section-heading"><div><ChartScatter size={18} /><h2>可视化表格</h2></div><span>xG / 90 × 得分 / 90 · {dots.length} 人</span></div>
    <div className="chart-controls">
      <label>级别<select value={competition} onChange={(event) => { setCompetition(event.target.value); setHovered(null); }}><option value="ALL">全部</option><option value="10">英冠</option><option value="11">英甲</option><option value="12">英乙</option></select></label>
      <label>位置<select value={position} onChange={(event) => { setPosition(event.target.value); setHovered(null); }}><option value="ATT">中场 + 前锋</option><option value="ALL">全部非门将</option><option value="MID">中场</option><option value="FWD">前锋</option><option value="DEF">后卫</option></select></label>
    </div>
    <div className="chart-svg-wrap"><svg className="opportunity-svg" viewBox="0 0 1280 520" role="img" aria-label="横轴预期进球xG每90分钟，纵轴Fantasy得分每90分钟的球员散点图">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => <g key={`grid-${fraction}`}><line className="chart-grid" x1={left} x2={left + width} y1={y(maxY * fraction)} y2={y(maxY * fraction)} /><text className="chart-tick" x={left - 9} y={y(maxY * fraction) + 4} textAnchor="end">{(maxY * fraction).toFixed(1)}</text><line className="chart-grid" x1={x(maxX * fraction)} x2={x(maxX * fraction)} y1={top} y2={top + height} /><text className="chart-tick" x={x(maxX * fraction)} y={top + height + 20} textAnchor="middle">{(maxX * fraction).toFixed(1)}</text></g>)}
      <line className="chart-midline" x1={x(xMid)} x2={x(xMid)} y1={top} y2={top + height} /><line className="chart-midline" x1={left} x2={left + width} y1={y(yMid)} y2={y(yMid)} />
      <text className="chart-quadrant" x={left + 12} y={top + 20}>得分高 · xG低</text><text className="chart-quadrant" x={left + width - 12} y={top + height - 14} textAnchor="end">xG高 · 得分待兑现</text>
      {dots.map((player) => <circle key={player.id} className={`chart-dot chart-dot-${player.position}${hovered === player.id ? " chart-dot-active" : ""}`} cx={x(player.xg90)} cy={y(player.points)} r={hovered === player.id ? 8 : 5} tabIndex={0} role="button" aria-label={`${player.fullName}，xG每90分钟 ${player.xg90.toFixed(2)}，得分每90分钟 ${player.points.toFixed(2)}`} onMouseEnter={() => setHovered(player.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(player.id)} onBlur={() => setHovered(null)} onClick={() => setHovered(player.id)} />)}
      {labels.filter((label) => label.id !== hovered).map((label) => <text className="chart-player-label" key={label.id} x={label.x} y={label.y}>{label.name}</text>)}
      {selected && <g className="chart-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}><rect width={236} height={86} rx={9} /><text className="chart-tooltip-name" x={11} y={19}>{selected.fullName}</text><text x={11} y={37}>{selected.team} · {competitionName[selected.competitionId]} · {selected.position} · {Math.round(selected.minutes)} 分钟</text><text x={11} y={55}>xG/90 {selected.xg90.toFixed(2)} · 得分/90 {selected.points.toFixed(2)}</text><text x={11} y={73}>进球 {selected.goals.toFixed(0)} · 累计 xG {selected.xg?.toFixed(2)}</text></g>}
      <text className="chart-axis-label" x={left + width / 2} y={498} textAnchor="middle">xG / 90</text><text className="chart-axis-label" x={18} y={top + height / 2} textAnchor="middle" transform={`rotate(-90 18 ${top + height / 2})`}>Fantasy 得分 / 90</text>
    </svg></div>
    <div className="chart-note">xG 来源：<a href="https://statz.ai/competitions/championship/xg/players" target="_blank" rel="noreferrer">Statz</a>（抓取于 {xgUpdatedAt ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(xgUpdatedAt)) : "—"}）；得分来源：Fantasy EFL。仅显示赛季出场数一致且至少出场 450 分钟的球员。</div>
  </section>;
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [playerQuery, setPlayerQuery] = useState("");
  const searchResults = useMemo(() => Object.values(data.picks).flat().filter((player) => `${player.name} ${player.fullName} ${player.team}`.toLowerCase().includes(playerQuery.trim().toLowerCase())).sort((a, b) => b.score - a.score), [data.picks, playerQuery]);
  const captain = [...data.startingSeven].sort((a, b) => b.score - a.score || b.reliability - a.reliability)[0];
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fantasy EFL 看板首页"><img className="brand-logo" src="https://fantasy.efl.com/apple-touch-icon.png" alt="Fantasy EFL" /><span>FANTASY EFL</span></a>
        <nav><a href="#recommendations">推荐</a><a href="#stats">场均数据</a><a href="#clubs">球队</a><a href="#news">新闻</a></nav>
      </header>

      <div className="dashboard-shell" id="top">
        <section className="lead-grid">
          <div className="panel selection-panel">
            <div className="section-heading"><div><Sparkles size={18} /><h2>本轮推荐阵容</h2></div><span>队长 {captain?.name} · {captain?.fixtures.length} 场 · 预计 {captain?.score} 分</span></div>
            <div className="lineup-pitch" aria-label="本轮七人阵型">
              {positions.map((position) => <div className="lineup-row" key={position}>
                {data.startingSeven.filter((player) => player.position === position).map((player) => <div className="lineup-card" key={player.id}>
                  <span className="lineup-position">{position}</span>
                  <RichImage className="lineup-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
                  <RichImage className="lineup-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
                  <strong>{player.name}</strong><small>{player.team}</small>
                  <span className="lineup-matches" title={player.fixtures.join(" · ")}>{player.fixtures.map((fixture, index) => <span key={`${fixture}-${index}`}>{fixture}</span>)}</span>
                  {player.id === captain?.id && <span className="lineup-captain" aria-label="队长">C</span>}
                </div>)}
              </div>)}
            </div>
          </div>
          <section className="panel recommendations" id="recommendations">
          <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>{data.meta.roundName} 球员预期得分</h2></div><span>对阵 · 分钟 · 双赛</span></div>
          <div className="pool-toolbar"><label><span>搜索全部球员</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="球员或球队" /></label><span>{playerQuery.trim() ? `${searchResults.length} 人` : "各位置前 10 人"}</span></div>
          {playerQuery.trim() ? <div className="player-list">{searchResults.map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}{!searchResults.length && <div className="stats-empty">没有找到球员</div>}</div> : <Tabs defaultValue="GK">
            <TabsList className="position-tabs" aria-label="位置筛选">
              {positions.map((position) => <TabsTrigger key={position} value={position}>{positionName[position]}</TabsTrigger>)}
            </TabsList>
            {positions.map((position) => (
              <TabsContent value={position} key={position}><div className="player-list">{data.picks[position].slice(0, 10).map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}</div></TabsContent>
            ))}
          </Tabs>}
          <details className="model-details"><summary>预期得分如何计算</summary><p>逐场拆成动作分、进球助攻分、零封分和其他分。动作分按 <a href="https://fantasy.efl.com/team" target="_blank" rel="noreferrer">Fantasy EFL</a> 官方逐场门槛计算后求均值；稳定动作仅用约 2–3 场同位置先验收缩，波动较大的进球助攻用约 10 场先验收缩。<a href="https://statz.ai/competitions/championship/xg" target="_blank" rel="noreferrer">Statz</a> 的对手 xGA 修正进攻动作和回报；对手 xG 对零封与防守动作分别作反向修正。另乘历史出场概率和最多 ±6% 的预计分钟微调。双赛两场直接相加；伤停或无剩余赛程记 0 分。</p></details>
          </section>
        </section>

        <OpportunityChart players={data.playerStats} xgUpdatedAt={data.meta.xgUpdatedAt} />

        <StatsTable players={data.playerStats} />

        <section className="lower-grid">
          <div className="panel" id="clubs">
            <div className="section-heading"><div><Trophy size={18} /><h2>球队选择</h2></div><span>前五</span></div>
            <div className="club-list">
              {data.teams.map((team, index) => (
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
