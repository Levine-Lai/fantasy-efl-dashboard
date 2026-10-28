# Grand Prix standings

Published at `/fantasy-efl-dashboard/grand-prix-standing/` by the existing GitHub Pages workflow.
`scripts/build-grand-prix.mjs` copies an explicit list of runtime files into the Pages build.

All GW is the default and sums every available week, including fastest-lap awards.
Individual weeks are listed newest first and display their fastest-lap winner.
Both views export a complete 1080 × 1620 PNG poster.

The included data covers GW1–GW11. GW11 was captured on 2026-10-28 at 10:55 Asia/Shanghai: all 42 matches completed, 36 officially finalized. It is provisional and must retain that status until official finalization or explicit user acceptance. GW10 retains its previously user-confirmed scores. Publishing the page does not refresh EFL league standings.

Grand Prix uses league **365, 2026_27 grand prix**, with 28 drivers. The separate differential captain award (慧眼识珠) uses league **100, Welcome to New Track**, with 31 entrants. Never mix their entrant sets or use league 100 to assign Grand Prix ranks.

To append or refresh the latest week, collect league 365 overall/weekly ladders and the 28 registered entrants’ lineups through the signed-in browser. Opening JSON API URLs as browser pages reuses the session without exporting cookies. The overall URL is `https://fantasy.efl.com/api/en/season/ranking/overall_ladder?leagueId=365&limit=100&page=1`. Per-driver lineups use `/api/en/season/other-user-team/{userId}/{week}`. Weekly ranks can be captured from the visible league table after selecting the gameweek and loading all rows. Fetch `players.json`, `squads.json`, `rounds.json` and `live_scores/{week}.json` from the public `/json/fantasy/` base.

Keep authenticated responses in unpublished local storage; do not commit raw exports. Save `official-members.json`, `players.json`, `rounds.json` and `live.json` together. `official-members.json` contains `week`, `leagueId`, `capturedAt`, `weekly: {rankings, nextPage}`, `overall` rankings and `teams: [{driverId,userId,team}]`. Run `node scripts/update-grand-prix.mjs <directory>` for a dry run, then add `--write` to update source files. Only use `--accept-current-as-final` when the user explicitly accepts the current scores as final. The importer checks each entrant’s selected players, effective captain multiplier and club totals against the official weekly score before writing. Existing historical scores and adjudications are preserved.

For 慧眼识珠, separately fetch league 100 and the extra entrants’ lineups. Reconcile all 31 totals. Follow the prior article’s effective captain treatment, including Max Captain and vice-captain fallback; require base points >10 and ownership <5%. Ownership from `players.json` is the capture-time snapshot, not historical lockout ownership, and must be labeled accordingly.
Run `node league-standings/verify.mjs` to check the confirmed rulings, totals and selector defaults.
