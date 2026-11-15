"""Winter, 2nd movement: the final chord shortened (Trix: the ending note was too long). In the last bar every part's
whole note (with its fermata, ties kept) becomes a crotchet, followed by a minim-dotted rest; the player still holds the
fermata a little. Usage: python3 -I win2_end.py in.mxl out.mxl"""
import sys, zipfile, copy, xml.etree.ElementTree as ET
src, out = sys.argv[1:3]
z = zipfile.ZipFile(src); name = [n for n in z.namelist() if not n.startswith('META-INF')][0]
root = ET.fromstring(z.read(name)); done = 0
for part in root.findall('part'):
    m = part.findall('measure')[-1]
    notes = [n for n in m.findall('note')]
    first = [n for n in notes if n.find('chord') is None]
    assert len(first) == 1 and first[0].findtext('type') == 'whole', (part.get('id'), [n.findtext('type') for n in notes])
    full = int(first[0].findtext('duration')); q = full // 4
    for n in notes:
        n.find('duration').text = str(q); n.find('type').text = 'quarter'
    rest = ET.Element('note'); ET.SubElement(rest, 'rest'); ET.SubElement(rest, 'duration').text = str(full - q)
    v = first[0].findtext('voice'); ET.SubElement(rest, 'voice').text = v or '1'; ET.SubElement(rest, 'type').text = 'half'; ET.SubElement(rest, 'dot')
    idx = list(m).index(notes[-1]) + 1; m.insert(idx, rest); done += 1
data = ET.tostring(root, encoding='unicode')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n in z.namelist():
        zo.writestr(n, ('<?xml version="1.0" encoding="UTF-8"?>\n' + data) if n == name else z.read(n))
print('shortened the last bar in', done, 'parts')
