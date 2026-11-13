# Brahms, Hungarian Dance No. 5, arr. Hans Erblich (IMSLP #205345, CC BY-SA 3.0); built by ../mendelssohn/build.py too
NAMES = ['Violin I', 'Violin II', 'Viola I', 'Viola II', 'Violoncello']; PROG = [41, 41, 42, 42, 43]
CLEF = [('G', 2), ('G', 2), ('C', 3), ('C', 3), ('F', 4)]
KEY = lambda b: 1 if 49 <= b <= 62 else -2; MODE = lambda b: 'minor' if KEY(b) < 0 else 'major'   # D minor / D major (G minor / G major): the player's key note follows
TIME = (2, 4)
TEMPO = {1: ('Allegro', 152), 41: ('meno', 120), 45: ('a tempo', 152), 49: ('Vivace', 192), 55: ('meno', 150), 57: ('a tempo', 192),
         59: ('meno', 150), 61: ('a tempo', 192), 63: ('Tempo I', 152), 87: ('meno', 120), 91: ('a tempo', 152)}
FWD = {33, 49, 55}; BWD = {48, 54, 62}; LAST = 96
TITLE = 'Hungarian Dance No. 5'; COMPOSER = 'Johannes Brahms'; EXTRA_CREATORS = [('arranger', 'Hans Erblich')]
RIGHTS = 'Arrangement (c) Hans Erblich 2012, CC BY-SA 3.0 (IMSLP #205345); this transcription by Violin Toolkit 2026, CC BY-SA 3.0'
