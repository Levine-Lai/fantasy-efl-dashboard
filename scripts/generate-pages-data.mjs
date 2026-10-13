import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
await writeFile(outputUrl, `${JSON.stringify(data)}\n`, "utf8");
console.log(`Generated ${data.meta.roundName}${next ? ` + ${next.meta.roundName}` : ""} at ${fileURLToPath(outputUrl)}`);
