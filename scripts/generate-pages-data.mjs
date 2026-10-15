import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { enrichNews } from "./enrich-news.mjs";
import { cacheChartAssets } from "./cache-chart-assets.mjs";

await import("./update-player-snapshot.mjs");
const sourceUrl = new URL("../lib/dashboard-data.ts", import.meta.url);
const outputUrl = new URL("../pages/dashboard.json", import.meta.url);
const xgUrl = new URL("../data/xg-snapshot.json", import.meta.url);
const source = (await readFile(sourceUrl, "utf8"))
  .replace('import { env } from "cloudflare:workers";', "const env = { DB: null };")
  .replace("async function calculateDashboard(snapshot?: XgSnapshot, targetRoundId?: number): Promise<DashboardData>", "export async function calculateDashboard(snapshot?: XgSnapshot, targetRoundId?: number): Promise<DashboardData>");
if (!source.includes("export async function calculateDashboard")) throw new Error("Dashboard calculation was not found");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const { calculateDashboard, selectRecommendationRounds } = await import(moduleUrl);
const snapshot = JSON.parse(await readFile(xgUrl, "utf8"));
const roundsResponse = await fetch("https://fantasy.efl.com/json/fantasy/rounds.json");
if (!roundsResponse.ok) throw new Error(`Fantasy EFL rounds: ${roundsResponse.status}`);
const { upcoming } = selectRecommendationRounds(await roundsResponse.json());
const [data, next] = await Promise.all([calculateDashboard(snapshot), upcoming ? calculateDashboard(snapshot, upcoming.id) : Promise.resolve(null)]);
if (next) data.upcomingRound = { meta: next.meta, picks: next.picks, startingSeven: next.startingSeven, teams: next.teams, differentialCount: next.differentialCount };
const advanced = JSON.parse(await readFile(new URL('../data/player-advanced.json', import.meta.url),'utf8'));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const officialSquads = await fetch('https://fantasy.efl.com/json/fantasy/squads.json').then(r=>{if(!r.ok)throw new Error('Squads unavailable');return r.json();});
const fullTeams = new Map(officialSquads.map(t=>[`${t.competitionId}:${normalize(t.shortName || t.name)}`,normalize(t.name)]));
const alias = name => {const parts=name.trim().split(/\s+/);return parts.length>1?normalize(parts[0][0]+parts.slice(1).join('')):'';};
let matched=0;
for (const player of data.playerStats) {
  const team = fullTeams.get(`${player.competitionId}:${normalize(player.team)}`);
  const candidates = advanced.players.filter(row=>row.competitionId===player.competitionId && normalize(row.team)===team);
  const exact = candidates.filter(row=>normalize(row.name)===normalize(player.fullName));
  const abbreviated = candidates.filter(row=>alias(row.name)===alias(player.fullName));
  const officialUnique = data.playerStats.filter(row=>row.competitionId===player.competitionId && row.team===player.team && alias(row.fullName)===alias(player.fullName)).length===1;
  const row = exact.length===1 ? exact[0] : !exact.length && officialUnique && abbreviated.length===1 ? abbreviated[0] : null;
  if(row && row.apps===player.appearances && row.mins>0) { const {name,team,competitionId,...metrics}=row; player.advanced={...metrics,updatedAt:advanced.capturedAt}; matched++; }
}
console.log(`Advanced source matched safely: ${matched}/${data.playerStats.length}`);
await Promise.all([cacheChartAssets(data), enrichNews(data)]);
await writeFile(outputUrl, `${JSON.stringify(data)}\n`, "utf8");
console.log(`Generated ${data.meta.roundName}${next ? ` + ${next.meta.roundName}` : ""} at ${fileURLToPath(outputUrl)}`);
