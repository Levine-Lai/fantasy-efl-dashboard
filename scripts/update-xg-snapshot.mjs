import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputUrl = new URL("../data/xg-snapshot.json", import.meta.url);
const now = new Date();
const start = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
const season = `${start}/${start + 1}`;
const divisions = [[10, "championship"], [11, "league-one"], [12, "league-two"]];

try {
  const results = await Promise.all(divisions.map(async ([competitionId, slug]) => {
    const response = await fetch(`https://statz.ai/competitions/${slug}/xg/players`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Fantasy-EFL-Data-Board/1.0)", accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
    const html = await response.text();
    const encoded = html.match(/data-page="([^"]+)"/)?.[1];
    if (!encoded) throw new Error(`${slug}: embedded player data not found`);
    const page = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#039;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
    const rows = page.props?.players;
    if (page.props?.seasonLabel !== season || !Array.isArray(rows) || rows.length < 100) throw new Error(`${slug}: unexpected season or incomplete list`);
    return rows.map((row) => ({
      competitionId,
      player_name: row.player_name,
      team_name: row.team_name,
      apps: row.apps,
      xg: row.xg,
      minutes: row.minutes,
    }));
  }));
  const snapshot = { season, capturedAt: now.toISOString(), players: results.flat() };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputUrl, `${JSON.stringify(snapshot)}\n`, "utf8");
  console.log(`Updated xG snapshot: ${snapshot.players.length} players for ${season}`);
} catch (error) {
  const prior = await readFile(outputUrl, "utf8").then(JSON.parse).catch(() => null);
  if (!prior || prior.season !== season || prior.players?.length < 1000) throw error;
  console.warn(`Could not refresh xG; using snapshot from ${prior.capturedAt}: ${error.message}`);
}
