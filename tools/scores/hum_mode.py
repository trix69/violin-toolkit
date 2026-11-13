"""Humoresque: mark the G-minor middle section's key as minor (Hermes F76), so the player's key note is G there, not B-flat.
Only the 2-flat <key> elements change; the first <key> keeps no mode (the pages name no key for this tune).
Usage: python3 -I hum_mode.py humoresque.mxl"""
import sys, zipfile
p = sys.argv[1]
z = zipfile.ZipFile(p); files = {n: z.read(n) for n in z.namelist()}; infos = {i.filename: i for i in z.infolist()}; z.close()
name = [n for n in files if not n.startswith('META-INF')][0]
x = files[name].decode('utf-8')
old, new = '<key><fifths>-2</fifths></key>', '<key><fifths>-2</fifths><mode>minor</mode></key>'
print(x.count(old), 'key elements marked minor')
files[name] = x.replace(old, new).encode('utf-8')
with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as zo:
    for n, b in files.items(): zo.writestr(infos[n], b, zipfile.ZIP_DEFLATED)
