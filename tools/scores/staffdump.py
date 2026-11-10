"""Per measure, per staff: pitch sequence (with sounding alter) of a part. Usage: staffdump.py file.xml P2 [first last]"""
import sys
import xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
p = [x for x in r.findall('part') if x.get('id') == sys.argv[2]][0]
ms = p.findall('measure')
a, b = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1, len(ms))
for m in ms[a - 1:b]:
    st = {}
    for n in m.iter('note'):
        if n.find('grace') is not None: continue
        s = n.findtext('staff', '1'); pi = n.find('pitch')
        t = 'r' if pi is None else pi.findtext('step') + {'1': '#', '-1': 'b', '': ''}.get(pi.findtext('alter') or '', '?') + pi.findtext('octave')
        st.setdefault(s, []).append(('+' if n.find('chord') is not None else '') + t)
    print(m.get('number'), ' || '.join('%s: %s' % (k, ' '.join(v)) for k, v in sorted(st.items())))
