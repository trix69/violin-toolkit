import re, json, time, shutil, os
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'   # the repo root is what GitHub Pages serves
src = open(ROOT + 'dist/violin-toolkit.html', encoding='utf-8').read()
ver = time.strftime('%Y%m%d-%H%M%S')
head_add = '''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#2f7679">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Violin Toolkit">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="description" content="Free violin tuner, fingerboard chart and metronome. Works offline, in English and 中文.">
<meta property="og:type" content="website">
<meta property="og:title" content="Violin Toolkit">
<meta property="og:description" content="Free violin tuner, fingerboard chart and metronome. Works offline, in English and 中文.">
<meta property="og:url" content="https://trix69.github.io/violin-toolkit/">
<meta property="og:image" content="https://trix69.github.io/violin-toolkit/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Violin Toolkit">
<meta name="twitter:description" content="Free violin tuner, fingerboard chart and metronome. Works offline, in English and 中文.">
<meta name="twitter:image" content="https://trix69.github.io/violin-toolkit/og-image.png">
<script type="application/ld+json">
{"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Violin Toolkit",
 "description": "Free violin tuner, fingerboard chart and metronome. Works offline, in English and Chinese.",
 "url": "https://trix69.github.io/violin-toolkit/", "applicationCategory": "MusicApplication", "operatingSystem": "Any",
 "inLanguage": ["en", "zh-CN"], "isAccessibleForFree": true,
 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
 "image": "https://trix69.github.io/violin-toolkit/og-image.png",
 "screenshot": ["https://trix69.github.io/violin-toolkit/screenshots/fingerboard.png", "https://trix69.github.io/violin-toolkit/screenshots/tuner.png", "https://trix69.github.io/violin-toolkit/screenshots/metronome.png"]}
</script>
'''
# drop the old data-URI apple-touch-icon so the real file is used
src = re.sub(r'<link rel="apple-touch-icon"[^>]*>', '', src)
assert src.count('</head>') == 1 and src.count('</body>') == 1
reg = '''<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
'''
out = src.replace('</head>', head_add + '</head>').replace('</body>', reg + '</body>')
os.makedirs(ROOT + 'screenshots', exist_ok=True)
for f in ('fingerboard.png', 'tuner.png', 'metronome.png'):
    if os.path.exists(SRC + 'screenshots/' + f):
        shutil.copy(SRC + 'screenshots/' + f, ROOT + 'screenshots/' + f)
for f in ('icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png'):
    shutil.copy(SRC + 'icons/' + f, ROOT + f)
open(ROOT + 'index.html', 'w', encoding='utf-8').write(out)
# read by the Settings version button to see whether a newer release is online
json.dump({'version': open(SRC + 'VERSION').read().strip()}, open(ROOT + 'version.json', 'w'))
json.dump({
  "name": "Violin Toolkit", "short_name": "Violin Toolkit", "description": "Violin tuner, fingerboard chart and metronome.",
  "id": "/violin-toolkit/", "lang": "en", "dir": "ltr", "categories": ["music", "education", "utilities"],
  "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
  "background_color": "#16201b", "theme_color": "#2f7679",
  "icons": [
    {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ],
  "screenshots": [
    {"src": "screenshots/fingerboard.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Fingerboard: press and hold any note"},
    {"src": "screenshots/tuner.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Tuner for G, D, A and E"},
    {"src": "screenshots/metronome.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Metronome with tap tempo"}
  ]}, open(ROOT + 'manifest.webmanifest', 'w'), indent=2)
open(ROOT + 'sw.js', 'w').write('''/* Violin Toolkit service worker. VERSION changes on every build, which makes phones update. */
const VERSION = 'violin-toolkit-%s';
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
  /* the page asked for the network on purpose (Settings > version check); don't answer from the saved copy */
  if (req.cache === 'no-store') return;
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
''' % ver)
print('built', ver, len(out))
