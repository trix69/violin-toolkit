"""Build the test site and push it to trix69/violin-toolkit-test (served at trix69.github.io/violin-toolkit-test/).

    python3 src/deploy_test.py

dist/test-site/ is a clone of the test repo; it is created on first use. Production (the repo root
and trix69.github.io/violin-toolkit/) is not touched.
"""
import os, subprocess, sys

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
SITE = ROOT + 'dist/test-site/'
REPO = 'https://github.com/trix69/violin-toolkit-test.git'
# same as the main clone: send $GITHUB_TOKEN, never store it
HELPER = '!f(){ test "$1" = get || exit 0; echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'


def git(*args, **kw):
    return subprocess.check_output(['git'] + list(args), cwd=kw.get('cwd', SITE), text=True).strip()


if not os.path.isdir(SITE + '.git'):
    os.makedirs(ROOT + 'dist', exist_ok=True)
    subprocess.check_call(['git', '-c', 'credential.https://github.com.helper=', '-c', 'credential.https://github.com.helper=' + HELPER,
                           'clone', REPO, SITE])
    git('config', '--local', '--replace-all', 'credential.https://github.com.helper', '')
    git('config', '--local', '--add', 'credential.https://github.com.helper', HELPER)
    git('config', '--local', 'user.name', 'Claude')
    git('config', '--local', 'user.email', 'noreply@anthropic.com')

subprocess.check_call([sys.executable, SRC + 'release.py', '--test'])

src_head = git('rev-parse', '--short', 'HEAD', cwd=ROOT)
dirty = ' + uncommitted changes' if git('status', '--porcelain', '--', 'src', cwd=ROOT) else ''
git('add', '-A')
if not git('status', '--porcelain'):
    print('test site unchanged')
    sys.exit(0)
git('commit', '-q', '-m', 'Test build from violin-toolkit %s%s' % (src_head, dirty))
git('push', '-q', 'origin', 'HEAD:main')
print('pushed test build from', src_head + dirty, '-> https://trix69.github.io/violin-toolkit-test/')
