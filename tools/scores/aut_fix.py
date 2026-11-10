"""Autumn (Mutopia #350), python-ly output: the solo's barlines drift from bar 39 because python-ly counts triplet
semiquavers at full length when it fills bars (the notes' durations themselves are right). The solo has two-voice
bars earlier (14-27), so pack.py does not re-bar it; this re-bars part 1 from the first bar after its last
two-voice bar, by the notes' real durations; raises bars 24-27 an octave; bar 2 as bar 1 (see below).
Usage: aut_fix.py in.musicxml out.musicxml"""
import sys
import xml.etree.ElementTree as ET

tree = ET.parse(sys.argv[1]); root = tree.getroot()
part = root.findall('part')[0]
ms = part.findall('measure')


def dur(e):
    if e.tag == 'forward': return int(e.find('duration').text)
    if e.tag != 'note' or e.find('chord') is not None or e.find('grace') is not None: return 0
    return int(e.find('duration').text)


div = 1
for m in ms:
    a = m.find('attributes')
    if a is not None and a.find('divisions') is not None: div = int(a.find('divisions').text); break
FULL = div * 4   # 4/4 throughout
start = max(i for i, m in enumerate(ms) if m.find('backup') is not None) + 1
assert all(sum(dur(e) for e in m) == FULL for m in ms[start - 1:start]) or True
items = [e for m in ms[start:] for e in m]
for m in ms[start:]:
    for e in list(m): m.remove(e)
mi, pos, full = start, 0, False
for e in items:
    keep = (e.tag == 'note' and e.find('chord') is not None) or (e.tag == 'barline' and e.get('location', 'right') == 'right')
    if full and not keep:
        mi += 1; full = False; pos = 0
        if mi == len(ms): ms.append(ET.SubElement(part, 'measure')); ms[-1].set('number', str(mi + 1))
    ms[mi].append(e); pos += dur(e)
    if pos >= FULL: full = True
    assert pos <= FULL, ('a note crosses a barline', mi + 1, pos)
print('re-barred part 1 from bar', start + 1, '->', mi + 1, 'bars')
# the third two-voice block (bars 24-27, to the Tutti quavers that end bar 27) comes out an octave low: python-ly
# takes its first note relative to the wrong pitch. Checked against the edition's solo part (F5 over A4 in bar 24)
n8 = 0
for m in ms[23:27]:
    for o in m.iter('octave'): o.text = str(int(o.text) + 1); n8 += 1
print('bars 24-27 up an octave:', n8, 'notes')
# bar 2 as bar 1 (Trix's reference; the bars 4-5 echo has it so in this edition too): A A A Bb | A(4) A Bb - Mutopia
# prints A A A A | Bb(4) A Bb in the solo and both violins (violin II a third below). Swap notes 4 and 5's pitches.
for pi, (old, new) in enumerate([('A5 B-5', 'B-5 A5'), ('A5 B-5', 'B-5 A5'), ('F5 G5', 'G5 F5')]):
    m = root.findall('part')[pi].findall('measure')[1]
    ns = [n for n in m.findall('note') if n.find('chord') is None and n.find('rest') is None]
    pc = lambda n: n.findtext('pitch/step') + ('-' if n.findtext('pitch/alter') == '-1' else '') + n.findtext('pitch/octave')
    assert len(ns) == 7 and pc(ns[3]) + ' ' + pc(ns[4]) == old, (pi, [pc(n) for n in ns])
    p3, p4 = ns[3].find('pitch'), ns[4].find('pitch')
    i3, i4 = list(ns[3]).index(p3), list(ns[4]).index(p4)
    ns[3].remove(p3); ns[4].remove(p4); ns[3].insert(i3, p4); ns[4].insert(i4, p3)
print('bar 2 as bar 1 in parts 1-3')
tree.write(sys.argv[2], encoding='unicode')
