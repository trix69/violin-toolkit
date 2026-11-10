"""Humoresque No. 7 from Soustružník's string arrangement (CC0, Audiveris output merged): fix OMR slips checked
against the score, pizz./arco as sound, Dvořák's tempo, and transpose a semitone down into Dvořák's keys: G major
-> G-flat major (letters kept), the G minor middle section (bars 25-40) -> F-sharp minor (letters down one).
Usage: hum_fix.py in.musicxml out.musicxml"""
import sys, copy
import xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
parts = r.findall('part')
M = lambda p, n: p.findall('measure')[n - 1]


def copy_notes(p, src, dst):
    s, d = M(p, src), M(p, dst)
    at = next(i for i, e in enumerate(list(d)) if e.tag == 'note')
    for e in [e for e in d if e.tag in ('note', 'backup', 'forward')]: d.remove(e)
    for i, e in enumerate([e for e in s if e.tag in ('note', 'backup', 'forward')]): d.insert(at + i, copy.deepcopy(e))


vn = parts[0]
for src, dst in ((1, 17), (1, 21), (1, 41), (3, 43)): copy_notes(vn, src, dst)
# viola bar 13: r G D r | r G B r (the second 16th rest was missed)
va13 = M(parts[2], 13); notes = [e for e in va13 if e.tag == 'note']
rest = copy.deepcopy(notes[0]); va13.insert(list(va13).index(notes[3]) + 1, rest)
# pizz. / arco -> sound
for p in parts:
    for d in p.iter('direction'):
        w = (d.findtext('.//words') or '').strip().lower()
        if w.startswith('pizz') or w == 'arco':
            ET.SubElement(d, 'sound', pizzicato='yes' if w.startswith('pizz') else 'no')
# pizz./arco read from the score (Audiveris dropped the words): bar -> 'yes' (pizz.) / 'no' (arco), per part 2-5
PZ_VN2 = {1: 'yes', 4: 'no', 5: 'yes', 7: 'no', 17: 'yes', 20: 'no', 21: 'yes', 24: 'no', 41: 'yes', 44: 'no', 45: 'yes', 48: 'no'}
PZ_LOW = {1: 'yes', 4: 'no', 5: 'yes', 7: 'no', 9: 'yes', 10: 'no', 13: 'yes', 14: 'no', 17: 'yes', 20: 'no', 21: 'yes', 24: 'no',
          41: 'yes', 44: 'no', 45: 'yes', 48: 'no', 49: 'yes', 50: 'no', 53: 'yes', 54: 'no'}
for p, tab in zip(parts[1:], (PZ_VN2, PZ_LOW, PZ_LOW, PZ_LOW)):
    for bar, v in tab.items():
        m = M(p, bar); dr = ET.Element('direction', placement='above'); dt = ET.SubElement(dr, 'direction-type')
        ET.SubElement(dt, 'words').text = 'pizz.' if v == 'yes' else 'arco'; ET.SubElement(dr, 'sound', pizzicato=v)
        m.insert(next(i for i, e in enumerate(list(m)) if e.tag in ('note', 'direction')), dr)
# tempo: Dvořák's M.M. crotchet = 72, in the first bar of the top part
first = M(vn, 1)
dr = ET.Element('direction', placement='above'); dt = ET.SubElement(dr, 'direction-type'); mt = ET.SubElement(dt, 'metronome')
ET.SubElement(mt, 'beat-unit').text = 'quarter'; ET.SubElement(mt, 'per-minute').text = '72'; ET.SubElement(dr, 'sound', tempo='72')
first.insert(next(i for i, e in enumerate(list(first)) if e.tag in ('note', 'direction')), dr)
# transpose down a semitone
LET, SEMI = 'CDEFGAB', [0, 2, 4, 5, 7, 9, 11]
MID = range(25, 41)
for p in parts:
    for i, m in enumerate(p.findall('measure')):
        bar = i + 1; mid = bar in MID
        for k in m.iter('key'):
            f = int(k.findtext('fifths')); k.find('fifths').text = str(f + 5 if mid or f < 0 else f - 7)   # G 1 -> -6; Gm -2 -> F#m 3
        for pt in m.iter('pitch'):
            L = LET.index(pt.findtext('step')); o = int(pt.findtext('octave')); a = int(float(pt.findtext('alter') or 0))
            semi = o * 12 + SEMI[L] + a - 1
            if mid: L -= 1
            if L < 0: L += 7; o -= 1
            na = semi - (o * 12 + SEMI[L])
            pt.find('step').text = LET[L]; pt.find('octave').text = str(o)
            al = pt.find('alter')
            if na == 0:
                if al is not None: pt.remove(al)
            else:
                if al is None: al = ET.Element('alter'); pt.insert(1, al)
                al.text = str(na)
        for acc in list(m.iter('accidental')):   # displayed accidentals no longer match: let the reader decide
            pass
for n in r.iter('note'):
    for acc in n.findall('accidental'): n.remove(acc)
ET.ElementTree(r).write(sys.argv[2], encoding='unicode')
print('ok')
