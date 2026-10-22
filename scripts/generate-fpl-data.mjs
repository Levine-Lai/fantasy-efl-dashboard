import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { cacheChartAssets } from './cache-chart-assets.mjs';

const api = 'https://fantasy.premierleague.com/api/';
const root = new URL('../data/fpl/', import.meta.url);
const output = new URL('../public/fpl/dashboard.json', import.meta.url);
export const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const requiredNumber = (value, label) => { const n = number(value); if (n == null) throw Error(`FPL invalid ${label}`); return n; };
async function get(path) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(api + path, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'FantasyDataDashboard/1.0' } });
      if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
      return await response.json();
    } catch (error) { failure = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
  }
  throw failure;
}
export function validateBootstrap(b) {
  if (!Array.isArray(b.elements) || !b.elements.length || !Array.isArray(b.teams) || !b.teams.length || !Array.isArray(b.events) || !b.events.length) throw Error('FPL bootstrap arrays missing');
  const teams = new Set(b.teams.map(t => t.id));
  if (new Set(b.elements.map(p => p.id)).size !== b.elements.length) throw Error('FPL duplicate player IDs');
  for (const p of b.elements) {
    if (!teams.has(p.team) || ![1, 2, 3, 4].includes(p.element_type) || number(p.now_cost) == null || number(p.minutes) == null) throw Error(`FPL invalid player ${p.id}`);
  }
  const dates = b.events.map(e => Date.parse(e.deadline_time));
  if (dates.some(d => !Number.isFinite(d))) throw Error('FPL invalid event deadline');
  const first = new Date(Math.min(...dates));
  const year = first.getUTCFullYear() - (first.getUTCMonth() < 6 ? 1 : 0);
  return `${year}-${String(year + 1).slice(-2)}`;
}
export function normalizeHistory(rows, fixtures) {
  const seen = new Set();
  return rows.flatMap(r => {
    const f = fixtures.get(r.fixture);
    // Do not publish unplayed/provisional match rows as settled statistics.
    if (!f?.finished || !f.event) return [];
    if (seen.has(r.fixture)) throw Error(`FPL duplicate fixture ${r.fixture}`);
    seen.add(r.fixture);
    if (!Number.isFinite(Date.parse(r.kickoff_time))) throw Error('FPL invalid history date');
    return [{ fixture: r.fixture, round: f.event, date: r.kickoff_time, opponent: r.opponent_team, home: !!r.was_home,
      ...Object.fromEntries(Object.entries({ minutes: 'minutes', points: 'total_points', goals: 'goals_scored', assists: 'assists', cleanSheets: 'clean_sheets', conceded: 'goals_conceded', saves: 'saves', bonus: 'bonus', bps: 'bps', starts: 'starts' }).map(([key, raw]) => [key, requiredNumber(r[raw], raw)])),
      ...Object.fromEntries(Object.entries({ xg: 'expected_goals', xa: 'expected_assists', xgi: 'expected_goal_involvements', cbi: 'clearances_blocks_interceptions', tackles: 'tackles', recoveries: 'recoveries', defensive: 'defensive_contribution' }).map(([key, raw]) => [key, number(r[raw])])),
    }];
  });
}
async function atomic(file, value) { await writeFile(new URL(file.href + '.tmp'), JSON.stringify(value)); await rename(new URL(file.href + '.tmp'), file); }
export async function generateFpl() {
  await Promise.all([mkdir(root, { recursive: true }), mkdir(new URL('../public/fpl/', import.meta.url), { recursive: true })]);
  const [bootstrap, fixtures] = await Promise.all([get('bootstrap-static/'), get('fixtures/')]);
  const season = validateBootstrap(bootstrap);
  if (!Array.isArray(fixtures) || !fixtures.length) throw Error('FPL fixtures missing');
  const teamIds = new Set(bootstrap.teams.map(t => t.id)), eventIds = new Set(bootstrap.events.map(e => e.id));
  if (new Set(fixtures.map(f => f.id)).size !== fixtures.length || fixtures.some(f => !teamIds.has(f.team_h) || !teamIds.has(f.team_a) || f.event != null && !eventIds.has(f.event) || f.finished && (number(f.team_h_score) == null || number(f.team_a_score) == null))) throw Error('FPL fixture references or settled scores invalid');
  const fixtureMap = new Map(fixtures.map(f => [f.id, f]));
  const historyFile = new URL(`histories-${season}.json`, root);
  const old = await readFile(historyFile, 'utf8').then(JSON.parse).catch(() => null);
  // A complete same-day raw cache also makes local UI builds reproducible.
  const signature = JSON.stringify(fixtures.map(f => [f.id, f.event, f.finished, f.team_h_score, f.team_a_score]));
  const reuse = old?.season === season && old.signature === signature && Date.now() - Date.parse(old.capturedAt) < 3 * 3600000;
  const histories = {};
  let cursor = 0;
  const active = bootstrap.elements.filter(p => Number(p.minutes) > 0);
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < active.length) {
      const index = cursor++, p = active[index];
      const raw = reuse && old.players[p.id] ? old.players[p.id] : await get(`element-summary/${p.id}/`);
      if (!Array.isArray(raw.history)) throw Error(`FPL history missing: ${p.id}`);
      normalizeHistory(raw.history, fixtureMap);
      histories[p.id] = raw;
      if ((index + 1) % 75 === 0) console.log(`FPL player histories ${index + 1}/${active.length}`);
    }
  }));
  const capturedAt = new Date().toISOString(), historyCapturedAt = reuse ? old.capturedAt : capturedAt;
  const multiplier = requiredNumber(bootstrap.game_settings.ui_currency_multiplier, 'currency multiplier');
  if (multiplier <= 0) throw Error('FPL invalid currency multiplier');
  const data = {
    schemaVersion: 1, season, capturedAt, historyCapturedAt, stale: false, warning: null,
    currentEvent: (bootstrap.events.find(e => e.is_current) ?? bootstrap.events.find(e => e.is_next) ?? bootstrap.events.at(-1)).id,
    teams: bootstrap.teams.map(t => ({ id: t.id, name: t.name, shortName: t.short_name, sourceLogo: `https://resources.premierleague.com/premierleague/badges/70/t${t.code}.png`, logo: `https://resources.premierleague.com/premierleague/badges/70/t${t.code}.png`, sourceJerseyUrl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${t.code}-110.webp`, jerseyUrl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${t.code}-110.webp`, sourceKeeperJerseyUrl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${t.code}_1-110.webp`, keeperJerseyUrl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${t.code}_1-110.webp` })),
    players: bootstrap.elements.map(p => ({ id: p.id, name: p.web_name, fullName: `${p.first_name} ${p.second_name}`.trim(), team: p.team, position: ['GK', 'DEF', 'MID', 'FWD'][p.element_type - 1], price: p.now_cost / multiplier, ownership: number(p.selected_by_percent), transfersIn: requiredNumber(p.transfers_in_event, 'transfers in'), transfersOut: requiredNumber(p.transfers_out_event, 'transfers out'), priceChange: requiredNumber(p.cost_change_start, 'price change') / multiplier, status: p.status, news: p.news || '', newsAt: p.news_added, chance: number(p.chance_of_playing_next_round), epNext: number(p.ep_next), epThis: number(p.ep_this), setPieces: { penalties: number(p.penalties_order), corners: number(p.corners_and_indirect_freekicks_order), freeKicks: number(p.direct_freekicks_order) }, history: normalizeHistory(histories[p.id]?.history ?? [], fixtureMap) })),
    fixtures: fixtures.map(f => ({ id: f.id, event: f.event, date: f.kickoff_time, home: f.team_h, away: f.team_a, homeScore: f.team_h_score, awayScore: f.team_a_score, finished: !!f.finished, provisional: !!f.finished_provisional, started: !!f.started, homeDifficulty: number(f.team_h_difficulty), awayDifficulty: number(f.team_a_difficulty) })),
    events: bootstrap.events.map(e => ({ id: e.id, name: e.name.replace('Gameweek ', 'GW'), deadline: e.deadline_time, finished: e.finished, checked: e.data_checked, current: e.is_current, next: e.is_next })),
    rules: { budget: bootstrap.game_settings.squad_total_spend / multiplier, squadSize: bootstrap.game_settings.squad_squadsize, starters: bootstrap.game_settings.squad_squadplay, teamLimit: bootstrap.game_settings.squad_team_limit },
    scoring: bootstrap.game_config?.scoring ?? {},
  };
  await cacheChartAssets(data);
  await atomic(new URL('raw.json', root), { season, capturedAt, bootstrap, fixtures });
  if (!reuse) await atomic(historyFile, { season, capturedAt, signature, players: histories });
  await atomic(new URL('snapshot.json', root), data);
  await atomic(output, data);
  console.log(`FPL ${season}: ${data.players.length} players, ${data.teams.length} teams, ${data.players.reduce((n, p) => n + p.history.length, 0)} settled history rows.`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await generateFpl(); }
  catch (error) {
    console.error('FPL refresh failed:', error.message);
    // Only fall back if the official bootstrap still identifies the same season.
    const old = await readFile(new URL('snapshot.json', root), 'utf8').then(JSON.parse).catch(() => null);
    const season = await get('bootstrap-static/').then(validateBootstrap).catch(() => null);
    if (!old || !season || old.season !== season || old.schemaVersion !== 1 || !old.players?.length) throw error;
    for (const team of old.teams) { if (team.sourceLogo) team.logo = team.sourceLogo; if (team.sourceJerseyUrl) team.jerseyUrl = team.sourceJerseyUrl; if (team.sourceKeeperJerseyUrl) team.keeperJerseyUrl = team.sourceKeeperJerseyUrl; }
    await cacheChartAssets(old);
    await atomic(output, { ...old, stale: true, warning: '本次更新失败，正在显示同赛季的上次成功快照。' });
    console.warn(`FPL using validated ${season} snapshot from ${old.capturedAt}`);
  }
}
