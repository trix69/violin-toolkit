"""Audiveris MusicXML -> token lines for build.py (a draft to correct by hand).
Usage: omr2tokens.py file.xml FIRST_BAR > tokens   (FIRST_BAR: the number the page's first measure has in the piece)
Parts in order; a part with 2 staves becomes two token parts (upper, lower). Voices within a staff are joined by '|'.
Each line: 'P<n> <bar>: tokens'; bars whose voices do not fill the bar are marked '; !! <beats>'."""
import sys, xml.etree.ElementTree as ET
T = {'whole': '1', 'half': '2', 'quarter': '4', 'eighth': '8', '16th': '16', '32nd': '32'}
r = ET.parse(sys.argv[1]).getroot(); first = int(sys.argv[2]); pn = 0
for part in r.findall('part'):
    ns = part.find('.//staves'); nst = int(ns.text) if ns is not None else 1
    div = 1; beats = 4; btype = 4
    rows = {s: [] for s in range(1, nst + 1)}
    for mi, m in enumerate(part.findall('measure')):
        a = m.find('attributes')
        if a is not None:
            if a.find('divisions') is not None: div = int(a.findtext('divisions'))
            if a.find('time') is not None: beats, btype = int(a.findtext('time/beats')), int(a.findtext('time/beat-type'))
        full = div * 4 * beats / btype
        per = {s: {} for s in range(1, nst + 1)}   # staff -> voice -> [tokens], durations
        for n in m.findall('note'):
            if n.find('grace') is not None: continue
            st = int(n.findtext('staff') or 1); v = n.findtext('voice') or '1'
            if n.find('rest') is not None: p = 'r'
            else:
                q = n.find('pitch'); al = {'1': '#', '-1': 'b', '2': '##'}.get(q.findtext('alter') or '', '')
                p = q.findtext('step') + al + q.findtext('octave')
            d = T.get(n.findtext('type') or '', '?') + ('.' if n.find('dot') is not None else '')
            if n.find('time-modification') is not None: d += 't' if n.findtext('time-modification/actual-notes') == '3' else 'q'
            tie = '~' if n.find("tie[@type='start']") is not None else ''
            lst = per[st].setdefault(v, [[], 0])
            if n.find('chord') is not None and lst[0]:
                pp, dd = lst[0][-1].split(':'); lst[0][-1] = pp + '+' + p + ':' + dd
            else:
                lst[0].append(p + ':' + d + tie); lst[1] += int(n.findtext('duration') or 0)
        for s in per:
            vs = [per[s][k] for k in sorted(per[s])]
            bad = [x[1] / div for x in vs if abs(x[1] - full) > 1e-6]
            rows[s].append('%d: %s%s' % (first + mi, ' | '.join(' '.join(x[0]) for x in vs), ('   ; !! ' + str(bad)) if bad or not vs else ''))
    for s in rows:
        pn += 1
        for line in rows[s]: print('P%d %s' % (pn, line))
