"""Dump measures of a part: mdump.py file.musicxml P1 first last"""
import sys
import xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
p = [x for x in r.findall('part') if x.get('id') == sys.argv[2]][0]
a, b = int(sys.argv[3]), int(sys.argv[4])
for m in p.findall('measure')[a - 1:b]:
    out = []
    for el in m:
        if el.tag == 'note':
            pi = el.find('pitch'); s = (pi.findtext('step') + (pi.findtext('alter') or '') + pi.findtext('octave')) if pi is not None else 'r'
            g = 'g' if el.find('grace') is not None else ''
            out.append(('+' if el.find('chord') is not None else '') + g + s + '/' + (el.findtext('duration') or '-') + ('~' if el.find('tie[@type="start"]') is not None else ''))
        elif el.tag in ('backup', 'forward'): out.append(el.tag + el.findtext('duration'))
        elif el.tag == 'barline': out.append('|' + (el.find('repeat').get('direction') if el.find('repeat') is not None else '') + (('E' + el.find('ending').get('number') + el.find('ending').get('type')) if el.find('ending') is not None else ''))
    print(m.get('number'), ' '.join(out))
