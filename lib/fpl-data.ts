export type FplPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type FplMatch = { fixture: number; round: number; date: string; opponent: number; home: boolean; minutes: number; points: number; goals: number; assists: number; cleanSheets: number; conceded: number; saves: number; bonus: number; bps: number; xg: number | null; xa: number | null; xgi: number | null; cbi: number | null; tackles: number | null; recoveries: number | null; defensive: number | null; starts: number };
export type FplPlayer = { id: number; name: string; fullName: string; team: number; position: FplPosition; price: number; ownership: number | null; transfersIn: number; transfersOut: number; priceChange: number; status: string; news: string; newsAt: string | null; chance: number | null; epNext: number | null; epThis: number | null; setPieces: { penalties: number | null; corners: number | null; freeKicks: number | null }; history: FplMatch[] };
export type FplTeam = { id: number; name: string; shortName: string; logo: string; jerseyUrl?: string; keeperJerseyUrl?: string };
export type FplFixture = { id: number; event: number | null; date: string | null; home: number; away: number; homeScore: number | null; awayScore: number | null; finished: boolean; provisional: boolean; started: boolean; homeDifficulty: number | null; awayDifficulty: number | null };
export type FplEvent = { id: number; name: string; deadline: string; finished: boolean; checked: boolean; current: boolean; next: boolean };
export type FplData = { schemaVersion: number; season: string; capturedAt: string; historyCapturedAt: string; stale: boolean; warning: string | null; currentEvent: number; players: FplPlayer[]; teams: FplTeam[]; fixtures: FplFixture[]; events: FplEvent[]; rules: { budget: number; squadSize: number; starters: number; teamLimit: number }; scoring: Record<string, unknown> };

export const fplPositionNames: Record<FplPosition, string> = { GK: '门将', DEF: '后卫', MID: '中场', FWD: '前锋' };
export type FplMetric = { key: string; label: string; lower?: boolean; format?: 'money' | 'percent'; value: (p: FplPlayer, matches: FplMatch[]) => number | null };
export const total = (rows: FplMatch[], key: keyof FplMatch): number | null => rows.length && rows.every(r => typeof r[key] === 'number' && Number.isFinite(r[key])) ? rows.reduce((s, r) => s + Number(r[key]), 0) : null;
const rate = (rows: FplMatch[], key: keyof FplMatch, per90 = false) => {
  const value = total(rows, key), denominator = per90 ? total(rows, 'minutes') : rows.length;
  return value == null || !denominator ? null : value * (per90 ? 90 : 1) / denominator;
};
export const fplMetrics: FplMetric[] = [
  { key: 'points', label: 'Fantasy 总分', value: (_, r) => total(r, 'points') },
  { key: 'ppg', label: 'Fantasy 得分 / 场', value: (_, r) => rate(r, 'points') },
  { key: 'points90', label: 'Fantasy 得分 / 90', value: (_, r) => rate(r, 'points', true) },
  { key: 'minutes', label: '出场分钟', value: (_, r) => total(r, 'minutes') },
  { key: 'minutesGame', label: '分钟 / 场', value: (_, r) => rate(r, 'minutes') },
  { key: 'goals', label: '进球 / 90', value: (_, r) => rate(r, 'goals', true) },
  { key: 'assists', label: '助攻 / 90', value: (_, r) => rate(r, 'assists', true) },
  { key: 'xg', label: 'xG / 90', value: (_, r) => rate(r, 'xg', true) },
  { key: 'xa', label: 'xA / 90', value: (_, r) => rate(r, 'xa', true) },
  { key: 'xgi', label: 'xGI / 90', value: (_, r) => rate(r, 'xgi', true) },
  { key: 'bonus', label: 'Bonus / 场', value: (_, r) => rate(r, 'bonus') },
  { key: 'bps', label: 'BPS / 场', value: (_, r) => rate(r, 'bps') },
  { key: 'defensive', label: '防守贡献次数 / 场', value: (p, r) => p.position === 'GK' ? null : rate(r, 'defensive') },
  { key: 'dcRate', label: '防守贡献达标率', format: 'percent', value: (p, r) => p.position === 'GK' || !r.length || r.some(m => m.defensive == null) ? null : 100 * r.filter(m => m.defensive! >= (p.position === 'DEF' ? 10 : 12)).length / r.length },
  { key: 'clean', label: '零封场次占比', format: 'percent', value: (_, r) => { const n = rate(r, 'cleanSheets'); return n == null ? null : n * 100; } },
  { key: 'conceded', label: '在场失球 / 90', lower: true, value: (_, r) => rate(r, 'conceded', true) },
  { key: 'saves', label: '扑救 / 90', value: (p, r) => p.position === 'GK' ? rate(r, 'saves', true) : null },
  { key: 'price', label: '当前价格 £m', format: 'money', value: p => p.price },
  { key: 'ownership', label: '当前持有率', format: 'percent', value: p => p.ownership },
  { key: 'transfersIn', label: '当前轮转入', value: p => p.transfersIn },
  { key: 'transfersOut', label: '当前轮转出', value: p => p.transfersOut },
  { key: 'transfersNet', label: '当前轮净转入', value: p => p.transfersIn - p.transfersOut },
  { key: 'priceChange', label: '开季至今价格变化 £m', value: p => p.priceChange },
  { key: 'value', label: '场均得分 / 当前£m', value: (p, r) => { const n = rate(r, 'points'); return n == null || p.price <= 0 ? null : n / p.price; } },
];
export function matchSample(player: FplPlayer, through: number, recent = 0): FplMatch[] {
  const rows = player.history.filter(m => m.round <= through && m.minutes > 0).sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.fixture - b.fixture);
  return recent > 0 ? rows.slice(-recent) : rows;
}
export function formatFpl(value: number | null, metric?: FplMetric): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return metric?.format === 'money' ? `£${value.toFixed(1)}m` : `${value.toFixed(metric?.format === 'percent' ? 1 : 2)}${metric?.format === 'percent' ? '%' : ''}`;
}

export type FplTeamRow = { team: FplTeam; played: number; points: number; goals: number; conceded: number; goalsGame: number | null; concededGame: number | null; pointsGame: number | null; winRate: number | null; cleanRate: number | null; form: string[] };
export function fplTeamRows(data: FplData, through: number, recent = 0): FplTeamRow[] {
  return data.teams.map(team => {
    let games = data.fixtures.filter(f => f.finished && f.event != null && f.event <= through && (f.home === team.id || f.away === team.id) && f.homeScore != null && f.awayScore != null).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id - b.id);
    if (recent) games = games.slice(-recent);
    let goals = 0, conceded = 0, points = 0, wins = 0, clean = 0;
    const form = games.map(f => { const gf = f.home === team.id ? f.homeScore! : f.awayScore!, ga = f.home === team.id ? f.awayScore! : f.homeScore!; goals += gf; conceded += ga; if (!ga) clean++; const result = gf > ga ? 'W' : gf === ga ? 'D' : 'L'; if (result === 'W') wins++; points += result === 'W' ? 3 : result === 'D' ? 1 : 0; return result; });
    const n = games.length;
    return { team, played: n, points, goals, conceded, goalsGame: n ? goals / n : null, concededGame: n ? conceded / n : null, pointsGame: n ? points / n : null, winRate: n ? 100 * wins / n : null, cleanRate: n ? 100 * clean / n : null, form: form.slice(-5) };
  });
}
export type FplRankedPlayer = { player: FplPlayer; score: number; minutes: number | null; actual: boolean };
export function fplRankings(data: FplData, gw: number): FplRankedPlayer[] {
  const event = data.events.find(e => e.id === gw);
  const actual = !!event?.finished;
  return data.players.flatMap(player => {
    const matches = player.history.filter(m => m.round === gw);
    const score = actual ? matches.length ? matches.reduce((s, m) => s + m.points, 0) : null : event?.current ? player.epThis : event?.next ? player.epNext : null;
    if (score == null || !Number.isFinite(score) || !actual && ['i', 's', 'u', 'n'].includes(player.status)) return [];
    return [{ player, score, minutes: actual ? matches.reduce((s, m) => s + m.minutes, 0) : null, actual }];
  }).sort((a, b) => b.score - a.score || (b.minutes ?? 0) - (a.minutes ?? 0) || a.player.id - b.player.id);
}
export function fplReferenceXI(rows: FplRankedPlayer[], teamLimit = 3): FplRankedPlayer[] {
  let best: FplRankedPlayer[] = [], bestScore = -Infinity;
  for (const def of [3, 4, 5]) for (const mid of [2, 3, 4, 5]) {
    const fwd = 10 - def - mid;
    if (fwd < 1 || fwd > 3) continue;
    const limits = { GK: 1, DEF: def, MID: mid, FWD: fwd }, counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const clubs = new Map<number, number>(), selected: FplRankedPlayer[] = [];
    for (const row of rows) {
      const p = row.player;
      if (counts[p.position] >= limits[p.position] || (clubs.get(p.team) ?? 0) >= teamLimit) continue;
      selected.push(row); counts[p.position]++; clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1);
    }
    const sum = selected.reduce((s, r) => s + r.score, 0);
    if (selected.length === 11 && sum > bestScore) { best = selected; bestScore = sum; }
  }
  return best;
}
export function fplShirt(player: Pick<FplPlayer, 'position' | 'team'>, team?: FplTeam) { return (player.position === 'GK' ? team?.keeperJerseyUrl : team?.jerseyUrl) || team?.logo || ''; }
