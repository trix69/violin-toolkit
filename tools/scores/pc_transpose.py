"""Por una Cabeza in G (Trix): the packed .mxl from pc_ly.py / pack.py / pc_repeat.py, moved down a major second
(A major -> G major verse, A minor -> G minor refrain); the violin also up an octave (B4 C5 C#5 D5 for the pickup,
the register violinists know it in). Spelling kept (A -> G, C# -> B, D# -> C#, ...); key signatures moved by two
fifths; printed accidentals dropped (the app works them out). Usage: pc_transpose.py in.mxl out.mxl"""
import sys, io, zipfile
import xml.etree.ElementTree as ET

STEPS = 'CDEFGAB'
SEMI = [0, 2, 4, 5, 7, 9, 11]


def move(p, dsteps, semis):
    step, alt, octv = p.findtext('step'), int(float(p.findtext('alter') or 0)), int(p.findtext('octave'))
    midi = 12 * (octv + 1) + SEMI[STEPS.index(step)] + alt + semis
    i = STEPS.index(step) + dsteps
    no, ni = octv + i // 7, i % 7
    na = midi - (12 * (no + 1) + SEMI[ni])
    assert abs(na) <= 2, (step, alt, octv, na)
    p.find('step').text = STEPS[ni]; p.find('octave').text = str(no)
    al = p.find('alter')
    if na == 0:
        if al is not None: p.remove(al)
    else:
        if al is None: al = ET.Element('alter'); p.insert(1, al)
        al.text = str(na)


zin = zipfile.ZipFile(sys.argv[1])
name = next(n for n in zin.namelist() if n.endswith('.xml') and not n.startswith('META-INF'))
root = ET.fromstring(zin.read(name))
for pi, part in enumerate(root.findall('part')):
    d, s = (6, 10) if pi == 0 else (-1, -2)   # violin: down a tone and up an octave = up a minor 7th
    for n in part.iter('note'):
        p = n.find('pitch')
        if p is not None: move(p, d, s)
        for a in n.findall('accidental'): n.remove(a)
    for k in part.iter('key'):
        k.find('fifths').text = str(int(k.findtext('fifths')) - 2)
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for nm in zin.namelist():
        z.writestr(nm, ET.tostring(root, encoding='unicode').encode() if nm == name else zin.read(nm))
open(sys.argv[2], 'wb').write(out.getvalue())
print('transposed to G; violin up an octave')
