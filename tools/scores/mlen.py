"""List measures whose voice lengths differ from the time signature. Usage: mlen.py file.musicxml"""
import sys
import xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
for part in root.findall('part'):
    div, beats, bt = 1, 4, 4
    pid = part.get('id')
    for i, m in enumerate(part.findall('measure')):
        a = m.find('attributes')
        if a is not None:
            if a.find('divisions') is not None: div = int(a.find('divisions').text)
            t = a.find('time')
            if t is not None: beats, bt = int(t.find('beats').text), int(t.find('beat-type').text)
        full = div * 4 * beats // bt
        pos, mx, ends = 0, 0, {}
        for el in m:
            if el.tag == 'backup': pos -= int(el.find('duration').text)
            elif el.tag == 'forward': pos += int(el.find('duration').text)
            elif el.tag == 'note' and el.find('chord') is None and el.find('grace') is None:
                pos += int(el.find('duration').text); v = el.findtext('voice', '1'); ends[v] = pos
            mx = max(mx, pos)
        if mx != full or any(e != full for e in ends.values()):
            print(pid, 'measure', m.get('number'), 'index', i + 1, 'max', mx, 'voices', ends, 'full', full)
