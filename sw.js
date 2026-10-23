/* Violin Toolkit service worker. VERSION changes on every build, which makes phones update. */
const VERSION = 'violin-toolkit-20261024-003457';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    /* index.html is essential; the rest is best effort so one failure cannot block the install */
    await c.add(new Request('index.html', { cache: 'reload' }));
    await Promise.all(CORE.filter(u => u !== 'index.html').map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k.indexOf('violin-toolkit-') === 0).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function page() {
  const c = await caches.open(VERSION);
  return (await c.match('index.html')) || (await caches.match('index.html')) || (await c.match('./'));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (req.mode === 'navigate') {
    /* always open from the saved copy, then refresh it in the background */
    e.respondWith((async () => {
      const hit = await page();
      const refresh = fetch('index.html', { cache: 'no-cache' }).then(async r => { if (r.ok) (await caches.open(VERSION)).put('index.html', r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(refresh); return hit; }
      return (await refresh) || new Response('Offline and not saved yet. Open this app once with internet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
