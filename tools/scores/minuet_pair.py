"""The two Petzold minuets as one piece (Trix, 2026-11-14): Minuet in G major (BWV Anh. 114, minuet.mxl, Mutopia #75)
then Minuet in G minor (BWV Anh. 115, minuet115.mxl, Mutopia #76), then the first again, written out (the player has no
da capo); a bar's rest between Minuet I and Minuet II (Trix). Each section keeps its own divisions, key (with mode) and tempo; the key change is in the file, so the score
prints it. Usage: python3 -I minuet_pair.py minuet.mxl minuet115.mxl out.mxl"""
import sys, copy, zipfile, xml.etree.ElementTree as ET

TITLE = 'Minuets in G major and G minor, BWV Anh. 114–115'


def load(path):
    z = zipfile.ZipFile(path)
    name = [n for n in z.namelist() if not n.startswith('META-INF')][0]
    return ET.fromstring(z.read(name))


a, b = load(sys.argv[1]), load(sys.argv[2])
out = copy.deepcopy(a)
out.find('work/work-title').text = TITLE
ident = out.find('identification')
for r in ident.findall('rights'): ident.remove(r)
ET.SubElement(ident, 'rights').text = ('BWV Anh. 114 from Mutopia Project no. 75 and BWV Anh. 115 from no. 76 (Bach-Gesellschaft, '
                                       'typeset by Allen Garvin), Public Domain; joined into one piece by Violin Toolkit, 2026')


def label(m, text):
    """words over the violin's first bar of a section"""
    d = ET.Element('direction', {'placement': 'above'})
    ET.SubElement(ET.SubElement(d, 'direction-type'), 'words').text = text
    at = m.find('attributes')
    m.insert(list(m).index(at) + 1 if at is not None else 0, d)


def barline(m, style):
    for x in m.findall("barline[@location='right']"): m.remove(x)
    bl = ET.SubElement(m, 'barline', {'location': 'right'}); ET.SubElement(bl, 'bar-style').text = style


for pid in ('P1', 'P2'):
    pa, pb = a.find("part[@id='%s']" % pid), b.find("part[@id='%s']" % pid)
    po = out.find("part[@id='%s']" % pid)
    for m in list(po): po.remove(m)
    sec = [copy.deepcopy(m) for m in pa.findall('measure')], [copy.deepcopy(m) for m in pb.findall('measure')], [copy.deepcopy(m) for m in pa.findall('measure')]
    # a bar's rest between the two minuets (Trix), after Minuet I's last bar; the double bar before the change of key comes after it
    rest = ET.Element('measure'); div = None
    for m in sec[0]:
        at = m.find('attributes')
        if at is not None and at.find('divisions') is not None: div = int(at.find('divisions').text)
    n_ = ET.SubElement(rest, 'note'); ET.SubElement(n_, 'rest', {'measure': 'yes'}); ET.SubElement(n_, 'duration').text = str(3 * div)   # 3/4
    ET.SubElement(n_, 'voice').text = '1'
    sec[0].append(rest)
    barline(sec[0][-1], 'light-light')   # a double bar before the change of key
    barline(sec[2][-1], 'light-heavy')
    if pid == 'P1':
        label(sec[1][0], 'Minuet II')
        label(sec[2][0], 'Minuet I')
    n = 0
    for s in sec:
        for m in s:
            n += 1; m.set('number', str(n)); po.append(m)
    print(pid, n, 'bars')

xml = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(out, encoding='unicode').encode('utf-8')
with zipfile.ZipFile(sys.argv[3], 'w', zipfile.ZIP_DEFLATED) as zo:
    zo.writestr('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>')
    zo.writestr('score.xml', xml)
print(sys.argv[3])
