# Grand Prix standings

Published at `/fantasy-efl-dashboard/grand-prix-standing/` by the existing GitHub Pages workflow.
`scripts/build-grand-prix.mjs` copies an explicit list of runtime files into the Pages build.

All GW is the default and sums every available week, including fastest-lap awards.
Individual weeks are listed newest first and display their fastest-lap winner.
Both views export a complete 1080 × 1620 PNG poster.

The included data covers GW1–GW10. GW10 uses the current official scores, confirmed as final by the user on 2026-10-22; 61 matches completed, 60 officially finalized at capture time. Publishing the page does not refresh EFL league standings.

To append or refresh the latest week, collect official league 100 overall/weekly ladders and the 28 registered entrants’ lineups through the signed-in browser. Keep raw authenticated exports outside this repository. Save `official-members.json`, `players.json`, `rounds.json` and `live.json` together. Run `node scripts/update-grand-prix.mjs <directory>` for a dry run, then add `--write` to publish source files. Only use `--accept-current-as-final` when the user explicitly accepts the current scores as final. The importer checks each entrant’s selected players, effective captain multiplier and club totals against the official weekly score before writing. Existing GW1–GW9 scores and adjudications are preserved.
Run `node league-standings/verify.mjs` to check the confirmed rulings, totals and selector defaults.
