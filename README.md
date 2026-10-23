# Violin Toolkit

A single-page web app for violin practice. It combines three tools:

- **Tuner:** uses your microphone to tune G · D · A · E, with a Chromatic mode and reference tones (A4 = 440 or 442 Hz).
- **Fingerboard:** press and hold any note to hear it. It covers the 1st, 2nd and 3rd positions, the major keys beginners learn first (G, D, A, C, F, B♭, E) with a key-signature preview, and a Pitch Check mode.
- **Metronome:** 80 BPM by default, with time signatures, subdivisions, tap tempo and accents. It keeps playing while you use the fingerboard.

Settings: English or 中文, pitch names (C D E) or solfège (Do Re Mi), light, dark or automatic appearance, and five colour themes.

No account, no ads, no tracking. After the first visit it works without an internet connection.

## Use it
Open the app link, then add it to your phone's home screen.
Shortcut links: `#tuner`, `#fingerboard` or `#metronome` open that tool. Add `#zh` / `#en` for 中文 or English, and `#solfege` / `#letter` for Do Re Mi or C D E note names, for example `…/#fingerboard,zh,solfege`. Language and note-name choices are remembered, so use `#en` or `#letter` to switch back. Links also work when you change them in an open tab.

Fonts (DM Sans, DM Mono, Outfit) are built into the page, so nothing is loaded from Google or any other site.

## Support
If it helps your practice, you can [buy me a coffee](https://buymeacoffee.com/trinks).

If this helps your practice, a ⭐ on GitHub is appreciated.

## Building from source

The app is built from the files in `src/` into one HTML page.

```
python3 src/release.py
```

This needs Python 3 only. It writes the standalone page to `dist/violin-toolkit.html` (not committed), and refreshes `index.html`, `manifest.webmanifest`, `sw.js` and the icons in the repo root, which GitHub Pages serves. The service worker version is a build timestamp, so every build makes installed copies update.

| File | What it is |
| --- | --- |
| `src/build.py` | Assembles the page: settings, start overlay, navigation, theme script |
| `src/board.html` | Fingerboard source |
| `src/tuner.html` | Tuner source |
| `src/met.css`, `met.html`, `met.js` | Metronome |
| `src/i18n.js` | English / 中文 and solfège translator, ordinal suffixes |
| `src/make_pwa.py` | Writes the manifest, service worker and install page |
| `src/favicon-tags.html`, `src/icons/` | Favicons and app icons |
| `src/redirect/` | Redirect page for the old `violin-fingerboard.html` address |
