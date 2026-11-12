"""Vivaldi RV 356 (L'estro armonico No. 6), 1st movement, from Mutopia #2048 (Felix Janda): flatten notes1.ily for
python-ly (Trix, 2026-11-12). Input: the file after lyclean.py and `ly rel2abs` (absolute pitches, so passages can be
pasted anywhere). Pastes the shared tutti passages in where the violin part names them (\\tuttiI, <<s \\tuttiII>>,
<<s \\tuttiIII>>), writes out \\repeat unfold, and drops every \\partial 8 (python-ly ignores it; pack.py re-bars from
the given pickup instead). Usage: python3 -I rv356_flat.py abs.ly flat.ly"""
import re, sys

src, out = sys.argv[1:3]
s = open(src, encoding='utf-8').read()


def body(name):
    """the {...} of `name = { ... }` (balanced braces)"""
    m = re.search(r'^' + name + r' = \{', s, re.M)
    assert m, name
    i, depth = m.end() - 1, 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return s[i + 1:j]
    raise ValueError(name)


tutti = {k: body(k) for k in ('tuttiI', 'tuttiII', 'tuttiIII')}
# the simultaneous spacer + passage forms first, then the plain references (longest name first)
for k in ('tuttiIII', 'tuttiII'):
    s, n = re.subn(r'<<\s*s(?:_"[^"]*")?\s*\\' + k + r'\s*>>', lambda m, k=k: ' ' + tutti[k] + ' ', s)
    assert n == 1, (k, n)
s, n = re.subn(r'\\tuttiI\b', lambda m: ' ' + tutti['tuttiI'] + ' ', s)
assert n >= 1, n


def unfold(t):
    while True:
        m = re.search(r'\\repeat unfold (\d+) \{', t)
        if not m: return t
        i, depth = m.end() - 1, 0
        for j in range(i, len(t)):
            if t[j] == '{': depth += 1
            elif t[j] == '}':
                depth -= 1
                if depth == 0: break
        t = t[:m.start()] + ' '.join([t[i + 1:j]] * int(m.group(1))) + t[j + 1:]


s = unfold(s)
s = re.sub(r'\\partial 8\s*', '', s)
open(out, 'w', encoding='utf-8').write(s)
print(out, 'flattened')
