"""Count the note-ons in a standard MIDI file (all tracks, velocity > 0), and list the onsets per bar for a given
time signature, so a conversion can be checked against the edition's own MIDI. Usage: midicount.py file.mid [crotchets per bar [upbeat crotchets]]"""
import sys

def varlen(b, i):
    v = 0
    while True:
        c = b[i]; i += 1; v = (v << 7) | (c & 0x7f)
        if not c & 0x80: return v, i

data = open(sys.argv[1], 'rb').read()
assert data[:4] == b'MThd'
ntrk, tpq = int.from_bytes(data[10:12], 'big'), int.from_bytes(data[12:14], 'big')
i = 14; notes = []
for _ in range(ntrk):
    assert data[i:i + 4] == b'MTrk'; ln = int.from_bytes(data[i + 4:i + 8], 'big'); j = i + 8; end = j + ln; t = 0; run = 0
    while j < end:
        d, j = varlen(data, j); t += d
        st = data[j]
        if st == 0xff: ln2, k = varlen(data, j + 2); j = k + ln2; continue
        if st in (0xf0, 0xf7): ln2, k = varlen(data, j + 1); j = k + ln2; continue
        if st & 0x80: run = st; j += 1
        hi = run & 0xf0
        if hi in (0xc0, 0xd0): j += 1; continue
        a, b = data[j], data[j + 1]; j += 2
        if hi == 0x90 and b > 0: notes.append((t, a))
    i = end
print(len(notes), 'notes', 'tpq', tpq)
if len(sys.argv) > 2:
    bar = float(sys.argv[2]) * tpq; per = {}
    shift = (float(sys.argv[2]) - float(sys.argv[3])) * tpq if len(sys.argv) > 3 and float(sys.argv[3]) else 0   # an upbeat of argv[3] crotchets: it is bar 1
    for t, a in notes: k = int((t + shift) // bar) + 1; per[k] = per.get(k, 0) + 1
    print(' '.join('%d:%d' % kv for kv in sorted(per.items())))
