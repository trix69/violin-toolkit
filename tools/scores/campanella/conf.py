# Paganini, Violin Concerto No. 2 in B minor, Op. 7, 3rd movement (Rondo, "La campanella"): the solo theme and the tutti's
# answer, the upbeat and bars 1-42: theme, tutti, the first solo episode ("A"), the theme again, to the tutti (bar 42). From Philipp Scharwenka's edition
# for violin and piano, Leipzig: Breitkopf & Haertel, n.d. [ca. 1896], plate 21008: violin part (IMSLP #774280) and piano
# score (IMSLP #774279), Public Domain. In the tutti the violin plays the tune, as printed in the violin part.
NAMES = ['Violin', 'Piano', 'Piano']; PROG = [41, 1, 1]
CLEF = [('G', 2), ('G', 2), ('F', 4)]
KEY = lambda b: 2; MODE = 'minor'
TIME = (6, 8)
PICKUP = 2
TEMPO = {0: ('Andantino allegretto moderato', 114)}   # dotted crotchet = 76: recordings of the whole Rondo average 77-85 (Trix: 56 was slow)
FWD = set(); BWD = set(); LAST = 42
TITLE = 'La Campanella (Violin Concerto No. 2, Rondo)'; COMPOSER = 'Niccolò Paganini'
RIGHTS = 'From Philipp Scharwenka\'s edition for violin and piano, Breitkopf & Haertel [ca. 1896], plate 21008 (IMSLP #774280, #774279, public domain); engraved by Violin Toolkit 2026, CC0 1.0'
# the violin part's dynamics, hairpins and bowings, read from the scan (IMSLP #774280, printed p. 10; Trix: f, ff and the
# down-bows were missing). Bars are ours (0 = the upbeat); offsets in crotchets into the bar.
MARKS = [
    (1, 0, 0, 'dyn', 'f'), (1, 0, 0, 'bow', 'down'), (1, 0, 0.5, 'cresc', 2),
    (1, 4, 1, 'bow', 'down'), (1, 4, 1.5, 'cresc', 3),
    (1, 8, 0, 'dyn', 'ff'),
    (1, 16, 1, 'dyn', 'p'), (1, 16, 1, 'bow', 'up'),
    (1, 24, 0, 'cresc', 1.5), (1, 24, 1.5, 'dim', 3),
    (1, 26, 1.5, 'dim', 3), (1, 28, 1.5, 'dim', 3),
    (1, 29, 0.5, 'cresc', 1.5), (1, 29, 1.5, 'dim', 3),
    (1, 31, 0, 'cresc', 1.5), (1, 31, 1.5, 'dim', 3),
    (1, 32, 0, 'dyn', 'f'), (1, 32, 0.5, 'bow', 'down'), (1, 32, 1, 'bow', 'down'), (1, 32, 1.5, 'bow', 'down'), (1, 32, 2, 'bow', 'down'),
    (1, 33, 1, 'dyn', 'f'), (1, 33, 1, 'bow', 'down'), (1, 33, 1.5, 'bow', 'down'), (1, 33, 2, 'bow', 'down'),
    (1, 34, 1, 'dyn', 'f'), (1, 34, 1, 'bow', 'down'), (1, 34, 1.5, 'cresc', 2.5),
    (1, 38, 1.5, 'cresc', 2.5),
    (1, 42, 0, 'dyn', 'ff'),
    # the edition's printed fingerings (the app's own fingering fills in the rest, fitted around these)
    (1, 1, 1, 'fing', '3'), (1, 2, 0.5, 'fing', '1'), (1, 6, 0.5, 'fing', '1'), (1, 7, 0, 'fing', '3'), (1, 7, 0.5, 'fing', '2'),
    (1, 16, 1, 'fing', '3'), (1, 17, 1, 'fing', '1'), (1, 19, 1, 'fing', '1'), (1, 21, 1, 'fing', '1'), (1, 21, 2.5, 'fing', '1'),
    (1, 22, 1, 'fing', '4'), (1, 22, 2.5, 'fing', '4'), (1, 23, 1, 'fing', '4'),
    (1, 26, 1, 'fing', '0'), (1, 27, 1.5, 'fing', '3'), (1, 28, 1.5, 'fing', '1'),
    (1, 41, 0, 'fing', '3'), (1, 41, 0.5, 'fing', '2'),
]
