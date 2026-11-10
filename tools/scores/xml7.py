"""Pack the seven Mutopia LilyPond conversions (python-ly output, prepared in conv/<tune>/) into out/xml/*.mxl.
Each line: converted file, built-in name, title, composer, rights, pickup (crotchets)."""
import os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__))
CONV = ' Converted from the LilyPond source to MusicXML by Violin Toolkit (2026).'
T = [
    ('minuet/min2.musicxml', 'minuet.mxl', 'Minuet in G', 'Christian Petzold (formerly attributed to J. S. Bach)',
     'Mutopia Project #75, typeset by Allen Garvin.' + CONV + ' Tempo crotchet = 120. Public Domain.', 0),
    ('gavotte/g1.musicxml', 'gavotte.mxl', 'Gavotte', 'Giovanni Battista Martini',
     'Mutopia Project #1785, typeset by Fabien Mirloup.' + CONV + ' Licensed under Creative Commons Attribution-ShareAlike 3.0.', 2),
    ('air/a3.musicxml', 'air.mxl', 'Air (BWV 1068)', 'Johann Sebastian Bach',
     'Mutopia Project #242, typeset by Jeff Covey.' + CONV + ' Repeats written out once, as in the edition\'s MIDI. Licensed under Creative Commons Attribution-ShareAlike 3.0.', 0),
    ('canon/c1.musicxml', 'canon.mxl', 'Canon', 'Johann Pachelbel',
     'Mutopia Project #2047, typeset by Michael Fischer v. Mollard.' + CONV + ' Licensed under Creative Commons Attribution 4.0.', 0),
    ('spring/sp1.musicxml', 'spring.mxl', 'Spring, 1st movement', 'Antonio Vivaldi',
     'Mutopia Project #301, typeset by smailliw.' + CONV + ' Licensed under Creative Commons Attribution-ShareAlike 3.0.', 0.5),
    ('winter/win1.musicxml', 'winter.mxl', 'Winter, 1st movement', 'Antonio Vivaldi',
     'Mutopia Project #351, typeset by smailliw.' + CONV + ' Tempo changed to crotchet = 80. Licensed under Creative Commons Attribution-ShareAlike 3.0.', 0),
    ('serenade/s2.musicxml', 'serenade.mxl', 'Serenade, 1st movement', 'Wolfgang Amadeus Mozart',
     'Mutopia Project #900 (Eine kleine Nachtmusik K. 525).' + CONV + ' Public Domain.', 0),
]
os.makedirs(os.path.join(H, 'out', 'xml'), exist_ok=True)
for src, name, title, comp, rights, pick in T:
    args = [sys.executable, '-I', os.path.join(H, 'pack.py'), os.path.join(H, 'conv', src), os.path.join(H, 'out', 'xml', name), title, comp, rights]
    if pick: args.append(str(pick))
    print(name, subprocess.run(args, capture_output=True, text=True, check=True).stdout.strip().replace('\n', ' | '))
