"use client";

import { Activity, CalendarDays, Clock3, Crosshair, Newspaper, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, PlayerPick } from "@/lib/dashboard-data";

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
        <RichImage className="player-avatar" src={player.avatarUrl} fallback={player.fallbackImage} alt={player.fullName} />
        <RichImage className="mini-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
      </div>
      <div className="player-main">
        <div className="player-title"><strong>{player.name}</strong><span className={`pill pill-${labelFor(player)}`}>{labelFor(player)}</span></div>
        <div className="player-meta"><span>{player.team}</span><span>{player.fixtures.join(" · ")}</span></div>
      </div>
      <div className="player-stat"><span>出勤</span><b>{player.reliability}%</b></div>
      <div className="player-stat ownership-stat"><span>持有</span><b>{player.ownership}%</b></div>
      <div className="player-stat desktop-stat"><span>高阶</span><b>{player.underlying}</b></div>
      <div className="score"><span>指数</span><b>{player.score}</b></div>
    </article>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const updated = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(data.meta.updatedAt));
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fantasy EFL 看板首页"><span className="brand-mark">FE</span><span>FANTASY EFL</span></a>
        <nav><a href="#recommendations">推荐</a><a href="#clubs">球队</a><a href="#news">新闻</a></nav>
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
            <div className="section-heading"><div><Sparkles size={18} /><h2>本轮七人</h2></div><span>综合指数</span></div>
            <div className="seven-grid">
              {data.startingSeven.map((player, index) => (
                <div className={`seven-card ${index === 0 ? "captain-card" : ""}`} key={`${player.position}-${player.id}`}>
                  <div className="seven-top"><span>{player.position}</span><b>{player.score}</b></div>
                  <RichImage className="seven-avatar" src={player.avatarUrl} fallback={player.fallbackImage} alt={player.fullName} />
                  <RichImage className="seven-crest" src={player.teamLogo} alt={`${player.team} 队徽`} />
                  <strong>{player.name}</strong><small>{player.team}</small><p>{player.fixtures.join(" · ")}</p>
                  {index === 0 && <span className="captain">C</span>}
                </div>
              ))}
            </div>
          </div>

          <aside className="panel signal-panel">
            <div className="section-heading"><div><Activity size={18} /><h2>轮次信号</h2></div></div>
            <div className="signal-list">
              <div><CalendarDays /><span>赛程密度</span><strong>{data.meta.doubleTeams ? "双赛周" : "单赛周"}</strong></div>
              <div><ShieldCheck /><span>首发门槛</span><strong>≥ 75%</strong></div>
              <div><Crosshair /><span>低持有池</span><strong>{data.differentialCount} 人</strong></div>
              <div><Trophy /><span>队长</span><strong>{data.startingSeven[0]?.name}</strong></div>
            </div>
          </aside>
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
