"""Build everything from the sources in src/.

    python3 src/release.py          production build into the repo root (what GitHub Pages serves)
    python3 src/release.py --test   test build into dist/test-site/ (see deploy_test.py); no version bump

Writes dist/violin-toolkit.html (the standalone file) and dist/violin-fingerboard.html
(the artifact source), then refreshes index.html, manifest.webmanifest, sw.js and the icons
in the repo root, which is what GitHub Pages serves. Bumps src/VERSION (1.0 -> 1.01) on the
first production build after each commit.
"""
import os, subprocess, sys
import version

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
DIST = ROOT + 'dist/'

TEST = '--test' in sys.argv

# App version (shown in Settings): 1.0, 1.01, 1.02 ... one step per production release. Bump only
# when src/VERSION still matches the last commit, so rebuilding before a commit doesn't bump twice.
# Test builds never bump; they show the coming version with "-test".
if not TEST and subprocess.call(['git', 'diff', '--quiet', 'HEAD', '--', 'src/VERSION'], cwd=ROOT) == 0 and \
        subprocess.call(['git', 'cat-file', '-e', 'HEAD:src/VERSION'], cwd=ROOT, stderr=subprocess.DEVNULL) == 0:
    new = version.bumped(version.current())
    open(version.FILE, 'w').write(new + '\n')
    print('version', new, flush=True)

subprocess.check_call([sys.executable, SRC + 'build.py'])
page = open(DIST + 'standalone.html', encoding='utf-8').read()
assert page.count('</head>') == 1
tags = open(SRC + 'favicon-tags.html', encoding='utf-8').read().strip()
open(DIST + 'violin-toolkit.html', 'w', encoding='utf-8').write(page.replace('</head>', tags + '\n</head>'))
subprocess.check_call([sys.executable, SRC + 'make_pwa.py'] + (['--test'] if TEST else []))
