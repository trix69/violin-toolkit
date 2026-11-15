"""The pitches of a MusicXML part against the edition's MIDI, bar by bar (multisets of MIDI note numbers; graces and tied
continuations left out on the MusicXML side). Prints the bars that differ. Usage: pitchcheck.py file.musicxml file.mid [upbeat crotchets]"""
import sys, collections
import xml.etree.ElementTree as ET
sys.path.insert(0, __import__('os').path.dirname(__file__))
x, mid = sys.argv[1], sys.argv[2]; pick = float(sys.argv[3]) if len(sys.argv) > 3 else 0
S = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
r = ET.parse(x).getroot(); xb = {}; beats = None
for i, m in enumerate(r.find('part').findall('measure'), 1):
    t = m.find('attributes/time')
    if t is not None: beats = int(t.findtext('beats')) * 4 / int(t.findtext('beat-type'))
    c = collections.Counter()
    for n in m.findall('note'):
        p = n.find('pitch')
        if p is None or n.find('grace') is not None or any(tt.get('type') == 'stop' for tt in n.findall('tie')): continue
        c[12 * (int(p.findtext('octave')) + 1) + S[p.findtext('step')] + int(float(p.findtext('alter') or 0))] += 1
    xb[i] = c
# the MIDI's note-ons, as midicount.py reads them
data = open(mid, 'rb').read(); tpq = int.from_bytes(data[12:14], 'big'); ntrk = int.from_bytes(data[10:12], 'big')
def varlen(b, i):
    v = 0
    while True:
        c = b[i]; i += 1; v = (v << 7) | (c & 0x7f)
        if not c & 0x80: return v, i
i = 14; notes = []
for _ in range(ntrk):
    ln = int.from_bytes(data[i + 4:i + 8], 'big'); j = i + 8; end = j + ln; t = 0; run = 0
    while j < end:
        d, j = varlen(data, j); t += d; st = data[j]
        if st == 0xff: l2, k = varlen(data, j + 2); j = k + l2; continue
        if st in (0xf0, 0xf7): l2, k = varlen(data, j + 1); j = k + l2; continue
        if st & 0x80: run = st; j += 1
        hi = run & 0xf0
        if hi in (0xc0, 0xd0): j += 1; continue
        a, b = data[j], data[j + 1]; j += 2
        if hi == 0x90 and b > 0: notes.append((t, a))
    i = end
bar = beats * tpq; shift = (beats - pick) * tpq if pick else 0; mb = collections.defaultdict(collections.Counter)
for t, a in notes: mb[int((t + shift) // bar) + 1][a] += 1
bad = []
for k in sorted(set(xb) | set(mb)):
    if xb.get(k, collections.Counter()) != mb.get(k, collections.Counter()):
        extra = xb.get(k, collections.Counter()) - mb.get(k, collections.Counter()); miss = mb.get(k, collections.Counter()) - xb.get(k, collections.Counter())
        bad.append((k, dict(extra), dict(miss)))
print('bars whose pitches differ:', len(bad))
for b in bad[:20]: print('  bar', b[0], 'only in MusicXML', b[1], '| only in MIDI', b[2])
