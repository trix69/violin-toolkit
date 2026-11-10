"""Ode to Joy: the violin line from Mutopia #528 (SATB, Public Domain; its 'upper' staff holds soprano + alto).
The soprano is the top *sounding* line: a note that starts while a higher soprano note is still held is the alto's
(the first version took the highest note at each onset, so the alto's passing notes under a held soprano note -
bar 2's A at beat 1.5, bar 8's F# - leaked into the violin part). Everything else is the accompaniment.
Writes MIDI (the built-in keeps the name ode.mxl for the phone apps; see docs/score-credits.md).
Usage: ode_arr.py mutopia-ode.mid out.mid  (needs midi_tools.py from the conversion workspace on sys.path)"""
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
up = [t for t in tr if t['name'] == 'upper'][0]['notes']
low = [t for t in tr if t['name'] == 'lower'][0]['notes']
sop, alto = soprano(up)
m.write(sys.argv[2], tpq, te, ts, key, [
    {'name': 'Violin', 'program': 40, 'ch': 0, 'notes': [(s, e, p, v) for s, e, p, v, c in sop]},
    {'name': 'Strings', 'program': 48, 'ch': 1, 'notes': [(s, e, p, v) for s, e, p, v, c in alto + low]},
], texts=['Ludwig van Beethoven, Ode to Joy (Symphony No. 9). From the Mutopia Project edition #528 (Public Domain); violin line arranged by Violin Toolkit.'])
print('violin notes', len(sop), 'accompaniment', len(alto) + len(low))
