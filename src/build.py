import re, sys

import os
SP = os.path.dirname(os.path.abspath(__file__)) + '/'   # sources live next to this file
DIST = os.path.join(os.path.dirname(SP.rstrip('/')), 'dist') + '/'   # build output (not committed)
os.makedirs(DIST, exist_ok=True)
board = open(SP + 'board.html', encoding='utf-8').read()
tuner = open(SP + 'tuner.html', encoding='utf-8').read()


def must(s, x, y, count=1):
    assert s.count(x) == count, (x, s.count(x))
    return s.replace(x, y)


# ---------------------------------------------------------------- CSS prefixer
def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def split_top(s, sep=','):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    out.append(cur)
    return out


def prefix_css(css, prefix, keep=('*', 'html', 'body')):
    css = strip_comments(css)
    out = []
    i = 0
    n = len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while depth and k < n:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if head.startswith('@media'):
            out.append(head + ' {\n' + prefix_css(body, prefix, keep) + '}\n')
        elif head.startswith('@keyframes'):
            out.append(head + ' {' + body + '}\n')
        else:
            sels = []
            for sel in split_top(head):
                sel = sel.strip()
                if sel in keep:
                    sels.append(sel)
                else:
                    sels.append(prefix + ' ' + sel)
            out.append(',\n'.join(sels) + ' {' + body + '}\n')
        i = k
    return ''.join(out)


def remove_rule(css, selector):
    pat = re.compile(r'(?m)^' + re.escape(selector) + r' \{.*?\n\}\n?', re.S)
    m = pat.search(css)
    assert m, selector
    return css[:m.start()] + css[m.end():], m.group(0)


def remove_inline_rule(css, line):
    assert css.count(line) == 1, line
    return css.replace(line + '\n', '', 1)


# ---------------------------------------------------------------- board parts
b_css = board[board.index('<style>') + 7:board.index('</style>')]
b_tokens, b_rest = b_css.split('\n* { box-sizing: border-box; }', 1)
b_rest = '* { box-sizing: border-box; }' + b_rest

b_tokens = re.sub(r"--font-display:[^;]*;", "--font-display: 'Outfit', 'DM Sans', system-ui, sans-serif;", b_tokens)
b_tokens = re.sub(r"--font-note:[^;]*;", "--font-note: 'Outfit', 'DM Sans', system-ui, sans-serif;\n  --font-body: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;", b_tokens)
assert '--font-body' in b_tokens

# global bits that stay unprefixed (page chrome + header)
b_rest, body_rule = remove_rule(b_rest, 'body')
b_rest, h1_rule = remove_rule(b_rest, 'h1')
b_rest, sub_rule = remove_rule(b_rest, '.sub')
sub_rule = sub_rule.replace('.sub {', '.appsub {')
body_rule = body_rule.replace('var(--font-note)', 'var(--font-body)')
b_rest = re.sub(r'(?m)^\* \{ box-sizing: border-box; \}\n?', '', b_rest)

# fonts: controls use the body face, note names and key letters use Outfit
b_rest = b_rest.replace('font: 500 15px var(--font-note);', 'font: 500 15px var(--font-body);')
board_css = prefix_css(b_rest, '#view-board')

# ---------------------------------------------------------------- tuner CSS
t_css = tuner[tuner.index('<style>') + 7:tuner.index('</style>')]
t_tokens, t_rest = t_css.split('\n* { box-sizing: border-box; }', 1)
t_rest = '* { box-sizing: border-box; }' + t_rest
t_tokens = strip_comments(t_tokens)
rename = lambda s: re.sub(r'(?<![\w-])--([a-z][a-z0-9-]*)', r'--t-\1', s)
t_tokens = rename(t_tokens)
t_rest = rename(t_rest)
for nm, val in [('s-g', '#E3A24C'), ('s-d', '#74C493'), ('s-a', '#66AEE6'), ('s-e', '#C592E6'), ('on-sc', '#15110F')]:
    t_tokens, n = re.subn(r'(--t-' + nm + r': )#[0-9A-Fa-f]{6};', r'\g<1>' + val + ';', t_tokens)
    assert n == 3, (nm, n)
# audio-file upload is removed (keep .vh: the tuner's screen-reader-only #hintSr needs it, Hermes F6)
t_rest = re.sub(r'(?m)^\.(upload p|filebtn) \{[^\n]*\}\n', '', t_rest)
t_rest = t_rest.replace(', .filebtn:focus-within', '')
t_rest = re.sub(r'(?m)^\* \{ box-sizing: border-box; \}\n', '', t_rest)
t_rest = remove_inline_rule(t_rest, 'html { color-scheme: light; }')
t_rest = remove_inline_rule(t_rest, '[hidden] { display: none !important; }')
t_rest, _ = remove_rule(t_rest, 'body')
t_rest = remove_inline_rule(t_rest, 'header h1 { font: 600 clamp(32px, 6.5vw, 42px)/1.05 var(--t-sans-display); margin: 0; letter-spacing: -0.02em; }')
t_rest = re.sub(r'(?m)^\.eyebrow \{[^\n]*\}\n', '', t_rest)
tuner_css = prefix_css(t_rest, '#view-tuner')
assert '#view-tuner .vh {' in tuner_css, 'the tuner lost its visually-hidden utility (#hintSr would show on screen)'

# ---------------------------------------------------------------- chrome CSS
chrome_css = '''
/* ---- shared chrome ---- */
''' + body_rule + '''
body[data-view="tuner"] { background: var(--t-bg); color: var(--t-fg); }
.shell { max-width: 720px; margin: 0 auto; }
.skip { position: absolute; left: 12px; top: -60px; z-index: 200; padding: 10px 14px; border-radius: 10px; background: var(--accent); color: var(--on-accent); font: 600 15px var(--font-note); text-decoration: none; }
.skip:focus { top: 12px; }
#main:focus { outline: none; }
.appbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 10px;
}
.appbar > div { min-width: 0; }
''' + h1_rule + sub_rule + '''
.tabs { display: flex; gap: 6px; flex: none; }
.tab {
  width: 44px; height: 44px; padding: 0;
  display: grid; place-items: center;
  border: 1px solid var(--line); border-radius: 10px;
  background: var(--panel); color: var(--fg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tab svg {
  width: 24px; height: 24px;
  fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round;
}
.tab[aria-current="page"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.shell[data-view="tuner"] .tab[aria-current="page"] { background: var(--t-fg); color: var(--t-bg); border-color: var(--t-fg); }
.tab:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.shell, .shell * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
#view-tuner { padding-bottom: 16px; font: 400 16px/1.5 var(--t-body); }
/* A4 value: same face and size as the fingerboard's "Auto vibrato" label (.lbl), but Hz keeps its case */
#view-board .a4v { font: 500 13px/1 var(--font-mono); letter-spacing: 0.08em; color: var(--muted); white-space: nowrap; }
#view-tuner .a4v { white-space: nowrap; }
/* "A4" and "= 442 Hz" are separate spans (A4 may become La4); a one-space gap makes them read "A4 = 442 Hz" */
#view-board .inl:has(> .a4v), #view-tuner .a4 { gap: calc(1ch + 0.08em); }
'''

# ---------------------------------------------------------------- board HTML
b_main = board[board.index('<main class="app">'):board.index('</main>') + len('</main>')]
b_main = re.sub(r'\n  <header>.*?</header>\n', '\n', b_main, flags=re.S)
b_main = b_main.replace('<main class="app">', '<div class="app">').replace('</main>', '</div>')
# A4 is chosen once in Settings; the board only shows it
b_main = must(b_main, """    <label class="inl" for="tuning">
      <span class="lbl lbl-a4">A4</span>
      <select id="tuning">
        <option value="442">442 Hz</option>
        <option value="440">440 Hz</option>
      </select>
    </label>""", """    <span class="inl">
      <span class="lbl lbl-a4">A4</span>
      <span class="a4v" id="tuning">= 442 Hz</span>
    </span>""")
assert '<header' not in b_main

# ---------------------------------------------------------------- tuner HTML
t_body = tuner[tuner.index('</header>') + len('</header>'):tuner.index('</main>')]
t_body = t_body.strip('\n')
t_body = must(t_body, '<label class="a4">A4 <select id="a4"></select></label>', '<span class="a4">A4 <span class="a4v" id="a4">= 442 Hz</span></span>')
# move the Start tuning row to the top of the panel so it is visible on small screens
a0 = t_body.index('    <div class="actions">')
a1 = t_body.index('</div>', t_body.index('id="status"', a0)) + len('</div>')
actions = t_body[a0:a1]
t_body = t_body[:a0].rstrip(' \n') + '\n' + t_body[a1:].lstrip('\n')
g0 = t_body.index('    <svg id="gauge"')
t_body = t_body[:g0] + actions + '\n' + t_body[g0:]
u0 = t_body.index('  <section class="panel upload"')
u1 = t_body.index('</section>', u0) + len('</section>')
t_body = t_body[:u0] + t_body[u1:].lstrip('\n')

# ---------------------------------------------------------------- scripts
b_js = board[board.index('<script>') + 8:board.rindex('</script>')]
b_js = must(b_js, "var state = { key: 'G', vibrato: true, tuning: 442, pos: '1' };", "var state = { key: 'G', vibrato: true, tuning: APP.a4, pos: '1' };")
b_js = must(b_js, "    if (['440', '442'].indexOf(String(saved.tuning)) >= 0) state.tuning = +saved.tuning;\n", "")
b_js = must(b_js, "key: state.key, vibrato: state.vibrato, tuning: state.tuning", "key: state.key, vibrato: state.vibrato")
b_js = must(b_js, "  tuningSel.value = String(state.tuning);", "  tuningSel.textContent = '= ' + state.tuning + ' Hz';")
b_js = must(b_js, "  tuningSel.addEventListener('change', function () { state.tuning = +tuningSel.value; persist(); });",
            "  APP.onA4.push(function (v) { state.tuning = v; tuningSel.textContent = '= ' + v + ' Hz'; render(); });\n"
            "  APP.onTemper.push(function () { render(); updateSub(); });   /* just intonation moves the notes */")
b_js = must(b_js, "  render();\n  setTimeout(layout, 300);\n})();",
            "  render();\n  setTimeout(layout, 300);\n\n"
            "  APP.views.board = {\n"
            "    show: function () { layout(); if (state.pos === 'pc') startMic(); },\n"
            "    hide: function () { stopAll(); if (state.pos === 'pc') stopMic(); }\n"
            "  };\n})();")


ACCENTS = [
    ('teal',   'Calm teal',  '#2F7377', '#6DBBC0'),
    ('sage',   'Sage green', '#4F7A66', '#86C2A5'),
    ('slate',  'Slate blue', '#4D6F93', '#8DB0D6'),
    ('violet', 'Soft violet','#6A5F93', '#B0A6DC'),
    ('classic','Classic',    '#16201B', '#E5ECE7'),
]
def _vars(light, c):
    on = '#FFFFFF' if light else '#0E1512'
    if c == '#16201B': on = '#ECEFEB'
    return '--accent:%s;--on-accent:%s;--t-accent:%s;--t-on-accent:%s;' % (c, on, c, on)
accent_css = '\n/* ---- accent colours (set by data-accent on <html>) ---- */\n'
for key, name, lc, dc in ACCENTS:
    accent_css += ':root[data-accent="%s"]{%s}\n' % (key, _vars(True, lc))
    accent_css += '@media (prefers-color-scheme: dark){:root[data-accent="%s"]:not([data-theme="light"]){%s}}\n' % (key, _vars(False, dc))
    accent_css += ':root[data-accent="%s"][data-theme="dark"]{%s}\n' % (key, _vars(False, dc))
accent_css += """#view-tuner .seg button[aria-pressed="true"] { background: var(--t-accent); color: var(--t-on-accent); }
.shell[data-view="tuner"] .tab[aria-current="page"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
"""
swatch_html = ''.join('<button type="button" class="swatch" role="radio" aria-checked="false" data-accent="%s" style="--sw:%s;--sw-d:%s"><i></i><span>%s</span></button>' % (k, lc, dc, n) for k, n, lc, dc in ACCENTS)

settings_css = """
.segc.two { grid-template-columns: repeat(2, 1fr); }
html[lang="zh-CN"] {
  --font-display: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --font-note: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --font-body: 'DM Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --font-mono: 'DM Mono', ui-monospace, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
  --t-sans-display: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --t-body: 'DM Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --t-mono: 'DM Mono', ui-monospace, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
}
.tab { position: relative; }
.tab.live::after { content: ""; position: absolute; top: 5px; right: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--panel); }
.tab[aria-current="page"].live::after, .tab.pulsing::after { background: var(--on-accent); box-shadow: 0 0 0 2px var(--accent); }   /* .pulsing: the beat pulse fills the tab with --accent (Hermes R10.1) */
.appsub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 480px) { .appsub { letter-spacing: -0.02em; font-size: 11px; } }
/* the fingerboard's line (key · intonation · position or Pitch Check status) may take two lines, then ends in … */
#sub { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
/* narrow Android phones (360 px): keep the title clear of the tool buttons */
@media (max-width: 380px) { .appbar h1 { font-size: 23px; } .appbar { gap: 8px; } .tabs { gap: 4px; } }
@media (max-width: 480px) { .tab { width: 40px; height: 40px; } .tabs { gap: 5px; } .tab svg { width: 22px; height: 22px; } }
@media (max-width: 350px) { .appbar { gap: 6px; } .tabs { gap: 3px; } .appbar h1 { font-size: 18px; letter-spacing: -0.02em; } }   /* "Fingerboard" clear of the tabs at 320 px (Hermes F11) */
/* ---- settings sheet ---- */
.tab-set { margin-left: 2px; }
.sheet {
  position: fixed; inset: 0; z-index: 110; display: grid; place-items: center; padding: 20px;
  background: rgba(8, 14, 11, .45); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  color: var(--fg); font-family: var(--font-note); overflow-y: auto;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.sheet[hidden] { display: none; }
.sheet-card { width: min(100%, 420px); background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 20px; box-shadow: 0 18px 50px rgba(0,0,0,.3); outline: none; }
.sheet-card h2 { margin: 0 0 14px; font: 700 24px/1.1 var(--font-display); letter-spacing: -0.02em; }
.sheet-card h3 { margin: 14px 0 8px; font: 500 12px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.sheet-card h3 .nc { text-transform: none; }   /* a note name keeps its own case: La4, not LA4 */
.segc { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.segc button { height: 42px; border: 0; background: transparent; color: var(--fg); font: 500 15px var(--font-note); cursor: pointer; }
.segc button + button { border-left: 1px solid var(--line); }
.segc button[aria-checked="true"] { background: var(--accent); color: var(--on-accent); }
.swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.swatch { display: grid; justify-items: center; gap: 6px; padding: 8px 2px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--fg); cursor: pointer; }
.swatch i { width: 36px; height: 36px; border-radius: 50%; background: var(--sw); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .swatch i { background: var(--sw-d); } }
:root[data-theme="dark"] .swatch i { background: var(--sw-d); }
.swatch span { font: 400 11px/1.2 var(--font-note); color: var(--muted); text-align: center; }
.swatch[aria-checked="true"] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.swatch[aria-checked="true"] span { color: var(--fg); font-weight: 600; }
.segc button:focus-visible, .swatch:focus-visible, .sheet-done:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.support { display: flex; align-items: center; gap: 14px; }
/* "Like this app?" and "Support" side by side on phones; stacked on desktop where the QR code shows */
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pair .howto-btn, .pair .support-btn { gap: 6px; padding: 0 6px; font-size: 14px; white-space: nowrap; }
.support-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; border: 1px solid var(--line); border-radius: 12px; color: var(--fg); text-decoration: none; font: 500 15px var(--font-note); }
.support-btn:hover { border-color: var(--accent); }
.support-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.support-qr { display: none; width: 128px; height: 128px; border-radius: 10px; border: 1px solid var(--line); background: #fff; }
@media (hover: hover) and (min-width: 700px) { .support-qr { display: block; } .support-btn { height: 128px; flex-direction: column; } .pair { grid-template-columns: 1fr; gap: 0; } }
.howto-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: transparent; color: var(--fg); font: 500 15px var(--font-note); cursor: pointer; }
/* keep the page in the same place on every tool, whether or not it needs a scrollbar */
html { scrollbar-gutter: stable; }
a.howto-btn { text-decoration: none; box-sizing: border-box; }
.howto-btn:hover { border-color: var(--accent); }
.howto-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.howto-btn svg, .howto-steps svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
#howto { z-index: 120; }
/* metronome beat flash (Settings > Beat flash): a full-screen wash in the accent colour on each beat, animated by met.js.
   z-index 104: over the page, under the tour (105), Settings (110) and Use offline (120), so an open window stays still. */
.beat-flash { position: absolute; left: 0; top: 0; width: 100%; height: 100vh; z-index: 104; pointer-events: none; opacity: 0; background: var(--accent); display: none; }   /* the colour chosen in Settings > Colour.
   Not position: fixed and display: none at rest: iOS Safari tints its toolbar from fixed elements at the screen edge, even invisible ones. */
#howto .sheet-card { width: min(100%, 440px); max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); overflow-y: auto; }
.howto-steps { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: st; display: grid; gap: 10px; }
.howto-steps li { counter-increment: st; display: flex; align-items: center; gap: 12px; font: 400 15px/1.4 var(--font-note); }
.howto-steps li::before { content: counter(st); flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font: 700 13px var(--font-note); }
.howto-steps li span { flex: 1; }
.howto-steps li svg { color: var(--muted); width: 22px; height: 22px; }
.howto-note { margin: 14px 0 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--accent) 10%, transparent); font: 400 13px/1.5 var(--font-note); color: var(--fg); }
.howto-note a { color: var(--accent); }
.sheet > .sheet-card { max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); overflow-y: auto; }
.ver { display: block; margin: 10px auto 0; padding: 6px 10px; min-height: 32px; border: 0; border-radius: 8px; background: transparent; text-align: center; font: 500 12px var(--font-mono); letter-spacing: 0.04em; color: var(--muted); cursor: pointer; }
.ver #verMsg { text-decoration: underline; text-underline-offset: 3px; }
.ver:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.sheet-done { position: sticky; bottom: 0; box-shadow: 0 -10px 12px var(--panel); }
.sheet-done { margin-top: 18px; width: 100%; height: 46px; border: 0; border-radius: 12px; background: var(--accent); color: var(--on-accent); font: 700 16px var(--font-note); cursor: pointer; }
"""

met_css = open(SP + 'met.css').read()
launch_css = '''
/* ---- start overlay ---- */
.launch {
  position: fixed; inset: 0; z-index: 100;
  display: grid; place-items: center; padding: 20px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  color: var(--fg); font-family: var(--font-note);
  overflow-y: auto;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  animation: launch-in .25s ease-out;
}
.launch[hidden] { display: none; }
.tab.launch-set { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); right: calc(env(safe-area-inset-right, 0px) + 12px); }   /* Settings, so the language can be changed before choosing */
.launch-card { width: min(100%, 720px); text-align: center; outline: none; }
.launch h2 { margin: 0; font: 700 clamp(30px, 6vw, 44px)/1.1 var(--font-display); letter-spacing: -0.02em; }
.launch-sub { margin: 8px 0 22px; font: 400 14px var(--font-mono); letter-spacing: .04em; color: var(--muted); }
.launch-grid { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: 1fr; gap: 12px; }
@media (min-width: 640px) { .launch-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 16px; } }
.launch-btn {
  display: grid; justify-items: center; gap: 8px; align-content: center;
  padding: 22px 16px; min-height: 150px; width: 100%; box-sizing: border-box; min-width: 0;
  border: 1px solid var(--line); border-radius: 18px;
  background: var(--panel); color: var(--fg); cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform .12s, border-color .12s, box-shadow .12s;
}
.launch-btn:hover { border-color: var(--accent); transform: translateY(-2px); }
.launch-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.launch-btn svg { width: 44px; height: 44px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.launch-btn b { font: 700 20px var(--font-display); }
.launch-btn span { font: 400 14px/1.35 var(--font-note); color: var(--muted); max-width: 22ch; min-width: 0; }
@keyframes launch-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .launch { animation: none; } .launch-btn { transition: none; } }
'''
met_css += '\n/* tuner gauge: wider on large screens */\n#view-tuner .panel > .actions { margin: 0 0 8px; }\n@media (min-width: 640px) { #view-tuner #gauge { width: 84%; max-width: none; } }\n'
met_html = open(SP + 'met.html').read()
met_js = open(SP + 'met.js').read()
i18n_js = open(SP + 'i18n.js').read()
coach_js = open(SP + 'coach.js').read()
coach_css = open(SP + 'coach.css').read()
app_version = open(SP + 'VERSION').read().strip()   # bumped by release.py, once per commit

dsp_start = tuner.index('<script id="dsp">') + len('<script id="dsp">')
dsp = tuner[dsp_start:tuner.index('</script>', dsp_start)]
t_start = tuner.index('<script>') + 8
t_js = tuner[t_start:tuner.index('</script>', t_start)]
t_js = must(t_js, "  var a4 = 442, mode = 'violin';", "  var a4 = APP.a4, mode = 'violin';")
t_js = must(t_js, "    var sa = +localStorage.getItem('vt-a4-v2');\n    if (A4S.indexOf(sa) >= 0) a4 = sa;\n", "")
t_js = must(t_js, """  A4S.forEach(function (v) {
    var o = document.createElement('option');
    o.value = v; o.textContent = v + ' Hz';
    if (v === a4) o.selected = true;
    sel.appendChild(o);
  });""", "  sel.textContent = '= ' + a4 + ' Hz';")
t_js = must(t_js, """  sel.addEventListener('change', function () {
    a4 = +sel.value;
    try { localStorage.setItem('vt-a4-v2', String(a4)); } catch (e) {}
    if (tone) tone.osc.frequency.value = hz(STR[tone.i].midi);
    refreshStrings(); refreshFoot();
    if (last) setFreq(last);
  });""", """  APP.onA4.push(function (v) {
    a4 = v;
    sel.textContent = '= ' + v + ' Hz';
    if (tone) tone.osc.frequency.value = shz(STR[tone.i].midi);
    refreshStrings(); refreshFoot();
    if (last) setFreq(last);
  });
  APP.onTemper.push(function () {
    if (tone) tone.osc.frequency.value = shz(STR[tone.i].midi);
    refreshStrings(); refreshFoot();
    if (last) setFreq(last);
  });""")
# Settings > Intonation: in just or Pythagorean intonation the open strings (shz) are pure fifths from A; Chromatic mode
# has no key, so its notes (hz) stay equal tempered
t_js = must(t_js, "  function hz(m) { return a4 * Math.pow(2, (m - 69) / 12); }",
            "  function hz(m) { return a4 * Math.pow(2, (m - 69) / 12); }\n"
            "  function shz(m) { return hz(m) * Math.pow(2, (APP.temper ? APP.temper.open(m) : 0) / 1200); }")
for a in ('hz(s.midi)', 'hz(best.s.midi)', 'hz(STR[i].midi)', 'hz(STR[tone.i].midi)', 'hz(55)', 'hz(62)', 'hz(69)', 'hz(76)'):
    assert a in t_js, a
    t_js = t_js.replace(a, 's' + a)
t_js = t_js.replace('sshz(', 'shz(')
u0 = t_js.index('  /* ---------- recording upload ---------- */')
u1 = t_js.index("  window.addEventListener('pagehide'")
t_js = t_js[:u0] + t_js[u1:]
t_js = must(t_js, "  fit();\n  startMic(true);\n})();", """  fit();
  APP.views.tuner = {
    show: function () { fit(); startMic(true); },
    hide: function () { stopTone(); if (running) stopMic(); setStatus(''); setIdle(); }
  };
})();""")

app_js = """var APP = window.APP = { views: {}, a4: 442, onA4: [] };
try { APP.flash = localStorage.getItem('violin-flash') !== 'off'; } catch (e) { APP.flash = true; }   /* beat flash is on unless turned off */
/* iPhones and iPads on silent (the ring/silent switch) mute a page's sound. iOS 16.4+ lets it play like a
   music app instead (Audio Session API). Asked for just before the first sound, not at load, so opening the
   page doesn't stop other music; while a microphone is on it is play-and-record (also not muted), even before
   any sound, and back to auto if nothing has played yet. */
APP.sound = false; APP.mics = {};
APP.session = function () {
  try {
    var s = navigator.audioSession, mic = false, k;
    if (!s) return;
    for (k in APP.mics) if (APP.mics[k]) mic = true;
    var t = mic ? 'play-and-record' : APP.sound ? 'playback' : 'auto';
    if (s.type !== t) s.type = t;
  } catch (e) {}
};
APP.playThroughSilent = function () { APP.sound = true; APP.session(); };
APP.mic = function (who, on) { APP.mics[who] = !!on; APP.session(); };
/* Leaving the app (another app, the home screen, a locked phone): iOS interrupts the page's audio, and a
   context resumed afterwards can stay silent until the app is force-quit. So while hidden the audio session
   is let go, and each tool starts a fresh AudioContext for its first sound afterwards: APP.made() stamps a
   new context, APP.renew() closes one from before the page was last hidden and says to make another. */
APP.audioGen = 0;
APP.made = function (ctx) { if (ctx) ctx.vtGen = APP.audioGen; return ctx; };
APP.renew = function (ctx) {
  if (!ctx) return true;
  if (ctx.state !== 'closed' && ctx.vtGen === APP.audioGen) return false;
  try { var p = ctx.close(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  return true;
};
(function () {
  function away() { APP.audioGen++; APP.sound = false; APP.session(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) away(); });
  window.addEventListener('pagehide', away);
})();
try {
  var savedA4 = +localStorage.getItem('violin-a4');
  if (savedA4 === 440 || savedA4 === 442) APP.a4 = savedA4;
} catch (e) {}
APP.setA4 = function (v) {
  APP.a4 = v;
  try { localStorage.setItem('violin-a4', String(v)); } catch (e) {}
  APP.onA4.forEach(function (fn) { fn(v); });
};
/* Settings > Intonation: equal temperament (APP.temper null), just intonation or Pythagorean. APP.temper
   gives each note's offset in cents from equal temperament.
   - Just: each stopped note is a pure (5-limit) interval above the key's tonic, measured from where equal
     temperament puts the tonic.
   - Pythagorean: every note is a chain of pure fifths from A, the tonic placed by its spelling (E♭ is six
     fifths below A, D♯ six above), so the scale's whole tones are 9/8, its thirds wide and its leading
     tones high, and the open strings fall on the scale exactly.
   In both, the open strings (and their octave harmonics) are pure fifths from A, so an open-string tonic
   (G, D, A, E) sounds up to 3.9 cents from equal. */
(function () {
  var R = [1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8];
  var JI = R.map(function (r, d) { return 1200 * Math.log(r) / Math.LN2 - 100 * d; });
  var FIFTH = 1200 * Math.log(3 / 2) / Math.LN2 - 700;   /* 1.955 cents wider than equal */
  var PY = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];        /* fifths from the tonic to each semitone above it */
  var LETTER = [-3, -1, 1, -4, -2, 0, 2], NAT = [0, 2, 4, 5, 7, 9, 11];   /* C D E F G A B: fifths from A */
  var OPEN = { 55: 4/9, 62: 2/3, 69: 1, 76: 3/2 };   /* G3 D4 A4 E5 against A4 */
  function open(midi) { return OPEN[midi] ? 1200 * Math.log(OPEN[midi]) / Math.LN2 - 100 * (midi - 69) : 0; }
  function d(midi, root) { return ((midi - root) % 12 + 12) % 12; }
  var T = {
    just: { id: 'just', open: open, cents: function (midi, key) { return JI[d(midi, key.root)]; } },
    pyth: { id: 'pyth', open: open, cents: function (midi, key) {
      var alt = ((key.root - NAT[key.letter]) % 12 + 18) % 12 - 6;   /* the tonic's ♯ (+1) or ♭ (-1) */
      return (LETTER[key.letter] + 7 * alt + PY[d(midi, key.root)]) * FIFTH;
    },
      /* a note by its name: letter 0-6 (C-B) and accidentals (+1 per ♯, -1 per ♭) */
      chain: function (letter, acc) { return (LETTER[letter] + 7 * acc) * FIFTH; } }
  };
  APP.temper = null; APP.onTemper = [];
  try { APP.temper = T[localStorage.getItem('violin-temper')] || null; } catch (e) {}
  APP.setTemper = function (t) {
    APP.temper = T[t] || null;
    try { localStorage.setItem('violin-temper', t); } catch (e) {}
    APP.onTemper.forEach(function (fn) { fn(); });
  };
})();
"""

nav_js = """(function () {
  /* Each tool registers APP.views[name] = { show, hide } and has a #view-name section,
     a #ttl-name heading block and a .tab button with data-view="name". */
  var names = ['tuner', 'board', 'metronome'];
  var shell = document.getElementById('shell');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-view]'));
  var cur = null;

  function show(name) {
    if (name === cur || !APP.views[name]) return;
    if (APP.coach) APP.coach.interrupt();   /* a tour for the old tool stops (not marked seen); the new tool's may start below */
    if (cur && APP.views[cur]) APP.views[cur].hide();
    cur = name;
    /* the tuner listens through the microphone, so the metronome stops when it opens; the fingerboard leaves it running */
    if (name === 'tuner' && APP.views.metronome && APP.views.metronome.stop) APP.views.metronome.stop();
    names.forEach(function (n) {
      var v = document.getElementById('view-' + n), t = document.getElementById('ttl-' + n);
      if (v) v.hidden = n !== name;
      if (t) t.hidden = n !== name;
    });
    tabs.forEach(function (b) {
      if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    shell.setAttribute('data-view', name);
    document.body.setAttribute('data-view', name);
    APP.views[name].show();
    if (APP.coach) APP.coach.maybe(name);
  }

  tabs.forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.view); });
  });

  /* settings sheet */
  var sheet = document.getElementById('sheet'), sheetCard = document.getElementById('sheetCard');
  var segLang = document.getElementById('segLang');
  var segNames = document.getElementById('segNames');
  var segA4 = document.getElementById('segA4'), segTemper = document.getElementById('segTemper');
  var segApp = document.getElementById('segApp'), swatches = document.getElementById('swatches');
  var segFlash = document.getElementById('segFlash');
  var openBtn = document.getElementById('openSettings');
  function syncSheet() {
    Array.prototype.forEach.call(segNames.children, function (b) { b.setAttribute('aria-checked', b.dataset.names === I18N.names ? 'true' : 'false'); });
    Array.prototype.forEach.call(segLang.children, function (b) { b.setAttribute('aria-checked', b.dataset.lang === I18N.lang ? 'true' : 'false'); });
    Array.prototype.forEach.call(segA4.children, function (b) { b.setAttribute('aria-checked', +b.dataset.a4 === APP.a4 ? 'true' : 'false'); });
    Array.prototype.forEach.call(segTemper.children, function (b) { b.setAttribute('aria-checked', b.dataset.temper === (APP.temper ? APP.temper.id : 'equal') ? 'true' : 'false'); });
    Array.prototype.forEach.call(segApp.children, function (b) { b.setAttribute('aria-checked', b.dataset.mode === THEME.mode ? 'true' : 'false'); });
    Array.prototype.forEach.call(swatches.children, function (b) { b.setAttribute('aria-checked', b.dataset.accent === THEME.accent ? 'true' : 'false'); });
    Array.prototype.forEach.call(segFlash.children, function (b) { b.setAttribute('aria-checked', (b.dataset.flash === 'on') === APP.flash ? 'true' : 'false'); });
  }
  var opener = openBtn;   /* the gear in the app bar, or the one on the start overlay */
  function closeSheet() {
    sheet.hidden = true;
    document.removeEventListener('keydown', onSheetKey);
    try { opener.focus(); } catch (e) {}
  }
  function onSheetKey(e) {
    if (!document.getElementById('howto').hidden) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key === 'Tab') {
      var els = Array.prototype.slice.call(sheet.querySelectorAll('button'));
      var i = els.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
    }
  }
  /* ---- how to use offline ---- */
  var howto = document.getElementById('howto'), howtoCard = document.getElementById('howtoCard');
  var segDev = document.getElementById('segDev'), openHowto = document.getElementById('openHowto');
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) { document.getElementById('lblOff').hidden = true; openHowto.hidden = true; }
  function showDev(d) {
    Array.prototype.forEach.call(segDev.children, function (b) { b.setAttribute('aria-checked', b.dataset.dev === d ? 'true' : 'false'); });
    document.getElementById('stepsIos').hidden = d !== 'ios';
    document.getElementById('stepsAndroid').hidden = d !== 'android';
    document.getElementById('stepsDesktop').hidden = d !== 'desktop';
    document.getElementById('howtoDesk').hidden = d !== 'desktop';
  }
  function closeHowto() {
    howto.hidden = true;
    document.removeEventListener('keydown', onHowtoKey);
    try { openHowto.focus(); } catch (e) {}
  }
  function onHowtoKey(e) {
    if (e.key === 'Escape') { closeHowto(); return; }
    if (e.key === 'Tab') {
      var els = Array.prototype.slice.call(howto.querySelectorAll('button'));
      var i = els.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
    }
  }
  document.getElementById('showTips').addEventListener('click', function () {
    closeSheet();
    APP.coach.reset();
    APP.coach.maybe(cur);
  });
  openHowto.addEventListener('click', function () {
    showDev(isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop'));
    howto.hidden = false;
    document.addEventListener('keydown', onHowtoKey);
    howtoCard.focus();
  });
  segDev.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showDev(b.dataset.dev); });
  document.getElementById('howtoDone').addEventListener('click', closeHowto);
  howto.addEventListener('click', function (e) { if (e.target === howto) closeHowto(); });
  function openSheet() {
    opener = this;
    syncSheet(); sheet.hidden = false;
    document.addEventListener('keydown', onSheetKey);
    sheetCard.focus();
  }
  openBtn.addEventListener('click', openSheet);
  document.getElementById('launchSettings').addEventListener('click', openSheet);
  segLang.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    I18N.set(b.dataset.lang); syncSheet();
  });
  segNames.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    I18N.setNames(b.dataset.names); syncSheet();
  });
  segFlash.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    APP.flash = b.dataset.flash === 'on';
    try { localStorage.setItem('violin-flash', APP.flash ? 'on' : 'off'); } catch (err) {}
    syncSheet();
  });
  segA4.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    APP.setA4(+b.dataset.a4); syncSheet();
  });
  segTemper.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    APP.setTemper(b.dataset.temper); syncSheet();
  });
  /* Version line: tap to fetch the newest release into the offline copy and reload.
     Without a service worker (local file, artifact) it just reloads. */
  (function () {
    var btn = document.getElementById('verBtn'), msg = document.getElementById('verMsg'), busy = false;
    function num(v) { var p = String(v).split('.'); return +p[0] * 100 + +((p[1] || '0') + '0').slice(0, 2); }
    function say(t) { msg.textContent = t; }
    function swapIn(reg) {
      /* the new sw.js caches the new page on install and takes over (skipWaiting + claim) */
      return new Promise(function (done) {
        var sw = navigator.serviceWorker, t = setTimeout(done, 15000);
        sw.addEventListener('controllerchange', function () { clearTimeout(t); done(); });
        reg.update().then(function () { if (!reg.installing && !reg.waiting) { clearTimeout(t); done(); } }, function () { clearTimeout(t); done(); });
      });
    }
    btn.addEventListener('click', function () {
      if (busy) return;
      var sw = navigator.serviceWorker;
      if (!sw || !sw.controller) { location.reload(); return; }
      busy = true; say('Checking…');
      fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        /* a different build stamp means a new release (test builds keep the same version number) */
        var newer = j.build && btn.dataset.build ? j.build !== btn.dataset.build : num(j.version) > num(btn.dataset.version);
        if (!newer) { busy = false; say('Up to date'); return; }
        say('Updating to ' + j.version + '…');
        return sw.getRegistration().then(function (reg) { return reg && swapIn(reg); }).then(function () {
          /* belt and braces: also put the fresh page into every saved copy before reloading */
          return fetch('index.html', { cache: 'no-store' }).then(function (r) {
            if (!r.ok) return;
            /* only this site's caches (data-cache prefix + build stamp); the test site shares the origin */
            var mine = new RegExp('^' + (btn.dataset.cache || 'violin-toolkit-') + '\\d{8}-\\d{6}$');
            return caches.keys().then(function (ks) {
              return Promise.all(ks.filter(function (k) { return mine.test(k); })
                .map(function (k) { return caches.open(k).then(function (c) { return c.put('index.html', r.clone()); }); }));
            });
          }).catch(function () {});
        }).then(function () { location.reload(); });
      }).catch(function () { busy = false; say('Can’t check while offline'); });
    });
  })();
  segApp.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    THEME.mode = b.dataset.mode; THEME.apply(); syncSheet();
  });
  swatches.addEventListener('click', function (e) {
    var b = e.target.closest('.swatch'); if (!b) return;
    THEME.accent = b.dataset.accent; THEME.apply(); syncSheet();
  });
  document.getElementById('sheetDone').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

  var h = (location.hash || '').replace('#', '').split(/[,&;]/).map(function (t) { return t.trim().toLowerCase(); })
    .filter(function (t) { return ['fingerboard', 'board', 'tuner', 'metronome'].indexOf(t) >= 0; })[0] || '';
  var map = { fingerboard: 'board', board: 'board', tuner: 'tuner', metronome: 'metronome' };
  show(map[h] || 'board');

  /* start overlay: asked once per load unless the link already names a tool (#tuner, #metronome, #fingerboard) */
  var launch = document.getElementById('launch');
  var lastFocus = null;
  function closeLaunch(choice) {
    launch.hidden = true;
    document.removeEventListener('keydown', onKey);
    if (choice) show(choice);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    if (APP.coach) APP.coach.maybe(cur);   /* first-use tips wait until the start overlay is gone */
  }
  function onKey(e) {
    if (!document.getElementById('sheet').hidden) return;   /* Settings is open on top */
    if (e.key === 'Escape') { closeLaunch(null); return; }
    if (e.key === 'Tab') {   /* keep focus inside the dialog */
      var els = Array.prototype.slice.call(launch.querySelectorAll('button'));
      var i = els.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
    }
  }
  Array.prototype.forEach.call(launch.querySelectorAll('.launch-btn'), function (b) {
    b.addEventListener('click', function () { closeLaunch(b.dataset.view); });
  });
  /* skip link: move focus without touching the address (a #main hash would read as a tool link) */
  document.getElementById('skip').addEventListener('click', function (e) { e.preventDefault(); document.getElementById('main').focus(); });
  window.addEventListener('hashchange', function () {
    var t = (location.hash || '').replace('#', '').split(/[,&;]/).map(function (x) { return x.trim().toLowerCase().replace(/^(lang|names)=/, ''); });
    var v = t.filter(function (x) { return map[x]; })[0];
    if (v) { if (!launch.hidden) closeLaunch(null); show(map[v]); }
    if (window.I18N) {
      if (t.indexOf('zh') >= 0 || t.indexOf('cn') >= 0) I18N.set('zh'); else if (t.indexOf('en') >= 0) I18N.set('en');
      if (t.indexOf('solfege') >= 0 || t.indexOf('sol') >= 0) I18N.setNames('solfege'); else if (t.indexOf('letter') >= 0) I18N.setNames('letter');
    }
  });
  if (!map[h]) {
    lastFocus = document.activeElement;
    launch.hidden = false;
    document.addEventListener('keydown', onKey);
    document.getElementById('launchCard').focus({ preventScroll: true });   /* a focus scroll would push the gear up (Hermes R11.1) */
  }
})();
"""

init_js = '''<script>
(function () {
  var ACC = ['teal', 'sage', 'slate', 'violet', 'classic'], mode = 'light', acc = 'teal';   /* new users start in light; a saved choice wins */
  try {
    var s = JSON.parse(localStorage.getItem('violin-theme') || '{}');
    if (['light', 'dark', 'auto'].indexOf(s.mode) >= 0) mode = s.mode;
    if (ACC.indexOf(s.accent) >= 0) acc = s.accent;
  } catch (e) {}
  var root = document.documentElement;
  try {
    var hl = (location.hash || '').toLowerCase().match(/(?:^|[#,&;])(?:lang=)?(zh|cn|en)(?=$|[,&;])/);
    window.HASH_LANG = hl ? (hl[1] === 'en' ? 'en' : 'zh') : null;
    window.HASH_NAMES = /(?:^|[#,&;])(?:names=)?(solfege|sol|letter)(?=$|[,&;])/i.test(location.hash) ? (/solfege|sol/i.test(location.hash.replace(/letter/i, '')) ? 'solfege' : 'letter') : null;
    if ((window.HASH_LANG || localStorage.getItem('violin-lang')) === 'zh') root.setAttribute('lang', 'zh-CN');
  } catch (e) {}
  window.THEME = {
    mode: mode, accent: acc,
    apply: function () {
      if (this.mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', this.mode);
      root.setAttribute('data-accent', this.accent);
      try { localStorage.setItem('violin-theme', JSON.stringify({ mode: this.mode, accent: this.accent })); } catch (e) {}
      this.bar();
    },
    /* the phone's status bar takes the page background, so it matches light/dark */
    bar: function () {
      var m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) m.content = bg;
    }
  };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { window.THEME.bar(); }); } catch (e) {}
  window.THEME.apply();
})();
</script>
'''

import base64
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,'
         'U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')
def face(family, file, weight):
    data = base64.b64encode(open(SP + 'fonts/' + file, 'rb').read()).decode()
    return ("@font-face { font-family: '%s'; font-style: normal; font-weight: %s; font-display: swap;\n"
            "  src: url(data:font/woff2;base64,%s) format('woff2'); unicode-range: %s; }\n" % (family, weight, data, LATIN))
# fonts live in src/fonts (SIL Open Font License, see OFL.txt) and are inlined, so nothing is fetched from Google
font_faces = (face('DM Sans', 'dm-sans-latin-wght-normal.woff2', '100 1000') + face('Outfit', 'outfit-latin-wght-normal.woff2', '100 900')
              + face('DM Mono', 'dm-mono-latin-400-normal.woff2', '400') + face('DM Mono', 'dm-mono-latin-500-normal.woff2', '500'))

head = f"""<title>Violin Toolkit</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{font_faces}</style>
"""

ICON_BOARD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11"/><path d="M8.4 3.5L7.2 21M10.8 3.5l-.5 17.5M13.2 3.5l.5 17.5M15.6 3.5L16.8 21" opacity=".7"/><path d="M7.7 11h8.6M7.3 17h9.4" opacity=".7"/><circle cx="10.8" cy="7.3" r="1.3" fill="currentColor"/><circle cx="15.6" cy="14" r="1.3" fill="currentColor"/></svg>'
ICON_MET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 3h5.6l3.4 18H5.8z"/><path d="M12 17.5L15.6 6.5"/><circle cx="14.2" cy="10.6" r="1.2" fill="currentColor"/><path d="M8 21h8" opacity=".0"/></svg>'
ICON_SET = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
ICON_TUNER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 17.5a8.5 8.5 0 0 1 17 0"/><path d="M12 17.5l3.6-7"/><circle cx="12" cy="17.5" r="1.2"/><path d="M12 5.8v1.8M5.6 9l1.3 1.2M18.4 9l-1.3 1.2"/></svg>'

markup = f"""
<div class="shell" id="shell" data-view="board">
  <a class="skip" href="#main" id="skip">Skip to content</a>
  <header class="appbar">
    <div id="ttl-board">
      <h1>Fingerboard</h1>
      <p class="appsub" id="sub">G major · first position</p>
    </div>
    <div id="ttl-tuner" hidden>
      <h1>Tuner</h1>
      <p class="appsub">G · D · A · E</p>
    </div>
    <div id="ttl-metronome" hidden>
      <h1>Metronome</h1>
      <p class="appsub" id="ttl-metronome-sub">80 BPM · 4/4</p>
    </div>
    <nav class="tabs" aria-label="Tools">
      <button type="button" class="tab" data-view="tuner" aria-label="Tuner" title="Tuner">{ICON_TUNER}</button>
      <button type="button" class="tab" data-view="board" aria-current="page" aria-label="Fingerboard" title="Fingerboard">{ICON_BOARD}</button>
      <button type="button" class="tab" data-view="metronome" aria-label="Metronome" title="Metronome">{ICON_MET}</button>
      <button type="button" class="tab tab-set" id="openSettings" aria-label="Settings" title="Settings" aria-haspopup="dialog">{ICON_SET}</button>
    </nav>
  </header>

  <main id="main" tabindex="-1">
  <section id="view-board" aria-label="Violin fingerboard">
{b_main}
  </section>

  <section id="view-metronome" aria-label="Metronome" hidden>
{met_html}
  </section>

  <section id="view-tuner" aria-label="Violin tuner" hidden>
    <div class="wrap">
{t_body}
    </div>
  </section>
  </main>

</div>

<div class="beat-flash" id="beatFlash" aria-hidden="true"></div>
<div class="coach" id="coach" hidden>
  <div class="coach-hole" id="coachHole"></div>
  <div class="coach-tip" id="coachTip" role="dialog" aria-modal="true" aria-labelledby="coachTitle" aria-describedby="coachText">
    <span class="coach-arrow" id="coachArrow" aria-hidden="true"></span>
    <p class="coach-step" id="coachStep"></p>
    <h2 id="coachTitle"></h2>
    <p id="coachText"></p>
    <div id="coachPic" hidden></div>
    <div class="coach-btns"><button type="button" class="coach-skip" id="coachSkip">Skip</button><button type="button" class="coach-next" id="coachNext">Next</button></div>
  </div>
</div>

<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" hidden>
  <div class="sheet-card" id="sheetCard" tabindex="-1">
    <h2 id="sheetTitle">Settings</h2>
    <h3 id="lblLang">Language</h3>
    <div class="segc two" role="radiogroup" aria-labelledby="lblLang" id="segLang">
      <button type="button" role="radio" aria-checked="false" data-lang="en">English</button>
      <button type="button" role="radio" aria-checked="false" data-lang="zh">中文</button>
    </div>
    <h3 id="lblNames">Note names</h3>
    <div class="segc two" role="radiogroup" aria-labelledby="lblNames" id="segNames">
      <button type="button" role="radio" aria-checked="false" data-names="letter">Pitch names</button>
      <button type="button" role="radio" aria-checked="false" data-names="solfege">Solfège</button>
    </div>
    <h3 id="lblA4">Tuning pitch <span class="nc">(A4)</span></h3>
    <div class="segc two" role="radiogroup" aria-labelledby="lblA4" id="segA4">
      <button type="button" role="radio" aria-checked="false" data-a4="442">442 Hz</button>
      <button type="button" role="radio" aria-checked="false" data-a4="440">440 Hz</button>
    </div>
    <h3 id="lblTemper">Intonation</h3>
    <div class="segc" role="radiogroup" aria-labelledby="lblTemper" id="segTemper">
      <button type="button" role="radio" aria-checked="false" data-temper="equal">Equal</button>
      <button type="button" role="radio" aria-checked="false" data-temper="just">Just</button>
      <button type="button" role="radio" aria-checked="false" data-temper="pyth">Pythagorean</button>
    </div>
    <h3 id="lblApp">Appearance</h3>
    <div class="segc" role="radiogroup" aria-labelledby="lblApp" id="segApp">
      <button type="button" role="radio" aria-checked="false" data-mode="light">Light</button>
      <button type="button" role="radio" aria-checked="false" data-mode="dark">Dark</button>
      <button type="button" role="radio" aria-checked="false" data-mode="auto">Automatic</button>
    </div>
    <h3 id="lblCol">Colour</h3>
    <div class="swatches" role="radiogroup" aria-labelledby="lblCol" id="swatches">{swatch_html}</div>
    <h3 id="lblFlash">Beat flash</h3>
    <div class="segc two" role="radiogroup" aria-labelledby="lblFlash" id="segFlash">
      <button type="button" role="radio" aria-checked="false" data-flash="on">On</button>
      <button type="button" role="radio" aria-checked="false" data-flash="off">Off</button>
    </div>
    <h3 id="lblHelp">Help</h3>
    <button type="button" class="howto-btn" id="showTips"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><path d="M12 16.8h.01"/></svg><span>Show tips again</span></button>
    <h3 id="lblOff">Offline</h3>
    <button type="button" class="howto-btn" id="openHowto" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M12 8v6m0 0l-2.5-2.5M12 14l2.5-2.5"/><path d="M11 18.5h2"/></svg><span>Use offline on your phone</span></button>
    <div class="pair">
      <div>
      <h3 id="lblStar">Like this app?</h3>
      <a class="howto-btn" href="https://github.com/trix69/violin-toolkit" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg><span>Star on GitHub</span></a>
      </div>
      <div>
      <h3 id="lblSup">Support</h3>
      <div class="support">
        <a class="support-btn" href="https://buymeacoffee.com/trinks" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span><span>Buy me a coffee</span></a>
        <img class="support-qr" alt="QR code for buymeacoffee.com/trinks" width="128" height="128" src="data:image/png;base64,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">
      </div>
      </div>
    </div>
    <button type="button" class="ver" id="verBtn" data-version="{app_version}"><span>Version {app_version}</span> · <span id="verMsg">Check for updates</span></button>
    <button type="button" class="sheet-done" id="sheetDone">Done</button>
  </div>
</div>

<div class="sheet" id="howto" role="dialog" aria-modal="true" aria-labelledby="howtoTitle" hidden>
  <div class="sheet-card" id="howtoCard" tabindex="-1">
    <h2 id="howtoTitle">Use offline</h2>
    <div class="segc" role="radiogroup" aria-label="Device" id="segDev">
      <button type="button" role="radio" aria-checked="false" data-dev="ios">iPhone / iPad</button>
      <button type="button" role="radio" aria-checked="false" data-dev="android">Android</button>
      <button type="button" role="radio" aria-checked="false" data-dev="desktop">Mac / PC</button>
    </div>
    <ol class="howto-steps" id="stepsIos" hidden>
      <li><span>Open this page in Safari.</span></li>
      <li><span>Tap the Share button.</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4l4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/></svg></li>
      <li><span>Scroll down and tap Add to Home Screen.</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/></svg></li>
      <li><span>Keep Open as Web App switched on, then tap Add.</span></li>
      <li><span>Open it from the new Home Screen icon once while you have internet.</span></li>
    </ol>
    <ol class="howto-steps" id="stepsAndroid" hidden>
      <li><span>Open this page in Chrome.</span></li>
      <li><span>Tap the menu button.</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></li>
      <li><span>Tap Install app, or Add to Home screen.</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/></svg></li>
      <li><span>Tap Install to confirm.</span></li>
      <li><span>Open it from the new icon once while you have internet.</span></li>
    </ol>
    <ol class="howto-steps" id="stepsDesktop" hidden>
      <li><span>Open this page in Chrome or Edge.</span></li>
      <li><span>Click the install icon at the right end of the address bar.</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 7.5v6m0 0l-2.5-2.5M12 13.5l2.5-2.5"/><path d="M8 20.5h8"/></svg></li>
      <li><span>Click Install to confirm.</span></li>
      <li><span>Open it from its new icon once while you have internet.</span></li>
    </ol>
    <p class="howto-note" id="howtoNote">After the first visit, it also works offline.</p>
    <p class="howto-note" id="howtoDesk" hidden>No install icon? Open the browser menu and choose Install Violin Toolkit. In Safari on a Mac, use File, then Add to Dock. Firefox cannot install apps, but the page still opens offline in a browser tab after one visit.</p>
    <button type="button" class="sheet-done" id="howtoDone">Done</button>
  </div>
</div>
<div class="launch" id="launch" role="dialog" aria-modal="true" aria-labelledby="launchTitle" hidden>
  <div class="launch-card" id="launchCard" tabindex="-1">
    <h2 id="launchTitle">Violin Toolkit</h2>
    <p class="launch-sub">What would you like to start with?</p>
    <div class="launch-grid">
      <button type="button" class="launch-btn" data-view="tuner">{ICON_TUNER}<b>Tuner</b><span>Tune G · D · A · E with your microphone</span></button>
      <button type="button" class="launch-btn" data-view="board">{ICON_BOARD}<b>Fingerboard</b><span>Find and play notes in each position</span></button>
      <button type="button" class="launch-btn" data-view="metronome">{ICON_MET}<b>Metronome</b><span>Keep steady time at any tempo</span></button>
    </div>
  </div>
  <button type="button" class="tab launch-set" id="launchSettings" aria-label="Settings" title="Settings" aria-haspopup="dialog">{ICON_SET}</button>
</div>
"""

doc = (head + '<style>\n' + b_tokens.strip() + '\n\n/* Tuner tokens, prefixed --t- so they never clash with the fingerboard */\n' + t_tokens.strip() + '\n'
       + chrome_css + '\n/* ---- fingerboard ---- */\n' + board_css + '\n/* ---- tuner ---- */\n' + tuner_css + '\n/* ---- metronome ---- */\n' + met_css + launch_css + settings_css + coach_css + accent_css + '</style>\n'
       + '\n' + init_js + markup
       + '\n<script>\n' + app_js + '</script>\n<script>\n' + dsp + '</script>\n<script>' + t_js + '</script>\n<script>' + b_js + '</script>\n<script>\n' + met_js + '</script>\n<script>\n' + nav_js + '</script>\n<script>\n' + coach_js + '</script>\n<script>\n' + i18n_js + '</script>\n')

open(DIST + 'violin-fingerboard.html', 'w', encoding='utf-8').write(doc)

i = doc.index('<div class="shell"')
h, b = doc[:i], doc[i:]
h = h.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
out = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + h + '<style>:root{color-scheme:light}[hidden]{display:none!important}body{margin:0;font-size:14px}</style>\n</head>\n<body>\n' + b + '</body>\n</html>\n')
open(DIST + 'standalone.html', 'w', encoding='utf-8').write(out)
print('built', len(doc))
