"""Merge single-voice MusicXML files (python-ly converts each LilyPond voice of a polyphonic staff on its own, because
it fails on << \\a \\\\ \\b \\\\ \\c >>) into one part with voices 1..n per measure, at a common <divisions>.
The first file gives the attributes, directions and barlines; the others add only their notes and gaps (<forward>).
Usage: merge_voices.py out.musicxml voice1.xml voice2.xml [voice3.xml ...]"""
import copy, math, sys
import xml.etree.ElementTree as ET

out, srcs = sys.argv[1], sys.argv[2:]
trees = [ET.parse(f) for f in srcs]
# a rest marked with a fermata stands for a LilyPond spacer (s), written so because python-ly drops some spacers and so
# mis-fills bars: back to a gap (<forward>), which draws nothing
for t in trees:
    for m in t.getroot().iter('measure'):
        for i, e in enumerate(list(m)):
            if e.tag == 'note' and e.find('rest') is not None and e.find('.//fermata') is not None:
                fw = ET.Element('forward'); ET.SubElement(fw, 'duration').text = e.findtext('duration')
                m.remove(e); m.insert(i, fw)
    # python-ly glitch: a chord that ends a bar puts its other notes at the start of the next measure; move them back
    ms = t.getroot().find('part').findall('measure')
    for a, b in zip(ms, ms[1:]):
        lead = []
        for e in list(b):
            if e.tag == 'note' and e.find('chord') is not None: lead.append(e)
            elif e.tag in ('attributes', 'direction', 'print'): continue
            else: break
        if not lead: continue
        last = max(k for k, e in enumerate(list(a)) if e.tag == 'note')
        for j, e in enumerate(lead):
            b.remove(e); a.insert(last + 1 + j, e)
    while len(ms) > 1 and all(x.find('rest') is not None for x in ms[-1].findall('note')) and not ms[-1].findall('barline'):
        t.getroot().find('part').remove(ms[-1]); ms = ms[:-1]   # an empty trailing measure
roots = [t.getroot() for t in trees]
divs = [int(r.find('part').find('measure').find('attributes').findtext('divisions')) for r in roots]
D = 1
for d in divs: D = D * d // math.gcd(D, d)
measures = [r.find('part').findall('measure') for r in roots]
n = len(measures[0])
for k, ms in enumerate(measures[1:], 2):
    extra = ms[n:]
    assert all(all(x.find('rest') is not None for x in m.findall('note')) for m in extra), 'voice %d has notes after the last measure of voice 1' % k

def scale(el, f):
    for d in el.iter('duration'): d.text = str(int(d.text) * f)

def length(els):
    t = 0
    for e in els:
        if e.tag == 'note':
            if e.find('chord') is not None or e.find('grace') is not None: continue
            t += int(e.findtext('duration'))
        elif e.tag == 'forward': t += int(e.findtext('duration'))
        elif e.tag == 'backup': t -= int(e.findtext('duration'))
    return t

base = roots[0]; part = base.find('part')
for i, m in enumerate(part.findall('measure')):
    f0 = D // divs[0]
    for e in m:
        if e.tag in ('note', 'forward', 'backup'): scale(e, f0)
        if e.tag == 'attributes' and e.find('divisions') is not None: e.find('divisions').text = str(D)
    for e in m.findall('note'):
        v = e.find('voice')
        if v is not None: v.text = '1'
    total = length(list(m))
    for k in range(1, len(roots)):
        if i >= len(measures[k]): continue   # a voice that ends early (no trailing spacers)
        src = measures[k][i]; f = D // divs[k]
        els = [copy.deepcopy(e) for e in src if e.tag in ('note', 'forward', 'backup')]
        for e in els:
            scale(e, f)
            v = e.find('voice')
            if v is not None: v.text = str(k + 1)
        if not any(e.tag == 'note' for e in els): continue
        # back to the start of the bar, then this voice
        insert_at = len(m)
        while insert_at > 0 and m[insert_at - 1].tag == 'barline': insert_at -= 1
        b = ET.Element('backup'); ET.SubElement(b, 'duration').text = str(total)
        m.insert(insert_at, b); insert_at += 1
        for e in els: m.insert(insert_at, e); insert_at += 1
        total = length(els)
trees[0].write(out, encoding='utf-8', xml_declaration=True)
pitched = lambda r: sum(1 for x in r.iter('note') if x.find('pitch') is not None)
print('merged', len(srcs), 'voices, divisions', D, '| pitched notes per voice', [pitched(r) for r in roots[1:]] and [pitched(ET.parse(f).getroot()) for f in srcs], '-> merged', pitched(base), '| measures', n)
