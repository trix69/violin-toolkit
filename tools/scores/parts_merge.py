"""Put single-part MusicXML files (from ly2xml.py, one per staff) together as one score: common <divisions>, parts P1..Pn
in the order given, each named as its file's part. All files must have the same bars.
Usage: parts_merge.py out.musicxml solo.musicxml acc1.musicxml [acc2.musicxml ...]"""
import math, sys
import xml.etree.ElementTree as ET
out, srcs = sys.argv[1], sys.argv[2:]
roots = [ET.parse(f).getroot() for f in srcs]
divs = [int(r.find('part/measure/attributes/divisions').text) for r in roots]
L = 1
for d in divs: L = L * d // math.gcd(L, d)
n0 = len(roots[0].findall('part/measure'))
base = roots[0]
pl = base.find('part-list')
for k, (r, d) in enumerate(zip(roots, divs)):
    part = r.find('part'); f = L // d
    ms = part.findall('measure')
    if len(ms) != n0: sys.exit('%s: %d bars, the first file has %d' % (srcs[k], len(ms), n0))
    for el in part.iter():
        if el.tag in ('note', 'backup', 'forward') and el.find('duration') is not None:
            el.find('duration').text = str(int(el.find('duration').text) * f)
        if el.tag == 'divisions': el.text = str(L)
    pid = 'P%d' % (k + 1)
    part.set('id', pid)
    if k:
        sp = r.find('part-list/score-part'); sp.set('id', pid); pl.append(sp); base.append(part)
    else:
        base.find('part-list/score-part').set('id', pid)
ET.ElementTree(base).write(out, encoding='unicode')
print(out, len(roots), 'parts,', n0, 'bars, divisions', L)
