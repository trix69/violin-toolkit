"""Re-bar the single-voice parts of a python-ly MusicXML by the notes' real durations (Trix, 2026-11-12; first used for
Beethoven's Romance Op. 50). python-ly fills bars wrongly around long triplet runs and grace notes, but each note's own
duration is right, so the notes are poured back into bars of the time signature's length. Parts with a <backup>
(two voices) are left alone. A note that would cross a barline stops the script (it would need a tie).
Usage: rebar.py in.musicxml out.musicxml"""
import sys
import xml.etree.ElementTree as ET

tree = ET.parse(sys.argv[1]); root = tree.getroot()


def dur(e):
    if e.tag == 'forward': return int(e.find('duration').text)
    if e.tag != 'note' or e.find('chord') is not None or e.find('grace') is not None: return 0
    return int(e.find('duration').text)


for part in root.findall('part'):
    ms = part.findall('measure')
    for m in ms:   # python-ly leaves empty backups at the end of a bar (nothing after them): not a second voice
        while len(m) and m[-1].tag == 'backup': m.remove(m[-1])
    if any(m.find('backup') is not None for m in ms):
        print(part.get('id'), 'two voices: left as it is'); continue
    a = ms[0].find('attributes')
    div = int(a.find('divisions').text)
    t = a.find('time')
    full = div * 4 * int(t.find('beats').text) // int(t.find('beat-type').text)
    items = [e for m in ms for e in m]
    for m in ms:
        for e in list(m): m.remove(e)
    mi, pos, done = 0, 0, False
    for e in items:
        keep = (e.tag == 'note' and e.find('chord') is not None) or (e.tag == 'barline' and e.get('location', 'right') == 'right')
        if done and not keep:
            mi += 1; done = False; pos = 0
            if mi == len(ms):
                ms.append(ET.SubElement(part, 'measure')); ms[-1].set('number', str(mi + 1))
        ms[mi].append(e); pos += dur(e)
        if pos >= full: done = True
        assert pos <= full, ('a note crosses a barline', part.get('id'), mi + 1, pos, full)
    for m in ms[mi + 1:]:
        if not len(m): part.remove(m)
    print(part.get('id'), 're-barred:', mi + 1, 'bars')
tree.write(sys.argv[2], encoding='unicode')
