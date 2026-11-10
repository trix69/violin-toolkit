"""Tchaikovsky, Symphony No. 4, II. Andantino in modo di canzona: the opening oboe theme (bars 1-20, ending on the
B-flat of bar 21) for violin, with the piano reduction's accompaniment, from Pachulski's piano transcription
(Jurgenson, ca. 1901, plate 26191, public domain; IMSLP), read bar by bar (Audiveris draft checked). Usage: tch_ly.py out.ly"""
import sys
MEL = ["r8 des''( c'' bes')", "a'( bes' f''-.) f''(", "c'') ees''( des'' c'')", "a'( bes' c'' c''-.)", "f'( f' g' a')",
       "bes'( c'' des'' f'')", "ees''( des'' c'' bes'-.)", "a'( f' bes' g')", "a'( des'' c'' bes')", "a'( bes' f''-.) f''(",
       "c'') ees''( des'' c'')", "a'( bes' c'' c''-.)", "f'( f' g' a')", "c''( bes' f''-.) f''", "f''( ees'' des'' c'')",
       "bes'( aes' ees''-.) ees''", "ees''( des'' c'' bes')", "aes'( ges' des''-.) des''", "des''( c'' des'' ees'')",
       "f''( ees'' des'' c'')", "bes'4 r4\\fermata"]
# the piano's right hand: the inner notes under the tune (an 8th on the beat); left hand: chord on the beat
IN = {3: "a'8 r8 r4", 4: "ges'8 r8 ges'8 r8", 6: "f'8 r8 r4", 7: "ges'8 r8 r4", 8: "f'8 r8 f'8 r8", 11: "a'8 r8 r4",
      12: "ges'8 r8 ges'8 r8", 14: "f'8 r8 r4", 15: "ges'8 r8 r4", 16: "ges'8 r8 r4", 17: "f'8 r8 r4", 18: "f'8 r8 r4",
      19: "ges'8 r8 r4", 20: "a'8 r8 r4", 21: "<des' f'>4 r4\\fermata"}
LH = {1: "R2", 2: "<bes des' f'>8 r8 r4", 3: "<f c' f'>8 r8 r4", 4: "<ges bes des'>8 r8 <ees bes ees'>8 r8", 5: "<f a c'>8 r8 r4",
      6: "<des f bes>8 r8 r4", 7: "<c bes ees'>8 r8 r4", 8: "<f a c'>8 r8 <des g bes>8 r8", 9: "<f a c'>8 r8 r4",
      10: "<bes des' f'>8 r8 r4", 11: "<f c' f'>8 r8 r4", 12: "<ges bes des'>8 r8 <ees bes ees'>8 r8", 13: "<f a c'>8 r8 r4",
      14: "<des f bes>8 r8 r4", 15: "<ees bes ees'>8 r8 r4", 16: "<aes c' ees'>8 r8 r4", 17: "<des aes des'>8 r8 r4",
      18: "<ges bes des'>8 r8 r4", 19: "<c bes ees'>8 r8 r4", 20: "<f c' f'>8 r8 r4", 21: "<bes, bes>4 r4\\fermata"}
vn = ' |\n  '.join(MEL) + ' |'
rh = ' |\n  '.join(IN.get(b, "R2") for b in range(1, 22)) + ' |'
lh = ' |\n  '.join(LH[b] for b in range(1, 22)) + ' |'
out = r"""\version "2.18.2"
violin = { \clef treble \key bes \minor \time 2/4 \tempo 4 = 63 %s }
rh = { \clef treble \key bes \minor \time 2/4 %s }
lh = { \clef bass \key bes \minor \time 2/4 %s }
\score { <<
  \new Staff = "violin" << \set Staff.instrumentName = "Violin" \violin >>
  \new Staff = "rh" << \set Staff.instrumentName = "Piano" \rh >>
  \new Staff = "lh" << \set Staff.instrumentName = "Piano" \lh >>
>> }
""" % (vn.replace("r8 des''(", "r8\\p des''(", 1), rh, lh)
open(sys.argv[1], 'w').write(out)
print('21 bars')
