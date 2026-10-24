"""Regenerate the store/install screenshots (1080x1920) from dist/violin-toolkit.html.
Needs Playwright with Chromium. Output goes to src/screenshots/ and is copied to the repo root by make_pwa.py."""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, has_touch=True, is_mobile=True)
    # store screenshots show the app itself, not the first-use tips
    ctx.add_init_script("try { localStorage.setItem('violin-tips-seen', '[\"*\"]'); } catch (e) {}")
    for name in ('fingerboard', 'tuner', 'metronome'):
        pg = ctx.new_page()
        pg.goto('file://' + ROOT + 'dist/violin-toolkit.html#' + name + ',en')
        pg.wait_for_timeout(800)
        # the file has no microphone, so show the normal hint instead of the "not enabled" message
        pg.evaluate("""() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) if (/^\\s*Microphone was not enabled/.test(n.nodeValue)) n.nodeValue = 'Press Start tuning, then bow an open string and hold it.'; }""")
        pg.wait_for_timeout(200)
        pg.screenshot(path=ROOT + 'src/screenshots/' + name + '.png')
        pg.close()
    b.close()
