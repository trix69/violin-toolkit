"""OpenScore Lieder song -> violin built-in: part P1 (the voice) renamed Violin so the player picks it as the solo,
its syllable beams removed (pack.py then beams it by the beat); everything else as published (CC0).
Usage: pack_os.py in.mxl plain.musicxml   then   pack.py plain.musicxml out.mxl - - -"""
import re, sys, zipfile
src, plain = sys.argv[1:3]
with zipfile.ZipFile(src) as z:
    name = next(n for n in z.namelist() if not n.startswith('META-INF') and n.endswith(('.xml', '.musicxml')))
    x = z.read(name).decode('utf-8')
x, k1 = re.subn(r'(<score-part id="P1">\s*<part-name>)[^<]*(</part-name>)', r'\1Violin\2', x, count=1)
x, k2 = re.subn(r'(<score-part id="P1">.*?<instrument-name>)[^<]*(</instrument-name>)', r'\1Violin\2', x, count=1, flags=re.S)
assert k1 == 1, 'no P1 part-name'
x = re.sub(r'>\s+<', '><', x)
i = x.index('<part id="P1">'); j = x.index('</part>', i)
x = x[:i] + re.sub(r'<beam number="\d+">[^<]*</beam>', '', x[i:j]) + x[j:]
open(plain, 'w', encoding='utf-8').write(x)
print(plain, len(x), 'bytes; part renamed', k1, k2)
