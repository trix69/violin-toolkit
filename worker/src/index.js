/* Violin Toolkit version service.
 * GET /version.json?c=<client>&v=<version>&id=<installId>
 * Returns the site's own version.json unchanged ({version, build}), and records one data point per request:
 * index = "<day>:<client>" (UTC day), blobs = [version, install id, how it was answered, client]. Nothing else is stored:
 * no IP address, no user agent, no referrer, no cookies. If the dataset binding is missing or fails, the request
 * still succeeds. */
const ORIGIN = 'https://trix69.github.io/violin-toolkit/version.json';
const CLIENTS = ['web', 'pwa', 'apk', 'play', 'ios'];
const TTL = 60e3;
let memo = null;   // { body, at }: the last good version.json in this isolate

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

async function upstream() {
  if (memo && Date.now() - memo.at < TTL) return { body: memo.body, via: 'edge' };
  try {
    const r = await fetch(ORIGIN, { cf: { cacheTtl: 60, cacheEverything: true } });
    if (!r.ok) throw new Error('status ' + r.status);
    const body = await r.text();
    JSON.parse(body);   // only pass on what the page can read
    memo = { body, at: Date.now() };
    return { body, via: 'origin' };
  } catch (e) {
    return { body: null, via: 'fail' };
  }
}

function param(q, name, ok, max) {
  const v = (q.get(name) || '').slice(0, max);
  return ok(v) ? v : '';
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    if (req.method === 'GET' && url.pathname === '/stats') return stats(url, env);
    if (req.method !== 'GET' || url.pathname !== '/version.json') return new Response('Not found', { status: 404, headers });
    const q = url.searchParams;
    const client = param(q, 'c', (v) => CLIENTS.includes(v), 8);
    const version = param(q, 'v', (v) => /^[0-9.]{1,12}$/.test(v), 12);
    const id = param(q, 'id', (v) => /^[a-z0-9]{8,32}$/.test(v), 32);
    const got = await upstream();
    try {
      const day = new Date().toISOString().slice(0, 10);
      env.CHECKS && env.CHECKS.writeDataPoint({ indexes: [day + ':' + (client || 'unknown')], blobs: [version, id, got.via, client || 'unknown'], doubles: [1] });
    } catch (e) { /* the count is optional; the answer is not */ }
    if (!got.body) return new Response('{"error":"upstream"}', { status: 502, headers });
    return new Response(got.body, { status: 200, headers });
  },
};

/* ---- /stats?k=<STATS_KEY>: a private page of totals (Trix). Reads Analytics Engine through the SQL API with a
   read-only token kept as a Worker secret; shows counts only, never an install id. Wrong or missing key: 404. ---- */
const CLIENT_NAMES = { web: 'Browser', pwa: 'Installed web app', apk: 'Android (website)', play: 'Google Play', ios: 'iPhone', unknown: 'Unknown' };
const SHORT = { web: 'Web', pwa: 'PWA', apk: 'APK', play: 'Play', ios: 'iOS', unknown: '?' };
const COLOURS = { web: '#4C7EA8', pwa: '#3F8F7A', apk: '#C9873A', play: '#7B6BB5', ios: '#B5566B', unknown: '#8A8F8C' };

function same(a, b) {   // compare without an early exit
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sql(env, query) {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/analytics_engine/sql', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.CF_ANALYTICS_TOKEN }, body: query + ' FORMAT JSON' });
  const t = await r.text();
  if (!r.ok) throw new Error('SQL API ' + r.status + ': ' + t.slice(0, 200));
  return JSON.parse(t).data || [];
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (v) => Math.round(+v || 0);

async function stats(url, env) {
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!env.STATS_KEY || !same(url.searchParams.get('k') || '', env.STATS_KEY)) return notFound();
  let body;
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) body = '<p class="note">Not connected yet: the page needs a read-only Analytics token (stored as a Worker secret).</p>';
  else {
    try {
      const T = 'violin_toolkit_checks';
      const [daily, inst7, inst30, versions] = await Promise.all([
        sql(env, `SELECT index1 AS k, SUM(_sample_interval) AS checks, COUNT(DISTINCT blob2) AS installs FROM ${T} WHERE timestamp > NOW() - INTERVAL '90' DAY GROUP BY k ORDER BY k`),
        sql(env, `SELECT blob4 AS client, COUNT(DISTINCT blob2) AS installs, SUM(_sample_interval) AS checks FROM ${T} WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY client`),
        sql(env, `SELECT blob4 AS client, COUNT(DISTINCT blob2) AS installs, SUM(_sample_interval) AS checks FROM ${T} WHERE timestamp > NOW() - INTERVAL '30' DAY GROUP BY client`),
        sql(env, `SELECT blob1 AS version, COUNT(DISTINCT blob2) AS installs FROM ${T} WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY version ORDER BY installs DESC`),
      ]);
      body = render(daily, inst7, inst30, versions);
    } catch (e) {
      body = '<p class="note">Could not read the counts: ' + esc(e.message) + '</p>';
    }
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Violin Toolkit stats</title><style>
:root { --bg: #EDEFEC; --fg: #1B2420; --muted: #5E6A64; --panel: #F7F8F6; --line: #D5DAD6; }
@media (prefers-color-scheme: dark) { :root { --bg: #121815; --fg: #E6EBE7; --muted: #9AA59F; --panel: #1B2420; --line: #2E3833; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 20px 16px 40px; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 26px 0 10px; } .sub, .note { color: var(--muted); font-size: 13px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
.card b { display: block; font-size: 26px; } .card span { color: var(--muted); font-size: 13px; }
.chart { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; overflow-x: auto; }
.wrap { overflow-x: auto; border-radius: 12px; }
table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-size: 14px; }
th, td { text-align: right; padding: 7px 10px; border-bottom: 1px solid var(--line); } th:first-child, td:first-child { text-align: left; }
th { color: var(--muted); font-weight: 600; } td:first-child { white-space: nowrap; }
@media (max-width: 360px) { th, td { padding: 6px 6px; } } .key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--muted); margin-top: 8px; }
</style></head><body><main><h1>Violin Toolkit stats</h1><p class="sub">Automatic update checks: one per launch while online. Updated ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC.</p>${body}
<h2>What these numbers miss</h2><p class="note">Launches while offline make no check, so launches are undercounted. A plain browser visit without the offline copy does not check, so first visits are invisible. The test site is not counted. Clearing site data gives a device a new install id. "Check for updates" taps are counted too.</p></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

function render(daily, inst7, inst30, versions) {
  const order = ['web', 'pwa', 'apk', 'play', 'ios', 'unknown'];
  const days = {}, clients = new Set();
  daily.forEach((r) => { const [day, c] = String(r.k).split(':'); (days[day] = days[day] || {})[c] = { checks: n(r.checks), installs: n(r.installs) }; clients.add(c); });
  const dayList = Object.keys(days).sort().slice(-30);
  const cs = order.filter((c) => clients.has(c));
  const sum = (rows, f) => rows.reduce((t, r) => t + n(r[f]), 0);
  const today = dayList.length ? dayList[dayList.length - 1] : '';
  const todayInst = today ? Object.values(days[today]).reduce((t, v) => t + v.installs, 0) : 0;
  const cards = `<div class="cards"><div class="card"><b>${todayInst}</b><span>installs checking today (${esc(today || '–')})</span></div><div class="card"><b>${sum(inst7, 'installs')}</b><span>installs in the last 7 days</span></div><div class="card"><b>${sum(inst30, 'installs')}</b><span>installs in the last 30 days</span></div><div class="card"><b>${sum(inst30, 'checks')}</b><span>launch checks in the last 30 days</span></div></div>`;
  // stacked bars: installs per day by client, last 30 days
  const W = Math.max(320, dayList.length * 22), H = 160, max = Math.max(1, ...dayList.map((d) => cs.reduce((t, c) => t + ((days[d][c] || {}).installs || 0), 0)));
  let bars = '';
  dayList.forEach((d, i) => {
    let y = H - 18;
    cs.forEach((c) => { const v = (days[d][c] || {}).installs || 0; if (!v) return; const h = v / max * (H - 30); y -= h; bars += `<rect x="${i * 22 + 4}" y="${y.toFixed(1)}" width="16" height="${h.toFixed(1)}" fill="${COLOURS[c]}"><title>${esc(d)} ${esc(CLIENT_NAMES[c])}: ${v}</title></rect>`; });
    if (i % 5 === 0 || i === dayList.length - 1) bars += `<text x="${i * 22 + 12}" y="${H - 4}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">${esc(d.slice(5))}</text>`;
  });
  const legend = '<div class="legend">' + cs.map((c) => `<span><i class="key" style="background:${COLOURS[c]}"></i>${esc(CLIENT_NAMES[c])}</span>`).join('') + '</div>';
  const chart = dayList.length ? `<h2>Installs checking per day (last 30 days)</h2><div class="chart"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Installs per day by app type">${bars}</svg>${legend}</div>` : '<p class="note">No checks recorded yet.</p>';
  const by = (rows) => { const m = {}; rows.forEach((r) => { m[r.client] = r; }); return m; };
  const m7 = by(inst7), m30 = by(inst30);
  const table = `<h2>By app type</h2><table><tr><th>App</th><th>Installs 7 d</th><th>Installs 30 d</th><th>Checks 30 d</th></tr>` +
    order.filter((c) => m7[c] || m30[c]).map((c) => `<tr><td><i class="key" style="background:${COLOURS[c]}"></i>${esc(CLIENT_NAMES[c])}</td><td>${n((m7[c] || {}).installs)}</td><td>${n((m30[c] || {}).installs)}</td><td>${n((m30[c] || {}).checks)}</td></tr>`).join('') + '</table>';
  const vers = versions.length ? `<h2>Versions in use (last 7 days)</h2><table><tr><th>Version</th><th>Installs</th></tr>` + versions.map((r) => `<tr><td>${esc(r.version || '?')}</td><td>${n(r.installs)}</td></tr>`).join('') + '</table>' : '';
  const recent = dayList.slice(-14).reverse();
  const daysT = `<h2>Daily (last 14 days)</h2><div class="wrap"><table><tr><th>Day</th>` + cs.map((c) => `<th>${esc(SHORT[c])}</th>`).join('') + `<th>Total</th></tr>` +
    recent.map((d) => `<tr><td>${esc(d.slice(5))}</td>` + cs.map((c) => `<td>${(days[d][c] || {}).installs || 0}</td>`).join('') + `<td>${cs.reduce((t, c) => t + ((days[d][c] || {}).installs || 0), 0)}</td></tr>`).join('') + '</table></div><p class="note">Installs = different devices that checked that day. Web = browser, PWA = installed web app, APK = Android app from the website, Play = Google Play, iOS = iPhone app.</p>';
  return cards + chart + table + daysT + vers;
}
