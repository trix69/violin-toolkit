"""LilyPond (absolute pitches, one staff) -> MusicXML, by exact note times (2026-11-16, first for Paganini's Caprice 24).
python-ly fills bars by its own counting, which goes wrong with odd tuplets (7:4, 9:4, 4:6), unmarked tuplets, voices
(<< {A} \\\\ {B} >>) and changes of time signature; here every note gets its exact start (fractions of a whole note)
and the bars are cut afterwards from the time signatures, so a bar can never drift.
Handles: notes, chords <..>, rests r/R, spacers s, durations with dots and *n/m, ties ~, slurs ( ), beams [ ],
\\tuplet n/m, \\times, \\grace/\\acciaccatura/\\appoggiatura, << >> (with \\\\ as voices; without, simultaneous notes
in one voice become a chord), \\repeat volta (+ \\alternative), \\repeat unfold, \\time, \\key, \\partial, \\tempo,
\\mark, \\bar, dynamics, hairpins, articulations (-. -> -^ -- -_ -! \\fermata \\trill \\upbow \\downbow ...),
fingerings, text (-"pizz." ^\\markup{...}), variables (name = { ... }, referenced as \\name).
Pitches must be absolute: run `ly rel2abs` first (python-ly), or write them so.
Usage: ly2xml.py in.ly out.musicxml EXPR [--tempo Q] [--label var=Text ...] [--name Violin]
       EXPR: the variable to convert, or several joined with '+', e.g. music+varI+varII
       --label varI="Var. I": words printed at the start of that variable"""
import math, re, sys
from fractions import Fraction as F
import xml.etree.ElementTree as ET

args = sys.argv[1:]
SRC, OUT, EXPR = args[:3]
TEMPO, LABELS, PNAME = None, {}, 'Violin'
i = 3
while i < len(args):
    if args[i] == '--tempo':   # 120 (crotchets) or 4.=76, 8=69, 2=42
        u, _, v = args[i + 1].rpartition('=')
        TEMPO = (u or '4', int(v)); i += 2
    elif args[i] == '--label': k, v = args[i + 1].split('=', 1); LABELS[k] = v; i += 2
    elif args[i] == '--name': PNAME = args[i + 1]; i += 2
    else: sys.exit('unknown option ' + args[i])

text = open(SRC, encoding='utf-8').read()
text = re.sub(r'%\{.*?%\}', ' ', text, flags=re.S)
text = re.sub(r'%[^\n]*', ' ', text)


def drop_scheme(t):   # #'( ... ) / #( ... ) with nested parentheses, ##t, #-1, #"x"
    out, i = [], 0
    while i < len(t):
        if t[i] == '#' and not t.startswith('##{', i):
            j = i + 1
            while j < len(t) and t[j] in "#'`": j += 1
            if j < len(t) and t[j] == '(':
                depth = 0
                while j < len(t):
                    if t[j] == '(': depth += 1
                    elif t[j] == ')':
                        depth -= 1
                        if not depth: j += 1; break
                    elif t[j] == '"': j = t.index('"', j + 1)
                    j += 1
            elif j < len(t) and t[j] == '"': j = t.index('"', j + 1) + 1
            else:
                while j < len(t) and not t[j].isspace() and t[j] not in '{}': j += 1
            out.append(' '); i = j; continue
        out.append(t[i]); i += 1
    return ''.join(out)


text = drop_scheme(text)
text = re.sub(r'(?<=[\d.])\s*\*\s*(?=\d)', '*', text)   # R1 * 5 -> R1*5
m = re.search(r'\\language\s+"(\w+)"', text)
LANG = m.group(1) if m else 'english' if re.search(r'\\include\s+"english\.ly"', text) else 'nederlands'

DUR = r"(?:\d+\.*|\\breve\.*)?(?:\*\d+(?:/\d+)?)*(?::\d*)?"
TOK = re.compile(r'''
   (?P<str>"(?:[^"\\]|\\.)*")
 | (?P<sim><<|>>)
 | (?P<vsep>\\\\)
 | (?P<hair>\\[<>!()\[\]])
 | (?P<cmd>\\[a-zA-Z]+(?:-[a-zA-Z]+)*)
 | (?P<art>[-^_][.>^_!+\-](?![\d"]))
 | (?P<fing>[-^_]\d+)
 | (?P<dir>[-^_](?=["\\]))
 | (?P<chord>[<>])(?P<cdur>''' + DUR + r''')
 | (?P<prop>[a-zA-Z]+(?:\.[a-zA-Z-]+)+)
 | (?P<word>[a-zA-Z]+)(?P<oct>[',]*)(?P<acc>[!?]?)(?P<wdur>''' + DUR + r''')
 | (?P<frac>\d+/\d+)
 | (?P<num>\d+\.*(?:\*\d+(?:/\d+)?)?)
 | (?P<scm>\#'?\([^)]*\)|\#\S+)
 | (?P<p>[{}()\[\]~|=])
 | (?P<ws>\s+)
 | (?P<other>.)''', re.X)


def tokenize(s):
    out = []
    for mm in TOK.finditer(s):
        k = mm.lastgroup
        if k in ('ws', 'scm'): continue
        if k == 'cdur' or k == 'chord': out.append(('chord', mm.group('chord'), mm.group('cdur'))); continue
        if k in ('wdur', 'oct', 'acc', 'word'): out.append(('word', mm.group('word'), mm.group('oct'), mm.group('acc'), mm.group('wdur'))); continue
        if k == 'other': continue   # lyrics, markup punctuation: never music
        out.append((k, mm.group(k)))
    return out


# variables: name = <music>
toks = tokenize(text)
VARS = {}
j = 0
while j < len(toks):
    t = toks[j]
    k0 = j + 2
    while k0 + 1 < len(toks) and toks[k0][0] == 'cmd' and toks[k0][1] in ('\\context', '\\new') and toks[k0 + 1][0] == 'word': k0 += 2   # name = \context Staff { }
    if k0 + 2 < len(toks) and toks[k0] == ('cmd', '\\transpose') and toks[k0 + 1][0] == toks[k0 + 2][0] == 'word':   # name = \transpose g g { }
        if toks[k0 + 1][1:3] != toks[k0 + 2][1:3]: sys.exit('\\transpose to another pitch: not supported')
        k0 += 3
    if t[0] == 'word' and k0 < len(toks) and toks[j + 1] == ('p', '=') and toks[k0] == ('p', '{'):
        depth, k = 0, k0
        while True:
            if toks[k] == ('p', '{'): depth += 1
            elif toks[k] == ('p', '}'):
                depth -= 1
                if not depth: break
            k += 1
        VARS[t[1]] = toks[k0:k + 1]; j = k + 1
    else: j += 1

STEPS = 'cdefgab'
if LANG == 'english':
    ACC = {'': 0, 's': 1, 'f': -1, 'ss': 2, 'x': 2, 'ff': -2, 'sharp': 1, 'flat': -1}
else:
    ACC = {'': 0, 'is': 1, 'es': -1, 'isis': 2, 'eses': -2, 's': -1, 'ses': -2}   # as, es: a flat, e flat (nederlands)


def pitch(word, octs):
    m = re.fullmatch(r'([a-g])(\w*)', word)
    if not m or m.group(2) not in ACC: return None
    step, alt = m.group(1), ACC[m.group(2)]
    if LANG != 'english' and step in 'ae' and m.group(2) == 's': alt = -1
    return (step.upper(), alt, 3 + octs.count("'") - octs.count(','))


def parse_dur(d, last):
    """-> (base denominator, dots, multiplier, tremolo) ; carries the last one when none is written"""
    if not d or not re.match(r'\d|\\breve', d):
        trem = re.search(r':(\d*)', d or '')
        return last[:3] + ((int(trem.group(1) or 32) if trem else 0),)
    m = re.match(r'(\d+|\\breve)(\.*)((?:\*\d+(?:/\d+)?)*)(?::(\d*))?', d)
    base = F(1, 2) if m.group(1) == '\\breve' else F(int(m.group(1)))
    mult = F(1)
    for a, b in re.findall(r'\*(\d+)(?:/(\d+))?', m.group(3)): mult *= F(int(a), int(b or 1))
    return (base, len(m.group(2)), mult, int(m.group(4) or 32) if m.group(4) is not None else 0)


def length(base, dots, mult):
    v = F(1) / base; add = v
    for _ in range(dots): add /= 2; v += add
    return v * mult


DYN = {'p', 'pp', 'ppp', 'pppp', 'mp', 'mf', 'f', 'ff', 'fff', 'ffff', 'sf', 'sfz', 'fz', 'fp', 'rfz', 'rf', 'sfp', 'sffz'}
ARTS = {'.': 'staccato', '>': 'accent', '^': 'strong-accent', '-': 'tenuto', '_': 'detached-legato', '!': 'staccatissimo'}
CMD_ART = {'staccato': ('art', 'staccato'), 'accent': ('art', 'accent'), 'tenuto': ('art', 'tenuto'), 'marcato': ('art', 'strong-accent'),
           'staccatissimo': ('art', 'staccatissimo'), 'portato': ('art', 'detached-legato'), 'fermata': ('ferm', 'fermata'),
           'trill': ('orn', 'trill-mark'), 'prall': ('orn', 'inverted-mordent'), 'mordent': ('orn', 'mordent'), 'turn': ('orn', 'turn'),
           'upbow': ('tech', 'up-bow'), 'downbow': ('tech', 'down-bow'), 'flageolet': ('tech', 'harmonic'), 'open': ('tech', 'open-string'),
           'stopped': ('tech', 'stopped'), 'snappizzicato': ('tech', 'snap-pizzicato'), 'startTrillSpan': ('orn', 'trill-mark')}
IGNORE = {'stemUp', 'stemDown', 'stemNeutral', 'autoBeamOn', 'autoBeamOff', 'tupletUp', 'tupletDown', 'tupletNeutral', 'slurUp',
          'slurDown', 'slurNeutral', 'tieUp', 'tieDown', 'tieNeutral', 'voiceOne', 'voiceTwo', 'voiceThree', 'voiceFour', 'oneVoice',
          'break', 'pageBreak', 'noBreak', 'mBreak', 'phrasingSlurUp', 'phrasingSlurDown', 'dynamicUp', 'dynamicDown', 'dynamicNeutral',
          'textLengthOn', 'textLengthOff', 'cadenzaOn', 'cadenzaOff', 'italic', 'bold', 'once', 'arpeggio', 'glissando', 'laissezVibrer',
          'stopTrillSpan', 'noBeam', 'shiftOn', 'shiftOff', 'shiftOnn'}


class State:
    def __init__(self):
        self.t = F(0); self.voice = 1; self.factor = F(1); self.tup = []; self.grace = False
        self.last = (F(4), 0, F(1)); self.ev = []; self.lastev = None; self.seq = 0
        self.clefs = []
        self.times, self.keys, self.partial, self.repeats, self.endings, self.bars, self.checks = [], [], None, [], [], [], []
        self.pending = []   # directions waiting for the next note: (kind, value)
        self.beam_open = {}; self.tupid = 0; self.midi = 'violin'


S = State()


def add_pending(kind, val): S.pending.append((kind, val))


def emit(kind, pitches, base, dots, mult, trem, accs=()):
    d = length(base, dots, mult) * S.factor
    e = dict(kind=kind, t=S.t, d=F(0) if S.grace else d, base=base, dots=dots, pitches=pitches, voice=S.voice, grace=S.grace,
             tup=list(S.tup), seq=S.seq, ties=False, sl_start=0, sl_stop=0, arts=[], orn=[], tech=[], ferm=False, fing=[],
             dirs=S.pending, beam=None, trem=trem, accs=list(accs), full=False, tuptags=[])
    S.pending = []; S.seq += 1
    if S.beam_open.get(S.voice): e['beam'] = 'continue'
    for tp in S.tup:   # first note of a tuplet instance: bracket start
        if tp['first'] is None: tp['first'] = e; e['tuptags'].append(('start', tp['id']))
        tp['lastn'] = e
    S.ev.append(e)
    if not S.grace: S.t += d
    S.lastev = e
    return e


class P:
    def __init__(self, toks): self.toks, self.i = toks, 0
    def peek(self, k=0): return self.toks[self.i + k] if self.i + k < len(self.toks) else ('eof', '')
    def next(self): t = self.peek(); self.i += 1; return t

    def seq(self):   # after '{'
        while self.peek() != ('p', '}'):
            if self.peek()[0] == 'eof': sys.exit('unclosed {')
            self.item()
        self.next()

    def markup(self):
        t = self.next()
        if t[0] == 'str': return t[1][1:-1]
        if t == ('p', '{'):
            words, depth = [], 1
            while depth:
                t = self.next()
                if t == ('p', '{'): depth += 1
                elif t == ('p', '}'): depth -= 1
                elif t[0] == 'str': words.append(t[1][1:-1])
                elif t[0] == 'word': words.append(t[1])
            return ' '.join(words)
        if t[0] == 'cmd': return self.markup()   # \italic "x"
        return ''

    def postfix(self):
        e = S.lastev
        while True:
            t = self.peek()
            if t == ('p', '~'): self.next(); e['ties'] = True
            elif t == ('p', '('): self.next(); e['sl_start'] += 1
            elif t == ('p', ')'): self.next(); e['sl_stop'] += 1
            elif t == ('p', '['): self.next(); e['beam'] = 'begin'; S.beam_open[e['voice']] = True
            elif t == ('p', ']'): self.next(); e['beam'] = 'end'; S.beam_open[e['voice']] = False
            elif t[0] == 'hair':
                self.next(); h = t[1][1]
                if h in '<>!': e['dirs'].append(('wedge', {'<': 'crescendo', '>': 'diminuendo', '!': 'stop'}[h]))
            elif t[0] == 'art': self.next(); e['arts'].append(ARTS.get(t[1][1], 'accent')) if t[1][1] != '+' else e['tech'].append('stopped')
            elif t[0] == 'fing': self.next(); e['fing'].append(t[1][1:])
            elif t[0] == 'dir':
                self.next(); n = self.peek()
                if n[0] == 'str': self.next(); e['dirs'].append(('words', n[1][1:-1]))
                elif n == ('cmd', '\\markup'): self.next(); e['dirs'].append(('words', self.markup()))
            elif t[0] == 'cmd' and t[1][1:] in DYN: self.next(); e['dirs'].append(('dyn', t[1][1:]))
            elif t[0] == 'cmd' and t[1][1:] in ('cresc', 'dim', 'decresc'): self.next(); e['dirs'].append(('words', t[1][1:] + '.'))
            elif t[0] == 'cmd' and t[1][1:] in CMD_ART:
                self.next(); k, v = CMD_ART[t[1][1:]]
                if k == 'art': e['arts'].append(v)
                elif k == 'orn': e['orn'].append(v)
                elif k == 'tech': e['tech'].append(v)
                else: e['ferm'] = True
            elif t[0] == 'cmd' and t[1] == '\\markup': self.next(); e['dirs'].append(('words', self.markup()))
            elif t == ('cmd', '\\rest') and e.get('kind') == 'note': self.next(); e['kind'] = 'rest'; e['pitches'] = []   # c'8\rest: a rest drawn at that pitch
            else: return

    def note_word(self, t):
        _, w, octs, acc, d = t
        if w in ('r', 'R', 's'):
            base, dots, mult, trem = parse_dur(d, S.last); S.last = (base, dots, mult)
            if w == 's':
                S.t += F(0) if S.grace else length(base, dots, mult) * S.factor
                S.lastev = dict(dirs=[], arts=[], orn=[], tech=[], fing=[], ties=False, sl_start=0, sl_stop=0, beam=None, ferm=False, voice=S.voice, spacer=True)   # a spacer's marks go to the next note
                return
            e = emit('rest', [], base, dots, mult, 0); e['full'] = w == 'R'; return
        p = pitch(w, octs)
        if p is None:
            if w in VARS: sys.exit('variable %s used without a backslash?' % w)
            sys.exit('not a note: %r' % (t,))
        base, dots, mult, trem = parse_dur(d, S.last); S.last = (base, dots, mult)
        emit('note', [p], base, dots, mult, trem, [acc])

    def item(self):
        t = self.next(); k = t[0]
        if t == ('p', '{'): self.seq(); return
        if t == ('p', '|'): S.checks.append(S.t); return
        if k == 'word':
            self.note_word(t); self.postfix()
            if S.lastev and S.lastev.get('spacer'): S.pending += S.lastev['dirs']; S.lastev = None
            return
        if t[:2] == ('chord', '<'):
            ps, accs = [], []
            while self.peek()[0] != 'chord':
                n = self.next()
                if n[0] == 'word':
                    p = pitch(n[1], n[2])
                    if p is None: sys.exit('bad chord note %r' % (n,))
                    ps.append(p); accs.append(n[3])
                # ties / fingerings inside a chord: ignored here (a tie on the chord's note ties the chord)
            close = self.next()
            base, dots, mult, trem = parse_dur(close[2], S.last); S.last = (base, dots, mult)
            emit('note', ps, base, dots, mult, trem, accs); self.postfix(); return
        if t == ('sim', '<<'): self.simultaneous(); return
        if k == 'cmd': self.command(t[1][1:]); return
        if k == 'hair' or k == 'art' or k == 'fing': return   # stray
        if k == 'str': return
        if k in ('p',) and t[1] in '~()[]': self.i -= 1; self.postfix() if S.lastev else self.next(); return
        print('skipped', t, file=sys.stderr)

    def simultaneous(self):
        t0, v0, ends, seg, blocks = S.t, S.voice, [S.t], 0, 0
        while self.peek() != ('sim', '>>'):
            if self.peek()[0] == 'vsep': self.next(); seg += 1; S.voice = v0 + seg; continue
            nx = self.peek()
            if not seg and (nx == ('p', '{') or (nx[0] == 'cmd' and nx[1][1:] in VARS) or nx[1] in ('\\context', '\\new')):   # << {A} {B} >>: each block its own voice
                S.voice = v0 + blocks; blocks += 1
            S.t = t0; self.item(); ends.append(S.t)
        self.next()
        S.t, S.voice = max(ends), v0

    def command(self, c):
        if c in VARS:
            if c in LABELS: add_pending('words', LABELS[c])
            P(VARS[c]).run(); return
        if c in DYN: return   # a dynamic with nothing before it
        if c == 'time':
            n, m = map(int, self.next()[1].split('/')); S.times.append((S.t, n, m)); return
        if c == 'key':
            tn = self.next(); mode = self.next()[1][1:]
            p = pitch(tn[1], '')
            MAJ = {'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F': -1}
            f = MAJ[p[0]] + 7 * p[1] + {'major': 0, 'ionian': 0, 'minor': -3, 'aeolian': -3, 'dorian': -2, 'mixolydian': -1, 'lydian': 1, 'phrygian': -4, 'locrian': -5}[mode]
            S.keys.append((S.t, f, mode)); return
        if c == 'partial':
            d = self.next(); base, dots, mult, _ = parse_dur(d[1] if d[0] == 'num' else d[4], S.last)
            S.partial = length(base, dots, mult); return
        if c in ('tuplet', 'times'):
            n, m = map(int, self.next()[1].split('/'))
            if c == 'times': n, m = m, n
            if self.peek()[0] == 'num': self.next()   # tuplet span duration: only for brackets
            S.factor *= F(m, n); S.tupid += 1
            tp = dict(n=n, m=m, first=None, lastn=None, id=S.tupid); S.tup.append(tp)
            self.item()
            S.tup.pop(); S.factor /= F(m, n)
            if tp['lastn'] is not None: tp['lastn']['tuptags'].append(('stop', tp['id']))
            return
        if c in ('grace', 'acciaccatura', 'appoggiatura', 'slashedGrace', 'afterGrace'):
            if c == 'afterGrace': sys.exit('\\afterGrace: write it as \\grace before the next note')
            was = S.grace; S.grace = 'slash' if c in ('acciaccatura', 'slashedGrace') else True
            self.item(); S.grace = was; return
        if c == 'repeat':
            kind = self.next()[1]; n = int(self.next()[1])
            if kind in ('unfold', 'percent', 'tremolo'):
                start = self.i
                for r in range(n): self.i = start; self.item()
                return
            t0 = S.t; self.item(); t1 = S.t
            alts = []
            if self.peek() == ('cmd', '\\alternative'):
                self.next(); assert self.next() == ('p', '{')
                while self.peek() != ('p', '}'):
                    a0 = S.t; self.item(); alts.append((a0, S.t))
                self.next()
            S.repeats.append((t0, t1, alts)); return
        if c == 'tempo':
            words, q = None, None
            if self.peek()[0] == 'str': words = self.next()[1][1:-1]
            if self.peek()[0] == 'num' and self.peek(1) == ('p', '='):
                un = self.next()[1]; self.next(); q = (un, int(self.next()[1].rstrip('.')))
            add_pending('tempo', (words, q)); return
        if c == 'mark':
            n = self.peek()
            if n[0] == 'str': self.next(); add_pending('words', n[1][1:-1])
            elif n == ('cmd', '\\markup'): self.next(); add_pending('words', self.markup())
            elif n == ('cmd', '\\default'): self.next()
            return
        if c == 'bar': S.bars.append((S.t, self.next()[1][1:-1])); return
        if c == 'markup': add_pending('words', self.markup()); return
        if c == 'clef':
            n = self.next(); S.clefs.append((S.t, (n[1][1:-1] if n[0] == 'str' else n[1])))
            return
        if c == 'ottava': return
        if c in ('set', 'unset', 'override', 'revert'):
            prop = self.next()[1]
            if c in ('set', 'override') and self.peek() == ('p', '='):
                self.next(); v = self.peek()
                if v[0] in ('str', 'num', 'prop') or (v[0] == 'word' and pitch(v[1], '') is None and v[1] not in ('r', 'R', 's')) or v == ('cmd', '\\markup'): self.next()
                else: return   # the value was a Scheme #t, dropped by the cleaner: the next token is music
                if v == ('cmd', '\\markup'): self.markup(); return
                if 'midiInstrument' in prop and v[0] == 'str':
                    ins = v[1][1:-1]
                    if 'pizz' in ins and S.midi != 'pizz': add_pending('words', 'pizz.'); S.midi = 'pizz'
                    elif 'pizz' not in ins and S.midi == 'pizz': add_pending('words', 'arco'); S.midi = 'arco'
            return
        if c in ('language', 'include', 'version'): self.next(); return
        if c in IGNORE: return
        if c in CMD_ART or c in ('cresc', 'dim'): self.i -= 1; self.postfix(); return
        if c == 'relative': sys.exit('\\relative: run `ly rel2abs` first')
        if c == 'transpose':
            a, b = self.next(), self.next()
            if (a[1], a[2]) != (b[1], b[2]): sys.exit('\\transpose %s %s: not supported (only a transpose to the same pitch)' % (a[1] + a[2], b[1] + b[2]))
            return
        if c in ('omit', 'hide', 'undo'):   # \omit DynamicText: a grob, no music
            if self.peek()[0] in ('word', 'prop'): self.next()
            return
        if c in ('context', 'new'):   # \context Staff [= name] music: the music, in this staff
            self.next()
            if self.peek() == ('p', '='): self.next(); self.next()
            return
        print('ignored command \\' + c, file=sys.stderr)

    def run(self):
        while self.i < len(self.toks): self.item()


for name in EXPR.split('+'):
    if name not in VARS: sys.exit('no variable ' + name)
    if name in LABELS: add_pending('words', LABELS[name])
    P(VARS[name]).run()
END = S.t
# repeat signs written as bar lines (\bar "|:" ":|" ":|:" ":|.|:" ...): a repeat from the last start sign (or the beginning)
st = F(0)
for t, b_ in sorted(S.bars, key=lambda x: x[0]):
    if ':' not in b_: continue
    if b_.startswith(':') and not any(r[0] == st and r[1] == t for r in S.repeats): S.repeats.append((st, t, []))
    if b_.endswith(':'): st = t
for r in S.repeats:   # a \repeat volta starting there resets the start
    pass
ev = S.ev
# a pizz. word written as text also switches the sound, and the edition's arco may only be in the MIDI setup
for e in ev:
    for k, v in e['dirs']:
        if k == 'words' and re.fullmatch(r'pizz\.?', v): S.midi = 'pizz'

# ---- chords from simultaneous notes in one voice
ev.sort(key=lambda e: (e['voice'], e['t'], not e['grace'], e['seq']))
merged = []
for e in ev:
    p = merged[-1] if merged else None
    if (p and e['kind'] == 'note' and p['kind'] == 'note' and not e['grace'] and not p['grace'] and p['voice'] == e['voice']
            and p['t'] == e['t'] and p['d'] == e['d']):
        p['pitches'] += e['pitches']; p['accs'] += e['accs']
        for k in ('arts', 'orn', 'tech', 'fing', 'dirs', 'tuptags'): p[k] += e[k]
        p['ties'] |= e['ties']; p['sl_start'] += e['sl_start']; p['sl_stop'] += e['sl_stop']; p['ferm'] |= e['ferm']
        p['beam'] = p['beam'] or e['beam']
        continue
    if p and p['voice'] == e['voice'] and not e['grace'] and not p['grace'] and p['t'] == e['t'] and e['d'] > 0:
        print('two different notes at once in voice %d at %s: second moved to voice %d' % (e['voice'], e['t'], e['voice'] + 4), file=sys.stderr)
        e['voice'] += 4
    merged.append(e)
ev = sorted(merged, key=lambda e: (e['voice'], e['t'], not e['grace'], e['seq']))

# ---- bars from the time signatures
times = {}
for t, n, m in S.times: times[t] = (n, m)
if F(0) not in times: times[F(0)] = (4, 4)
bars = []   # (start, end, (n, m))
t, sig = F(0), times[F(0)]
tsorted = sorted(times)
first = True
while t < END:
    sig = times[max(x for x in tsorted if x <= t)]
    L = F(sig[0], sig[1])
    if first and S.partial: L = S.partial
    first = False
    nxt = [x for x in tsorted if t < x < t + L]
    e_ = min(nxt) if nxt else min(t + L, END)
    if nxt: print('time change inside a bar at %s: a short bar' % e_, file=sys.stderr)
    bars.append((t, e_, sig)); t = e_
# a repeat sign inside a bar (\bar ":|:" before an upbeat): the bar is cut there into two halves, the second an
# implicit bar with the same number, so the repeat sign can stand on a barline
cuts = sorted({t for r in S.repeats for t in [r[0], r[1]] + [x for a in r[2] for x in a]} - {b[0] for b in bars} - {END})
cont = set()
for t in cuts:
    k = next((i for i, b in enumerate(bars) if b[0] < t < b[1]), None)
    if k is None: continue
    b0, b1, sg = bars[k]; bars[k:k + 1] = [(b0, t, sg), (t, b1, sg)]; cont.add(t)
num, BNUM = (0 if S.partial else 1) - 1, []
for b in bars:
    if b[0] not in cont: num += 1
    BNUM.append(num)
starts = [b[0] for b in bars]
for c in S.checks:
    if c not in starts and c != END: print('bar check off at', c, '(bar %d)' % next(i for i, b in enumerate(bars) if b[0] <= c < b[1]), file=sys.stderr)

# ---- split notes over barlines (tied)
def spell(d):
    for base in (1, 2, 4, 8, 16, 32, 64, 128):
        for dots in (0, 1, 2):
            if length(F(base), dots, F(1)) == d: return F(base), dots
    return None


out = []
for e in ev:
    while e['d'] and not e['grace']:
        bi = next(i for i, b in enumerate(bars) if b[0] <= e['t'] < b[1])
        if e['t'] + e['d'] <= bars[bi][1]: break
        cut = bars[bi][1] - e['t']; rest_ = e['d'] - cut
        if e['tup'] or not spell(cut):
            print('note over a barline at %s (bar %d) cannot be split cleanly' % (e['t'], bi + 1), file=sys.stderr); break
        a = dict(e); a['d'] = cut; a['base'], a['dots'] = spell(cut)
        a['sl_stop'] = 0; a['ferm'] = False
        a['ties'] = e['kind'] == 'note'; a['split'] = True
        out.append(a)
        b = dict(e); b['t'] = bars[bi][1]; b['d'] = rest_; b['base'], b['dots'] = spell(rest_) or (e['base'], e['dots'])   # R1*5: cut again at the next bar
        b['dirs'] = []; b['arts'] = []; b['sl_start'] = 0; b['fing'] = []; b['tiedfrom'] = True; b['tuptags'] = []
        e = b
    out.append(e)
ev = out

# ---- ties: a note tied to the next note of the same voice
for i, e in enumerate(ev):
    if e['ties'] and e['kind'] == 'note':
        nx = next((x for x in ev[i + 1:] if x['voice'] == e['voice'] and not x['grace'] and x['t'] >= e['t'] + e['d']), None)
        if nx and nx['t'] == e['t'] + e['d']:
            e['tie_to'] = [p for p in e['pitches'] if p in nx['pitches']]
            nx.setdefault('tie_from', []); nx['tie_from'] += e['tie_to']

# ---- explicit beams only where they hold notes short enough (a beam over a rest is left to pack.py's default)
SHORTS = {F(8), F(16), F(32), F(64), F(128)}
for v in {e['voice'] for e in ev}:
    vs = [e for e in ev if e['voice'] == v and not e['grace']]
    grp = []
    for e in vs:
        b = e.get('beam')
        if b == 'begin': grp = [e]
        elif b in ('continue', 'end') and grp: grp.append(e)
        else: grp = []
        if b == 'end' and grp:
            ok = len(grp) > 1 and all(x['kind'] == 'note' and x['base'] in SHORTS for x in grp)
            bi = {next(i for i, bb in enumerate(bars) if bb[0] <= x['t'] < bb[1]) for x in grp}
            for n_, x in enumerate(grp):
                x['beamx'] = None if not ok or len(bi) > 1 else 'begin' if n_ == 0 else 'end' if n_ == len(grp) - 1 else 'continue'
            grp = []

# ---- divisions
vals = [e['t'] for e in ev] + [e['d'] for e in ev] + [b[0] for b in bars] + [b[1] for b in bars]
DIV = 1
for v in vals: DIV = DIV * (v * 4).denominator // math.gcd(DIV, (v * 4).denominator)
dv = lambda x: int(x * 4 * DIV)

TYPES = {F(1, 2): 'breve', F(1): 'whole', F(2): 'half', F(4): 'quarter', F(8): 'eighth', F(16): '16th', F(32): '32nd', F(64): '64th', F(128): '128th'}
ALTS = {2: 'double-sharp', 1: 'sharp', 0: 'natural', -1: 'flat', -2: 'flat-flat'}
ORDER_SHARP = 'FCGDAEB'


def keymap(f):
    k = {s: 0 for s in 'CDEFGAB'}
    if f > 0:
        for s in ORDER_SHARP[:f]: k[s] = 1
    else:
        for s in ORDER_SHARP[::-1][:-f]: k[s] = -1
    return k


root = ET.Element('score-partwise', version='3.1')
ET.SubElement(ET.SubElement(ET.SubElement(root, 'identification'), 'encoding'), 'software').text = 'Violin Toolkit ly2xml.py'
pl = ET.SubElement(root, 'part-list'); sp = ET.SubElement(pl, 'score-part', id='P1'); ET.SubElement(sp, 'part-name').text = PNAME
part = ET.SubElement(root, 'part', id='P1')
keys = sorted(S.keys); keyat = lambda t: max((k for k in keys if k[0] <= t), default=(0, 0, 'major'))
rep_start = {r[0] for r in S.repeats}; rep_end = {r[1] if not r[2] else r[2][0][1] for r in S.repeats}
ends1 = {a[0][0]: (1, a[0][1]) for r in S.repeats for a in [r[2]] if a}
ending_bars = []
for r in S.repeats:
    for n_, (a0, a1) in enumerate(r[2]): ending_bars.append((a0, a1, n_ + 1, n_ + 1 < len(r[2])))
for t in rep_start | rep_end:
    if t not in starts and t != END: print('repeat sign inside a bar at', t, file=sys.stderr)
barstyle = {}
for t, s in S.bars: barstyle[t] = s

voices = sorted({e['voice'] for e in ev})
CLEFS = {'treble': ('G', 2), 'violin': ('G', 2), 'G': ('G', 2), 'alto': ('C', 3), 'C': ('C', 3), 'tenor': ('C', 4), 'bass': ('F', 4), 'F': ('F', 4)}
def clefat(t):   # a clef change inside a bar shows from that bar
    c = 'treble'
    for t0, n in sorted(S.clefs, key=lambda x: x[0]):
        if t0 < next(b[1] for b in bars if b[0] <= t < b[1]): c = n
    return c
prevsig, prevkey = None, None
tempo_done = False


def direction(meas, kind, val, voice, placement='above'):
    global tempo_done
    d = ET.SubElement(meas, 'direction', placement='below' if kind in ('dyn', 'wedge') else placement)
    q = None
    if kind == 'dyn': ET.SubElement(ET.SubElement(ET.SubElement(d, 'direction-type'), 'dynamics'), val)
    elif kind == 'wedge': ET.SubElement(ET.SubElement(d, 'direction-type'), 'wedge', type=val)
    elif kind == 'words': ET.SubElement(ET.SubElement(d, 'direction-type'), 'words').text = val
    elif kind == 'tempo':
        words, q = val
        unit = '4'
        if q and not isinstance(q, int): unit, q = q   # (unit, value) from \tempo 4. = 76
        if TEMPO and not tempo_done: unit, q = TEMPO
        if words: ET.SubElement(ET.SubElement(d, 'direction-type'), 'words').text = words
        if q:
            mt = ET.SubElement(ET.SubElement(d, 'direction-type'), 'metronome')
            ET.SubElement(mt, 'beat-unit').text = TYPES[F(int(unit.rstrip('.')))]
            for _ in range(unit.count('.')): ET.SubElement(mt, 'beat-unit-dot')
            ET.SubElement(mt, 'per-minute').text = str(q); tempo_done = True
            q = round(q * length(F(int(unit.rstrip('.'))), unit.count('.'), F(1)) * 4, 2)   # <sound tempo> is in crotchets
            if q == int(q): q = int(q)
    if not len(d): meas.remove(d); return
    ET.SubElement(d, 'voice').text = str(voice)
    if q: ET.SubElement(d, 'sound', tempo=str(q))


if TEMPO and not any(k == 'tempo' for e in ev for k, _ in e['dirs']):
    fe = min((e for e in ev), key=lambda e: (e['t'], e['voice']))
    fe['dirs'].insert(0, ('tempo', (None, TEMPO)))

for bi, (b0, b1, sig) in enumerate(bars):
    meas = ET.SubElement(part, 'measure', number=str(BNUM[bi]))
    if (S.partial and bi == 0) or b0 in cont: meas.set('implicit', 'yes')
    if b0 in rep_start:
        bl = ET.SubElement(meas, 'barline', location='left'); ET.SubElement(bl, 'bar-style').text = 'heavy-light'; ET.SubElement(bl, 'repeat', direction='forward')
    for a0, a1, n_, _ in ending_bars:
        if a0 == b0:
            bl = meas.find("barline[@location='left']")
            if bl is None: bl = ET.SubElement(meas, 'barline', location='left')
            ET.SubElement(bl, 'ending', number=str(n_), type='start').text = '%d.' % n_
    k = keyat(b0)
    at = None
    if bi == 0 or clefat(b0) != clefat(bars[bi - 1][0]) or sig != prevsig or k[1:] != prevkey or (b1 - b0) != F(sig[0], sig[1]) and bi:
        at = ET.SubElement(meas, 'attributes')
        if bi == 0: ET.SubElement(at, 'divisions').text = str(DIV)
        if bi == 0 or k[1:] != prevkey:
            ke = ET.SubElement(at, 'key'); ET.SubElement(ke, 'fifths').text = str(k[1]); ET.SubElement(ke, 'mode').text = k[2]
        if bi == 0 or sig != prevsig:
            te = ET.SubElement(at, 'time'); ET.SubElement(te, 'beats').text = str(sig[0]); ET.SubElement(te, 'beat-type').text = str(sig[1])
        if bi == 0 or clefat(b0) != clefat(bars[bi - 1][0]):
            sg, ln = CLEFS.get(clefat(b0), ('G', 2))
            cl = ET.SubElement(at, 'clef'); ET.SubElement(cl, 'sign').text = sg; ET.SubElement(cl, 'line').text = str(ln)
        if not len(at): meas.remove(at)
    prevsig, prevkey = sig, k[1:]
    pos = b0
    accst = {}
    km = keymap(k[1])
    for vi, v in enumerate(voices):
        vev = [e for e in ev if e['voice'] == v and b0 <= e['t'] < b1]
        if not vev: continue
        if vi and pos > b0:
            bk = ET.SubElement(meas, 'backup'); ET.SubElement(bk, 'duration').text = str(dv(pos - b0))
        pos = b0
        for e in vev:
            if e['t'] > pos:
                fw = ET.SubElement(meas, 'forward'); ET.SubElement(fw, 'duration').text = str(dv(e['t'] - pos)); ET.SubElement(fw, 'voice').text = str(v)
                pos = e['t']
            seen = set()
            for kd, val in e['dirs']:
                if (kd, str(val)) not in seen: seen.add((kd, str(val))); direction(meas, kd, val, v)
            ps = e['pitches'] or [None]
            for pi_, p in enumerate(ps):
                n = ET.SubElement(meas, 'note')
                if e['grace']:
                    g = ET.SubElement(n, 'grace')
                    if e['grace'] == 'slash': g.set('slash', 'yes')
                if pi_: ET.SubElement(n, 'chord')
                if p is None:
                    r = ET.SubElement(n, 'rest')
                    if e['full'] and e['d'] == b1 - b0: r.set('measure', 'yes')
                else:
                    pe = ET.SubElement(n, 'pitch'); ET.SubElement(pe, 'step').text = p[0]
                    if p[1]: ET.SubElement(pe, 'alter').text = str(p[1])
                    ET.SubElement(pe, 'octave').text = str(p[2])
                if not e['grace']: ET.SubElement(n, 'duration').text = str(dv(e['d']))
                tf, tt = p is not None and p in e.get('tie_from', []), p is not None and p in e.get('tie_to', [])
                if tf: ET.SubElement(n, 'tie', type='stop')
                if tt: ET.SubElement(n, 'tie', type='start')
                ET.SubElement(n, 'voice').text = str(v)
                if not (e['full'] and e['d'] == b1 - b0):
                    ET.SubElement(n, 'type').text = TYPES.get(e['base'], 'quarter')
                    for _ in range(e['dots']): ET.SubElement(n, 'dot')
                if p is not None:
                    key_ = (p[0], p[2]); cur = accst.get(key_, km[p[0]])
                    forced = pi_ < len(e['accs']) and e['accs'][pi_] in '!?' and e['accs'][pi_]
                    if (cur != p[1] or forced) and not tf:
                        a = ET.SubElement(n, 'accidental'); a.text = ALTS[p[1]]
                        if forced == '?': a.set('parentheses', 'yes')
                    accst[key_] = p[1]
                if e['tup']:
                    an = 1; nn = 1
                    for tp in e['tup']: an *= tp['n']; nn *= tp['m']
                    g_ = 1   # 6:4 stays 6:4, so the score prints a 6 (not 3:2)
                    tm = ET.SubElement(n, 'time-modification'); ET.SubElement(tm, 'actual-notes').text = str(an // g_); ET.SubElement(tm, 'normal-notes').text = str(nn // g_)
                if e.get('beamx') and not e['grace']:
                    ET.SubElement(n, 'beam', number='1').text = e['beamx']
                nots = ET.Element('notations')
                if tf: ET.SubElement(nots, 'tied', type='stop')
                if tt: ET.SubElement(nots, 'tied', type='start')
                if pi_ == 0:
                    for _ in range(e['sl_stop']): ET.SubElement(nots, 'slur', type='stop', number='1')
                    for _ in range(e['sl_start']): ET.SubElement(nots, 'slur', type='start', number='1')
                    for kind_, tid in e['tuptags']: ET.SubElement(nots, 'tuplet', type=kind_, number=str(1 + (tid % 2)), bracket='yes')
                    if e['orn'] or e['trem']:
                        o = ET.SubElement(nots, 'ornaments')
                        for x in e['orn']: ET.SubElement(o, x)
                        if e['trem']:
                            flags = {F(8): 1, F(16): 2, F(32): 3}.get(e['base'], 0)
                            ET.SubElement(o, 'tremolo', type='single').text = str(max(1, int(math.log2(e['trem'])) - 2 - flags))
                    if e['tech'] or e['fing']:
                        te_ = ET.SubElement(nots, 'technical')
                        for x in e['tech']: ET.SubElement(te_, x)
                        for f_ in e['fing']: ET.SubElement(te_, 'fingering').text = f_
                    if e['arts']:
                        ar = ET.SubElement(nots, 'articulations')
                        for x in e['arts']: ET.SubElement(ar, x)
                    if e['ferm']: ET.SubElement(nots, 'fermata', type='upright')
                if len(nots): n.append(nots)
            if not e['grace']: pos = e['t'] + e['d']
    # right barline: repeat end, ending stop, a written \bar
    right = None
    def rb():
        global right
        if right is None: right = ET.SubElement(meas, 'barline', location='right')
        return right
    st = barstyle.get(b1)
    if b1 == END and st is None: st = '|.'
    if b1 in rep_end:
        bl = rb(); ET.SubElement(bl, 'bar-style').text = 'light-heavy'
        for a0, a1, n_, more in ending_bars:
            if a1 == b1 and more: ET.SubElement(bl, 'ending', number=str(n_), type='stop')
        ET.SubElement(bl, 'repeat', direction='backward')
    else:
        for a0, a1, n_, more in ending_bars:
            if a1 == b1:
                bl = rb(); ET.SubElement(bl, 'bar-style').text = 'light-heavy' if b1 == END else 'regular'
                ET.SubElement(bl, 'ending', number=str(n_), type='stop' if more else 'discontinue')
        if right is None and st in ('||', '|.', '.|', '..'):
            bl = rb(); ET.SubElement(bl, 'bar-style').text = {'||': 'light-light', '|.': 'light-heavy', '.|': 'heavy-light', '..': 'light-light'}[st]

ET.ElementTree(root).write(OUT, encoding='unicode')
nn = sum(len(e['pitches']) for e in ev if e['kind'] == 'note' and not e.get('tiedfrom'))
print('%s: %d bars, %d notes, voices %s, divisions %d, length %s whole notes' % (OUT, len(bars), nn, voices, DIV, END))
