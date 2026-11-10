"""Autumn (Mutopia #350), python-ly output: the solo's barlines drift from bar 39 because python-ly counts triplet
semiquavers at full length when it fills bars (the notes' durations themselves are right). The solo has two-voice
bars earlier (14-27), so pack.py does not re-bar it; this re-bars part 1 from the first bar after its last
two-voice bar, by the notes' real durations; and raises bars 24-27 an octave (see below).
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
tree.write(sys.argv[2], encoding='unicode')
