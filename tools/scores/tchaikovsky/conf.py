# Tchaikovsky, Violin Concerto in D major, Op. 35, 1st movement, the solo's entry and first theme: bars 23-41 of the
# movement (renumbered 1-19), from Mutopia Project no. 466 (Eulenburg 1920 edition, LilyPond, Public Domain);
# the solo and the string parts (Violin I, II, Viola, Violoncello); winds, horns, trumpets and timpani left out
NAMES = ['Violin', 'Ripieno 1', 'Ripieno 2', 'Viola', 'Violoncello']; PROG = [41, 49, 49, 49, 49]   # 'Ripieno' so the player picks the solo
CLEF = [('G', 2), ('G', 2), ('G', 2), ('C', 3), ('F', 4)]
KEY = lambda b: 2; MODE = 'major'
TIME = (4, 4)
TEMPO = {1: ('Allegro moderato', 88), 6: ('Moderato assai', 80)}
FWD = set(); BWD = set(); LAST = 19
TITLE = 'Violin Concerto in D major, Op. 35, 1st movement (opening)'; COMPOSER = 'Pyotr Ilyich Tchaikovsky'
RIGHTS = 'Mutopia Project #466 (Eulenburg 1920), Public Domain; bars 23-41 converted by Violin Toolkit 2026'
