"""Por una Cabeza: violin slurs (Trix, 2026-11-12: "add violin style slurs"). Cuerden's edition is a song, so the
engraving (pc_ly.py) carried no slurs. Groups by measure, as indices into that measure's pitched non-chord notes:
four-semiquaver runs in one bow, eight-semiquaver bars as two fours, the refrain's crotchet pairs slurred, the two
semiquavers before each refrain crotchet together; the tango's staccato pairs and repeated quavers stay detached.
Usage: python3 -I pc_slurs.py in.mxl out.mxl"""
import sys, zipfile, xml.etree.ElementTree as ET

RUN4 = [(2, 5)]
G = {0: [(0, 3)], 3: [(0, 1), (2, 4)], 7: [(0, 3), (4, 7)], 13: [(0, 3), (4, 7)], 11: [(0, 3), (4, 5)]}
for m in (1, 2, 9, 10, 14, 15, 22, 23, 30, 31): G[m] = RUN4
for m in (4, 5, 6, 8, 12, 32): G[m] = [(1, 4)]
for m in (17, 19, 21, 25, 27, 29): G[m] = [(2, 3)]
for m in (18, 20, 24, 26, 28): G[m] = [(0, 1)]

src, out = sys.argv[1:3]
zin = zipfile.ZipFile(src)
name = [n for n in zin.namelist() if not n.startswith('META-INF')][0]
root = ET.fromstring(zin.read(name))
part = root.find('part')
added = 0
for meas in part.findall('measure'):
    groups = G.get(int(meas.get('number')), [])
    notes = [n for n in meas.findall('note') if n.find('rest') is None and n.find('chord') is None and n.find('grace') is None]
    for a, b in groups:
        assert b < len(notes), (meas.get('number'), a, b, len(notes))
        for i, kind in ((a, 'start'), (b, 'stop')):
            n = notes[i]
            no = n.find('notations')
            if no is None:
                no = ET.Element('notations')
                ly = n.find('lyric')
                if ly is not None: n.insert(list(n).index(ly), no)
                else: n.append(no)
            sl = ET.Element('slur', {'type': kind, 'number': '1'})   # the app places it
            no.insert(0, sl)
        added += 1
xml = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode').encode('utf-8')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n in zin.namelist():
        zo.writestr(n, xml if n == name else zin.read(n))
print(out, added, 'slurs')
