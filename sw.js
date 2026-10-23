/* Violin Toolkit service worker. Change VERSION to force an update. */
const VERSION = 'violin-toolkit-20261023-132133';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k.indexOf('violin-toolkit-') === 0).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (req.mode === 'navigate') {
    /* open instantly from cache, refresh the cache in the background */
    e.respondWith(caches.open(VERSION).then(c => c.match('index.html').then(hit => {
      const net = fetch('index.html', { cache: 'no-cache' }).then(r => { if (r.ok) c.put('index.html', r.clone()); return r; }).catch(() => null);
      return hit || net.then(r => r || new Response('Offline', { status: 503 }));
    })));
    return;
  }
  e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
