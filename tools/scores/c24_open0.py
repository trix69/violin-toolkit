"""Caprice No. 24 (Mutopia #2000): the source writes "-0" on many notes of Var. IX (left-hand pizzicato) that are not an open
string (C5, G#4, D4, ...), where a 0 cannot be a fingering (Hermes F125). Drop those; a 0 on an open-string pitch stays.
Run after pack.py. Usage: python3 -I c24_open0.py paganini24.mxl"""
import sys, zipfile, xml.etree.ElementTree as ET

path = sys.argv[1]
z = zipfile.ZipFile(path); names = z.namelist()
name = [n for n in names if not n.startswith('META-INF')][0]
files = {n: z.read(n) for n in names}; z.close()
root = ET.fromstring(files[name])
STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
OPEN = {55, 62, 69, 76}
dropped = kept = 0
for n in root.iter('note'):
    p = n.find('pitch')
    for tech in n.iter('technical'):
        for f in tech.findall('fingering'):
            if (f.text or '').strip() != '0' or p is None: continue
            m = 12 * (int(p.findtext('octave')) + 1) + STEP[p.findtext('step')] + round(float(p.findtext('alter') or 0))
            if m in OPEN: kept += 1; continue
            tech.remove(f); dropped += 1
for nt in root.iter('notations'):
    for tech in nt.findall('technical'):
        if len(tech) == 0: nt.remove(tech)
for n in root.iter('note'):
    nt = n.find('notations')
    if nt is not None and len(nt) == 0: n.remove(nt)
x = '<?xml version="1.0" encoding="UTF-8"?>' + ET.tostring(root, encoding='unicode')
with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as w:
    for n in names: w.writestr(n, x if n == name else files[n])
print(path, 'written 0 dropped on', dropped, 'notes; kept on', kept, 'open-string notes')
