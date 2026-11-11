# Violin Toolkit version service

A Cloudflare Worker at `https://violin-toolkit-version.trix69.workers.dev` that the app's automatic update check
calls instead of GitHub Pages, so launches can be counted (GitHub Pages keeps no access log).

`GET /version.json?c=<client>&v=<version>&id=<installId>` answers with the site's own
`https://trix69.github.io/violin-toolkit/version.json`, unchanged (cached 60 s), with
`Access-Control-Allow-Origin: *` and `Cache-Control: no-store`; 502 if the site cannot be reached (the app then
asks the site directly). Any other path: 404.

One Analytics Engine data point per request (dataset `violin_toolkit_checks`):
- index1: `<YYYY-MM-DD UTC>:<client>`, client one of web, pwa, apk, play, ios (else `unknown`)
- blob1: app version (`/^[0-9.]+$/`, else empty), blob2: install id (8-32 of `[a-z0-9]`, else empty),
  blob3: how the answer was made: `origin` (fetched from the site), `edge` (60 s cache), `fail` (site unreachable)
- double1: 1

No IP address, user agent, referrer or cookie is read or stored. If the binding is missing or fails, the request
still succeeds.

Deploy (headless, token from `~/projects/cloudflare.env`, never printed): `worker/deploy.sh`.
Analytics Engine must be enabled once for the account in the Cloudflare dashboard (Workers & Pages → Analytics
Engine); until then deploy with `WRANGLER_CONFIG=wrangler.nobinding.toml worker/deploy.sh` (the same Worker,
nothing recorded).

What the numbers cannot see: launches while offline (no request), plain-browser visits without a service worker
(no automatic check, so first visits are invisible), the iPhone app until it has an App Store listing (it checks
only when "Check for updates" is tapped), and the test site (it asks its own version.json). Clearing site data
makes a new install id. "Check for updates" taps are counted too.
