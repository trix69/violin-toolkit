"""Join Audiveris page files (one score per page, same parts) into one MusicXML, measures renumbered.
Usage: merge_pages.py out.musicxml "Name1,Name2,..." page1.xml page2.xml ..."""
import sys, copy
import xml.etree.ElementTree as ET
out, names, files = sys.argv[1], sys.argv[2].split(','), sys.argv[3:]
base = ET.parse(files[0]).getroot()
parts = base.findall('part')
for f in files[1:]:
    r = ET.parse(f).getroot()
    for p0, p in zip(parts, r.findall('part')):
        for m in p.findall('measure'): p0.append(copy.deepcopy(m))
for p in parts:
    for i, m in enumerate(p.findall('measure')): m.set('number', str(i + 1))
for sp, nm in zip(base.iter('score-part'), names):
    sp.find('part-name').text = nm
    for e in sp.iter('instrument-name'): e.text = nm
ET.ElementTree(base).write(out, encoding='unicode')
print(out, [len(p.findall('measure')) for p in parts])
