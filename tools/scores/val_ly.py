"""Chopin, Grande Valse brillante Op. 18, opening section (bars 1-69, to the key change), from the arrangement for
violin and piano rev. Fr. Seitz (Hamburg: Anton J. Benjamin, Musikalisches Universum No. 998/2685, plate A.J.B. 3298;
public domain; IMSLP #24059), read bar by bar (Audiveris draft checked against the scan). Repeat 5-20 with endings
20 / 21 added by add_marks.py. Usage: val_ly.py out.ly"""
import sys
A = ["d''4-.( fis''8 g'' a''4)", "d''4-.( g''8 a'' b''4)", "d''4-.( a''8 b'' c'''4)", "d'''2\\fz d'''4\\p",
     "d'''4( e'''8 d''' c'''4)", "c'''4( d'''8 c''' b''4)", "b''4( c'''8 b'' a''4)", "a''4( b''8 a'' g''4)"]
A2 = ["d''4-.\\mf( fis''8 g'' a''4)", "d''4-.( g''8 a'' b''4)", "d''4-.( a''8 b'' c'''4)", "d'''2\\fz d'''4\\mf",
      "f''8( d''' e''' d''' c'''4)", "ees''8( c''' d''' c''' b''4)", "d''8( b'' c''' b'' a''4)"]
B = ["g''8\\p g'' g'' g'' g'' g''", "a''8( g'' e'' c'' g' gis')", "a'8 a' a' a' a' a'", "g'8( c'' e'' g'' c''' gis'')",
     "a''8 a'' a'' a'' a'' a''", "\\times 2/3 { a''8( b'' a'' } g''8 c''') e''4", "a''4( g''8 f'' b'4)", "d''4( c''8 g' e'4)"]
B2end = ["a''4( g''8 f'' b'4)", "c''2 e''4\\trill"]
VN = (["R2.", "R2.", "R2.", "r4 r4 d''8-.\\mf d''-."] + A + A2 + ["g''4 d''8-. d''-. d''-. d''-.", "g''4 g''8-.\\p g''-. g''-. g''-."]
      + B + B[:6] + B2end
      + A + ["d''8( fis'' g'' gis'' a''4)", "d''8( fis'' g'' a'' b''4)", "d''8( gis'' a'' b'' c'''4)", "d'''2\\fz d'''4\\p"]
      + A2[4:] + ["g''4 g''8 g'' g'' g''"]
      + B + B[:6] + ["a''4( g''8 f'' b'4)", "c''4 r2"])
ARH = ["d''4-. r4 fis''4-.", "d''4-. r4 g''4-.", "d''4-. r4 a''4-.", "<f'' b''>2 <f'' b''>8-. <f'' b''>8-.",
       "<f'' b''>2 e''4", "ees''2 d''4", "d''2 c''4", "c''2 b'4"]
ARH2 = ["d''4-. r4 fis''4-.", "d''4-. r4 g''4-.", "d''4-. r4 a''4-.", "<f'' b''>2 r4", "r4 <c' a'>4 r4", "r4 <b g'>4 <b g'>4",
        "r4 <a fis'>4 <d' fis'>4"]
ALH = ["d4 <a c' d'>4 <a c' d'>4", "g4 <b d'>4 <b d'>4", "fis4 <c' d'>4 <c' d'>4", "g4 <d' f'>4 gis4",
       "a4 <c' a'>4 c4", "d4 <b g'>4 <b g'>4", "d4 <a fis'>4 <a fis'>4", "g4 <d' g'>4 <d' g'>4"]
ALH2 = ALH[:4] + ["a4 r4 c4", "d4 r4 r4", "<d, d>4 r4 r4"]
BRH = ["r4 <g c' e'>4 <g c' e'>4", "r4 <g c' e'>4 <g c' e'>4", "r4 <fis c' ees'>4 <fis c' ees'>4", "r4 <g c' e'>4 <g c' e'>4",
       "r4 <c' d' a'>4 <c' d' a'>4", "r4 <c' e' g'>4 <c' e' g'>4", "r4 <b f' g'>4 <b f' g'>4", "r4 <c' e' g'>4 <c' e' g'>4"]
BLH = ["<c, c>4 r4 r4"] * 4 + ["<f, f>4 r4 r4", "<g, g>4 r4 r4", "<g, g>4 r4 r4", "c4 r4 r4"]
BRH2 = BRH[:4] + ["r4 <c' d' a'>4 <c' d' a'>4", "r4 <c' e' g'>4 <c' e' g'>4", "r4 <d' f' g'>4 <d' f' g'>4", "r4 <e' c''>4 <a' c''>4"]
BLH2 = BLH[:4] + ["<f, f>4 r4 r4", "<g, g>4 r4 r4", "<g,, g,>4 r4 r4", "<c, c>4 r4 r4"]
DD = "<d' d''>"
RH = ([DD + "2-> " + DD + "8-. " + DD + "8-.", DD + "2-> " + DD + "8-. " + DD + "8-.", DD + "4-> " + DD + "8-. " + DD + "8-. " + DD + "4->",
       DD + "8-. " + DD + "8-. " + DD + "4-> " + DD + "8-. " + DD + "8-."]
      + ARH + ARH2 + ["<b g'>4 r4 r4", "r4 <b g'>4( <b f'>4)"]
      + BRH + BRH2
      + ARH + ARH2[:4] + ["r4 <c' a'>4 r4", "r4 <b g'>4 <b g'>4", "r4 <a fis'>4 <d' fis'>4", "<b g'>4 r4 r4"]
      + BRH + BRH2[:7] + ["<c' e' g'>4 r2"])
LH = (["R2."] * 4 + ALH + ALH2 + ["<g, d>4 r4 r4", "g,4( d4 g4)"]
      + BLH + BLH2
      + ALH + ALH[:4] + ["a4 r4 c4", "d4 r4 r4", "<d, d>4 r4 r4", "<g, d>4 r4 r4"]
      + BLH + BLH2[:7] + ["<c, c>4 r2"])
assert len(VN) == len(RH) == len(LH) == 69, (len(VN), len(RH), len(LH))
j = lambda xs: ' |\n  '.join(xs) + ' |'
out = r"""\version "2.18.2"
violin = { \clef treble \key g \major \time 3/4 \tempo 4 = 160 %s }
rh = { \clef treble \key g \major \time 3/4 %s }
lh = { \clef bass \key g \major \time 3/4 %s }
\score { <<
  \new Staff = "violin" << \set Staff.instrumentName = "Violin" \violin >>
  \new Staff = "rh" << \set Staff.instrumentName = "Piano" \rh >>
  \new Staff = "lh" << \set Staff.instrumentName = "Piano" \lh >>
>> }
""" % (j(VN), j(RH), j(LH))
open(sys.argv[1], 'w').write(out)
print('69 bars')
