"""python-ly ignores \\partial, so the bars of a piece with an upbeat come out shifted. Write the upbeat in the .ly as a
marked rest first (\\partial 2  ->  r2\\fermata, the same marker merge_voices.py uses for spacers), convert, then run this:
the leading marked rest is removed, the first measure becomes an implicit upbeat numbered 0 and the others are numbered
from 1. Usage: upbeat.py in.musicxml out.musicxml"""
import sys
import xml.etree.ElementTree as ET
src, out = sys.argv[1:3]
t = ET.parse(src); part = t.getroot().find('part'); ms = part.findall('measure')
first = ms[0]
lead = [e for e in first if e.tag == 'note']
assert lead and lead[0].find('rest') is not None and lead[0].find('.//fermata') is not None, 'the first note is not the marked upbeat rest'
first.remove(lead[0])
first.set('implicit', 'yes')
for i, m in enumerate(ms): m.set('number', str(i))
t.write(out, encoding='utf-8', xml_declaration=True)
print('upbeat: removed the marked rest, bars numbered 0..%d' % (len(ms) - 1))
