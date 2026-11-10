# Score credits and licences — the ten built-in tunes

Record for a rights holder or a store reviewer. It matches what ships in `src/midi/` row for row
(checked 2026-11-10). The compositions are all public domain; the table says where each **edition**
comes from and under which licence it is redistributed. The same credits are shown in the app:
Settings › Help › Score credits (曲谱来源).

| # | title (中文) | composer | file(s) shipped | edition source | licence (verbatim) | checked |
|---|---|---|---|---|---|---|
| 1 | Twinkle, Twinkle, Little Star (小星星) | Traditional (*Ah! vous dirai-je, maman*) | `twinkle.mxl`, `twinkle.mid` | engraved by us, 2026 (Violin Toolkit; melody only) | CC0 1.0 | 2026-11-10 |
| 2 | Minuet in G (G 大调小步舞曲) | Christian Petzold (formerly attributed to J. S. Bach), BWV Anh. 114 | `minuet.mid` | Mutopia Project no. 75, Bach-Gesellschaft, typeset by Allen Garvin — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75 | Public Domain | 2026-11-10 |
| 3 | Ode to Joy (欢乐颂) | Ludwig van Beethoven | `ode.mxl`, `ode.mid` (MIDI content) | Mutopia Project no. 528 (SATB, "Various"), typeset by Peter Chubb — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528 ; violin line (the soprano) arranged by us, 2026 | Public Domain | 2026-11-10 |
| 4 | Gavotte (加沃特舞曲) | Giovanni Battista Martini | `gavotte.mid` | Mutopia Project no. 1785, C. F. Peters ca. 1891, violin and piano, typeset by Fabien Mirloup — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1785 | Creative Commons Attribution-ShareAlike 3.0 | 2026-11-10 |
| 5 | Air (BWV 1068) (G弦上的咏叹调（原调）) | Johann Sebastian Bach | `air.mid` | Mutopia Project no. 242, Bach-Gesellschaft, strings, typeset by Jeff Covey — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=242 | Creative Commons Attribution-ShareAlike 3.0 | 2026-11-10 |
| 6 | In the Hall of the Mountain King (在山魔王的宫殿里) | Edvard Grieg | `mountain_king.mxl`, `mountain_king.mid` (MIDI content) | Mutopia Project no. 1888, The University Society 1918, piano, typeset by Coyau — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888 ; violin line (the right hand's top line, bars raised by octaves into the violin's range) arranged by us, 2026 | Public Domain | 2026-11-10 |
| 7 | Canon (卡农) | Johann Pachelbel | `canon.mxl`, `canon.mid` (MIDI content) | Mutopia Project no. 2047, *Canon per 3 Violini e Basso* (source IMSLP), typeset by Michael Fischer v. Mollard — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047 | Creative Commons Attribution 4.0 | 2026-11-10 |
| 8 | Spring, 1st movement (春 · 第一乐章) | Antonio Vivaldi | `spring.mid` | Mutopia Project no. 301, Performers' Facsimiles, violin and strings, maintainer "smailliw" — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=301 (first-movement MIDI `spring-score.mid` from the edition's MIDI set) | Creative Commons Attribution-ShareAlike 3.0 | 2026-11-10 |
| 9 | Winter, 1st movement (冬 · 第一乐章) | Antonio Vivaldi | `winter.mxl`, `winter.mid` (MIDI content) | Mutopia Project no. 351, Performers' Facsimiles, violin and strings, maintainer "smailliw" — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=351 (first-movement MIDI `winter-score.mid`); **changed by us, 2026: tempo ♩ = 140 → ♩ = 80** (the edition's MIDI plays at about twice the usual Allegro non molto; length 1:48 → 3:09); the changed file stays under CC BY-SA 3.0 | Creative Commons Attribution-ShareAlike 3.0 | 2026-11-10 |
| 10 | Serenade, 1st movement (小夜曲 · 第一乐章) | Wolfgang Amadeus Mozart, K. 525 | `serenade.mxl`, `night_music.mid` (MIDI content) | Mutopia Project no. 900, string quartet (source IMSLP), maintainer Anonymous — https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=900 | Public Domain | 2026-11-10 |

## Notes

- **Licences.** Public Domain and CC0 need nothing. CC BY 4.0 (Canon) and CC BY-SA 3.0 (Gavotte, Air,
  Spring, Winter) require credit to the edition, which the app's Score credits window gives (title,
  composer, edition, typesetter, licence). The share-alike editions are shipped unchanged except Winter, whose tempo we changed (noted in its row
  and in the app's credits); the changed file stays under CC BY-SA 3.0.
- **Our own work.** Twinkle (engraved here) and the violin lines drawn out of Ode to Joy and the
  Mountain King are ours; they may be used under CC0 1.0.
- **File names.** The phone apps (1.38 and later) download built-in tunes from the website by file name,
  so existing names are kept even where the content is now MIDI (`*.mxl` names hold MIDI for Ode,
  Mountain King, Canon, Winter and Serenade; the player reads files by content). The `.mid` files with the
  same names, and `night_music.mid`, carry the same new content for the 1.37 apps.
- **What was removed.** The previous six files (arrangements by third parties with no verifiable
  licence: Toninelli, López, Atimony12, an unnamed uploader, a dead MuseScore.com link) are gone from
  `src/midi/`; none of those names remains in the shipped files or the built page.
- **Formats.** Mutopia publishes LilyPond, MIDI and PDF, not MusicXML, so nine of the ten built-ins are
  MIDI: the score shows the app's own fingerings and position marks; written slurs, dynamics and
  ornaments are not shown (dynamics are heard).
