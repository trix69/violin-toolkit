/* Violin Toolkit service worker. VERSION changes on every build, which makes phones fetch it.
   A new release is saved as soon as it is out, but the page shown stays the one the user is on until
   they choose Update (Settings version line, or the "new version" popup): the page writes that build
   stamp to META 'current'. So Later, or Settings > Automatic update check Off, keeps the old version. */
const VERSION = 'violin-toolkit-20261112-070617';
const PREFIX = 'violin-toolkit-', META = PREFIX + 'meta';
/* only this site's saved copies: production and test share trix69.github.io, so never touch the other's */
const MINE = k => /^violin-toolkit-\d{8}-\d{6}$/.test(k);
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    /* index.html is essential; the rest is best effort so one failure cannot block the install */
    await c.add(new Request('index.html', { cache: 'reload' }));
    await Promise.all(CORE.filter(u => u !== 'index.html').map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
/* the saved copy to show: the one chosen, else this release (first install, or a phone coming from
   1.20 or earlier, whose page never records a choice) */
async function chosen() {
  const m = await caches.open(META), r = await m.match('current');
  const cur = r ? PREFIX + (await r.text()) : null;
  if (cur && await caches.has(cur)) return cur;
  await m.put('current', new Response(VERSION.slice(PREFIX.length)));
  return VERSION;
}
self.addEventListener('activate', e => {
  e.waitUntil(chosen().then(keep => caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== keep && MINE(k)).map(k => caches.delete(k)))))
    .then(() => self.clients.claim()));
});
async function page() {
  for (const k of [await chosen(), VERSION]) {
    const c = await caches.open(k), hit = (await c.match('index.html')) || (await c.match('./'));
    if (hit) return hit;
  }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* the page asked for the network on purpose (version check, Update); don't answer from the saved copy */
  if (req.cache === 'no-store') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  /* only the app's own address opens the app; other pages on the site (docs/privacy.html) come from the network */
  const scope = new URL(self.registration.scope).pathname;
  if (req.mode === 'navigate' && url.origin === location.origin && url.pathname !== scope && url.pathname !== scope + 'index.html') return;
  if (req.mode === 'navigate') {
    /* always open from the chosen saved copy; the network only when nothing is saved yet */
    e.respondWith((async () => {
      const hit = await page();
      if (hit) return hit;
      const r = await fetch('index.html', { cache: 'no-cache' }).catch(() => null);
      if (r && r.ok) { (await caches.open(VERSION)).put('index.html', r.clone()); return r; }
      return new Response('Offline and not saved yet. Open this app once with internet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
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
