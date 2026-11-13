# Massenet, Méditation from Thaïs, arr. Duncan McIntyre for string orchestra (IMSLP #317996, CC BY 4.0); built by
# ../mendelssohn/build.py. All ten staves: the solo violin, the four solo players (mostly pizzicato arpeggios) and the
# tutti strings. Drafted from an Audiveris reading, checked bar by bar against the score (bowings, dynamics left out).
NAMES = ['Violin', 'Pizzicato 1', 'Ripieno 1', 'Pizzicato 2', 'Ripieno 2', 'Pizzicato viola', 'Viola', 'Pizzicato cello',
         'Violoncello', 'Contrabass']
PROG = [41, 46, 49, 46, 49, 46, 49, 46, 49, 49]
CLEF = [('G', 2), ('G', 2), ('G', 2), ('G', 2), ('G', 2), ('C', 3), ('C', 3), ('F', 4), ('F', 4), ('F', 4)]
KEY = lambda b: 2; MODE = 'major'
TIME = (4, 4)
TEMPO = {1: ('Andante religioso', 58), 10: ('rall.', 50), 11: ('a tempo', 58), 20: ('rall.', 50), 21: ('Tempo', 54),
         22: ('Più mosso', 76), 27: ('rall.', 66), 28: ('Meno mosso', 68), 34: ('Più mosso agitato', 86), 38: ('rall.', 72),
         39: ('Tempo I', 58), 47: ('rall.', 50), 48: ('a tempo', 58), 57: ('rall.', 50), 58: ('A tempo', 58), 66: ('Calmato', 50)}
FWD = set(); BWD = set(); LAST = 71
TITLE = 'Méditation (Thaïs)'; COMPOSER = 'Jules Massenet'; EXTRA_CREATORS = [('arranger', 'Duncan McIntyre')]
RIGHTS = 'Arrangement (c) Duncan McIntyre, CC BY 4.0 (IMSLP #317996); solo and tutti strings transcribed by Violin Toolkit 2026, CC BY 4.0'
