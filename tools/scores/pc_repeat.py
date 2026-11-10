"""Por una Cabeza: add the edition's repeat to a packed .mxl (python-ly mishandles \\alternative, so pc_ly.py writes
the bars straight through): forward repeat at bar 1 (after the pickup, bar 0), 1st ending = bar 32 with the
backward repeat, 2nd ending = bar 33, final barline; the key change to A minor at bar 17 (and back to A major
at bar 1 for the repeat). Every part. Usage: pc_repeat.py in.mxl out.mxl"""
import sys, zipfile, io
import xml.etree.ElementTree as ET

zin = zipfile.ZipFile(sys.argv[1])
name = next(n for n in zin.namelist() if n.endswith('.xml') and not n.startswith('META-INF'))
root = ET.fromstring(zin.read(name))


def bar(m, loc, style=None, repeat=None, ending=None):
    b = ET.Element('barline', location=loc)
    if style: ET.SubElement(b, 'bar-style').text = style
    if ending: ET.SubElement(b, 'ending', number=ending[0], type=ending[1])
    if repeat: ET.SubElement(b, 'repeat', direction=repeat)
    for old in m.findall('barline'):
        if old.get('location', 'right') == loc: m.remove(old)
    if loc == 'left':
        at = next((i for i, e in enumerate(m) if e.tag in ('note', 'direction', 'forward', 'backup')), len(m))
        m.insert(at, b)
    else: m.append(b)


for p in root.findall('part'):
    ms = {m.get('number'): m for m in p.findall('measure')}
    assert '0' in ms and '33' in ms and len(ms) == 34, sorted(ms, key=int)[:3]
    # the refrain in A minor (bar 17); the verse's A major comes back with the repeat at bar 1
    for num, fifths, mode in (('17', '0', 'minor'), ('1', '3', 'major')):
        at = ET.Element('attributes'); k = ET.SubElement(at, 'key')
        ET.SubElement(k, 'fifths').text = fifths; ET.SubElement(k, 'mode').text = mode
        m = ms[num]; m.insert(next((i for i, e in enumerate(m) if e.tag in ('note', 'direction', 'forward', 'backup')), len(m)), at)
    bar(ms['1'], 'left', 'heavy-light', 'forward')
    bar(ms['32'], 'left', None, None, ('1', 'start'))
    bar(ms['32'], 'right', 'light-heavy', 'backward', ('1', 'stop'))
    bar(ms['33'], 'left', None, None, ('2', 'start'))
    bar(ms['33'], 'right', 'light-heavy', None, ('2', 'discontinue'))
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in zin.namelist():
        z.writestr(n, ET.tostring(root, encoding='unicode').encode() if n == name else zin.read(n))
open(sys.argv[2], 'wb').write(out.getvalue())
print('repeat added:', len(root.findall('part')), 'parts')
