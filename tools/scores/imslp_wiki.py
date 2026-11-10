"""IMSLP page wikitext -> files per section: section | file index | description | publisher | arranger | copyright.
Usage: imslp_wiki.py "Page title" [filter-regex]"""
import json, re, sys, urllib.parse, urllib.request
title = sys.argv[1]
flt = re.compile(sys.argv[2], re.I) if len(sys.argv) > 2 else None
u = 'https://imslp.org/api.php?action=query&prop=revisions&rvprop=content&format=json&redirects=1&titles=' + urllib.parse.quote(title)
d = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'violin-toolkit-score-fetch'}), timeout=60).read())
page = next(iter(d['query']['pages'].values()))
w = page['revisions'][0]['*']
print('==', page['title'], len(w))
sec = ''
for blk in re.split(r'(?m)^(?===)', w):
    h = re.match(r'(=+)\s*(.*?)\s*=+', blk)
    if h: sec = re.sub(r'\[\[[^|\]]*\|?([^\]]*)\]\]', r'\1', h.group(2))
    for f in re.finditer(r'\{\{#fte:imslpfile(.*?)\n\}\}', blk, re.S):
        body = f.group(1)
        g = lambda k: (re.search(r'\|\s*' + k + r'\s*=([^\n|]*(?:\[\[[^\]]*\]\][^\n|]*)*)', body) or [None, ''])[1].strip()
        descs = re.findall(r'\|\s*File Description \d+\s*=\s*([^\n]*)', body)
        files = re.findall(r'\|\s*File Name \d+\s*=\s*([^\n]*)', body)
        line = '%s | %s | %s | pub: %s | arr: %s | ed: %s | %s' % (sec[:50], ', '.join(descs)[:60], ', '.join(files)[:80], g('Publisher Information')[:90], g('Arranger')[:40], g('Editor')[:40], g('Copyright')[:30])
        if not flt or flt.search(line): print(line)
