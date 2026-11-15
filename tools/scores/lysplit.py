"""Split a one-staff LilyPond music expression with << { A } \\\\ { B } >> blocks into two single-voice files that python-ly
can convert (it mis-fills bars on such blocks). Voice 1: every block -> A. Voice 2: every block -> B, and all the music
outside the blocks turned into marked rests of the same lengths (r<dur>\\fermata, which merge_voices.py turns back into gaps).
Pitches must be absolute (run `ly rel2abs` first). Grace notes outside the blocks are dropped from voice 2.
Usage: lysplit.py music.ly v1.ly v2.ly   (music.ly: one `name = { ... }` assignment per file, as written by the caller)"""
import re, sys

src, o1, o2 = sys.argv[1:4]
s = open(src, encoding='utf-8').read()


def blocks(text):
    """yield (start, end, A, B) for each << { A } \\\\ { B } >> block (braces balanced)"""
    i = 0
    while True:
        a = text.find('<<', i)
        if a < 0: return
        j, depth = a + 2, 1
        while depth and j < len(text):
            if text.startswith('<<', j): depth += 1; j += 2; continue
            if text.startswith('>>', j): depth -= 1; j += 2; continue
            j += 1
        body = text[a + 2:j - 2]
        parts = re.split(r'\\\\\\\\', body) if '\\\\\\\\' in body else body.split('\\\\')
        if len(parts) == 2:
            yield a, j, parts[0].strip(), parts[1].strip()
        i = j


NOTE = r"(?<![A-Za-z\\])(?:<[^<>]*>|[a-g](?:isis|eses|is|es)?[',]*|[rRs])(?![a-z])"
DUR = r"(\d+\.*(?:\*\d+(?:/\d+)?)?)?"


NAMES = set(re.findall(r'^\s*([A-Za-z]+)\s*=', s, re.M))   # variables: their references stay


def rests(text):
    """all music in text -> marked rests of the same length (durations carry over as in LilyPond)"""
    text = re.sub(r'\\key\s+\S+\s+\\\w+|\\clef\s+"?\w+"?|\\tempo\s+("[^"]*"\s*)?(\d+\s*=\s*\d+)?|\\set\s+[^\n]*|"[^"]*"|\\markup\s*\{[^{}]*\}', ' ', text)
    t = re.sub(r'\\(?:grace|acciaccatura|appoggiatura|slashedGrace)\s*\{[^{}]*\}', ' ', text)
    t = re.sub(r'\\(?:grace|acciaccatura|appoggiatura|slashedGrace)\s*' + NOTE + DUR, ' ', t)
    out, pos = [], 0
    for m in re.finditer(r'\\[a-zA-Z]+|' + NOTE + DUR + r"[^\s{}|]*", t):
        out.append(t[pos:m.start()])
        tok = m.group(0)
        if tok.startswith('\\'):
            out.append(tok if tok[1:] in NAMES or tok in ('\\tuplet', '\\times', '\\repeat', '\\alternative', '\\time', '\\key', '\\partial') else ' ')
        else:
            d = re.match(NOTE + DUR, tok).group(1) or ''
            out.append('r' + d + '\\fermata')
        pos = m.end()
    out.append(t[pos:])
    t = ''.join(out)
    return re.sub(r'[()~\[\]]', ' ', t)


def flatten(t):
    """python-ly fails on a tuplet holding only rests: every marked rest gets its duration written out, and each
    \\tuplet n/m { rests } becomes plain marked rests of the same total length"""
    from fractions import Fraction as F
    def val(d):
        m = re.fullmatch(r'(\d+)(\.*)(?:\*(\d+)(?:/(\d+))?)?', d)
        v = F(1, int(m.group(1))); add = v
        for _ in m.group(2): add /= 2; v += add
        if m.group(3): v *= F(int(m.group(3)), int(m.group(4) or 1))
        return v
    def spell(v):   # a total as rests of plain values (whole down to 64th)
        out = []
        for k in (1, 2, 4, 8, 16, 32, 64):
            while v >= F(1, k): out.append('r%d\\fermata' % k); v -= F(1, k)
        if v: out.append('r1*%d/%d\\fermata' % (v.numerator, v.denominator))   # a tuplet's odd remainder: a scaled rest
        return ' '.join(out)
    last, out, i = ['4'], [], 0
    tok = re.compile(r'\\tuplet\s+(\d+)/(\d+)\s*\{|r(\d+\.*(?:\*\d+(?:/\d+)?)?)?\\fermata')
    while True:
        m = tok.search(t, i)
        if not m: out.append(t[i:]); break
        out.append(t[i:m.start()])
        if m.group(1):
            j = t.index('}', m.end()); body = t[m.end():j]
            if re.search(r'[a-g<]', re.sub(r'r(\d+\.*)?\\fermata|\\fermata', '', body)):   # notes inside: leave it
                out.append(t[m.start():j + 1]); i = j + 1; continue
            tot = F(0)
            for d in re.findall(r'r(\d+\.*(?:\*\d+(?:/\d+)?)?)?\\fermata', body):
                if d: last[0] = d
                tot += val(last[0])
            out.append(spell(tot * F(int(m.group(2)), int(m.group(1))))); i = j + 1
        else:
            if m.group(3): last[0] = m.group(3)
            out.append('r' + last[0] + '\\fermata'); i = m.end()
    return ''.join(out)


def inner(x):   # one outer { } pair removed
    x = x.strip()
    return x[1:-1] if x.startswith('{') and x.endswith('}') else x


v1, v2, last = [], [], 0
for a, b, A, B in blocks(s):
    v1.append(s[last:a]); v1.append(' ' + inner(A) + ' ')
    v2.append(rests(s[last:a])); v2.append(' ' + inner(B) + ' ')
    last = b
v1.append(s[last:]); v2.append(rests(s[last:]))
open(o1, 'w', encoding='utf-8').write(''.join(v1))
open(o2, 'w', encoding='utf-8').write(flatten(''.join(v2)))
print(o1, o2, 'written')
