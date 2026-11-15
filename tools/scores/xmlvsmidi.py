"""Note onsets per bar in a MusicXML part (graces and tied continuations not counted) against the edition's MIDI.
Usage: xmlvsmidi.py file.musicxml file.mid [pickup crotchets]  ->  totals and the bars that differ"""
import subprocess, sys, os
import xml.etree.ElementTree as ET
x, mid = sys.argv[1], sys.argv[2]; pick = float(sys.argv[3]) if len(sys.argv) > 3 else 0
r = ET.parse(x).getroot(); part = r.find('part')
per = {}; beats = None; tot = 0
for i, m in enumerate(part.findall('measure'), 1):
    t = m.find('attributes/time')
    if t is not None: beats = int(t.findtext('beats')) * 4 / int(t.findtext('beat-type'))
    c = 0
    for n in m.findall('note'):
        if n.find('pitch') is None or n.find('grace') is not None: continue
        if any(tt.get('type') == 'stop' for tt in n.findall('tie')) and not any(tt.get('type') == 'start' for tt in n.findall('tie')): continue
        if any(tt.get('type') == 'stop' for tt in n.findall('tie')): continue
        c += 1
    per[i] = c; tot += c
here = os.path.dirname(os.path.abspath(__file__))
out = subprocess.run([sys.executable, '-I', os.path.join(here, 'midicount.py'), mid, str(beats), str(pick)], capture_output=True, text=True).stdout.split('\n')
mtot = int(out[0].split()[0]); mper = {}
for kv in out[1].split():
    k, v = kv.split(':'); mper[int(k)] = int(v)
print('MusicXML onsets', tot, '| MIDI notes', mtot)
diff = [(b, per.get(b, 0), mper.get(b, 0)) for b in sorted(set(per) | set(mper)) if per.get(b, 0) != mper.get(b, 0)]
print('bars that differ (bar, xml, midi):', diff[:30], '...' if len(diff) > 30 else '')
