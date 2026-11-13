# Monti, Csárdás, arr. Tolga Karaca for string quartet, 2011 (IMSLP #157169, CC BY 3.0); built by ../mendelssohn/build.py.
# Drafted from Audiveris readings of 3000 px renders of the PDF, checked against it; the slow opening (bars 1-21) of the
# first violin read by hand (grace notes left out). Where the second violin has the tune (bars 38-53 and 86-99) the two
# violin parts are swapped, so the violin played always has it.
NAMES = ['Violin', 'Ripieno', 'Viola', 'Violoncello']; PROG = [41, 49, 49, 49]
CLEF = [('G', 2), ('G', 2), ('C', 3), ('F', 4)]
KEY = lambda b: -1 if b < 54 or 86 <= b < 100 else 2
TIME = lambda b: (4, 4) if 5 <= b <= 21 else (2, 4)
DIV = 840   # septuplet 32nds in bar 18
TEMPO = {1: ('Adagio', 70), 12: ('molto rall.', 54), 14: ('a tempo', 70), 18: ('poco rall.', 58), 20: ('a tempo', 70),
         21: ('molto rall.', 50), 22: ('Allegro vivace', 140), 54: ('Meno mosso', 84), 70: ('Meno quasi lento', 66),
         81: ('molto rall.', 54), 86: ('Allegro vivace', 140), 97: ('poco rall.', 120), 100: ('Allegretto', 120),
         114: ('rall.', 104), 118: ('Più presto', 152), 125: ('Molto più vivo', 168)}
FWD = {14, 22, 38}; BWD = {21, 37, 53}; LAST = 134
TITLE = 'Csárdás'; COMPOSER = 'Vittorio Monti'; EXTRA_CREATORS = [('arranger', 'Tolga Karaca')]
RIGHTS = 'Arrangement (c) Tolga Karaca 2011, CC BY 3.0 (IMSLP #157169); this transcription by Violin Toolkit 2026, CC BY 3.0'
