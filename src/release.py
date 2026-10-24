"""Build everything from the sources in src/.

    python3 src/release.py

Writes dist/violin-toolkit.html (the standalone file) and dist/violin-fingerboard.html
(the artifact source), then refreshes index.html, manifest.webmanifest, sw.js and the icons
in the repo root, which is what GitHub Pages serves. Bumps src/VERSION (1.0 -> 1.01) on the
first build after each commit.
"""
import os, subprocess, sys

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
DIST = ROOT + 'dist/'

# App version (shown in Settings): 1.0, 1.01, 1.02 ... one step per commit. Bump only when
# src/VERSION still matches the last commit, so rebuilding before a commit doesn't bump twice.
if subprocess.call(['git', 'diff', '--quiet', 'HEAD', '--', 'src/VERSION'], cwd=ROOT) == 0 and \
        subprocess.call(['git', 'cat-file', '-e', 'HEAD:src/VERSION'], cwd=ROOT, stderr=subprocess.DEVNULL) == 0:
    major, _, minor = open(SRC + 'VERSION').read().strip().partition('.')
    n = int(major) * 100 + int(minor.ljust(2, '0')) + 1
    new = '%d.%s' % (n // 100, '0' if n % 100 == 0 else '%02d' % (n % 100))
    open(SRC + 'VERSION', 'w').write(new + '\n')
    print('version', new)

subprocess.check_call([sys.executable, SRC + 'build.py'])
page = open(DIST + 'standalone.html', encoding='utf-8').read()
assert page.count('</head>') == 1
tags = open(SRC + 'favicon-tags.html', encoding='utf-8').read().strip()
open(DIST + 'violin-toolkit.html', 'w', encoding='utf-8').write(page.replace('</head>', tags + '\n</head>'))
subprocess.check_call([sys.executable, SRC + 'make_pwa.py'])
