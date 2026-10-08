import { env } from "cloudflare:workers";

const API = "https://fantasy.efl.com/json/fantasy";
type Position = "GK" | "DEF" | "MID" | "FWD";
type RawPlayer = { id: number; squadId: number; competitionId: number; firstName: string; lastName: string; displayName: string; position: Position; status: string; percentSelected: number; totalPoints: number; injuryDetails?: string | null; suspensionDetails?: string | null };
type RawSquad = { id: number; name: string; shortName: string; totalPoints: number; percentSelected: number; darkBadge?: string; lightBadge?: string; jersey?: string; fdrHome?: number; fdrAway?: number; last3Form?: string[] };
type RawGame = { id: number; date: string; status: string; homeId: number; awayId: number };
type RawRound = { id: number; name: string; status: string; games: RawGame[] };
export const statKeys = ["points", "minutesPlayed", "goalsScored", "assists", "keyPasses", "shotsOnTarget", "cleanSheet", "saves", "penaltySaves", "goalsConceded", "clearances", "blocks", "tackles", "interceptions", "yellowCards", "redCards", "ownGoals", "penaltyMisses", "hatTricks"] as const;
export type StatKey = typeof statKeys[number];
type LivePlayer = { playerId: number; gameId: number; squadId: number } & Partial<Record<StatKey, number>>;
type LiveSquad = { squadId: number; gameId: number; win: number; draw: number; awayWin: number; cleanSheet: number; goalsScored: number };
type LiveRound = { players: LivePlayer[]; squads: LiveSquad[] };

export type PlayerPick = { id: number; name: string; fullName: string; team: string; position: Position; ownership: number; fixtures: string[]; reliability: number; score: number; underlying: number; points: number; minutes: number; avatarUrl: string; teamLogo: string; fallbackImage: string };
export type PlayerStat = { id: number; fullName: string; team: string; competitionId: number; position: Position; appearances: number; ownership: number; perGame: Record<StatKey, number> };
type TeamPick = { id: number; name: string; logo: string; fixtures: string[]; form: string[]; score: number };
type NewsItem = { title: string; url: string; source: string; date: string };
export type DashboardData = { meta: { roundId: number; roundName: string; fixtureCount: number; doubleTeams: number; completedRounds: number; updatedAt: string; portraitVersion?: number }; picks: Record<Position, PlayerPick[]>; startingSeven: PlayerPick[]; playerStats: PlayerStat[]; teams: TeamPick[]; news: NewsItem[]; differentialCount: number };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, { headers: { "user-agent": "Fantasy-EFL-Data-Board/1.0" } });
  if (!response.ok) throw new Error(`Fantasy EFL ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function unescapeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

async function getNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const response = await fetch("https://www.efl.com/news/", { headers: { "user-agent": "Mozilla/5.0 Fantasy EFL Data Board" } });
    const html = await response.text();
    const pattern = /postSlug:"([^"]+)"[\s\S]{0,2200}?publishedDateTime:"([^"]+)"[\s\S]{0,1600}?postTitle:"([^"]+)"/g;
    for (const match of html.matchAll(pattern)) {
      const [, path, published, title] = match;
      if (!path.startsWith("/news/") || items.some((item) => item.url.endsWith(path))) continue;
      items.push({ title: unescapeHtml(title.replaceAll("\\'", "'")), url: `https://www.efl.com${path}`, source: "EFL", date: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(published)) });
      if (items.length === 5) break;
    }
  } catch { /* try the secondary feed below */ }
  if (items.length < 5) {
    try {
      const response = await fetch("https://news.google.com/rss/search?q=Fantasy+EFL+OR+EFL+Championship+OR+League+One+OR+League+Two&hl=en-GB&gl=GB&ceid=GB:en");
      const xml = await response.text();
      const pattern = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?(?:<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>)?[\s\S]*?<\/item>/g;
      for (const match of xml.matchAll(pattern)) {
        const [, rawTitle, url, published, rawSource] = match;
        const title = unescapeHtml(rawTitle.trim());
        if (items.some((item) => item.title === title)) continue;
        items.push({ title, url: unescapeHtml(url.trim()), source: unescapeHtml((rawSource || "EFL NEWS").trim()), date: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(published)) });
        if (items.length === 5) break;
      }
    } catch { /* keep the official items already collected */ }
  }
  return items;
}

async function calculateDashboard(): Promise<DashboardData> {
  const [players, squads, rounds] = await Promise.all([getJson<RawPlayer[]>("players.json"), getJson<RawSquad[]>("squads.json"), getJson<RawRound[]>("rounds.json")]);
  const activeRounds = rounds.filter((round) => round.games?.some((game) => !["postponed", "cancelled"].includes(game.status)));
  const target = activeRounds.find((round) => round.status !== "completed") ?? activeRounds.at(-1)!;
  const completed = activeRounds.filter((round) => round.id < target.id && round.status === "completed");
  const lives = await Promise.all(completed.map((round) => getJson<LiveRound>(`live_scores/${round.id}.json`)));
  const names = new Map(squads.map((squad) => [squad.id, squad.shortName || squad.name]));
  const squadsById = new Map(squads.map((squad) => [squad.id, squad]));
  const fixtures = new Map<number, string[]>();
  const validGames = target.games.filter((game) => !["postponed", "cancelled"].includes(game.status));
  for (const game of validGames) {
    const home = fixtures.get(game.homeId) ?? []; home.push(`主 ${names.get(game.awayId) ?? "—"}`); fixtures.set(game.homeId, home);
    const away = fixtures.get(game.awayId) ?? []; away.push(`客 ${names.get(game.homeId) ?? "—"}`); fixtures.set(game.awayId, away);
  }

  const teamGames = new Map<number, Set<number>>();
  const teamAgg = new Map<number, { games: number; wins: number; draws: number; cleanSheets: number; goals: number }>();
  const playerAgg = new Map<number, { games: number; minutes: number; sixty: number; points: number; goals: number; assists: number; saves: number; cleanSheets: number; clearances: number; blocks: number; tackles: number; interceptions: number; keyPasses: number; shotsOnTarget: number }>();
  const playerEventTotals = new Map<number, { games: number; totals: Record<StatKey, number> }>();
  for (const live of lives) {
    for (const row of live.squads) {
      const seen = teamGames.get(row.squadId) ?? new Set<number>(); seen.add(row.gameId); teamGames.set(row.squadId, seen);
      const agg = teamAgg.get(row.squadId) ?? { games: 0, wins: 0, draws: 0, cleanSheets: 0, goals: 0 };
      agg.games += 1; agg.wins += row.win; agg.draws += row.draw; agg.cleanSheets += row.cleanSheet; agg.goals += row.goalsScored; teamAgg.set(row.squadId, agg);
    }
    for (const row of live.players) {
      const events = playerEventTotals.get(row.playerId) ?? { games: 0, totals: Object.fromEntries(statKeys.map((key) => [key, 0])) as Record<StatKey, number> };
      events.games += 1;
      for (const key of statKeys) events.totals[key] += row[key] ?? 0;
      playerEventTotals.set(row.playerId, events);
      const agg = playerAgg.get(row.playerId) ?? { games: 0, minutes: 0, sixty: 0, points: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, clearances: 0, blocks: 0, tackles: 0, interceptions: 0, keyPasses: 0, shotsOnTarget: 0 };
      agg.games += 1; agg.minutes += row.minutesPlayed ?? 0; agg.sixty += (row.minutesPlayed ?? 0) >= 60 ? 1 : 0; agg.points += row.points ?? 0; agg.goals += row.goalsScored ?? 0; agg.assists += row.assists ?? 0; agg.saves += row.saves ?? 0; agg.cleanSheets += row.cleanSheet ?? 0; agg.clearances += row.clearances ?? 0; agg.blocks += row.blocks ?? 0; agg.tackles += row.tackles ?? 0; agg.interceptions += row.interceptions ?? 0; agg.keyPasses += row.keyPasses ?? 0; agg.shotsOnTarget += row.shotsOnTarget ?? 0; playerAgg.set(row.playerId, agg);
    }
  }

  const allPicks: PlayerPick[] = [];
  for (const player of players) {
    const playerFixtures = fixtures.get(player.squadId);
    if (player.status !== "playing" || !playerFixtures || player.injuryDetails || player.suspensionDetails) continue;
    const agg = playerAgg.get(player.id) ?? { games: 0, minutes: 0, sixty: 0, points: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, clearances: 0, blocks: 0, tackles: 0, interceptions: 0, keyPasses: 0, shotsOnTarget: 0 };
    const clubGames = teamGames.get(player.squadId)?.size ?? 0;
    const reliability = clubGames ? agg.sixty / clubGames : 0;
    if (clubGames >= 3 && reliability < 0.5) continue;
    const per90 = (value: number) => agg.minutes ? value * 90 / agg.minutes : 0;
    let underlying = 0;
    if (player.position === "GK") underlying = per90(agg.saves) * 0.75 + agg.cleanSheets * 0.8;
    if (player.position === "DEF") underlying = per90(agg.clearances) * 0.18 + per90(agg.blocks) * 0.8 + per90(agg.tackles) * 0.45 + per90(agg.interceptions) * 0.45 + agg.cleanSheets * 0.7 + agg.goals * 1.8 + agg.assists;
    if (player.position === "MID") underlying = per90(agg.keyPasses) * 0.7 + per90(agg.shotsOnTarget) * 1.15 + per90(agg.interceptions) * 0.35 + agg.goals * 1.6 + agg.assists;
    if (player.position === "FWD") underlying = per90(agg.keyPasses) * 0.5 + per90(agg.shotsOnTarget) * 1.45 + agg.goals * 1.7 + agg.assists;
    const pointsPerGame = agg.points / Math.max(1, agg.games);
    const scoreRaw = playerFixtures.length * 4.2 + reliability * 7 + pointsPerGame * 1.2 + underlying;
    const squad = squadsById.get(player.squadId);
    allPicks.push({ id: player.id, name: player.displayName, fullName: `${player.firstName} ${player.lastName}`.trim(), team: names.get(player.squadId) ?? "—", position: player.position, ownership: Number((player.percentSelected ?? 0).toFixed(1)), fixtures: playerFixtures, reliability: Math.round(reliability * 100), score: Number(scoreRaw.toFixed(1)), underlying: Number(underlying.toFixed(1)), points: agg.points, minutes: agg.minutes, avatarUrl: "", teamLogo: squad?.lightBadge || squad?.darkBadge || "", fallbackImage: squad?.jersey || squad?.lightBadge || squad?.darkBadge || "" });
  }
  allPicks.sort((a, b) => b.score - a.score);
  const picks = Object.fromEntries(["GK", "DEF", "MID", "FWD"].map((position) => [position, allPicks.filter((player) => player.position === position).slice(0, 5)])) as Record<Position, PlayerPick[]>;
  const visiblePlayers = Object.values(picks).flat();
  for (const player of visiblePlayers) player.avatarUrl = player.fallbackImage;
  const startingSeven = [picks.FWD[0], picks.MID[0], picks.GK[0], ...picks.DEF.slice(0, 2), picks.MID[1], picks.FWD[1]].filter(Boolean);
  const playerStats: PlayerStat[] = players.flatMap((player) => {
    const events = playerEventTotals.get(player.id);
    if (!events?.games) return [];
    return [{ id: player.id, fullName: `${player.firstName} ${player.lastName}`.trim(), team: names.get(player.squadId) ?? "—", competitionId: player.competitionId, position: player.position, appearances: events.games, ownership: Number((player.percentSelected ?? 0).toFixed(1)), perGame: Object.fromEntries(statKeys.map((key) => [key, Number((events.totals[key] / events.games).toFixed(3))])) as Record<StatKey, number> }];
  });
  const teams: TeamPick[] = squads.filter((squad) => fixtures.has(squad.id)).map((squad) => {
    const agg = teamAgg.get(squad.id) ?? { games: 0, wins: 0, draws: 0, cleanSheets: 0, goals: 0 };
    const teamFixtures = fixtures.get(squad.id)!;
    const homeGames = teamFixtures.filter((fixture) => fixture.startsWith("主")).length;
    const fdr = homeGames ? squad.fdrHome ?? 3 : squad.fdrAway ?? 3;
    const score = teamFixtures.length * 6 + agg.wins / Math.max(1, agg.games) * 5 + agg.cleanSheets / Math.max(1, agg.games) * 4 + agg.goals / Math.max(1, agg.games) * 1.5 + (6 - fdr) * 0.8;
    return { id: squad.id, name: squad.name, logo: squad.lightBadge || squad.darkBadge || "", fixtures: teamFixtures, form: (squad.last3Form ?? []).slice(-3), score: Number(score.toFixed(1)) };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
  return { meta: { roundId: target.id, roundName: target.name.replace("Gameweek", "GW"), fixtureCount: validGames.length, doubleTeams: [...fixtures.values()].filter((list) => list.length > 1).length, completedRounds: completed.length, updatedAt: new Date().toISOString(), portraitVersion: 3 }, picks, startingSeven, playerStats, teams, news: await getNews(), differentialCount: allPicks.filter((player) => player.ownership <= 3).length };
}

async function readCache(): Promise<DashboardData | null> {
  try { if (!env.DB) return null; const row = await env.DB.prepare("SELECT payload FROM dashboard_cache WHERE cache_key = ? LIMIT 1").bind("latest").first<{ payload: string }>(); return row?.payload ? JSON.parse(row.payload) as DashboardData : null; } catch { return null; }
}

async function writeCache(data: DashboardData) {
  if (!env.DB) return;
  await env.DB.prepare("INSERT INTO dashboard_cache (cache_key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind("latest", JSON.stringify(data), Date.now()).run();
}

export async function refreshDashboardData() { const data = await calculateDashboard(); await writeCache(data); return data; }
export async function getDashboardData(): Promise<DashboardData> {
  const cached = await readCache();
  const age = cached ? Date.now() - new Date(cached.meta.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  const hasRichImages = cached?.meta.portraitVersion === 3 && Boolean(cached?.picks?.GK?.every((player) => player.avatarUrl && player.teamLogo));
  if (cached && hasRichImages && age < 24 * 60 * 60 * 1000) return cached;
  try { return await refreshDashboardData(); } catch (error) { if (cached) return cached; throw error; }
}
