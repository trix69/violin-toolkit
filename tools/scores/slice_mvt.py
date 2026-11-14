"""Cut one movement (or an excerpt of one) out of an OpenScore quartet .mxl into its own compact .mxl.
Usage: python3 -I slice_mvt.py in.mxl out.mxl FIRST LAST "Title" [--check-first-words REGEX]
FIRST, LAST: 1-based positions of <measure> elements in the source (the same in every part).
Keeps every part and its name, carries the attributes in force at FIRST (divisions, key, time, clef, staves,
transpose) into the first kept measure, numbers the bars from 1 (an implicit first bar, an upbeat, is 0; other
implicit bars keep implicit="yes"), drops layout (<print>, credits, defaults), sets the title, prints note counts
per part before (in the range) and after, and the first and last bar's marks so the range can be checked."""
import copy, re, sys, zipfile
import xml.etree.ElementTree as ET

src, out, a, b, title = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
z = zipfile.ZipFile(src)
name = next(n for n in z.namelist() if not n.startswith('META-INF') and n.endswith(('.xml', '.musicxml')))
root = ET.fromstring(z.read(name))

def pitched(ms): return sum(1 for m in ms for n in m.iter('note') if n.find('pitch') is not None)
def marks(m):
    w = [x.text.strip() for x in m.iter('words') if x.text and x.text.strip()]
    t = ['%s/%s' % (x.findtext('beats'), x.findtext('beat-type')) for x in m.iter('time')]
    f = [x.findtext('bar-style') for x in m.iter('barline') if x.findtext('bar-style')]
    return 'no %s%s time %s words %s barlines %s' % (m.get('number'), ' (implicit)' if m.get('implicit') == 'yes' else '', t, w, f)

ATTR_ORDER = ['footnote', 'level', 'divisions', 'key', 'time', 'staves', 'part-symbol', 'instruments', 'clef', 'staff-details', 'transpose', 'directive', 'measure-style']
before = {}
for p in root.findall('part'):
    ms = p.findall('measure')
    assert len(ms) >= b, (p.get('id'), len(ms))
    keep = ms[a - 1:b]
    before[p.get('id')] = pitched(keep)
    # the attributes in force at the first kept bar (last value of each kind before it, per clef number)
    state = {}
    for m in ms[:a - 1]:
        for at in m.findall('attributes'):
            for e in at:
                k = e.tag + ':' + (e.get('number') or '')
                state[k] = e
    first = keep[0]
    at0 = first.find('attributes')
    if at0 is None:
        at0 = ET.Element('attributes'); first.insert(0, at0)
    have = {e.tag + ':' + (e.get('number') or '') for e in at0}
    for k, e in state.items():
        if k not in have and e.tag in ('divisions', 'key', 'time', 'staves', 'clef', 'transpose', 'staff-details'):
            at0.append(copy.deepcopy(e))
    at0[:] = sorted(list(at0), key=lambda e: ATTR_ORDER.index(e.tag) if e.tag in ATTR_ORDER else 99)
    for m in ms:
        if m not in keep: p.remove(m)
    n = 0
    for i, m in enumerate(keep):
        for e in m.findall('print'): m.remove(e)
        if i == 0 and m.get('implicit') == 'yes': m.set('number', '0'); continue
        n += 1; m.set('number', str(n))
for tag in ('credit', 'defaults'):
    for e in root.findall(tag): root.remove(e)
w = root.find('work')
if w is None: w = ET.Element('work'); root.insert(0, w)
wt = w.find('work-title')
if wt is None: wt = ET.SubElement(w, 'work-title')
wt.text = title
mt = root.find('movement-title')
if mt is not None: root.remove(mt)
p1 = root.findall('part')[0].findall('measure')
print('range: source measures %d-%d = %d bars' % (a, b, b - a + 1))
print('  first:', marks(p1[0])); print('  last: ', marks(p1[-1]))
names = {sp.get('id'): sp.findtext('part-name') for sp in root.iter('score-part')}
for p in root.findall('part'):
    print('  %-12s notes in range %5d, after %5d, bars %d' % (names[p.get('id')], before[p.get('id')], pitched(p.findall('measure')), len(p.findall('measure'))))
    assert before[p.get('id')] == pitched(p.findall('measure'))
xml = ET.tostring(root, encoding='unicode')
xml = re.sub(r'>\s+<', '><', xml)
doc = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' + xml
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zo:
    zo.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>')
    zo.writestr('score.xml', doc)
import os
print('wrote', out, os.path.getsize(out), 'bytes')
