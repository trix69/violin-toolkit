"""Token score -> MusicXML, general version of hungarian5/build.py: the piece is described by <dir>/conf.py
(NAMES, PROG, CLEF, KEY(b), TIME (beats, beat-type) or TIME(b) -> (beats, beat-type), optional DIV (divisions per crotchet, 120), TEMPO {bar: (words, crotchet bpm)}, FWD, BWD, LAST, TITLE,
COMPOSER, EXTRA_CREATORS [(type, name)], RIGHTS). Usage: build.py <dir with conf.py and tokens.txt> out.mxl
tokens.txt -> hungarian5.mxl. Line: 'P<n> <bar>: tok tok | tok' ; tok = PITCH[+PITCH]:DUR[~] or r:DUR
PITCH = step [# b n] octave (absolute, alter written out); DUR = 1 2 4 8 16 32 [.|..] [t triplet | q quintuplet | s septuplet (needs DIV a multiple of 7)]; '|' = second voice.
Optional: a DUR ending in 'g' is a grace note (slashed, takes no time; 'G' unslashed, also played before the beat: steal-time-previous 50); PICKUP (crotchets) makes bar 0 an upbeat;
ENDINGS [(first bar, last bar, '1', 'stop' or 'discontinue')] volta brackets. Passages under an 8va line are written at pitch.
MARKS [(part, bar, crotchets into the bar, kind, value)]: kind 'dyn' (p, f, ff ...), 'cresc' / 'dim' (a hairpin from there; value = where it
ends, in crotchets into the same bar), 'bow' ('down' / 'up', on the note starting there), 'fing' (the printed fingering '0'-'4' on the note starting there),
'acc' / 'stacc' (accent / staccato on the note there), 'slur' (value = (end bar, end crotchets): from this note to that one),
'harm' (value = (stopped pitch, touching pitch): an artificial harmonic's stopped note and diamond, drawn under this note, never played) (Trix: the scan's f, ff and bowings)."""
import sys, zipfile, re
from xml.sax.saxutils import escape as esc
D = sys.argv[1]; out = sys.argv[2]
TYPE = {'1': 'whole', '2': 'half', '4': 'quarter', '8': 'eighth', '16': '16th', '32': '32nd'}
C = {}; exec(open(D + '/conf.py').read(), C)
NAMES, PROG, CLEF, KEY, TEMPO, FWD, BWD, LAST = C['NAMES'], C['PROG'], C['CLEF'], C['KEY'], C['TEMPO'], C['FWD'], C['BWD'], C['LAST']
DIV = C.get('DIV', 120); BASE = {'1': DIV * 4, '2': DIV * 2, '4': DIV, '8': DIV // 2, '16': DIV // 4, '32': DIV // 8}
TIMEF = C['TIME'] if callable(C['TIME']) else (lambda b: C['TIME'])   # the time signature of bar b
bars = {}
for ln in open(D + '/tokens.txt'):
    ln = ln.split(';')[0].strip()
    if not ln: continue
    m = re.match(r'P(\d+) (\d+):(.*)', ln); bars[(int(m.group(1)), int(m.group(2)))] = m.group(3).strip()
def dur(d):
    d = d.rstrip('gG'); q = d.rstrip('.tqs'); v = BASE[q]
    if '..' in d: v = v * 7 // 4
    elif '.' in d: v = v * 3 // 2
    if 't' in d: v = v * 2 // 3
    if 'q' in d: v = v * 4 // 5
    if 's' in d: v = v * 4 // 7
    return v, TYPE[q], d.count('.'), 't' if 't' in d else 'q' if 'q' in d else 's' if 's' in d else ''
def pitch(p):
    m = re.match(r'([A-G])(##|bb|[#bn]?)(\d)$', p); assert m, p
    al = {'#': 1, 'b': -1, '##': 2, 'bb': -2}.get(m.group(2), 0)
    return '<pitch><step>%s</step>%s<octave>%s</octave></pitch>' % (m.group(1), '<alter>%d</alter>' % al if al else '', m.group(3))
bad = []; parts = []
MARKS = C.get('MARKS', [])
def marks_at(pn, b, upto):
    """the dynamics and hairpin starts/stops of part pn, bar b, due at or before `upto` divisions, each once"""
    out = ''
    for i, (mp, mb, mo, kind, val) in enumerate(MARKS):
        if mp != pn or mb != b or kind not in ('dyn', 'cresc', 'dim'): continue
        evs = [(round(mo * DIV), 'start')] + ([(round(val * DIV), 'stop')] if kind in ('cresc', 'dim') else [])
        for j, (at, what) in enumerate(evs):
            if (i, j) in DONE or at > upto: continue
            DONE.add((i, j))
            if kind == 'dyn': out += '<direction placement="below"><direction-type><dynamics><%s/></dynamics></direction-type></direction>' % val
            else: out += '<direction placement="below"><direction-type><wedge type="%s"/></direction-type></direction>' % ({'cresc': 'crescendo', 'dim': 'diminuendo'}[kind] if what == 'start' else 'stop')
    return out
DONE = set()
SLURN = {}
_open = []
for i, (mp, mb, mo, kind, val) in sorted(enumerate(MARKS), key=lambda e: (e[1][1], e[1][2])):
    if kind != 'slur': continue
    _open = [o for o in _open if (o[0], o[1]) > (mb, mo)]
    n = next(c for c in (1, 2, 3, 4) if c not in [o[2] for o in _open]); SLURN[i] = n; _open.append((val[0], val[1], n))
PICK = C.get('PICKUP'); FIRST = 0 if PICK else 1   # an upbeat: bar 0, PICKUP crotchets long, implicit
isg = lambda d: d.rstrip('~').endswith(('g', 'G'))
for pn in range(1, len(NAMES) + 1):
    ms = []; tied = set()
    for b in range(FIRST, LAST + 1):
        src = bars.get((pn, b), '')
        BEATS, BTYPE = TIMEF(b); FULL = DIV * 4 * BEATS // BTYPE; BEAT = DIV * 4 // BTYPE   # a beat in divisions (beams group by it)
        if BTYPE == 8 and BEATS % 3 == 0: BEAT = DIV * 3 // 2   # 6/8, 9/8, 12/8: beamed by the dotted crotchet (Trix: La Campanella's quavers stood alone)
        BOFF = 0   # an upbeat is the end of a bar: beams group from where the full bar would start (Trix: La Campanella's upbeat F#5 stands alone)
        if b == 0: BOFF = FULL - int(PICK * DIV); FULL = int(PICK * DIV)
        newtime = b == FIRST or TIMEF(b) != TIMEF(b - 1)
        x = '<measure number="%d"%s>' % (b, ' implicit="yes"' if b == 0 else '')
        if b in FWD: x += '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
        for e0, e1, en, et in C.get('ENDINGS', []):
            if b == e0: x += '<barline location="left"><ending number="%s" type="start"/></barline>' % en
        if b == FIRST or KEY(b) != KEY(b - 1) or newtime:
            x += '<attributes>' + ('<divisions>%d</divisions>' % DIV if b == FIRST else '') + ('<key><fifths>%d</fifths>%s</key>' % (KEY(b), '<mode>%s</mode>' % (C['MODE'](b) if callable(C['MODE']) else C['MODE']) if C.get('MODE') else '') if b == FIRST or KEY(b) != KEY(b - 1) else '')
            if newtime: x += '<time><beats>%d</beats><beat-type>%d</beat-type></time>' % (BEATS, BTYPE)
            if b == FIRST: x += '<clef><sign>%s</sign><line>%d</line></clef>' % CLEF[pn - 1]
            x += '</attributes>'
        if pn == 1 and b in TEMPO:
            x += '<direction placement="above"><direction-type><words>%s</words></direction-type><sound tempo="%d"/></direction>' % TEMPO[b]
        voices = [v.split() for v in src.split('|')] if src else [['r:%s' % {DIV * 4: '1', DIV * 2: '2', DIV * 3: '2.', DIV * 3 // 2: '4.', DIV: '4', DIV // 2: '8'}.get(FULL, '1')]]
        for vi, toks in enumerate(voices):
            if vi: x += '<backup><duration>%d</duration></backup>' % FULL
            tot = 0; tup = 0
            # beams: notes shorter than a crotchet inside one beat are beamed (level 2 for 16ths and shorter)
            info = []; pos = 0
            for t in toks:
                p_, d_ = t.split(':'); v_, wt_ = dur(d_.rstrip('~'))[:2]
                if isg(d_): v_ = 0
                info.append((pos, v_, p_ == 'r', 't' in d_, wt_)); pos += v_
            beams = [{} for _ in toks]
            grp = []
            def flush(g):
                if len(g) < 2: return
                for j, k in enumerate(g): beams[k][1] = 'begin' if j == 0 else 'end' if j == len(g) - 1 else 'continue'
                run = []
                for j, k in enumerate(g + [None]):
                    if k is not None and info[k][1] <= DIV // 4: run.append(j); continue
                    if len(run) >= 2:
                        for i2, jj in enumerate(run): beams[g[jj]][2] = 'begin' if i2 == 0 else 'end' if i2 == len(run) - 1 else 'continue'
                    elif len(run) == 1: beams[g[run[0]]][2] = 'forward hook' if run[0] == 0 else 'backward hook'
                    run = []
            for k, (st, v_, rest, trip, wt_) in enumerate(info):
                if v_ == 0: continue   # a grace note: outside the beams, and does not break them
                if rest or v_ >= DIV or wt_ in ('quarter', 'half', 'whole'): flush(grp); grp = []; continue   # a crotchet in a triplet is not beamed
                unit = DIV if trip else BEAT   # triplets beam in threes (one crotchet), other notes by the beat
                if grp and ((st + BOFF) // unit != (info[grp[0]][0] + BOFF) // unit or trip != info[grp[0]][3]): flush(grp); grp = []
                grp.append(k)
            flush(grp)
            for ti, t in enumerate(toks):
                p, d = t.split(':'); tie = d.endswith('~'); d = d.rstrip('~')
                gr = d[-1] if d[-1] in 'gG' else ''
                v, ty, dot, tm = dur(d)
                if gr: v = 0
                bow = ''; fing = ''; arts = []; sl = []; harm = None
                if vi == 0 and not gr:
                    x += marks_at(pn, b, tot)
                    bow = next((val for (mp, mb, mo, kind, val) in MARKS if kind == 'bow' and mp == pn and mb == b and round(mo * DIV) == tot and p != 'r'), '')
                    fing = next((val for (mp, mb, mo, kind, val) in MARKS if kind == 'fing' and mp == pn and mb == b and round(mo * DIV) == tot and p != 'r'), '')
                    here = [(i, kind, val) for i, (mp, mb, mo, kind, val) in enumerate(MARKS) if mp == pn and mb == b and round(mo * DIV) == tot and p != 'r']
                    arts = [{'acc': 'accent', 'stacc': 'staccato'}[kind] for i, kind, val in here if kind in ('acc', 'stacc')]
                    sl = [('stop', SLURN[i]) for i, (mp, mb, mo, kind, val) in enumerate(MARKS) if kind == 'slur' and mp == pn and val[0] == b and round(val[1] * DIV) == tot and p != 'r']
                    sl += [('start', SLURN[i]) for i, kind, val in here if kind == 'slur']
                    harm = next((val for i, kind, val in here if kind == 'harm'), None)
                tot += v
                for k, q in enumerate(p.split('+')):
                    qt = tie or q.endswith('~'); q = q.rstrip('~')
                    n = '<note>' + ('<grace%s/>' % (' slash="yes"' if gr == 'g' else ' steal-time-previous="50"') if gr else '') + ('<chord/>' if k else '') + ('<rest/>' if q == 'r' else pitch(q)) + ('<duration>%d</duration>' % v if not gr else '')
                    key = (vi, q)
                    if key in tied: n += '<tie type="stop"/>'
                    if qt: n += '<tie type="start"/>'
                    n += '<voice>%d</voice><type>%s</type>' % (vi + 1, ty) + ('<dot/>' * dot if dot else '')
                    if tm: n += '<time-modification><actual-notes>%d</actual-notes><normal-notes>%d</normal-notes></time-modification>' % {'t': (3, 2), 'q': (5, 4), 's': (7, 4)}[tm]
                    if not k and q != 'r': n += ''.join('<beam number="%d">%s</beam>' % (lv, beams[ti][lv]) for lv in (1, 2) if lv in beams[ti])
                    nt = ''
                    if tm == 't' and not k:   # a triplet: '3' over each crotchet's three (start on the first, stop on the last)
                        st_ = info[ti][0]
                        if st_ % DIV == 0: nt += '<tuplet type="start" bracket="no"/>'
                        elif (st_ + DIV // 3) % DIV == 0: nt += '<tuplet type="stop"/>'
                    if not k: nt += ''.join('<slur type="%s" number="%d"/>' % x for x in sl)
                    if (bow or fing) and not k: nt += '<technical>%s%s</technical>' % ('<%s-bow/>' % bow if bow else '', '<fingering>%s</fingering>' % fing if fing else '')
                    if arts and not k: nt += '<articulations>%s</articulations>' % ''.join('<%s/>' % a for a in arts)
                    if key in tied: nt += '<tied type="stop"/>'
                    if qt: nt += '<tied type="start"/>'
                    if nt: n += '<notations>%s</notations>' % nt
                    x += n + '</note>'
                    if harm and k == len(p.split('+')) - 1:   # the harmonic's stopped note and touching note, as chord notes the app draws but never plays
                        for hp, touch in ((harm[0], False), (harm[1], True)):
                            x += ('<note><chord/>' + pitch(hp) + '<duration>%d</duration><voice>%d</voice><type>%s</type>' % (v, vi + 1, ty) + ('<dot/>' * dot if dot else '')
                                  + ('<time-modification><actual-notes>%d</actual-notes><normal-notes>%d</normal-notes></time-modification>' % {'t': (3, 2), 'q': (5, 4), 's': (7, 4)}[tm] if tm else '')
                                  + ('<notehead>diamond</notehead>' if touch else '')
                                  + '<notations><technical><harmonic><artificial/><%s/></harmonic></technical></notations></note>' % ('touching-pitch' if touch else 'base-pitch'))
                for q in p.split('+'):
                    qt = tie or q.endswith('~'); q = q.rstrip('~')
                    tied.discard((vi, q))
                    if qt: tied.add((vi, q))
            if vi == 0: x += marks_at(pn, b, FULL + 1)   # hairpins ending at the barline
            if tot != FULL: bad.append('P%d b%d voice %d: %s beats' % (pn, b, vi + 1, tot / DIV))
        ends = [(en, et) for e0, e1, en, et in C.get('ENDINGS', []) if b == e1]
        ending = ''.join('<ending number="%s" type="%s"/>' % e for e in ends)
        if b in BWD: x += '<barline location="right"><bar-style>light-heavy</bar-style>%s<repeat direction="backward"/></barline>' % ending
        elif b == LAST: x += '<barline location="right"><bar-style>light-heavy</bar-style>%s</barline>' % ending
        elif ending: x += '<barline location="right">%s</barline>' % ending
        ms.append(x + '</measure>')
    parts.append('<part id="P%d">%s</part>' % (pn, ''.join(ms)))
pl = ''.join('<score-part id="P%d"><part-name>%s</part-name><midi-instrument id="P%d-I1"><midi-channel>%d</midi-channel><midi-program>%d</midi-program></midi-instrument></score-part>' % (i + 1, NAMES[i], i + 1, i + 1 if i < 9 else i + 2, PROG[i]) for i in range(len(NAMES)))   # channel 10 is percussion: skipped
ident = '<identification><creator type="composer">%s</creator>%s<rights>%s</rights></identification>' % (esc(C['COMPOSER']), ''.join('<creator type="%s">%s</creator>' % (t[0], esc(t[1])) for t in C.get('EXTRA_CREATORS', [])), esc(C['RIGHTS']))
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>%s</work-title></work>' % esc(C['TITLE']) + ident +
       '<part-list>' + pl + '</part-list>' + ''.join(parts) + '</score-partwise>')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    zo.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>')
    zo.writestr('score.xml', xml)
print(out, 'bad bars:', len(bad)); print('\n'.join(bad[:400]))
