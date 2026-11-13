"""Minuets 114-115 (Trix, 2026-11-14): the small note before bar 8's (and bar 72's) dotted minim is played as a quick grace
just before the beat, not as an appoggiatura taking half the note: its <grace/> gets steal-time-previous="50" (the player
reads that as a 32nd taken from the note before). Violin part only. Usage: python3 -I minuet_grace.py minuets.mxl"""
import sys, zipfile
p = sys.argv[1]
z = zipfile.ZipFile(p); files = {n: z.read(n) for n in z.namelist()}; infos = {i.filename: i for i in z.infolist()}; z.close()
name = [n for n in files if not n.startswith('META-INF')][0]
x = files[name].decode('utf-8')
a = x.index('<part id="P1">'); b = x.index('</part>', a)
vio = x[a:b]
assert vio.count('<grace />') == 2, vio.count('<grace />')
vio = vio.replace('<grace />', '<grace steal-time-previous="50" />')
files[name] = (x[:a] + vio + x[b:]).encode('utf-8')
with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n, d in files.items(): zo.writestr(infos[n], d, zipfile.ZIP_DEFLATED)
print('2 graces marked steal-time-previous="50"')
