"""Winter, 2nd movement (Largo): the two ripieno violins play pizzicato throughout ('Largo e Pizziccati forte', the rain);
the edition says so only in words, so a <sound pizzicato="yes"/> goes at the start of parts 2 and 3 (Trix, 2026-11-12).
Usage: python3 -I win2_pizz.py in.mxl out.mxl"""
import sys, zipfile, xml.etree.ElementTree as ET
src, out = sys.argv[1:3]
zin = zipfile.ZipFile(src)
name = [n for n in zin.namelist() if not n.startswith('META-INF')][0]
root = ET.fromstring(zin.read(name))
parts = root.findall('part')
names = {sp.get('id'): sp.findtext('part-name') for sp in root.iter('score-part')}
done = 0
for p in parts:
    if names.get(p.get('id')) not in ('Ripieno 1', 'Ripieno 2'): continue
    m = p.find('measure')
    d = ET.Element('direction', {'placement': 'above'})
    dt = ET.SubElement(d, 'direction-type'); w = ET.SubElement(dt, 'words'); w.text = 'pizz.'
    ET.SubElement(d, 'sound', {'pizzicato': 'yes'})
    first = m.find('note'); m.insert(list(m).index(first), d); done += 1
assert done == 2, done
xml = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode').encode('utf-8')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n in zin.namelist(): zo.writestr(n, xml if n == name else zin.read(n))
print(out, 'pizzicato on', done, 'parts')
