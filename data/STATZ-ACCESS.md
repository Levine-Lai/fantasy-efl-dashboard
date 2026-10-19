# Statz access diagnosis — 2026-10-19

GitHub Actions run 39196480299, build job 117880256345 returned HTTP 403 for all nine public Statz pages. Responses included `server: cloudflare`, `cf-mitigated: challenge`, and title `Just a moment...` (example Ray ID `a4ccd0619bc0e038-GRU`). The same public URLs returned HTTP 200 from the local environment.

This identifies a Cloudflare verification requirement on the cloud requests. The exact site rule (IP reputation, region, bot policy, etc.) cannot be determined from this response alone. There is no evidence that the URLs or season parsers are broken.

A lasting cloud fix requires Statz to provide an approved data API or allow automated requests from the execution environment. Do not automate challenges, copy clearance cookies, impersonate allowed crawlers, or use proxy rotation. Provide the run time and Ray ID to Statz if requesting access.

The client serializes public requests, stops a batch after a challenge/rate limit, and records the actual access outcome separately from snapshot capture time. Fresh official/FotMob updates remain publishable; retained Statz data is visibly labeled.
