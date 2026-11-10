"""Serenade: \ifemidi {score} {midi} -> the score version; \pitchedTrill X\trill( Y -> X\trill(. Usage: resolve.py in out"""
import re, sys
s = open(sys.argv[1]).read()
def drop_blocks(s, word):
    while True:
        k = s.find(word)
        if k < 0: return s
        j = s.index('{', k); d = 0
        while True:
            if s[j] == '{': d += 1
            elif s[j] == '}':
                d -= 1
                if d == 0: break
            j += 1
        s = s[:k] + s[j + 1:]
s = drop_blocks(s, '\\book')
def group(s, i):
    m = re.match(r'\s*(\\times\s+\d+/\d+\s*|\\repeat\s+unfold\s+\d+\s*)?\{', s[i:]); assert m, s[i:i + 40]
    j = i + m.end() - 1; d = 0
    while True:
        if s[j] == '{': d += 1
        elif s[j] == '}':
            d -= 1
            if d == 0: return i + m.start(), j + 1
        j += 1
out = []; i = 0; n = 0
while True:
    k = s.find('\\ifemidi', i)
    if k < 0: out.append(s[i:]); break
    out.append(s[i:k])
    a0, a1 = group(s, k + len('\\ifemidi')); b0, b1 = group(s, a1)
    A = s[a0:a1].strip()
    A = re.sub(r"\\pitchedTrill\s+([a-g](?:is|es)*[',]*)(\\trill\(?)\s+[a-g](?:is|es)*[',]*", r"\1\2", A)
    out.append(' ' + A[1:-1].strip() + ' '); i = b1; n += 1
s = ''.join(out)
a = "<< { d'''8~ d''' }\n\t\t{ fis''_( e''_) } >>"
assert s.count(a) == 1
s = s.replace(a, "<d''' fis''>8~( <d''' e''>8)")   # two voices for two quavers: chords (python-ly loses its bar count)
s = re.sub(r'\{\s*#\s*1\s*', '{ ', s)   # left of \override MultiMeasureRest #'expand-limit = 1
from fractions import Fraction
PITCH = r"(?:<[^>]*>|[a-g](?:isis|eses|is|es)?[',]*)"
def last_dur(text):
    ds = re.findall(r"(?:>|[a-gr](?:isis|eses|is|es)?[',]*)(\d+)(?![\d/])", text)
    return int(ds[-1]) if ds else 4
def trem(m):
    n, ev, d = int(m.group(1)), m.group(2), m.group(3)
    d = int(d) if d else last_dur(s[:m.start()])
    tot = Fraction(n, d); tl = {Fraction(1): '1', Fraction(1, 2): '2', Fraction(1, 4): '4', Fraction(3, 4): '2.', Fraction(1, 8): '8'}[tot]
    nxt = s[m.end():m.end() + 30]
    keep = ''
    # the next note would inherit the tremolo's whole length: give it the old one
    if re.match(r"\s*" + PITCH + r"(?![\d',a-z])", nxt) and not re.match(r"\s*\\", nxt): keep = '\x00%d' % d
    return ev + tl + ':' + str(d) + keep
s = re.sub(r"\\repeat tremolo (\d+) (" + PITCH + r")(\d+)?", trem, s)
s = re.sub(r"\x00(\d+)(\s*)(" + PITCH + ")", r"\2\3\1", s)
print(s.count('repeat tremolo'), 'tremolo left')
print(n, 'ifemidi resolved;', s.count('pitchedTrill'), 'pitchedTrill left')
s += r'''
\score { <<
  \new Staff { \set Staff.instrumentName = "Violin I" \tempo 4 = 144 \violinOne }
  \new Staff { \set Staff.instrumentName = "Violin II" \violinTwo }
  \new Staff { \set Staff.instrumentName = "Viola" \viola }
  \new Staff { \set Staff.instrumentName = "Cello and Double Bass" \cello }
>> }
'''
open(sys.argv[2], 'w').write(s)
