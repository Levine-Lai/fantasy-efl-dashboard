# Grand Prix standings

Published at `/fantasy-efl-dashboard/grand-prix-standing/` by the existing GitHub Pages workflow.
`scripts/build-grand-prix.mjs` copies an explicit list of runtime files into the Pages build.

All GW is the default and sums every available week, including fastest-lap awards.
Individual weeks are listed newest first and display their fastest-lap winner.
Both views export a complete 1080 × 1620 PNG poster.

The included data is the saved GW1–GW9 snapshot. Publishing the page does not refresh EFL data.
Run `node league-standings/verify.mjs` to check the confirmed rulings, totals and selector defaults.
