import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../lib/dashboard-data.ts", import.meta.url), "utf8"))
  .replace('import { env } from "cloudflare:workers";', "const env = { DB: null };");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { selectRecommendationRounds } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const rounds = [
  { id: 9, status: "playing", lockoutDate: "2026-10-10T03:00:00+08:00", games: [{ status: "completed" }, { status: "scheduled" }] },
  { id: 10, status: "scheduled", lockoutDate: "2026-10-16T03:00:00+08:00", games: [{ status: "scheduled" }] },
  { id: 11, status: "scheduled", lockoutDate: "2026-10-24T03:00:00+08:00", games: [{ status: "scheduled" }] },
];
const choose = (time) => selectRecommendationRounds(rounds, Date.parse(time));
assert.equal(choose("2026-10-10T02:59:59+08:00").primary.id, 9);
assert.equal(choose("2026-10-10T03:00:00+08:00").primary.id, 10);
assert.equal(choose("2026-10-10T03:00:00+08:00").upcoming.id, 11);
assert.equal(choose("2026-10-15T12:00:00+08:00").primary.id, 10);
assert.equal(choose("2026-10-16T03:00:00+08:00").primary.id, 11);
console.log("Round lockout transitions passed");
