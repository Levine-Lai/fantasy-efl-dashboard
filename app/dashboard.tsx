"use client";

import { useMemo, useState } from "react";
import { Clock3, Crosshair, Newspaper, Sparkles, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, PlayerPick, PlayerStat, StatKey } from "@/lib/dashboard-data";

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionName = { GK: "门将", DEF: "后卫", MID: "中场", FWD: "前锋" };

function labelFor(player: PlayerPick) {
  if (player.ownership <= 3) return "冷门";
  if (player.ownership >= 10) return "热门";
  return "平衡";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
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
        <div className="player-meta"><span>{player.team}</span><span>{player.fixtures.join(" · ")}</span></div>
      </div>
      <div className="player-stat"><span>出勤</span><b>{player.reliability}%</b></div>
      <div className="player-stat ownership-stat"><span>持有</span><b>{player.ownership}%</b></div>
      <div className="player-stat desktop-stat"><span>高阶</span><b>{player.underlying}</b></div>
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

export function Dashboard({ data }: { data: DashboardData }) {
  const updated = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(data.meta.updatedAt));
  const captain = [...data.startingSeven].sort((a, b) => b.score - a.score || b.reliability - a.reliability)[0];
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fantasy EFL 看板首页"><span className="brand-mark">FE</span><span>FANTASY EFL</span></a>
        <nav><a href="#recommendations">推荐</a><a href="#stats">场均数据</a><a href="#clubs">球队</a><a href="#news">新闻</a></nav>
        <div className="update-chip"><Clock3 size={15} />每日 08:00</div>
      </header>

      <div className="dashboard-shell" id="top">
        <section className="round-strip">
          <div><span className="eyebrow">NEXT ROUND</span><h1>{data.meta.roundName}</h1></div>
          <div className="round-metrics">
            <Metric label="有效比赛" value={data.meta.fixtureCount} />
            <Metric label="双赛球队" value={data.meta.doubleTeams} />
            <Metric label="样本轮次" value={data.meta.completedRounds} />
            <Metric label="更新" value={updated} />
          </div>
        </section>

        <section className="lead-grid">
          <div className="panel selection-panel">
            <div className="section-heading"><div><Sparkles size={18} /><h2>本轮七人</h2></div><span>队长 {captain?.name} · {captain?.fixtures.length} 场 · 预计 {captain?.score} 分</span></div>
            <div className="lineup-pitch" aria-label="本轮七人阵型">
              {positions.map((position) => <div className="lineup-row" key={position}>
                {data.startingSeven.filter((player) => player.position === position).map((player) => <div className="lineup-card" key={player.id}>
                  <span className="lineup-position">{position}</span>
                  <RichImage className="lineup-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
                  <RichImage className="lineup-avatar" src={player.fallbackImage} alt={`${player.team} 球衣`} />
                  <strong>{player.name}</strong><small>{player.team}</small>
                  {player.id === captain?.id && <span className="lineup-captain" aria-label="队长">C</span>}
                </div>)}
              </div>)}
            </div>
            <div className="lineup-fixtures">
              <h3>本轮赛程</h3>
              <div className="lineup-fixture-list">{data.startingSeven.map((player) => <div className="lineup-fixture" key={player.id}>
                <span className="fixture-player">{player.name}</span>
                <span className="fixture-matches">{player.fixtures.map((fixture, index) => <span className="fixture-chip" key={`${fixture}-${index}`}>{fixture}</span>)}</span>
              </div>)}</div>
            </div>
          </div>
        </section>

        <section className="panel recommendations" id="recommendations">
          <div className="section-heading wide-heading"><div><Crosshair size={18} /><h2>球员候选池</h2></div><span>分钟 · 机会 · 防守 · 赛程</span></div>
          <Tabs defaultValue="GK">
            <TabsList className="position-tabs" aria-label="位置筛选">
              {positions.map((position) => <TabsTrigger key={position} value={position}>{positionName[position]}</TabsTrigger>)}
            </TabsList>
            {positions.map((position) => (
              <TabsContent value={position} key={position}><div className="player-list">{data.picks[position].map((player, index) => <PlayerRow player={player} rank={index + 1} key={player.id} />)}</div></TabsContent>
            ))}
          </Tabs>
        </section>

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
