import { env } from "cloudflare:workers";

const API = "https://fantasy.efl.com/json/fantasy";
type Position = "GK" | "DEF" | "MID" | "FWD";
type RawPlayer = { id: number; squadId: number; competitionId: number; firstName: string; lastName: string; displayName: string; position: Position; status: string; percentSelected: number; appearances: number; totalPoints: number; goalsScored: number; injuryDetails?: string | null; suspensionDetails?: string | null };
type RawSquad = { id: number; competitionId: number; name: string; shortName: string; totalPoints: number; percentSelected: number; darkBadge?: string; lightBadge?: string; jersey?: string; fdrHome?: number; fdrAway?: number; last3Form?: string[]; leaguePosition?: number };
type RawGame = { id: number; date: string; status: string; homeId: number; awayId: number; competitionId?: number; homeScore?: number | null; awayScore?: number | null };
type RawRound = { id: number; name: string; status: string; lockoutDate: string; games: (RawGame & { isFinalized?: boolean })[] };
export const statKeys = ["points", "minutesPlayed", "goalsScored", "assists", "keyPasses", "shotsOnTarget", "cleanSheet", "saves", "penaltySaves", "goalsConceded", "clearances", "blocks", "tackles", "interceptions", "yellowCards", "redCards", "ownGoals", "penaltyMisses", "hatTricks"] as const;
export type StatKey = typeof statKeys[number];
type LivePlayer = { playerId: number; gameId: number; squadId: number } & Partial<Record<StatKey, number>>;
type LiveSquad = { points?: number; squadId: number; gameId: number; win: number; draw: number; awayWin: number; cleanSheet: number; goalsScored: number };
type LiveRound = { players: LivePlayer[]; squads: LiveSquad[] };

// Calendar order matters when postponed fixtures are played in later rounds.
export function recentTeamForm(rows: Pick<LiveSquad, 'gameId'|'squadId'|'win'|'draw'>[], games: Pick<RawGame,'id'|'date'>[], squadId:number) {
  const dates=new Map(games.map(game=>[game.id,Date.parse(game.date)]));
  const unique=new Map(rows.filter(row=>row.squadId===squadId && Number.isFinite(dates.get(row.gameId))).map(row=>[row.gameId,row]));
  return [...unique.values()].sort((a,b)=>dates.get(a.gameId)!-dates.get(b.gameId)! || a.gameId-b.gameId).slice(-5).map(row=>row.win?'W':row.draw?'D':'L');
}

const componentKeys = ["attackActions", "defenseActions", "goals", "assists", "cleanSheet", "other"] as const;
export type ComponentKey = typeof componentKeys[number];
export type ScoreComponents = Record<ComponentKey, number>;
export function emptyComponents(): ScoreComponents { return { attackActions: 0, defenseActions: 0, goals: 0, assists: 0, cleanSheet: 0, other: 0 }; }

// Match-level floor rules must be applied before averaging: floor(mean/3)
// would discard the probability of crossing the three-action threshold.
export function scoreComponents(row: LivePlayer, position: Position): ScoreComponents {
  const attackActions = position === "MID" || position === "FWD" ? 2 * (row.keyPasses ?? 0) + Math.floor((row.shotsOnTarget ?? 0) / 2) : 0;
  const defenseActions = position === "GK" ? 2 * Math.floor((row.saves ?? 0) / 3)
    : position === "DEF" ? Math.floor((row.clearances ?? 0) / 3) + Math.floor((row.blocks ?? 0) / 2) + Math.floor((row.tackles ?? 0) / 2)
    : position === "MID" ? 2 * (row.interceptions ?? 0) : 0;
  const goals = (row.goalsScored ?? 0) * ({ GK: 10, DEF: 7, MID: 6, FWD: 5 }[position]) + 5 * (row.hatTricks ?? 0);
  const assists = 3 * (row.assists ?? 0);
  const cleanSheet = position === "GK" || position === "DEF" ? 5 * (row.cleanSheet ?? 0) : 0;
  return { attackActions, defenseActions, goals, assists, cleanSheet, other: (row.points ?? 0) - attackActions - defenseActions - goals - assists - cleanSheet };
}

export function estimateComponents(totals: ScoreComponents, games: number, positionMean: ScoreComponents): ScoreComponents {
  const priorGames: ScoreComponents = { attackActions: 3, defenseActions: 2, goals: 10, assists: 10, cleanSheet: 4, other: 4 };
  return Object.fromEntries(componentKeys.map((key) => [key, (totals[key] + priorGames[key] * positionMean[key]) / (games + priorGames[key])])) as ScoreComponents;
}

export function blendXgGoalPoints(baseGoals: number, xg: number | null, xgMinutes: number | null, expectedMinutes: number, position: Position) {
  if (position === "GK" || xg == null || xgMinutes == null || xgMinutes < 270 || !Number.isFinite(xg) || xg < 0) return baseGoals;
  const weight = 0.15 * Math.min(1, xgMinutes / 720);
  const goalValue = { GK: 10, DEF: 7, MID: 6, FWD: 5 }[position];
  const xgGoalPoints = xg * expectedMinutes / xgMinutes * goalValue;
  return baseGoals * (1 - weight) + xgGoalPoints * weight;
}

// Transparent recommendation index, not calibrated Fantasy team points.
export function projectTeamMatch({rank,opponentRank,own,opposing,league,home,wins,games}: {rank?:number;opponentRank?:number;own?:{played:number;xg_per_game:number;xga_per_game:number};opposing?:{played:number;xg_per_game:number;xga_per_game:number};league?:{attack:number;defense:number};home:boolean;wins:number;games:number}) {
  const average = league?.attack && league?.defense ? (league.attack+league.defense)/2 : 1.35;
  const smooth = (value:number|undefined,n:number) => value != null && Number.isFinite(value) ? (value*n+average*8)/(n+8) : average;
  const xg = smooth(own?.xg_per_game,own?.played ?? 0)*smooth(opposing?.xga_per_game,opposing?.played ?? 0)/average*(home?1.06:.94);
  const xga = smooth(own?.xga_per_game,own?.played ?? 0)*smooth(opposing?.xg_per_game,opposing?.played ?? 0)/average*(home ? .94 : 1.06);
  const rankSignal = rank && opponentRank ? (opponentRank-rank)/23 : 0;
  const attackSignal = Math.max(-1,Math.min(1,xg/average-1));
  const defenseSignal = Math.max(-1,Math.min(1,1-xga/average));
  const formSignal = 2*(wins+2)/(games+4)-1;
  return {xg,xga,score:10+4*(.15*rankSignal+.35*attackSignal+.35*defenseSignal+.15*formSignal)};
}

export type FixtureBadge = { label: string; opponent: string; opponentLogo: string };
export type PlayerPick = { id: number; name: string; fullName: string; team: string; position: Position; ownership: number; fixtures: string[]; fixtureBadges: FixtureBadge[]; reliability: number; expectedMinutes: number; score: number; matchup: number; actionScore: number; returnScore: number; points: number; minutes: number; avatarUrl: string; teamLogo: string; fallbackImage: string };
export type AttackingStats={xg:number|null;xa:number|null;xgi:number|null;mins:number|null;apps:number|null;shots:number|null;crosses:number|null;dribbles:number|null;actionMins:number|null;actionApps:number|null;updatedAt:string;actionUpdatedAt:string};
export type SetPieces={capturedAt:string;penaltyCapturedAt:string;teams:{id:number;name:string;competitionId:number;logo:string;penalties:{name:string;taken:number;scored:number|null}[];penaltyReference:string;freeKicks:string;corners:string;source:string|null}[]};
export type PlayerStat = { attacking?:AttackingStats; id: number; fullName: string; team: string; jerseyUrl: string; teamLogo: string; advanced?: { updatedAt: string; mins: number; apps: number; tkl: number | null; int: number | null; aer: number | null; due: number | null; duw: number | null; pas: number | null; apas: number | null; drp: number | null; cc: number | null; sdrb: number | null }; competitionId: number; position: Position; appearances: number; ownership: number; xg: number | null; xg90: number | null; xgMinutes: number | null; goals90: number | null; seasonGoals: number | null; perGame: Record<StatKey, number> };
export type TeamStat = { id: number; name: string; fullName: string; logo: string; competitionId: number; played: number; fantasyPointsPerGame: number | null; goalsAgainstPerGame: number | null; xgPerGame: number | null; xgaPerGame: number | null; goalsPerGame: number | null; winRate: number | null; cleanSheetRate: number | null; pointsPerGame: number | null; xgdPerGame: number | null; xgShare: number | null; xptsPerGame: number | null; pointsDeltaPerGame: number | null; finishingDeltaPerGame: number | null };
export type TeamPick = { id: number; name: string; logo: string; fixtures: string[]; fixtureBadges: FixtureBadge[]; form: string[]; score: number; leaguePosition: number | null; projectedXg: number | null; projectedXga: number | null };
export type NewsItem = { title: string; url: string; source: string; date: string; titleZh?: string; summary?: string; category?: string; impacts?: {kind:"positive"|"negative"|"injury"|"watch";text:string}[] };
export type DashboardMeta = { roundId: number; roundName: string; lockoutAt: string; fixtureCount: number; doubleTeams: number; completedRounds: number; recentRoundName: string; recentFinalizedGames: number; recentTotalGames: number; updatedAt: string; xgUpdatedAt: string; portraitVersion?: number; modelVersion?: number };
export type RoundRecommendations = { meta: DashboardMeta; picks: Record<Position, PlayerPick[]>; startingSeven: PlayerPick[]; teams: TeamPick[]; differentialCount: number; scoreKind?: "actual" | "projection" };
export type RoundFixture = { id:number; date:string; status:string; finalized:boolean; competitionId:number; homeId:number; awayId:number; homeName:string; awayName:string; homeLogo:string; awayLogo:string; homeScore:number|null; awayScore:number|null };
export type RoundIndex = { id:number; name:string; lockoutAt:string; state:"completed"|"current"|"future"; file:string; fixtureCount:number; doubleTeams:number };
export type RoundView = RoundRecommendations & { fixtures:RoundFixture[]; playerStats?:PlayerStat[]; teamStats?:TeamStat[]; statsLabel:string };
export type DashboardData = RoundRecommendations & { sourceHealth?: {generatedAt:string;advancedMatched:number;playerCount:number;sources:{name:string;capturedAt:string;access?:string}[]}; playerStats: PlayerStat[]; teamStats: TeamStat[]; news: NewsItem[]; upcomingRound?: RoundRecommendations; roundIndex?:RoundIndex[]; fixtures?:RoundFixture[]; statsLabel?:string; fixtureMatrixFile?:string; chartHistoryFile?:string;setPieces?:SetPieces };
type DashboardInputs = { players:RawPlayer[]; squads:RawSquad[]; rounds:RawRound[]; lives:Map<number,LiveRound> };

export function selectRecommendationRounds(rounds: RawRound[], now = Date.now()) {
  const active = rounds.filter((round) => round.games?.some((game) => !["postponed", "cancelled"].includes(game.status))).sort((a, b) => Date.parse(a.lockoutDate) - Date.parse(b.lockoutDate));
  const index = active.findIndex((round) => Date.parse(round.lockoutDate) > now);
  const primary = active[index < 0 ? active.length - 1 : index];
  const upcoming = index >= 0 ? active[index + 1] : undefined;
  return { primary, upcoming };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, { headers: { "user-agent": "Fantasy-EFL-Data-Board/1.0" } });
  if (!response.ok) throw new Error(`Fantasy EFL ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function unescapeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function matchKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function abbreviatedPlayerKey(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? matchKey(parts[0][0] + parts.slice(1).join("")) : "";
}

type XgRow = { player_name: string; team_name: string; apps: number; xg: number | null; minutes: number | null };
type TeamXgRow = { competitionId: number; team_name: string; played: number; xg_per_game: number; xga_per_game: number; xgd?: number; xpts?: number; points_delta?: number; goals_for?: number; xg?: number };
export type XgSnapshot = { season: string; capturedAt: string; players: (XgRow & { competitionId: number })[]; teams?: TeamXgRow[] };
async function getXgRows(season: string, snapshot?: XgSnapshot) {
  const divisions = [[10, "championship"], [11, "league-one"], [12, "league-two"]] as const;
  const results = snapshot && snapshot.season === season && snapshot.players.length > 1000
    ? snapshot.players
    : (await Promise.all(divisions.map(async ([competitionId, slug]) => {
    const response = await fetch(`https://statz.ai/competitions/${slug}/xg/players`, { headers: { "user-agent": "Fantasy-EFL-Data-Board/1.0" } });
    if (!response.ok) throw new Error(`Statz ${slug}: ${response.status}`);
    const html = await response.text();
    const encoded = html.match(/data-page="([^"]+)"/)?.[1];
    if (!encoded) throw new Error(`Statz ${slug}: player data not found`);
    const page = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#039;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">")) as { props: { seasonLabel: string; players: XgRow[] } };
    if (page.props.seasonLabel !== season || page.props.players.length < 100) throw new Error(`Statz ${slug}: unexpected season or incomplete player list`);
    return page.props.players.map((row) => ({ ...row, competitionId }));
  }))).flat();
  const rows = new Map<string, { apps: number; xg: number; minutes: number }>();
  const aliases = new Map<string, { apps: number; xg: number; minutes: number } | null>();
  for (const row of results) {
    if (row.xg === null || row.minutes === null || row.minutes <= 0 || !Number.isFinite(row.xg)) continue;
    const key = `${row.competitionId}:${matchKey(row.team_name)}:${matchKey(row.player_name)}`;
    if (!rows.has(key)) rows.set(key, { apps: row.apps, xg: row.xg, minutes: row.minutes });
    const abbreviated = abbreviatedPlayerKey(row.player_name);
    if (abbreviated) {
      const alias = `${row.competitionId}:${matchKey(row.team_name)}:${abbreviated}`;
      aliases.set(alias, aliases.has(alias) ? null : { apps: row.apps, xg: row.xg, minutes: row.minutes });
    }
  }
  const teamRows = new Map<string, TeamXgRow>();
  for (const row of snapshot?.teams ?? []) teamRows.set(`${row.competitionId}:${matchKey(row.team_name)}`, row);
  const leagueAverages = new Map<number, { attack: number; defense: number }>();
  for (const competitionId of [10, 11, 12]) {
    const league = (snapshot?.teams ?? []).filter((row) => row.competitionId === competitionId && row.played > 0);
    if (league.length) leagueAverages.set(competitionId, { attack: league.reduce((sum, row) => sum + row.xg_per_game, 0) / league.length, defense: league.reduce((sum, row) => sum + row.xga_per_game, 0) / league.length });
  }
  return { rows, aliases, teamRows, leagueAverages, updatedAt: snapshot && snapshot.season === season ? snapshot.capturedAt : new Date().toISOString() };
}

export async function calculateDashboard(snapshot?: XgSnapshot, targetRoundId?: number, inputs?:DashboardInputs): Promise<DashboardData> {
  const [players, squads, rounds] = inputs ? [inputs.players,inputs.squads,inputs.rounds] : await Promise.all([getJson<RawPlayer[]>("players.json"), getJson<RawSquad[]>("squads.json"), getJson<RawRound[]>("rounds.json")]);
  const activeRounds = rounds.filter((round) => round.games?.some((game) => !["postponed", "cancelled"].includes(game.status)));
  const selected = selectRecommendationRounds(activeRounds);
  const target = activeRounds.find((round) => round.id === targetRoundId) ?? selected.primary;
  const completed = activeRounds.filter((round) => round.id < target.id && round.status === "completed");
  const earlier = activeRounds.filter((round) => round.id <= target.id && round.games.some((game) => game.status === "completed" && game.isFinalized));
  const recentRound = activeRounds.filter((round) => round.id < target.id || round.id === target.id && round.games.some(game=>game.status === "completed" && game.isFinalized)).at(-1);
  const targetDate = new Date(target.games[0].date);
  const seasonStart = targetDate.getUTCFullYear() - (targetDate.getUTCMonth() < 6 ? 1 : 0);
  const [lives, xgData] = await Promise.all([
    Promise.all(earlier.map(async (round) => {
      const live = inputs?.lives.get(round.id) ?? await getJson<LiveRound>(`live_scores/${round.id}.json`);
      const finalized = new Set(round.games.filter((game) => game.status === "completed" && game.isFinalized).map((game) => game.id));
      return { players: live.players.filter((row) => finalized.has(row.gameId)), squads: live.squads.filter((row) => finalized.has(row.gameId)) };
    })),
    getXgRows(`${seasonStart}/${seasonStart + 1}`, snapshot),
  ]);
  const xgRows = xgData.rows;
  const names = new Map(squads.map((squad) => [squad.id, squad.shortName || squad.name]));
  const squadsById = new Map(squads.map((squad) => [squad.id, squad]));
  const fixtures = new Map<number, string[]>();
  const fixtureDetails = new Map<number, { opponentId: number; home: boolean }[]>();
  const validGames = target.games.filter((game) => !["postponed", "cancelled", "completed"].includes(game.status));
  for (const game of validGames) {
    const home = fixtures.get(game.homeId) ?? []; home.push(`主 ${names.get(game.awayId) ?? "—"}`); fixtures.set(game.homeId, home);
    const away = fixtures.get(game.awayId) ?? []; away.push(`客 ${names.get(game.homeId) ?? "—"}`); fixtures.set(game.awayId, away);
    const homeDetails = fixtureDetails.get(game.homeId) ?? []; homeDetails.push({ opponentId: game.awayId, home: true }); fixtureDetails.set(game.homeId, homeDetails);
    const awayDetails = fixtureDetails.get(game.awayId) ?? []; awayDetails.push({ opponentId: game.homeId, home: false }); fixtureDetails.set(game.awayId, awayDetails);
  }
  const fixtureBadges = (squadId: number): FixtureBadge[] => (fixtureDetails.get(squadId) ?? []).map((match) => {
    const opponent = squadsById.get(match.opponentId);
    return { label: match.home ? "主" : "客", opponent: names.get(match.opponentId) ?? "—", opponentLogo: opponent?.lightBadge || opponent?.darkBadge || "" };
  });

  const teamGames = new Map<number, Set<number>>();
  const teamAgg = new Map<number, { games: number; wins: number; draws: number; cleanSheets: number; goals: number; fantasyPoints:number; conceded:number }>();
  const playerAgg = new Map<number, { games: number; minutes: number; sixty: number; points: number; goals: number; assists: number; saves: number; cleanSheets: number; clearances: number; blocks: number; tackles: number; interceptions: number; keyPasses: number; shotsOnTarget: number }>();
  const playerEventTotals = new Map<number, { games: number; totals: Record<StatKey, number> }>();
  const componentsByPlayer = new Map<number, ScoreComponents>();
  const positionComponents = new Map<Position, { games: number; totals: ScoreComponents }>();
  const playerPositions = new Map(players.map((player) => [player.id, player.position]));
  for (const live of lives) {
    for (const row of live.squads) {
      const seen = teamGames.get(row.squadId) ?? new Set<number>(); seen.add(row.gameId); teamGames.set(row.squadId, seen);
      const agg = teamAgg.get(row.squadId) ?? { games: 0, wins: 0, draws: 0, cleanSheets: 0, goals: 0, fantasyPoints:0, conceded:0 };
      agg.games += 1; agg.wins += row.win; agg.draws += row.draw; agg.cleanSheets += row.cleanSheet; agg.goals += row.goalsScored; agg.fantasyPoints += row.points ?? 0; agg.conceded += live.squads.find(opponent=>opponent.gameId===row.gameId && opponent.squadId!==row.squadId)?.goalsScored ?? 0; teamAgg.set(row.squadId, agg);
    }
    for (const row of live.players) {
      const position = playerPositions.get(row.playerId);
      if (position) {
        const parts = scoreComponents(row, position);
        const prior = componentsByPlayer.get(row.playerId) ?? emptyComponents();
        const league = positionComponents.get(position) ?? { games: 0, totals: emptyComponents() };
        for (const key of componentKeys) { prior[key] += parts[key]; league.totals[key] += parts[key]; }
        componentsByPlayer.set(row.playerId, prior);
        league.games += 1;
        positionComponents.set(position, league);
      }
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
    const playerFixtures = fixtures.get(player.squadId) ?? [];
    const matches = fixtureDetails.get(player.squadId) ?? [];
    const agg = playerAgg.get(player.id) ?? { games: 0, minutes: 0, sixty: 0, points: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, clearances: 0, blocks: 0, tackles: 0, interceptions: 0, keyPasses: 0, shotsOnTarget: 0 };
    const clubGames = teamGames.get(player.squadId)?.size ?? 0;
    const reliability = clubGames ? agg.sixty / clubGames : 0;
    const league = positionComponents.get(player.position);
    const mean = league ? Object.fromEntries(componentKeys.map((key) => [key, league.totals[key] / league.games])) as ScoreComponents : emptyComponents();
    const expected = estimateComponents(componentsByPlayer.get(player.id) ?? emptyComponents(), agg.games, mean);
    const squad = squadsById.get(player.squadId);
    // A one-appearance prior avoids treating tiny samples as certainty.
    const playingFactor = Math.min(1, (agg.games + 1) / (clubGames + 2));
    // Two 75-minute prior appearances temper noisy early-season averages; the
    // resulting minute adjustment is deliberately capped to a small range.
    const expectedMinutes = (agg.minutes + 150) / (agg.games + 2);
    const minuteFactor = Math.max(0.94, Math.min(1.06, 1 + 0.15 * (expectedMinutes - 75) / 75));
    const fullName = `${player.firstName} ${player.lastName}`.trim();
    const exactXg = squad ? xgRows.get(`${player.competitionId}:${matchKey(squad.name)}:${matchKey(fullName)}`) : undefined;
    const abbreviated = abbreviatedPlayerKey(fullName);
    const uniqueOfficial = players.filter(other=>other.squadId===player.squadId && abbreviatedPlayerKey(`${other.firstName} ${other.lastName}`)===abbreviated).length===1;
    const aliasXg = squad && uniqueOfficial && abbreviated ? xgData.aliases.get(`${player.competitionId}:${matchKey(squad.name)}:${abbreviated}`) : undefined;
    const sourceXg = exactXg ?? aliasXg;
    // Missing, ambiguous or out-of-sync feeds leave the goal baseline unchanged.
    const matchedXg = sourceXg?.apps === agg.games ? sourceXg : undefined;
    const expectedGoals = blendXgGoalPoints(expected.goals, matchedXg?.xg ?? null, matchedXg?.minutes ?? null, expectedMinutes, player.position);
    const expectedPerMatch = expected.attackActions + expected.defenseActions + expectedGoals + expected.assists + expected.cleanSheet + expected.other;
    const matchups: number[] = [];
    const scoreRaw = matches.reduce((total, match) => {
      const opponent = squadsById.get(match.opponentId);
      const row = opponent ? xgData.teamRows.get(`${player.competitionId}:${matchKey(opponent.name)}`) : undefined;
      const league = xgData.leagueAverages.get(player.competitionId);
      const evidence = row ? row.played / (row.played + 8) : 0;
      const attackRatio = row && league ? row.xga_per_game / league.defense : 1;
      const defenseRatio = row && league ? row.xg_per_game / league.attack : 1;
      const clamp = (value: number) => Math.max(0.85, Math.min(1.15, value));
      const attackFactor = clamp(1 + 0.35 * evidence * (attackRatio - 1));
      const defenseFactor = clamp(1 - 0.35 * evidence * (defenseRatio - 1));
      // Action counts stay on the player's own history: opponent-driven
      // clearances/interceptions are too noisy to model reliably here.
      const matchupScore = (expected.attackActions + expectedGoals + expected.assists) * attackFactor
        + expected.defenseActions
        + expected.cleanSheet * defenseFactor + expected.other;
      const matchupFactor = expectedPerMatch > 0 ? matchupScore / expectedPerMatch : 1;
      matchups.push(matchupFactor);
      return total + Math.max(0, matchupScore) * playingFactor * minuteFactor;
    }, 0);
    const available = player.status === "playing" && !player.injuryDetails && !player.suspensionDetails;
    allPicks.push({ id: player.id, name: player.displayName, fullName, team: names.get(player.squadId) ?? "—", position: player.position, ownership: Number((player.percentSelected ?? 0).toFixed(1)), fixtures: playerFixtures.length ? playerFixtures : ["本轮无剩余赛程"], fixtureBadges: fixtureBadges(player.squadId), reliability: Math.round(reliability * 100), expectedMinutes: Math.round(expectedMinutes), score: available ? Number(scoreRaw.toFixed(1)) : 0, matchup: Number(((matchups.length ? matchups.reduce((sum, value) => sum + value, 0) / matchups.length : 1) * 100 - 100).toFixed(1)), actionScore: Number((expected.attackActions + expected.defenseActions).toFixed(1)), returnScore: Number((expectedGoals + expected.assists).toFixed(1)), points: agg.points, minutes: agg.minutes, avatarUrl: squad?.jersey || squad?.lightBadge || squad?.darkBadge || "", teamLogo: squad?.lightBadge || squad?.darkBadge || "", fallbackImage: squad?.jersey || squad?.lightBadge || squad?.darkBadge || "" });
  }
  allPicks.sort((a, b) => b.score - a.score || b.reliability - a.reliability);
  const picks = Object.fromEntries(["GK", "DEF", "MID", "FWD"].map((position) => [position, allPicks.filter((player) => player.position === position)])) as Record<Position, PlayerPick[]>;
  const startingSeven = [picks.FWD[0], picks.MID[0], picks.GK[0], ...picks.DEF.slice(0, 2), picks.MID[1], picks.FWD[1]].filter(Boolean);
  const playerStats: PlayerStat[] = players.flatMap((player) => {
    const events = playerEventTotals.get(player.id);
    if (!events?.games) return [];
    const fullName = `${player.firstName} ${player.lastName}`.trim();
    const squad = squadsById.get(player.squadId);
    const exact = squad ? xgRows.get(`${player.competitionId}:${matchKey(squad.name)}:${matchKey(fullName)}`) : undefined;
    const abbreviated = abbreviatedPlayerKey(fullName);
    const uniqueOfficial = players.filter(other => other.squadId === player.squadId && abbreviatedPlayerKey(`${other.firstName} ${other.lastName}`) === abbreviated).length === 1;
    const alias = squad && uniqueOfficial && abbreviated ? xgData.aliases.get(`${player.competitionId}:${matchKey(squad.name)}:${abbreviated}`) : undefined;
    const sourceXg = exact ?? alias;
    const xg = sourceXg?.apps === events.games ? sourceXg : undefined;
    return [{ id: player.id, fullName, team: names.get(player.squadId) ?? "—", jerseyUrl: squad?.jersey || squad?.lightBadge || squad?.darkBadge || "", teamLogo: squad?.lightBadge || squad?.darkBadge || "", competitionId: player.competitionId, position: player.position, appearances: events.games, ownership: Number((player.percentSelected ?? 0).toFixed(1)), xg: xg?.xg ?? null, xg90: xg ? Number((xg.xg * 90 / xg.minutes).toFixed(3)) : null, xgMinutes: xg?.minutes ?? null, goals90: events.totals.minutesPlayed > 0 ? Number((events.totals.goalsScored * 90 / events.totals.minutesPlayed).toFixed(3)) : null, seasonGoals: xg ? events.totals.goalsScored : null, perGame: Object.fromEntries(statKeys.map((key) => [key, events.totals[key] / events.games])) as Record<StatKey, number> }];
  });
  const squadByName = new Map(squads.map((squad) => [`${squad.competitionId}:${matchKey(squad.name)}`, squad]));
  const teamAliases: Record<string, string> = { miltonkeynesdons: "mkdons" };
  const teamStats: TeamStat[] = squads.map(squad=>{
    const row=(snapshot?.teams ?? []).find(item=>item.competitionId===squad.competitionId && (teamAliases[matchKey(item.team_name)] ?? matchKey(item.team_name))===matchKey(squad.name));
    const agg=teamAgg.get(squad.id);
    const rate=(value: number | undefined, scale=1)=>agg?.games && value!=null ? value/agg.games*scale : null;
    const sourceRate = (value: number | undefined) => row?.played && value != null && Number.isFinite(value) ? value / row.played : null;
    return {xgdPerGame: sourceRate(row?.xgd), xptsPerGame: sourceRate(row?.xpts), pointsDeltaPerGame: sourceRate(row?.points_delta), finishingDeltaPerGame: row?.goals_for != null && row.xg != null ? sourceRate(row.goals_for - row.xg) : null, xgShare: row && row.xg_per_game + row.xga_per_game > 0 ? 100 * row.xg_per_game / (row.xg_per_game + row.xga_per_game) : null, id:squad.id,name:squad.shortName || squad.name,fullName:squad.name,logo:squad.lightBadge || squad.darkBadge || "",competitionId:squad.competitionId,played:agg?.games ?? 0,fantasyPointsPerGame:rate(agg?.fantasyPoints),goalsAgainstPerGame:rate(agg?.conceded),xgPerGame:row?.played ? row.xg_per_game : null,xgaPerGame:row?.played ? row.xga_per_game : null,goalsPerGame:rate(agg?.goals),winRate:rate(agg?.wins,100),cleanSheetRate:rate(agg?.cleanSheets,100),pointsPerGame:agg ? rate(agg.wins*3+agg.draws) : null};
  });
  const teams: TeamPick[] = squads.filter((squad) => fixtures.has(squad.id)).map((squad) => {
    const agg = teamAgg.get(squad.id) ?? { games: 0, wins: 0, draws: 0, cleanSheets: 0, goals: 0, fantasyPoints:0, conceded:0 };
    const teamFixtures = fixtures.get(squad.id)!;
    const own = xgData.teamRows.get(`${squad.competitionId}:${matchKey(squad.name)}`);
    const league = xgData.leagueAverages.get(squad.competitionId);
    const projections = (fixtureDetails.get(squad.id) ?? []).map(match => {
      const opponent = squadsById.get(match.opponentId);
      const opposing = opponent && xgData.teamRows.get(`${squad.competitionId}:${matchKey(opponent.name)}`);
      return projectTeamMatch({ rank: squad.leaguePosition, opponentRank: opponent?.leaguePosition, own, opposing, league, home:match.home, wins:agg.wins, games:agg.games });
    });
    return { id: squad.id, name: squad.name, logo: squad.lightBadge || squad.darkBadge || "", fixtures: teamFixtures, fixtureBadges: fixtureBadges(squad.id), form: recentTeamForm(lives.flatMap(live=>live.squads),rounds.flatMap(round=>round.games),squad.id), score: Number(projections.reduce((sum,p)=>sum+p.score,0).toFixed(1)), leaguePosition:squad.leaguePosition ?? null, projectedXg:own && league ? Number(projections.reduce((sum,p)=>sum+p.xg,0).toFixed(2)) : null, projectedXga:own && league ? Number(projections.reduce((sum,p)=>sum+p.xga,0).toFixed(2)) : null };
  }).sort((a, b) => b.score - a.score).slice(0, 12);
  return { meta: { roundId: target.id, roundName: target.name.replace("Gameweek", "GW"), lockoutAt: target.lockoutDate, fixtureCount: validGames.length, doubleTeams: [...fixtures.values()].filter((list) => list.length > 1).length, completedRounds: completed.length, recentRoundName: recentRound?.name.replace("Gameweek", "GW") ?? "", recentFinalizedGames: recentRound?.games.filter((game) => game.status === "completed" && game.isFinalized).length ?? 0, recentTotalGames: recentRound?.games.filter((game) => !["postponed", "cancelled"].includes(game.status)).length ?? 0, updatedAt: new Date().toISOString(), xgUpdatedAt: xgData.updatedAt, portraitVersion: 3, modelVersion: 10 }, picks, startingSeven, playerStats, teamStats, teams, news: [], differentialCount: allPicks.filter((player) => player.score > 0 && player.ownership <= 3).length };
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
  if (cached && hasRichImages && cached.meta.modelVersion === 9 && Date.parse(cached.meta.lockoutAt) > Date.now() && age < 4 * 60 * 60 * 1000) return cached;
  try { return await refreshDashboardData(); } catch (error) { if (cached) return cached; throw error; }
}
