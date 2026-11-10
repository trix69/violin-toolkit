# Built-in scores: how the MusicXML files were made (2026-11-10)

Seven built-ins (`src/midi/minuet, gavotte, air, canon, spring, winter, serenade .mxl`) are MusicXML converted from
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
