"""In the Hall of the Mountain King: the violin line from Mutopia #1888 (piano, Public Domain): the right hand's top
*sounding* line (an inner note starting under a held melody note stays in the piano: bars 29, 33, 37, 41, 45 ended
their phrase with the inner voice's note before), each bar raised by octaves into the violin's range; the rest of
both hands = Piano. Writes MIDI (kept under the name mountain_king.mxl for the phone apps).
Usage: mk_arr.py Dans_l_antre_du_roi_de_la_montagne.mid out.mid  (midi_tools.py on sys.path)"""
import sys
import midi_tools as m


def soprano(notes):
    """notes [(s, e, p, v, ch)] -> (top line, the rest)"""
    top, rest = [], []
    by = {}
    for n in notes: by.setdefault(n[0], []).append(n)
    for s in sorted(by):
        grp = sorted(by[s], key=lambda n: -n[2])
        held = top[-1] if top and top[-1][1] > s else None   # the melody note before, with its own end
        if held and held[2] > grp[0][2]: rest += grp; continue   # under a held melody note: inner voice
        top.append(grp[0]); rest += grp[1:]
    out = []
    for i, (s, e, p, v, ch) in enumerate(top):   # one line: a note ends when the next starts
        out.append((s, min(e, top[i + 1][0]) if i + 1 < len(top) else e, p, v, ch))
    return out, rest



tpq, te, ts, key, tr = m.read(sys.argv[1])
rh = [t for t in tr if t['name'].startswith('right')][0]['notes']
lh = [t for t in tr if t['name'].startswith('left')][0]['notes']
mel, rest = soprano(rh)
bar = tpq * 4
bars = {}
for n in mel:
    bars.setdefault(n[0] // bar, []).append(n)
vio = []
for b in sorted(bars):
    ns = bars[b]
    sh = 0
    while min(n[2] for n in ns) + sh < 55:
        sh += 12
    while max(n[2] for n in ns) + sh > 93 and min(n[2] for n in ns) + sh - 12 >= 55:   # stay on the fingerboard the app shows (E string up to ~A6)
        sh -= 12
    vio += [(s, e, p + sh, v) for s, e, p, v, c in ns]
m.write(sys.argv[2], tpq, te, ts, key, [
    {'name': 'Violin', 'program': 40, 'ch': 0, 'notes': vio},
    {'name': 'Piano', 'program': 0, 'ch': 1, 'notes': [(s, e, p, v) for s, e, p, v, c in rest + lh]},
], texts=['Edvard Grieg, In the Hall of the Mountain King (Peer Gynt, Op. 46). From the Mutopia Project edition #1888 (Public Domain); violin line arranged by Violin Toolkit.'])
print('violin notes', len(vio))
