"""Por una Cabeza (Gardel / Le Pera, 1935), violin + piano, from Adam Cuerden's edition (2008, CC BY 3.0;
IMSLP #295296): the voice line (Canto) as the violin, the piano as printed with its inner voices merged into
chords. Read bar by bar from the edition (staff-guide crops; Audiveris's draft was not usable). Written spelling;
the verse (bars 1-16) in A major, the refrain (17-31) in A minor, as the edition (its later systems omit the
A-major signature, but its accidentals - the double sharp in bar 5 - show it is meant). The Chorus staff is left
out. Bars written straight through, pickup first; the repeat (bar 1 to the 1st ending) is added to the MusicXML
by pc_repeat.py. Usage: pc_ly.py out.ly"""
import sys

VN = [  # pickup, bars 1-31, 1st ending (32), 2nd ending (33); absolute pitches
    "cis'16 d' dis' e'",
    "fis'8 e' dis'16 e' fis' gis'", "b'8 a' cis''16 d'' b' cis''", "a'16 b'8 gis'16 a' gis'8 e'16", "d'4 d''16 cis'' e'' d''",
    "b'4 b'16 ais' cis'' b'", "gis'4 gis'16 a' ais' b'", "cis''16 b' gis' fis' e' gis' e' d'", "cis'4 cis'16 d' dis' e'",
    "fis'8 e' dis'16 e' fis' gis'", "b'8 a' a'16 b' cis'' a'", "b'16 a' b' cis'' b'8 a'", "fis'4 b'16 a' fis' d'",
    "cis'16 b cis' d' f' a' g' f'", "a'8 e' a'16 b' cis'' a'", "b'8 fis' gis'16 a' b' gis'", "a'4 r4",
    "r8 c'' c'' d''16 e''", "e''4 b'", "r8 a' a' b'16 c''", "c''4 g'",
    "r8 f' f' g'16 a'", "a'8 e' a'16 b' c'' a'", "b'8 fis' a'16 b' c'' a'", "c''4 b'",
    "r8 c'' c'' d''16 e''", "e''4 b'", "r8 a' a' b'16 c''", "c''4 g'",
    "r8 f' f' g'16 a'", "a'8 e' a'16 b' c'' a'", "b'8 fis' gis'16 a' b' gis'",
    "a'4 cis'16 d' dis' e'", "a'4~ a'8 r8",
]
R18, R19, R20 = "<e'' g'' b'' e'''>4 <b' e'' g'' b''>4", "r8 <a' d'' f'' a''>8 <a' d'' f'' a''>8 <b' b''>16 <c'' c'''>16", "<c'' e'' g'' c'''>4 <g' c'' e'' g''>4"
R21, R22 = "r8 <f' a' d'' f''>8 <f' a' d'' f''>8 <g' g''>16 <a' a''>16", "<a' c'' e'' a''>8 <e' e''>8 <e' a'>16 b' c'' a'"
RH = [
    "cis'16 d' dis' e'",
    "fis'8 e' dis'16 e' <d' fis'> gis'", "<e' b'>8 a' cis''16 d'' b' cis''", "a'16 b'8 gis'16 a' gis'8 e'16", "d'4 d''16 cis'' e'' d''",
    "<fis' b'>4 <gis' b'>16 ais' cis'' b'", "gis'4 gis'16 a' ais' b'", "cis''16 b' gis' fis' <b e'>16 gis' <bis e'>16 d'", "cis'4 cis'16 d' dis' e'",
    "fis'8 e' dis'16 e' <d' fis'> gis'", "b'8 a' a'16 b' cis'' a'", "<cis' e' b'>16 a' b' cis'' <cis' e' b'>8 a'", "<d' fis'>4 b'16 a' fis' d'",
    "cis'16 b cis' d' f' a' g' f'", "<e' a'>8 e' <e' a'>16 b' cis'' a'", "<dis' b'>8 fis' <d' gis'>16 a' b' gis'", "<cis' a'>4~ <cis' a'>8 r8",
    "r8 <c'' c'''>8 <c'' c'''>8 <d'' d'''>16 <e'' e'''>16", R18, R19, R20,
    R21, R22, "<dis' b'>8 fis' <e' a'>16 b' c'' a'", "<dis' fis' c''>4 <e' gis' b'>16 e' dis' d'",
    "c'8 <c'' e'' a'' c'''>8 <c'' e'' a'' c'''>8 <d'' d'''>16 <e'' e'''>16", R18, R19, R20,
    R21, R22, "b'8 fis' gis'16 a' b' gis'",
    "<c' a'>4 cis'16 d' dis' e'", "a'4~ a'8 r8",
]
L18, L19, L20 = "<g, f>8 <g c' e'>8 <g c' e'>16 <g, g>8 <fis, fis>16", "<f, f>8 <f a d'>8 <f a d'>8 <f, f>8", "<e, e>8 <e g c'>8 <e g c'>16 <e, e>8 <es, es>16"
L21 = "<d, d>8 <d f a>8 <d f a>8 <d, d>8"
LH = [
    "r4",
    "a,8 <e cis'>8 r8 bis,8", "cis8 <e a>8 r8 e8", "<cis e a>16 <cis e a>8 <cis e a>16 <c e a>8 <cis e a>8", "<b, e gis>16 gis,16 a, ais, b,8 cis8",
    "d8 <b d'>8 <b d'>8 dis8", "e16 ais b cis' <e d'>16 fis8 f16", "<e gis d'>8 <e gis d'>8 e,8 <d e gis>8", "<a, cis e>4 r4",
    "a,8 <e cis'>8 r8 bis,8", "cis8 <e a>8 r8 e8", "<a, cis g>8 <a, cis g>8 <a, cis g>8 <a, cis g>8", "<d, a, fis>16 a,16 d16 <a, e>16 <d fis>8 r8",
    "<d f a>4 <d a b>4", "cis8 <e a>8 fis,8 <cis e a>8", "b,8 <fis a>8 e,8 <e gis>8", "<a, a>8 e8 a,8 <e, d e gis>8",
    "<a,, a, c e a>8 r8 <a, a>4", L18, L19, L20,
    L21, "<c, c>8 <c e a>8 <c e a>8 <c e a>8", "b,8 <a b>8 <fis d'>16 gis a fis", "<a c'>4 <gis b>16 e fis gis",
    "a8 r8 <a, a>4", L18, L19, L20,
    L21, "<c, c>8 <c e a>8 <c a>4", "<b, fis a>4 <f b>8 e8",
    "<a, a>8 e8 a,8 r8", "<a, a>8 e8 a,8 r8",
]
assert len(VN) == len(RH) == len(LH) == 34


def part(bars):   # the key change to A minor at bar 17 is added by pc_repeat.py (python-ly writes stray backups there)
    return ' |\n  '.join(bars) + ' |'


ly = r"""\version "2.12.3"
violin = { \clef treble \key a \major \time 2/4 \tempo 4 = 66 %s }
rh = { \clef treble \key a \major \time 2/4 %s }
lh = { \clef bass \key a \major \time 2/4 %s }
\score { <<
  \new Staff = "violin" << \set Staff.instrumentName = "Violin" \violin >>
  \new Staff = "rh" << \set Staff.instrumentName = "Piano" \rh >>
  \new Staff = "lh" << \set Staff.instrumentName = "Piano" \lh >>
>> }
""" % (part(VN), part(RH), part(LH))
open(sys.argv[1], 'w').write(ly)
print('ok', len(VN), 'bars')
