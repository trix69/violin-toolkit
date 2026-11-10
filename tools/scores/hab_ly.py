"""Habanera (Bizet), violin + piano, from RSB's arrangement (2012, CC BY 3.0; IMSLP #259809), read bar by bar
(Audiveris draft checked against the scan). Bars written straight through; repeats/endings added to the MusicXML
by add_repeat.py (python-ly mishandles \\alternative). Usage: hab_ly.py out.ly"""
import sys

def rh_std(c1, c2, c3):          # chord on the beat, rest, two chords
    return '%s8 r8 %s8 %s8' % (c1, c2, c3)

LB = {'A': "d,8 r16 a,16( f8) a,8", 'B': "d,8 r16 bes,16( g8) bes,8", 'C': "d,8 r16 a,16( g8) a,8",
      'D': "d,8 r16 a,16( fis8) a,8", 'E': "d,8 r16 b,16( g8) b,8", 'F': "d,8 r16 cis16( a8) a,8"}
# violin, bars 1-49 (absolute pitches)
VN = """R2 | R2 | R2 |
r4 d'''8 cis''' |
\\times 2/3 { c'''8 c''' c''' } b''8 bes'' |
a''8 a''16 a'' gis''8 g'' |
\\times 2/3 { f''16( g'' f'') } e''16( f'') g''8 f'' |
e''8 r8 d'''8 cis''' |
\\times 2/3 { c'''8 c''' c''' } b''8 bes'' |
a''16 a'' r16 a''16 g''8 f'' |
\\times 2/3 { e''16( f'' e'') } d''16( e'') f''8 e'' |
d''4( d'''8) cis''' |
\\times 2/3 { c'''8 c''' c''' } b''8 bes'' |
a''16 a'' r16 a''16 gis''8 g'' |
\\times 2/3 { f''16( g'' f'') } e''16( f'') g''8 f'' |
e''4( d'''8) cis''' |
\\times 2/3 { c'''8 c''' c''' } b''8 bes'' |
a''16 a'' r16 a''16 g''8 f'' |
\\times 2/3 { e''16( f'' e'') } d''16( e'') f''8 e'' |
d''4. r8 |
r4 fis''4 |
a''4. r8 |
r4 d'''4 |
b''4. r8 |
r4 e''4 |
e'''4. r8 |
r4 a''4 |
d'''8 r16 a''16 d''8 e'' |
fis''8. a''16 fis''8 e'' |
d''8. e''16 fis''8 g'' |
a''16 a'' a'' a'' b''8 a'' |
g''8 r16 b''16 e''8 fis'' |
g''8. b''16 g''8 fis'' |
e''8.( fis''16) g''16 r16 a''8 |
b''16 b'' b'' b'' cis'''8 b'' |
a''4~ a''8 r8 |
r8. a''16 fis''8 e'' |
d''8. e''16 fis''8 g'' |
a''16 a'' a'' a'' d'''8 cis''' |
\\grace a''8 g''4~ g''8 r8 |
r8. b''16 g''8 fis'' |
e''8 fis''16 r16 g''8 a'' |
\\times 2/3 { cis'''8\\fermata b'' a'' } \\times 2/3 { g''8( fis''8\\fermata) e'' } |
d''2~ |
d''8 r8 r4 |
R2 |
R2 |
cis'''16( b'') gis'' a'' fis'''8.\\fermata \\grace { e'''32 fis''' } e'''16 |
d'''4~ d'''8 r8\\fermata |"""
RH = {}
dm = {5: ("<d' f' c''>", "<d' f' b'>", "<d' f' bes'>"), 6: ("<d' f' a'>", "<a d' gis'>", "<a d' g'>"),
      7: ("<a d' f'>", "<a d' g'>", "<a d' f'>"), 8: ("<bes d' e'>", "<d' e' d''>", "<d' e' cis''>"),
      9: ("<d' e' c''>", "<d' e' b'>", "<d' e' bes'>"), 10: ("<d' e' a'>", "<bes d' g'>", "<bes d' f'>"),
      11: ("<g cis' e'>", "<cis' f'>", "<g cis' e'>"), 12: ("<f d'>", "<d' f' d''>", "<d' f' cis''>")}
for b, c in dm.items(): RH[b] = rh_std(*c); RH[b + 8] = rh_std(*c)
RH[4] = "r4 <d' f' d''>8 <d' f' cis''>8"
RH[20] = rh_std("<f d'>", "<d'' fis'' d'''>", "<d'' fis'' c'''>")
RH[21] = "\\times 2/3 { <d'' f'' c'''>8 c''' c''' } <d'' f'' bes''>8 <d'' f'' bes''>8"
RH[22] = "<d'' fis'' a''>8 r16 a''16( <a' d'' gis''>8) <a' d'' g''>8"
RH[23] = "\\times 2/3 { <a' d'' fis''>16( g'' fis'' } e'' fis'') <a' d'' g''>8 <a' d'' fis''>8"
RH[24] = rh_std("<g' b' d'' e''>", "<d'' e'' g'' d'''>", "<d'' e'' g'' cis'''>")
RH[25] = "\\times 2/3 { <d'' e'' g'' c'''>8 c''' c''' } <d'' e'' b''>8 <d'' e'' ais''>8"
RH[26] = "<d'' e'' a''>8 r16 a'16( <b' d'' g''>8) <b' d'' fis''>8"
RH[27] = "\\times 2/3 { <g' cis'' e''>16( fis'' e'' } d'' e'') <g' cis'' fis''>8 <g' cis'' e''>8"
for b, c in {28: ("<fis' d''>", "d'", "<a e'>"), 29: ("<d' fis'>", "<d' fis'>", "<a e'>"), 30: ("<fis d'>", "<d' fis'>", "<e' g'>"),
             31: ("<fis' a'>", "<g' b'>", "<fis' a'>"), 32: ("<e' g'>", "e'", "<b fis'>"), 33: ("<e' g'>", "<e' g'>", "<b fis'>"),
             34: ("<g e'>", "<e' g'>", "<fis' a'>"), 35: ("<g' b'>", "<a' cis''>", "<g' b'>"), 37: ("<fis'' d''' fis'''>", "<d' fis'>", "<a e'>"),
             38: ("<fis d'>", "<d' fis'>", "<e' g'>"), 39: ("<fis' a'>", "<b' d''>", "<a' cis''>"), 41: ("<g'' e''' g'''>", "<e' g'>", "<b fis'>"),
             42: ("<g e'>", "<e' g'>", "<fis' a'>")}.items():
    RH[b] = rh_std(*c)
RH[36] = "<fis' a'>8 r16 a''16( <d'' fis'' d'''>8) <e'' a'' e'''>8"
RH[40] = "<e' g'>8 r16 b''16( <e'' b'' e'''>8) <fis'' b'' fis'''>8"
RH[43] = "<e' g' cis''>8 r8 r4\\fermata"
RH[44] = "d''8 r16 a''16( fis'''8) a''8"
RH[45] = "d''8 r16 a'16( fis''8) a'8"
RH[46] = "d'8 r16 a16( fis'8) a8"
RH[47] = "R2"
RH[48] = "<e' g' cis''>4~ <e' g' cis''>8 r8\\fermata"
RH[49] = "<d' fis' a' d''>8 r16 a''16( <d'' d'''>8) r8\\fermata"
for b in (1, 2, 3): RH[b] = "R2"
LHK = {}
for b in list(range(1, 8)) + list(range(12, 16)): LHK[b] = 'A'
for b in (8, 9, 10, 16, 17, 18): LHK[b] = 'B'
for b in (11, 19): LHK[b] = 'C'
for b in (20, 22, 23, 28, 29, 30, 31, 36, 37, 38, 39, 44, 45, 46, 47): LHK[b] = 'D'
LHK[21] = 'A'
for b in (24, 25, 26, 32, 33, 34, 40, 41, 42): LHK[b] = 'E'
LHK[27] = 'C'; LHK[35] = 'F'
LH = {b: LB[k] for b, k in LHK.items()}
LH[43] = "<d, a,>8 r8 r4\\fermata"
LH[48] = "<d, a,>4~ <d, a,>8 r8\\fermata"
LH[49] = "<d a>8 r16 a,16( <d, d>8) r8\\fermata"
vn = [x.strip() for x in VN.split('|') if x.strip()]
assert len(vn) == 49, len(vn)
key = lambda b: ''
rh = ' |\n  '.join(key(b) + RH[b] for b in range(1, 50)) + ' |'
lh = ' |\n  '.join(key(b) + LH[b] for b in range(1, 50)) + ' |'
out = r"""\version "2.18.2"
violin = { \clef treble \key d \minor \time 2/4 \tempo 4 = 72 %s }
rh = { \clef treble \key d \minor \time 2/4 %s }
lh = { \clef bass \key d \minor \time 2/4 %s }
\score { <<
  \new Staff = "violin" << \set Staff.instrumentName = "Violin" \violin >>
  \new Staff = "rh" << \set Staff.instrumentName = "Piano" \rh >>
  \new Staff = "lh" << \set Staff.instrumentName = "Piano" \lh >>
>> }
""" % (' |\n  '.join(vn) + ' |', rh, lh)
open(sys.argv[1], 'w').write(out)
print('ok 49 bars')
