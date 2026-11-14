"""Tchaikovsky, Swan Lake: Dance of the Little Swans, from Eugene Gajewski's Dorico engraving of the Op. 20a suite
(IMSLP #917974, CC0; MusicXML 'Full score - 03 Flow 3'). Violin = the tune: Oboe I bars 1-9 and 26-38, Violin I bars
10-25 (bars 10 and 26 joined where one hands over to the other). Accompaniment = the other woodwinds and strings at
sounding pitch (clarinets in A and the double bass written transposed); Oboe I left out (all of it is the tune), Violin I
keeps only what is not the tune; piccolo, brass and timpani (they play only the last chord) left out.
Usage: python3 -I build.py flow3.xml out.mxl"""
import copy, sys, zipfile, xml.etree.ElementTree as ET
src, out = sys.argv[1:3]
root = ET.parse(src).getroot()
PROG = {'Flute': 74, 'Oboe': 69, 'Clarinet': 72, 'Bassoon': 71, 'Violin': 41, 'Viola': 42, 'Violoncello': 43, 'Contrabass': 44}
STEPS = 'CDEFGAB'; SEMI = [0, 2, 4, 5, 7, 9, 11]
pl = root.find('part-list'); parts = {p.get('id'): p for p in root.findall('part')}
name = {sp.get('id'): sp.findtext('part-name') for sp in pl.findall('score-part')}
DROP = {i for i, n in name.items() if n.split()[0] in ('Piccolo', 'Horn', 'Trumpet', 'Tenor', 'Bass', 'Tuba', 'Timpani')}
OBOE1 = next(i for i, n in name.items() if n == 'Oboe I'); VLN1 = next(i for i, n in name.items() if n == 'Violin I')

def divs(part):
    return int(part.find('measure/attributes/divisions').text)

def sounding(part):
    """apply <transpose> to every pitch, drop it, key = concert A major / F# minor"""
    tr = part.find('measure/attributes/transpose')
    if tr is None: return
    dia, chrom = int(tr.findtext('diatonic') or 0), int(tr.findtext('chromatic') or 0)
    octv = int(tr.findtext('octave-change') or 0)
    for p in part.iter('pitch'):
        st, alt, oc = STEPS.index(p.findtext('step')), int(float(p.findtext('alter') or 0)), int(p.findtext('octave'))
        midi = 12 * (oc + 1) + SEMI[st] + alt + chrom + 12 * octv
        k = st + dia; oc2 = oc + octv + k // 7; k %= 7
        a2 = midi - (12 * (oc2 + 1) + SEMI[k])
        p.find('step').text = STEPS[k]; p.find('octave').text = str(oc2)
        al = p.find('alter')
        if a2:
            if al is None: al = ET.Element('alter'); p.insert(1, al)
            al.text = str(a2)
        elif al is not None: p.remove(al)
    for at in part.iter('attributes'):
        for t in at.findall('transpose'): at.remove(t)
        for k in at.findall('key'):
            k.find('fifths').text = '3'
    for ac in part.iter('accidental'): pass   # written accidentals: the player reads pitches, not these

def scaled(n, f):
    n = copy.deepcopy(n); d = n.find('duration')
    if d is not None: d.text = str(int(d.text) * f)
    return n

def notes(m): return [e for e in m if e.tag == 'note']

ob, vn = parts[OBOE1], parts[VLN1]
top = root.find('part').find('measure')   # the piccolo's first bar holds the tempo (sound + 'Allegro moderato')
TEMPO = [copy.deepcopy(e) for e in top if e.tag == 'sound']   # the words 'Allegro moderato' left out: drawn under bar 1 they ran into bar 2's p
assert TEMPO
assert divs(ob) % divs(vn) == 0; F = divs(ob) // divs(vn)
solo = ET.Element('part', id='P0')
for mo, mv in zip(ob.findall('measure'), vn.findall('measure')):
    b = int(mo.get('number')); m = ET.SubElement(solo, 'measure', number=mo.get('number'))
    for e in mo:
        if e.tag in ('attributes', 'direction', 'sound'): m.append(copy.deepcopy(e))
    if b == 1: m.extend(TEMPO)
    if b <= 9 or b >= 27: body = [copy.deepcopy(e) for e in notes(mo)]
    elif b == 10:   # oboe's tied E# (an eighth), then the violins after their eighth rest
        no, nv = notes(mo), notes(mv)
        assert no[0].find('rest') is None and nv[0].find('rest') is not None and int(no[0].findtext('duration')) == int(nv[0].findtext('duration')) * F
        body = [copy.deepcopy(no[0])] + [scaled(n, F) for n in nv[1:]]
    elif b == 26:   # the violins' last F#, then the oboe after its eighth rest
        no, nv = notes(mo), notes(mv)
        assert nv[0].find('rest') is None and no[0].find('rest') is not None and int(nv[0].findtext('duration')) * F == int(no[0].findtext('duration'))
        body = [scaled(nv[0], F)] + [copy.deepcopy(n) for n in no[1:]]
    else: body = [scaled(n, F) for n in notes(mv)]
    for n in body:
        for v in n.findall('voice'): v.text = '1'
        for s in n.findall('staff'): n.remove(s)
        m.append(n)
    tot = sum(int(n.findtext('duration')) for n in body if n.find('chord') is None and n.find('grace') is None)
    assert tot == 4 * divs(ob), (b, tot)
# Violin I: the tune bars become whole-bar rests (bar 10: keep nothing; bar 26 too: its only note went to the tune)
for mv in vn.findall('measure'):
    b = int(mv.get('number'))
    if 10 <= b <= 26:
        for n in notes(mv): mv.remove(n)
        for e in [e for e in mv if e.tag in ('backup', 'forward')]: mv.remove(e)
        r = ET.SubElement(mv, 'note', {}); ET.SubElement(r, 'rest', measure='yes'); ET.SubElement(r, 'duration').text = str(4 * divs(vn)); ET.SubElement(r, 'voice').text = '1'
for i in list(parts):
    if i in DROP or i == OBOE1: root.remove(parts[i]); pl.remove(next(sp for sp in pl.findall('score-part') if sp.get('id') == i))
for i, p in parts.items():
    if i not in DROP and i != OBOE1: sounding(p)
# the solo first in the part list and the score, with instruments
sp0 = ET.Element('score-part', id='P0'); ET.SubElement(sp0, 'part-name').text = 'Violin'
pl.insert(0, sp0); first = root.find('part'); root.insert(list(root).index(first), solo)
ch = 0
for sp in pl.findall('score-part'):
    for e in sp.findall('midi-instrument') + sp.findall('score-instrument') + sp.findall('midi-device'): sp.remove(e)
    nm = sp.findtext('part-name'); key = nm.split()[0]
    if sp.get('id') != 'P0' and nm.startswith('Violin'): nm = sp.find('part-name').text = {'Violin I': 'Ripieno 1', 'Violin II': 'Ripieno 2'}[nm]
    si = ET.SubElement(sp, 'score-instrument', id=sp.get('id') + '-I1'); ET.SubElement(si, 'instrument-name').text = nm   # not 'Violin' on the ripieno: the player takes a first violin as the solo
    mi = ET.SubElement(sp, 'midi-instrument', id=sp.get('id') + '-I1')
    ET.SubElement(mi, 'midi-channel').text = str(ch % 16 + 1 + (1 if ch % 16 >= 9 else 0)); ET.SubElement(mi, 'midi-program').text = str(PROG[key]); ch += 1
# the dance is in F# minor; Dorico wrote mode 'major' with the three sharps
for k in root.iter('key'):
    md = k.find('mode')
    if md is None: md = ET.SubElement(k, 'mode')
    md.text = 'minor'
# title, composer, rights
w = root.find('work'); w.find('work-title').text = 'Swan Lake: Dance of the Little Swans'
mt = root.find('movement-title')
if mt is not None: root.remove(mt)
for c in root.findall('credit'): root.remove(c)
ident = root.find('identification')
for c in ident.findall('creator'): c.text = 'Pyotr Ilyich Tchaikovsky'
ident.find('rights').text = ('Engraving (c) Eugene Gajewski 2024, CC0 1.0 (IMSLP #917974, Swan Lake Suite Op. 20a, No. 3); '
                             'arranged for violin and orchestra by Violin Toolkit 2026, CC0 1.0')
for e in root.findall('defaults'): root.remove(e)
for p in root.iter('part'):
    for m in p.findall('measure'):
        for e in m.findall('print'): m.remove(e)
xml = ET.tostring(root, encoding='unicode')
doc = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' + xml
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>')
    z.writestr('score.xml', doc)
print('parts', [sp.findtext('part-name') for sp in pl.findall('score-part')])
