"""Ave Maria (OpenScore Lieder lc6389103, CC0): the voice part becomes the violin part (named Violin so the player
picks it as the solo); everything else as published. Usage: pack_ave.py in.mxl out.mxl [plain.musicxml]"""
import re, sys, zipfile
src, out = sys.argv[1:3]
with zipfile.ZipFile(src) as z:
    x = z.read('score.xml').decode('utf-8')
    container = z.read('META-INF/container.xml')
n = 0
x, k = re.subn(r'(<score-part id="P1">\s*<part-name>)Singstimme\s+Voice(</part-name>)', r'\1Violin\2', x); n += k
x, k = re.subn(r'(<score-part id="P1">.*?<instrument-name>)Voice(</instrument-name>)', r'\1Violin\2', x, count=1, flags=re.S); n += k
assert n == 2, n
x = re.sub(r'>\s+<', '><', x)
# the voice part's beams follow the syllables; drop them so pack.py beams it by the beat, as violin music
i = x.index('<part id="P1">'); j = x.index('</part>', i)
x = x[:i] + re.sub(r'<beam number="\d+">[^<]*</beam>', '', x[i:j]) + x[j:]
if len(sys.argv) > 3: open(sys.argv[3], 'w').write(x)   # plain MusicXML for pack.py
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr('META-INF/container.xml', container)
    z.writestr('score.xml', x)
print(out, len(x), 'bytes xml')
