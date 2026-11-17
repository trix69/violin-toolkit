# Paganini, Violin Concerto No. 2 in B minor, Op. 7, 3rd movement (Rondo, "La campanella"): the solo theme and the tutti's
# answer, the upbeat and bars 1-42: theme, tutti, the first solo episode ("A"), the theme again, to the tutti (bar 42). From Philipp Scharwenka's edition
# for violin and piano, Leipzig: Breitkopf & Haertel, n.d. [ca. 1896], plate 21008: violin part (IMSLP #774280) and piano
# score (IMSLP #774279), Public Domain. In the tutti the violin plays the tune, as printed in the violin part.
NAMES = ['Violin', 'Piano', 'Piano']; PROG = [41, 1, 1]
CLEF = [('G', 2), ('G', 2), ('F', 4)]
KEY = lambda b: 2; MODE = 'minor'
TIME = (6, 8)
PICKUP = 2
GRACE_SLURS = [1]   # the scan slurs every grace into its note (Trix)
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

# the scan's accents, staccato dots, slurs (not the small grace-note slurs) and the artificial harmonics of bars 31-33
# (stopped note + diamond a fourth above; the written top note is the one that plays) (Trix, 2026-11-16)
def _all(bar, offs, kind): return [(1, bar, o, kind, None) for o in offs]
EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5]
MARKS += [(1, 4, 0, 'acc', None), (1, 8, 0, 'acc', None), (1, 12, 0, 'acc', None), (1, 38, 0, 'acc', None)]
for bar in (7, 15, 41):
    MARKS += [(1, bar, 0, 'acc', None), (1, bar, 1.5, 'acc', None)] + _all(bar, [0.5, 0.75, 1, 2, 2.25, 2.5], 'stacc')
for bar in (9, 10, 11, 13, 14): MARKS += _all(bar, EIGHTHS, 'stacc')
MARKS += _all(12, [1.5, 2, 2.5], 'stacc')
# the first solo episode
MARKS += [(1, 16, 1, 'slur', (16, 2.5))] + _all(16, [1, 1.5, 2, 2.5], 'stacc')
for bar in (17, 19, 21):
    MARKS += [(1, bar, 0, 'slur', (bar, 0.5)), (1, bar, 1.5, 'slur', (bar, 2))] + _all(bar, [0, 0.125, 0.25, 0.375, 0.5, 1, 1.5, 1.625, 1.75, 1.875, 2, 2.5], 'stacc')
MARKS += [(1, 18, 0, 'slur', (18, 0.5)), (1, 18, 1, 'slur', (18, 2.5))] + _all(18, [0, 0.125, 0.25, 0.375, 0.5, 1, 1.5, 2, 2.5], 'stacc')
MARKS += [(1, 20, 0, 'slur', (20, 0.5)), (1, 20, 1, 'slur', (20, 2.5))] + _all(20, [0, 0.125, 0.25, 0.375, 0.5, 1, 1.5, 2, 2.5], 'stacc')
for bar in (22, 23):
    MARKS += [(1, bar, 0, 'slur', (bar, 0.5)), (1, bar, 0.5, 'acc', None), (1, bar, 1, 'slur', (bar, 1.25)),
              (1, bar, 1.5, 'slur', (bar, 2)), (1, bar, 2, 'acc', None), (1, bar, 2.5, 'slur', (bar, 2.75))]
    MARKS += _all(bar, [0, 0.125, 0.25, 0.375, 0.5, 1, 1.25, 1.5, 1.625, 1.75, 1.875, 2, 2.5, 2.75], 'stacc')
MARKS += [(1, 24, 0, 'slur', (24, 1)), (1, 24, 1.5, 'slur', (25, 0)),
          (1, 25, 1.5, 'slur', (25, 2.5)), (1, 25, 2.5, 'stacc', None),
          (1, 26, 0, 'slur', (26, 0.5)), (1, 26, 1, 'stacc', None), (1, 26, 1.5, 'slur', (27, 0)),
          (1, 27, 1.5, 'slur', (27, 2.5)), (1, 27, 2.5, 'stacc', None),
          (1, 28, 0, 'slur', (28, 0.5)), (1, 28, 1, 'stacc', None), (1, 28, 1.5, 'slur', (29, 0)),
          (1, 29, 1.5, 'slur', (29, 1.75))] + _all(29, [0.5, 1, 1.5, 1.75, 2, 2.25, 2.5, 2.75], 'stacc')
MARKS += [(1, 30, 0, 'slur', (30, 1)), (1, 30, 1.5, 'acc', None), (1, 30, 1.5, 'slur', (31, 0))]
MARKS += [(1, 40, 1.5, 'acc', None)]
# the harmonics: (stopped, touching)
MARKS += [(1, 31, o, 'harm', h) for o, h in [(0.5, ('F#5', 'B5')), (1, ('F#5', 'B5')), (1.5, ('G5', 'C6')), (1.75, ('F#5', 'B5')),
          (2, ('E5', 'A5')), (2.25, ('D5', 'G5')), (2.5, ('C#5', 'F#5')), (2.75, ('B4', 'E5'))]]
MARKS += [(1, 32, 0, 'harm', ('A#4', 'D#5'))] + [(1, 32, o, 'harm', ('F#5', 'B5')) for o in (0.5, 1, 1.5, 2)]
MARKS += [(1, 33, o, 'harm', ('F#5', 'B5')) for o in (1, 1.5, 2)]
# bar 27 (Hermes F121, Trix: include tr): a slashed F#5 grace into the E5, and tr over that E5 (the small 3 under it is the printed fingering)
MARKS += [(1, 27, 1.5, 'orn', 'tr')]
