"""Ave Maria (Bach-Gounod, Mutopia #2167): python-ly drops the \\alternative markup, so bars 37 and 38 (the two endings)
played on every pass and the repeat sign sat on bar 39 (Hermes F117). Every part: bar 37 = 1st ending + the repeat back,
bar 38 = 2nd ending, bar 39 loses its repeat and its final-style barline.
Usage: gounod_endings.py in.mxl out.mxl"""
import sys, zipfile
import xml.etree.ElementTree as ET
src, out = sys.argv[1:3]
z = zipfile.ZipFile(src); name = next(n for n in z.namelist() if not n.startswith('META-INF'))
cont = z.read('META-INF/container.xml'); root = ET.fromstring(z.read(name))
for part in root.findall('part'):
    ms = {m.get('number'): m for m in part.findall('measure')}
    m39 = ms['39']
    for b in m39.findall('barline'):
        if b.find('repeat') is not None: m39.remove(b)
    for num, n, rep in (('37', '1', True), ('38', '2', False)):
        m = ms[num]
        for b in m.findall('barline'): m.remove(b)
        left = ET.Element('barline', location='left'); ET.SubElement(left, 'ending', number=n, type='start').text = n + '.'
        m.insert(0, left)
        right = ET.SubElement(m, 'barline', location='right')
        if rep: ET.SubElement(right, 'bar-style').text = 'light-heavy'
        ET.SubElement(right, 'ending', number=n, type='stop')
        if rep: ET.SubElement(right, 'repeat', direction='backward')
x = '<?xml version="1.0" encoding="UTF-8"?>' + ET.tostring(root, encoding='unicode')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as w:
    w.writestr('META-INF/container.xml', cont); w.writestr(name, x)
print(out, 'endings at bars 37-38')
