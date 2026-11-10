"""Humoresque (humoresque.mxl): bar 6's first violin note G5, as bar 2 and the phrase's returns (bars 18, 22, 42, 46)
- Trix chose it after hearing both; Soustružník's arrangement (the source) has E5 there. Applied to the packed .mxl
after hum_fix.py. Usage: hum_bar6.py in.mxl out.mxl"""
import sys, io, zipfile
import xml.etree.ElementTree as ET

zin = zipfile.ZipFile(sys.argv[1])
name = next(n for n in zin.namelist() if n.endswith('.xml') and not n.startswith('META-INF'))
root = ET.fromstring(zin.read(name))
m6 = root.findall('part')[0].findall('measure')[5]
n = next(e for e in m6.findall('note') if e.find('rest') is None and e.find('grace') is None)
p = n.find('pitch')
assert (p.findtext('step'), p.findtext('octave'), p.find('alter')) == ('E', '5', None), (p.findtext('step'), p.findtext('octave'))
p.find('step').text = 'G'
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for nm in zin.namelist():
        z.writestr(nm, ET.tostring(root, encoding='unicode').encode() if nm == name else zin.read(nm))
open(sys.argv[2], 'wb').write(out.getvalue())
print('bar 6 starts G5')
