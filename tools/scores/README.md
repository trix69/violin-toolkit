# Built-in scores: how the MusicXML files were made (2026-11-10)

Eight built-ins (`src/midi/minuet, gavotte, air, canon, spring, autumn, winter, serenade .mxl`) are MusicXML converted from
the Mutopia Project LilyPond sources; `ave_maria.mxl` is OpenScore Lieder's file with the voice part renamed Violin.
Credits and licences: `docs/score-credits.md`. Nothing here runs in the app or at build time.

Tools: python-ly 0.9.10 (PyPI, in a venv: `ly musicxml in.ly > out.musicxml`, `ly rel2abs`), Python 3, Playwright
for the checks.

## Steps for each Mutopia piece

1. Download the `.ly` (or `-lys.zip`) from the piece's Mutopia page into its own folder.
2. `python3 -I lyclean.py in.ly out.ly` on each music file: drops comments, Scheme, `\mark`, overrides, spacing
   commands, `\set Score`, `tupletSpannerDuration`; `R1*3` -> `R1 R1 R1`.
3. A wrapper `.ly` that includes the cleaned files and has one `\score << \new Staff … >>` with
   `\set Staff.instrumentName` per part (the solo named `Violin`/`Violin I`; other violins `Ripieno 1/2` or
   `Violin II` so the player picks the solo) and `\tempo 4 = <the edition's MIDI tempo>` on the solo.
4. Piece-specific source fixes python-ly needs:
   - Winter: `<< R1*3 {spacer} >>` -> `R1*3`; `\context Voice = X { \stemUp \voiceOne …` pairs -> `<< {…} \\ {…} >>`;
     the half bar after the two-voice block of bars 53-55 moved inside it (`e''!4 s4 s2`, `as'' c'' …` in voice 2);
     tempo 80.
   - Minuet: `<< { \stemUp X \stemNeutral } { \context Voice = "ii" { << \stemDown Y >> } } >>` -> `<< {X} \\ {Y} >>`;
     the last chord `<d b>2.` given its length; tempo 120 (the edition's MIDI: 140, Trix chose 120).
   - Gavotte: `\header`, `\paper`, `tempoMark` removed; `sol're4.` -> `sol' re4.` (python-ly misreads it).
   - Air: the separate `global` repeat skeleton dropped and the bars written straight through (as the edition's MIDI
     plays them).
   - Canon: spaces added between run-together notes (`a16fis32`, `b'a`, `fis 4`).
   - Autumn (Mutopia #350, 1st movement, added later): the three `\context Voice = "soloup"/"solodown"` pairs ->
     `<< {…} \\ {…} >>`; tempo 120 (the edition's MIDI). python-ly counts triplet semiquavers at full length when it
     fills bars, so the solo's barlines drift from bar 39: `aut_fix.py` re-bars part 1 by real durations after its last
     two-voice bar (pack.py skips parts with voices); then `pack.py` alone (not in xml7.py).
   - Serenade: `ly rel2abs` first (its `\ifemidi {print} {midi}` macro is inside `\relative`), then
     `serenade_resolve.py`: keeps the print version of each ornament, drops `\pitchedTrill` helper notes, the
     per-part `\book` blocks, a two-voice pair of quavers -> chords, `\repeat tremolo N x` -> `x<total>:<d>`.
5. `ly musicxml wrapper.ly > piece.musicxml`, then `xml7.py` runs `pack.py` on all seven: title, composer, rights;
   python-ly fixes (chord notes pushed into the next bar, grace notes counted into a bar, `\partial` ignored ->
   re-barring from the given pickup, forward repeats on the wrong side, every part repeats where part 1 does,
   empty final bars); default beams by the beat where the source wrote none; compact `.mxl`.
6. Checks (scratch Playwright scripts, not kept): the player's notes per bar and accompaniment onsets equal the
   edition's MIDI (differences only where the MIDI writes out trills/tremolos/graces), `mlen.py` reports no bar of
   the wrong length (apart from pickups and spacer rests), Fingerings pages rendered and looked at.

Ave Maria: `pack_ave.py lc6389103.mxl tmp.mxl plain.musicxml` (voice part -> Violin, its syllable beams removed),
then `pack.py plain.musicxml ave_maria.mxl - - -` (beams by the beat; the file's own title and credits kept).

## Por una Cabeza (Gardel, 1935), added 2026-11-10

Source: Adam Cuerden's edition for voice and piano (2008, CC BY 3.0, IMSLP #295296; Trix downloaded it). Audiveris's
draft was not usable (time signature read as 5, quavers/semiquavers confused, lyric hyphens read as notes), so the
score was read bar by bar from crops with a pitch guide: `staffrows.swift` finds the staves on a 5000 px render
(`pdfpng.swift`), `staffguide.swift page.png out.png top spacing treble|bass x0 x1` overlays a labelled line at
every line and space. The edition prints its A-major signature on the first system only; its accidentals (bar 5's
double sharp) show the verse is in A major, the refrain (bar 17, naturals) in A minor.

1. `python3 -I pc_ly.py pc.ly` (violin = the Canto line, piano with its inner voices merged into chords, Chorus left
   out, bars straight through with the pickup first, tempo 66).
2. `ly musicxml pc.ly > pc.musicxml`; `pack.py pc.musicxml pc-packed.mxl "Por una Cabeza" "Carlos Gardel" "<rights>" 1`
   (pickup 1 crotchet; pack.py now puts chord notes it moves back before a bar's trailing backups).
3. `pc_repeat.py pc-packed.mxl porunacabeza.mxl`: the repeat (bar 1 to the 1st ending, bar 32), the 2nd ending
   (bar 33), and the key change to A minor at bar 17 (back to A major at bar 1).
Checks: every bar's length (mlen.py), the player's play order (0, 1-31, 32, 1-31, 33 = 65 bars, 1:57), the pages.

## Humoresque bar 6 (2026-11-11)

`hum_bar6.py humoresque.mxl out.mxl` after `hum_fix.py` and packing: bar 6's first violin note G5 (Soustružník has E5),
as bar 2 and the phrase's returns; Trix chose it by ear.

## Ode to Joy and Mountain King violin lines (2026-11-11)

`ode_arr.py` / `mk_arr.py` (midi_tools.py on the path): the violin is the top *sounding* line of Mutopia #528's upper
staff / #1888's right hand. The first version took the highest note at each onset, so inner voices moving under a
held melody note leaked in (Ode bars 2, 6, 8, 14, 16; Mountain King bars 29, 33, 37, 41, 45). Output is MIDI, kept
as ode.mxl / mountain_king.mxl (and the .mid copies) for the phone apps.
4. `pc_transpose.py porunacabeza.mxl out.mxl` (Trix, 2026-11-11): down a major second into G (verse G major, refrain
   G minor), the violin also up an octave; key signatures moved two fifths, printed accidentals dropped.

## Summer, 3rd movement (2026-11-12)

Mutopia #336 (`summer-lys.zip`: `summer3.ly` solo, `summer3a-d.ly` strings), CC BY-SA 3.0. `lyclean.py` on each; in the
solo the two `\context Voice = SoloUp/SoloDown` pairs (bars 51-54 held D under quavers, bars 72-76 held notes over
semiquavers) -> `<< {…} \\ {…} >>`; wrapper like Autumn's with `\tempo 4 = 150` (the edition's MIDI); then
`pack.py sum3.musicxml summer.mxl …`. Checks: mlen.py clean (130 bars); the player's solo notes per bar equal
`summer-score-2.mid` except bars 52-54, where the MIDI drops the D quavers that coincide with the held D.

## Por una Cabeza slurs (2026-11-12)

`pc_slurs.py in.mxl out.mxl` after `pc_transpose.py` (Trix: "add violin style slurs"; the song edition has none for
bowing): 36 slurs by measure — four-semiquaver runs in one bow, eight-semiquaver bars as two fours, the refrain's
crotchet pairs, the two semiquavers before each refrain crotchet; staccato pairs and repeated quavers stay detached.

## Winter, 2nd movement (Largo) and RV 356, 1st movement (2026-11-12)

- Winter Largo: Mutopia #351 `winter2*.ly` (solo, two ripieno violins, viola, cello), `lyclean.py`, wrapper like Autumn's
  with `\tempo 4 = 46` (the edition's MIDI), `ly musicxml`, `pack.py`, then `win2_pizz.py` (a `<sound pizzicato="yes"/>`
  at the start of both ripieno parts: the edition says "Largo e Pizziccati forte" only in words). 18 bars, 151 solo notes
  = `winter-score-1.mid`.
- RV 356 (L'estro armonico No. 6): Mutopia #2048 `6/notes1.ily`, `lyclean.py`, `ly rel2abs`, `rv356_flat.py` (pastes the
  shared tutti passages, writes out `\repeat unfold`, drops `\partial`), wrapper with Violin (`violinI`), Ripieno
  (`violinII`), Viola, Violoncello and `\tempo 4 = 120`, `ly musicxml`, `pack.py … 0.5` (quaver pickup). 80 bars + pickup,
  895 solo notes in the same order as `6/violinI.mid`.

## Minuets BWV Anh. 115 and 116 (2026-11-12)

Mutopia #1619 (one `.ly`, duets for two violins): the variable definitions (first 300 lines) through `lyclean.py`; a
wrapper per minuet with Violin = `centQuinzeA` / `CentSeizeA` and Ripieno = `…B`, `\tempo 4 = 96` (the edition's),
`ly musicxml`, `pack.py`. Notes equal the edition's MIDI (`…_alto-1.mid` = 115, `…_alto-2.mid` = 116; count chord notes).
