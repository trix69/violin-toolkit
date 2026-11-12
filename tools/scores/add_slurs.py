"""Simple violin slurs for a keyboard melody (Trix, 2026-11-13): in part P1, two quavers on the same crotchet beat that
move by step (1-2 semitones) get one slur. Our own markings, not copied from any edition. Usage: add_slurs.py file.mxl"""
import sys, zipfile, xml.etree.ElementTree as ET
p = sys.argv[1]; z = zipfile.ZipFile(p); items = {n: z.read(n) for n in z.namelist()}; z.close()
r = ET.fromstring(items['score.xml']); part = r.find('part'); div = 1; added = 0
STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(n):
    q = n.find('pitch'); return 12 * (int(q.findtext('octave')) + 1) + STEP[q.findtext('step')] + int(float(q.findtext('alter') or 0))
for m in part.findall('measure'):
    a = m.find('attributes/divisions')
    if a is not None: div = int(a.text)
    t = 0; ev = []
    for n in m:
        if n.tag == 'backup': break   # first voice only
        if n.tag != 'note' or n.find('grace') is not None: continue
        if n.find('chord') is not None: continue
        d = int(n.findtext('duration')); ev.append((t, d, n)); t += d
    for (t1, d1, a1), (t2, d2, a2) in zip(ev, ev[1:]):
        if d1 * 2 != div or d2 * 2 != div or t1 % div or t2 != t1 + d1: continue
        if a1.find('rest') is not None or a2.find('rest') is not None: continue
        if a1.find('.//slur') is not None or a2.find('.//slur') is not None or a1.find('tie') is not None: continue
        if not 1 <= abs(midi(a1) - midi(a2)) <= 2: continue
        for n, ty in ((a1, 'start'), (a2, 'stop')):
            no = n.find('notations')
            if no is None: no = ET.SubElement(n, 'notations')
            ET.SubElement(no, 'slur', {'type': ty, 'number': '1'})
        added += 1
items['score.xml'] = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(r, encoding='unicode').encode()
with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n, b in items.items(): zo.writestr(n, b)
print(p, added, 'slurs')
