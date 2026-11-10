"""Pack a python-ly MusicXML into a compact .mxl: add work title, composer, rights; default beams where the
LilyPond source wrote none (python-ly only writes explicit [ ] beams); strip indentation.
Usage: pack.py in.musicxml out.mxl "Title" "Composer" "Rights / source line" [pickup in crotchets] """
import re, sys, zipfile
import xml.etree.ElementTree as ET

src, out, title, composer, rights = sys.argv[1:6]
root = ET.parse(src).getroot()

# work + identification ('-' as the title: keep the file's own, e.g. OpenScore's)
if title != '-':
    work = ET.Element('work'); ET.SubElement(work, 'work-title').text = title
    root.insert(0, work)
    ident = root.find('identification')
    if ident is None:
        ident = ET.Element('identification'); root.insert(1, ident)
    cr = ET.Element('creator', type='composer'); cr.text = composer
    ri = ET.Element('rights'); ri.text = rights
    ident.insert(0, cr); ident.insert(1, ri)

SHORT = {'eighth', '16th', '32nd', '64th'}

# python-ly writes a forward repeat as a right barline: it opens the bar it sits in
for bl in root.iter('barline'):
    r = bl.find('repeat')
    if r is not None and r.get('direction') == 'forward': bl.set('location', 'left')
# python-ly glitch: a chord ending a bar in a second voice puts its other notes at the start of a new measure
for part in root.findall('part'):
    ms = part.findall('measure')
    for i in range(1, len(ms)):
        kids = list(ms[i])
        while kids and kids[0].tag == 'note' and kids[0].find('chord') is not None:
            prev = list(ms[i - 1]); at = max((j for j, e in enumerate(prev) if e.tag == 'note'), default=len(prev) - 1) + 1
            ms[i].remove(kids[0]); ms[i - 1].insert(at, kids[0]); kids.pop(0)   # after the bar's last note, before trailing backups
# python-ly glitch: a grace note before a bar's last note counts towards the bar, which pushes that note (and the
# following bars) along until a later bar runs long. One-voice parts with no repeats: cut the bars again by length.
def note_dur(el):
    if el.tag == 'forward': return int(el.find('duration').text)
    if el.tag != 'note' or el.find('chord') is not None or el.find('grace') is not None: return 0
    return int(el.find('duration').text)


# trailing backups python-ly writes after a bar (nothing follows them)
for m in root.iter('measure'):
    while len(m) and m[-1].tag == 'backup': m.remove(m[-1])
rebarred = []
PICKUP = float(sys.argv[6]) if len(sys.argv) > 6 else 0   # LilyPond \partial, in crotchets: python-ly ignores it
for part in root.findall('part'):
    ms = part.findall('measure')
    inner = any(el.tag == 'backup' for m in ms for el in m)
    div, beats, bt, lens = 1, 4, 4, []
    for m in ms:
        a = m.find('attributes')
        if a is not None and a.find('divisions') is not None: div = int(a.find('divisions').text)
        if a is not None and a.find('time') is not None: beats, bt = int(a.find('time/beats').text), int(a.find('time/beat-type').text)
        lens.append((sum(note_dur(e) for e in m), div * 4 * beats // bt))
    if not PICKUP and not any(a_ != f for (a_, f) in lens[1:-1]): continue
    if inner:
        if PICKUP: sys.exit('pickup asked but part %s has voices or repeats' % part.get('id'))
        continue
    items = [e for m in ms for e in m]
    for m in ms:
        for e in list(m): m.remove(e)
    first = int(PICKUP * div) if PICKUP else lens[0][0] if 0 < lens[0][0] < lens[0][1] else lens[0][1]
    fulls = [f for _, f in lens]
    mi, pos, bound, full = 0, 0, first, False
    for e in items:
        is_chord = (e.tag == 'note' and e.find('chord') is not None) or (e.tag == 'barline' and e.get('location', 'right') == 'right')   # stays with the bar it ends
        if full and not is_chord:
            mi += 1; full = False
            if mi == len(ms): ms.append(ET.SubElement(part, 'measure'))
            bound += fulls[min(mi, len(fulls) - 1)]
        ms[mi].append(e); pos += note_dur(e)
        if pos >= bound: full = True
    for i, m in enumerate(ms): m.set('number', str(i if PICKUP else i + 1))
    if PICKUP: ms[0].set('implicit', 'yes')
    rebarred.append(part.get('id'))
if rebarred: print('re-barred', rebarred)
# every part repeats where part 1 does (python-ly can put a part's repeat sign a bar late)
import copy
parts = root.findall('part')
if len({len(p.findall('measure')) for p in parts}) == 1:
    for p in parts[1:]:
        for m0, m in zip(parts[0].findall('measure'), p.findall('measure')):
            for b in m.findall('barline'): m.remove(b)
            for b in m0.findall('barline'):
                nb = copy.deepcopy(b)
                if b.get('location') == 'left': m.insert(next((i for i, e in enumerate(m) if e.tag in ('note', 'direction', 'forward')), len(m)), nb)
                else: m.append(nb)
# trailing measures empty in every part
parts = root.findall('part')
while all(len(p.findall('measure')) > 1 and p.findall('measure')[-1].find('note') is None for p in parts):
    for p in parts:
        ms = p.findall('measure')
        for bl in ms[-1].findall('barline'):   # the final barline moves to the bar before
            for old in ms[-2].findall('barline'):
                if old.get('location', 'right') == 'right': ms[-2].remove(old)
            bl.set('location', 'right'); ms[-2].append(bl)
        p.remove(ms[-1])


def add_beam(note, kind):
    b = ET.Element('beam', number='1'); b.text = kind
    kids = list(note)
    at = next((i for i, k in enumerate(kids) if k.tag in ('notations', 'lyric')), len(kids))
    note.insert(at, b)


added = 0
for part in root.findall('part'):
    div, beats, btype = 1, 4, 4
    for meas in part.findall('measure'):
        a = meas.find('attributes')
        if a is not None:
            if a.find('divisions') is not None: div = int(a.find('divisions').text)
            t = a.find('time')
            if t is not None: beats, btype = int(t.find('beats').text), int(t.find('beat-type').text)
        compound = btype == 8 and beats % 3 == 0
        beat = div * 3 // 2 if compound else div * 4 // btype   # one beat in divisions
        # eighths alone: half a bar in 4/4, the whole bar in 2/4 and 3/4, the beat elsewhere (LilyPond's defaults)
        eighth_unit = beat * 2 if (beats, btype) == (4, 4) else beat * beats if (btype == 4 and beats in (2, 3)) else beat
        pos, voices = 0, {}
        for el in list(meas):
            if el.tag == 'backup': pos -= int(el.find('duration').text); continue
            if el.tag == 'forward': pos += int(el.find('duration').text); continue
            if el.tag != 'note': continue
            if el.find('chord') is not None or el.find('grace') is not None or el.find('cue') is not None: continue
            d = int(el.find('duration').text) if el.find('duration') is not None else 0
            v = el.findtext('voice', '1')
            voices.setdefault(v, []).append((pos, d, el)); pos += d
        for evs in voices.values():
            groups, cur = [], None
            for (p, d, el) in evs:
                ok = el.find('rest') is None and el.findtext('type') in SHORT and el.find('beam') is None
                if ok and cur and cur[-1][0] + cur[-1][1] == p:
                    allq = all(e.findtext('type') == 'eighth' for (_, _, e) in cur + [(p, d, el)])
                    unit = eighth_unit if allq else beat
                    if p // unit == cur[0][0] // unit and (allq or (p // beat == cur[0][0] // beat)):
                        cur.append((p, d, el)); continue
                cur = [(p, d, el)] if ok else None
                if cur: groups.append(cur)
            for g in groups:
                if len(g) < 2: continue
                for i, (_, _, el) in enumerate(g):
                    add_beam(el, 'begin' if i == 0 else 'end' if i == len(g) - 1 else 'continue')
                    # chord members carry the same beam
                    sib = list(meas); j = sib.index(el) + 1
                    while j < len(sib) and sib[j].tag == 'note' and sib[j].find('chord') is not None:
                        add_beam(sib[j], 'begin' if i == 0 else 'end' if i == len(g) - 1 else 'continue'); j += 1
                added += 1

x = ET.tostring(root, encoding='unicode')
x = re.sub(r'>\s+<', '><', x).strip()
x = re.sub(r'<backup><duration>\d+</duration></backup>(?=</measure>)', '', x)  # trailing backups after rest bars
x = '<?xml version="1.0" encoding="UTF-8"?>' + x
container = ('<?xml version="1.0" encoding="UTF-8"?><container><rootfiles>'
             '<rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr('META-INF/container.xml', container)
    z.writestr('score.xml', x)
print(out, len(x), 'bytes xml,', added, 'beam groups added')
