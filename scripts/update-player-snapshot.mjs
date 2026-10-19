import {statzRequest} from "./statz-request.mjs";
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../data/player-advanced.json', import.meta.url);
const now = new Date();
const start = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
const season = `${start}/${start + 1}`;
try {
  const results = await Promise.all([[10,'championship'],[11,'league-one'],[12,'league-two']].map(async ([competitionId,slug]) => {
    const response = await statzRequest(`https://statz.ai/competitions/${slug}/stats/players?group=attacking`, {timeoutMs:20000}, 'advanced');
    if (!response.ok) throw new Error(`${slug}: ${response.status}`);
    const html = await response.text();
    const encoded = html.match(/data-page="([^"]+)"/)?.[1];
    if (!encoded || !html.includes(season)) throw new Error(`${slug}: season or page missing`);
    const props = JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#039;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')).props;
    if (props.hero?.season !== season) throw new Error(`${slug}: wrong season`);
    if (!Array.isArray(props.playerRows) || props.playerRows.length < 100) throw new Error(`${slug}: incomplete data`);
    return props.playerRows.map(row => Object.fromEntries(Object.entries({competitionId, name:row.name, team:row.team_full, apps:row.apps, mins:row.mins, tkl:row.tkl, int:row.int, aer:row.aer, due:row.due, duw:row.duw, pas:row.pas, apas:row.apas, drp:row.drp, cc:row.cc, sdrb:row.sdrb, sh:row.sh, crs:row.crs, pentaken:row.pentaken, pen:row.pen}).map(([key,value])=>[key,value ?? null])));
  }));
  const data = {season,capturedAt:now.toISOString(),players:results.flat()};
  await writeFile(file, JSON.stringify(data)+'\n');
  console.log(`Advanced player snapshot: ${data.players.length} players`);
} catch(error) {
  const prior = await readFile(file,'utf8').then(JSON.parse).catch(()=>null);
  if (!prior || prior.season !== season || prior.players.length < 1000) throw error;
  console.warn(`Advanced data retained from ${prior.capturedAt}: ${error.message}`);
}
