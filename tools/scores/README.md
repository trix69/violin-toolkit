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

## Beethoven, Romance No. 2 in F, Op. 50 (2026-11-12)

Mutopia #911 (one file per instrument). `lyclean.py` on the solo and the four string parts; in the solo the four
`\afterGrace x { g }` -> `x \grace { g }`; in the cello the three `<< { upper } \\ { rests / the same } >>` -> upper;
wrapper Violin (`violinoprincipale`), Ripieno 1/2, Viola, Violoncello, `\tempo 4 = 48` (the edition's MIDI); woodwinds and
horns left out. `ly musicxml`, then `rebar.py` (python-ly mis-fills bars around the long triplet runs; each note's own
duration is right), then `pack.py`. 103 bars; every string part's notes = the edition's MIDI track; the solo = the MIDI plus
the five written after-grace notes.

## Brahms, Hungarian Dance No. 5, arr. Hans Erblich (2026-11-13)

IMSLP #205345 (2 violins, 2 violas, cello; PDF typeset by the arranger, CC BY-SA 3.0). No source file exists, so the
PDF went through Audiveris and the draft was turned into `hungarian5/tokens.txt` (one line per part per bar:
`PITCH[+PITCH]:DUR`, `~` tie, `q` quintuplet, `|` second voice), then checked bar by bar against 2x page crops: the
draft had dropped most rests in Viola II, the key's flats in Violin II bars 29–31, every tie on chords, and an empty
bar at the Vivace key change (so 97 bars instead of 96). `hungarian5/build.py hungarian5 ../../src/midi/hungarian5.mxl`
writes the score (repeats 33–48, 49–54, 55–62; key G major 49–62; tempo words from the PDF with meno = crotchet 120 /
150), beams per beat, and fails nothing silently: it lists any bar whose voices do not fill 2/4. The ad lib. 8va
(bars 25–28, 71–74) is played as written. Dynamics, slurs and articulations are not transcribed.

## Minuets BWV Anh. 115 and 116 again, from the keyboard editions (2026-11-13)

Hermes F51: #1619 is written for violas, so the melody sat an octave low and lost notes below the G string. Now Mutopia
#76 (Anh. 115) and #77 (Anh. 116), Allen Garvin's Bach-Gesellschaft keyboard editions (Public Domain): `lyclean.py`,
header and `\score` dropped, the final `<< { \stemUp X } { \context Voice = "ii" … } >>` -> `<< {X} \\ {Y} >>`, stem
commands removed, `\repeat "volta"` -> `\repeat volta` (python-ly ignores the quoted form), wrapper Violin = `voiceone`,
Harpsichord = `voicetwo`, `\tempo 4 = 96` (as before; the editions' MIDI says 140). `ly musicxml`, `pack.py`; then the
empty last measure python-ly leaves dropped and the repeat barlines written explicitly (1–16, 17–end): python-ly put the
first backward repeat one bar late. Notes = the editions' MIDI (115: 118 + 81, 116: 166 + 144). 115's melody runs
B♭3–B♭5 as written, 116's D4–A5.

## Mendelssohn, Violin Concerto Op. 64, 1st movement, bars 1–48 (2026-11-13)

The composer's own edition (Breitkopf & Härtel [1845], plate 7210, Public Domain): the violin part (IMSLP #913234) and the
violin + piano score (IMSLP #872023), downloaded by Trix. No source file exists. Audiveris crashed on the score's first page
and misread clefs and rhythms elsewhere, so every note was measured against the staff lines (pixel views of the 2800 px
renders; Audiveris on single violin lines only as a cross-check) and written to `mendelssohn/tokens.txt` (violin, piano RH,
piano LH). `mendelssohn/build.py` is the general token builder (a `conf.py` per piece: parts, clefs, key, time, tempo,
repeats; it also rebuilds `hungarian5` byte for byte); triplets beam in threes and carry tuplet marks. Bars 1–46 the solo;
47 the orchestra's entry (B7), 48 its E minor; minim = 100 (our choice; the score gives only Allegro molto appassionato).
Not transcribed: dynamics, slurs, articulations, the cue notes in the violin part.

## Minuets BWV Anh. 114 + 115 joined (2026-11-14)

Trix: "Merge them and give a new piece name". `minuet_pair.py minuet.mxl minuet115.mxl minuets.mxl` (run from the old files,
now removed: `git show 68e5a7b:src/midi/minuet.mxl`): Anh. 114, Anh. 115 (its repeats), Anh. 114 again written out (no
da capo in the player); each section keeps its divisions, key + mode and tempo (120 / 96 / 120); "Minuet II" / "Minuet I"
words; double bar before the change. Title "Minuets in G major and G minor, BWV Anh. 114–115".

## Minuets: quick graces (2026-11-14)

Trix: the small note before bars 8 and 72 is a quick grace just before the beat. `minuet_grace.py minuets.mxl` marks the two
violin `<grace/>` with `steal-time-previous="50"`; the player plays such graces (and every slashed grace) as a 32nd ending on the
beat, taken from the note before (drawn at its written value).
- 2026-11-14: Trix: a bar's rest between Minuet I and Minuet II (`minuet_pair.py` adds it after bar 32; rebuild = minuet_pair.py on the 68e5a7b sources, then minuet_grace.py). Minuet II now starts at bar 34.

## Tchaikovsky, Swan Lake: Dance of the Little Swans (2026-11-15)

Eugene Gajewski's Dorico engraving of the Op. 20a suite (2024, CC0, IMSLP #917974; Trix downloaded the zip with the
MusicXML export, kept in `~/Downloads/vt-scores/swan/`). `swan/build.py "…Full score - 03 Flow 3.xml" little_swans.mxl`
(the `.xml` inside the flow's `.mxl`): Violin = the tune (Oboe I bars 1–9 and 26–38, Violin I bars 10–25; bars 10 and 26
joined at the hand-over), the other woodwinds and strings as the accompaniment at sounding pitch (`<transpose>` applied:
clarinets in A, double bass), Oboe I dropped (all tune), Violin I emptied in bars 10–26 and renamed Ripieno 1 (its
instrument name must not say Violin, or the player takes "Violin I" as the solo); piccolo, brass and timpani (only the
last chord) dropped; key mode set to minor (F♯ minor; Dorico wrote major); tempo ♩ = 120 from the piccolo's first bar,
the words "Allegro moderato" left out (they ran into bar 2's *p*). 38 bars, 1:15, 245 violin notes.

## Six OpenScore built-ins (2026-11-15)

Sparse clones of https://github.com/OpenScore/Lieder and https://github.com/OpenScore/StringQuartets (both CC0 1.0; see the
paths in `docs/score-credits.md`). Songs (Brahms Wiegenlied, Fauré Après un rêve): `pack_os.py` (voice → Violin) then
`pack.py plain.musicxml out.mxl - - -`, as Ave Maria. Quartets: `slice_mvt.py in.mxl out.mxl FIRST LAST "Title"` keeps measures
FIRST..LAST of every part (positions in the file, found from the movement headings and final barlines), carries the attributes
in force, numbers the bars from 1 (an upbeat is 0), and asserts each part's note count is unchanged. Ranges used: Haydn Op. 76/3
129–149 (theme only: Var. I–III give the tune to the 2nd violin, cello and viola), Tchaikovsky Op. 11 184–367, Dvořák Op. 96
179–275, Borodin No. 2 604–783. Part names stay as published ("Violin 1" is the solo).

## Offenbach, Orpheus in the Underworld (Can-Can) (2026-11-15)

Galop infernal (No. 15b) from the Bote & Bock vocal score, ca. 1880, plate 10779 (IMSLP #26815, PD; Trix downloaded it into
`~/Downloads/vt-scores/cancan/`). Pages rendered at 2600 px (`pdfpng.swift`), Audiveris drafts → `mendelssohn/omr2tokens.py`,
then every bar checked against the scan; chord heads read with `pitchguide.swift` (labels every line and space of a staff
crop; staff positions from `stafflines.swift`). `cancan/tokens.txt` + `cancan/conf.py`, built by `mendelssohn/build.py`, which
now also takes grace notes (`DUR` ending in `g`), an upbeat bar (`PICKUP`) and volta brackets (`ENDINGS`); the earlier
pieces it builds come out byte for byte the same. 103 bars, repeats 1–8 / 11–18 / 27–42 / 66–81 with 1st and 2nd endings,
2:00. Violin: the piano's top line where the piano plays alone, the voice where it sings, the piano's top line again in the
closing chords. The piano RH 8va (bars 68–81) is written at pitch. Bars 55–64 (left-hand chords over the A pedal on the
faintest page) follow the draft's chromatic line; the place to look first if a chord sounds wrong.

## Bach, solo violin: Gavotte en Rondeau BWV 1006, Andante BWV 1003, Adagio BWV 1001, Preludio BWV 1006 (2026-11-15)

Mutopia nos. 1471, 1456, 1429, 1469 (Bach-Gesellschaft 1879, Band 27.1; typeset 2008, CC BY-SA 3.0). python-ly fails on the files'
`<< \melodyOne \\ \melodyTwo \\ … >>` (empty or 22-note output) and drops some spacers, so `bach/build.py` converts each voice
alone with the spacers (`s`, `s1*3/4*12` expanded per bar) and the `\partial` upbeat written as marked rests (`r<d>\fermata`),
re-bars with `rebar.py` where python-ly mis-fills bars, restores the upbeat (`upbeat.py`), merges the voices into one part
(`merge_voices.py`: marked rests back to `<forward>`, chord notes python-ly pushed into the next bar moved back), and packs.
Checked with `xmlvsmidi.py` / `pitchcheck.py` against the edition's MIDI, bar by bar: every pitch equal except where two voices
share a note (Gavotte bars 8, 34, 35, 73; Andante 1, 20: the MIDI sounds it once) and the Adagio's one grace note (bar 11).
Tempos added (the files have none): ♩ = 120 / 60 / 44 / 120. The Adagio's `<mode>` is dropped: G minor written with one flat,
so the app names no key instead of "D minor".

## Paganini, La Campanella (Concerto No. 2, Rondo), opening (2026-11-15)

Scharwenka's violin and piano edition (Breitkopf & Härtel ca. 1896, plate 21008; IMSLP #774280 violin, #774279 piano; PD; Trix
downloaded both into `~/Downloads/vt-scores/campanella/`). The 1851 full score (IMSLP #253710) was too faint to read. Audiveris
read neither part usefully (graces as chords, the 6/8 lost), so the notes were measured from 2600 px renders: `heads.swift`
finds noteheads on a staff and names their pitch from the line positions (`stafflines.swift`), `pitchguide.swift` draws the
lines and spaces with names over a crop for the rhythm, graces and chords. `campanella/tokens.txt` + `conf.py` (upbeat via
`PICKUP`, slashed graces `:8g`), built by `mendelssohn/build.py`: the upbeat and bars 1–16 (solo theme, tutti, to the B minor
chord before "A"). In the tutti the violin plays the tune, as the violin part prints it; the piano doubles it.
- 2026-11-15: extended to bar 42 (Trix: 25 s too short): the first solo episode ("A", bars 16–33 with the harmonics of 31–33 written
  as their top notes at written pitch, the piano's bell octaves at sounding pitch), the theme's return (34–41) and the tutti's first
  chord (42); 1:06. Violin pitches from `heads2.swift` (shape-based notehead finder, works on ledger lines) on a 5200 px render,
  rhythms read from `pitchguide.swift` crops with `XTICKS=1`; piano chords from `pitchguide2.swift` (both staves labelled) on a
  10400 px render. Least certain: the inner voices of some piano chords (bars 21–30) and bar 39–40's harmony.

## Winter, 2nd movement: shorter ending (2026-11-15)

Trix: the ending note was a little too long. `win2_end.py winter_largo.mxl winter_largo.mxl`: in the last bar every part's whole note
(fermata and ties kept) becomes a crotchet followed by a dotted-minim rest; the piece ends about 6 s sooner (1:37 -> 1:31).

## Preludio BWV 1006: bariolage beams (2026-11-15)

Trix: bars 13 on drew unbeamed flags. The source writes the bariolage as two voices taking turns (one note each), and a
MusicXML beam stays within a voice. `join_voices.py in.mxl out.musicxml` joins the voices of every measure where they never
sound together (32 bars of the Preludio; none in the Gavotte, Andante, Adagio), then `pack.py out.musicxml bach1006_preludio.mxl - - -`
beams them by the beat (96 groups). Pitches per bar unchanged. Use it after `merge_voices.py` from now on.

## Five more built-ins (2026-11-15): Ave Maria (Bach–Gounod), Massenet Élégie, BWV 1043, BWV 1041, Rieding Op. 35

- Gounod (Mutopia #2167): the violin part is in Italian note names inside `\relative` → cut out, `ly "translate nederlands"`,
  joined back; the `\header` (copyright markup) and the markup macros (`\II`, `\sulA`, `\piuF`, `\tutta_forza`) removed (python-ly
  drops the whole violin part otherwise); the piano's `\transpose c c'` baked in with `ly "transpose c c'"` (python-ly ignores it);
  `pack.py`. Massenet: `pack_os.py` + `pack.py`, as the other songs.
- BWV 1043 (Mutopia #3): the six 1st-movement files, `lyclean.py`, a wrapper (Violin I solo; Violin II, ripieni, viola,
  continuo as accompaniment), crotchet = 96; clean. BWV 1041 (Mutopia #2051, solo part only): `\afterGrace X {g}` → `X \grace {g}`,
  fingerings and macros stripped, `rebar.py b41.musicxml out 0.5` (new optional upbeat argument). Rieding (Mutopia #1781): violin +
  piano, clean.
- Romance Op. 40, BWV 1042 and Caprice 24 were added on 2026-11-16 with `ly2xml.py` (sections below); `lysplit.py` was
  an earlier attempt for the two-voice blocks and is no longer needed for them.

## Caprice No. 24 (Paganini, Mutopia #2000), 2026-11-16: `ly2xml.py`

python-ly mis-bars this edition (unmarked 3:4 tuplets, 4:6, 7:4, 8:4 and 9:4 groups, 3/4 variations inside a 2/4 piece, a
two-voice variation). `ly2xml.py` replaces it for such sources: it gives every note its exact start as a fraction and
cuts the bars afterwards from the time signatures, so bars cannot drift; every bar check (`|`) in the source matched.
Steps: `ly rel2abs Caprice_24.ly` (comments and the `\header` dropped) -> `m_abs.ly`, then
`ly2xml.py m_abs.ly c24.musicxml music+varI+…+varXI --tempo 120 --label music=Tema --label varI="Var. I" …`, then
`pack.py c24.musicxml paganini24.mxl "Caprice No. 24 in A minor, Op. 1" "Niccolò Paganini" "<rights>"`.
Checked against the edition's MIDI (repeats unfolded, Var. V skipped as the MIDI does): 1,518 of 1,520 notes at the same
time and pitch; the two others are the final trills, which the MIDI writes out.

## Romance No. 1, Op. 40 (Mutopia #944) and BWV 1042 mvt 1 (Mutopia #29), 2026-11-16: `ly2xml.py` per staff + `parts_merge.py`

Each staff converted on its own (`ly2xml.py all.ly part.musicxml <expr> --name "Ripieno 1"`), then
`parts_merge.py out.musicxml solo.xml acc1.xml …` (common divisions, parts in that order), then `pack.py`.
- Romance: the edition's parts are already absolute; solo 659/659 against the MIDI, the strings every note (the cello's seven
  two-voice unisons are one note in the MIDI).
- BWV 1042: `ly rel2abs` on the five `*_1.ly` files + `common-defs.ly`; the da capo written out as the MIDI plays it
  (`soloViolinBa Bb <<Bc lower/upper>> Bd Ba`, continuo `BaMain BaLastbarB Bb <<Bc>> BaMain BaLastbarC`), "D.C. al fine" and
  "Fine" removed; all five parts identical to the edition's `score.mid`. `pack.py` now beams semiquavers in 2/2 by the crotchet.

## Twenty more built-ins (2026-11-16): Handel HWV 361 and 370, Eccles, four folk tunes, four Schubert songs

All Mutopia ones with `ly2xml.py` (+ `parts_merge.py` for violin + piano right hand + left hand), each part compared with
the edition's MIDI (repeats not unfolded: these MIDIs play them once). Handel #652/#654 (`HWVnnn-violin-N.ly` +
`HWVnnn-piano-N.ly`, `ly rel2abs`; MIDI `HWVnnn-score[-1..3].mid`, tracks 1–3); Eccles #540 (`sonata.ly`, violin only);
Greensleeves #1943 (melody; its guitar is a Scheme music function, left out; `\time 3/4` given as a prefix variable),
Soldier's Joy #510, The Holly and the Ivy #644 (melodies), Home! Sweet Home! #435 (voice + piano; the piano given the
voice's `\partial 4`). Hard Times (#371) left out: it moves bars with `\set Timing.measurePosition`. Schubert songs:
OpenScore Lieder via `pack_os.py`; Heidenröslein's voice is notated an octave up under a treble-8va clef: moved down an
octave, clef plain. ly2xml.py gained `\bar ":|:"` repeats (a repeat sign inside a bar cuts the bar in two), dotted-beat
`--tempo 4.=76`, `\transpose x x`, `\omit`, church modes, `\include "english.ly"`; pack.py never re-bars its output.
