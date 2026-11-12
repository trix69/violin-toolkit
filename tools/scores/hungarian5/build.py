"""Brahms, Hungarian Dance No. 5, arr. Hans Erblich (IMSLP #205345, PDF typeset by the arranger 2012, Creative Commons
Attribution Share Alike 3.0): transcribed by Violin Toolkit 2026 from the PDF (Audiveris draft corrected bar by bar).
Usage: build.py <dir with tokens.txt> out.mxl
tokens.txt -> hungarian5.mxl. Line: 'P<n> <bar>: tok tok | tok' ; tok = PITCH[+PITCH]:DUR[~] or r:DUR
PITCH = step [# b n] octave (absolute, alter written out); DUR = 1 2 4 8 16 32 [.] [t triplet | q quintuplet]; '|' = second voice."""
import sys, zipfile, re
D = sys.argv[1]; out = sys.argv[2]
DIV = 120; BASE = {'1': 480, '2': 240, '4': 120, '8': 60, '16': 30, '32': 15}
TYPE = {'1': 'whole', '2': 'half', '4': 'quarter', '8': 'eighth', '16': '16th', '32': '32nd'}
NAMES = ['Violin I', 'Violin II', 'Viola I', 'Viola II', 'Violoncello']; PROG = [41, 41, 42, 42, 43]
CLEF = [('G', 2), ('G', 2), ('C', 3), ('C', 3), ('F', 4)]
KEY = lambda b: 1 if 49 <= b <= 62 else -2
TEMPO = {1: ('Allegro', 152), 41: ('meno', 120), 45: ('a tempo', 152), 49: ('Vivace', 192), 55: ('meno', 150), 57: ('a tempo', 192),
         59: ('meno', 150), 61: ('a tempo', 192), 63: ('Tempo I', 152), 87: ('meno', 120), 91: ('a tempo', 152)}
FWD = {33, 49, 55}; BWD = {48, 54, 62}; LAST = 96
bars = {}
for ln in open(D + '/tokens.txt'):
    ln = ln.split(';')[0].strip()
    if not ln: continue
    m = re.match(r'P(\d) (\d+):(.*)', ln); bars[(int(m.group(1)), int(m.group(2)))] = m.group(3).strip()
def dur(d):
    q = d.rstrip('.tq'); v = BASE[q]
    if '.' in d: v = v * 3 // 2
    if 't' in d: v = v * 2 // 3
    if 'q' in d: v = v * 4 // 5
    return v, TYPE[q], '.' in d, 't' if 't' in d else 'q' if 'q' in d else ''
def pitch(p):
    m = re.match(r'([A-G])([#bn]?)(\d)$', p); assert m, p
    al = {'#': 1, 'b': -1}.get(m.group(2), 0)
    return '<pitch><step>%s</step>%s<octave>%s</octave></pitch>' % (m.group(1), '<alter>%d</alter>' % al if al else '', m.group(3))
bad = []; parts = []
for pn in range(1, 6):
    ms = []; tied = set()
    for b in range(1, LAST + 1):
        src = bars.get((pn, b), '')
        x = '<measure number="%d">' % b
        if b in FWD: x += '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
        if b == 1 or KEY(b) != KEY(b - 1):
            x += '<attributes>' + ('<divisions>%d</divisions>' % DIV if b == 1 else '') + '<key><fifths>%d</fifths></key>' % KEY(b)
            if b == 1: x += '<time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>%s</sign><line>%d</line></clef>' % CLEF[pn - 1]
            x += '</attributes>'
        if pn == 1 and b in TEMPO:
            x += '<direction placement="above"><direction-type><words>%s</words></direction-type><sound tempo="%d"/></direction>' % TEMPO[b]
        voices = [v.split() for v in src.split('|')] if src else [['r:2']]
        for vi, toks in enumerate(voices):
            if vi: x += '<backup><duration>%d</duration></backup>' % 240
            tot = 0; tup = 0
            # beams: notes shorter than a crotchet inside one beat are beamed (level 2 for 16ths and shorter)
            info = []; pos = 0
            for t in toks:
                p_, d_ = t.split(':'); v_ = dur(d_.rstrip('~'))[0]; info.append((pos, v_, p_ == 'r')); pos += v_
            beams = [{} for _ in toks]
            grp = []
            def flush(g):
                if len(g) < 2: return
                for j, k in enumerate(g): beams[k][1] = 'begin' if j == 0 else 'end' if j == len(g) - 1 else 'continue'
                run = []
                for j, k in enumerate(g + [None]):
                    if k is not None and info[k][1] <= 30: run.append(j); continue
                    if len(run) >= 2:
                        for i2, jj in enumerate(run): beams[g[jj]][2] = 'begin' if i2 == 0 else 'end' if i2 == len(run) - 1 else 'continue'
                    elif len(run) == 1: beams[g[run[0]]][2] = 'forward hook' if run[0] == 0 else 'backward hook'
                    run = []
            for k, (st, v_, rest) in enumerate(info):
                if rest or v_ >= 120: flush(grp); grp = []; continue
                if grp and st // 120 != info[grp[0]][0] // 120: flush(grp); grp = []
                grp.append(k)
            flush(grp)
            for ti, t in enumerate(toks):
                p, d = t.split(':'); tie = d.endswith('~'); d = d.rstrip('~')
                v, ty, dot, tm = dur(d); tot += v
                for k, q in enumerate(p.split('+')):
                    qt = tie or q.endswith('~'); q = q.rstrip('~')
                    n = '<note>' + ('<chord/>' if k else '') + ('<rest/>' if q == 'r' else pitch(q)) + '<duration>%d</duration>' % v
                    key = (vi, q)
                    if key in tied: n += '<tie type="stop"/>'
                    if qt: n += '<tie type="start"/>'
                    n += '<voice>%d</voice><type>%s</type>' % (vi + 1, ty) + ('<dot/>' if dot else '')
                    if tm: n += '<time-modification><actual-notes>%d</actual-notes><normal-notes>%d</normal-notes></time-modification>' % ((3, 2) if tm == 't' else (5, 4))
                    if not k and q != 'r': n += ''.join('<beam number="%d">%s</beam>' % (lv, beams[ti][lv]) for lv in (1, 2) if lv in beams[ti])
                    nt = ''
                    if key in tied: nt += '<tied type="stop"/>'
                    if qt: nt += '<tied type="start"/>'
                    if nt: n += '<notations>%s</notations>' % nt
                    x += n + '</note>'
                for q in p.split('+'):
                    qt = tie or q.endswith('~'); q = q.rstrip('~')
                    tied.discard((vi, q))
                    if qt: tied.add((vi, q))
            if tot != 240: bad.append('P%d b%d voice %d: %s beats' % (pn, b, vi + 1, tot / 120))
        if b in BWD: x += '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
        elif b == LAST: x += '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        ms.append(x + '</measure>')
    parts.append('<part id="P%d">%s</part>' % (pn, ''.join(ms)))
pl = ''.join('<score-part id="P%d"><part-name>%s</part-name><midi-instrument id="P%d-I1"><midi-channel>%d</midi-channel><midi-program>%d</midi-program></midi-instrument></score-part>' % (i + 1, NAMES[i], i + 1, i + 1, PROG[i]) for i in range(5))
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>Hungarian Dance No. 5</work-title></work>'
       '<identification><creator type="composer">Johannes Brahms</creator><creator type="arranger">Hans Erblich</creator><rights>Arrangement (c) Hans Erblich 2012, CC BY-SA 3.0 (IMSLP #205345); this transcription by Violin Toolkit 2026, CC BY-SA 3.0</rights></identification>'
       '<part-list>' + pl + '</part-list>' + ''.join(parts) + '</score-partwise>')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    zo.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>')
    zo.writestr('score.xml', xml)
print(out, 'bad bars:', len(bad)); print('\n'.join(bad[:400]))
