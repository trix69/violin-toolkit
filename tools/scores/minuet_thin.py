"""Petzold Minuets: the keyboard chord G4 over D4 + B3 (B-flat 3 in bar 65) in bars 32, 65 and 97 cannot be played on the
violin (D4 and B3 both fall on the G string, neither open; Hermes F121). Trix chose to drop the D4, leaving G4 + B3 (a sixth on
the D and G strings). Run after minuet_pair.py and minuet_grace.py. Usage: python3 -I minuet_thin.py minuets.mxl"""
import sys, zipfile, xml.etree.ElementTree as ET

path = sys.argv[1]
z = zipfile.ZipFile(path); names = z.namelist()
name = [n for n in names if not n.startswith('META-INF')][0]
files = {n: z.read(n) for n in names}; z.close()
root = ET.fromstring(files[name])
STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(n):
    p = n.find('pitch')
    if p is None: return None
    return 12 * (int(p.findtext('octave')) + 1) + STEP[p.findtext('step')] + round(float(p.findtext('alter') or 0))


dropped = []
part = root.find('part')
for m in part.findall('measure'):
    pos, last, ev = 0, 0, {}
    kids = list(m)
    for el in kids:
        if el.tag == 'backup': pos -= int(el.findtext('duration')); continue
        if el.tag == 'forward': pos += int(el.findtext('duration')); continue
        if el.tag != 'note' or el.find('grace') is not None: continue
        at = last if el.find('chord') is not None else pos
        if el.find('chord') is None: last = pos; pos += int(el.findtext('duration'))
        ev.setdefault(at, []).append(el)
    for at, ns in ev.items():
        ms = [midi(n) for n in ns]
        if 67 in ms and 62 in ms and (59 in ms or 58 in ms) and len(ms) == 3:
            d4 = ns[ms.index(62)]
            i = kids.index(d4)
            if d4.find('chord') is None and i + 1 < len(kids) and kids[i + 1].tag == 'note' and kids[i + 1].find('chord') is not None:
                kids[i + 1].remove(kids[i + 1].find('chord'))   # the chord's next note becomes its head
            m.remove(d4); dropped.append(m.get('number'))
assert len(dropped) == 3, dropped
x = '<?xml version="1.0" encoding="UTF-8"?>' + ET.tostring(root, encoding='unicode')
with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as w:
    for n in names: w.writestr(n, x if n == name else files[n])
print(path, 'D4 dropped in measures', dropped)
