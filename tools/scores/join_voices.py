"""Join voices that take turns (Trix: the Preludio's bariolage drew unbeamed flags). Bach-Gesellschaft writes e.g. BWV 1006's
bariolage as two interleaved voices (one note each, the other voice resting), which the edition beams as one stream; in
MusicXML a beam stays within a voice, so neither voice could beam. In every measure whose voices never sound at the same
time (no note of one starts while another voice's note is sounding), the voices become voice 1 in time order, the gaps
between them become <forward>s, and the measure's beams are dropped so pack.py beams it by the beat again.
Usage: join_voices.py in.mxl out.musicxml   then   pack.py out.musicxml final.mxl - - -"""
import sys, zipfile
import xml.etree.ElementTree as ET

src, out = sys.argv[1:3]
with zipfile.ZipFile(src) as z:
    name = next(n for n in z.namelist() if not n.startswith('META-INF'))
    root = ET.fromstring(z.read(name))
joined = 0
for part in root.findall('part'):
    for m in part.findall('measure'):
        if m.find('backup') is None: continue
        pos, evs, other = 0, [], []
        for el in list(m):
            if el.tag == 'backup': pos -= int(el.find('duration').text); continue
            if el.tag == 'forward': pos += int(el.find('duration').text); continue
            if el.tag != 'note': other.append(el); continue
            if el.find('chord') is not None: evs[-1][2].append(el); continue
            d = 0 if el.find('grace') is not None else int(el.find('duration').text)
            evs.append([pos, d, [el], el.findtext('voice', '1')]); pos += d
        if len({e[3] for e in evs}) < 2: continue
        sounding = sorted((e for e in evs if e[2][0].find('rest') is None and e[1] > 0), key=lambda e: e[0])
        if any(b[0] < a[0] + a[1] for a, b in zip(sounding, sounding[1:])): continue   # real polyphony: keep the voices
        keep = sorted((e for e in evs if e[2][0].find('rest') is None or e[3] == '1'), key=lambda e: (e[0], e[1] == 0))
        # rests of other voices are dropped; voice 1's rests stay unless a note of another voice sits inside them
        keep = [e for e in keep if e[2][0].find('rest') is None or not any(o[0] < e[0] + e[1] and e[0] < o[0] + o[1] for o in sounding)]
        for el in list(m):
            if el.tag in ('note', 'backup', 'forward'): m.remove(el)
        at, ins = 0, len([k for k in list(m) if k.tag in ('attributes', 'print')])
        for p, d, els, v in keep:
            if p > at:
                f = ET.Element('forward'); ET.SubElement(f, 'duration').text = str(p - at); m.insert(ins, f); ins += 1
            for el in els:
                for b in el.findall('beam'): el.remove(b)
                vv = el.find('voice')
                if vv is not None: vv.text = '1'
                st = el.find('stem')
                if st is not None: el.remove(st)
                m.insert(ins, el); ins += 1
            at = max(at, p + d)
        joined += 1
tree = ET.ElementTree(root); tree.write(out, encoding='unicode')
print(out, joined, 'measures joined')
