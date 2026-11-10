"""Le Cygne (Saint-Saëns), violin + piano, from Durand's violin transcription (D.S. 3891, n.d. [1888], public domain;
IMSLP #27110): violin from the separate violin part page, piano from the score, read bar by bar (Audiveris draft
checked and corrected against the scan). Writes cygne.ly (absolute pitches). Usage: cygne_ly.py out.ly"""
import re, sys

def ly(p):
    """'F#4' -> fis'  ;  'Bb2' -> bes,"""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', p); L, acc, o = m.group(1).lower(), m.group(2), int(m.group(3))
    return L + {'#': 'is', 'b': 'es', '': ''}[acc] + ("'" * (o - 3) if o > 3 else ',' * (3 - o))

def arp(notes, beats=1):
    """one beat (or more) of the right hand's 16th-note arpeggio: 4 notes per beat"""
    n = notes.split()
    return ' '.join(ly(x) + ('16' if i == 0 else '') for i, x in enumerate(n * beats))

def eighths(notes):
    n = notes.split()
    return ' '.join(ly(x) + ('8' if i == 0 else '') for i, x in enumerate(n))

G = 'B3 D4 B4 G4'; AM = 'C4 E4 C5 A4'; AMF = 'C4 F#4 C5 A4'
LG = 'G2 D3 G3 D3 G2 D3'; LAE = 'G2 E3 A3 E3 G2 E3'; LGD = 'G2 D3 A3 D3 G2 D3'
# right hand: per bar, list of (pattern, beats); left hand: per bar, the 12 eighths (two halves) or literal ly
RH = {
 1: [(G, 6)], 2: [(G, 6)], 3: [(AM, 6)], 4: [(AM, 3), (AMF, 3)], 5: [(G, 6)], 6: [(G, 6)],
 7: [('C#4 E4 C#5 A#4', 6)], 8: [('B3 D4 B4 F#4', 3), ('A#3 E4 A#4 F#4', 3)], 9: [('D4 F#4 B4 F#4', 6)],
 10: [('D4 G4 D5 B4', 3), ('C#4 E4 C#5 G4', 3)], 11: [('C4 D4 C5 G4', 3), ('C4 D4 C5 F#4', 3)],
 12: [('C4 F4 C5 A4', 3), ('B3 D4 B4 F4', 3)], 13: [('Bb3 C4 Bb4 F4', 3), ('Bb3 C4 Bb4 E4', 3)],
 14: [('A3 E4 A4 E4', 2), ('A3 B3 A4 D4', 1), ('A3 C4 A4 E4', 3)], 15: [('A3 D4 A4 F#4', 3), ('A3 C4 A4 E4', 3)],
 16: [('A3 B3 A4 D4', 3), ('A3 C#4 A4 E4', 3)],
 17: [('A3 D4 A4 F4', 1), ('B3 D4 A4 F4', 1), ('C4 D4 A4 F4', 1), ('C4 D4 A4 F#4', 1), ('C4 D4 B4 F#4', 1), ('C4 D4 C5 F#4', 1)],
 18: [(G, 6)], 19: [(AM, 6)], 20: [(AM, 3), (AMF, 3)], 21: [('B3 D4 B4 F4', 3), ('D4 G#4 D5 B4', 3)],
 22: [(AM, 3), (AMF, 3)],
}
LH = {
 1: LG + ' ' + LG, 2: LG + ' ' + LG, 3: LAE + ' ' + LAE, 4: LAE + ' ' + LGD, 5: LG + ' ' + LG, 6: LG + ' ' + LG,
 7: 'G2 E3 A3 E3 G2 E3 F#2 E3 A3 E3 F#2 E3', 8: 'F#2 D3 F#3 D3 F#2 D3 F#2 C#3 F#3 C#3 F#2 C#3',
 9: 'B2 F#3 B3 F#3 B2 F#3 B2 F#3 B3 F#3 B2 F#3', 10: 'B2 D3 B3 D3 B2 D3 Bb2 D3 Bb3 D3 Bb2 D3',
 11: 'A2 D3 A3 D3 A2 D3 D2 D3 A3 D3 D2 D3', 12: 'A2 C3 A3 C3 A2 C3 Ab2 C3 Ab3 C3 Ab2 C3',
 13: 'G2 C3 G3 C3 G2 C3 C2 C3 G3 C3 C2 C3', 14: 'F2 A2 F3 A2 F2 A2 E2 A2 E3 A2 E2 A2',
 15: 'D2 A2 D3 A2 D2 A2 E2 A2 E3 A2 E2 A2', 16: 'F2 A2 F3 A2 F2 A2 E2 A2 E3 A2 E2 A2',
 17: 'D2 A2 D3 A2 D2 A2 C3 C2 B2 B1 A2 A1', 18: LG + ' ' + LG, 19: LAE + ' ' + LAE, 20: LAE + ' ' + LGD,
 21: 'G2 D3 G3 D3 F2 B2 E2 B2 G#3 B2 E2 B2', 22: 'A2 E3 A3 E3 A2 E3 A2 F#3 A3 F#3 A2 F#3',
}
rh, lh = [], []
for b in range(1, 23):
    rh.append(' '.join(arp(p, k) for p, k in RH[b]) + ' |')
    lh.append(eighths(LH[b]) + ' |')
# bars 23-28 written out
rh += [
 arp(G, 3) + " <a c' e' g'>2. |",                                                     # 23
 "b16 d' b' g' d' g' d'' b' g' b' g'' d'' r2. |",                                       # 24
 "b16 e' b' g' e' g' e'' b' g' b' g'' e'' <a' c''>8 r8 r4 r4 |",                       # 25 (Lento)
 "r4 e'''16 g''' e'''' b''' d''' g''' d'''' b''' b'' e''' b''' g''' b'' d''' b''' g''' e''' g''' e'''' b''' |",  # 26, 8va
 "d''16 g'' d''' b'' b' e'' b'' g'' b' d'' b'' g'' e' g' e'' b' d' g' d'' b' b d' b' g' |",  # 27
 "b8 r8 r4 r4 r2.\\fermata |",                                                        # 28
]
lh += [
 eighths(LG) + " <e, e>2. |",                                                          # 23
 "d8 g b g d' b r2. |",                                                                 # 24 (grace d, left out)
 "<d, d>4 r4 r4 d'8 r8 r4 r4 |",                                                        # 25: the m.g. D with the chord
 "r4 b''8 e'' b'' d'' e'' b' d'' b' b' e' |",                                           # 26 (treble clef in the print)
 "b'8 d' e' b d' b b e b d g d |",                                                      # 27
 "g,8 r8 r4 r4 r2.\\fermata |",                                                        # 28
]
vn = r"""
  R1. |
  g''4\p( fis'' b') e''( d'' g') |
  a'2~( a'8 b' c''2) r4 |
  e'2 fis'8 g' a' b' c'' d'' e'' fis'' |
  b''2.~ b''8 r8 r4 r4 |
  g''4( fis'' b') e''( d'' g') |
  ais'2~( ais'8 b' cis''2.) |
  fis'4.( gis'8) ais' b' cis'' d'' e'' fis'' gis'' ais'' |
  d'''2.~ d'''8 r8 r4 r4 |
  d'''4( b'' g'') e''( fis'' g'') |
  d''2~( d''8 e'' fis''2) r4 |
  c'''4( a'' f'') d''( e'' f'') |
  c''2~( c''8 d'' e''2) r4 |
  e''4\<( a' b') c''2 d''8 e''\! |
  fis''2.\>( e''2)\! r4 |
  e''4\<( a' b') cis''2 d''8 e''\! |
  f''2.\>( fis''2.)\! |
  g''4\p( fis'' b') e''( d'' g') |
  a'2~( a'8 b' c''2) r4 |
  e'2 fis'8 g' a' b' c'' d'' e'' fis'' |
  b''1.\< |
  b''4\mf( a'' e'') g''( fis'' c'') |
  e''4( d'' g') a'( b' g') |
  b'2.-^ c''4\>( d'' b')\! |
  e''2. e''4( fis'' d'') |
  g''1.\pp~ |
  g''2. ~ g''8 r8 r4 r4 |
  R1.\fermata |
"""
out = r"""\version "2.18.2"
violin = { \clef treble \key g \major \time 6/4 \tempo 4 = 54 %s }
rh = { \clef treble \key g \major \time 6/4 %s }
lh = { \clef bass \key g \major \time 6/4 %s }
\score { <<
  \new Staff = "violin" << \set Staff.instrumentName = "Violin" \violin >>
  \new Staff = "rh" << \set Staff.instrumentName = "Piano" \rh >>
  \new Staff = "lh" << \set Staff.instrumentName = "Piano" \lh >>
>> }
""" % (vn, '\n  '.join(rh), '\n  '.join(lh))
open(sys.argv[1], 'w').write(out)
print('bars rh', len(rh), 'lh', len(lh), 'vn', vn.count('|'))
