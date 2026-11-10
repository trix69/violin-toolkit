"""Remove LilyPond layout-only commands python-ly cannot convert (marks, overrides, spacing, Scheme),
keeping every note, articulation, slur, dynamic and plain text. Usage: lyclean.py in.ly out.ly"""
import re, sys

src = open(sys.argv[1], encoding='utf-8', errors='replace').read()
src = re.sub(r'%\{.*?%\}', '', src, flags=re.S)          # block comments
src = re.sub(r'%[^\n]*', '', src)                       # line comments


def drop_scheme(s):
    """remove #( ... ) and #'( ... ) with nested brackets, then #'sym, ##t/##f, #number"""
    out, i = [], 0
    while i < len(s):
        if s[i] == '#' and i + 1 < len(s) and (s[i + 1] == '(' or s[i + 1:i + 3] == "'(" or s[i + 1:i + 3] == "`("):
            j = s.index('(', i); depth = 0
            while j < len(s):
                if s[j] == '(': depth += 1
                elif s[j] == ')':
                    depth -= 1
                    if depth == 0: break
                j += 1
            i = j + 1
            continue
        out.append(s[i]); i += 1
    s = ''.join(out)
    s = re.sub(r"##[tf]\b", '', s)
    s = re.sub(r"#'[\w-]+", '', s)
    s = re.sub(r"#-?\d+(\.\d+)?", '', s)
    return s


src = drop_scheme(src)
src = re.sub(r'\\mark\s+("[^"]*"|\\default)?', '', src)
src = re.sub(r'\\(once\s*\\)?override\s+[\w.]+(\s*\.\s*[\w-]+)*\s*=?\s*', '', src)
src = re.sub(r'\\(once\s*\\)?(revert|tweak)\s+[\w.]+\s*', '', src)
src = re.sub(r'\\set\s+tupletSpannerDuration\s*=\s*', '', src)
src = re.sub(r'\\set\s+Score\.\w+\s*=\s*', '', src)
src = re.sub(r'\\set\s+Staff\.midiInstrument\s*=\s*"[^"]*"', '', src)
src = re.sub(r'\\(newSpacingSection|noBreak|break|pageBreak|cadenzaOn|cadenzaOff|autoBeamOff|autoBeamOn)\b', '', src)
src = re.sub(r'\\markup\s*\{\s*\\translate\s*', r'\\markup { ', src)
src = re.sub(r'\\small(t|T)rill', r'\\trill', src)
src = re.sub(r'R(\d+\.?)\*(\d+)\b', lambda m: ' '.join(['R' + m.group(1)] * int(m.group(2))), src)   # R1*3 -> R1 R1 R1 (python-ly writes one long bar)
open(sys.argv[2], 'w', encoding='utf-8').write(src)
