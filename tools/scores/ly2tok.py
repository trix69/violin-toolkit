"""A small LilyPond reader for Mutopia parts -> token lines for mendelssohn/build.py (Trix, 2026-11-13: python-ly mis-bars
the Tchaikovsky parts). Handles \\relative, english/dutch note names, chords < >, durations and dots, ties, rests (r, R, s),
\\times / \\tuplet 3/2 (triplets), R1*n; drops \\grace and \\appoggiatura notes (their time is taken from the main note in
LilyPond, so the bar still adds up), markups, dynamics, articulations, slurs, beams, \\set/\\tempo/\\clef/\\key.
Usage: ly2tok.py file.ly VARIABLE PART_NO FIRST_BAR LAST_BAR [renumber_from]  (time signature 4/4 assumed unless TIME=n/d)"""
import sys, re, os
src, var, pno, b0, b1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
ren = int(sys.argv[6]) if len(sys.argv) > 6 else b0
num, den = map(int, os.environ.get('TIME', '4/4').split('/'))
BAR = num * 4 / den   # crotchets
s = open(src).read()
m = re.search(re.escape(var) + r'\s*=\s*\\relative\s+([a-g][a-z]*[\',]*)\s*\{', s)
ABS = m is None   # absolute pitches (Beethoven's parts): c = C3, c' = C4
if ABS: m = re.search(re.escape(var) + r'\s*=\s*()\{', s)
start = m.end(); depth = 1; i = start
while depth: depth += {'{': 1, '}': -1}.get(s[i], 0); i += 1
body = s[start:i - 1]; ref0 = m.group(1)
body = re.sub(r'%.*', '', body)
body = re.sub(r'\\[<>!]', '', body)   # hairpins
body = re.sub(r'<<\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\\\\\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*>>', r' \1 ', body)   # two voices: the upper one
body = re.sub(r'\\markup\s*\{(?:[^{}]|\{[^{}]*\})*\}', '', body)
body = re.sub(r'\\(set|override|once)\s+[^\n]*', '', body)
body = re.sub(r'\\tempo\s+"[^"]*"\s*(\d+\s*=\s*\d+)?', '', body)
body = re.sub(r'\\(clef|key|time)\s+("[^"]*"|\S+)(\s+\\(major|minor))?', '', body)
# grace notes are not played here, but they still move the \\relative reference: kept, marked with '@'
body = re.sub(r'\\grace\s*\{([^}]*)\}', lambda m: ' '.join('@' + w for w in re.findall(r"[a-g][a-z]*[',]*", m.group(1))), body)
body = re.sub(r'\\(appoggiatura|acciaccatura|grace)\s+([a-g][a-z]*[\',]*)\S*', r'@\2', body)
body = re.sub(r'[_^-]?\\(?!times|tuplet)[a-zA-Z]+', '', body)      # dynamics, articulations, fermata, downbow ...
body = re.sub(r'[_^-][.>!\-+|_^]', '', body)
body = body.replace('(', ' ').replace(')', ' ').replace('[', ' ').replace(']', ' ').replace('|', ' ')
STEP = 'cdefgab'
def name2(tok):
    m = re.match(r"([a-g])((?:sharp|flat|is|es|s|f)*)([',]*)(!?)$", tok)
    if not m: return None
    acc = m.group(2); a = 0
    for x in re.findall(r'sharp|flat|is|es|s|f', acc): a += 1 if x in ('sharp', 'is', 's') else -1
    return m.group(1), a, m.group(3).count("'") - m.group(3).count(',')
def rel(prev, nm):   # prev: (step index, octave) absolute; nm: (letter, alter, marks)
    l, a, marks = nm; si = STEP.index(l); ps, po = prev
    if ABS: return (si, 2 + marks), a
    best = None
    for o in (po - 1, po, po + 1):
        d = (o * 7 + si) - (po * 7 + ps)
        if abs(d) <= 3 and (best is None or abs(d) < abs(best[1])): best = (o, d)
    o = best[0] + marks
    return (si, o), a
r0 = name2(ref0) if not ABS else ('c', 0, 0); ref = (STEP.index(r0[0]), 2 + r0[2])   # \relative c' = C4 (octave index 3 prints as 4); 'c' alone = C3
toks = re.findall(r"@[a-g][a-z]*[',]*|\\times\s*\d+/\d+|\\tuplet\s*\d+/\d+|<|>[0-9.~]*|\{|\}|[a-gsrR][a-z]*[',]*!?\??(?:\d+\.*)?(?:\*\d+)?~?|~", body)
out = []; cur_dur = 1.0; trip = 0; stack = []; tie_pend = False; chord = None
def pitch(si, o, a):
    return 'CDEFGAB'[si] + {1: '#', -1: 'b', 2: '##', -2: 'bb', 0: ''}[a] + str(o + 1)
def dur_of(dstr, dots):
    v = 4 / int(dstr); dd = v
    for _ in range(dots): dd /= 2; v += dd
    return v
def tokdur(beats, t):
    base = beats * (1.5 if t else 1)
    for q, nm in ((4, '1'), (2, '2'), (1, '4'), (0.5, '8'), (0.25, '16'), (0.125, '32')):
        for dots, f in ((0, 1), (1, 1.5), (2, 1.75)):
            if abs(base - q * f) < 1e-6: return nm + '.' * dots + ('t' if t else '')
    raise ValueError(beats)
events = []   # (beats, token)
i = 0
while i < len(toks):
    t = toks[i]
    if t.startswith('\\times') or t.startswith('\\tuplet'):
        fr = re.findall(r'\d+', t); trip_now = (fr == ['2', '3'] or fr == ['3', '2']); stack.append(trip_now); i += 1
        if i < len(toks) and toks[i] == '{': i += 1
        trip = any(stack); continue
    if t == '{': stack.append(False); i += 1; continue
    if t == '}':
        if stack: stack.pop()
        trip = any(stack); i += 1; continue
    if t == '<':
        notes = []; i += 1; cref = ref; first = None
        while not toks[i].startswith('>'):
            nm = name2(re.sub(r'[~!?]', '', toks[i]))
            if nm: cref, a = rel(cref, nm); notes.append(pitch(cref[0], cref[1], a)); first = first or cref
            i += 1
        m2 = re.match(r'>(\d+)?(\.*)(~)?', toks[i]); i += 1
        if m2.group(1): cur_dur = dur_of(m2.group(1), len(m2.group(2)))
        elif m2.group(2): cur_dur = cur_dur
        ref = first or ref
        b = cur_dur * (2 / 3 if trip else 1)
        events.append((b, '+'.join(notes) + ':' + tokdur(b, trip) + ('~' if m2.group(3) else ''))); continue
    if t.startswith('@'):   # a grace note: reference only
        nm = name2(t[1:])
        if nm: ref, _ = rel(ref, nm)
        i += 1; continue
    if t == '~':
        if events: events[-1] = (events[-1][0], events[-1][1] + '~')
        i += 1; continue
    m = re.match(r"([a-gsrR][a-z]*[',]*!?\??)(\d+)?(\.*)(?:\*(\d+))?(~)?$", t)
    if not m: i += 1; continue
    word, dstr, dots, mult, tie = m.groups()
    if dstr: cur_dur = dur_of(dstr, len(dots))
    if word in ('r', 's', 'R'):
        n = int(mult or 1); b = cur_dur * (2 / 3 if trip else 1)
        for _ in range(n): events.append((b, 'r:' + tokdur(b, trip) if b <= 4 else 'r:1'))
        i += 1; continue
    nm = name2(re.sub(r'[!?]', '', word))
    if not nm: i += 1; continue
    ref, a = rel(ref, nm)
    b = cur_dur * (2 / 3 if trip else 1)
    events.append((b, pitch(ref[0], ref[1], a) + ':' + tokdur(b, trip) + ('~' if tie else '')))
    i += 1
# pour into bars (a note crossing a bar line is split with a tie)
bars = [[]]; pos = 0.0
for b, tk in events:
    if pos >= BAR - 1e-6:
        if len(bars) >= b1: break   # past the bars wanted
        bars.append([]); pos = 0.0
    if pos + b > BAR + 1e-6:
        raise SystemExit('a note crosses bar %d: %s (pos %.3f)' % (len(bars), tk, pos))
    bars[-1].append(tk); pos += b
for k in range(b0, b1 + 1):
    if k - 1 < len(bars): print('P%d %d: %s' % (pno, k - b0 + ren, ' '.join(bars[k - 1])))
