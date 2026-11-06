(function () {
  /* MIDI player (Trix, 2026-11-06): play a one-part violin MIDI file. The fingerboard below lights each note
     as it sounds (APP.board, from board.html: every note grey, the played one in its string colour with the
     string wobble and rings), and a one-line score scrolls past a playhead above it, like the video Trix
     sent. Demo tunes are built in (src/midi/*.mid); a file can be imported (kept for this visit only). */
  var $ = function (id) { return document.getElementById(id); };
  var DEMOS = /*DEMOS*/[];
  var top = $('mpTop'), bar = $('mpBar'), songSel = $('mpSong'), fileIn = $('mpFile'), msg = $('mpMsg');
  var playBtn = $('mpPlay'), seek = $('mpSeek'), timeEl = $('mpTime'), speedEl = $('mpSpeed'), bpmEl = $('mpBpm');
  var scoreEl = $('mpScore'), svg = $('mpSvg'), keySvg = $('mpKey'), headEl = $('mpHead'), subEl = $('ttl-midi-sub');
  var songs = [], song = null, pos = 0, speed = 1, playing = false, ni = 0, active = [], last = 0, raf = 0, shown = false;
  var loop = false, loopBtn = $('mpLoop');
  /* Metronome (Trix): clicks with the tune, on its own beats (time signature, tempo, speed), the first of each bar
     stronger; remembered */
  var metro = false, metroBtn = $('mpMetro'), lastTick = -1;
  try { metro = localStorage.getItem('violin-midi-metro') === 'on'; } catch (e) {}   /* Loop: start again from the top at the end (Trix), remembered */
  try { loop = localStorage.getItem('violin-midi-loop') === 'on'; } catch (e) {}
  /* Mixer (Trix): violin and accompaniment levels, 0-1, remembered */
  var mix = { v: 1, a: 0.8 };
  try { var mj = JSON.parse(localStorage.getItem('violin-midi-mix') || 'null'); if (mj && isFinite(mj.v) && isFinite(mj.a)) mix = { v: Math.max(0, Math.min(1, mj.v)), a: Math.max(0, Math.min(1, mj.a)) }; } catch (e) {}

  /* ---------- the accompaniment: every part but the solo, on a soft synth (triangle through a low-pass), scheduled
     a quarter of a second ahead on the audio clock; it follows play, pause, seek, speed and loop ---------- */
  var accBus = null, ai = 0, accLive = [];
  function accOut() {
    var a = APP.board.audio(); if (!a) return null;
    if (!accBus || accBus.context !== a.ctx) {
      accBus = a.ctx.createGain(); accBus.gain.value = mix.a;
      var lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      accBus.connect(lp); lp.connect(a.out);
    }
    return accBus;
  }
  function accNote(n, from) {   /* from: song seconds where it starts sounding (a note already under way on resume) */
    var bus = accOut(); if (!bus) return;
    var c = bus.context, now = c.currentTime;
    var t0 = now + Math.max(0, (from - pos) / speed), t1 = now + Math.max(0.03, (n.e - pos) / speed);
    if (t1 <= t0 + 0.02) return;
    var o = c.createOscillator(), g = c.createGain(), pk = 0.16 * n.v, a4 = (window.APP && APP.a4) || 442;
    o.type = 'triangle'; o.frequency.value = a4 * Math.pow(2, (n.m - 69) / 12);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(pk, t0 + 0.012);
    g.gain.setTargetAtTime(pk * 0.55, t0 + 0.012, 0.25);   /* a piano-ish fall after the attack */
    g.gain.setTargetAtTime(0, t1, 0.04);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t1 + 0.3);
    var rec = { o: o, g: g }; accLive.push(rec);
    o.onended = function () { var i = accLive.indexOf(rec); if (i >= 0) accLive.splice(i, 1); try { g.disconnect(); } catch (e) {} };
  }
  function accStop() {
    accLive.forEach(function (r) {
      try { var t = r.g.context.currentTime; r.g.gain.cancelScheduledValues(t); r.g.gain.setTargetAtTime(0, t, 0.02); r.o.stop(t + 0.15); } catch (e) {}
    });
    accLive = [];
  }
  function accFrom(p) { var a = song ? song.acc : [], i = 0; while (i < a.length && a[i].t < p - 1e-6) i++; return i; }
  function accStart() {   /* resuming: the accompaniment notes already sounding at this point join in */
    accStop(); if (!song || !song.acc.length) return;
    song.acc.forEach(function (n) { if (n.t < pos - 1e-6 && n.e > pos + 0.05) accNote(n, pos); });
    ai = accFrom(pos);
  }
  function accAhead() {
    var a = song.acc;
    while (ai < a.length && a[ai].t <= pos + 0.25 * speed) { if (a[ai].e > pos) accNote(a[ai], a[ai].t); ai++; }
  }

  function fail(text) { var e = new Error(text); e.mine = true; return e; }

  /* ---------- reading a MIDI file ---------- */
  function parse(buf) {
    var u8 = new Uint8Array(buf), p = 0;
    function str(at, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8[at + i]); return s; }
    function u32(at) { return ((u8[at] << 24) | (u8[at + 1] << 16) | (u8[at + 2] << 8) | u8[at + 3]) >>> 0; }
    function u16(at) { return (u8[at] << 8) | u8[at + 1]; }
    function vlq() { var v = 0, b; do { b = u8[p++]; v = (v * 128) + (b & 0x7f); } while ((b & 0x80) && p < u8.length); return v; }
    if (u8.length < 14 || str(0, 4) !== 'MThd') throw fail('This is not a MIDI file.');
    var ntr = u16(10), tpq = u16(12);
    if (tpq & 0x8000) throw fail('This MIDI file keeps time in a way the player can’t read.');
    p = 8 + u32(4);
    var tempos = [], sig = null, sf = null, minor = false, tracks = [];
    for (var t = 0; t < ntr && p + 8 <= u8.length; t++) {
      var id = str(p, 4), end = Math.min(p + 8 + u32(p + 4), u8.length);
      p += 8;
      if (id !== 'MTrk') { p = end; continue; }
      var tick = 0, rs = 0, open = {}, notes = [], chans = {}, name = '', inst = '', prog = {};
      while (p < end) {
        tick += vlq();
        var st = u8[p];
        if (st & 0x80) { p++; if (st < 0xf0) rs = st; } else st = rs;   /* running status: the last channel status carries on */
        if (st === 0xff) {
          var ty = u8[p++], l = vlq();
          if (ty === 0x51 && l >= 3) tempos.push({ tick: tick, us: (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2] });
          else if (ty === 0x58 && l >= 2 && !sig) sig = { num: u8[p], den: Math.pow(2, u8[p + 1]) };
          else if (ty === 0x59 && l >= 1 && sf === null) { sf = (u8[p] << 24) >> 24; minor = l >= 2 && u8[p + 1] === 1; }
          else if ((ty === 0x03 && !name) || (ty === 0x04 && !inst)) {   /* track name, instrument name (UTF-8, e.g. 小提琴) */
            var txt = ''; try { txt = new TextDecoder().decode(u8.subarray(p, p + Math.min(l, 60))); } catch (e) { txt = str(p, Math.min(l, 60)); }
            txt = txt.replace(/[\u0000-\u001f\ufffd]/g, '').trim();
            if (ty === 0x03) name = txt; else inst = txt;
          }
          p += l;
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();
        } else if (st >= 0x80) {
          var hi = st & 0xf0, ch = st & 15, a = u8[p++], b = (hi === 0xc0 || hi === 0xd0) ? 0 : u8[p++], k = ch + ':' + a;
          if (hi === 0xc0 && !(ch in prog)) prog[ch] = a;   /* the channel's instrument (General MIDI program) */
          if (hi === 0x90 && b > 0) (open[k] = open[k] || []).push([tick, b]);
          else if (hi === 0x80 || hi === 0x90) {
            if (open[k] && open[k].length) { var on = open[k].shift(); notes.push({ m: a, t0: on[0], t1: tick, ch: ch, v: on[1] }); chans[ch] = 1; }
          }
        } else break;   /* a data byte with no status: the file is damaged, stop reading this track */
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (on) { notes.push({ m: +k.split(':')[1], t0: on[0], t1: tick, ch: +k.split(':')[0], v: on[1] }); }); });
      if (notes.length) tracks.push({ notes: notes, chans: Object.keys(chans).length || 1, name: name || inst, label: name + ' ' + inst, prog: prog });
      p = end;
    }
    if (!tracks.length) throw fail('This file has no notes.');
    /* several parts (Trix): the violin is the first track named as one (track or instrument name: violin, violino,
       violín, 小提琴), else the first set to General MIDI's Violin (program 40), else the first track with notes;
       every other track is accompaniment. A one-track file with several channels splits by channel the same way
       (the Violin channel, else the first channel heard). Drums (channel 10) are left out: the accompaniment synth
       plays pitched notes only. */
    var DRUM = 9, VIOLIN = /violin|violín|小提琴/i, GM_VIOLIN = 40, solo, acc = [];
    tracks = tracks.map(function (tr) { tr.notes = tr.notes.filter(function (n) { return n.ch !== DRUM; }); return tr; }).filter(function (tr) { return tr.notes.length; });
    if (!tracks.length) throw fail('This file has no notes.');
    var soloName = '';
    function gmViolin(tr) { return Object.keys(tr.prog).some(function (c) { return tr.prog[c] === GM_VIOLIN && tr.notes.some(function (n) { return n.ch === +c; }); }); }
    if (tracks.length === 1 && tracks[0].chans > 1) {
      var pr = tracks[0].prog, vc = Object.keys(pr).filter(function (c) { return pr[c] === GM_VIOLIN; }).map(Number)
        .filter(function (c) { return tracks[0].notes.some(function (n) { return n.ch === c; }); });
      var first = vc.length ? vc[0] : tracks[0].notes.reduce(function (a, n) { return !a || n.t0 < a.t0 ? n : a; }, null).ch;
      solo = tracks[0].notes.filter(function (n) { return n.ch === first; });
      acc = tracks[0].notes.filter(function (n) { return n.ch !== first; });
      soloName = tracks[0].name;
    } else {
      var si = 0, byName = -1, byProg = -1;
      tracks.forEach(function (tr, i) { if (byName < 0 && VIOLIN.test(tr.label)) byName = i; if (byProg < 0 && gmViolin(tr)) byProg = i; });
      si = byName >= 0 ? byName : byProg >= 0 ? byProg : 0;
      solo = tracks[si].notes; soloName = tracks[si].name;
      tracks.forEach(function (tr, i) { if (i !== si) acc = acc.concat(tr.notes); });
    }
    var firstTick = acc.reduce(function (a, n) { return Math.min(a, n.t0); }, Infinity);
    var sg = build(solo, tpq, tempos, sig || { num: 4, den: 4 }, sf || 0, firstTick);
    sg.minor = minor;
    sg.parts = tracks.length > 1 ? tracks.length : tracks[0].chans;
    sg.soloName = soloName || '';
    /* the accompaniment in seconds from the first bar kept, by start time */
    sg.acc = acc.map(function (n) { var t = sg.sec(n.t0); return { m: n.m, t: t, e: Math.max(t + 0.03, sg.sec(Math.max(n.t1, n.t0 + 1))), v: (n.v || 90) / 127 }; })
      .filter(function (n) { return n.e > 0; }).sort(function (a, b) { return a.t - b.t; });
    if (sg.acc.length) sg.end = Math.max(sg.end, sg.acc[sg.acc.length - 1].e, Math.max.apply(null, sg.acc.map(function (n) { return n.e; })));
    return sg;
  }

  /* ticks to seconds through the tempo changes, and back */
  function build(raw, tpq, tempos, sig, sf, firstTick) {   /* firstTick: the accompaniment's first note, if any */
    tempos.sort(function (a, b) { return a.tick - b.tick; });
    if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
    var segs = [], sec = 0;
    tempos.forEach(function (tp, i) {
      if (i) sec += (tp.tick - tempos[i - 1].tick) / tpq * tempos[i - 1].us / 1e6;
      segs.push({ tick: tp.tick, sec: sec, spt: tp.us / 1e6 / tpq });
    });
    function toSec(tick) { var s = segs[0]; for (var i = 1; i < segs.length && segs[i].tick <= tick; i++) s = segs[i]; return s.sec + (tick - s.tick) * s.spt; }
    raw.sort(function (a, b) { return a.t0 - b.t0 || a.m - b.m; });
    var low = 0, high = 0;
    var notes = raw.map(function (n) {
      if (n.m < 55) low++; else if (!APP.board.where(n.m)) high++;
      var t = toSec(n.t0), e = toSec(Math.max(n.t1, n.t0 + 1));
      /* a short break before the next note, like a bow change (Trix: notes sounded too long and ran together) */
      return { m: n.m, t: t, e: e - Math.min(0.05, (e - t) * 0.15), b: n.t0 / tpq, own: (n.t1 - n.t0) / tpq };
    }).filter(function (n) { return n.m >= 55; });   /* below the G string: left out */
    if (!notes.length) throw fail('Every note in this file is below the violin’s G string.');
    /* whole empty bars before the first note are skipped (Trix): the song starts in the bar of its first note */
    var barQ = sig.num * 4 / sig.den, firstB = Math.min(notes[0].b, isFinite(firstTick) ? firstTick / tpq : Infinity);
    var skipB = Math.floor(firstB / barQ + 1e-6) * barQ, skipT = toSec(skipB * tpq);   /* with an accompaniment: bars where every part is silent */
    if (skipB > 0) notes.forEach(function (n) { n.b -= skipB; n.t -= skipT; n.e -= skipT; });
    /* how long each note looks on the score: until the next note starts (a short breath between notes is
       not a rest), else its own length; rounded to note values a beginner part uses */
    var VALS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
    notes.forEach(function (n, i) {
      var j = i + 1; while (j < notes.length && notes[j].b <= n.b + 1e-6) j++;
      var gap = j < notes.length ? notes[j].b - n.b : Infinity, len;
      if (gap <= n.own + 0.5) len = gap;   /* runs on to the next note: a short breath is not a rest */
      else {   /* a rest follows: a short (staccato) note is written to the end of its beat (Trix: show the rests) */
        var unit = sig.den >= 8 ? 0.5 : 1, endB = n.b + n.own;
        len = n.own < unit ? Math.min(gap, Math.ceil(endB / unit - 1e-6) * unit - n.b) : n.own;
      }
      n.len = VALS.reduce(function (best, v) { return Math.abs(v - len) < Math.abs(best - len) ? v : best; }, 4);
    });
    /* the string each note is played on: the highest that has it within the octave; notes sounding together (double
       stops) go on different strings, high note on the higher string, where the board can show it */
    for (var i = 0; i < notes.length; ) {
      var j = i; while (j < notes.length && Math.abs(notes[j].b - notes[i].b) < 1e-6) j++;
      var maxSi = 3, unit = notes.slice(i, j).sort(function (a, b) { return b.m - a.m; });
      unit.forEach(function (n, u) {
        /* within the octave first (lowest position); a double stop's lower note goes up the next string down */
        var si = u === 0 ? strFor(n.m, 3, 12) : strFor(n.m, maxSi, 19);
        if (si < 0) si = strFor(n.m, 3, 19);
        n.si = si; if (si >= 0) maxSi = si - 1;
      });
      fingers(unit);
      i = j;
    }
    /* open string or 4th finger for the open D, A and E (Trix, the usual rule): going up next, the open string;
       going down, staying on the same note, or at the end, the 4th finger on the string below; and a long note
       (a minim or longer, where vibrato is wanted) always the 4th finger. Single notes only; chords keep theirs. */
    /* onsets as units: [first index, end index] */
    var units = [];
    for (var u0 = 0; u0 < notes.length; ) { var u1 = u0; while (u1 < notes.length && Math.abs(notes[u1].b - notes[u0].b) < 1e-6) u1++; units.push([u0, u1]); u0 = u1; }
    function single(q) { var un = units[q]; return un && un[1] - un[0] === 1 ? notes[un[0]] : null; }
    function topM(q) { var un = units[q], m = -1; for (var z = un[0]; z < un[1]; z++) m = Math.max(m, notes[z].m); return m; }
    for (var q = 0; q < units.length; ) {
      var one = single(q), k4 = one ? OPEN.indexOf(one.m) : -1;
      if (!one || k4 <= 0 || one.si !== k4) { q++; continue; }
      /* a run of the same note repeated stays on one string, decided by the note after the run */
      var r = q, long = false; while (single(r) && single(r).m === one.m && single(r).si === k4) { if (single(r).len >= 2) long = true; r++; }
      var nextM = r < units.length ? topM(r) : null;
      if (long || nextM === null || nextM < one.m) for (var z = q; z < r; z++) { single(z).si = k4 - 1; single(z).fg = 4; }
      q = r;
    }
    var lastN = notes[notes.length - 1];
    return {
      notes: notes, sig: sig, sf: Math.max(-7, Math.min(7, sf)),
      bpm: Math.round(60e6 / tempos.filter(function (tp) { return tp.tick <= skipB * tpq; }).pop().us),   /* crotchets a minute, where the song starts */
      end: Math.max.apply(null, notes.map(function (n) { return n.e; })), beats: lastN.b + lastN.len,
      toBeat: function (s) {   /* seconds to beats, for scrolling the score (both counted from the first bar kept) */
        s += skipT;
        var g = segs[0]; for (var i = 1; i < segs.length && segs[i].sec <= s; i++) g = segs[i];
        return (g.tick + (s - g.sec) / g.spt) / tpq - skipB;
      },
      low: low, high: high,
      sec: function (tick) { return toSec(tick) - skipT; }   /* ticks to seconds from the first bar kept (the accompaniment) */
    };
  }

  /* ---------- the score: one line that scrolls past the playhead ---------- */
  var S = 9, Y0 = 46, xAt = null;          /* staff space, top line, beats to x (set by drawScore) */
  var BOT = Y0 + 4 * S;                    /* bottom line, E4 */
  var LET = 'CDEFGAB', SHARP_K = [3, 0, 4, 1, 5, 2, 6], FLAT_K = [6, 2, 5, 1, 4, 0, 3];   /* F C G D A E B / B E A D G C F as letter numbers */
  var SHARP_P = [10, 7, 11, 8, 5, 9, 6], FLAT_P = [6, 9, 5, 8, 4, 7, 3];                 /* where they sit on the treble staff */
  var SP_S = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  var SP_F = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  var STR = [[76, '--e'], [69, '--a'], [62, '--d'], [55, '--g']];
  var OPEN = [55, 62, 69, 76], HUE = ['--g', '--d', '--a', '--e'];   /* by string, G = 0 */
  function strFor(m, maxSi, lim) { for (var si = Math.min(3, maxSi); si >= 0; si--) if (m >= OPEN[si] && m <= OPEN[si] + lim) return si; return -1; }
  /* fingering for notes played together, in one hand position that reaches them all: 1st, 3rd, 5th or 7th
     (1st finger at 1, 5, 8, 12 semitones up; each finger about a tone further; 1st position only to the 4th
     finger at 7). 0 = open string. */
  var POS = [[1, 6], [5, 7], [8, 7], [12, 7]];
  function fingers(unit) {
    var ns = unit.filter(function (n) { return n.si >= 0 && n.m > OPEN[n.si]; }).map(function (n) { return n.m - OPEN[n.si]; });
    var p = POS.filter(function (q) { return ns.every(function (n) { return n >= q[0] && n <= q[0] + q[1]; }); })[0] || POS[3];
    unit.forEach(function (n) {
      if (n.si < 0) { n.fg = null; return; }
      var k = n.m - OPEN[n.si], d = k - p[0];
      n.fg = k === 0 ? 0 : d <= 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4;
    });
  }
  function restSvg(r, x) {
    var v = r.whole ? 4 : r.v, base = v === 3 ? 2 : v === 1.5 ? 1 : v === 0.75 ? 0.5 : v, dot = base !== v, out;
    if (r.whole || base === 4) out = '<rect x="' + (x - 5.5) + '" y="' + (Y0 + S) + '" width="11" height="' + (S / 2) + '"/>';   /* hangs from the 4th line */
    else if (base === 2) out = '<rect x="' + (x - 5.5) + '" y="' + (Y0 + 2 * S - S / 2) + '" width="11" height="' + (S / 2) + '"/>';   /* sits on the middle line */
    else if (base === 1) {   /* the printed crotchet rest (Trix): thin top, thick wedge, lower stroke, hook; in staff spaces */
      /* traced from Trix's reference picture: body (thin top flaring into the wedge, lower stroke) + hook */
      out = ['M-0.36 0.58 L-0.27 0.52 L0.02 0.95 L0.34 1.44 L-0.04 2.02 L0.50 2.78 L0.38 2.86 L-0.20 2.30 L-0.46 1.92 L-0.10 1.02 Z',
        'M0.50 2.76 C0.20 2.40 -0.30 2.35 -0.47 2.62 C-0.60 2.95 -0.30 3.18 0.03 3.38 C-0.10 3.15 -0.12 2.88 0.06 2.74 C0.22 2.64 0.40 2.68 0.50 2.76 Z'
      ].map(function (d) { return '<path d="' + d.replace(/(-?[\d.]+) (-?[\d.]+)/g, function (m, u, v) { return (x + u * S).toFixed(2) + ' ' + (Y0 + v * S).toFixed(2); }) + '"/>'; }).join('');
    }
    else {   /* quaver: one flag; semiquaver: two */
      var n = base <= 0.25 ? 2 : 1, top = Y0 + 1.5 * S, foot = Y0 + (n === 2 ? 4 : 3.2) * S;
      out = '<path class="f" d="M' + (x + 3.5) + ' ' + top + 'L' + (x - 0.5) + ' ' + foot + '"/>';
      for (var k = 0; k < n; k++) {
        var yy = top + k * S, xx = x + 3.5 - k * 1.6;
        out += '<circle cx="' + (xx - 5) + '" cy="' + (yy + 1) + '" r="2.3"/><path class="f" d="M' + (xx - 6) + ' ' + (yy + 2.2) + 'Q' + (xx - 2) + ' ' + (yy + 3.2) + ' ' + xx + ' ' + yy + '"/>';
      }
    }
    if (dot) out += '<circle cx="' + (x + 8) + '" cy="' + (Y0 + 1.5 * S) + '" r="1.6"/>';
    return out;
  }
  function yOf(step) { return BOT - (step - 2) * S / 2; }   /* step: letters above C4 (E4 = 2, on the bottom line) */
  /* the string and finger the fingerboard uses for a pitch: the highest string that has it within the octave;
     first position (1st finger a semitone or tone up, 2nd at 3-4, 3rd at 5-6, 4th at 7), third position above that */
  function fingerOf(nt) {   /* 0 open, 1-4; first position up to the 4th finger (n 7), third position above */
    return nt.fg;   /* worked out per chord in build() */
  }
  function hueOf(nt) { return nt.si >= 0 ? 'var(' + HUE[nt.si] + ')' : 'var(--accent)'; }
  var CLEF = '<g transform="translate(2 ' + (Y0 - 36) + ') scale(0.9)"><path fill="currentColor" transform="translate(-5.000 80.125) scale(0.0750 -0.0750)" d="M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z"/></g>';
  var ACC = { '1': '#', '-1': 'b', '0': 'n' };   /* drawn by APP.accSvg */
  var noteEls = [], X0 = 0, W = 0, chunks = [], shownFrom = -1;

  function drawScore() {
    var sg = song, sharps = sg.sf >= 0, sp = sharps ? SP_S : SP_F, n = Math.abs(sg.sf), keyAcc = {};
    for (var i = 0; i < n; i++) keyAcc[(sharps ? SHARP_K : FLAT_K)[i]] = sharps ? 1 : -1;
    var out = [], x = 40;
    /* key signature as printed: each sign on its own line or space, about a space apart (Trix) */
    for (i = 0; i < n; i++) out.push('<g class="acc key">' + APP.accSvg(sharps ? '#' : 'b', x + 2 + i * 10.5, yOf((sharps ? SHARP_P : FLAT_P)[i]), S) + '</g>');
    /* time signature: each number two spaces tall (top line to middle, middle to bottom), sized from the
       measured ink of the device's serif digits, and placed by its width */
    var tsz = 2 * S / APP.digitRatio(APP.TS_FONT), tw = Math.max(String(sg.sig.num).length, String(sg.sig.den).length) * tsz * 0.5;
    x += (n ? n * 10.5 - 1 : 6) + tw / 2 + 4;
    var head = n + 2;   /* key signature + the two time-signature numbers */
    out.push('<text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + x + '" y="' + (Y0 + 2 * S) + '">' + sg.sig.num + '</text><text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + x + '" y="' + (Y0 + 4 * S) + '">' + sg.sig.den + '</text>');
    X0 = x + tw / 2 + 22;
    var barBeats = sg.sig.num * 4 / sg.sig.den;
    /* spacing by note length, as printed music does (a semiquaver ~41 px, a crotchet 56, a semibreve 86), with
       room at each bar line; xAt() maps beats to x for placing and scrolling */
    var ons = [], items = [];   /* what scrolls: [x, svg markup], drawn in sections */
    sg.notes.forEach(function (n) { if (!ons.length || n.b > ons[ons.length - 1] + 1e-6) ons.push(n.b); });
    /* rests (Trix: shown as printed, and given room like notes so the sheet does not rush through a silence):
       from the end of each note (or the start of its bar, before the first note) to the next onset, split at
       bar lines into whole-bar, half, quarter, quaver and semiquaver rests (dotted in x/8), each on its grid */
    var rests = [], comp = sg.sig.den >= 8 && sg.sig.num % 3 === 0;
    function restRun(a, z) {
      while (z - a >= 0.25 - 1e-6) {
        var bs = Math.floor(a / barBeats + 1e-6) * barBeats, be = Math.min(z, bs + barBeats);
        if (Math.abs(a - bs) < 1e-6 && Math.abs(be - (bs + barBeats)) < 1e-6) { rests.push({ b: a, v: barBeats, whole: true }); a = be; continue; }
        var vs = comp ? [3, 1.5, 1, 0.5, 0.25] : [2, 1, 0.5, 0.25], v = 0.25;
        for (var q = 0; q < vs.length; q++) { var w = vs[q], off = a - bs; if (a + w <= be + 1e-6 && Math.abs(off / w - Math.round(off / w)) < 1e-6) { v = w; break; } }
        if (a + v > be + 1e-6) break;
        rests.push({ b: a, v: v }); a += v;
      }
    }
    if (sg.notes.length) restRun(0, sg.notes[0].b);   /* from the first bar kept: bars where only the accompaniment plays are whole-bar rests */
    ons.forEach(function (b, i) {
      if (i + 1 >= ons.length) return;
      var end = b; sg.notes.forEach(function (n) { if (Math.abs(n.b - b) < 1e-6) end = Math.max(end, n.b + n.len); });
      restRun(Math.round(end * 4) / 4, ons[i + 1]);
    });
    var evs = ons.slice(); rests.forEach(function (r) { evs.push(r.b); });
    evs.sort(function (a, b) { return a - b; });
    evs = evs.filter(function (b, i) { return !i || b > evs[i - 1] + 1e-6; });
    /* an empty bar before the first note: the count-in scrolls through it, so the first note reaches the
       playhead as the music starts (Trix) */
    var leadW = Math.max(120, barBeats * 40), pts = [[-barBeats, X0]], cx = X0 + leadW, lastBar = 0;
    items.push([cx - 6, '<path class="bl" d="M' + (cx - 6) + ' ' + Y0 + 'V' + BOT + '"/>']);
    cx += 12;
    evs.forEach(function (b, i) {
      var bn = Math.floor(b / barBeats + 1e-6);
      if (bn > lastBar) { items.push([cx - 6, '<path class="bl" d="M' + (cx - 6) + ' ' + Y0 + 'V' + BOT + '"/>']); cx += 12; lastBar = bn; }
      pts.push([b, cx]);
      cx += 26 + 30 * Math.sqrt(Math.max(0.125, (i + 1 < evs.length ? evs[i + 1] : sg.beats) - b));
    });
    pts.push([sg.beats, cx]);
    xAt = function (b) {
      if (b <= pts[0][0]) return pts[0][1] - (pts[0][0] - b) * 50;   /* pts[0] is the start of the empty bar */
      for (var i = 1; i < pts.length; i++) if (b <= pts[i][0]) { var a = pts[i - 1], c = pts[i]; return a[1] + (c[1] - a[1]) * (b - a[0]) / ((c[0] - a[0]) || 1); }
      return cx + (b - sg.beats) * 50;
    };
    W = cx + 30;
    rests.forEach(function (r) {
      var x = r.whole ? (xAt(r.b) + xAt(r.b + r.v)) / 2 - 8 : xAt(r.b);   /* a whole-bar rest in the middle of its bar */
      items.push([x, '<g class="mp-rest">' + restSvg(r, x) + '</g>']);
    });
    var endX = cx - 8;
    items.push([endX - 4, '<path class="bl" d="M' + (endX - 4) + ' ' + Y0 + 'V' + BOT + '"/><path class="bl end" d="M' + endX + ' ' + Y0 + 'V' + BOT + '"/>']);
    /* first pass: where each note sits; accidentals hold to the end of the bar */
    var barNo = -1, inBar = {}, inf = sg.notes.map(function (nt) {
      var bn = Math.floor(nt.b / barBeats + 1e-6);
      if (bn !== barNo) { barNo = bn; inBar = {}; }
      var spl = sp[nt.m % 12], L = spl[0], acc = spl[1], oct = Math.floor(nt.m / 12) - 1;
      var step = L + 7 * (oct - 4), id = L + '/' + oct, have = id in inBar ? inBar[id] : (keyAcc[L] || 0), sign = null;
      if (acc !== have) { sign = ACC[String(acc)]; inBar[id] = acc; }
      return { nt: nt, step: step, y: yOf(step), hx: xAt(nt.b), len: nt.len, sign: sign, up: step < 6, beam: -1 };
    });
    /* beams: quavers and semiquavers that follow on one another within a beat (a dotted crotchet in 6/8, 9/8,
       12/8) share a beam, all stems one way: up when the group sits below the middle line */
    /* chords: notes starting together share one stem and beam (Winter's double stops) */
    var heads = [];
    inf.forEach(function (f, k) {
      var p = inf[k - 1];
      if (p && Math.abs(p.nt.b - f.nt.b) < 1e-6) { f.head = p.head; inf[p.head].members.push(k); }
      else { f.head = k; f.members = [k]; heads.push(k); }
    });
    heads.forEach(function (k) {
      var f = inf[k], ys = f.members.map(function (j) { return inf[j].y; });
      f.yTop = Math.min.apply(null, ys); f.yBot = Math.max.apply(null, ys);
      f.len = Math.min.apply(null, f.members.map(function (j) { return inf[j].len; }));
      f.mean = f.members.reduce(function (t, j) { return t + inf[j].step; }, 0) / f.members.length;
      f.up = f.mean < 6;
      var last = -99;   /* chord fingerings beside the notes, top down, at least 11 px apart */
      f.members.slice().sort(function (a, b) { return inf[a].y - inf[b].y; }).forEach(function (j) { last = Math.max(inf[j].y + 4, last + 11); inf[j].fy = last; });
    });
    var unit = sg.sig.den === 8 && sg.sig.num % 3 === 0 ? 1.5 : 1, groups = [], cur = null;
    heads.forEach(function (k, hi) {
      var f = inf[k], prev = hi ? inf[heads[hi - 1]] : null, ok = f.len < 1;
      var joins = ok && cur && prev && Math.floor(f.nt.b / unit + 1e-6) === Math.floor(prev.nt.b / unit + 1e-6) && Math.abs(prev.nt.b + prev.len - f.nt.b) < 0.02 && f.nt.b > prev.nt.b + 1e-6;
      if (joins) cur.push(k); else { cur = ok ? [k] : null; if (cur) groups.push(cur); }
    });
    var beams = [];
    groups.forEach(function (gr, gi) {
      if (gr.length < 2) return;
      var mean = gr.reduce(function (t, k) { return t + inf[k].mean; }, 0) / gr.length, up = mean < 6, d = up ? -1 : 1;
      var tipY = function (f) { return up ? f.yTop : f.yBot; };   /* the stem runs past the chord's far note */
      var f0 = inf[gr[0]], f1 = inf[gr[gr.length - 1]];
      var x0 = f0.hx + (up ? 4.9 : -4.9), x1 = f1.hx + (up ? 4.9 : -4.9);
      var slope = x1 > x0 ? Math.max(-0.2, Math.min(0.2, (tipY(f1) - tipY(f0)) / (x1 - x0) * 0.5)) : 0;
      var line = function (x) { return base + slope * (x - x0); }, base = tipY(f0) + d * 3.4 * S;
      /* every stem at least 2.8 spaces long */
      gr.forEach(function (k) { var f = inf[k], x = f.hx + (up ? 4.9 : -4.9), need = tipY(f) + d * 2.8 * S; if (up ? line(x) > need : line(x) < need) base += need - line(x); });
      gr.forEach(function (k) { inf[k].up = up; inf[k].beam = gi; inf[k].tip = line(inf[k].hx + (up ? 4.9 : -4.9)); });
      function bar(xa, xb, off) {   /* a beam 4 px thick, off = how far in from the stem tips */
        var ya = line(xa) - d * off, yb = line(xb) - d * off;
        return '<path class="beam" d="M' + xa + ' ' + ya + 'L' + xb + ' ' + yb + 'L' + xb + ' ' + (yb - d * 4) + 'L' + xa + ' ' + (ya - d * 4) + 'Z"/>';
      }
      var sx = function (k) { return inf[k].hx + (up ? 4.9 : -4.9); }, b = [bar(sx(gr[0]) - (up ? 0.65 : -0.65), sx(gr[gr.length - 1]) + (up ? 0.65 : -0.65), 0)];
      /* second beam between neighbouring semiquavers; a short stub for one on its own */
      gr.forEach(function (k, i) {
        if (inf[k].len > 0.25) return;
        var nx = gr[i + 1], pv = gr[i - 1];
        if (nx !== undefined && inf[nx].len <= 0.25) b.push(bar(sx(k), sx(nx), 7));
        else if (!(pv !== undefined && inf[pv].len <= 0.25)) b.push(nx !== undefined ? bar(sx(k), sx(k) + 9, 7) : bar(sx(k) - 9, sx(k), 7));
      });
      beams.push([x0, '<g class="mp-beams">' + b.join('') + '</g>']);
    });
    /* second pass: draw (a chord's stem, flags and beam belong to its first note) */
    inf.forEach(function (f, k) {
      var hd = inf[f.head], isHead = f.head === k, chord = hd.members.length > 1;
      var nt = f.nt, y = f.y, hx = f.hx, step = f.step, len = f.len, up = hd.up, g = [];
      if (f.sign) g.push('<g class="acc">' + APP.accSvg(f.sign, hx - 14, y, S) + '</g>');
      for (var l = 0; l >= step; l -= 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      for (l = 12; l <= step; l += 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      var hollow = len >= 2, stem = len < 4, dotted = len === 3 || len === 1.5 || len === 0.75;
      var flags = hd.beam >= 0 ? 0 : hd.len <= 0.25 ? 2 : hd.len < 1 ? 1 : 0;
      g.push('<ellipse class="' + (hollow ? 'head hollow' : 'head') + '" cx="' + hx + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + hx + ' ' + y + ')"/>');
      if (stem && isHead) {
        var sx = up ? hx + 4.9 : hx - 4.9, sy = hd.beam >= 0 ? hd.tip : up ? hd.yTop - 3.4 * S : hd.yBot + 3.4 * S, sy0 = up ? hd.yBot : hd.yTop;
        g.push('<path class="stem" d="M' + sx + ' ' + (sy0 + (up ? -1 : 1)) + 'V' + sy + '"/>');
        for (var q = 0; q < flags; q++) {
          var fy = sy + (up ? 1 : -1) * q * 7, d = up ? 1 : -1;
          g.push('<path class="flag" d="M' + sx + ' ' + fy + 'c1 ' + (5 * d) + ' 8 ' + (7 * d) + ' 6 ' + (15 * d) + 'c1 ' + (-6 * d) + ' -3 ' + (-9 * d) + ' -6 ' + (-10 * d) + 'z"/>');
        }
      }
      /* fingering, in the string colour, on the side of the note away from the stem (Trix) */
      var fg = fingerOf(nt);
      if (fg !== null) {
        if (chord) g.push('<text class="fing side" x="' + (hx + (up ? -15 : 9)) + '" y="' + f.fy + '">' + fg + '</text>');   /* beside each note of a chord, spaced apart */
        else g.push('<text class="fing" x="' + hx + '" y="' + Math.max(10, stem && up ? Math.max(y + 17, BOT + 13) : Math.min(y - 9, Y0 - 5)) + '">' + fg + '</text>');
      }
      if (dotted) g.push('<circle class="dot" cx="' + (hx + 9) + '" cy="' + (step % 2 === 0 ? y - S / 2 : y) + '" r="1.7"/>');
      items.push([hx, '<g class="mp-n" data-k="' + k + '" style="--hue:' + hueOf(nt) + '">' + g.join('') + '</g>']);
    });
    items = items.concat(beams);
    /* the score in sections ~1200 px wide, each its own svg, only those near the playhead shown: one svg as
       wide as a long piece (Winter: 47 000 px, 9 800 shapes) was redrawn on every frame and stalled phones */
    var CH = 1200, H = BOT + 46, nC = Math.ceil(W / CH), parts = [];
    for (i = 0; i < nC; i++) parts.push([]);
    items.forEach(function (it) { parts[Math.max(0, Math.min(nC - 1, Math.floor(it[0] / CH)))].push(it[1]); });
    svg.style.width = W + 'px'; svg.style.height = H + 'px';
    svg.innerHTML = parts.map(function (p, c) {
      var lines = '';
      for (var j = 0; j < 5; j++) lines += '<path class="sl" d="M' + (c ? c * CH : -2000) + ' ' + (Y0 + j * S) + 'H' + Math.min(W, (c + 1) * CH) + '"/>';   /* the first section's lines run left, under the clef */
      return '<svg class="mp-chunk" xmlns="http://www.w3.org/2000/svg" overflow="visible" style="left:' + c * CH + 'px" width="' + CH + '" height="' + H + '" viewBox="' + c * CH + ' 0 ' + CH + ' ' + H + '">' + lines + p.join('') + '</svg>';
    }).join('');
    chunks = Array.prototype.slice.call(svg.children);
    shownFrom = -1;
    /* the clef, key and time signature stay at the left while the notes scroll under them */
    var kw = X0 - 12, kl = '';
    for (i = 0; i < 5; i++) kl += '<path class="sl" d="M0 ' + (Y0 + i * S) + 'H' + kw + '"/>';
    keySvg.setAttribute('width', kw + 14); keySvg.setAttribute('height', BOT + 46);
    keySvg.setAttribute('viewBox', '0 0 ' + (kw + 14) + ' ' + (BOT + 46));
    keySvg.innerHTML = kl + CLEF + out.slice(0, head).join('');
    noteEls = [];
    Array.prototype.forEach.call(svg.querySelectorAll('.mp-n'), function (el) { noteEls[+el.getAttribute('data-k')] = el; });
  }
  /* the playhead sits a third of the way across; the score slides under it */
  function scroll() {
    if (!song) return;
    var bar = song.sig.num * 4 / song.sig.den;
    var beat = counting ? countBeat : pos < 0.01 && !playing ? -bar : song.toBeat(pos);   /* at the very start: the empty count-in bar */
    var w = scoreEl.clientWidth, x = xAt(beat), hx = Math.max(w * 0.36, X0 + 50);
    headEl.style.left = hx + 'px';
    /* half a beat early, so a note glows while it passes through the playhead rather than after it */
    var tx = Math.round(hx - x + 22);   /* may move right of the start: at rest the playhead sits at the empty bar, before the first note */
    svg.style.transform = 'translateX(' + tx + 'px)';
    /* show only the sections in view (and one either side) */
    var c0 = Math.max(0, Math.floor(-tx / 1200) - 1), c1 = Math.max(0, Math.floor((w - tx) / 1200) + 1);
    if (c0 + ':' + c1 !== shownFrom) {   /* both edges: the right one moves first as the score scrolls in */
      shownFrom = c0 + ':' + c1;
      chunks.forEach(function (el, c) { el.style.display = c >= c0 && c <= c1 ? '' : 'none'; });
    }
  }

  /* ---------- playing ---------- */
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function ui() {
    var end = song ? song.end : 0;
    timeEl.textContent = fmt(pos / speed) + ' / ' + fmt(end / speed);
    if (document.activeElement !== seek) seek.value = end ? Math.round(pos / end * 1000) : 0;
    speedEl.textContent = Math.round(speed * 100) + '%';
    bpmEl.textContent = song ? '♩ = ' + Math.round(song.bpm * speed) : '';
    playBtn.setAttribute('aria-label', playing || counting ? 'Pause' : 'Play');
    playBtn.classList.toggle('on', playing || counting);
    scoreEl.classList.toggle('playing', playing || counting);   /* tap-a-note only while paused */
    loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false');
    metroBtn.setAttribute('aria-pressed', metro ? 'true' : 'false');
    $('mpSlower').disabled = speed <= 0.5 + 1e-9;
    $('mpFaster').disabled = speed >= 1.5 - 1e-9;
  }
  function allOff() {
    active.forEach(function (k) { APP.board.off('n' + k); });
    active = [];
    noteEls.forEach(function (el) { el.classList.remove('on'); });
  }
  function seekTo(p) {
    allOff(); accStop();
    pos = Math.max(0, Math.min(p, song ? song.end : 0));
    ni = 0;
    if (song) while (ni < song.notes.length && song.notes[ni].t < pos - 1e-6) ni++;
    ai = accFrom(pos);
    noteEls.forEach(function (el, k) { el.classList.toggle('done', k < ni); });
    /* the metronome clicks from the next beat on (on the first one when starting from the top) */
    lastTick = !song || pos < 0.01 ? -1 : Math.floor(song.toBeat(pos) / (4 / song.sig.den) + 1e-6);
    if (!playing && !counting) showAt();   /* moving the slider while paused shows what sounds there */
    scroll(); ui();
  }
  function frame(now) {
    if (!playing) return;
    pos += (now - last) / 1000 * speed;
    if (metro) {
      var k = Math.floor(song.toBeat(pos) / (4 / song.sig.den) + 1e-6);
      if (k > lastTick) { lastTick = k; if (pos < song.end) APP.board.click(k % song.sig.num === 0); }
    }
    last = now;
    if (song.acc.length) accAhead();
    var ns = song.notes;
    active = active.filter(function (k) {   /* notes ending first, so a repeated note sounds twice */
      if (ns[k].e > pos) return true;
      APP.board.off('n' + k); noteEls[k].classList.remove('on'); noteEls[k].classList.add('done');
      return false;
    });
    while (ni < ns.length && ns[ni].t <= pos) {
      /* a note that already ended between two frames (very fast notes, a slow phone) is skipped, not left lit */
      if (ns[ni].e <= pos) { noteEls[ni].classList.add('done'); ni++; continue; }
      /* a note under a quarter of a second just lights up: no string wobble, rings or glow (Trix: fast pieces lagged) */
      var quick = (ns[ni].e - ns[ni].t) / speed < 0.25;
      APP.board.on(ns[ni].m, 'n' + ni, !quick, ns[ni].si, ns[ni].b);   /* its string, and its chord (both notes of a double stop stay lit) */
      noteEls[ni].classList.add('on');
      noteEls[ni].classList.toggle('quick', quick);
      active.push(ni); ni++;
    }
    /* the board keeps one note per string; drop the ones it replaced */
    active = active.filter(function (k) { if (APP.board.has('n' + k)) return true; noteEls[k].classList.remove('on'); noteEls[k].classList.add('done'); return false; });
    scroll(); ui();
    if (pos >= song.end && !active.length) {
      if (!loop) { pause(); seekTo(song.end); return; }
      seekTo(0); playing = false; countIn(go); return;   /* round again, after the count-in */
    }
    raf = requestAnimationFrame(frame);
  }
  /* count-in (Trix): one bar of the time signature counted down (3 2 1 in 3/4, 4 3 2 1 in 4/4) with a click
     on each beat, at the tune's tempo and the chosen speed; when starting from the beginning, and before each
     round of Loop; resuming after a pause plays straight on */
  var counting = false, countT = 0, countEl = $('mpCount'), countBeat = 0;
  function countIn(then) {
    var n = song.sig.num, k = n, step = 60 / song.bpm * 4 / song.sig.den / speed * 1000;
    var bar = n * 4 / song.sig.den, t0 = performance.now();
    counting = true; countBeat = -bar; ui();
    (function slide() {   /* the score moves through the empty bar in time with the count */
      if (!counting) return;
      countBeat = -bar * Math.max(0, 1 - (performance.now() - t0) / (n * step));
      scroll();
      requestAnimationFrame(slide);
    })();
    (function beat() {
      if (!counting) return;
      if (k === 0) { counting = false; countEl.hidden = true; then(); return; }
      APP.board.click(k === n);
      countEl.textContent = k; countEl.hidden = false;
      countEl.classList.remove('beat'); void countEl.offsetWidth; countEl.classList.add('beat');
      k--; countT = setTimeout(beat, step);
    })();
  }
  function stopCount() { counting = false; clearTimeout(countT); countEl.hidden = true; }
  /* paused: the notes sounding at this point stay lit, silent and still (Trix) */
  function showAt(force) {
    allOff();
    if (!song || (pos < 0.01 && !force)) return;   /* at the top nothing has sounded yet (unless its first note was tapped) */
    var ns = song.notes, show = [], k, lastB = null;
    for (k = Math.max(0, ni - 64); k < ns.length && ns[k].t <= pos + 1e-6; k++) if (ns[k].e > pos) show.push(k);
    /* in the short break between two notes: the one just played */
    if (!show.length) for (k = Math.min(ni, ns.length) - 1; k >= 0 && (lastB === null || ns[k].b === lastB); k--) { lastB = ns[k].b; show.push(k); }
    show.forEach(function (k) {
      APP.board.on(ns[k].m, 'n' + k, false, ns[k].si, ns[k].b, true);
      noteEls[k].classList.add('on'); noteEls[k].classList.add('quick');
      active.push(k);
    });
  }
  function go() {
    /* resuming: the notes held over the pause sound again */
    var held = active.slice();
    allOff();
    held.forEach(function (k) {
      var nt = song.notes[k];
      APP.board.on(nt.m, 'n' + k, (nt.e - nt.t) / speed >= 0.25, nt.si, nt.b);
      noteEls[k].classList.add('on'); active.push(k);
    });
    playing = true; last = performance.now();
    accStart();
    raf = requestAnimationFrame(frame);
    ui();
  }
  function play() {
    if (!song || playing || counting) return;
    if (!APP.board.prime()) return;   /* the sound engine starts inside the tap (iPhone) */
    if (pos >= song.end - 0.01) seekTo(0);
    if (pos < 0.01) countIn(go); else go();   /* the count-in only at the beginning, not on resume (Trix) */
  }
  function pause() {
    stopCount();
    playing = false;
    accStop();
    cancelAnimationFrame(raf);
    showAt();
    ui();
  }

  /* ---------- tunes ---------- */
  /* notes about a tune in small grey text; an import that failed as a red alert (Trix: make errors obvious) */
  function say(text, err) {   /* text: a string, or a list shown as separate sentences (each translated on its own) */
    var list = Array.isArray(text) ? text : text ? [text] : [];
    msg.textContent = '';
    list.forEach(function (t, i) { if (i) msg.appendChild(document.createTextNode(' ')); var sp = document.createElement('span'); sp.textContent = t; msg.appendChild(sp); });
    msg.hidden = !list.length;
    msg.classList.toggle('err', !!err);
    msg.setAttribute('role', err ? 'alert' : 'status');
  }
  function load(i) {
    pause();
    song = songs[i].song;
    delBtn.hidden = !songs[i].kept;   /* the bin only for an imported file */
    subEl.textContent = songs[i].title;
    drawScore();
    seekTo(0);
    var warn = [];
    if (song.low) warn.push(song.low + (song.low > 1 ? ' notes are' : ' note is') + ' below the violin’s G string and left out.');
    if (song.high) warn.push(song.high + (song.high > 1 ? ' notes are' : ' note is') + ' above the fingerboard shown: heard, not lit.');
    if (song.acc.length) warn.unshift('Violin: ' + (song.soloName || 'the first part') + '. The other ' + (song.parts - 1) + (song.parts > 2 ? ' parts play' : ' part plays') + ' as accompaniment (Mixer sets the levels).');
    say(warn);
    mixUi();
    APP.board.toTop();   /* a new tune opens at the open strings, whatever the last one scrolled to (Hermes F14) */
    if (shown) fit();
  }
  function addSong(title, buf, kept) {   /* kept: an imported file, with its id in the saved list */
    var sg = parse(buf);
    songs.push({ title: title, song: sg, kept: kept || null });
    options();
    return songs.length - 1;
  }
  function options() {
    var v = songSel.value;
    songSel.textContent = '';
    var tag = window.I18N && I18N.lang === 'zh' ? ' [已导入]' : ' [imported]';   /* imported files marked in the list (Trix) */
    songs.forEach(function (s, i) {
      var o = document.createElement('option');
      o.value = i; o.textContent = s.kept ? s.title + tag : s.title;
      if (s.kept) o.setAttribute('translate', 'no');   /* a file name stays as it is in 中文; the tag is set here */
      songSel.appendChild(o);
    });
    if (v !== '') songSel.value = v;
  }
  document.addEventListener('i18n', options);   /* language switched: relabel [imported] */
  function fromB64(b64) { var bin = atob(b64), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; }
  function toB64(buf) { var u8 = new Uint8Array(buf), s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  DEMOS.forEach(function (d) { addSong(d.title, fromB64(d.b64), null); });
  /* imported files are kept on this device until deleted with the bin button (Trix): violin-midi-files,
     a list of { id, name, b64 }; MIDI files are small (a few KB), well inside the storage limit */
  var KEEP = 'violin-midi-files', kept = [];
  try { kept = JSON.parse(localStorage.getItem(KEEP) || '[]'); if (!Array.isArray(kept)) kept = []; } catch (e) { kept = []; }
  kept = kept.filter(function (f) { try { addSong(f.name, fromB64(f.b64), f.id); return true; } catch (e) { return false; } });
  function saveKept() { try { localStorage.setItem(KEEP, JSON.stringify(kept)); return true; } catch (e) { return false; } }
  var delBtn = $('mpDel');
  delBtn.addEventListener('click', function () {
    var i = +songSel.value, s = songs[i];
    if (!s || !s.kept) return;
    kept = kept.filter(function (f) { return f.id !== s.kept; });
    saveKept();
    songs.splice(i, 1);
    options();
    songSel.value = 0; load(0);
    songSel.focus();
  });
  songSel.addEventListener('change', function () { load(+songSel.value); });
  $('mpImport').addEventListener('click', function () { fileIn.value = ''; fileIn.click(); });
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var name = f.name.replace(/\.(mid|midi|smf)$/i, ''), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), i;
      try { i = addSong(name, rd.result, id); }   /* reading the file: only a failure here means it could not be read */
      catch (e) { if (!e.mine) console.error('MIDI import', e); say(e.mine ? e.message : 'This MIDI file could not be read.', true); return; }
      var ok = false, prevI = +songSel.value;
      try { kept.push({ id: id, name: name, b64: toB64(rd.result) }); ok = saveKept(); }   /* keeping it for next time; a failure here only means not kept (Hermes F17) */
      catch (e) { console.error('MIDI import: keep', e); if (kept.length && kept[kept.length - 1].id === id) kept.pop(); }
      /* showing it: Trix saw "could not be read" for a file that then played fine after choosing another tune and
         back, so a slip here gets one more try, the same as choosing it again, and is logged for a fix. The list
         moves to the new tune only once it is shown; if both tries fail it goes back to the tune still on screen,
         so choosing the new one is a real change (Hermes F18) */
      try { load(i); songSel.value = i; }
      catch (e) {
        console.error('MIDI import: first load', e);
        try { load(i); songSel.value = i; }
        catch (e2) {
          console.error('MIDI import: second load', e2);
          songSel.value = prevI; try { load(prevI); } catch (e3) {}
          say('The tune was added, but it could not be shown. Choose it again from the list.', true); return;
        }
      }
      if (!ok) { kept = kept.filter(function (k) { return k.id !== id; }); say('This file plays now, but there is no room to keep it for next time.', true); }
    };
    rd.onerror = function () { console.error('MIDI import: read', rd.error); say('This MIDI file could not be read.', true); };   /* the reason, for the console (Hermes F16) */
    rd.readAsArrayBuffer(f);
  });

  /* the mixer: a small panel above the controls with Violin and Accompaniment sliders */
  var mixBtn = $('mpMix'), mixPop = $('mpMixPop'), volV = $('mpVolV'), volA = $('mpVolA');
  function mixUi() {
    volV.value = Math.round(mix.v * 100); volA.value = Math.round(mix.a * 100);
    var none = !song || !song.acc.length;
    volA.disabled = none; $('mpMixNone').hidden = !none;
    $('mpVolVOut').textContent = volV.value + '%'; $('mpVolAOut').textContent = none ? '' : volA.value + '%';
    APP.board.soloVolume(mix.v);
    if (accBus) accBus.gain.setTargetAtTime(mix.a, accBus.context.currentTime, 0.03);
  }
  function setMixOpen(open) {
    mixPop.hidden = !open; mixBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) volV.focus();
  }
  function saveMix() { try { localStorage.setItem('violin-midi-mix', JSON.stringify(mix)); } catch (e) {} }
  mixBtn.addEventListener('click', function (e) { e.stopPropagation(); setMixOpen(mixPop.hidden); });
  volV.addEventListener('input', function () { mix.v = volV.value / 100; mixUi(); saveMix(); });
  volA.addEventListener('input', function () { mix.a = volA.value / 100; mixUi(); saveMix(); });
  document.addEventListener('pointerdown', function (e) { if (!mixPop.hidden && !mixPop.contains(e.target) && !mixBtn.contains(e.target)) setMixOpen(false); }, true);
  mixPop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); setMixOpen(false); mixBtn.focus(); } });
  playBtn.addEventListener('click', function () { if (playing || counting) pause(); else play(); });
  $('mpStart').addEventListener('click', function () { seekTo(0); });
  metroBtn.addEventListener('click', function () {
    metro = !metro;
    if (song) lastTick = pos < 0.01 && !playing ? -1 : Math.floor(song.toBeat(pos) / (4 / song.sig.den) + 1e-6);   /* from the next beat (the first, at the top) */
    try { localStorage.setItem('violin-midi-metro', metro ? 'on' : 'off'); } catch (e) {}
    ui();
  });
  loopBtn.addEventListener('click', function () {
    loop = !loop;
    try { localStorage.setItem('violin-midi-loop', loop ? 'on' : 'off'); } catch (e) {}
    ui();
  });
  function setSpeed(d) { speed = Math.max(0.5, Math.min(1.5, Math.round((speed + d) * 20) / 20)); ui(); }   /* 5 % steps (Trix) */
  $('mpSlower').addEventListener('click', function () { setSpeed(-0.05); });
  $('mpFaster').addEventListener('click', function () { setSpeed(0.05); });
  seek.addEventListener('input', function () { if (song) seekTo(seek.value / 1000 * song.end); });
  /* paused (or not started): tap a note on the score to jump there and see its fingering on the board; Play
     carries on from that note (Trix). The nearest note to the tap, within 28 px sideways. */
  scoreEl.addEventListener('click', function (e) {
    if (!song || playing || counting) return;
    var best = -1, bd = 28;
    noteEls.forEach(function (el, k) {
      if (!el) return;
      var r = el.getBoundingClientRect(); if (!r.width) return;   /* in a hidden section */
      var d = Math.abs(r.left + r.width / 2 - e.clientX); if (d < bd) { bd = d; best = k; }
    });
    if (best < 0) return;
    var t = song.notes[best].t;
    if (t < 0.01) { seekTo(0); showAt(true); }   /* the first note: stay at the top (the count-in still comes), but show it */
    else seekTo(t + 0.001);   /* just inside the note, so it shows lit and resumes sounding */
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && (playing || counting)) pause(); });
  window.addEventListener('resize', scroll);
  if (APP.busy) APP.busy.push(function () { return playing || counting; });   /* playing along counts as practice time */

  /* the board fits below the app bar, the score and the controls */
  function topH() { var a = document.querySelector('.appbar'); return (a ? a.offsetHeight + 10 : 0) + top.offsetHeight + 20 + Math.max(0, bar.offsetHeight - 64); }   /* + the board's own margin and padding */
  function reach() {   /* semitones above the open string, on the string the board plays each note on */
    /* the board ends at the highest finger the tune uses (Trix: Twinkle only needs the 3rd finger, so the 3rd
       finger sits near the bottom edge and the rows spread out): in 1st position the 1st finger is 1-2 semitones
       up, the 2nd 3-4, the 3rd 5-6, the 4th 7; above that, the tune's highest note. At least the 2nd finger. */
    var top = 0;
    if (song) song.notes.forEach(function (n) { if (n.si >= 0) top = Math.max(top, n.m - OPEN[n.si]); });
    return top <= 4 ? 4 : top <= 6 ? 6 : top;
  }
  /* the tune's key from its key signature: a minor key has the notes of its relative major (natural minor), as on
     the fingerboard; those notes show pale in their string colour (Trix) */
  function keySet() {
    if (!song) return null;
    var root = ((song.sf * 7) % 12 + 12) % 12, set = {};
    [0, 2, 4, 5, 7, 9, 11].forEach(function (i) { set[(root + i) % 12] = true; });
    set.tonic = song.minor ? (root + 9) % 12 : root;   /* the key note, ringed as on the fingerboard */
    set.minor = !!song.minor;   /* so Just intonation tunes to the tune's key, not the fingerboard's */
    /* colour key notes as high up the strings as the tune plays (Trix) */
    set.top = 7;   /* at least 1st position's 4th finger on every string; higher if the tune goes higher, the same on all four (Trix) */
    song.notes.forEach(function (n) { if (n.si >= 0) set.top = Math.max(set.top, n.m - OPEN[n.si]); });
    return set;
  }
  function fit() { APP.board.player(true, topH, reach(), keySet(), song && song.sf < 0); scroll(); }
  APP.views.midi = {
    show: function () { shown = true; fit(); },
    hide: function () { shown = false; pause(); setMixOpen(false); APP.board.player(false); }
  };
  load(0);
})();
