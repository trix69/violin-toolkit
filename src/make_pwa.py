import re, json, time, shutil, os, sys
import version
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'   # the repo root is what GitHub Pages serves
src = open(ROOT + 'dist/violin-toolkit.html', encoding='utf-8').read()
ver = time.strftime('%Y%m%d-%H%M%S')
# --test: build the test site (trix69.github.io/violin-toolkit-test/) into dist/test-site/ instead of the repo root.
# Both sites share the trix69.github.io origin, so each keeps its own cache names (PREFIX) and only ever touches those.
TEST = '--test' in sys.argv
OUT = ROOT + 'dist/test-site/' if TEST else ROOT
PREFIX = 'violin-toolkit-test-' if TEST else 'violin-toolkit-'
NAME = 'Violin Toolkit (Test)' if TEST else 'Violin Toolkit'
app_version = version.bumped(version.current()) if TEST else version.current()
shown = app_version + ('-test' if TEST else '')
head_add = '''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#2f7679">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="%(name)s">
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
head_add = head_add.replace('%(name)s', NAME)
if TEST:
    head_add += '''<meta name="robots" content="noindex">
<style>.test-ribbon { position: fixed; z-index: 300; top: 0; left: 50%; transform: translateX(-50%); padding: 2px 10px; border-radius: 0 0 8px 8px; background: #c2410c; color: #fff; font: 700 11px/1.4 ui-monospace, monospace; letter-spacing: .1em; pointer-events: none; }</style>
'''
    src = src.replace('<title>Violin Toolkit</title>', '<title>Violin Toolkit (Test)</title>', 1)
    # The two sites share trix69.github.io, so they share localStorage. Settings should follow the
    # user between them; once-only records must not, or trying them on the test site uses them up
    # on the live one. Rename those in the test page, in any quote style, and fail the build if
    # one is missed. (SystemExit, not assert, so python -O can't skip the checks.)
    for k in ('violin-tips-seen', 'violin-first-visit'):
        pat = re.compile(r"""(['"`])%s\1""" % re.escape(k))
        if not pat.search(src):
            raise SystemExit('test build: key %s is no longer in the page' % k)
        src = pat.sub(lambda m: m.group(1) + k + '-test' + m.group(1), src)
        if pat.search(src):
            raise SystemExit('test build: %s still used under the live name' % k)
    # Every other quoted violin-* / vt-* key must be one that is meant to be shared. A new key fails
    # the build here until it is added to SHARED (a setting) or to the rename list above (once-only).
    # Any case, - or _; a bare 'violin-' fragment means a key built by concatenation, also flagged.
    SHARED = {'violin-lang', 'violin-theme', 'violin-names', 'violin-a4', 'violin-temper', 'violin-metronome-v2', 'violin-flash',
              'violin-fingerboard-v2', 'vt-mode',
              'vt-a4-v2',                                  # tuner.html's old A4 select, cut out by build.py
              'violin-toolkit-', 'violin-toolkit-test-'}   # cache-name prefixes (data-cache), not keys
    keylike = re.compile(r"""(['"`])((?:violin|vt)[_-][A-Za-z0-9_-]+)\1""", re.I)
    frag = re.compile(r"""(['"`])((?:violin|vt)[_-])\1""", re.I)
    found = {m[1] for m in keylike.findall(src)}
    unknown = sorted(k for k in found if k not in SHARED and not k.endswith('-test'))
    unknown += sorted({m[1] for m in frag.findall(src)})
    if unknown:
        raise SystemExit('test build: decide whether these keys are shared settings or once-only: %s' % ', '.join(unknown))
    # a prefix put together at runtime: `violin-${x}`, or 'violin' + '-x'
    tpl = re.compile(r"""(?:violin|vt)[_-]\$\{""", re.I)
    cat = re.compile(r"""(['"`])(?:violin|vt)\1\s*\+\s*(['"`])[_-]""", re.I)
    if tpl.search(src) or cat.search(src):
        raise SystemExit('test build: key prefix assembled at runtime, cannot be checked')
    # i18n.js sets the title when the language changes; keep the test marker there too
    src = src.replace("document.title = lang === 'zh' ? '小提琴工具箱' : 'Violin Toolkit';",
                      "document.title = (lang === 'zh' ? '小提琴工具箱' : 'Violin Toolkit') + ' (Test)';", 1)
    src = src.replace('<body>', '<body><div class="test-ribbon" aria-hidden="true">TEST</div>', 1) if '<body>' in src else re.sub(r'(<body[^>]*>)', r'\1<div class="test-ribbon" aria-hidden="true">TEST</div>', src, 1)
# the Settings version button: which build this is and which saved copies belong to this site
src, n = re.subn(r'data-version="[^"]*"><span>Version [^<]*</span>',
                 'data-version="%s" data-build="%s" data-cache="%s"><span>Version %s</span>' % (app_version, ver, PREFIX, shown), src)
assert n == 1
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
os.makedirs(OUT + 'screenshots', exist_ok=True)
for f in ('fingerboard.png', 'tuner.png', 'metronome.png'):
    if os.path.exists(SRC + 'screenshots/' + f):
        shutil.copy(SRC + 'screenshots/' + f, OUT + 'screenshots/' + f)
for f in ('icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png'):
    shutil.copy(SRC + 'icons/' + f, OUT + f)
open(OUT + 'index.html', 'w', encoding='utf-8').write(out)
# read by the Settings version button to see whether a newer release is online
json.dump({'version': app_version, 'build': ver}, open(OUT + 'version.json', 'w'))
json.dump({
  "name": NAME, "short_name": "VT Test" if TEST else "Violin Toolkit", "description": "Violin tuner, fingerboard chart and metronome.",
  "id": "/violin-toolkit-test/" if TEST else "/violin-toolkit/", "lang": "en", "dir": "ltr", "categories": ["music", "education", "utilities"],
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
  ]}, open(OUT + 'manifest.webmanifest', 'w'), indent=2)
open(OUT + 'sw.js', 'w').write('''/* Violin Toolkit service worker. VERSION changes on every build, which makes phones update. */
const VERSION = '%(prefix)s%(ver)s';
/* only this site's saved copies: production and test share trix69.github.io, so never touch the other's */
const MINE = k => /^%(prefix)s\\d{8}-\\d{6}$/.test(k);
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    /* index.html is essential; the rest is best effort so one failure cannot block the install */
    await c.add(new Request('index.html', { cache: 'reload' }));
    await Promise.all(CORE.filter(u => u !== 'index.html').map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && MINE(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function page() {
  const c = await caches.open(VERSION);
  const hit = (await c.match('index.html')) || (await c.match('./'));
  if (hit) return hit;
  for (const k of (await caches.keys()).filter(MINE)) { const r = await (await caches.open(k)).match('index.html'); if (r) return r; }
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
''' % {'prefix': PREFIX, 'ver': ver})
print('built', ver, len(out))
