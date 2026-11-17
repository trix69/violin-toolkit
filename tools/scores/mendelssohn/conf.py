# Mendelssohn, Violin Concerto in E minor, Op. 64, 1st movement, bars 1-48 (to the first Tutti's E minor), from the composer's
# violin and piano version, Leipzig: Breitkopf und Härtel, n.d. [1845], plate 7210 (IMSLP #872023, Public Domain)
NAMES = ['Violin', 'Piano', 'Piano']; PROG = [41, 1, 1]
CLEF = [('G', 2), ('G', 2), ('F', 4)]
KEY = lambda b: 1; MODE = 'minor'
TIME = (2, 2)
TEMPO = {1: ('Allegro molto appassionato', 200)}   # minim = 100
FWD = set(); BWD = set(); LAST = 48
TITLE = 'Violin Concerto in E minor, Op. 64, 1st movement (opening)'; COMPOSER = 'Felix Mendelssohn'
RIGHTS = 'Violin from the violin part (IMSLP #913234); from the composer\'s violin and piano version, Breitkopf und Härtel [1845], plate 7210 (IMSLP #872023, public domain); engraved by Violin Toolkit 2026, CC0 1.0'
# the solo part's slurs, accents, staccato and dynamics, read bar by bar from the violin part (IMSLP #913234, p. 3; Hermes F122,
# Trix: "the missing slurs and dynamics"). Offsets in crotchets into the 2/2 bar; a triplet quaver is 1/3. Not written: the
# orchestra's cue in bars 1-2 and the "4ta" (G string) line over bars 36-38.
T = 1 / 3
def S(b0, o0, b1, o1): return (1, b0, o0, 'slur', (b1, o1))
def A(b, o): return (1, b, o, 'acc', None)
def D(b, o, v): return (1, b, o, 'dyn', v)
def ST(b, o): return (1, b, o, 'stacc', None)
MARKS = [D(2, 2, 'p'),
    S(3, 0, 3, 2), S(4, 0, 4, 2), S(4, 3, 5, 3), S(7, 0, 7, 1.5), S(8, 0, 8, 3), S(9, 0, 9, 1.5), S(10, 0, 10, 2),
    S(11, 0, 11, 2), S(12, 0, 12, 2), S(12, 3, 13, 3), S(14, 3, 15, 0), S(15, 2, 15, 2.5), S(15, 3, 15, 3.5), S(16, 0, 16, 1.5),
    S(17, 0, 17, 3), S(18, 0, 18, 2), S(18, 3, 18, 3.5), S(19, 2, 19, 2.5), S(19, 3, 19, 3.5), S(20, 0, 20, 1.5), S(20, 2, 20, 3),
    (1, 20, 0.5, 'words', 'cresc.'),
    S(21, 0, 21, 3), ST(21, 3), S(22, 0, 22, 3), ST(22, 3), S(23, 0, 23, 3), ST(23, 3),
    D(25, 0, 'f'), S(25, 0, 25, 2), S(25, 2 + T, 26, 0), A(26, 0), S(26, T, 26, 2), A(26, 2), S(26, 2 + T, 27, 0), A(27, 0),
    S(27, T, 27, 2), A(27, 2), S(27, 2.5, 27, 3), ST(27, 3.5),
    ST(28, 0), ST(28, 0.5), ST(28, 1), ST(28, 1.5), D(28, 2, 'sf'),
    S(29, 0, 29, 2), S(29, 2 + T, 30, 0), A(30, 0), S(30, T, 30, 2), A(30, 2), S(30, 2 + T, 31, 0), A(31, 0),
    S(31, T, 31, 2), A(31, 2), S(31, 2.5, 31, 3),
    ST(32, 0), ST(32, 0.5), ST(32, 1), ST(32, 1.5), D(32, 2, 'sf'),
    D(33, 1, 'mf'), S(33, 1, 33, 1 + 2 * T), A(33, 2), S(33, 2 + T, 34, 0), A(34, 0), S(34, T, 34, 2), A(34, 2), S(34, 3, 35, 0),
    A(35, 0), S(35, T, 35, 2), A(35, 2), S(35, 2 + T, 36, 0), A(36, 0), S(36, T, 36, 2), A(36, 2), S(36, 3, 36, 3 + 2 * T),
    (1, 36, 3, 'words', 'cresc.')]
for b in (37, 38): MARKS += [S(b, o, b, o + 2 * T) for o in (0, 1, 2, 3)]
MARKS += [S(39, 0, 39, 1 + 2 * T), S(39, 2, 39, 2 + 2 * T), S(39, 3, 39, 3 + 2 * T), D(40, 0, 'sf'), D(40, 3, 'f'),
    S(44, 3 + T, 44, 3 + 2 * T)]
for b in (45, 46): MARKS += [S(b, o + T, b, o + 2 * T) for o in (0, 1, 2, 3)]
