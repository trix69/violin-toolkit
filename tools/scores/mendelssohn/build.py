"""Token score -> MusicXML, general version of hungarian5/build.py: the piece is described by <dir>/conf.py
(NAMES, PROG, CLEF, KEY(b), TIME (beats, beat-type), TEMPO {bar: (words, crotchet bpm)}, FWD, BWD, LAST, TITLE,
COMPOSER, EXTRA_CREATORS [(type, name)], RIGHTS). Usage: build.py <dir with conf.py and tokens.txt> out.mxl
tokens.txt -> hungarian5.mxl. Line: 'P<n> <bar>: tok tok | tok' ; tok = PITCH[+PITCH]:DUR[~] or r:DUR
PITCH = step [# b n] octave (absolute, alter written out); DUR = 1 2 4 8 16 32 [.] [t triplet | q quintuplet]; '|' = second voice."""
import sys, zipfile, re
from xml.sax.saxutils import escape as esc
D = sys.argv[1]; out = sys.argv[2]
DIV = 120; BASE = {'1': 480, '2': 240, '4': 120, '8': 60, '16': 30, '32': 15}
TYPE = {'1': 'whole', '2': 'half', '4': 'quarter', '8': 'eighth', '16': '16th', '32': '32nd'}
C = {}; exec(open(D + '/conf.py').read(), C)
NAMES, PROG, CLEF, KEY, TEMPO, FWD, BWD, LAST = C['NAMES'], C['PROG'], C['CLEF'], C['KEY'], C['TEMPO'], C['FWD'], C['BWD'], C['LAST']
BEATS, BTYPE = C['TIME']; FULL = DIV * 4 * BEATS // BTYPE; BEAT = DIV * 4 // BTYPE   # a beat in divisions (beams group by it)
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
    m = re.match(r'([A-G])(##|bb|[#bn]?)(\d)$', p); assert m, p
    al = {'#': 1, 'b': -1, '##': 2, 'bb': -2}.get(m.group(2), 0)
    return '<pitch><step>%s</step>%s<octave>%s</octave></pitch>' % (m.group(1), '<alter>%d</alter>' % al if al else '', m.group(3))
bad = []; parts = []
for pn in range(1, len(NAMES) + 1):
    ms = []; tied = set()
    for b in range(1, LAST + 1):
        src = bars.get((pn, b), '')
        x = '<measure number="%d">' % b
        if b in FWD: x += '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
        if b == 1 or KEY(b) != KEY(b - 1):
            x += '<attributes>' + ('<divisions>%d</divisions>' % DIV if b == 1 else '') + '<key><fifths>%d</fifths>%s</key>' % (KEY(b), '<mode>%s</mode>' % C['MODE'] if C.get('MODE') else '')
            if b == 1: x += '<time><beats>%d</beats><beat-type>%d</beat-type></time>' % (BEATS, BTYPE) + '<clef><sign>%s</sign><line>%d</line></clef>' % CLEF[pn - 1]
            x += '</attributes>'
        if pn == 1 and b in TEMPO:
            x += '<direction placement="above"><direction-type><words>%s</words></direction-type><sound tempo="%d"/></direction>' % TEMPO[b]
        voices = [v.split() for v in src.split('|')] if src else [['r:%s' % {480: '1', 240: '2', 360: '2.'}.get(FULL, '1')]]
        for vi, toks in enumerate(voices):
            if vi: x += '<backup><duration>%d</duration></backup>' % FULL
            tot = 0; tup = 0
            # beams: notes shorter than a crotchet inside one beat are beamed (level 2 for 16ths and shorter)
            info = []; pos = 0
            for t in toks:
                p_, d_ = t.split(':'); v_ = dur(d_.rstrip('~'))[0]; info.append((pos, v_, p_ == 'r', 't' in d_)); pos += v_
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
            for k, (st, v_, rest, trip) in enumerate(info):
                if rest or v_ >= 120: flush(grp); grp = []; continue
                unit = 120 if trip else BEAT   # triplets beam in threes (one crotchet), other notes by the beat
                if grp and (st // unit != info[grp[0]][0] // unit or trip != info[grp[0]][3]): flush(grp); grp = []
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
                    if tm == 't' and not k:   # a triplet: '3' over each crotchet's three (start on the first, stop on the last)
                        st_ = info[ti][0]
                        if st_ % 120 == 0: nt += '<tuplet type="start" bracket="no"/>'
                        elif (st_ + 40) % 120 == 0: nt += '<tuplet type="stop"/>'
                    if key in tied: nt += '<tied type="stop"/>'
                    if qt: nt += '<tied type="start"/>'
                    if nt: n += '<notations>%s</notations>' % nt
                    x += n + '</note>'
                for q in p.split('+'):
                    qt = tie or q.endswith('~'); q = q.rstrip('~')
                    tied.discard((vi, q))
                    if qt: tied.add((vi, q))
            if tot != FULL: bad.append('P%d b%d voice %d: %s beats' % (pn, b, vi + 1, tot / 120))
        if b in BWD: x += '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
        elif b == LAST: x += '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        ms.append(x + '</measure>')
    parts.append('<part id="P%d">%s</part>' % (pn, ''.join(ms)))
pl = ''.join('<score-part id="P%d"><part-name>%s</part-name><midi-instrument id="P%d-I1"><midi-channel>%d</midi-channel><midi-program>%d</midi-program></midi-instrument></score-part>' % (i + 1, NAMES[i], i + 1, i + 1, PROG[i]) for i in range(len(NAMES)))
ident = '<identification><creator type="composer">%s</creator>%s<rights>%s</rights></identification>' % (esc(C['COMPOSER']), ''.join('<creator type="%s">%s</creator>' % (t[0], esc(t[1])) for t in C.get('EXTRA_CREATORS', [])), esc(C['RIGHTS']))
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>%s</work-title></work>' % esc(C['TITLE']) + ident +
       '<part-list>' + pl + '</part-list>' + ''.join(parts) + '</score-partwise>')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    zo.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>')
    zo.writestr('score.xml', xml)
print(out, 'bad bars:', len(bad)); print('\n'.join(bad[:400]))
