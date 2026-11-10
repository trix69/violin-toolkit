"""Add a key change and a repeat with endings to every part of a (python-ly) MusicXML.
Usage: add_marks.py in.musicxml out.musicxml --key BAR:FIFTHS:MODE --repeat FROM:TO --ending1 A:B --ending2 C:D"""
import sys
import xml.etree.ElementTree as ET
args = dict(zip(sys.argv[3::2], sys.argv[4::2]))
r = ET.parse(sys.argv[1]).getroot()


def bl(loc, style=None, rep=None, end=None):
    b = ET.Element('barline', location=loc)
    if style: ET.SubElement(b, 'bar-style').text = style
    if end: ET.SubElement(b, 'ending', number=end[0], type=end[1]).text = end[0] + '.' if end[1] == 'start' else None
    if rep: ET.SubElement(b, 'repeat', direction=rep)
    return b


for p in r.findall('part'):
    ms = {m.get('number'): m for m in p.findall('measure')}
    def first(m, el): m.insert(next((i for i, e in enumerate(m) if e.tag not in ('attributes',)), 0) if el.tag == 'barline' else 0, el)
    if '--key' in args:
        b, f, mode = args['--key'].split(':')
        a = ET.Element('attributes'); k = ET.SubElement(a, 'key'); ET.SubElement(k, 'fifths').text = f; ET.SubElement(k, 'mode').text = mode
        m = ms[b]; m.insert(0, a)
    if '--repeat' in args:
        f, t = args['--repeat'].split(':')
        ms[f].insert(1 if ms[f].find('attributes') is not None else 0, bl('left', 'heavy-light', 'forward'))
    if '--ending1' in args:
        a, z = args['--ending1'].split(':')
        ms[a].insert(1 if ms[a].find('attributes') is not None else 0, bl('left', end=('1', 'start')))
        ms[z].append(bl('right', 'light-heavy', 'backward', ('1', 'stop')))
    elif '--repeat' in args:
        ms[args['--repeat'].split(':')[1]].append(bl('right', 'light-heavy', 'backward'))
    if '--ending2' in args:
        a, z = args['--ending2'].split(':')
        ms[a].insert(1 if ms[a].find('attributes') is not None else 0, bl('left', end=('2', 'start')))
        ms[z].append(bl('right', 'light-heavy', None, ('2', 'discontinue')))
ET.ElementTree(r).write(sys.argv[2], encoding='unicode')
print('ok')
