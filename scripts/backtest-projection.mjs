import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../lib/dashboard-data.ts", import.meta.url), "utf8"))
  .replace('import { env } from "cloudflare:workers";', "const env = { DB: null };");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { scoreComponents, estimateComponents, emptyComponents } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const api = "https://fantasy.efl.com/json/fantasy/";
const get = async (path) => {
  const response = await fetch(`${api}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const [players, rounds] = await Promise.all([get("players.json"), get("rounds.json")]);
const positions = new Map(players.map((player) => [player.id, player.position]));
const completed = rounds.filter((round) => round.status === "completed").sort((a, b) => a.id - b.id);
const lives = await Promise.all(completed.map((round) => get(`live_scores/${round.id}.json`)));
const keys = ["attackActions", "defenseActions", "goals", "assists", "cleanSheet", "other"];
const result = Object.fromEntries(["GK", "DEF", "MID", "FWD"].map((position) => [position, { n: 0, oldAbs: 0, newAbs: 0, oldSquared: 0, newSquared: 0 }]));

for (let testIndex = 3; testIndex < completed.length; testIndex++) {
  const byPlayer = new Map();
  const byPosition = new Map();
  for (const live of lives.slice(0, testIndex)) for (const row of live.players) {
    const position = positions.get(row.playerId);
    if (!position) continue;
    const pieces = scoreComponents(row, position);
    const player = byPlayer.get(row.playerId) ?? { games: 0, minutes: 0, points: 0, saves: 0, cleanSheets: 0, clearances: 0, blocks: 0, tackles: 0, interceptions: 0, keyPasses: 0, shotsOnTarget: 0, goals: 0, assists: 0, totals: emptyComponents() };
    const group = byPosition.get(position) ?? { games: 0, totals: emptyComponents() };
    player.games++; group.games++; player.points += row.points ?? 0; player.minutes += row.minutesPlayed ?? 0;
    for (const key of keys) { player.totals[key] += pieces[key]; group.totals[key] += pieces[key]; }
    for (const [from, to] of [["saves", "saves"], ["cleanSheet", "cleanSheets"], ["clearances", "clearances"], ["blocks", "blocks"], ["tackles", "tackles"], ["interceptions", "interceptions"], ["keyPasses", "keyPasses"], ["shotsOnTarget", "shotsOnTarget"], ["goalsScored", "goals"], ["assists", "assists"]]) player[to] += row[from] ?? 0;
    byPlayer.set(row.playerId, player); byPosition.set(position, group);
  }
  for (const row of lives[testIndex].players) {
    const position = positions.get(row.playerId);
    const player = byPlayer.get(row.playerId);
    if (!position || !player || player.games < 3) continue;
    const per90 = (value) => value * 90 / Math.max(player.minutes, 270);
    let underlying = 0;
    if (position === "GK") underlying = per90(player.saves) * .75 + per90(player.cleanSheets) * .8;
    if (position === "DEF") underlying = per90(player.clearances) * .18 + per90(player.blocks) * .8 + per90(player.tackles) * .45 + per90(player.interceptions) * .45 + per90(player.cleanSheets) * .7 + per90(player.goals) * 1.8 + per90(player.assists);
    if (position === "MID") underlying = per90(player.keyPasses) * .7 + per90(player.shotsOnTarget) * 1.15 + per90(player.interceptions) * .35 + per90(player.goals) * 1.6 + per90(player.assists);
    if (position === "FWD") underlying = per90(player.keyPasses) * .5 + per90(player.shotsOnTarget) * 1.45 + per90(player.goals) * 1.7 + per90(player.assists);
    const oldScore = .8 * player.points / player.games + .2 * underlying;
    const group = byPosition.get(position);
    const mean = Object.fromEntries(keys.map((key) => [key, group.totals[key] / group.games]));
    const newScore = Object.values(estimateComponents(player.totals, player.games, mean)).reduce((sum, value) => sum + value, 0);
    const entry = result[position];
    entry.n++;
    entry.oldAbs += Math.abs(oldScore - row.points);
    entry.newAbs += Math.abs(newScore - row.points);
    entry.oldSquared += (oldScore - row.points) ** 2;
    entry.newSquared += (newScore - row.points) ** 2;
  }
}
for (const [position, value] of Object.entries(result)) {
  console.log(`${position}: n=${value.n}, old MAE=${(value.oldAbs / value.n).toFixed(3)}, new MAE=${(value.newAbs / value.n).toFixed(3)}, old RMSE=${Math.sqrt(value.oldSquared / value.n).toFixed(3)}, new RMSE=${Math.sqrt(value.newSquared / value.n).toFixed(3)}`);
}
