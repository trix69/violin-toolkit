"""Bach, solo violin: four movements from the Mutopia Project (Bach-Gesellschaft 1879, Band 27.1; typeset 2008, CC BY-SA 3.0),
LilyPond -> one-part MusicXML. python-ly fails on the files' << \\melodyOne \\\\ \\melodyTwo \\\\ ... >> and drops some
spacers (s), so each voice is converted on its own with the spacers and the \\partial upbeat written as marked rests
(r<dur>\\fermata), re-barred where python-ly mis-fills bars (rebar.py), the upbeat restored (upbeat.py), the voices merged
into one part with the marked rests turned back into gaps (merge_voices.py), then packed (pack.py). The part is named
Violin; the only edit to the music is a tempo mark (the files have none). Each result is checked against the edition's
own MIDI (xmlvsmidi.py). Usage: python3 -I build.py SRC_DIR WORK_DIR OUT_DIR LY_BINARY"""
import os, re, subprocess, sys
SRC, WORK, OUT, LY = sys.argv[1:5]
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # tools/scores
RIGHTS = ('Mutopia Project no. %d, %s (Bach-Gesellschaft Edition 1879, Band 27.1), typeset 2008; converted to MusicXML by '
          'Violin Toolkit 2026, tempo crotchet = %d added. Licensed under Creative Commons Attribution-ShareAlike 3.0.')
PIECES = [   # file, out, title, Mutopia no., tempo, voices, upbeat (crotchets)
    ('bwv-1006_3', 'bach1006_gavotte.mxl', 'Gavotte en Rondeau, BWV 1006', 1471, 120, ['melodyOne', 'melodyTwo'], 2),
    ('bwv-1003_3', 'bach1003_andante.mxl', 'Andante, BWV 1003', 1456, 60, ['melodyOne', 'melodyTwo', 'melodyThree'], 0),
    ('bwv-1001_1', 'bach1001_adagio.mxl', 'Adagio, BWV 1001', 1429, 44, ['melodyOne', 'melodyTwo', 'melodyThree'], 0),
    ('bwv-1006_1', 'bach1006_preludio.mxl', 'Preludio, BWV 1006', 1469, 120, ['melodyOne', 'melodyTwo'], 0),
]
run = lambda *a: subprocess.run(list(a), capture_output=True, text=True, check=True).stdout
os.makedirs(WORK, exist_ok=True)
for name, out, title, mno, tempo, voices, up in (p for p in PIECES if len(sys.argv) < 6 or p[0] in sys.argv[5:]):
    s = open(os.path.join(SRC, name + '.ly'), encoding='utf-8').read()
    s = s.replace('instrumentName = "Violine"', 'instrumentName = "Violin"')
    s, k = re.subn(r'\\time (\d+/\d+) \\melody', r'\\time \1 \\tempo 4 = %d \\melody' % tempo, s); assert k == 1, name
    tm = re.search(r'\\time (\d+)/(\d+) (?:\\tempo 4 = \d+ )?\\melody', s); bar = int(tm.group(1)) * 4 / int(tm.group(2))   # crotchets per bar
    def unit(d): v = 4 / int(d.rstrip('.')); return v * (1.5 if d.endswith('.') else 1)
    from fractions import Fraction
    def expand(m):   # s1*3, s1*3/4*12 -> one spacer per bar of the time signature (a whole-note spacer would cross 3/4 barlines)
        tot = unit(m.group(1))
        for f in re.findall(r'\*(\d+(?:/\d+)?)', m.group(2)): tot *= float(Fraction(f))
        n = int(round(tot / bar)); assert n and abs(n * bar - tot) < 1e-9, m.group(0)
        return ' '.join([{4: 's1', 3: 's2.', 2: 's2'}[bar]] * n)
    s = re.sub(r'(?<![a-zA-Z\\])s(\d+\.*)((?:\*\d+(?:/\d+)?)+)', expand, s)
    s = re.sub(r'(?<![a-zA-Z\\])s(\d+\.*)', r'r\1\\fermata', s)          # spacers -> marked rests
    s = re.sub(r'\\partial\s+(\d+\.*)', r'r\1\\fermata', s)               # the upbeat -> a marked rest filling the bar
    files = []
    for v in voices:
        vs = s.replace('\\tempo 4 = %d \\melody' % tempo, '\\tempo 4 = %d \\%s' % (tempo, v))
        ly, xml = os.path.join(WORK, '%s.%s.ly' % (name, v)), os.path.join(WORK, '%s.%s.xml' % (name, v))
        open(ly, 'w', encoding='utf-8').write(vs)
        open(xml, 'w', encoding='utf-8').write(subprocess.run([LY, 'musicxml', ly], capture_output=True, text=True).stdout)
        if run(sys.executable, '-I', os.path.join(H, 'mlen.py'), xml).strip():
            rb = xml.replace('.xml', '.rb.xml'); print(name, v, run(sys.executable, '-I', os.path.join(H, 'rebar.py'), xml, rb).strip()); xml = rb
        if up:
            print(name, v, run(sys.executable, '-I', os.path.join(H, 'upbeat.py'), xml, xml).strip())
        files.append(xml)
    merged = os.path.join(WORK, name + '.musicxml')
    print(run(sys.executable, '-I', os.path.join(H, 'merge_voices.py'), merged, *files).strip())
    if name == 'bwv-1001_1':   # G minor written with one flat (Bach's Dorian signature): no mode, so the app names no key rather than "D minor"
        x = open(merged, encoding='utf-8').read(); x2 = re.sub(r'\s*<mode>minor</mode>', '', x); assert x2 != x; open(merged, 'w', encoding='utf-8').write(x2)
    print(run(sys.executable, '-I', os.path.join(H, 'xmlvsmidi.py'), merged, os.path.join(SRC, name + '.mid'), str(up)).strip())
    print(run(sys.executable, '-I', os.path.join(H, 'pack.py'), merged, os.path.join(OUT, out), title, 'Johann Sebastian Bach',
              RIGHTS % (mno, title, tempo)).strip())
