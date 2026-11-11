/* Violin Toolkit version service.
 * GET /version.json?c=<client>&v=<version>&id=<installId>
 * Returns the site's own version.json unchanged ({version, build}), and records one data point per request:
 * index = "<day>:<client>" (UTC day), blobs = [version, install id, how it was answered]. Nothing else is stored:
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
    if (req.method !== 'GET' || url.pathname !== '/version.json') return new Response('Not found', { status: 404, headers });
    const q = url.searchParams;
    const client = param(q, 'c', (v) => CLIENTS.includes(v), 8);
    const version = param(q, 'v', (v) => /^[0-9.]{1,12}$/.test(v), 12);
    const id = param(q, 'id', (v) => /^[a-z0-9]{8,32}$/.test(v), 32);
    const got = await upstream();
    try {
      const day = new Date().toISOString().slice(0, 10);
      env.CHECKS && env.CHECKS.writeDataPoint({ indexes: [day + ':' + (client || 'unknown')], blobs: [version, id, got.via], doubles: [1] });
    } catch (e) { /* the count is optional; the answer is not */ }
    if (!got.body) return new Response('{"error":"upstream"}', { status: 502, headers });
    return new Response(got.body, { status: 200, headers });
  },
};
