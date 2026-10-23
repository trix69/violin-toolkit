"""Build everything from the sources in src/.

    python3 src/release.py

Writes dist/violin-toolkit.html (the standalone file) and dist/violin-fingerboard.html
(the artifact source), then refreshes index.html, manifest.webmanifest, sw.js and the icons
in the repo root, which is what GitHub Pages serves.
"""
import os, subprocess, sys

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
DIST = ROOT + 'dist/'

subprocess.check_call([sys.executable, SRC + 'build.py'])
page = open(DIST + 'standalone.html', encoding='utf-8').read()
assert page.count('</head>') == 1
tags = open(SRC + 'favicon-tags.html', encoding='utf-8').read().strip()
open(DIST + 'violin-toolkit.html', 'w', encoding='utf-8').write(page.replace('</head>', tags + '\n</head>'))
subprocess.check_call([sys.executable, SRC + 'make_pwa.py'])
