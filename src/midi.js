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
  var paMute = false, paOn = false, paTake = null;   /* Play-along: a take without sound (nothing scheduled at all), the tool open, the take running */
  /* Metronome (Trix): clicks with the tune, on its own beats (time signature, tempo, speed), the first of each bar
     stronger; remembered */
  var lastTick = -1;   /* since the Mixer (Trix): no button; it clicks when its fader is above 0 */   /* Loop: start again from the top at the end (Trix), remembered */
  try { loop = localStorage.getItem('violin-midi-loop') === 'on'; } catch (e) {}
  /* Mixer (Trix): violin and accompaniment levels, 0-1, remembered */
  var mix = { v: 1, a: 0.8, m: 0 };   /* the metronome starts silent (Trix) */
  function lv(x, d) { return isFinite(x) ? Math.max(0, Math.min(1, +x)) : d; }
  try { var mj = JSON.parse(localStorage.getItem('violin-midi-mix') || 'null'); if (mj) mix = { v: lv(mj.v, 1), a: lv(mj.a, 0.8), m: lv(mj.m, 0) }; } catch (e) {}

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
    if (paMute) return;
    var bus = accOut(); if (!bus) return;
    var c = bus.context, now = c.currentTime;
    var t0 = now + Math.max(0, (from - pos) / speed), t1 = now + Math.max(0.03, (n.e - pos) / speed);
    if (t1 <= t0 + 0.02) return;
    var o = c.createOscillator(), g = c.createGain(), pk = 0.44 * n.v,   /* at 100 % as loud as the violin at 100 % (Trix: far too quiet; was 0.16, ~9 dB under) */ a4 = (window.APP && APP.a4) || 442;
    o.type = 'triangle'; o.frequency.value = a4 * Math.pow(2, (n.m - 69) / 12);
    g.gain.setValueAtTime(0, t0);
    if (n.pz) {   /* pizzicato (Trix): plucked, dying away by itself */
      g.gain.linearRampToValueAtTime(pk * 1.2, t0 + 0.004);
      g.gain.setTargetAtTime(0, t0 + 0.006, 0.13);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(Math.min(t1, t0 + 0.9) + 0.3);
    } else {
    g.gain.linearRampToValueAtTime(pk, t0 + 0.012);
    g.gain.setTargetAtTime(pk * 0.55, t0 + 0.012, 0.25);   /* a piano-ish fall after the attack */
    g.gain.setTargetAtTime(0, t1, 0.04);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t1 + 0.3);
    }
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

  /* ---------- reading MusicXML (Trix): .musicxml / .xml, and .mxl (zipped) ---------- */
  function looksXml(u8) {   /* text starting with '<' (after a byte-order mark or spaces) */
    var i = 0; if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) i = 3;
    while (i < u8.length && (u8[i] === 32 || u8[i] === 9 || u8[i] === 10 || u8[i] === 13)) i++;
    return u8[i] === 0x3c;
  }
  function isZip(u8) { return u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 3 && u8[3] === 4; }
  /* the score inside a .mxl: META-INF/container.xml names it, else the first .musicxml / .xml; resolves to its bytes */
  function unzipScore(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), files = {}, e = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(fail('This MusicXML file could not be read.'));
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), dec = new TextDecoder();
    for (var k = 0; k < n && p + 46 <= u8.length && dv.getUint32(p, true) === 0x02014b50; k++) {
      var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
      p += 46 + nl + xl + cl;
    }
    function read(name) {
      var f = files[name], at = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), data = u8.subarray(at, at + f.size);
      if (f.method === 0) return Promise.resolve(data.slice().buffer);
      if (f.method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(fail('This browser can’t open compressed MusicXML (.mxl). Export the score as uncompressed MusicXML (.musicxml) instead.'));
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    }
    var c = files['META-INF/container.xml'];
    return (c ? read('META-INF/container.xml').then(function (b) { return dec.decode(b); }) : Promise.resolve('')).then(function (cx) {
      var m = /full-path="([^"]+)"/.exec(cx), root = m && files[m[1]] ? m[1] : Object.keys(files).filter(function (k) { return !/^META-INF\//.test(k) && /\.(musicxml|xml)$/i.test(k); })[0];
      if (!root) throw fail('This file has no score in it.');
      return read(root);
    });
  }
  function kids(el, name) { var out = []; for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.nodeName === name) out.push(c); return out; }
  function kid(el, name) { for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (c.nodeName === name) return c; return null; }
  function txt(el, name) { var k = kid(el, name); return k ? k.textContent.trim() : ''; }
  /* the order bars are played in: repeat barlines (times="n"), 1st / 2nd endings */
  function playOrder(ms) {
    var info = ms.map(function (m) {
      var r = { fwd: false, back: 0, endStart: null, endStop: false, fin: false };
      kids(m, 'barline').forEach(function (b) {
        var rp = kid(b, 'repeat'), en = kid(b, 'ending');
        if (rp && rp.getAttribute('direction') === 'forward') r.fwd = true;
        if (rp && rp.getAttribute('direction') === 'backward') r.back = +rp.getAttribute('times') || 2;
        if (en && en.getAttribute('type') === 'start') r.endStart = (en.getAttribute('number') || '1').split(/[^0-9]+/).filter(Boolean).map(Number);
        if (en && /stop|discontinue/.test(en.getAttribute('type'))) r.endStop = true;
        if (txt(b, 'bar-style') === 'light-heavy') r.fin = true;   /* a final bar: the next movement's repeats start after it */
      });
      return r;
    });
    var open = null; info.forEach(function (r) { if (r.endStart) open = r.endStart; r.end = open; if (r.endStop) open = null; });
    /* a backward repeat goes to the last forward repeat (else the bar after the last finished repeat); a repeat
       inside an ending is taken whenever that ending plays, so endings like 1, 3 / 2, 4 with a later repeat back to
       the same start work (MuseScore's Serenade Rondo); a plain one plays its times (default twice) */
    var out = [], i = 0, start = 0, pass = 1, done = {}, guard = 0;
    while (i < ms.length && guard++ < 100000) {
      var r = info[i];
      if (r.fwd && i !== start) { start = i; pass = 1; }
      if (r.end && r.end.indexOf(pass) < 0) { i++; continue; }   /* an ending for another time through */
      out.push(i);
      if (r.back) {
        if (r.end) { pass++; i = start; continue; }
        var c = done[i] || 1;
        if (c < r.back) { done[i] = c + 1; pass++; i = start; continue; }
        delete done[i]; start = i + 1; pass = 1;
      } else if (r.fin && !r.end) { start = i + 1; pass = 1; }
      i++;
    }
    out.info = info;   /* the written repeats and endings, for the Fingerings pages (Trix: print each bar once) */
    return out;
  }
  /* the sound follows the score's dynamics (Trix): each note's velocity from the part's last dynamic, hairpins and
     cresc. / dim. sliding to the next one (or one step), sf / sfz / fz an accent on its note, fp loud then soft.
     Velocities as MuseScore plays them (mf 80 ... ff 112); a part with no dynamics stays at mf. */
  var VEL = { pppp: 10, ppp: 16, pp: 33, p: 49, mp: 64, mf: 80, f: 96, ff: 112, fff: 126, ffff: 127 };
  function dynamics(notes, marks) {
    var base = [], accent = {}, ramps = [], dyn = marks.filter(function (m) { return m.kind === 'dyn'; }).sort(function (a, b) { return a.tick - b.tick; });
    dyn.forEach(function (m) {
      var t = m.text.toLowerCase();
      if (VEL[t]) base.push({ tick: m.tick, v: VEL[t] });
      else if (/^(sf|sfz|sffz|fz|rfz|rf|sfp|sfpp|fp)$/.test(t)) {
        accent[m.tick] = t === 'fp' ? 96 : 112;
        if (/p$/.test(t)) base.push({ tick: m.tick + 1, v: t === 'sfpp' ? 33 : 49 });   /* then soft */
      }
    });
    function vAt(tick) { var v = 80; for (var i = 0; i < base.length && base[i].tick <= tick; i++) v = base[i].v; return v; }
    function nextDyn(tick) { for (var i = 0; i < base.length; i++) if (base[i].tick >= tick) return base[i]; return null; }
    var open = null;
    marks.slice().sort(function (a, b) { return a.tick - b.tick; }).forEach(function (m) {
      if (m.kind === 'wedge') {
        if (m.text === 'stop') { if (open) { var nx = nextDyn(m.tick), to = nx && nx.tick - m.tick < 480 * 4 ? nx.v : vAt(open.tick) + (open.up ? 16 : -16); ramps.push({ a: open.tick, b: Math.max(m.tick, open.tick + 1), to: to }); open = null; } }
        else open = { tick: m.tick, up: m.text === 'crescendo' };
      } else if (m.kind === 'words' && /^(cresc|dim|decresc)/i.test(m.text)) {
        var n2 = nextDyn(m.tick + 1); if (n2) ramps.push({ a: m.tick, b: n2.tick, to: n2.v });
      }
    });
    notes.forEach(function (n) {
      var v = vAt(n.t0);
      ramps.forEach(function (r) { if (n.t0 >= r.a && n.t0 < r.b) { var from = vAt(r.a); v = from + (r.to - from) * (n.t0 - r.a) / (r.b - r.a); } });
      if (accent[n.t0] !== undefined) v = Math.max(v, accent[n.t0]);
      if (n.art) { if (n.art.indexOf('strong-accent') >= 0) v += 24; else if (n.art.indexOf('accent') >= 0) v += 16; }   /* an accented note louder, as MuseScore plays it */
      n.v = Math.max(8, Math.min(127, Math.round(v)));
    });
  }
  /* tempo as played (Trix): a rit./rall./accel. eases to its tempo over the music up to the next tempo mark (two bars at
     most) instead of stepping there; a rit. with no tempo slows by a fifth and "a tempo" / "Tempo I" restores; a fermata
     holds its note (or rest) for up to two beats more. tp.shown keeps the tempo without the fermatas, for the ♩ readout */
  var RAMP_W = /^((poco a poco|molto|poco|un poco)\s+)?(rit|rall|allarg|calando|smorz|accel|string)/i, TEMPO_W = /^((poco a poco|molto|poco|un poco)\s+)?(rit|rall|allarg|calando|smorz|accel|string)|^(a tempo|tempo i|tempo primo)\b/i;
  function playedTempo(tempos, ferm, words, tpq, sig, bars) {
    function sort() { tempos.sort(function (a, b) { return a.tick - b.tick; }); }
    function usAt(t) { var u = 500000; tempos.forEach(function (tp) { if (tp.tick <= t) u = tp.us; }); return u; }
    var before = null;
    words.sort(function (a, b) { return a.tick - b.tick; }).forEach(function (w) {
      if (tempos.some(function (tp) { return tp.tick === w.tick; })) return;   /* a tempo of its own is there */
      var cur = usAt(w.tick);
      if (RAMP_W.test(w.text)) { if (before === null) before = cur; tempos.push({ tick: w.tick, us: /accel|string/i.test(w.text) ? cur / 1.2 : cur * 1.25, word: w.text }); }
      else if (before !== null) { tempos.push({ tick: w.tick, us: before }); before = null; }
      sort();
    });
    tempos.forEach(function (tp) { tp.us0 = tp.us; });
    function barT(tick) {   /* a bar in the metre in force there (Hermes F77: the Csárdás's 4/4 bars, not its opening 2/4) */
      var m = sig; (bars || []).forEach(function (b) { if (b.tick <= tick && b.ts) m = b.ts; });
      return (m ? m.num * 4 / m.den : 4) * tpq;
    }
    var add = [];
    tempos.forEach(function (tp, i) {
      if (!i || !tp.word || !RAMP_W.test(tp.word)) return;
      var from = 60e6 / tempos[i - 1].us0, to = 60e6 / tp.us0, end = Math.min(tempos[i + 1] ? tempos[i + 1].tick : Infinity, tp.tick + 2 * barT(tp.tick));
      if (Math.abs(from - to) < 0.5 || !(end > tp.tick)) return;
      var N = Math.max(1, Math.round((end - tp.tick) / (tpq / 2))), step = (end - tp.tick) / N;   /* a step each quaver */
      tp.us = 60e6 / (from + (to - from) / N);
      for (var k = 2; k <= N; k++) add.push({ tick: Math.round(tp.tick + (k - 1) * step), us: 60e6 / (from + (to - from) * k / N) });
    });
    add.forEach(function (a) { tempos.push(a); }); sort();
    tempos.forEach(function (tp) { tp.shown = tp.us; });
    var F = {};
    ferm.forEach(function (f) { if (f.t1 > f.t0 && !(F[f.t0] <= f.t1)) F[f.t0] = f.t1; });   /* notes on one beat: the shortest */
    Object.keys(F).map(Number).sort(function (a, b) { return a - b; }).forEach(function (a) {
      var b = F[a], f = 1 + Math.min(b - a, 2 * tpq) / (b - a), ua = usAt(a), ub = usAt(b), sa = ua, sb = ub;
      tempos.forEach(function (tp) { if (tp.tick <= a) sa = tp.shown; if (tp.tick <= b) sb = tp.shown; });
      tempos.forEach(function (tp) { if (tp.tick >= a && tp.tick < b) tp.us *= f; });
      if (!tempos.some(function (tp) { return tp.tick === a; })) tempos.push({ tick: a, us: ua * f, shown: sa });
      if (!tempos.some(function (tp) { return tp.tick === b; })) tempos.push({ tick: b, us: ub, shown: sb });
      sort();
    });
  }
  function readXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml'), root = doc.documentElement;
    if (!root || doc.getElementsByTagName('parsererror').length) throw fail('This MusicXML file could not be read.');
    if (root.nodeName === 'score-timewise') throw fail('This MusicXML file is in the timewise layout, which the player can’t read. Export it again as MusicXML from your notation app.');
    if (root.nodeName !== 'score-partwise') throw fail('This is not a MIDI or MusicXML file.');
    var TPQ = 480, STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, meta = {};
    kids(kid(root, 'part-list'), 'score-part').forEach(function (sp, i) {
      var inst = sp.getElementsByTagName('instrument-name')[0], mi = sp.getElementsByTagName('midi-instrument')[0];
      meta[sp.getAttribute('id')] = { name: txt(sp, 'part-name'), inst: inst ? inst.textContent.trim() : '',
        prog: mi && txt(mi, 'midi-program') ? +txt(mi, 'midi-program') - 1 : undefined, ch: mi && txt(mi, 'midi-channel') ? (+txt(mi, 'midi-channel') - 1) % 16 : i % 16 };
    });
    var parts = kids(root, 'part');
    if (!parts.length) throw fail('This file has no notes.');
    var modeKnown = false;   /* the score says major or minor (else the Fingerings pages name no key: Trix) */
    var order = playOrder(kids(parts[0], 'measure')), tempos = [], sig = null, sf = null, minor = false, tracks = [], seenTempo = {}, bars = [], ferm = [], tempoWords = [], tmarks = {};   /* tmarks: tick -> printed tempo change, for whichever part is the solo */   /* tick -> tempo entry; ferm: notes and rests under a fermata; tempoWords: rit./a tempo without a <sound> */
    parts.forEach(function (part, pi) {
      var info = meta[part.getAttribute('id')] || { name: '', inst: '', ch: pi % 16 }, ch = info.ch;
      var ms = kids(part, 'measure'), notes = [], tie = {}, chordTrem = 0, at = 0, divStart = [], dvw = 1, pz = false, marks = [], graces = [], gFrom = -1, gShift = 0;   /* graces: waiting for their main note */   /* pz: pizz. until arco; marks: dynamics, hairpins, words */
      var ksw = [], kmw = [], kw0 = null, km0 = null;
      function wordMark(t, text) {   /* words on one beat share one mark ("Minuet I" and its ♩ = 120) */
        var same = marks.filter(function (m) { return m.kind === 'words' && m.tick === t; })[0];
        if (same) { if (same.text.indexOf(text) < 0) same.text += '  ' + text; } else marks.push({ tick: t, kind: 'words', text: text });
      }   /* the key in force in each written bar (a repeat back over a key change goes back to its key) */
      ms.forEach(function (m, k) { divStart[k] = dvw; kids(m, 'attributes').forEach(function (a) { if (txt(a, 'divisions')) dvw = +txt(a, 'divisions'); var ky = kid(a, 'key'); if (ky && txt(ky, 'fifths') !== '') { kw0 = +txt(ky, 'fifths'); km0 = /^(major|minor)$/.test(txt(ky, 'mode')) ? txt(ky, 'mode') : null; } }); ksw[k] = kw0; kmw[k] = km0; });
      order.forEach(function (k) {
        var m = ms[k]; if (!m) return;
        var tmE = m.getElementsByTagName('time')[0];   /* a change of time signature (the Csárdás: 2/4, 4/4, 2/4) */
        if (pi === 0) bars.push({ tick: at, num: m.getAttribute('number') || String(k + 1), mi: k, wr: order.info[k], ts: tmE && txt(tmE, 'beats') ? { num: parseInt(txt(tmE, 'beats'), 10) || 4, den: +txt(tmE, 'beat-type') || 4 } : null, ks: ksw[k], km: kmw[k] });
        var dv = divStart[k] || 1, cur = 0, len = 0, last = 0;
        function tk(d) { return at + Math.round(d * TPQ / dv); }
        kids(m).forEach(function (el) {
          var nm = el.nodeName;
          if (nm === 'attributes') {
            if (txt(el, 'divisions')) dv = +txt(el, 'divisions');
            var key = kid(el, 'key'); if (key && sf === null && txt(key, 'fifths') !== '') { sf = +txt(key, 'fifths'); minor = txt(key, 'mode') === 'minor'; modeKnown = /^(major|minor)$/.test(txt(key, 'mode')); }
            var tm = kid(el, 'time'); if (tm && !sig && txt(tm, 'beats')) sig = { num: parseInt(txt(tm, 'beats'), 10) || 4, den: +txt(tm, 'beat-type') || 4 };
          } else if (nm === 'backup') cur -= +txt(el, 'duration') || 0;
          else if (nm === 'forward') { cur += +txt(el, 'duration') || 0; len = Math.max(len, cur); }
          else if (nm === 'direction' || nm === 'sound') {
            var snd = nm === 'sound' ? el : kid(el, 'sound'), bpm = snd && +snd.getAttribute('tempo');
            if (snd && snd.getAttribute('pizzicato')) pz = snd.getAttribute('pizzicato') === 'yes';
            var tw = [];   /* the words of a tempo change ("molto rall.", "a tempo"): printed with it (Trix) */
            if (nm === 'direction') kids(el, 'direction-type').forEach(function (dt) {   /* dynamics, hairpins and words, shown under the staff (Trix) */
              kids(dt).forEach(function (d) {
                if (d.nodeName === 'dynamics') { var dn = kids(d).map(function (x) { return x.nodeName === 'other-dynamics' ? x.textContent.trim() : x.nodeName; }).join(''); if (dn) marks.push({ tick: tk(cur), kind: 'dyn', text: dn }); }
                else if (d.nodeName === 'wedge' && /crescendo|diminuendo|stop/.test(d.getAttribute('type'))) marks.push({ tick: tk(cur), kind: 'wedge', text: d.getAttribute('type') });
                else if (d.nodeName === 'words' && /^(pizz\.?|pizzicato|arco)$/i.test(d.textContent.trim())) { if (!(snd && snd.getAttribute('pizzicato'))) pz = !/^arco$/i.test(d.textContent.trim()); }   /* pizz. / arco: drawn once, above the notes where the playing changes, and played so even without a <sound> (Trix) */
                else if (d.nodeName === 'words' && d.textContent.trim() && snd && snd.getAttribute('tempo')) tw.push(d.textContent.trim());
                else if (d.nodeName === 'words' && d.textContent.trim()) {
                  wordMark(tk(cur), d.textContent.trim());
                  if (TEMPO_W.test(d.textContent.trim())) tempoWords.push({ tick: tk(cur), text: d.textContent.trim() });
                }
              });
            });
            if (bpm > 0) {
              var t = tk(cur); if (seenTempo[t]) seenTempo[t].us = 60e6 / bpm; else tempos.push(seenTempo[t] = { tick: t, us: 60e6 / bpm });   /* two marks on one beat ("Allegro" and ♩ = 140): the later wins, as in MuseScore */
              if (tw.length) seenTempo[t].word = tw.join(' ');
              /* a change of tempo after the start is printed (Trix): its words, and the new ♩ unless it is a rit./rall./accel. */
              var was = null; tempos.forEach(function (tp) { if (tp.tick < t && (was === null || tp.tick >= was.tick)) was = tp; });
              var same = was && Math.round(60e6 / was.us) === Math.round(bpm);   /* a repeat back over the same tempo: nothing new to print */
              if (t > 0 && !(same && !tw.length) && !tmarks[t]) tmarks[t] = { w: tw.join(' '), bpm: RAMP_W.test(tw.join(' ')) || same ? null : Math.round(bpm) };
            }
          } else if (nm === 'note') {
            if (kid(el, 'cue')) return;   /* cue notes are not played */
            var gr = kid(el, 'grace');
            if (gr) {   /* a grace note (Trix): played and drawn small just before the note it decorates */
              var gp = kid(el, 'pitch');
              if (gp && !kid(el, 'chord')) graces.push({ m: (+txt(gp, 'octave') + 1) * 12 + (STEP[txt(gp, 'step')] || 0) + Math.round(+txt(gp, 'alter') || 0), slash: gr.getAttribute('slash') === 'yes', steal: +gr.getAttribute('steal-time-previous') || (gr.getAttribute('slash') === 'yes' ? 50 : 0) });   /* a slashed grace too (Trix): quick, just before the beat */
              return;
            }
            var dur = +txt(el, 'duration') || 0, chord = !!kid(el, 'chord'), from = chord ? last : cur;
            if (!chord) { last = cur; cur += dur; len = Math.max(len, cur); }
            /* a breath mark (or caesura), on a note or a rest (MuseScore puts one after a rest on the rest): a mark at
               the end of it, drawn just before what follows (Trix) */
            if (!chord) kids(kid(kid(el, 'notations'), 'articulations')).forEach(function (a) { if (a.nodeName === 'breath-mark' || a.nodeName === 'caesura') marks.push({ tick: tk(from + dur), kind: 'breath', text: a.nodeName }); });
            var pt = kid(el, 'pitch');
            if (!pt) { if (!chord && kid(kid(el, 'notations'), 'fermata')) ferm.push({ t0: tk(from), t1: tk(from + dur) }); graces = []; return; }   /* a rest, or unpitched (graces before a rest are dropped) */
            var mm = (+txt(pt, 'octave') + 1) * 12 + (STEP[txt(pt, 'step')] || 0) + Math.round(+txt(pt, 'alter') || 0);
            var t0 = tk(from), t1 = tk(from + dur), ties = kids(el, 'tie').map(function (t) { return t.getAttribute('type'); });
            if (chord && t0 === gFrom) t0 += gShift;   /* the rest of a chord moves with its first note */
            else if (!chord && graces.length && graces.every(function (g) { return g.steal > 0; })) {
              /* graces marked steal-time-previous, and slashed ones (Trix: the Minuets' bar 8, a quick grace just before the beat): about a
                 32nd each (at most that share of the note before), ending on the beat; the note before gives up the time */
              var prev = null; for (var pq = notes.length - 1; pq >= 0; pq--) if (!notes[pq].grace) { prev = notes[pq]; break; }
              var cnt2 = graces.length, room = prev ? (t0 - prev.t0) * graces[0].steal / 100 : TPQ / 8, each2 = Math.max(1, Math.round(Math.min(TPQ / 8, room / cnt2))), g0 = Math.max(0, t0 - cnt2 * each2);   /* nothing before the first beat (Hermes F80) */
              if (g0 + cnt2 * each2 > t0) t0 = g0 + cnt2 * each2;   /* the file's first note: the grace takes its time from it instead */
              if (prev && prev.t1 > g0) { if (!prev.wl) prev.wl = (prev.t1 - prev.t0) / TPQ; prev.t1 = Math.max(prev.t0 + 1, g0); }   /* drawn at its written value, played a little shorter */
              graces.forEach(function (g, gi) { notes.push({ m: g.m, t0: g0 + gi * each2, t1: g0 + (gi + 1) * each2, sb: Math.max(0, t0 - (cnt2 - gi)), gi: gi, gn: cnt2, ch: ch, v: 90, pz: pz, grace: 'acc' }); });
              gFrom = -1; gShift = 0; graces = [];
            }
            else if (!chord && graces.length) {
              /* graces not slashed (an appoggiatura, or a run): quick, about a 32nd each (Trix: a very quick grace), on the
                 beat, taking their time from the start of the note that follows */
              var main = t1 - t0, cnt = graces.length, each = Math.round(Math.min(TPQ / 8, main / (2 * cnt)));
              graces.forEach(function (g, gi) { notes.push({ m: g.m, t0: t0 + gi * each, t1: t0 + (gi + 1) * each, sb: Math.max(0, t0 - (cnt - gi)), gi: gi, gn: cnt, ch: ch, v: 90, pz: pz, grace: g.slash || cnt > 1 ? 'acc' : 'app' }); });   /* sb: on the score just before the main note */
              gFrom = t0; gShift = cnt * each; t0 += gShift; graces = [];
            } else if (!chord) { gFrom = -1; gShift = 0; }
            var slurs = kids(kid(el, 'notations'), 'slur').map(function (sl) { return { t: sl.getAttribute('type'), n: sl.getAttribute('number') || '1' }; });
            if (ties.indexOf('stop') >= 0 && tie[mm]) {   /* tied on: one longer note; a slur ending here ends on it */
              tie[mm].t1 = t1; if (slurs.length) tie[mm].slur = (tie[mm].slur || []).concat(slurs);
              if (ties.indexOf('start') < 0) delete tie[mm]; return;
            }
            var bm = kids(el, 'beam').filter(function (b) { return (b.getAttribute('number') || '1') === '1'; })[0];
            var n = { m: mm, t0: t0, t1: t1, sb: tk(from), xb: bm ? bm.textContent.trim() : 'none', ch: ch, v: 90, pz: pz, wsp: ['CDEFGAB'.indexOf(txt(pt, 'step')), Math.round(+txt(pt, 'alter') || 0), +txt(pt, 'octave')] }, tech   /* sb: where it is written (a grace note may delay its sound); xb: the score's beam */ = el.getElementsByTagName('technical')[0];
            if (tech) {   /* written fingering (0 = open), open-string mark, string number (1 = E) */
              /* the finger written plainly; one in brackets ("(3) 2": an alternative) only if it is the only one */
              var fe = kid(tech, 'fingering'), se = kid(tech, 'string'), ft = fe ? fe.textContent : '';
              var fm = /[0-4]/.exec(ft.replace(/[(（\[][^)）\]]*[)）\]]/g, ' ')) || /[0-4]/.exec(ft);
              if (fm) n.xfg = +fm[0];
              if (kid(tech, 'open-string')) n.xfg = 0;
              if (kid(tech, 'harmonic')) n.harm = true;   /* a harmonic: an o over the note, a pure tone (Trix) */
              if (se && /^[1-4]$/.test(se.textContent.trim())) n.xs = +se.textContent.trim();
            }
            /* articulations, bowings and fermata, drawn at the note (Trix) */
            var art = [], nots = kid(el, 'notations');
            kids(kid(nots, 'articulations')).forEach(function (a) { if (a.nodeName !== 'breath-mark' && a.nodeName !== 'caesura') art.push(a.nodeName); });   /* breaths are marks (above) */
            kids(tech).forEach(function (a) { if (/^(up-bow|down-bow|stopped)$/.test(a.nodeName)) art.push(a.nodeName); });
            if (kid(nots, 'fermata')) { art.push('fermata'); ferm.push(n); }   /* held when played (Trix); n.t1 grows with its ties */
            /* ornaments (Trix: tr was missing): trill, turns, mordents drawn above; a tremolo's slashes on the stem; an
               accidental written over the ornament beside it */
            kids(kid(nots, 'ornaments')).forEach(function (o) {
              var nm = o.nodeName;
              if (/^(trill-mark|turn|inverted-turn|delayed-turn|mordent|inverted-mordent)$/.test(nm)) art.push(nm + (/mordent$/.test(nm) && o.getAttribute('long') === 'yes' ? '-long' : ''));   /* a long mordent: one more zigzag */
              else if (nm === 'tremolo' && (o.getAttribute('type') || 'single') === 'single') n.trem = Math.max(1, Math.min(4, +o.textContent.trim() || 3));
              else if (nm === 'accidental-mark') n.oacc = o.textContent.trim();
            });
            /* a tuplet (Hermes F52): its ratio and its written value, so the score draws three quavers with a "3",
               not dotted semiquavers */
            var tmo = kid(el, 'time-modification');
            if (tmo) {
              var WV = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625 }[txt(el, 'type')];
              if (WV) { n.tup = +txt(tmo, 'actual-notes') || 3; n.wl = WV * (kids(el, 'dot').length ? 1.5 : 1); }
            }
            if (!chord) chordTrem = n.trem || 0; else if (!n.trem && chordTrem) n.trem = chordTrem;   /* a chord's tremolo, often written on its first note only */
            if (art.length) n.art = art;
            if (slurs.length) n.slur = slurs;
            notes.push(n);
            if (ties.indexOf('start') >= 0) tie[mm] = n;
          }
        });
        if (!len && sig) len = sig.num * 4 / sig.den * dv;   /* an empty bar still takes its time */
        at = tk(len);
      });
      dynamics(notes, marks);
      if (notes.length) {
        var pr = {}, prs = {}; if (info.prog !== undefined) { pr[ch] = info.prog; prs[ch] = [info.prog]; }
        tracks.push({ notes: notes, chans: 1, name: info.name || info.inst, label: info.name + ' ' + info.inst, prog: pr, progs: prs, marks: marks });
      }
    });
    tempos.sort(function (a, b) { return a.tick - b.tick; });
    playedTempo(tempos, ferm, tempoWords, TPQ, sig, bars);
    /* the composer (Trix: on the Fingerings pages): the credit printed on the score first, else the identification's
       creator; MuseScore's empty-template words ("Composer / arranger") are not a name */
    var composer = '', BLANK = /^(composer(\s*\/\s*arranger)?|arranger|subtitle|title)$/i;
    Array.prototype.forEach.call(doc.getElementsByTagName('credit'), function (c) {
      if (composer || !Array.prototype.some.call(c.getElementsByTagName('credit-type'), function (t) { return t.textContent.trim() === 'composer'; })) return;
      var w = Array.prototype.map.call(c.getElementsByTagName('credit-words'), function (x) { return x.textContent.trim(); }).join(' ').split(/\s*\n\s*/).filter(Boolean).join(', ');
      if (w && !BLANK.test(w)) composer = w;
    });
    if (!composer) Array.prototype.forEach.call(doc.getElementsByTagName('creator'), function (c) {
      var w = c.textContent.trim().split(/\s*\n\s*/).join(', ');
      if (!composer && c.getAttribute('type') === 'composer' && w && !BLANK.test(w)) composer = w;
    });
    return { tracks: tracks, tpq: TPQ, tempos: tempos, sig: sig, sf: sf, minor: minor, bars: bars, tmarks: tmarks, composer: composer, modeKnown: modeKnown };
  }

  /* ---------- reading a MIDI file ---------- */
  function parse(buf) {
    var u8 = new Uint8Array(buf), p = 0;
    function str(at, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8[at + i]); return s; }
    function u32(at) { return ((u8[at] << 24) | (u8[at + 1] << 16) | (u8[at + 2] << 8) | u8[at + 3]) >>> 0; }
    function u16(at) { return (u8[at] << 8) | u8[at + 1]; }
    function vlq() { var v = 0, b; do { b = u8[p++]; v = (v * 128) + (b & 0x7f); } while ((b & 0x80) && p < u8.length); return v; }
    if (looksXml(u8)) { var x = readXml(new TextDecoder().decode(u8)), xs = assemble(x.tracks, x.tpq, x.tempos, x.sig, x.sf, x.minor, x.bars, x.tmarks); xs.composer = x.composer; xs.modeKnown = x.modeKnown; return xs; }   /* MusicXML (Trix): the same parts, notes and timing, plus written fingerings */
    if (u8.length < 14 || str(0, 4) !== 'MThd') throw fail('This is not a MIDI or MusicXML file.');
    var ntr = u16(10), tpq = u16(12);
    if (tpq & 0x8000) throw fail('This MIDI file keeps time in a way the player can’t read.');
    p = 8 + u32(4);
    var tempos = [], sig = null, sf = null, minor = false, tracks = [], midiComposer = '', modeKnown = false;   /* midiComposer: from a text event that says so (MIDI has no composer field) */
    for (var t = 0; t < ntr && p + 8 <= u8.length; t++) {
      var id = str(p, 4), end = Math.min(p + 8 + u32(p + 4), u8.length);
      p += 8;
      if (id !== 'MTrk') { p = end; continue; }
      var tick = 0, rs = 0, open = {}, notes = [], chans = {}, name = '', inst = '', prog = {}, progs = {}, cur = {};   /* cur: each channel's instrument now (45 = Pizzicato Strings) */
      while (p < end) {
        tick += vlq();
        var st = u8[p];
        if (st & 0x80) { p++; if (st < 0xf0) rs = st; } else st = rs;   /* running status: the last channel status carries on */
        if (st === 0xff) {
          var ty = u8[p++], l = vlq();
          if (ty === 0x51 && l >= 3) tempos.push({ tick: tick, us: (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2] });
          else if (ty === 0x58 && l >= 2 && !sig) sig = { num: u8[p], den: Math.pow(2, u8[p + 1]) };
          else if (ty === 0x59 && l >= 1 && sf === null) { sf = (u8[p] << 24) >> 24; minor = l >= 2 && u8[p + 1] === 1; modeKnown = l >= 2 && u8[p + 1] <= 1; }
          else if ((ty === 0x01 || ty === 0x02) && !midiComposer) {   /* text / copyright: only a line naming the composer */
            var ct = ''; try { ct = new TextDecoder().decode(u8.subarray(p, p + Math.min(l, 120))); } catch (e) { ct = str(p, Math.min(l, 120)); }
            var cm = /^\s*(?:composer|composed by|music by|作曲(?:家|者)?)\s*[:：]?\s*(.+?)\s*$/i.exec(ct.replace(/[\u0000-\u001f\ufffd]/g, ' '));
            if (cm) midiComposer = cm[1];
          }
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
          if (hi === 0xc0) { if (!(ch in prog)) prog[ch] = a; (progs[ch] = progs[ch] || []).push(a); cur[ch] = a; }   /* the channel's instrument (General MIDI program), and every one it switches to */
          if (hi === 0x90 && b > 0) (open[k] = open[k] || []).push([tick, b, cur[ch] === 45]);
          else if (hi === 0x80 || hi === 0x90) {
            if (open[k] && open[k].length) { var on = open[k].shift(); notes.push({ m: a, t0: on[0], t1: tick, ch: ch, v: on[1], pz: on[2] }); chans[ch] = 1; }
          }
        } else break;   /* a data byte with no status: the file is damaged, stop reading this track */
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (on) { notes.push({ m: +k.split(':')[1], t0: on[0], t1: tick, ch: +k.split(':')[0], v: on[1], pz: on[2] }); }); });
      if (notes.length) tracks.push({ notes: notes, chans: Object.keys(chans).length || 1, name: name || inst, label: name + ' ' + inst, prog: prog, progs: progs });
      p = end;
    }
    var ms = assemble(tracks, tpq, tempos, sig, sf, minor); ms.composer = midiComposer; ms.modeKnown = modeKnown; return ms;
  }
  /* what both readers share: naming the parts, choosing the violin, the accompaniment */
  function assemble(tracks, tpq, tempos, sig, sf, minor, bars, tmarks) {   /* bars: MusicXML's bar numbers in play order [{tick, num}] */
    if (!tracks.length) throw fail('This file has no notes.');
    /* several parts (Trix): the violin is the first track named as one (track or instrument name: violin, violino,
       violín, 小提琴), else the first set to General MIDI's Violin (program 40), else the first track with notes;
       every other track is accompaniment. A one-track file with several channels splits by channel the same way
       (the Violin channel, else the first channel heard). Drums (channel 10) are left out: the accompaniment synth
       plays pitched notes only. */
    /* unnamed parts are called by their General MIDI instrument (Trix's Ode to Joy names none): the channel's
       first program anywhere in the file */
    /* the channel's instrument for naming: a bowed string it uses anywhere (Violin, Viola, Cello, Double bass: a part
       that also switches to tremolo or pizzicato strings), else its first program */
    var chanProg = {};
    tracks.forEach(function (tr) {
      var all = [].concat.apply([], Object.keys(tr.progs).map(function (c) { return tr.progs[c]; }));
      var bowed = all.filter(function (p) { return p >= 40 && p <= 43; });
      tr.bowed = bowed.length ? Math.min.apply(null, bowed) : undefined;   /* any channel of the part: MuseScore sets Viola on one channel and plays pizzicato on the next */
      Object.keys(tr.progs).forEach(function (c) { if (!(c in chanProg)) chanProg[c] = tr.progs[c][0]; });
    });
    function gmName(p) {
      return p === undefined ? '' : p < 8 ? 'Piano' : p < 16 ? 'Bells' : p < 24 ? 'Organ' : p < 32 ? 'Guitar' : p < 40 ? 'Bass' :
        ['Violin', 'Viola', 'Cello', 'Double bass', 'Strings', 'Strings', 'Harp', 'Timpani'][p - 40] ||
        (p < 56 ? 'Strings' : p < 64 ? 'Brass' : p < 72 ? ['Saxophone', 'Saxophone', 'Saxophone', 'Saxophone', 'Oboe', 'Cor anglais', 'Bassoon', 'Clarinet'][p - 64] :
        p < 80 ? ['Piccolo', 'Flute', 'Recorder', 'Pan flute', 'Flute', 'Flute', 'Whistle', 'Ocarina'][p - 72] : 'Synth');
    }
    tracks.forEach(function (tr) { if (!tr.name && tr.notes.length) { tr.name = gmName(tr.bowed !== undefined ? tr.bowed : chanProg[tr.notes[0].ch]); tr.gm = true; } });
    /* two unnamed parts on the same instrument read Violin 1, Violin 2 (the label used to choose the solo is unchanged) */
    var gmCount = {}, gmSeen = {};
    tracks.forEach(function (tr) { if (tr.gm && tr.name) gmCount[tr.name] = (gmCount[tr.name] || 0) + 1; });
    tracks.forEach(function (tr) { if (tr.gm && gmCount[tr.name] > 1) { gmSeen[tr.name] = (gmSeen[tr.name] || 0) + 1; tr.name += ' ' + gmSeen[tr.name]; } });
    var DRUM = 9, VIOLIN = /(^|[^a-z])vln([^a-z]|$)|violin|violín|violon(?!c)|geige|(^|[^t])viool|(^|[^t])fiol|skrzypce|скрипк|バイオリン|ヴァイオリン|바이올린|小提琴|[一二]提/i   /* Vln., violin, violino, violine, violín, violon (not violoncello), Geige, viool (not altviool), fiol / fiolin (not altfiol), skrzypce, скрипка, バイオリン, 바이올린, 小提琴, 一提 / 二提 (orchestra shorthand; not 中提琴 / 大提琴) */, GM_VIOLIN = 40, solo, acc = [];
    /* also left out: a part named as drums or percussion, and channels set to General MIDI's percussive and
       sound-effect instruments (112-127: woodblock, taiko, synth drum…), which a pitched synth can't play */
    /* whole words only in Latin script (a "Violin (kit)" part is not drums: Hermes F27); Chinese has no spaces */
    var NOISE = /(^|[^a-z])(drums?|drum ?kit|perc|percussion|kits?)([^a-z]|$)|鼓|打击/i, dropped = [];
    tracks = tracks.filter(function (tr) { if (NOISE.test(tr.label) && !VIOLIN.test(tr.label)) {   /* a part named as a violin is never drums */ dropped.push(tr.name || tr.label.trim() || 'Drums'); return false; } return true; })
      .map(function (tr) { tr.notes = tr.notes.filter(function (n) { return n.ch !== DRUM && !(tr.prog[n.ch] >= 112); }); return tr; })
      .filter(function (tr, i) { if (tr.notes.length) return true; dropped.push(tr.name || tr.label.trim() || 'Part ' + (i + 1)); return false; });   /* emptied by drums or sound effects: not always drums (Hermes F30) */
    if (!tracks.length) throw fail('This file has only drums or sound effects.');   /* it has notes, all of them drums (Hermes F28) */
    var soloName = '', accNames = [], soloMarks = null;
    function gmViolin(tr) { return Object.keys(tr.prog).some(function (c) { return tr.prog[c] === GM_VIOLIN && tr.notes.some(function (n) { return n.ch === +c; }); }); }
    if (tracks.length === 1 && tracks[0].chans > 1) {
      var pr = tracks[0].prog, vc = Object.keys(pr).filter(function (c) { return pr[c] === GM_VIOLIN; }).map(Number)
        .filter(function (c) { return tracks[0].notes.some(function (n) { return n.ch === c; }); });
      var first = vc.length ? vc[0] : tracks[0].notes.reduce(function (a, n) { return !a || n.t0 < a.t0 ? n : a; }, null).ch;
      solo = tracks[0].notes.filter(function (n) { return n.ch === first; });
      acc = tracks[0].notes.filter(function (n) { return n.ch !== first; });
      soloName = tracks[0].name;
      var seen = {}; acc.forEach(function (n) { seen[n.ch] = 1; }); accNames = Object.keys(seen).map(function (c) { return 'Channel ' + (+c + 1); });
    } else {
      var si = 0, byName = -1, byProg = -1;
      /* among violins, the first violin (Violin I, Violin 1, 1st violin, Violino primo, solo) wins (Trix) */
      var FIRST = /(^|[^a-z])(i|1|1st|first|primo|solo)([^a-z0-9]|$)|第一|一提/i, byFirst = -1;
      tracks.forEach(function (tr, i) {
        if (!VIOLIN.test(tr.label)) { if (byProg < 0 && gmViolin(tr)) byProg = i; return; }
        if (byName < 0) byName = i;
        if (byFirst < 0 && FIRST.test(tr.label.replace(VIOLIN, ' '))) byFirst = i;
        if (byProg < 0 && gmViolin(tr)) byProg = i;
      });
      if (byFirst >= 0) byName = byFirst;
      si = byName >= 0 ? byName : byProg >= 0 ? byProg : 0;
      solo = tracks[si].notes; soloName = tracks[si].name; soloMarks = tracks[si].marks || null;
      tracks.forEach(function (tr, i) { var nm = tr.name || 'Part ' + (i + 1); if (i !== si && accNames.indexOf(nm) < 0) accNames.push(nm); });   /* a name once: a piano's two hands are two parts both called Piano (Trix's Winter) */
      tracks.forEach(function (tr, i) { if (i !== si) acc = acc.concat(tr.notes); });
    }
    /* a tremolo in the accompaniment sounds as the repeated notes it stands for (1 slash quavers, 2 semiquavers,
       3 demisemiquavers): the Serenade's inner parts, which its MIDI wrote out */
    acc = acc.reduce(function (out, n) {
      var step = n.trem ? tpq / Math.pow(2, n.trem) : 0;
      if (!step || n.t1 - n.t0 < step * 1.5) { out.push(n); return out; }
      for (var t = n.t0; t < n.t1 - step / 2; t += step) { var c = {}; for (var k in n) c[k] = n[k]; c.t0 = t; c.t1 = Math.min(n.t1, t + step); delete c.trem; out.push(c); }
      return out;
    }, []);
    var firstTick = acc.reduce(function (a, n) { return Math.min(a, n.t0); }, Infinity);
    var sg = build(solo, tpq, tempos, sig || { num: 4, den: 4 }, sf || 0, firstTick, minor);
    /* the bar number at a beat, for the score's corner (Trix): MusicXML's own numbers (repeats show theirs again, a
       pickup is 0); a MIDI file's bars counted from its start */
    var barQ = sg.sig.num * 4 / sg.sig.den, bl = bars ? bars.map(function (b) { return { beat: b.tick / tpq - sg.skipB, num: b.num, mi: b.mi, wr: b.wr, ts: b.ts, ks: b.ks, km: b.km }; }) : null;
    soloMarks = (soloMarks || []).slice();
    Object.keys(tmarks || {}).forEach(function (t) {   /* the tempo changes, with the solo's own words on that beat */
      var same = soloMarks.filter(function (m) { return m.kind === 'words' && m.tick === +t; })[0];
      var tm = tmarks[t];
      if (tm.bpm) soloMarks.push({ tick: +t, kind: 'tempo', text: tm.w, bpm: tm.bpm });   /* above the staff, as the opening's (Trix) */
      else if (same) { if (same.text.indexOf(tm.w) < 0) soloMarks[soloMarks.indexOf(same)] = Object.assign({}, same, { text: same.text + '  ' + tm.w }); }
      else soloMarks.push({ tick: +t, kind: 'words', text: tm.w });
    });
    soloMarks.sort(function (a, b) { return a.tick - b.tick; });
    sg.marks = (soloMarks || []).map(function (m) { return { beat: m.tick / tpq - sg.skipB, kind: m.kind, text: m.text, bpm: m.bpm }; }).filter(function (m) { return m.beat > -1e-6; });
    /* the bars in playing order, for A–B (Trix): the score's numbers (a bar played twice is listed twice) or counted */
    var blist = [];
    /* to the end of the music, not just the solo's: a last bar where only the accompaniment plays is a bar too (Hermes F50) */
    var endBeat = acc.reduce(function (e, n) { return Math.max(e, n.t1 / tpq - sg.skipB); }, sg.beats);
    if (bl) bl.forEach(function (b) { if (b.beat > -1e-6 && b.beat < endBeat - 1e-6) blist.push({ beat: b.beat, num: b.num, mi: b.mi, wr: b.wr, ts: b.ts, ks: b.ks, km: b.km }); });
    else for (var bb = 0; bb < endBeat - 1e-6; bb += barQ) blist.push({ beat: bb, num: String(Math.floor((bb + sg.skipB) / barQ + 1e-6) + 1) });
    var seenBar = {}; blist.forEach(function (b) { b.time = seenBar[b.num] = (seenBar[b.num] || 0) + 1; });
    blist.forEach(function (b) { b.rep = seenBar[b.num] > 1; });
    sg.bars = blist;
    /* the key at a beat (the fingerboard's key notes follow a change of key: Hermes F75): fifths, and minor when
       the score says so (a key without a mode: as the opening, if it is the opening's) */
    sg.keyAt = function (b) {
      var k = { sf: sg.sf, minor: !!sg.minor };
      blist.forEach(function (q) { if (q.beat <= b + 1e-6 && q.ks !== null && q.ks !== undefined) k = { sf: q.ks, minor: q.km ? q.km === 'minor' : q.ks === sg.sf && !!sg.minor }; });
      return k;
    };
    /* a pickup (MusicXML's short first bar, Spring's quaver, the Gavotte's half bar): the score's bar grid starts
       that much before the first note, so its bar lines fall where the score's do (a MIDI file has none: 0) */
    sg.pick = bl && !sg.skipB && blist.length > 1 && blist[0].beat < 1e-6 && blist[1].beat < barQ - 1e-6 ? barQ - blist[1].beat : 0;
    sg.barAt = function (beat) {   /* the bar under a beat, in playing order (a repeated bar knows which time round it is) */
      var r = blist[0] || null;
      for (var i = 0; i < blist.length && blist[i].beat <= beat + 1e-6; i++) r = blist[i];
      return r;
    };
    sg.barNo = function (beat) {
      if (!bl) return String(Math.floor((Math.max(0, beat) + sg.skipB) / barQ + 1e-6) + 1);
      var n = bl.length ? bl[0].num : '1';
      for (var i = 0; i < bl.length && bl[i].beat <= beat + 1e-6; i++) n = bl[i].num;
      return n;
    };
    sg.minor = minor;
    sg.soloName = soloName || '';
    sg.accNames = accNames;
    sg.dropped = dropped;   /* said in the parts flash (Hermes F27) */
    /* the accompaniment in seconds from the first bar kept, by start time */
    sg.acc = acc.map(function (n) { var t = sg.sec(n.t0); return { m: n.m, t: t, e: Math.max(t + 0.03, sg.sec(Math.max(n.t1, n.t0 + 1))), v: (n.v || 90) / 127, pz: n.pz }; })
      .filter(function (n) { return n.e > 0; }).sort(function (a, b) { return a.t - b.t; });
    if (sg.acc.length) sg.end = Math.max(sg.end, sg.acc[sg.acc.length - 1].e, Math.max.apply(null, sg.acc.map(function (n) { return n.e; })));
    return sg;
  }

  /* ticks to seconds through the tempo changes, and back */
  function build(raw, tpq, tempos, sig, sf, firstTick, minor) {   /* firstTick: the accompaniment's first note, if any */
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
      var sb = n.sb !== undefined ? n.sb : n.t0;
      return { m: n.m, t: t, e: e - Math.min(0.05, (e - t) * 0.15), b: sb / tpq, own: (n.t1 - sb) / tpq, xb: n.xb, gi: n.gi, gn: n.gn, xfg: n.xfg, xs: n.xs, harm: n.harm, pz: n.pz, art: n.art, trem: n.trem, tup: n.tup, wl: n.wl, oacc: n.oacc, wsp: n.wsp, slur: n.slur, vel: n.v || 80, grace: n.grace };
    }).filter(function (n) { return n.m >= 55; });   /* below the G string: left out */
    if (!notes.length) throw fail('Every note in this file is below the violin’s G string.');
    /* whole empty bars before the first note are skipped (Trix): the song starts in the bar of its first note */
    var barQ = sig.num * 4 / sig.den, firstB = Math.min(notes[0].b, isFinite(firstTick) ? firstTick / tpq : Infinity);
    var skipB = Math.max(0, Math.floor(firstB / barQ + 1e-6) * barQ), skipT = toSec(skipB * tpq);   /* with an accompaniment: bars where every part is silent */
    if (skipB > 0) notes.forEach(function (n) { n.b -= skipB; n.t -= skipT; n.e -= skipT; });
    /* how long each note looks on the score: until the next note starts (a short breath between notes is
       not a rest), else its own length; rounded to note values a beginner part uses */
    var VALS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125];   /* down to demisemiquavers (Trix: Winter's 32nds were drawn as 16ths) */
    notes.forEach(function (n, i) {
      var j = i + 1; while (j < notes.length && notes[j].b <= n.b + 1e-6) j++;
      var gap = j < notes.length ? notes[j].b - n.b : Infinity, len;
      if (n.wsp) len = gap <= n.own + 1e-3 ? gap : n.own;   /* MusicXML: its written lengths and rests, as printed (Por una Cabeza's quaver rests) */
      else if (gap <= n.own + 0.5) len = gap;   /* MIDI: runs on to the next note: a short breath is not a rest */
      else {   /* a rest follows: a short (staccato) note is written to the end of its beat (Trix: show the rests) */
        var unit = sig.den >= 8 ? 0.5 : 1, endB = n.b + n.own;
        len = n.own < unit ? Math.min(gap, Math.ceil(endB / unit - 1e-6) * unit - n.b) : n.own;
      }
      n.len = VALS.reduce(function (best, v) { return Math.abs(v - len) < Math.abs(best - len) ? v : best; }, 4);
      /* a crotchet or longer as written, to a semiquaver (Trix: The Swan's dotted semibreves and notes held over a bar
         line): the score splits it at bar lines and into tied note values */
      n.full = len >= 1 - 1e-6 && isFinite(len) ? Math.max(1, Math.round(len * 4) / 4) : n.len;
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
    /* string, position and finger for single notes (Trix, 2026-11-08): the cheapest way through each phrase,
       as teachers finger and as fingering programs do it. Every possible (string, position, finger) gets a small
       cost, every move from one note to the next another (shifts, string crossings), and the path with the
       least total wins (Viterbi). Chords keep the choice above; fingerings written in the score are fixed. */
    fgBeginner = isBeginner(notes, sig, sf, minor);
    planFingers(notes, tpq);
    /* fingerings and string numbers written in the score (MusicXML) win over the automatic choice (Trix) */
    notes.forEach(function (n) {
      n.asi = n.si; n.afg = n.fg;   /* the automatic choice, kept for checking it against written fingerings */
      var s0 = -1;
      if (n.xs) { s0 = 4 - n.xs; if (n.m < OPEN[s0] || n.m > OPEN[s0] + 19) s0 = -1; }   /* string 1 = E ... 4 = G */
      else if (n.xfg !== undefined) s0 = strForFinger(n.m, n.xfg);
      if (s0 >= 0) n.si = s0;
      else if (n.harm) { s0 = [3, 2, 1, 0].filter(function (q) { return n.m - OPEN[q] === 12; })[0]; if (s0 === undefined) s0 = -1; }   /* a harmonic with nothing written: the octave harmonic, half way along the string */
      if (s0 >= 0) n.si = s0;
      if (n.xfg !== undefined) n.fg = n.xfg;
      else if (s0 >= 0) fingers([n]);
    });
    var vs = notes.map(function (n) { return n.vel; }).sort(function (a, b) { return a - b; }), velMid = vs[Math.floor(vs.length / 2)] || 80;
    var lastN = notes[notes.length - 1];
    return {
      velMid: velMid,
      notes: notes, sig: sig, sf: Math.max(-7, Math.min(7, sf)),
      bpm: Math.round(60e6 / (function (tp) { return tp.shown || tp.us; })(tempos.filter(function (tp) { return tp.tick <= skipB * tpq; }).pop() || tempos[0])),   /* crotchets a minute, where the song starts */
      bpmAt: function (b) {   /* the tempo at a beat, as marked (a rit. as it eases, a fermata not counted): the ♩ readout, the count-in */
        var t = (b + skipB) * tpq, tp = tempos[0];
        for (var i = 1; i < tempos.length && tempos[i].tick <= t + 1e-6; i++) tp = tempos[i];
        return 60e6 / (tp.shown || tp.us);
      },
      end: Math.max.apply(null, notes.map(function (n) { return n.e; })), beats: lastN.b + lastN.len,
      toBeat: function (s) {   /* seconds to beats, for scrolling the score (both counted from the first bar kept) */
        s += skipT;
        var g = segs[0]; for (var i = 1; i < segs.length && segs[i].sec <= s; i++) g = segs[i];
        return (g.tick + (s - g.sec) / g.spt) / tpq - skipB;
      },
      low: low, high: high, skipB: skipB,
      beatSec: function (b) { return toSec((b + skipB) * tpq) - skipT; },   /* beats (from the first bar kept) to seconds: A–B */
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
  /* the string a written finger implies: the one where that finger reaches the note in the lowest position
     (each finger about a tone above the last); 0 = the open string */
  /* the violin note's loudness from its velocity, around the part's usual level (so the mixer level holds) */
  function lvlOf(n) { return song && song.velMid ? Math.max(0.3, Math.min(1.8, Math.pow((n.vel || song.velMid) / song.velMid, 1.2))) : 1; }
  function toneOf(n) { return n.harm ? 'pure' : n.pz ? 'pizz' : ''; }
  function strForFinger(m, f) {
    if (f === 0) return OPEN.indexOf(m);
    var best = -1, bestBase = 99;
    for (var si = 0; si < 4; si++) {
      var k = m - OPEN[si], base = k - 2 * (f - 1);
      if (k < 1 || k > 19 || base < 0 || base > 13) continue;
      if (base < bestBase) { bestBase = base; best = si; }
    }
    return best;
  }
  function fingers(unit) {
    var ns = unit.filter(function (n) { return n.si >= 0 && n.m > OPEN[n.si]; }).map(function (n) { return n.m - OPEN[n.si]; });
    var p = POS.filter(function (q) { return ns.every(function (n) { return n >= q[0] && n <= q[0] + q[1]; }); })[0] || POS[3];
    unit.forEach(function (n) {
      if (n.si < 0) { n.fg = null; return; }
      var k = n.m - OPEN[n.si], d = k - p[0];
      n.fg = k === 0 ? 0 : d <= 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4;
    });
  }
  /* positions by the 1st finger's usual note, in semitones above the open string (A string: 1st B, 2nd C♯,
     3rd D, 4th E, 5th F♯, 6th G, 7th A, 8th B, 9th C) */
  var POS_S = [2, 4, 5, 7, 9, 10, 12, 14, 15];
  var FG_COST = {
    four: 0.6,        /* the 4th finger: the weakest */
    high4: 1.6,       /* a 4th finger a semitone higher than usual (high 4, a stretch) */
    ext: 3.5,         /* the 4th finger stretched a tone further */
    pos: [0, 1.5, 0.6, 0.9, 1.2, 1.4, 1.6, 1.8, 2],   /* per note, by position: 1st free, 3rd before 2nd (Trix's rule) */
    lowHigh: 6,       /* G or D string above 3rd position */
    openLong: 0.3,    /* an open string on a long note (no vibrato): small; teachers write 0 on long beginner notes */
    cross: 1, skip: 2.5,          /* string crossing; per extra string skipped */
    slurCross: 0.6,               /* extra for a crossing inside a slur */
    shift: 2.2, shiftStep: 0.5,   /* a shift, plus per position moved */
    shiftHard: 2,                 /* x: on fast notes or inside a slur */
    shiftEasy: 0.3,               /* x: after or on an open string, after a rest or a long note */
    drone: 2                      /* an open-string note that comes back every other note (a drone, bariolage: Bagpipes) */
  };
  /* a beginner piece (Trix: "don't prioritise the 4th finger for vibrato"): then an open string on a long or last note
     costs nothing extra; every other cost is as in any piece (Trix, 2026-11-13: not "open before 4th"). What counts as a beginner piece (Trix, 2026-11-13), from string
     grading guides (ASTA / Shar, Alfred-Belwin series guidelines, MTB): two hard limits, 1st position only (G3–B5) and
     no double stops (one chord, a final one, allowed); then each criterion gets a level, 1 beginner, 2 early, 3 harder:
       key: G D A C and their relative minors 1 (A is easy on the violin: open A and E), F B♭ E 2, more 3;
       notes outside the key: <= 5 % 1, <= 10 % 2, more 3 (Shar: "few accidentals");
       time: 2/4 3/4 4/4 2/2 1, 6/8 3/8 6/4 9/8 12/8 2, others 3;
       speed: the fastest notes at the written tempo (5th percentile of the onset gaps): <= 5 a second 1, <= 8 2, more 3
         (speed rather than note values: Suzuki's Twinkle variations and Perpetual Motion use slow 16ths);
       rhythm: triplets or dotted quaver + semiquaver 2, quintuplets / anything faster than a semiquaver 3;
       slurs: the longest <= 4 notes 1 (Shar: "short 2–4 note slurs"), <= 8 2, more 3;
       ornaments: any grace note, trill, turn or mordent 2.
     Beginner = no level 3 and at most two criteria at level 2. */
  var fgBeginner = false;
  function isBeginner(notes, sig, sf, minor) {
    window.VT_BEGINNER_LEVELS = 'hard limit';   /* replaced below when the hard limits pass (Hermes F56: never the last tune's) */
    var ns = notes.filter(function (n) { return !n.grace; });
    if (!ns.length) return false;
    if (ns.some(function (n) { return n.m < 55 || n.m > 83; })) return false;
    var on = [], chords = 0;
    /* a held chord (a minim or longer) closes a section, as in the keyboard minuets (Hermes F57): it is not a double-stop passage */
    var held = 0;
    for (var i = 0; i < ns.length; ) { var j = i; while (j < ns.length && Math.abs(ns[j].b - ns[i].b) < 1e-6) j++; if (j - i > 1) { if ((ns[i].own || 0) >= 2 - 1e-6) held++; else chords++; } on.push(ns[i]); i = j; }
    /* held chords allowed only as section endings: at most one per 8 bars of music (Hermes F61) */
    var barsN = Math.max(1, (ns[ns.length - 1].b + (ns[ns.length - 1].own || 0) - ns[0].b) / (sig.num * 4 / sig.den));
    if (chords > 1 || held > Math.max(1, Math.floor(barsN / 8))) return false;
    var lv = [];
    lv.push(sf >= 0 && sf <= 3 ? 1 : (sf === -1 || sf === -2 || sf === 4) ? 2 : 3);
    var root = ((sf * 7) % 12 + 12) % 12, dia = [0, 2, 4, 5, 7, 9, 11].map(function (x) { return (x + root) % 12; });
    if (minor) dia.push((root + 9 + 9) % 12, (root + 9 + 11) % 12);   /* the raised 6th and 7th of the minor key */
    var out = ns.filter(function (n) { return dia.indexOf(n.m % 12) < 0; }).length / ns.length;
    lv.push(out <= 0.05 ? 1 : out <= 0.10 ? 2 : 3);
    var ts = sig.num + '/' + sig.den;
    lv.push(/^(2\/4|3\/4|4\/4|2\/2)$/.test(ts) ? 1 : /^(6\/8|3\/8|6\/4|9\/8|12\/8)$/.test(ts) ? 2 : 3);
    var gs = [], gb = [];
    for (var k = 1; k < on.length; k++) { var dt = on[k].t - on[k - 1].t, db = on[k].b - on[k - 1].b; if (dt > 1e-3) gs.push(dt); if (db > 1e-6) gb.push(db); }
    gs.sort(function (a, b) { return a - b; });
    var fast = gs.length ? gs[Math.floor(gs.length * 0.05)] : 1, nps = 1 / fast;
    lv.push(nps <= 5 ? 1 : nps <= 8 ? 2 : 3);
    var r = 1;   /* gaps in crotchets (b is in crotchets) */
    gb.forEach(function (g) {
      var q = g;
      if (q < 0.25 - 1e-3) r = 3;
      else { var t12 = q * 12; if (Math.abs(t12 - Math.round(t12)) < 1e-3 && Math.round(t12) % 3 !== 0) r = Math.max(r, 2); }
      if (Math.abs(q - 0.75) < 1e-3) r = Math.max(r, 2);
    });
    lv.push(r);
    var longest = 0, run = 0, depth = 0;
    ns.forEach(function (n) {
      (n.slur || []).forEach(function (x) { if (x.t === 'start') depth++; });
      if (depth > 0) run++;
      (n.slur || []).forEach(function (x) { if (x.t === 'stop' && depth > 0 && !--depth) { longest = Math.max(longest, run); run = 0; } });
    });
    lv.push(longest <= 4 ? 1 : longest <= 8 ? 2 : 3);
    var orn = notes.some(function (n) { return n.grace || (n.art || []).some(function (a) { return /trill|turn|mordent/.test(a); }); });
    lv.push(orn ? 2 : 1);
    var twos = lv.filter(function (x) { return x === 2; }).length;
    window.VT_BEGINNER_LEVELS = lv;   /* for checking: key, outside, time, speed, rhythm, slurs, ornaments */
    return lv.indexOf(3) < 0 && twos <= 2;
  }
  /* the fingered ways to play pitch m: [{si, p (position index), fg, c (cost)}], plus the open string */
  function waysFor(n) {
    var out = [];
    for (var si = 0; si < 4; si++) {
      var k = n.m - OPEN[si];
      if (k < 0 || k > 22) continue;
      var blind = window.VT_FG_BLIND;   /* test: ignore what is written, to compare the plan with it */
      if (n.xs && !blind && 4 - n.xs !== si) continue;   /* a written string number */
      if (k === 0) { if (blind || n.xfg === undefined || n.xfg === 0) out.push({ si: si, p: -1, fg: 0, c: 0 }); continue; }
      for (var p = 0; p < POS_S.length; p++) {
        var d = k - POS_S[p];
        if (d < -1 || d > 7) continue;
        var fg = d <= 0 ? 1 : d <= 2 ? 2 : d <= 4 ? 3 : 4;
        if (!blind && n.xfg !== undefined && n.xfg !== fg) continue;   /* a written finger */
        var c = FG_COST.pos[p] + (fg === 4 ? FG_COST.four : 0) + (d === 6 ? FG_COST.high4 : 0) + (d === 7 ? FG_COST.ext : 0);
        if (si <= 1 && p > 2) c += FG_COST.lowHigh;
        out.push({ si: si, p: p, fg: fg, c: c });
      }
    }
    return out;
  }
  function planFingers(notes, tpq) {
    /* onsets as units; only single notes are planned, a chord is a fixed point (its top note's string/position) */
    var units = [];
    for (var u0 = 0; u0 < notes.length; ) { var u1 = u0; while (u1 < notes.length && Math.abs(notes[u1].b - notes[u0].b) < 1e-6) u1++; units.push(notes.slice(u0, u1)); u0 = u1; }
    var slurDepth = 0, inSlur = [];   /* inSlur[q]: units q and q+1 are joined by a slur */
    units.forEach(function (un, q) {
      un.forEach(function (n) { (n.slur || []).forEach(function (sl) { slurDepth += sl.t === 'start' ? 1 : sl.t === 'stop' ? -1 : 0; }); });
      slurDepth = Math.max(0, slurDepth); inSlur[q] = slurDepth > 0;
    });
    var NP = POS_S.length;
    /* states per unit: {si, p, fg, c, n}; an open string keeps the hand where it is (one state per position) */
    var states = units.map(function (un, q) {
      var top = un.reduce(function (a, b) { return b.m > a.m ? b : a; });
      if (un.length > 1 || top.harm) {   /* chord or harmonic: as chosen already */
        /* the lowest position that reaches every stopped note of the chord */
        var ks = un.filter(function (n) { return n.si >= 0 && n.m > OPEN[n.si]; }).map(function (n) { return n.m - OPEN[n.si]; }), pp = -1;
        for (var z = 0; z < NP && pp < 0; z++) if (ks.every(function (k) { return k >= POS_S[z] - 1 && k <= POS_S[z] + 7; })) pp = z;
        if (pp < 0) pp = ks.length ? NP - 1 : 0;
        var k = ks.length ? 1 : 0;
        return [{ si: top.si, p: k === 0 || top.harm ? -1 : pp, fg: top.fg, c: 0, fixed: true }];
      }
      var w = waysFor(top);
      if (!w.length) return [{ si: top.si, p: -1, fg: top.fg, c: 0, fixed: true }];   /* out of reach: as before */
      var next = units[q + 1], dur = top.e - top.t, last = !next;
      var res = [];
      w.forEach(function (s) {
        if (s.fg === 0) {
          var oc = fgBeginner ? 0 : (dur >= 0.8 ? FG_COST.openLong : 0) + (last ? FG_COST.openLong : 0);
          /* a drone: the same open-string note two notes before or after, with another open string between */
          var sm = function (z) { var u = units[z]; return u && u.length === 1 ? u[0].m : -1; };
          var otherOpen = function (z) { var m = sm(z); return m !== top.m && OPEN.indexOf(m) >= 0; };
          if ((sm(q - 2) === top.m && otherOpen(q - 1)) || (sm(q + 2) === top.m && otherOpen(q + 1))) oc -= FG_COST.drone;
          for (var hp = 0; hp < NP; hp++) res.push({ si: s.si, p: hp, open: true, fg: 0, c: oc + (hp ? 0.05 * hp : 0) });
        } else res.push(s);
      });
      return res;
    });
    /* transition cost between unit q (state a) and q+1 (state b) */
    function move(q, a, b) {
      var c = 0, A = units[q][0], B = units[q + 1][0];
      if (a.si >= 0 && b.si >= 0 && a.si !== b.si) {
        var ds = Math.abs(a.si - b.si);
        c += FG_COST.cross + (ds - 1) * FG_COST.skip + (inSlur[q] ? FG_COST.slurCross : 0);
      }
      var pa = a.p, pb = b.p;
      if (pa >= 0 && pb >= 0 && pa !== pb) {
        var gap = B.t - A.e, ioi = B.t - A.t, sh = FG_COST.shift + FG_COST.shiftStep * Math.abs(pa - pb);
        if (a.open || b.open || gap > 0.15 || A.e - A.t >= 0.6) sh *= FG_COST.shiftEasy;
        else if (ioi < 0.25 || inSlur[q]) sh *= FG_COST.shiftHard;
        c += sh;
      }
      return c;
    }
    /* Viterbi */
    var cost = states[0].map(function (s) { return s.c; }), back = [null];
    for (var q = 1; q < units.length; q++) {
      var cur = states[q], prev = states[q - 1], nc = [], bk = [];
      cur.forEach(function (b, j) {
        var best = Infinity, bi = 0;
        prev.forEach(function (a, i) { var v = cost[i] + move(q - 1, a, b); if (v < best) { best = v; bi = i; } });
        nc[j] = best + b.c; bk[j] = bi;
      });
      cost = nc; back.push(bk);
    }
    var j = 0; for (var i = 1; i < cost.length; i++) if (cost[i] < cost[j]) j = i;
    for (q = units.length - 1; q >= 0; q--) {
      var st = states[q][j];
      if (!st.fixed) { var n = units[q][0]; n.si = st.si; n.fg = st.fg; }
      units[q].forEach(function (u) { u.hand = st.p; });   /* the hand position (0 = 1st ... 8 = 9th; -1 unknown): position marks on the score */
      if (q > 0) j = back[q][j];
    }
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
  /* how many numerals are printed (Trix, 2026-11-13): Full (every stopped note, as before), Medium (none that tell the
     reader nothing new), Minimum (the Suzuki book 1 look: only where a player cannot infer it). A filter on what is
     drawn: the planner's choices do not change, and a fingering written in the score prints at every level. One
     setting for the player's strip, the Fingerings pages and the PDF (they share this renderer). */
  var FG_LEVELS = ['full', 'medium', 'minimum'], FG_LEVEL = 'full', fgForce = null;   /* fgForce: beats whose first note must show (each page's first note) */
  try { var lv0 = localStorage.getItem('violin-fg-level'); if (FG_LEVELS.indexOf(lv0) >= 0) FG_LEVEL = lv0; } catch (e) {}
  function fgMark(sg) {   /* sets n._fs (shown) on every note for the current level */
    var key = FG_LEVEL + '|' + (fgForce ? fgForce.join(',') : '');
    if (sg._fgKey === key) return;
    sg._fgKey = key;
    var ns = sg.notes, beatQ = 4 / sg.sig.den, prev = null, shown = null, first = true;
    ns.forEach(function (n) { n._fs = true; });
    if (FG_LEVEL === 'full') return;
    var forced = {}; (fgForce || []).forEach(function (b) { forced[b.toFixed(3)] = 1; });
    function barOf(n) { var bo = sg.barAt ? sg.barAt(n.b + 1e-6) : null; return bo ? bo.beat : Math.floor(n.b / (sg.sig.num * beatQ)); }
    var units = [];   /* onsets in time order: a chord counts as its top note */
    for (var i = 0; i < ns.length; ) {
      var j = i; while (j < ns.length && Math.abs(ns[j].b - ns[i].b) < 1e-6) j++;
      var un = ns.slice(i, j).filter(function (n) { return !n.grace; });
      if (un.length) units.push(un);
      ns.slice(i, j).forEach(function (n) { if (n.grace) n._fs = n.xfg !== undefined; });
      i = j;
    }
    units.forEach(function (un, ui) {
      var n = un.reduce(function (a, b) { return b.m > a.m ? b : a; }), next = units[ui + 1] ? units[ui + 1][0] : null;
      var fg = n.fg, k = n.si >= 0 ? n.m - OPEN[n.si] : 0, d = n.hand >= 0 && fg > 0 ? k - POS_S[n.hand] : 0;
      var ext = fg === 4 || d >= 6, bar = barOf(n);
      var posCh = prev && fg > 0 && prev.fg > 0 && n.hand !== undefined && prev.hand !== undefined && n.hand !== prev.hand;
      var strCh = prev && n.si !== prev.si;
      var keep = n.xfg !== undefined || n.harm || ext || posCh || forced[n.b.toFixed(3)];
      var show;
      if (FG_LEVEL === 'medium') {
        var openAlt = fg === 0 && n.si > 0;   /* an open D, A or E: a stopped note of that pitch exists on the lower string */
        keep = keep || openAlt || strCh || !prev;
        if (!keep && shown && bar !== shown.bar && fg !== shown.fg) keep = true;   /* the first new finger after a bar line */
        if (keep) show = true;
        else if (shown && shown.si === n.si && shown.bar === bar && shown.fg === fg && Math.abs(n.m - shown.m) <= 2) show = false;   /* repeats the last numeral shown */
        else if (prev && prev._fs && prev.si === n.si && barOf(prev) === bar) show = false;   /* never two in a row on one string in a bar */
        else show = true;
      } else {
        var rest = prev ? n.b - (prev.b + (prev.own || prev.len || 0)) : Infinity;
        var phrase = first || rest >= beatQ - 1e-6;
        /* a deliberate open string: away from 1st position, or reached from the string below (the run lay there) */
        var deliberate = fg === 0 && n.si > 0 && ((prev && prev.hand > 0) || (prev && prev.si === n.si - 1 && next && next.si === n.si - 1));
        /* a finger that goes against the run: up the string with a lower finger, or down with a higher one */
        var against = prev && fg > 0 && prev.fg > 0 && prev.si === n.si && prev.hand === n.hand && ((n.m > prev.m && fg < prev.fg) || (n.m < prev.m && fg > prev.fg));
        show = !!(keep || phrase || deliberate || against);
      }
      /* the same pitch again on the same string and finger says nothing new (Trix): hidden at Medium and Minimum, over
         every other rule except a written fingering and a page's first note */
      if (prev && n.m === prev.m && n.si === prev.si && fg === prev.fg && un.length === 1 && n.xfg === undefined && !forced[n.b.toFixed(3)]) show = false;
      un.forEach(function (x) { x._fs = show || x.xfg !== undefined; });
      if (show) shown = { si: n.si, fg: fg, bar: bar, m: n.m };
      prev = n; first = false;
    });
  }
  APP.fgLevel = function (lv) {   /* the Fingerings control: re-draws the strip and the pages, keeps the scroll */
    if (lv === undefined) return FG_LEVEL;
    if (FG_LEVELS.indexOf(lv) < 0 || lv === FG_LEVEL) return FG_LEVEL;
    FG_LEVEL = lv; try { localStorage.setItem('violin-fg-level', lv); } catch (e) {}
    if (APP.fgLvUi) APP.fgLvUi();
    if (song) { var y = window.scrollY, sl = fgPages ? fgPages.scrollLeft : 0; drawScore(); scroll(); fgDirty = true; if (fgShown) fgRender(); window.scrollTo(0, y); if (fgPages) fgPages.scrollLeft = sl; }
    return FG_LEVEL;
  };
  function hueOf(nt) { return nt.si >= 0 ? 'var(' + HUE[nt.si] + ')' : 'var(--accent)'; }
  var CLEF = '<g transform="translate(2 ' + (Y0 - 36) + ') scale(0.9)"><path fill="currentColor" transform="translate(-5.000 80.125) scale(0.0750 -0.0750)" d="M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z"/></g>';
  var ACC = { '1': '#', '-1': 'b', '0': 'n' };   /* drawn by APP.accSvg */
  var barNoEl = $('mpBarNo');
  var noteEls = [], X0 = 0, W = 0, chunks = [], shownFrom = -1;

  /* position marks (Trix): an italic Roman numeral over the first note where the hand moves to another position
     for at least about 2 beats, with a dashed line to the last note it holds; nothing while the tune stays in 1st.
     Open strings keep the hand where it is (the planner carries it). A score that writes its own position words
     ("III", "3rd pos.") is followed instead, and the planner's marks are not drawn. */
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];   /* to read the score's own words */
  var ROMAN_U = ['\u2160', '\u2161', '\u2162', '\u2163', '\u2164', '\u2165', '\u2166', '\u2167', '\u2168', '\u2169'];   /* drawn: the single Roman numeral characters (Trix: U+2162 for III) */
  var ROMAN_W = [0.45, 0.75, 1.0, 1.0, 0.75, 1.0, 1.25, 1.5, 1.0, 0.75];   /* their width in em, for where the dashes start */
  function posWord(t) {   /* the position a words direction names, or 0 */
    t = String(t).trim();
    var u = ROMAN_U.indexOf(t.replace(/\s*pos(?:ition)?\.?$/i, '').replace(/^pos(?:ition)?\.?\s*/i, ''));
    if (u >= 0) return u + 1;
    var m = /^(?:pos(?:ition)?\.?\s*)?(I{1,3}|IV|VI{0,3}|IX|X)(?:\s*pos(?:ition)?\.?)?$/.exec(t);
    if (m) return ROMAN.indexOf(m[1]) + 1;
    m = /^([1-9])(?:st|nd|rd|th)\.?\s*pos(?:ition|\.)?$/i.exec(t);
    return m ? +m[1] : 0;
  }
  function posMarks(sg, inf, xAt, bars, passages, paged) {   /* paged: the Fingerings pages, where a numeral may rise above the system */
    var out = [], CHW = 1200, ns = sg.notes;
    function mark(x, y, h) { out.push([x, '<text class="mp-pos" x="' + (x - 4) + '" y="' + y + '">' + ROMAN_U[h] + '</text>']); }
    function dash(x0, x1, y) {   /* in pieces no longer than a score section, so each shows with its section */
      /* in pieces that end at bar lines and score sections: each shows with its section, and a page system ends its own */
      var cuts = bars.map(function (q) { return q.x; });
      for (var a = x0; a < x1; ) {
        var b = Math.min(x1, (Math.floor(a / CHW) + 1) * CHW);
        for (var c = 0; c < cuts.length; c++) if (cuts[c] > a + 0.5 && cuts[c] < b) { b = cuts[c]; break; }
        out.push([a, '<path class="mp-posd" d="M' + a + ' ' + y + 'H' + b + '"/>']); a = b;
      }
    }
    function topOver(k0, k1) { var t = Y0 - 7; for (var k = k0; k <= k1; k++) if (inf[k] && inf[k].top !== undefined) t = Math.min(t, inf[k].top); return Math.max(14, t); }
    var own = (sg.marks || []).filter(function (m) { return m.kind === 'words' && posWord(m.text); });
    if (own.length) {   /* the score's own marks, over the note at that beat */
      own.forEach(function (m) {
        var k = 0; while (k < ns.length - 1 && ns[k].b < m.beat - 1e-6) k++;
        mark(inf[k] ? inf[k].hx : xAt(m.beat), topOver(k, k), posWord(m.text) - 1);
      });
      return out;
    }
    /* runs of notes in one hand position (an unknown position keeps the one before) */
    var runs = [], h = 0;
    ns.forEach(function (n, k) {
      if (n.hand >= 0) h = n.hand;
      var r = runs[runs.length - 1], end = n.b + (n.own || n.len || 0);
      if (r && r.h === h) { r.k1 = k; r.b1 = Math.max(r.b1, end); }
      else runs.push({ h: h, k0: k, k1: k, b0: n.b, b1: end });
    });
    var shown = 0, open = null;
    function close(kEnd) {
      if (!open) return;
      /* the numeral clears its own note; the line runs at the same height through the passage, broken around any
         note whose fingering or bowing reaches up to it (the strip has no more room above: Winter's high runs) */
      /* where the numeral goes: over the passage's first note if there is room above it; else over the first of the
         next few notes (within 2 beats) that has room; else in the gap just before the passage. Never pressed down
         onto a note, its fingering or a grace note (Trix: the Ⅲ sat on a grace note and a 3) */
      var kAt = -1, raw = function (k) { var t = Y0 - 7; (inf[k].members || [k]).forEach(function (j) { if (inf[j].top !== undefined) t = Math.min(t, inf[j].top); }); return t; };
      var gw = 18 * ROMAN_W[open.h];
      function roomAt(k) {   /* the numeral's baseline over note k: clear of every note it spans, not only k (tight spacing) */
        var t = raw(k), x = inf[k].hx;
        for (var j = Math.max(0, k - 6); j < ns.length && j <= k + 8; j++) if (j !== k && inf[j] && inf[j].members !== undefined && inf[j].hx > x - 14 && inf[j].hx < x + gw + 6) t = Math.min(t, raw(j));
        return t;
      }
      /* spots to try: over each of the passage's first notes (within 2 beats), then the gap just before it (clear of
         its grace notes). The first with room (a baseline at 14 or lower) wins; if none has, the one with the most
         room, raised as far as needed (the page has space above the system; the player's strip may clip its top) */
      var cands = [];
      for (var kk = open.k0; kk <= kEnd && ns[kk].b < ns[open.k0].b + 2 + 1e-6; kk++) {
        if (!inf[kk] || ns[kk].grace || inf[kk].members === undefined) continue;   /* chord heads only; graces are not anchors */
        cands.push([inf[kk].hx, roomAt(kk)]);
      }
      var left = inf[open.k0].hx;
      for (var g = open.k0 - 1; g >= 0 && ns[g].grace; g--) left = Math.min(left, inf[g].hx);
      var gx = left - 12 - gw + 4, groom = Y0 - 7;
      for (var j2 = Math.max(0, open.k0 - 8); j2 <= Math.min(ns.length - 1, open.k0 + 4); j2++) if (inf[j2] && inf[j2].hx > gx - 10 && inf[j2].hx < gx + gw + 6) groom = Math.min(groom, raw(j2));
      var pick = cands.filter(function (c) { return c[1] >= 14; })[0];
      /* the pages: up over one of the passage's first notes, above everything there (the addendum's rule: up, not
         sideways), at most 22 units over the staff; where even that is taken the numeral is left out rather than
         printed over a fingering (Hermes F36) */
      if (!pick && paged) { pick = cands.filter(function (c) { return c[1] >= -22; })[0]; if (!pick) { open = null; return; } }
      if (!pick) { cands.push([gx + 4, groom]); pick = cands.reduce(function (m, c) { return c[1] > m[1] ? c : m; }); pick = [pick[0], Math.max(-4, pick[1])]; }   /* the player's strip has no room above it: the best spot it has */
      var x0 = pick[0], y = Math.min(pick[1], Y0 - 7);
      var x1 = inf[kEnd].hx + 6, ly = y - 5, a = x0 + 2 + gw;
      mark(x0, y, open.h);
      passages.push({ h: open.h, x0: x0, x1: x1, y: y });
      if (open.h > 0) {   /* "I" (back to 1st) needs no line */
        /* a run of notes whose fingering reaches the line's height (high notes, their numbers pinned at the top
           of the strip): the line pauses over the whole run, not just round each note, and picks up again at the
           next clear note (Trix: dashes between the 4s read as crossing them) */
        var gap = false;
        for (var k = open.k0 + 1; k <= kEnd; k++) {
          var f = inf[k]; if (!f || f.top === undefined || ns[k].grace) continue;
          if (ly <= f.top + 2) { if (gap) { a = f.hx - 14; gap = false; } continue; }   /* clear of the line */
          if (!gap && f.hx - 14 > a + 6) dash(a, f.hx - 14, ly);   /* clear of a wide mark over the note (a long mordent) */
          gap = true; a = f.hx + 14;
        }
        if (!gap && x1 > a + 6) dash(a, x1, ly);
      }
      open = null;
    }
    var cl = [];   /* the passages that would get a numeral */
    runs.forEach(function (r) {
      if (r.b1 - r.b0 < 2 - 1e-6 || r.h === shown) { if (cl.length && r.h === cl[cl.length - 1].h) cl[cl.length - 1].kEnd = r.k1; return; }   /* short excursions are not marked */
      cl.push({ h: r.h, k0: r.k0, kEnd: r.k1 }); shown = r.h;
    });
    /* density (Hermes F36): a passage of fewer than 6 notes is a position the planner does not settle in; several of
       them in a row (Winter's tremolo chords, a new hand every chord) get one numeral, for the position held longest
       there, and the rest are left out */
    function onsets(c) { var m = 0, last = null; for (var k = c.k0; k <= c.kEnd; k++) if (!ns[k].grace && ns[k].b !== last) { m++; last = ns[k].b; } return m; }
    function held(c) { return ns[c.kEnd].b + (ns[c.kEnd].own || ns[c.kEnd].len || 0) - ns[c.k0].b; }
    var kept = [], before = 0;
    for (var ci = 0; ci < cl.length; ) {
      var grp = [cl[ci]];
      while (onsets(grp[grp.length - 1]) < 6 && ci + grp.length < cl.length && onsets(cl[ci + grp.length]) < 6 && cl[ci + grp.length].k0 - grp[grp.length - 1].kEnd <= 4) grp.push(cl[ci + grp.length]);
      if (grp.length === 1) kept.push(grp[0]);
      else {
        var tot = {}, best = null;
        grp.forEach(function (c) { tot[c.h] = (tot[c.h] || 0) + held(c); });
        grp.forEach(function (c) { if (best === null || tot[c.h] > tot[best.h] + 1e-6) best = c; });
        kept.push(best);
      }
      ci += grp.length;
    }
    kept.forEach(function (c) { if (c.h === before) return; before = c.h; open = c; close(c.kEnd); });   /* no numeral repeating the one before */
    return out;
  }
  /* the score drawing, shared by the player's scrolling strip and the Fingerings pages (one renderer, two
     layouts): every shape as [x, svg markup] on one long line, plus where each bar starts. opts.gain(beat) widens
     the spacing after a beat (the pages justify each system with it) */
  function scoreItems(sg, opts) {
    fgMark(sg);
    opts = opts || {};
    var X0, W, xAt, bars = [];
    var sharps = sg.sf >= 0, sp = sharps ? SP_S : SP_F, n = Math.abs(sg.sf), i;
    function keyAccOf(f) { var a = {}, sh = f >= 0; for (var j = 0; j < Math.abs(f); j++) a[(sh ? SHARP_K : FLAT_K)[j]] = sh ? 1 : -1; return a; }
    /* key changes (Trix): the key of each bar as the score writes it; the new signature is drawn after the bar line
       where it changes, with naturals for the signs it drops, and the accidentals follow it from there */
    var kChg = [], nMax = n;
    (function () {
      var cur = sg.sf;
      (sg.bars || []).forEach(function (b) {
        if (b.ks === null || b.ks === undefined) return;
        if (b.ks !== cur && b.beat > 1e-6) kChg.push({ beat: b.beat, sf: b.ks, prev: cur });
        cur = b.ks; nMax = Math.max(nMax, Math.abs(b.ks));
      });
    })();
    function sfAt(b) { var f = sg.sf; for (var j = 0; j < kChg.length && kChg[j].beat <= b + 1e-6; j++) f = kChg[j].sf; return f; }
    /* a key signature at x as printed: each sign on its own line or space, about a space apart (Trix). As modern
       editions do, the new key alone (Trix: no naturals before the sharps); naturals only for a change to no sharps
       or flats, where nothing else would show it. Returns [markup, width] */
    function keySig(f, prev, x) {
      var g = '', k = 0, sh = f >= 0, ps = prev >= 0, keep = keyAccOf(f), j;
      if (!f) for (j = 0; j < Math.abs(prev); j++) if (keep[(ps ? SHARP_K : FLAT_K)[j]] !== (ps ? 1 : -1)) g += APP.accSvg('n', x + 2 + 10.5 * k++, yOf((ps ? SHARP_P : FLAT_P)[j]), S);
      if (k && f) k += 0.4;
      for (j = 0; j < Math.abs(f); j++) g += APP.accSvg(sh ? '#' : 'b', x + 2 + 10.5 * k++, yOf((sh ? SHARP_P : FLAT_P)[j]), S);
      return ['<g class="acc key">' + g + '</g>', k * 10.5];
    }
    var out = [], x = 40;
    out.push(keySig(sg.sf, sg.sf, x)[0]);
    n = nMax;   /* the clef area is as wide as the widest key in the piece, so a later key fits in it */
    /* time signature: each number two spaces tall (top line to middle, middle to bottom), sized from the
       measured ink of the device's serif digits, and placed by its width */
    var tsz = 2 * S / APP.digitRatio(APP.TS_FONT), tw = Math.max(String(sg.sig.num).length, String(sg.sig.den).length) * tsz * 0.5;
    x += (n ? n * 10.5 - 1 : 6) + tw / 2 + 4;
    var head = out.length + 1;   /* key signature + the time signature */
    out.push('<text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + x + '" y="' + (Y0 + 2 * S) + '">' + sg.sig.num + '</text><text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + x + '" y="' + (Y0 + 4 * S) + '">' + sg.sig.den + '</text>');
    X0 = x + tw / 2 + 22;
    var barBeats = sg.sig.num * 4 / sg.sig.den, pk = sg.pick || 0;   /* pk: the pickup, beats before bar 1 is full */
    /* a piece whose time signature changes (the Csárdás): its bar lines are the file's own measures, and the new
       signature is printed where it changes; otherwise one bar length throughout, as before */
    var VB = null, VL = [], tsAt = {};
    (function () {
      var cur = sg.sig, change = false;
      (sg.bars || []).forEach(function (b, i) {
        if (b.ts && i > 0 && (b.ts.num !== cur.num || b.ts.den !== cur.den)) { change = true; tsAt[i] = b.ts; }
        if (b.ts) cur = b.ts;
        VL.push(cur.num * 4 / cur.den);
      });
      if (change) VB = sg.bars.map(function (b) { return b.beat; });
    })();
    function bIdx(b) {
      if (!VB) return Math.floor((b + pk) / barBeats + 1e-6);
      var n = 0; while (n + 1 < VB.length && VB[n + 1] <= b + 1e-6) n++;
      var last = VB.length - 1;
      return n < last ? n : last + Math.max(0, Math.floor((b - VB[last]) / VL[last] + 1e-6));
    }
    function bStart(n) {
      if (!VB) return n * barBeats - pk;
      var last = VB.length - 1;
      return n <= last ? (n >= 0 ? VB[n] : VB[0] + n * VL[0]) : VB[last] + (n - last) * VL[last];
    }
    /* spacing by note length, as printed music does (a semiquaver ~41 px, a crotchet 56, a semibreve 86), with
       room at each bar line; xAt() maps beats to x for placing and scrolling */
    var ons = [], items = [];   /* what scrolls: [x, svg markup], drawn in sections */
    /* long notes (Trix): longer than a semibreve, not one note value, or held over a bar line -> tied pieces, each a
       note value inside its bar; the first carries the fingering and marks, the rest are drawn as tied heads */
    var PV = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125], conts = [];
    sg.notes.forEach(function (n) {
      n.pcs = null; n.dl = n.len;
      if (n.grace || !(n.full > 0) || n.full < 1) return;
      var b = n.b, L = n.full, pcs = [];
      while (L > 1e-6 && pcs.length < 24) {
        var unitB = barBeats === 6 || (barBeats === 4 && sg.sig.den === 8) ? barBeats / 2 : barBeats;   /* 6/4 and 12/8: halves of the bar (two dotted minims, not a semibreve and a minim) */
        var barEnd = VB ? bStart(bIdx(b) + 1) : Math.floor((b + pk) / unitB + 1e-6) * unitB - pk + unitB, seg = Math.min(L, barEnd - b);
        while (seg > 1e-6) { var v = PV.filter(function (x) { return x <= seg + 1e-6; })[0] || 0.125; pcs.push({ b: b, len: v }); b += v; seg -= v; L -= v; }
      }
      if (pcs.length > 1) { n.pcs = pcs; n.dl = pcs[0].len; pcs.slice(1).forEach(function (pc) { conts.push(pc.b); }); }
    });
    var gRoom = {};   /* grace notes: drawn small just before their note, in room made for them, outside the beat spacing */
    sg.notes.forEach(function (n) {
      if (n.grace) { var mb = (n.b + (n.gn - n.gi) / 480).toFixed(3); gRoom[mb] = Math.max(gRoom[mb] || 0, n.gn); return; }
      if (!ons.length || n.b > ons[ons.length - 1] + 1e-6) ons.push(n.b);
    });
    /* rests (Trix: shown as printed, and given room like notes so the sheet does not rush through a silence):
       from the end of each note (or the start of its bar, before the first note) to the next onset, split at
       bar lines into whole-bar, half, quarter, quaver and semiquaver rests (dotted in x/8), each on its grid */
    var rests = [], comp = sg.sig.den >= 8 && sg.sig.num % 3 === 0;
    function restRun(a, z) {
      while (z - a >= 0.25 - 1e-6) {
        var bs = bStart(bIdx(a)), bE = VB ? bStart(bIdx(a) + 1) : bs + barBeats, be = Math.min(z, bE);
        if (Math.abs(a - bs) < 1e-6 && Math.abs(be - bE) < 1e-6) { rests.push({ b: a, v: bE - bs, whole: true }); a = be; continue; }
        var vs = comp ? [3, 1.5, 1, 0.5, 0.25] : [2, 1, 0.5, 0.25], v = 0.25;
        for (var q = 0; q < vs.length; q++) { var w = vs[q], off = a - bs; if (a + w <= be + 1e-6 && Math.abs(off / w - Math.round(off / w)) < 1e-6) { v = w; break; } }
        if (a + v > be + 1e-6) break;
        rests.push({ b: a, v: v }); a += v;
      }
    }
    if (sg.notes.length) restRun(0, sg.notes[0].b);   /* from the first bar kept: bars where only the accompaniment plays are whole-bar rests */
    ons.forEach(function (b, i) {
      if (i + 1 >= ons.length) return;
      var end = b; sg.notes.forEach(function (n) { if (Math.abs(n.b - b) < 1e-6) end = Math.max(end, n.b + (n.pcs ? n.full : n.len)); });
      restRun(Math.round(end * 4) / 4, ons[i + 1]);
    });
    /* bars after the solo's last note where only the accompaniment plays: whole-bar rests to the end (Hermes F71) */
    var tailBars = (sg.bars || []).filter(function (x) { return x.beat >= sg.beats - 1e-6; }), END = sg.beats;
    if (tailBars.length && ons.length) {
      END = VB ? bStart(bIdx(tailBars[tailBars.length - 1].beat) + 1) : tailBars[tailBars.length - 1].beat + barBeats;
      var lastEnd = ons[ons.length - 1]; sg.notes.forEach(function (n) { if (Math.abs(n.b - ons[ons.length - 1]) < 1e-6) lastEnd = Math.max(lastEnd, n.b + (n.pcs ? n.full : n.len)); });
      restRun(Math.round(lastEnd * 4) / 4, END);
    }
    var evs = ons.concat(conts); rests.forEach(function (r) { evs.push(r.b); });
    evs.sort(function (a, b) { return a - b; });
    evs = evs.filter(function (b, i) { return !i || b > evs[i - 1] + 1e-6; });
    /* an empty bar before the first note: the count-in scrolls through it, so the first note reaches the
       playhead as the music starts (Trix) */
    var leadW = Math.max(120, barBeats * 40), pts = [[-barBeats, X0]], cx = X0 + leadW, lastBar = 0;
    items.push([cx - 6, '<path class="bl" d="M' + (cx - 6) + ' ' + Y0 + 'V' + BOT + '"/>']);
    bars.push({ beat: 0, x: cx - 6 });
    cx += 12;
    var rp0 = opts.paged && sg.barAt ? sg.barAt(1e-3) : null; if (rp0 && rp0.wr && rp0.wr.fwd) { cx += 14; bars[0].fx = 14; }   /* a forward repeat at the start (Hermes F67) */
    evs.forEach(function (b, i) {
      var bn = bIdx(b);
      if (bn > lastBar) {
        /* a repeat sign takes ~14 units of ink beside its barline: room for it on the pages, so a note does not sit in
           it (Hermes F67); the scrolling strip draws no repeat signs and keeps its spacing */
        var bS = bStart(bn), rpB = opts.paged && sg.barAt ? sg.barAt(bS - 1e-3) : null, rpF = opts.paged && sg.barAt ? sg.barAt(bS + 1e-3) : null;
        if (rpB && rpB.wr && rpB.wr.back) { cx += 14; bars[bars.length - 1].fx = (bars[bars.length - 1].fx || 0) + 14; }
        items.push([cx - 6, '<path class="bl" d="M' + (cx - 6) + ' ' + Y0 + 'V' + BOT + '"/>']); bars.push({ beat: bS, x: cx - 6 }); cx += 12; lastBar = bn; var cxFx = cx;
        var rpFw = rpF && rpF.wr && rpF.wr.fwd; if (rpFw) cx += 14;   /* a start-repeat sign first, then any new key or time (Trix: the 2/4 sat in the repeat dots) */
        var kc = kChg.filter(function (c) { return Math.abs(c.beat - bS) < 1e-3; })[0];
        if (kc) {   /* a new key: a double bar line, then the signature */
          var ksg = keySig(kc.sf, kc.prev, cx - 4);
          items.push([cx - 6, '<g class="kchg">' + (rpFw ? '' : '<path class="bl" d="M' + (cx - 14) + ' ' + Y0 + 'V' + BOT + '"/>') + ksg[0] + '</g>']);
          cx += ksg[1] + 6;
        }
        if (tsAt[bn]) {   /* the new time signature after the bar line */
          var nts = tsAt[bn], ntw = Math.max(String(nts.num).length, String(nts.den).length) * tsz * 0.5;
          items.push([cx, '<text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + (cx + ntw / 2) + '" y="' + (Y0 + 2 * S) + '">' + nts.num + '</text><text class="ts" style="font-size:' + tsz.toFixed(2) + 'px" x="' + (cx + ntw / 2) + '" y="' + (Y0 + 4 * S) + '">' + nts.den + '</text>']);
          cx += ntw + 12;
        }
        bars[bars.length - 1].fx = cx - cxFx;   /* room that does not stretch or squeeze with the notes: a repeat sign, a new key or time (the pages' line fitting) */
      }
      if (gRoom[b.toFixed(3)]) cx += 12 * gRoom[b.toFixed(3)];
      pts.push([b, cx]);
      cx += (26 + 30 * Math.sqrt(Math.max(0.125, (i + 1 < evs.length ? evs[i + 1] : END) - b))) * (opts.gain ? opts.gain(b) : 1);
    });
    pts.push([END, cx]);
    xAt = function (b) {
      if (b <= pts[0][0]) return pts[0][1] - (pts[0][0] - b) * 50;   /* pts[0] is the start of the empty bar */
      for (var i = 1; i < pts.length; i++) if (b <= pts[i][0]) { var a = pts[i - 1], c = pts[i]; return a[1] + (c[1] - a[1]) * (b - a[0]) / ((c[0] - a[0]) || 1); }
      return cx + (b - END) * 50;
    };
    W = cx + 30;
    rests.forEach(function (r) {
      var x = r.whole ? (xAt(r.b) + xAt(r.b + r.v)) / 2 - 8 : xAt(r.b);   /* a whole-bar rest in the middle of its bar */
      items.push([x, '<g class="mp-rest">' + restSvg(r, x) + '</g>']);
    });
    var endX = cx - 8;
    items.push([endX - 4, '<path class="bl" d="M' + (endX - 4) + ' ' + Y0 + 'V' + BOT + '"/><path class="bl end" d="M' + endX + ' ' + Y0 + 'V' + BOT + '"/>']);
    bars.push({ beat: END, x: endX - 4, end: true });
    if (opts.barsOnly) return { X0: X0, bars: bars, nMax: nMax };   /* the pages' first pass: where the bars fall is all it needs */
    /* first pass: where each note sits; accidentals hold to the end of the bar */
    var lowInk = [], barNo = -1, inBar = {}, keyAcc = {}, inf = sg.notes.map(function (nt) {
      var bn = bIdx(nt.b);
      if (bn !== barNo) { barNo = bn; inBar = {}; keyAcc = keyAccOf(sfAt(bStart(bn))); }
      var spl = sp[nt.m % 12], L = spl[0], acc = spl[1], oct = Math.floor(nt.m / 12) - 1;
      /* MusicXML: the note as written (Trix: the Habanera's F# after its change to D major was drawn as Gb) */
      if (nt.wsp && nt.wsp[0] >= 0 && Math.abs(nt.wsp[1]) <= 1) { L = nt.wsp[0]; acc = nt.wsp[1]; oct = nt.wsp[2]; }
      var step = L + 7 * (oct - 4), id = L + '/' + oct, have = id in inBar ? inBar[id] : (keyAcc[L] || 0), sign = null;
      if (acc !== have) { sign = ACC[String(acc)]; inBar[id] = acc; }
      return { nt: nt, step: step, y: yOf(step), hx: nt.grace ? xAt(nt.b + (nt.gn - nt.gi) / 480) - 12 * (nt.gn - nt.gi) - 2 : xAt(nt.b), len: nt.wl || nt.dl || nt.len, sign: sign, up: step < 6, beam: -1 };
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
    var xmlBeams = sg.notes.some(function (n) { return n.xb !== undefined; });   /* MusicXML: its own beams (Trix: Winter's 8 quavers under one) */
    heads.forEach(function (k, hi) {
      if (xmlBeams) {
        var bt = inf[k].members.map(function (j) { return inf[j].nt.xb; }).filter(function (v) { return v && v !== 'none'; })[0];
        if (inf[k].nt.grace) return;
        if (inf[k].len >= 1 - 1e-6) bt = 'none';   /* a crotchet or longer never takes a beam (a crotchet in a triplet) */
        if (bt === 'begin') { cur = [k]; groups.push(cur); }
        else if ((bt === 'continue' || bt === 'end') && cur) { cur.push(k); if (bt === 'end') cur = null; }
        else cur = null;
        return;
      }
      var f = inf[k], prev = hi ? inf[heads[hi - 1]] : null, ok = f.len < 1 && !f.nt.grace;
      var joins = ok && cur && prev && !prev.nt.grace && Math.floor(f.nt.b / unit + 1e-6) === Math.floor(prev.nt.b / unit + 1e-6) && Math.abs(prev.nt.b + prev.len - f.nt.b) < 0.02 && f.nt.b > prev.nt.b + 1e-6;
      if (joins) cur.push(k); else { cur = ok ? [k] : null; if (cur) groups.push(cur); }
    });
    /* notes under one slur, not beamed, share a stem direction (Trix: a slurred A-B had one stem up, one down):
       up when they sit below the middle line on average; beamed groups set their own below */
    (function () {
      var open = {}, spans = [];
      heads.forEach(function (k) {
        var f = inf[k]; if (f.nt.grace) return;
        f.members.forEach(function (j) {
          (inf[j].nt.slur || []).forEach(function (sl) {
            if (sl.t === 'start') open[sl.n] = k;
            else if (sl.t === 'stop' && open[sl.n] !== undefined) { spans.push([open[sl.n], k]); delete open[sl.n]; }
          });
        });
      });
      /* a slur over beamed notes (Hermes F35): slurs within a fifth (over a wider leap engravers let the stems change)
         link their notes and the whole beam groups they touch; each chain of linked notes takes one direction from
         its mean, when the chain stays within an octave (Humoresque: a slur inside each dotted pair and one from
         its semiquaver into the next pair) */
      var gOf = {}, par = {};
      groups.forEach(function (gr, gi) { if (gr.length > 1) gr.forEach(function (k) { gOf[k] = gi; }); });
      function root(k) { while (par[k] !== k) k = par[k]; return k; }
      function join(a, b) { if (par[a] === undefined) par[a] = a; if (par[b] === undefined) par[b] = b; a = root(a); b = root(b); if (a !== b) par[b] = a; }
      spans.forEach(function (sp) {
        var ks = heads.filter(function (k) { return k >= sp[0] && k <= sp[1] && !inf[k].nt.grace; });
        if (ks.length < 2) return;
        var up = ks.reduce(function (t, k) { return t + inf[k].mean; }, 0) / ks.length < 6;
        ks.forEach(function (k) { inf[k].up = up; });
        var steps = []; ks.forEach(function (k) { inf[k].members.forEach(function (j) { steps.push(inf[j].step); }); });
        if (Math.max.apply(null, steps) - Math.min.apply(null, steps) > 4 || !ks.some(function (k) { return gOf[k] !== undefined; })) return;
        ks.forEach(function (k) { join(ks[0], k); if (gOf[k] !== undefined) groups[gOf[k]].forEach(function (j) { join(ks[0], j); }); });
      });
      var chains = {};
      Object.keys(par).forEach(function (k) { k = +k; var r = root(k); (chains[r] = chains[r] || []).push(k); });
      Object.keys(chains).forEach(function (r) {
        var ks = chains[r], steps = [];
        ks.forEach(function (k) { inf[k].members.forEach(function (j) { steps.push(inf[j].step); }); });
        if (Math.max.apply(null, steps) - Math.min.apply(null, steps) > 7) return;   /* a chain wider than an octave: each part its own way */
        var up = ks.reduce(function (t, k) { return t + inf[k].mean; }, 0) / ks.length < 6;
        ks.forEach(function (k) { inf[k].up = up; if (gOf[k] !== undefined) groups[gOf[k]].slurUp = up; });
      });
    })();
    var beams = [];
    groups.forEach(function (gr, gi) {
      if (gr.length < 2) return;
      var mean = gr.reduce(function (t, k) { return t + inf[k].mean; }, 0) / gr.length, up = gr.slurUp !== undefined ? gr.slurUp : mean < 6, d = up ? -1 : 1;
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
      /* second beam between neighbouring semiquavers, a third between demisemiquavers; a short stub for one on its own */
      [[0.25, 7], [0.125, 14]].forEach(function (lv) {
        gr.forEach(function (k, i) {
          if (inf[k].len > lv[0] + 1e-6) return;
          var nx = gr[i + 1], pv = gr[i - 1];
          if (nx !== undefined && inf[nx].len <= lv[0] + 1e-6) b.push(bar(sx(k), sx(nx), lv[1]));
          else if (!(pv !== undefined && inf[pv].len <= lv[0] + 1e-6)) b.push(nx !== undefined ? bar(sx(k), sx(k) + 9, lv[1]) : bar(sx(k) - 9, sx(k), lv[1]));
        });
      });
      beams.push([x0, '<g class="mp-beams">' + b.join('') + '</g>']);
    });
    /* second pass: draw (a chord's stem, flags and beam belong to its first note) */
    var slurOpen = {}, slurItems = [], slurArcs = [];   /* slurArcs: [x0, x1, highest y] of slurs above the notes, for the free space over them */
    inf.forEach(function (f, k) {
      var hd = inf[f.head], isHead = f.head === k, chord = hd.members.length > 1;
      var nt = f.nt, y = f.y, hx = f.hx, step = f.step, len = f.len, up = hd.up, g = [];
      if (nt.grace) {   /* small, stem up, one flag; an acciaccatura's slash through it (Trix) */
        if (f.sign) g.push('<g class="acc" transform="translate(' + hx + ' ' + y + ') scale(.7) translate(' + (-hx) + ' ' + (-y) + ')">' + APP.accSvg(f.sign, hx - 12, y, S) + '</g>');
        for (var gl = 0; gl >= step; gl -= 2) g.push('<path class="ledger" d="M' + (hx - 6) + ' ' + yOf(gl) + 'h12"/>');
        for (gl = 12; gl <= step; gl += 2) g.push('<path class="ledger" d="M' + (hx - 6) + ' ' + yOf(gl) + 'h12"/>');
        var gsx = hx + 2.9, gtop = y - 2.2 * S;
        g.push('<ellipse class="head" cx="' + hx + '" cy="' + y + '" rx="3.3" ry="2.3" transform="rotate(-20 ' + hx + ' ' + y + ')"/>');
        g.push('<path class="stem" d="M' + gsx + ' ' + (y - 1) + 'V' + gtop + '"/>');
        g.push('<path class="flag" d="M' + gsx + ' ' + gtop + 'c.6 3 4.6 4.2 3.5 8.8c.6-3.5-1.8-5.3-3.5-5.9z"/>');
        if (nt.grace === 'acc') g.push('<path class="stem" d="M' + (hx - 1.5) + ' ' + (y - 0.6 * S) + 'L' + (hx + 7) + ' ' + (y - 1.8 * S) + '"/>');
        inf[k].top = gtop - 4;   /* a grace note's stem and flag take the space over it (Trix: Ⅲ on a grace note) */
        items.push([hx, '<g class="mp-n mp-grace" data-k="' + k + '" style="--hue:' + hueOf(nt) + '">' + g.join('') + '</g>']);
        return;
      }
      if (f.sign) g.push('<g class="acc">' + APP.accSvg(f.sign, hx - 14, y, S) + '</g>');
      for (var l = 0; l >= step; l -= 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      for (l = 12; l <= step; l += 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      var hollow = len >= 2, stem = len < 4, dotted = len === 3 || len === 1.5 || len === 0.75 || len === 0.375;
      var flags = hd.beam >= 0 ? 0 : hd.len <= 0.125 ? 3 : hd.len <= 0.25 ? 2 : hd.len < 1 ? 1 : 0;
      g.push('<ellipse class="' + (hollow ? 'head hollow' : 'head') + '" cx="' + hx + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + hx + ' ' + y + ')"/>');
      if (stem && isHead) {
        var sx = up ? hx + 4.9 : hx - 4.9, sy = hd.beam >= 0 ? hd.tip : up ? hd.yTop - 3.4 * S : hd.yBot + 3.4 * S, sy0 = up ? hd.yBot : hd.yTop;
        g.push('<path class="stem" d="M' + sx + ' ' + (sy0 + (up ? -1 : 1)) + 'V' + sy + '"/>');
        if (nt.trem) for (var tq = 0; tq < nt.trem; tq++) {   /* tremolo: slashes across the stem, between head and tip */
          var ty0 = sy0 + (sy - sy0) * 0.55 + (up ? 1 : -1) * tq * 4.5;
          g.push('<path class="trem" d="M' + (sx - 4) + ' ' + (ty0 + 1.6) + 'L' + (sx + 4) + ' ' + (ty0 - 1.6) + '"/>');
        }
        for (var q = 0; q < flags; q++) {
          var fy = sy + (up ? 1 : -1) * q * 7, d = up ? 1 : -1;
          g.push('<path class="flag" d="M' + sx + ' ' + fy + 'c1 ' + (5 * d) + ' 8 ' + (7 * d) + ' 6 ' + (15 * d) + 'c1 ' + (-6 * d) + ' -3 ' + (-9 * d) + ' -6 ' + (-10 * d) + 'z"/>');
        }
      }
      /* articulations (MusicXML, Trix): staccato, tenuto, accents at the head away from the stem; bowings, +, fermata
         above everything */
      var arts = isHead ? (nt.art || []) : [], above = !(stem && up), ay = (above ? (chord ? hd.yTop : y) - 10 : (chord ? hd.yBot : y) + 10), nearN = 0;
      arts.forEach(function (a) {
        var d = null, yy = ay;
        if (a === 'staccato' || a === 'spiccato') d = '<circle class="artd" cx="' + hx + '" cy="' + yy + '" r="1.7"/>';
        else if (a === 'staccatissimo') d = '<path class="artd" d="M' + (hx - 2.2) + ' ' + (yy - 3) + 'H' + (hx + 2.2) + 'L' + hx + ' ' + (yy + 3) + 'Z"/>';
        else if (a === 'tenuto') d = '<path class="art" d="M' + (hx - 5) + ' ' + yy + 'h10"/>';
        else if (a === 'accent') d = '<path class="art" d="M' + (hx - 5) + ' ' + (yy - 3.2) + 'L' + (hx + 5) + ' ' + yy + 'L' + (hx - 5) + ' ' + (yy + 3.2) + '"/>';
        else if (a === 'strong-accent') d = '<path class="art" d="M' + (hx - 4) + ' ' + (yy + 3) + 'L' + hx + ' ' + (yy - 4) + 'L' + (hx + 4) + ' ' + (yy + 3) + '"/>';
        if (d) { g.push(d); ay += above ? -7 : 7; nearN++; }
      });
      /* fingering, in the string colour, on the side of the note away from the stem (Trix); past any articulation */
      var fg = fingerOf(nt), topY = Math.min(y - 9, Y0 - 5);
      if (fg !== null && !nt._fs && nt.xfg === undefined) fg = null;   /* the chosen density (FG_LEVEL) */
      if (above && nearN) topY = Math.min(topY, ay - 1);
      /* a note so high that its fingering above would climb into the position numeral's row (or out of the system):
         the fingering goes below the staff instead (Hermes F66) */
      var fgBelow = !opts.paged && fg !== null && !chord && !(stem && up) && topY < 16;   /* the pages have room above: the numeral rises instead */
      if (fg !== null) {
        if (chord) g.push('<text class="fing side" x="' + (hx + (up ? -15 : 9)) + '" y="' + f.fy + '">' + fg + '</text>');   /* beside each note of a chord, spaced apart */
        else { var fgy = Math.max(opts.paged ? -16 : 10, (stem && up) || fgBelow ? Math.max(y + 17, BOT + 13, nearN && !above ? ay + 9 : 0) : topY); g.push('<text class="fing" x="' + hx + '" y="' + fgy + '">' + fg + '</text>'); if (fgy > BOT) lowInk.push([hx, fgy]); }
      }
      var upY = Math.min(stem && up ? (hd.beam >= 0 ? hd.tip : hd.yTop - 3.4 * S) : topY - (fg !== null && !chord && !fgBelow ? 12 : 0), Y0) - 7;
      arts.forEach(function (a) {   /* above the note and its fingering */
        var by = Math.max(opts.paged ? -34 : 8, upY), d = null;   /* the pages have room above a system (Trix: tr sat on the fingering of Winter's high notes) */
        if (a === 'down-bow') d = '<path class="art bow" d="M' + (hx - 5) + ' ' + (by + 4) + 'V' + (by - 3) + 'H' + (hx + 5) + 'V' + (by + 4) + '"/>';
        else if (a === 'up-bow') d = '<path class="art" d="M' + (hx - 4) + ' ' + (by - 4) + 'L' + hx + ' ' + (by + 4) + 'L' + (hx + 4) + ' ' + (by - 4) + '"/>';
        else if (a === 'stopped') d = '<path class="art" d="M' + (hx - 4) + ' ' + by + 'h8M' + hx + ' ' + (by - 4) + 'v8"/>';
        else if (a === 'trill-mark') {
          d = '<text class="mp-tr" x="' + hx + '" y="' + (by + 4) + '">tr</text>';
          var oa = { sharp: '#', flat: 'b', natural: 'n' }[nt.oacc];
          if (oa) d += '<g class="acc" transform="translate(' + (hx + 12) + ' ' + (by - 3) + ') scale(.6) translate(' + (-(hx + 12)) + ' ' + (-(by - 3)) + ')">' + APP.accSvg(oa, hx + 12, by - 3, S) + '</g>';
        }
        else if (/mordent/.test(a)) {   /* as the Symbols page draws it: a bold sharp zigzag (two peaks, three when long); the lower mordent has a thin line through */
          var pk = /-long$/.test(a) ? 3 : 2, mw = pk * 8, mx = hx - mw / 2, zz = 'M' + mx + ' ' + (by + 2);
          for (var zi = 0; zi < pk; zi++) zz += 'l4 -6l4 6';
          d = '<path class="orn-z" d="' + zz + '"/>' + (/^mordent/.test(a) ? '<path class="orn-l" d="M' + hx + ' ' + (by - 8) + 'V' + (by + 6) + '"/>' : '');
        }
        else if (/turn$/.test(a)) {   /* the Symbols page's turn, scaled to the score; the inverted turn has a line through */
          var tsx = hx - 8, tsy = by - 1, T = function (x, y) { return (tsx + x * 0.8).toFixed(1) + ' ' + (tsy + y * 0.8).toFixed(1); };
          d = '<path class="orn-t" d="M' + T(6, -1.5) + 'C' + T(4, -5) + ' ' + T(0.5, -1) + ' ' + T(3.5, 2) + 'C' + T(6.5, 4.5) + ' ' + T(13.5, -4.5) + ' ' + T(16.5, -2) + 'C' + T(19.5, 1) + ' ' + T(16, 5) + ' ' + T(14, 1.5) + '"/>' + (a === 'inverted-turn' ? '<path class="orn-l" d="M' + hx + ' ' + (by - 7) + 'V' + (by + 6) + '"/>' : '');
        }
        else if (a === 'fermata') d = '<path class="art" d="M' + (hx - 7) + ' ' + (by + 3) + 'A7 6 0 0 1 ' + (hx + 7) + ' ' + (by + 3) + '"/><circle class="artd" cx="' + hx + '" cy="' + (by + 1.5) + '" r="1.5"/>';
        if (d) { g.push(d); upY -= /mordent|turn/.test(a) ? 16 : 10; }   /* a mordent's line and a turn reach higher */
      });
      inf[k].top = upY + 4;   /* the lowest baseline a mark above this note can use: over its stem, fingering and bowings */
      /* slurs: an arc from the note it starts on to the one it ends on, on the heads' side away from the stems */
      (isHead ? nt.slur || [] : []).forEach(function (sl) {
        if (sl.t === 'start') slurOpen[sl.n] = { x: hx, top: chord ? hd.yTop : y, bot: chord ? hd.yBot : y, above: !up };
        else if (sl.t === 'stop' && slurOpen[sl.n]) {
          var o = slurOpen[sl.n]; delete slurOpen[sl.n];
          var x0 = o.x + 3, x1 = hx - 3, ab = o.above;
          if (x1 - x0 < 6) return;
          var y0 = ab ? o.top - 8 : o.bot + 8, y1 = ab ? (chord ? hd.yTop : y) - 8 : (chord ? hd.yBot : y) + 8;
          var cy = (ab ? Math.min(y0, y1) : Math.max(y0, y1)) + Math.min(14, 4 + (x1 - x0) / 10) * (ab ? -1 : 1);
          slurItems.push([o.x, '<path class="slur" d="M' + x0 + ' ' + y0 + 'C' + (x0 + (x1 - x0) * 0.25) + ' ' + cy + ' ' + (x0 + (x1 - x0) * 0.75) + ' ' + cy + ' ' + x1 + ' ' + y1 + '"/>']);
          if (ab) slurArcs.push([o.x, hx, Math.min(y0, y1) + 0.75 * (cy - Math.min(y0, y1))]);   /* the curve's highest point (both control points at cy) */
        }
      });
      if (nt.harm) {   /* a harmonic: a small o over the note, above the fingering, or over an up stem's tip (Trix) */
        var oy = stem && up ? (hd.beam >= 0 ? hd.tip : hd.yTop - 3.4 * S) - 7 : Math.min(y - 9, Y0 - 5) - (fg !== null && !chord ? 12 : 0);
        g.push('<circle class="harm" cx="' + hx + '" cy="' + Math.max(5, oy) + '" r="2.7"/>');
        inf[k].top = Math.min(inf[k].top, Math.max(5, oy) - 4);
      }
      var pzPrev = k > 0 && !!inf[k - 1].nt.pz;
      if (isHead && !!nt.pz !== pzPrev && (nt.pz || k > 0)) {   /* pizz. / arco where the playing changes (Trix): just over the note's fingering and bowings, never cut off at the strip's top */
        var wy = Math.max(15, inf[k].top - 1);
        g.push('<text class="mp-word" x="' + (hx - 6) + '" y="' + wy + '">' + (nt.pz ? 'pizz.' : 'arco') + '</text>');
        inf[k].top = Math.min(inf[k].top, wy - 13);   /* a position numeral goes above it */
      }
      if (dotted) g.push('<circle class="dot" cx="' + (hx + 9) + '" cy="' + (step % 2 === 0 ? y - S / 2 : y) + '" r="1.7"/>');
      items.push([hx, '<g class="mp-n" data-k="' + k + '" style="--hue:' + hueOf(nt) + '">' + g.join('') + '</g>']);
      /* the rest of a long note: tied heads at their beats (no fingering or marks), each tie on the side away from the stem */
      if (nt.pcs) {
        var px = hx;
        nt.pcs.slice(1).forEach(function (pc) {
          var cx2 = xAt(pc.b), cg = [], pl = pc.len, cStem = pl < 4, cUp = chord ? up : step < 6;
          for (var l2 = 0; l2 >= step; l2 -= 2) cg.push('<path class="ledger" d="M' + (cx2 - 9) + ' ' + yOf(l2) + 'h18"/>');
          for (l2 = 12; l2 <= step; l2 += 2) cg.push('<path class="ledger" d="M' + (cx2 - 9) + ' ' + yOf(l2) + 'h18"/>');
          cg.push('<ellipse class="' + (pl >= 2 ? 'head hollow' : 'head') + '" cx="' + cx2 + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + cx2 + ' ' + y + ')"/>');
          if (cStem) {
            var csx = cUp ? cx2 + 4.9 : cx2 - 4.9, csy = cUp ? y - 3.4 * S : y + 3.4 * S;
            cg.push('<path class="stem" d="M' + csx + ' ' + (y + (cUp ? -1 : 1)) + 'V' + csy + '"/>');
            var cf = pl <= 0.125 ? 3 : pl <= 0.25 ? 2 : pl < 1 ? 1 : 0, cd = cUp ? 1 : -1;
            for (var cq = 0; cq < cf; cq++) { var cfy = csy + cd * cq * 7; cg.push('<path class="flag" d="M' + csx + ' ' + cfy + 'c1 ' + (5 * cd) + ' 8 ' + (7 * cd) + ' 6 ' + (15 * cd) + 'c1 ' + (-6 * cd) + ' -3 ' + (-9 * cd) + ' -6 ' + (-10 * cd) + 'z"/>'); }
          }
          if (pl === 3 || pl === 1.5 || pl === 0.75 || pl === 0.375) cg.push('<circle class="dot" cx="' + (cx2 + 9) + '" cy="' + (step % 2 === 0 ? y - S / 2 : y) + '" r="1.7"/>');
          var tUp = cStem ? !cUp : !up, ty = y + (tUp ? -6 : 6), tb = tUp ? -5 : 5;   /* the tie on the side away from the stem */
          var tx0 = px + 7, tx1 = cx2 - 7;
          cg.push('<path class="slur tie" d="M' + tx0 + ' ' + ty + 'C' + (tx0 + (tx1 - tx0) * 0.3) + ' ' + (ty + tb) + ' ' + (tx0 + (tx1 - tx0) * 0.7) + ' ' + (ty + tb) + ' ' + tx1 + ' ' + ty + '"/>');
          items.push([cx2, '<g class="mp-n mp-cont" data-c="' + k + '" style="--hue:' + hueOf(nt) + '">' + cg.join('') + '</g>']);
          px = cx2;
        });
      }
    });
    /* a slur arching above the notes takes the space over every note under it (Trix: Ⅲ and its dashes ran into slurs) */
    slurArcs.forEach(function (a) { inf.forEach(function (f) { if (f.hx >= a[0] - 2 && f.hx <= a[1] + 2) f.top = Math.min(f.top === undefined ? Y0 - 7 : f.top, a[2] - 4); }); });
    /* tuplets (Hermes F52): a run of tuplet notes is complete when its written values add up to its count times the
       shortest of them (three quavers; crotchet + quaver; five semiquavers); a "3" (or "5") on its beam side, with a
       bracket when the run is not one beamed group */
    (function () {
      var run = null, runs = [];
      heads.forEach(function (k) {
        var f = inf[k];
        if (f.nt.grace) return;
        if (!f.nt.tup) { run = null; return; }
        if (!run || run.n !== f.nt.tup) { run = { n: f.nt.tup, ks: [], w: 0, min: 9 }; runs.push(run); }
        run.ks.push(k); run.w += f.len; run.min = Math.min(run.min, f.len);
        if (run.w >= run.n * run.min - 1e-6) run = null;
      });
      runs.forEach(function (r) {
        /* on the beam (stem) side, as printed music has it (Trix): above the beam when the stems go up, below it when
           they go down; a fingering is on the other side of the note then */
        var k0 = r.ks[0], k1 = r.ks[r.ks.length - 1], x0 = inf[k0].hx - 4, x1 = inf[k1].hx + 4, up = inf[k0].up;
        var end = function (k) { var h = inf[k]; return h.beam >= 0 ? h.tip : up ? h.yTop - 3.4 * S : h.yBot + 3.4 * S; };
        var y = up ? Math.min.apply(null, r.ks.map(end)) - 5 : Math.max.apply(null, r.ks.map(end)) + 13;
        var beamed = r.ks.every(function (k) { return inf[k].beam >= 0 && inf[k].beam === inf[k0].beam; }) && r.ks.length > 1, xm = (x0 + x1) / 2, g = '';
        if (!beamed) {
          var by = up ? y - 4 : y - 4, hk = up ? 5 : -5;
          g += '<path class="tup-br" d="M' + x0 + ' ' + (by + hk) + 'V' + by + 'H' + (xm - 6) + 'M' + (xm + 6) + ' ' + by + 'H' + x1 + 'V' + (by + hk) + '"/>';
        }
        g += '<text class="tup-n" x="' + xm + '" y="' + y + '">' + r.n + '</text>';
        items.push([x0, '<g class="mp-tup">' + g + '</g>']);
        if (up) r.ks.forEach(function (k) { inf[k].members.forEach(function (j) { inf[j].top = Math.min(inf[j].top === undefined ? Y0 - 7 : inf[j].top, y - 11); }); });
      });
    })();
    var passages = [];
    items = items.concat(beams, slurItems, posMarks(sg, inf, xAt, bars, passages, !!opts.paged));
    /* dynamics, hairpins and words under the staff (MusicXML, Trix) */
    var DY = BOT + 41, wedge = null, lastDynX = -99, lastTempo = null;
    function wordY(x, text) {   /* the words row, lowered under a fingering that reaches it (Trix: "molto rall." on a 1) */
      var w = text.length * 6.2, yy = DY - 1;
      lowInk.forEach(function (f) { if (f[0] > x - 8 && f[0] < x + w + 4) yy = Math.max(yy, f[1] + 14); });
      return yy;
    }   /* below any fingering under the notes */
    (sg.marks || []).forEach(function (m) {
      var x = xAt(m.beat);
      if (m.kind === 'breath') {   /* a comma above the top line just before the next note; a caesura: two slanted strokes on it */
        var bx = x - 13, byy = Y0 - 10;
        items.push([bx, m.text === 'caesura'
          ? '<path class="art breath" d="M' + (bx - 4) + ' ' + (Y0 + 4) + 'l5 -12M' + (bx + 1) + ' ' + (Y0 + 4) + 'l5 -12"/>'
          : '<circle class="artd" cx="' + bx + '" cy="' + byy + '" r="2.6"/><path class="art breath" d="M' + (bx + 2.3) + ' ' + (byy + 0.4) + 'q0.4 3.8 -3.4 6.4"/>']);
        return;
      }
      if (m.kind === 'tempo') {   /* a new tempo above the staff, like the opening's (Trix): over its notes' fingerings, bowings and position numerals */
        var tw = (m.text ? m.text.length * 9 + 4 : 0) + 72, ty = Y0 - 24, tx = x - 4;   /* tw: the ink's width, measured: 9 a letter + ♩ = N */
        inf.forEach(function (f) { if (f.hx > x - 10 && f.hx < x + tw && f.top !== undefined) ty = Math.min(ty, f.top - 6); });
        passages.forEach(function (p) { if (p.x0 < x + tw && p.x1 > x - 10) ty = Math.min(ty, p.y - 22); });
        ty = Math.max(opts.paged ? -22 : 6, ty);
        if (lastTempo && tx < lastTempo.end + 10) { tx = lastTempo.end + 10; ty = Math.min(ty, lastTempo.y); }   /* two changes close together: the second after the first, on its line */
        lastTempo = { end: tx + tw, y: ty };
        items.push([x, '<text class="mp-tempo" data-w="' + tw + '" x="' + tx + '" y="' + ty + '">' + (m.text ? '<tspan class="tw">' + m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</tspan> ' : '') + '♩ = ' + m.bpm + '</text>']);
        return;
      }
      if (m.kind === 'dyn') { items.push([x, '<text class="mp-dyn" x="' + (x - 4) + '" y="' + DY + '">' + m.text + '</text>']); lastDynX = x; }
      else if (m.kind === 'words' && posWord(m.text)) return;   /* drawn as a position mark (posMarks) */
      else if (m.kind === 'words') items.push([x, '<text class="mp-word" x="' + (Math.abs(x - lastDynX) < 1 ? x + 22 : x - 4) + '" y="' + wordY(Math.abs(x - lastDynX) < 1 ? x + 22 : x - 4, m.text) + '">' + m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>']);
      else if (m.text === 'stop') {
        if (!wedge) return;
        var x0 = wedge.x + (Math.abs(wedge.x - lastDynX) < 1 ? 18 : 0), x1 = Math.max(x0 + 16, x - 4), yc = DY - 5, op = wedge.cresc;
        items.push([x0, '<path class="art" d="M' + (op ? x1 : x0) + ' ' + (yc - 4.5) + 'L' + (op ? x0 : x1) + ' ' + yc + 'L' + (op ? x1 : x0) + ' ' + (yc + 4.5) + '"/>']);
        wedge = null;
      } else wedge = { x: x, cresc: m.text === 'crescendo' };
    });
    /* the clef area at a beat (a later system on the pages, the strip as it scrolls): the key then, and the time */
    function headAt(b, ts) {
      var h = [keySig(sfAt(b), sfAt(b), 40)[0]];
      if (ts) { var t = sg.sig; (sg.bars || []).forEach(function (q) { if (q.ts && q.beat <= b + 1e-6) t = q.ts; }); h.push(out[head - 1].replace(/>\d+</, '>' + t.num + '<').replace(/(<\/text><text[^>]*>)\d+</, '$1' + t.den + '<')); }
      return h;
    }
    return { items: items, head: out.slice(0, head), headAt: headAt, sfAt: sfAt, nMax: nMax, X0: X0, W: W, xAt: xAt, bars: bars, passages: passages,
      tops: inf.map(function (f) { return [f.hx, f.top === undefined ? Y0 - 7 : f.top]; }) };   /* the free space over each note (the pages' tempo mark) */
  }
  function drawScore() {
    var r = scoreItems(song), items = r.items, i;
    X0 = r.X0; W = r.W; xAt = r.xAt;
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
    keySvg.innerHTML = kl + CLEF + r.head.join('');
    headKl = kl; headAt = r.headAt; headNow = r.head.join('');
    if (typeof placeAB === 'function') setTimeout(placeAB, 0);
    noteEls = [];
    Array.prototype.forEach.call(svg.querySelectorAll('.mp-n[data-k]'), function (el) { noteEls[+el.getAttribute('data-k')] = el; });
    /* a long note's tied heads light up and grey out with it (Trix: Ave Maria's tied note stayed black) */
    contObs.forEach(function (o) { o.disconnect(); }); contObs = [];
    var conts = {};
    Array.prototype.forEach.call(svg.querySelectorAll('.mp-cont[data-c]'), function (el) { (conts[el.getAttribute('data-c')] = conts[el.getAttribute('data-c')] || []).push(el); });
    Object.keys(conts).forEach(function (k) {
      var el = noteEls[+k]; if (!el || !window.MutationObserver) return;
      var o = new MutationObserver(function () { conts[k].forEach(function (c) { c.setAttribute('class', el.getAttribute('class') + ' mp-cont'); }); });
      o.observe(el, { attributes: true, attributeFilter: ['class'] }); contObs.push(o);
    });
  }
  var contObs = [], headKl = '', headAt = null, headNow = '';
  /* the strip's clef area follows a change of key or time as it scrolls past (Trix) */
  function headFollow(beat) {
    if (!headAt) return;
    var h = headAt(Math.max(0, beat), true).join('');
    if (h !== headNow) { headNow = h; keySvg.innerHTML = headKl + CLEF + h; }
  }
  /* the playhead sits a third of the way across; the score slides under it */
  function scroll() {
    if (!song) return;
    if (fgShown) fgHead();
    var bar = song.sig.num * 4 / song.sig.den;
    var beat = paBrowse != null && paCanBrowse() ? paBrowse : counting ? countBeat : pos < 0.01 && !playing ? -bar : song.toBeat(pos);   /* at the very start: the empty count-in bar; Play-along's result: where the strip was dragged to */
    var z = full ? (fsShort ? 0.8 : 1.4) : 1;   /* full screen: the score larger, easier to read (Trix); a phone on its side: smaller, for room; positions below are in score units */
    keySvg.style.transform = z !== 1 ? 'scale(' + z + ')' : '';
    var bo = song.barAt ? song.barAt(counting ? countBase : Math.max(beat, 0)) : null, bn = bo ? cornerBar(bo) : '';   /* counting in: the bar it leads into */   /* the bar under the playhead (Trix) */
    if (bn !== barNoEl.textContent) barNoEl.textContent = bn;
    headFollow(counting ? countBase : beat);
    var bt = '♩ = ' + Math.round(curBpm() * speed); if (bpmEl.textContent !== bt) bpmEl.textContent = bt;
    if (song.keyAt && boardKey !== null) {   /* a new key under the playhead: the fingerboard's key notes change with it */
      var kn = song.keyAt(Math.max(0, counting ? countBase : beat));
      if (kn.sf + (kn.minor ? 'm' : '') !== boardKey) { boardBeat = Math.max(0, counting ? countBase : beat); boardKey = kn.sf + (kn.minor ? 'm' : ''); APP.board.rekey(keySet(), kn.sf < 0); }   /* not fit(): that resets the board and silenced the notes sounding (Trix) */
    }
    var w = scoreEl.clientWidth / z, x = xAt(beat), hx = full ? X0 + 50 : Math.max(w * 0.36, X0 + 50);   /* full screen: the playhead at the left, just after the clef and key (Trix) */
    headEl.style.left = hx * z + 'px';
    /* half a beat early, so a note glows while it passes through the playhead rather than after it */
    var tx = Math.round(hx - x + 22);   /* may move right of the start: at rest the playhead sits at the empty bar, before the first note */
    svg.style.transform = (z !== 1 ? 'scale(' + z + ') ' : '') + 'translateX(' + tx + 'px)';
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
    if (!seekDrag) seek.value = end ? Math.round(pos / end * 1000) : 0;   /* not while a finger or the mouse holds it (Trix: after a drag it kept focus and stopped moving) */
    speedEl.textContent = Math.round(speed * 100) + '%';
    bpmEl.textContent = song ? '♩ = ' + Math.round(curBpm() * speed) : '';
    playBtn.setAttribute('aria-label', playing || counting ? 'Pause' : 'Play');
    playBtn.classList.toggle('on', playing || counting);
    var mpTab = document.querySelector('.tab[data-view="midi"]');
    if (mpTab) { mpTab.classList.toggle('live', playing || counting); mpTab.classList.toggle('blink', playing || counting); mpTab.setAttribute('aria-label', playing || counting ? 'MIDI Player (playing)' : 'MIDI Player'); }
    var fpb = $('fgPlay'); if (fpb) { fpb.classList.toggle('on', playing || counting); fpb.setAttribute('aria-label', playing || counting ? 'Pause' : 'Play'); fpb.title = playing || counting ? 'Pause' : 'Play'; }
    scoreEl.classList.toggle('playing', playing || counting);   /* tap-a-note only while paused */
    loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false');
    if (APP.fgxSync) APP.fgxSync();
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
    var k = Math.floor(song.toBeat(pos) / (4 / song.sig.den) + 1e-6);   /* the beat is tracked even at 0, so raising the fader clicks from the next beat */
    if (k > lastTick) { lastTick = k; if (pos < song.end && mix.m > 0 && !paMute) APP.board.click(k % song.sig.num === 0, mix.m); }
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
      APP.board.hand(ns[ni].hand);   /* before on(): a new position centres the board first */
      APP.board.on(ns[ni].m, 'n' + ni, !quick && !paMute, ns[ni].si, ns[ni].b, paMute, toneOf(ns[ni]), lvlOf(ns[ni]));   /* a take without sound: lit, not sounded */   /* a harmonic sounds pure, pizzicato plucked */   /* its string, and its chord (both notes of a double stop stay lit) */
      noteEls[ni].classList.add('on');
      noteEls[ni].classList.toggle('quick', quick);
      active.push(ni); ni++;
    }
    /* the board keeps one note per string; drop the ones it replaced */
    active = active.filter(function (k) { if (APP.board.has('n' + k)) return true; noteEls[k].classList.remove('on'); noteEls[k].classList.add('done'); return false; });
    scroll(); ui();
    var rr = abRange();
    if (rr && pos >= rr.eT - 0.005) { seekTo(rr.aT); playing = false; countIn(go, rr.aB); return; }   /* A–B: round again from A, after the count-in (Trix) */
    if (paTake && (pos >= song.end + 1 || pos >= 600)) { paStop(); return; }   /* a take ends with the piece (a second after its last note), or at 10 minutes */
    if (pos >= song.end && !active.length && !paTake) {
      if (!loop) { pause(); seekTo(song.end); return; }
      seekTo(0); playing = false; countIn(go); return;   /* round again, after the count-in */
    }
    raf = requestAnimationFrame(frame);
  }
  /* count-in (Trix): one bar of the time signature counted down (3 2 1 in 3/4, 4 3 2 1 in 4/4) with a click
     on each beat, at the tune's tempo and the chosen speed; when starting from the beginning, and before each
     round of Loop; resuming after a pause plays straight on */
  /* the tempo where the music is now, as marked (Trix: the readout follows a change of tempo) */
  function curBpm() { return song.bpmAt ? song.bpmAt(Math.max(0, counting ? countBase : song.toBeat(pos))) : song.bpm; }
  var counting = false, countT = 0, countEl = $('mpCount'), countBeat = 0, countBase = 0;
  function countIn(then, base) {   /* base: the beat it leads into (A–B: bar A), else the start */
    base = base || 0; countBase = base;
    var n = song.sig.num, k = n, step = 60 / (song.bpmAt ? song.bpmAt(base) : song.bpm) * 4 / song.sig.den / speed * 1000;   /* at the tempo of where it leads (Trix: A–B in a slower passage) */
    var bar = n * 4 / song.sig.den, t0 = performance.now();
    counting = true; countBeat = base - bar; ui();
    (function slide() {   /* the score moves through the empty bar in time with the count */
      if (!counting) return;
      countBeat = base - bar * Math.max(0, 1 - (performance.now() - t0) / (n * step));
      scroll();
      requestAnimationFrame(slide);
    })();
    (function beat() {
      if (!counting) return;
      if (k === 0) { counting = false; countEl.hidden = true; then(); return; }
      if (!paMute) APP.board.click(k === n);
      countEl.textContent = k; countEl.hidden = false;
      fgFlash('count', k);   /* the count on the Fingerings page too (Trix) */
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
    if (show.length) APP.board.hand(ns[show[0]].hand);
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
      APP.board.on(nt.m, 'n' + k, (nt.e - nt.t) / speed >= 0.25, nt.si, nt.b, false, toneOf(nt), lvlOf(nt));
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
    clearTimeout(partsT); partsEl.hidden = true; partsEl.classList.remove('show');   /* the parts note never covers the count-in; the screen-reader copy keeps it (Hermes F29) */
    var r = abRange();
    if (r) {   /* A–B: from bar A (outside the passage: back to A), counting in at A */
      if (pos < r.aT - 0.01 || pos >= r.eT - 0.01) seekTo(r.aT);
      if (Math.abs(pos - r.aT) < 0.01) countIn(go, r.aB); else go();
      return;
    }
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
  /* which part is the violin and which play along (Trix): a flash over the score that fades, taking no room;
     also said once to screen readers (the score itself is hidden from them) */
  var partsEl = $('mpParts'), partsSr = $('mpPartsSr'), partsT = 0;
  function flashParts() {
    clearTimeout(partsT); partsEl.classList.remove('show'); partsEl.hidden = true; partsSr.textContent = '';
    if (!song || (!song.acc.length && !song.dropped.length)) return;
    var zh = window.I18N && I18N.lang === 'zh', lv = zh ? '小提琴' : 'Violin', la = zh ? '伴奏' : 'Accompaniment';   /* the score is translate="no" */
    var v = song.soloName || (zh ? '第 1 声部' : 'Part 1'), a = song.accNames.join(zh ? '、' : ', ');
    var ld = zh ? '已略去' : 'Left out', d = song.dropped.join(zh ? '、' : ', ');
    $('mpPartsLV').textContent = lv; $('mpPartsLA').textContent = la; $('mpPartsLD').textContent = ld;
    $('mpPartsV').textContent = v; $('mpPartsA').textContent = a; $('mpPartsD').textContent = d;
    $('mpPartsA').parentNode.hidden = !a; $('mpPartsD').parentNode.hidden = !d;
    partsEl.hidden = false; void partsEl.offsetWidth; partsEl.classList.add('show');
    partsSr.textContent = lv + (zh ? '：' : ': ') + v + (zh ? '。' : '. ') + (a ? la + (zh ? '：' : ': ') + a + (zh ? '。' : '. ') : '') + (d ? ld + (zh ? '：' : ': ') + d + (zh ? '。' : '.') : '');
    partsT = setTimeout(function () { partsEl.hidden = true; partsEl.classList.remove('show'); }, 2700);
  }
  function load(i) {
    pause();
    song = songs[i].song; boardBeat = 0;
    if (song && !song.composer && songs[i].demo && songs[i].demo.c) song.composer = songs[i].demo.c;   /* a built-in MIDI names no composer: the list does */
    delBtn.hidden = !songs[i].kept;   /* the bin only for an imported file */
    /* the tune and its composer under the heading (Trix); the title is translated, the name never */
    subEl.textContent = '';
    var tSp = document.createElement('span'); tSp.textContent = songs[i].title; subEl.appendChild(tSp);
    if (song && song.composer) { var cSp = document.createElement('span'); cSp.setAttribute('translate', 'no'); cSp.className = 'sub-comp'; cSp.textContent = ' · ' + song.composer; subEl.appendChild(cSp); }
    if (!song) {   /* a built-in tune not downloaded yet (Android app): an empty score until it arrives */
      svg.innerHTML = ''; keySvg.innerHTML = ''; noteEls = []; chunks = [];
      seekTo(0); flashParts(); mixUi();
      var s = songs[i];
      if (s.failed) { autoPlay = -1; s.failed = false; say(s.err || 'This tune downloads the first time you play it. Connect to the internet and choose it again.', true); }
      else { say(s.have ? 'Opening the score…' : 'Downloading this tune…'); fetchDemo(i); }   /* a long score (Serenade) takes a few seconds on a phone */   /* choosing it again tries again; a built-in one is being read (a moment) */
      if (shown) fit();
      if (APP.fgSync) APP.fgSync();
      return;
    }
    drawScore();
    ab = null; abUi(); setABOpen(false);
    seekTo(0);
    var warn = [];
    if (song.low) warn.push(song.low + (song.low > 1 ? ' notes are' : ' note is') + ' below the violin’s G string and left out.');
    if (song.high) warn.push(song.high + (song.high > 1 ? ' notes are' : ' note is') + ' above the fingerboard shown: heard, not lit.');
    flashParts();
    say(warn);
    mixUi();
    APP.board.toTop();   /* a new tune opens at the open strings, whatever the last one scrolled to (Hermes F14) */
    if (shown) fit();
    if (APP.fgSync) APP.fgSync();   /* the Fingerings pages follow the current tune */
    settle();   /* and once more when it has settled (an iPhone left the board short) */
    if (autoPlay === i) { autoPlay = -1; if (shown && !paOn) setTimeout(function () { if (+songSel.value === i && !playing && !counting) play(); }, 60); }
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
    /* imported files first, newest at the top, then the built-ins (Trix); values stay indexes into songs */
    var order = songs.map(function (s, i) { return i; });
    order = order.filter(function (i) { return !songs[i].demo; }).reverse().concat(order.filter(function (i) { return songs[i].demo; }));
    order.forEach(function (i) {
      var s = songs[i], o = document.createElement('option');
      o.value = i; o.textContent = s.kept ? s.title + tag : s.title;
      if (s.kept) o.setAttribute('translate', 'no');   /* a file name stays as it is in 中文; the tag is set here */
      songSel.appendChild(o);
    });
    if (v !== '') songSel.value = v;
    if (APP.fgSync) APP.fgSync();   /* the Fingerings list is the same list */
  }
  document.addEventListener('i18n', options);   /* language switched: relabel [imported] */
  function fromB64(b64) { var bin = atob(b64), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; }
  function toB64(buf) { var u8 = new Uint8Array(buf), s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  /* built-in tunes: in the Android app (Trix) they are not packed in; each is a placeholder ({ title, f, h }) that
     is downloaded from the website the first time it is chosen, then kept on the phone (violin-midi-demo:<file>) */
  var DEMO_URL = 'https://trix69.github.io/violin-toolkit/src/midi/', DEMO_KEY = 'violin-midi-demo:';
  /* a tune may be MIDI or MusicXML (.mxl, unzipped in the background: Trix's built-ins since 1.38); built in (b64),
     kept on the phone (violin-midi-demo:<file>, the phone apps) or downloaded the first time it is chosen */
  function scoreBytes(buf) { return isZip(new Uint8Array(buf)) ? unzipScore(buf) : Promise.resolve(buf); }
  DEMOS.forEach(function (d) {
    var s = { title: d.title, song: null, kept: null, demo: d, have: d.b64 || null };
    if (!s.have) { try { var c = JSON.parse(localStorage.getItem(DEMO_KEY + d.f) || 'null'); if (c && c.h === d.h) { s.have = c.b64; s.saved = true; } } catch (e) {} }
    songs.push(s);   /* read when first chosen (Serenade's score is 3.7 MB: not on every launch) */
  });
  options();
  function prepDemo(s) {   /* its bytes are here: read it */
    s.fetching = true;
    scoreBytes(fromB64(s.have)).then(function (b) { s.song = parse(b); })
      .catch(function (e) { s.err = e && e.mine ? e.message : null; console.error('MIDI player: built-in tune', s.demo.f, e); })
      .then(function () { s.fetching = false; var k = songs.indexOf(s); if (+songSel.value === k) { s.failed = !s.song; load(k); } });
  }
  /* a tune saved on the phone is checked against the website's fingerprints first (Trix): when the website's piece has
     changed, it does not play until the app is updated. Offline (or no list yet) the saved copy plays. One fetch per visit */
  var fpList = null;
  function siteHashes() {
    /* at most 6 s (Hermes F74): a request that neither answers nor fails counts as offline, so the saved tune plays; the
       next visit asks again */
    if (!fpList) fpList = Promise.race([
      fetch(DEMO_URL + 'hashes.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }),
      new Promise(function (ok) { setTimeout(function () { ok('timeout'); }, 6000); })
    ]).then(function (m) { if (m === 'timeout') { fpList = null; return null; } return m; }, function () { fpList = null; return null; });
    return fpList;
  }
  var STALE = 'This tune has been updated. Update the app to play it.';
  function fetchDemo(i) {
    var s = songs[i], d = s.demo;
    if (s.fetching) return;
    if (s.have && s.saved && !s.checked) {
      s.fetching = true;
      siteHashes().then(function (m) {
        s.fetching = false;
        if (m && m[d.f] && m[d.f] !== d.h) { s.err = STALE; s.failed = true; if (+songSel.value === songs.indexOf(s)) load(songs.indexOf(s)); return; }
        if (m) s.checked = true;   /* checked once per visit; without the list (offline) it is asked again next time */
        prepDemo(s);
      });
      return;
    }
    if (s.have) { prepDemo(s); return; }
    s.fetching = true;
    fetch(DEMO_URL + encodeURIComponent(d.f), { cache: 'no-cache' }).then(function (r) {
      if (r.status === 404 || r.status === 410) throw new Error('stale');   /* gone from the website: only an updated app has it (Hermes F73) */
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      /* Hermes F42: keep a download only if its bytes are the build's (h = first 10 hex of their SHA-1). While the
         site still serves an older file, nothing is kept or shown, and the next choice tries again. Without
         crypto.subtle (no secure context) the check is skipped, as before. */
      var sub = window.crypto && crypto.subtle;
      return (sub ? sub.digest('SHA-1', buf).then(function (dg) {
        var hex = Array.prototype.map.call(new Uint8Array(dg), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
        if (hex.slice(0, d.h.length) !== d.h) throw new Error('stale');
      }) : Promise.resolve()).then(function () { return buf; });
    }).then(function (buf) {
      return scoreBytes(buf).then(function (b) {
        s.song = parse(b);
        try { localStorage.setItem(DEMO_KEY + d.f, JSON.stringify({ h: d.h, b64: toB64(buf) })); } catch (e) {}   /* no room: it downloads again next time */
      });
    }).catch(function (e) {
      /* the website has a newer version of this tune than this app knows (Trix: one version of each piece only):
         ask for the app update rather than offering an old copy */
      s.err = e && e.message === 'stale' ? STALE : e && e.mine ? e.message : null;
      console.error('MIDI tune download', d.f, e);
    }).then(function () {
      s.fetching = false;
      var k = songs.indexOf(s);
      if (+songSel.value === k) { s.failed = !s.song; load(k); }   /* still the chosen tune: show it, or say it failed */
    });
  }
  /* imported files are kept on this device until deleted with the bin button (Trix): violin-midi-files,
     a list of { id, name, b64 }; MIDI files are small (a few KB), well inside the storage limit */
  var KEEP = 'violin-midi-files', kept = [];
  try { kept = JSON.parse(localStorage.getItem(KEEP) || '[]'); if (!Array.isArray(kept)) kept = []; } catch (e) { kept = []; }
  /* MusicXML is kept gzip-compressed (z: 'gz'; a 3.6 MB score is ~0.2 MB), so it fits in the browser's storage */
  function zip(buf, back) { return new Response(new Blob([buf]).stream().pipeThrough(back ? new DecompressionStream('gzip') : new CompressionStream('gzip'))).arrayBuffer(); }
  kept = kept.filter(function (f) {
    if (f.z === 'gz') { if (typeof DecompressionStream === 'undefined') return true; zip(fromB64(f.b64), true).then(function (b) { addSong(f.name, b, f.id); }).catch(function (e) { console.error('MIDI player: kept file', e); }); return true; }
    try { addSong(f.name, fromB64(f.b64), f.id); return true; } catch (e) { return false; }
  });
  function saveKept() { try { localStorage.setItem(KEEP, JSON.stringify(kept)); return true; } catch (e) { return false; } }
  var delBtn = $('mpDel');
  /* delete an imported file, after asking (Trix): the player's bin and the Fingerings bin both come here */
  var ask = $('delAsk'), askGo = $('delAskGo'), askCancel = $('delAskCancel'), askBack = null;
  function closeAsk() { ask.hidden = true; window.removeEventListener('keydown', onAskKey, true); try { askBack.focus(); } catch (e) {} }
  function onAskKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeAsk(); }
    else if (e.key === 'Tab') { e.stopPropagation(); e.preventDefault(); (document.activeElement === askGo ? askCancel : askGo).focus(); }
  }
  askCancel.addEventListener('click', closeAsk);
  ask.addEventListener('click', function (e) { if (e.target === ask) closeAsk(); });
  askGo.addEventListener('click', function () {
    var i = +songSel.value, s = songs[i];
    closeAsk();
    if (!s || !s.kept) return;
    kept = kept.filter(function (f) { return f.id !== s.kept; });
    saveKept();
    songs.splice(i, 1);
    options();
    songSel.value = 0; load(0);
    try { askBack.focus(); } catch (e) {}
  });
  /* Replace or Cancel, when an import has the name of a kept file (Trix). Resolves true = replace. Escape, the backdrop
     and Cancel leave everything as it was */
  function askReplace(fname) {
    return new Promise(function (done) {
      var box = $('repAsk'), go = $('repAskGo'), keep = $('repAskCancel'), back = document.activeElement, zh = window.I18N && I18N.lang === 'zh';
      $('repAskMsg').textContent = zh ? '已经导入过“' + fname + '”。替换后，之前那份会从这台设备上删除，无法恢复。' : '“' + fname + '” is already imported. Replacing removes the earlier copy from this device. This can’t be undone.';
      function end(yes) {
        box.hidden = true; window.removeEventListener('keydown', key, true);
        go.removeEventListener('click', onGo); keep.removeEventListener('click', onKeep); box.removeEventListener('click', onBack);
        try { back.focus(); } catch (e) {}
        done(yes);
      }
      function onGo() { end(true); } function onKeep() { end(false); } function onBack(e) { if (e.target === box) end(false); }
      function key(e) {
        if (e.key === 'Escape') { e.stopPropagation(); end(false); }
        else if (e.key === 'Tab') { e.stopPropagation(); e.preventDefault(); (document.activeElement === go ? keep : go).focus(); }
      }
      go.addEventListener('click', onGo); keep.addEventListener('click', onKeep); box.addEventListener('click', onBack);
      box.hidden = false; window.addEventListener('keydown', key, true); keep.focus();
    });
  }
  APP.askDelete = function (back) {
    var s = songs[+songSel.value];
    if (!s || !s.kept) return;
    var rec = kept.filter(function (f) { return f.id === s.kept; })[0], zh = window.I18N && I18N.lang === 'zh', nm = (rec && rec.fn) || s.title;
    $('delAskMsg').textContent = zh ? '“' + nm + '”将从这台设备上删除，MIDI 播放器和指法谱中都不再有它。删除后无法恢复。' : '“' + nm + '” will be removed from this device, from both the MIDI player and Fingerings. This can’t be undone.';
    askBack = back; ask.hidden = false; window.addEventListener('keydown', onAskKey, true); askCancel.focus();
  };
  delBtn.addEventListener('click', function () { APP.askDelete(songSel); });
  /* a piece chosen from the player's list plays straight away, after the count-in (Trix); the sound engine is woken
     inside the tap (iPhone), the playing waits until the score is in (a built-in still downloading on the phone apps) */
  var autoPlay = -1;
  songSel.addEventListener('change', function () { autoPlay = +songSel.value; APP.board.prime(); load(+songSel.value); });
  /* Trix (iPhone): a board left short, cut after two rows, after choosing Winter; not reproduced. Measure the board
     again once the list's picker has closed and the tune has settled, and when the visible area changes (sizes only) */
  var settleT = [];
  function settle() {
    settleT.forEach(clearTimeout); settleT = [];
    [250, 800].forEach(function (ms) { settleT.push(setTimeout(function () { if (shown && !full && song) { APP.board.relayout(); scroll(); placeFull(); } }, ms)); });
  }
  songSel.addEventListener('blur', settle);
  songSel.addEventListener('change', settle);
  if (window.visualViewport) visualViewport.addEventListener('resize', function () { if (shown && !full) settle(); });
  /* only MIDI and MusicXML files (Trix). iPhone / iPad Safari greys out types iOS does not know (.mxl), so there the
     picker shows every file and a wrong one is turned away here; the iPhone app has its own picker with just these */
  var OK_EXT = /\.(mid|midi|musicxml|xml|mxl)$/i;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) fileIn.removeAttribute('accept');
  $('mpImport').addEventListener('click', function () {
    if (window.VTiOSApp && window.webkit && webkit.messageHandlers && webkit.messageHandlers.vt) { webkit.messageHandlers.vt.postMessage({ pick: true }); return; }
    fileIn.value = ''; fileIn.click();
  });
  /* the iPhone app hands the chosen file over as base64 */
  window.VTImport = function (fname, b64) {
    try { var bin = atob(b64), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); importBytes(fname, u.buffer); }
    catch (e) { console.error('MIDI import: app', e); say('This file could not be read.', true); }
  };
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { importBytes(f.name, rd.result); };
    rd.onerror = function () { console.error('MIDI import: read', rd.error); say('This file could not be read.', true); };   /* the reason, for the console (Hermes F16) */
    rd.readAsArrayBuffer(f);
  });
  function importBytes(fname, raw) {
      if (!OK_EXT.test(fname)) { say('Choose a MIDI or MusicXML file (.mid, .midi, .musicxml, .xml or .mxl).', true); return; }
      var name = fname.replace(/\.(mid|midi|smf|musicxml|xml|mxl)$/i, ''), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      /* a file with the name of a kept import: replacing cannot be undone, so it is asked first (Trix, UX-PRINCIPLES):
         Replace or Cancel; Cancel leaves everything as it was */
      var old = kept.filter(function (k) { return k.fn ? k.fn === fname : k.name === name; }).map(function (k) { return k.id; });
      if (old.length) { askReplace(fname).then(function (yes) { if (yes) readIt(); }); return; }
      readIt();
      function readIt() {
      /* a .mxl is a zip: its score first (MusicXML, Trix) */
      (isZip(new Uint8Array(raw)) ? unzipScore(raw) : Promise.resolve(raw)).then(function (buf) {
        var i;
        try { i = addSong(name, buf, id); }   /* reading the file: only a failure here means it could not be read */
        catch (e) { if (!e.mine) console.error('MIDI import', e); say(e.mine ? e.message : 'This file could not be read.', true); return; }
        var prevI = +songSel.value;
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
        /* keeping it for next time; a failure here only means not kept (Hermes F17). MusicXML is kept compressed */
        var xml = looksXml(new Uint8Array(buf)) && typeof CompressionStream !== 'undefined';
        var before = kept.slice();   /* restored if saving fails, so a failed re-import never loses the earlier copy (Hermes F54) */
        (xml ? zip(buf).then(function (z) { return { b64: toB64(z), z: 'gz' }; }) : Promise.resolve({ b64: toB64(buf) })).then(function (rec) {
          /* the same file imported again replaces its old copy (Trix): one entry in the list, and a copy kept before
             1.44 (no fn, so the Fingerings footer named it without its extension) is renewed */
          keepIt(rec, old);   /* old: the copies the user agreed to replace (asked before reading) */
        }).catch(function (e) {
          console.error('MIDI import: keep', e);
          kept = before; saveKept();   /* the earlier copy, if any, stays (Hermes F54) */
          say('This file plays now, but there is no room to keep it for next time.', true);
        });
        function keepIt(rec, old) {
          kept = kept.filter(function (k) { return old.indexOf(k.id) < 0; });
          kept.push({ id: id, name: name, fn: fname, b64: rec.b64, z: rec.z });   /* fn: the file's own name, for the Fingerings footer */
          if (!saveKept()) throw new Error('no room');
          if (old.length) {
            songs = songs.filter(function (s) { return !s.kept || old.indexOf(s.kept) < 0; });
            var now = songs.map(function (s) { return s.kept; }).indexOf(id);
            options(); if (now >= 0) songSel.value = now;
            if (window.APP && APP.fgSync) APP.fgSync();
            /* said, not silent (Hermes F53): a different file with the same name also replaces the copy */
            say(window.I18N && I18N.lang === 'zh' ? '已替换之前导入的“' + fname + '”。' : 'Replaced the earlier copy of “' + fname + '”.');
          }
        }
      }).catch(function (e) { if (!e.mine) console.error('MIDI import: unzip', e); say(e.mine ? e.message : 'This file could not be read.', true); });
      }
  }

  /* the mixer: a small panel above the controls with Violin and Accompaniment sliders */
  var mixBtn = $('mpMix'), mixPop = $('mpMixPop'), volV = $('mpVolV'), volA = $('mpVolA'), volM = $('mpVolM');
  function mixUi() {
    var none = !song || !song.acc.length;
    /* a one-part tune (Trix): the accompaniment fader sits at 0 and is disabled; the violin's still works. The saved
       level is kept for tunes that have an accompaniment. */
    volV.value = Math.round(mix.v * 100); volA.value = none ? 0 : Math.round(mix.a * 100);
    volA.disabled = none; $('mpMixNone').hidden = !none;
    volM.value = Math.round(mix.m * 100);
    $('mpVolVOut').textContent = volV.value + '%'; $('mpVolAOut').textContent = volA.value + '%'; $('mpVolMOut').textContent = volM.value + '%';
    APP.board.soloVolume(mix.v);
    if (accBus) accBus.gain.setTargetAtTime(mix.a, accBus.context.currentTime, 0.03);
  }
  function setMixOpen(open) {
    mixPop.hidden = !open; mixBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (APP.fgxSync) APP.fgxSync();
    if (open) volV.focus();
  }
  /* vibrato on the player's long notes (Trix): off by default; a note gets it once it has sounded ~0.3 s */
  var vibBtn2 = $('mpVib'), pvib = false;
  try { pvib = localStorage.getItem('violin-midi-vib') === 'on'; } catch (e) {}
  function vibUi() { vibBtn2.setAttribute('aria-checked', pvib ? 'true' : 'false'); $('mpVibTxt').textContent = pvib ? 'On' : 'Off'; if (APP.board.playerVib) APP.board.playerVib(pvib); }
  vibBtn2.addEventListener('click', function () { pvib = !pvib; try { localStorage.setItem('violin-midi-vib', pvib ? 'on' : 'off'); } catch (e) {} vibUi(); });
  vibUi();
  function saveMix() { try { localStorage.setItem('violin-midi-mix', JSON.stringify(mix)); } catch (e) {} }
  mixBtn.addEventListener('click', function (e) { e.stopPropagation(); setMixOpen(mixPop.hidden); });
  volV.addEventListener('input', function () { mix.v = volV.value / 100; mixUi(); saveMix(); });
  volA.addEventListener('input', function () { mix.a = volA.value / 100; mixUi(); saveMix(); });
  volM.addEventListener('input', function () { mix.m = volM.value / 100; mixUi(); saveMix(); });
  document.addEventListener('pointerdown', function (e) { if (!mixPop.hidden && !mixPop.contains(e.target) && !mixBtn.contains(e.target) && !(e.target.closest && e.target.closest('.fgx-mix'))) setMixOpen(false); }, true);
  mixPop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); setMixOpen(false); owner(mixBtn, mixPop).focus(); } });
  /* A–B (Trix): repeat a passage, from bar A to the end of bar B, counting in each time round. Off until it is set
     in its panel; bars picked from lists (a scrolling wheel on phones); A empty = the beginning, B empty = the end;
     B at least one bar after A */
  var ab = null, abBtn = $('mpAB'), abPop = $('mpABPop'), selA = $('mpA'), selB = $('mpB');
  function abRange() {
    if (!ab || !song || !song.bars) return null;
    var bars = song.bars, aB = ab.a >= 0 && bars[ab.a] ? bars[ab.a].beat : 0, nx = ab.b >= 0 ? bars[ab.b + 1] : null;
    return { aB: aB, aT: song.beatSec(aB), eB: nx ? nx.beat : song.beats, eT: nx ? song.beatSec(nx.beat) : song.end };
  }
  /* the corner: the bar number, and from the second time round a repeated bar which time it is (Trix: "1 (2nd time)") */
  function cornerBar(b) {
    if (!b.rep || b.time < 2) return b.num;
    return window.I18N && I18N.lang === 'zh' ? b.num + '（第 ' + b.time + ' 遍）' : b.num + ' (' + b.time + (['', 'st', 'nd', 'rd'][b.time] || 'th') + ' time)';
  }
  document.addEventListener('i18n', function () { if (song && typeof scroll === 'function') scroll(); });
  function barLabel(b) {
    var zh = window.I18N && I18N.lang === 'zh';
    if (!b.rep) return b.num;
    return zh ? b.num + '（第 ' + b.time + ' 遍）' : b.num + ' (' + b.time + (['', 'st', 'nd', 'rd'][b.time] || 'th') + ' time)';
  }
  function fillAB() {
    var zh = window.I18N && I18N.lang === 'zh', bars = song ? song.bars : [];
    [selA, selB].forEach(function (sel, w) {
      sel.textContent = '';
      var o = document.createElement('option'); o.value = '-1'; o.textContent = w ? (zh ? '结尾' : 'End') : (zh ? '开头' : 'Beginning'); sel.appendChild(o);
      bars.forEach(function (b, i) { var q = document.createElement('option'); q.value = i; q.textContent = barLabel(b); sel.appendChild(q); });
    });
  }
  function limitB() {   /* B at least one bar after A */
    var a = +selA.value, last = song.bars.length - 1;
    Array.prototype.forEach.call(selB.options, function (o) { var v = +o.value; o.disabled = v >= 0 && v < a + 1; });
    if (+selB.value >= 0 && +selB.value < a + 1) selB.value = a + 1 <= last ? String(a + 1) : '-1';
  }
  function abUi() {
    abBtn.setAttribute('aria-pressed', ab ? 'true' : 'false');
    $('mpABOff').hidden = !ab;
    if (APP.fgxSync) APP.fgxSync();
    placeAB();
  }
  function placeAB() {   /* A and B marked on the score */
    Array.prototype.forEach.call(svg.querySelectorAll('.mp-abm'), function (el) { el.remove(); });
    var r = abRange();
    if (!r || !xAt) return;
    [[r.aB, 'A'], [r.eB, 'B']].forEach(function (m) {
      var d = document.createElement('div'); d.className = 'mp-abm'; d.style.left = (xAt(m[0]) - 14) + 'px'; d.textContent = m[1]; svg.appendChild(d);
    });
  }
  function setABOpen(open) {
    if (open && !song) return;
    abPop.hidden = !open; abBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (APP.fgxSync) APP.fgxSync();
    if (!open) return;
    setMixOpen(false);
    fillAB();
    selA.value = ab ? String(ab.a) : (song.bars.length ? '0' : '-1');   /* first and last bar (Trix) */
    selB.value = ab ? String(ab.b) : String(song.bars.length - 1);
    limitB();
    selA.focus();
  }
  abBtn.addEventListener('click', function (e) { e.stopPropagation(); setABOpen(abPop.hidden); });
  selA.addEventListener('change', limitB);
  $('mpABCancel').addEventListener('click', function () { setABOpen(false); owner(abBtn, abPop).focus(); });   /* nothing set: stays as it was (off) */
  /* a change of A–B pauses and moves to bar A (or the start when off); Play then counts in (Trix) */
  $('mpABOff').addEventListener('click', function () { ab = null; abUi(); setABOpen(false); pause(); seekTo(0); owner(abBtn, abPop).focus(); fgFlash('text', 'A–B off'); });
  $('mpABSet').addEventListener('click', function () {
    ab = { a: +selA.value, b: +selB.value };
    abUi(); setABOpen(false); owner(abBtn, abPop).focus();
    pause(); seekTo(abRange().aT);
    fgFlash('text', 'A–B on');
  });
  document.addEventListener('pointerdown', function (e) { if (!abPop.hidden && !abPop.contains(e.target) && !abBtn.contains(e.target) && !(e.target.closest && e.target.closest('.fgx-ab'))) setABOpen(false); }, true);
  abPop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); setABOpen(false); owner(abBtn, abPop).focus(); } });
  /* the button a panel belongs to: the player's own, or the Fingerings floating one when it was opened there (Hermes F47) */
  function owner(btn, pop) { return pop.parentNode && pop.parentNode.classList.contains('fg-fitbar') ? document.querySelector(pop === abPop ? '.fgx-ab' : '.fgx-mix') || btn : btn; }
  document.addEventListener('i18n', function () { if (!abPop.hidden) { var a = selA.value, b = selB.value; fillAB(); selA.value = a; selB.value = b; limitB(); } });
  playBtn.addEventListener('click', function () { if (playing || counting) pause(); else play(); });
  $('mpStart').addEventListener('click', function () {
    var was = playing || counting, r = abRange();
    if (was) pause();
    seekTo(r ? r.aT : 0);   /* A–B on: back to bar A */
    if (was) play();   /* playing: start again with the count-in (Trix) */
  });
  loopBtn.addEventListener('click', function () {
    loop = !loop;
    try { localStorage.setItem('violin-midi-loop', loop ? 'on' : 'off'); } catch (e) {}
    ui();
    fgFlash('text', loop ? 'Loop on' : 'Loop off');
  });
  /* d: +-0.05 = the buttons and - / + keys, to the next multiple of 5 % (83 -> 85 or 80); +-0.01 = the arrow keys, 1 % (Trix) */
  var flashT = 0;
  function fgFlash(what, n) {   /* Fingerings only (Trix): 'play' / 'pause' icon, 'speed' = the new tempo and percentage, 'count' = the count-in's n */
    var el = $('fgFlash'); if (!el || !fgShown || !song) return;
    clearTimeout(flashT);
    el.classList.toggle('txt', what === 'speed' || what === 'text');
    el.classList.toggle('cnt', what === 'count');
    if (what === 'text') { el.textContent = n; el.hidden = true; void el.offsetWidth; el.hidden = false; flashT = setTimeout(function () { el.hidden = true; }, 1000); return; }   /* Loop / A–B on or off (Trix) */
    if (what === 'count') { el.textContent = n; el.hidden = true; void el.offsetWidth; el.hidden = false; flashT = setTimeout(function () { el.hidden = true; }, 1000); return; }
    el.innerHTML = what === 'play' ? '<svg viewBox="0 0 24 24"><path d="M8 5.5v13L19 12z"/></svg>' : what === 'pause' ? '<svg viewBox="0 0 24 24"><path d="M8 5.5v13M16 5.5v13"/></svg>'
      : '♩ = ' + Math.round(curBpm() * speed) + ' · ' + Math.round(speed * 100) + '%';
    el.hidden = true; void el.offsetWidth; el.hidden = false;   /* restart the fade */
    flashT = setTimeout(function () { el.hidden = true; }, 1000);
  }
  function setSpeed(d) {
    var pc = Math.round(speed * 100), st = Math.round(Math.abs(d) * 100), dir = d > 0 ? 1 : -1;
    pc = dir > 0 ? (Math.floor(pc / st) + 1) * st : (Math.ceil(pc / st) - 1) * st;
    speed = Math.max(0.5, Math.min(1.5, pc / 100)); ui(); fgFlash('speed'); if (playing) { accStop(); accStart(); } }   /* notes under way take the new speed (Hermes R20.2) */   /* 5 % steps (Trix) */
  $('mpSlower').addEventListener('click', function () { setSpeed(-0.05); });
  /* keyboard (Trix): Space plays / pauses, - and + (or =, and the number pad's) change the speed 5 %; only while
     the player shows, not while typing or with a window open; Space never also presses the focused button */
  var spaceKey = false;
  function keyOk(e) {
    if (!(shown || fgShown) || paOn || e.ctrlKey || e.metaKey || e.altKey) return false;   /* Play-along: the take drives the player, not the keys */   /* Fingerings plays the same player (Trix) */
    var t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return false;
    if (tag === 'INPUT' && !/^(range|button|checkbox)$/i.test(t.type)) return false;
    var open = Array.prototype.some.call(document.querySelectorAll('[role="dialog"], [role="menu"], .sheet, #coach'), function (d) { return !d.hidden && d.getClientRects().length > 0; });   /* fixed windows have no offsetParent */
    return !open;
  }
  document.addEventListener('keydown', function (e) {
    if (!keyOk(e)) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) {
        spaceKey = true;
        if (fgShown && !shown) bg = true;   /* started on the Fingerings page: it stops when leaving both tools */
        if (playing || counting) pause(); else play();
        fgFlash(playing || counting ? 'play' : 'pause');
      }
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') { e.preventDefault(); setSpeed(-0.05); }
    else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); setSpeed(0.05); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target && e.target.type === 'range')) { e.preventDefault(); setSpeed(e.key === 'ArrowLeft' ? -0.01 : 0.01); }   /* 1 % steps (Trix); a slider with focus keeps its arrows */
  }, true);
  document.addEventListener('keyup', function (e) {   /* a focused button would click on Space's keyup */
    if (spaceKey && (e.key === ' ' || e.code === 'Space')) { spaceKey = false; e.preventDefault(); e.stopPropagation(); }
  }, true);
  $('mpFaster').addEventListener('click', function () { setSpeed(0.05); });
  seek.addEventListener('input', function () { if (song) seekTo(seek.value / 1000 * song.end); });
  var seekDrag = false;
  seek.addEventListener('pointerdown', function () { seekDrag = true; });
  ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { (ev === 'blur' ? seek : window).addEventListener(ev, function () { seekDrag = false; }, true); });
  /* paused (or not started): tap a note on the score to jump there and see its fingering on the board; Play
     carries on from that note (Trix). The nearest note to the tap, within 28 px sideways. */
  scoreEl.addEventListener('click', function (e) {
    if (!song || playing || counting) return;
    var best = -1, bd = 28;
    noteEls.forEach(function (el, k) {
      if (!el) return;
      var r = lrect(el); if (!r.width) return;   /* in a hidden section */
      var d = Math.abs(r.left + r.width / 2 - (fsRot ? e.clientY : e.clientX)); if (d < bd) { bd = d; best = k; }   /* the page drawn turned: across is down the screen */
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
  var boardBeat = 0, boardKey = null;   /* the key the fingerboard shows: the one at the playhead */
  function keyNow() { return song && song.keyAt ? song.keyAt(boardBeat) : { sf: song ? song.sf : 0, minor: !!(song && song.minor) }; }
  function keySet() {
    if (!song) return null;
    var kn = keyNow(), root = ((kn.sf * 7) % 12 + 12) % 12, set = {};
    [0, 2, 4, 5, 7, 9, 11].forEach(function (i) { set[(root + i) % 12] = true; });
    set.tonic = kn.minor ? (root + 9) % 12 : root;   /* the key note, ringed as on the fingerboard */
    set.minor = kn.minor;   /* so Just intonation tunes to the tune's key, not the fingerboard's */
    /* colour key notes as high up the strings as the tune plays (Trix) */
    set.top = 7;   /* at least 1st position's 4th finger on every string; higher if the tune goes higher, the same on all four (Trix) */
    song.notes.forEach(function (n) { if (n.si >= 0) set.top = Math.max(set.top, n.m - OPEN[n.si]); });
    return set;
  }
  function fit() { var kn = keyNow(); boardKey = kn.sf + (kn.minor ? 'm' : ''); APP.board.player(true, topH, reach(), keySet(), kn.sf < 0, full ? fsBox : null); scroll(); placeFull(); }
  /* the Full screen button sits in the fingerboard's bottom-right corner (Trix): next to the board (not inside it,
     which scrolls and, in full screen, is turned), placed from the board's box */
  var stageEl = document.querySelector('#view-board .stage');
  stageEl.parentNode.insertBefore($('mpFull'), stageEl.nextSibling);
  function placeFull() {
    var b = $('mpFull'), st = b.style;
    if (full) { var x = fsBox(); st.left = (x.L + x.W - 46) + 'px'; st.top = (x.T + x.H - 46) + 'px'; return; }
    st.left = (stageEl.offsetLeft + stageEl.offsetWidth - 46) + 'px'; st.top = (stageEl.offsetTop + stageEl.offsetHeight - 46) + 'px';
  }
  window.addEventListener('resize', function () { if (shown) setTimeout(placeFull, 0); });
  /* full screen (Trix): the score takes the whole width and the fingerboard turns a quarter turn anticlockwise to
     fill the room between the score and the controls, every note in view (no scrolling). The browser's own full
     screen too where there is one (not on iPhone, where the page alone rearranges). */
  var full = false, fsShort = false, fsRot = false, fullBtn = $('mpFull'), shellEl = document.getElementById('shell') || document.body;
  /* a phone (Trix): full screen is sideways. Android turns the screen (Chrome: an orientation lock; the Android app:
     its VTApp bridge); where nothing can turn it (iPhone) the page itself is drawn a quarter turn clockwise while
     the phone is upright, to be read with the phone on its side. Leaving full screen goes back upright. */
  function phone() { return Math.min(screen.width || 0, screen.height || 0) < 600; }
  /* a box in the shell's own (unturned) coordinates: what fixed elements inside the turned shell are placed by */
  function lrect(el) {
    var r = el.getBoundingClientRect();
    if (!fsRot) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    var vw = innerWidth;
    return { left: r.top, right: r.bottom, top: vw - r.right, bottom: vw - r.left, width: r.height, height: r.width };
  }
  /* where an element sits in the page's own frame, from offsets (not the screen): the same whether or not the page
     is drawn turned (an iPhone put the board beside the score, not under it, with screen boxes) */
  function lpos(el) {
    var x = 0, y = 0, e = el;
    while (e && e !== shellEl) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    if (e !== shellEl) { x -= window.pageXOffset || 0; y -= window.pageYOffset || 0; }   /* not turned: the page's own frame is the screen */
    else if (fsRot) { x += shellEl.clientLeft; y += shellEl.clientTop; }
    return { left: x, top: y };
  }
  function fsBox() {
    var sp = lpos(scoreEl), sw = scoreEl.offsetWidth, sh = scoreEl.offsetHeight;
    var pageW = fsRot ? innerHeight : (document.documentElement.clientWidth || innerWidth), pageH = fsRot ? innerWidth : innerHeight;
    var L = sp.left, T = sp.top + sh + 10;   /* the score's own left and right edges (Trix: the right sides lined up) */
    return { L: L, T: T, W: Math.max(160, Math.min(sw, pageW - L)), H: Math.max(60, pageH - bar.offsetHeight - 10 - T) };
  }
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  /* the phone apps (Android: window.VTApp; iPhone: webkit.messageHandlers.vt): true if there was one to ask */
  function appCall(name, val) {
    var done = false;
    try { if (window.VTApp && VTApp[name]) { VTApp[name](val); done = true; } } catch (e) {}
    try { if (window.webkit && webkit.messageHandlers && webkit.messageHandlers.vt) { var m = {}; m[name] = val; webkit.messageHandlers.vt.postMessage(m); done = true; } } catch (e) {}
    return done;
  }
  var sideLocked = false;   /* the screen is held sideways by us: turning the phone cannot leave, so the button stays */
  function lockSide(on) {
    if (!on) sideLocked = false;
    if (appCall('landscape', !!on) && on) sideLocked = true;   /* the Android / iPhone app turns the screen itself */
    try {
      var so = screen.orientation;
      if (!so) return;
      if (on && so.lock) { var p = so.lock('landscape'); if (p && p.then) p.then(function () { if (full) { sideLocked = true; fsCheck(); } }, function () {}); }
      else if (!on && so.unlock) so.unlock();
    } catch (e) {}
    fsCheck();
  }
  /* Exit with a phone still on its side (Trix): the page goes back to its upright layout, drawn turned to match the
     phone (the browser cannot turn the screen), so it reads once the phone is upright; turned sideways again, full
     screen again. upRot: the quarter turn the page is drawn at (-90 or 90), 0 when not */
  var upRot = 0;
  APP.vh = function () { return upRot ? innerWidth : innerHeight; };
  function setUp(a) {
    upRot = a;
    var st = shellEl.style;
    shellEl.classList.toggle('mp-up-rot', !!a); document.documentElement.classList.toggle('mp-fs-on', !!a || full);
    if (a) {
      st.width = innerHeight + 'px'; st.height = innerWidth + 'px';
      st.transform = a < 0 ? 'translateY(' + innerHeight + 'px) rotate(-90deg)' : 'translateX(' + innerWidth + 'px) rotate(90deg)';
    } else st.width = st.height = st.transform = '';
    if (shown) { fit(); setTimeout(fit, 0); }
  }
  var fsAuto = false;   /* entered by turning the phone: no lock, so turning it upright again can leave */
  /* fit now and again while the screen settles: a phone turning, or the browser going full screen, reports its new
     size late (Trix: turned into full screen on an iPhone, the board did not fill the width) */
  var refitT = [];
  function refitSoon() {
    refitT.forEach(clearTimeout); refitT = [];
    fit(); requestAnimationFrame(function () { if (shown) { APP.board.relayout(); scroll(); placeFull(); } });
    [120, 300, 600, 1000, 1600].forEach(function (ms) { refitT.push(setTimeout(function () { if (shown) { fsCheck(); APP.board.relayout(); scroll(); placeFull(); } }, ms)); });   /* sizes only: a full redraw each time flashed the key notes (Trix) */
  }
  function setFull(on, auto) {
    if (on === full) return;
    full = on; fsAuto = !!(on && auto);
    shellEl.classList.toggle('mp-fs', on); document.documentElement.classList.toggle('mp-fs-on', on);
    fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); fullBtn.title = fullBtn.getAttribute('aria-label');
    var de = document.documentElement;
    try {
      if (on && !fsEl()) {
        var r = auto ? null : (de.requestFullscreen || de.webkitRequestFullscreen || function () {}).call(de);   /* the browser's own full screen needs a tap */
        if (auto) {} else if (phone()) { if (r && r.then) r.then(function () { if (full) lockSide(true); }, function () { if (full) lockSide(true); }); else lockSide(true); }   /* Chrome locks only once full screen */
      } else if (!on) {
        if (phone()) lockSide(false);
        if (fsEl()) { var x = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (x && x.catch) x.catch(function () {}); }
      }
    } catch (e) {}
    window.scrollTo(0, 0);
    if (!on && phone() && innerWidth > innerHeight) setUp(window.orientation === -90 ? 90 : -90);   /* phone turned counter-clockwise (90): its top is on the left */
    if (on && upRot) setUp(0);
    fsCheck();
    scroll();
    if (shown) refitSoon();
  }
  function fsCheck() {
    if (upRot && (innerWidth <= innerHeight || full)) setUp(0);   /* turned upright (or full screen again): the real upright page */
    var rot = full && phone() && innerWidth < innerHeight;   /* still upright: draw the page turned */
    if (rot !== fsRot) { fsRot = rot; shellEl.classList.toggle('mp-fs-rot', rot); }
    if (rot) { shellEl.style.setProperty('--rw', innerHeight + 'px'); shellEl.style.setProperty('--rh', innerWidth + 'px'); }
    var sh = full && (rot ? innerWidth : innerHeight) < 560;   /* a phone on its side: the compact layout */
    if (sh !== fsShort) { fsShort = sh; shellEl.classList.toggle('mp-fs-short', sh); }
    scroll();
  }
  /* a phone in the player (Trix): turned sideways, full screen by itself; turned upright, back out */
  var wasSide = innerWidth > innerHeight;
  function turned() {
    var side = innerWidth > innerHeight;
    if (side === wasSide) return;
    wasSide = side;
    if (!shown || !phone()) return;
    if (side && !full) setFull(true, true);
    else if (!side && full) setFull(false);
  }
  fsCheck();
  function onResize() { turned(); fsCheck(); if (full && shown) refitSoon(); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });
  if (window.visualViewport) visualViewport.addEventListener('resize', function () { if (full && shown) refitSoon(); });
  fullBtn.addEventListener('click', function () { setFull(!full); });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!fsEl() && full) setFull(false); else if (shown) setTimeout(fit, 50); });   /* left with Esc or Back */
  });
  APP.midiSong = function () { return song; };   /* for tests: the tune on screen */
  APP.midiPlaying = function () { return !!(playing || counting); };   /* a tune is playing or counting in (the Fingerings tour waits: Trix) */
  /* ---------- Fingerings (指法谱, Trix): the violin part with the app's fingerings, on A4 pages and as a PDF.
     Same tune list, reader, planner and drawing as the player (scoreItems): the long line is cut at bar lines
     into systems, each system justified by widening its note spacing (a second drawing pass, so nothing is
     stretched), systems stacked on pages. The preview is the PDF: printing shows these same pages. */
  var fgSel = $('fgSong'), fgPages = $('fgPages'), fgMsg = $('fgMsg'), fgPdf = $('fgPdf'), fgShown = false, fgDirty = true, fgHtml = '';
  var PG_W = 794, PG_H = 1123, PG_M = 57, PG_K = 0.62, SYS_H = BOT + 46, FG_IND = 60;   /* FG_IND: the first system's indent, in score units (~10 mm) */   /* A4 at 96 px per inch, 15 mm margins; score at 64 % (a 5.8 mm staff) */
  function fgOptions() { if (!fgSel) return; fgSel.innerHTML = songSel.innerHTML; fgSel.value = songSel.value; }
  /* the fingerings-shown drop-downs (Trix): in the Fingerings page's floating controls and in the MIDI player's bar
     next to A–B; Settings has the same choice. All of them set APP.fgLevel and follow it */
  (function () {
    var GLYPH = { full: '123', medium: '1·3', minimum: '1' }, uis = [];
    function setup(btnId, menuId, glyphId) {
      var btn = $(btnId), menu = $(menuId); if (!btn || !menu) return;
      var items = Array.prototype.slice.call(menu.querySelectorAll('button'));
      function ui() {
        var lv = APP.fgLevel(), zh = window.I18N && I18N.lang === 'zh';
        items.forEach(function (b) { b.setAttribute('aria-checked', b.dataset.lv === lv ? 'true' : 'false'); });
        $(glyphId).textContent = GLYPH[lv];
        var lab = (zh ? '显示的指法：' : 'Fingerings shown: ') + (zh ? { full: '全部', medium: '中等', minimum: '最少' } : { full: 'Full', medium: 'Medium', minimum: 'Minimum' })[lv];
        btn.setAttribute('aria-label', lab); btn.title = lab;
      }
      function open(on, focusIt) {
        menu.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on && focusIt) (items.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0] || items[0]).focus();
      }
      btn.addEventListener('click', function (e) { e.stopPropagation(); open(menu.hidden, true); });
      items.forEach(function (b, i) {
        b.addEventListener('click', function (e) { e.stopPropagation(); APP.fgLevel(b.dataset.lv); open(false); btn.focus(); });
        b.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
          if (d) { e.preventDefault(); e.stopPropagation(); items[(i + d + items.length) % items.length].focus(); }
          else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); open(false); btn.focus(); }
          else if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();   /* not the player's Space = play */
        });
      });
      document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) open(false); }, true);
      uis.push(ui); ui();
    }
    APP.fgLvUi = function () { uis.forEach(function (f) { f(); }); };
    setup('fgLvBtn', 'fgLvMenu', 'fgLvGlyph');
    setup('mpLvBtn', 'mpLvMenu', 'mpLvGlyph');
    document.addEventListener('i18n', function () { APP.fgLvUi(); });
  })();
  function fgSync() { fgOptions(); var cur = songs[+songSel.value]; $('fgDel').hidden = !(cur && cur.kept); fgDirty = true; if (APP.fgReset) APP.fgReset(); if (fgShown) fgRender(); }
  var fgT = 0;
  APP.fgSync = function () { clearTimeout(fgT); fgT = setTimeout(fgSync, 0); };   /* after the caller has set the list's value (an import selects its tune after loading it) */
  /* the exported PDF's name (Trix): the tune as the list shows it (never an import's file name), a hyphen and the part
     ("卡农 - 小提琴", "Canon - Violin"); characters a file system refuses become spaces, at most 80 characters */
  function fgFileName() {
    var i = +songSel.value, s = songs[i], o = songSel.options[songSel.selectedIndex], zh = window.I18N && I18N.lang === 'zh';
    var base = ((s ? (s.kept ? s.title : (o ? o.textContent : s.title)) : '') || '').trim() || (zh ? '小提琴分谱' : 'Violin part');
    var clean = function (t) { return t.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim(); };
    return clean(base + ' - ' + (zh ? '小提琴' : 'Violin')) || (zh ? '小提琴分谱' : 'Violin part');
  }
  APP.fgFileName = fgFileName;   /* tests */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fgLayout(sg) {
    /* the first system has clef, key and time; later ones only clef and key (Trix: no 4/4 on every line), so
       their music starts further left and they hold more */
    var r1 = scoreItems(sg, { barsOnly: true, paged: true }), hw = r1.X0 - 12, hwK = 52 + r1.nMax * 10.5, line = (PG_W - 2 * PG_M) / PG_K - 4, bars = r1.bars, sys = [], a = 0;
    function avail(i) { return i === 0 ? line - hw - FG_IND : line - hwK; }   /* the first system is indented too (首行缩进, Trix) */
    /* line breaks chosen together (as engraving programs do), not line by line: the set of breaks whose lines need
       the least stretching or squeezing, so a short bar is not stranded alone before a very wide one (Trix:
       Winter's bars 11 and 16). A line's cost grows with how far its spacing is from natural; squeezing below 55 %
       is allowed only for a single bar wider than a line; the last line may stay short; each line costs a little,
       so fewer lines (and pages) win a tie */
    /* the bars printed (Trix: as the score writes them): each written bar once, at its first time through; the
       repeats are shown with repeat signs and ending brackets instead of the music twice. A MIDI file (no written
       bars) prints everything, as before */
    var K = [], seenMi = {}, lastKey = null;
    for (var k0 = 0; k0 < bars.length - 1; k0++) {
      var bo0 = sg.barAt ? sg.barAt(bars[k0].beat + 1e-3) : null, key = bo0 && bo0.mi !== undefined ? 'm' + bo0.mi : 'b' + k0;
      if (!seenMi[key]) { seenMi[key] = 1; K.push(k0); lastKey = key; }
      else if (K.length && K[K.length - 1] === k0 - 1 && key === lastKey) K.push(k0);   /* a second grid step inside the same printed bar (Hermes F63: it split the line there) */
    }
    var PW = [0], FX = [0]; K.forEach(function (k, i) { PW[i + 1] = PW[i] + bars[k + 1].x - bars[k].x; FX[i + 1] = FX[i] + (bars[k].fx || 0); });
    function bw(i) { return bars[K[i] + 1].x - bars[K[i]].x; }
    var B = K.length, best = [0], from = [];
    function lineCost(a, b) {
      var w = PW[b] - PW[a], fixed = 12 * (b - a) + 4 + FX[b] - FX[a], g = (avail(a === 0 ? 0 : 1) - fixed) / Math.max(1, w - fixed);
      /* several bars squeezed below 75 %: fingerings crowd (Trix: Winter bar 14); but a short bar (under a third of
         the line) may join one dense bar down to 62 %, rather than sit alone on a line (Trix: Winter bar 16) */
      var shortPair = b === a + 2 && Math.min(bw(a), bw(a + 1)) < avail(a === 0 ? 0 : 1) / 3;
      if (g < (shortPair ? 0.62 : 0.75) && b > a + 1) return Infinity;
      if (g < 0.55) return b === a + 1 ? 1e6 : Infinity;
      if (b === B && g >= 1) return 0;
      if (g > 2.5) return 400 + (g - 2.5) * 100;
      return (g - 1) * (g - 1) * (g < 1 ? 300 : 100);   /* squeezing costs three times stretching: crowded fingerings read worse than air */
    }
    for (var e = 1; e <= B; e++) {
      best[e] = Infinity;
      for (var st = e - 1; st >= 0; st--) {
        var c = lineCost(st, e);
        if (c === Infinity) break;   /* more bars only make it tighter */
        if (best[st] + c + 8 < best[e]) { best[e] = best[st] + c + 8; from[e] = st; }
      }
    }
    for (var e2 = B; e2 > 0; e2 = from[e2]) sys.unshift([from[e2], e2]);
    var gains = sys.map(function (q, i) {
      var w = PW[q[1]] - PW[q[0]], fixed = 12 * (q[1] - q[0]) + 4 + FX[q[1]] - FX[q[0]];
      if (i === sys.length - 1 && w < avail(i) * 0.75) return 1;   /* a short last system stays at its natural width */
      /* justified: widened to fill the line, or tightened (to 55 %) when one dense bar is wider than the line on its
         own (Trix: Winter's semiquaver bars ran off the page); a line that would need more than 2.5 x keeps its
         natural width rather than spreading a few notes across the page */
      var g = (avail(i) - fixed) / Math.max(1, w - fixed);
      return g > 2.5 ? 1 : Math.max(0.55, g);
    });
    var gb = []; sys.forEach(function (q, si) { for (var i = q[0]; i < q[1]; i++) gb.push([bars[K[i]].beat, bars[K[i] + 1].beat, gains[si]]); });
    var r = scoreItems(sg, { paged: true, gain: function (b) { for (var i = 0; i < gb.length; i++) if (b >= gb[i][0] - 1e-6 && b < gb[i][1] - 1e-6) return gb[i][2]; return 1; } });
    /* each system as pieces of the line: runs of bars that follow each other in the music */
    sys = sys.map(function (q) {
      var P = [];
      for (var i = q[0]; i < q[1]; i++) {
        if (P.length && P[P.length - 1][1] === K[i]) P[P.length - 1][1] = K[i] + 1;
        else P.push([K[i], K[i] + 1]);
      }
      return P;
    });
    r.sys = sys; r.hw = hw; r.hwK = hwK; r.items.sort(function (p, q) { return p[0] - q[0]; });
    return r;
  }
  /* a repeat sign at x: dir 1 forward (thick, thin, dots to the right), -1 backward (dots, thin, thick) */
  function repSign(x, dir) {
    var th = dir > 0 ? x : x - 3.5, tn = dir > 0 ? x + 6.5 : x - 6.5, dx = dir > 0 ? x + 11 : x - 11;
    return '<rect class="fg-rpt" x="' + th.toFixed(1) + '" y="' + Y0 + '" width="3.5" height="' + (4 * S) + '"/>' +
      '<path class="bl" d="M' + tn.toFixed(1) + ' ' + Y0 + 'V' + (Y0 + 4 * S) + '"/>' +
      '<circle class="fg-rpt" cx="' + dx.toFixed(1) + '" cy="' + (Y0 + 1.5 * S) + '" r="1.9"/><circle class="fg-rpt" cx="' + dx.toFixed(1) + '" cy="' + (Y0 + 2.5 * S) + '" r="1.9"/>';
  }
  function fgSystem(sg, r, si, firstOnPage, id, ceil) {   /* ceil: the highest numeral baseline allowed (under a page header) */
    var P = r.sys[si], q = [P[0][0], P[P.length - 1][1]], xa = r.bars[q[0]].x, xb = r.bars[q[1]].x, hw = si === 0 ? r.hw : r.hwK, out = [], lines = '';
    var wide = hw + P.reduce(function (t, p) { return t + r.bars[p[1]].x - r.bars[p[0]].x; }, 0);
    for (var j = 0; j < 5; j++) lines += '<path class="sl" d="M0 ' + (Y0 + j * S) + 'H' + wide + '"/>';
    var bo = sg.barAt ? sg.barAt(r.bars[q[0]].beat + 1e-3) : null;
    out.push(lines, CLEF, (si === 0 ? r.head : r.headAt(r.bars[q[0]].beat + 1e-3, false)).join(''));   /* the time signature on the first system only; a later one: its first bar's key (a change there is shown here, as printed music does, not again after the bar line) */
    if (si === 0) {   /* the tempo over the middle of the first bar (Trix), above anything there: fingerings, bowings, a position numeral */
      var bEnd = r.bars[q[0] + 1] ? r.bars[q[0] + 1].x : xb, ty = Y0 - 24;
      r.tops.forEach(function (t) { if (t[0] > xa && t[0] < bEnd) ty = Math.min(ty, t[1] - 6); });
      r.passages.forEach(function (p) { if (p.x0 > xa - 30 && p.x0 < bEnd) ty = Math.min(ty, p.y - 22); });
      /* over the first note of the first bar, starting at it (Trix); a bar with no notes: over its middle */
      var firstX = null; r.tops.forEach(function (t) { if (t[0] > xa && t[0] < bEnd && (firstX === null || t[0] < firstX)) firstX = t[0]; });
      var tx0 = firstX === null ? hw + (bEnd - xa) / 2 : hw + (firstX - xa) - 6;
      out.push('<text class="fg-tempo' + (firstX === null ? '' : ' at-note') + '" x="' + tx0.toFixed(1) + '" y="' + Math.max(-22, ty) + '">♩ = ' + sg.bpm + '</text>');
    }
    else if (bo) out.push('<text class="fg-bn" x="2" y="' + (Y0 - 24) + '">' + esc(bo.num) + '</text>');
    /* a position held over a page turn: its numeral again at the top of the new page (Trix) */
    if (firstOnPage && si > 0) r.passages.forEach(function (p) {
      if (!(p.h > 0 && p.x0 < xa - 1 && p.x1 > xa + 14)) return;
      /* over the page's first notes: above their fingerings and bowings (Hermes F36: the Ⅲ sat on a 4) */
      var yy = p.y; r.tops.forEach(function (t) { if (t[0] > xa - 4 && t[0] < xa + 18 * ROMAN_W[p.h] + 12) yy = Math.min(yy, t[1] - 2); });
      if (yy >= -22 && !(yy < ceil)) out.push('<text class="mp-pos" x="' + (hw + 4) + '" y="' + yy + '">' + ROMAN_U[p.h] + '</text>');
    });
    var off = 0;
    P.forEach(function (pc, pn) {
      var pa = r.bars[pc[0]].x, pb = r.bars[pc[1]].x, tx = hw + off - pa, last = pn === P.length - 1, body = [];
      for (var lo = 0, hi = r.items.length; lo < hi; ) { var mid = (lo + hi) >> 1; if (r.items[mid][0] <= pa + 0.5) lo = mid + 1; else hi = mid; }
      for (var k = lo; k < r.items.length && r.items[k][0] <= pb + 0.5; k++) {
        var it = r.items[k][1];
        if (si > 0 && pn === 0 && r.items[k][0] - pa < 30 && it.indexOf('class="kchg"') > 0) continue;   /* the new key is in this line's head */
        if (last && it.indexOf('class="mp-tempo"') > 0) {   /* a tempo mark near the line's end ends at its edge instead of running off it */
          var tw0 = +/data-w="([\d.]+)"/.exec(it)[1], tx0 = +/ x="(-?[\d.]+)"/.exec(it)[1];
          if (tx0 + tw0 > pb + 4) it = it.replace(/ x="-?[\d.]+"/, ' x="' + (pb + 4 - tw0).toFixed(1) + '"');
        }
        if (ceil !== undefined && it.indexOf('mp-pos') > 0) {   /* a numeral (or its line) that would print through the page header is left out (Hermes F36) */
          var yv = /y="(-?[\d.]+)"/.exec(it) || /d="M-?[\d.]+ (-?[\d.]+)/.exec(it);
          if (yv && +yv[1] + (it.indexOf('mp-posd') > 0 ? 5 : 0) < ceil) continue;
        }
        body.push(it);
      }
      out.push('<clipPath id="' + id + '_' + pn + '"><rect x="' + (hw + off - (pn ? 0 : 2)) + '" y="-40" width="' + (pb - pa + (last ? 8 : 1) + (pn ? 0 : 2)) + '" height="' + (SYS_H + 52) + '"/></clipPath>');   /* room above for a raised numeral */
      out.push('<g clip-path="url(#' + id + '_' + pn + ')"><g transform="translate(' + tx.toFixed(2) + ' 0)">' + body.join('') + '</g></g>');
      /* repeat signs and ending brackets, from the score's barlines (Trix) */
      var ends = [];
      for (var bk = pc[0]; bk < pc[1]; bk++) {
        var bo2 = sg.barAt ? sg.barAt(r.bars[bk].beat + 1e-3) : null, rp = bo2 && bo2.wr;
        if (!rp) continue;
        var X1 = r.bars[bk].x + tx, X2 = r.bars[bk + 1].x + tx;
        if (bk === pc[0] && pn === 0 && si > 0 && bk === q[0]) X1 = hw;   /* at the start of a line: just after the clef and key */
        if (rp.fwd) out.push(repSign(X1 + 1, 1));
        if (rp.back) out.push(repSign(X2, -1));
        if (rp.end) ends.push({ bk: bk, X1: X1, X2: X2, rp: rp });
      }
      /* ending brackets: one per run of bars of the same ending on this piece of the line (Hermes F63) */
      for (var ei = 0; ei < ends.length; ) {
        var ej = ei; while (ej + 1 < ends.length && ends[ej + 1].bk === ends[ej].bk + 1 && !ends[ej + 1].rp.endStart && String(ends[ej + 1].rp.end) === String(ends[ei].rp.end)) ej++;
        var A = ends[ei], Z = ends[ej], EY = Y0 - 34, d = A.rp.endStart ? 'M' + (A.X1 + 3) + ' ' + (EY + 12) + 'V' + EY : 'M' + A.X1 + ' ' + EY;
        /* open only when the next printed bar carries the same ending (a line break); otherwise it closes on its own
           barline, a 2nd ending included (Hermes F65) */
        var nb = r.bars[Z.bk + 1]; if (nb && nb.end) nb = null;   /* the end-of-song sentinel: no bar follows (Hermes F68) */
        var nbo = nb && sg.barAt ? sg.barAt(nb.beat + 1e-3) : null;
        var goesOn = Z.bk + 1 >= pc[1] && nbo && nbo.wr && nbo.wr.end && !nbo.wr.endStart && String(nbo.wr.end) === String(A.rp.end);
        d += 'H' + (goesOn ? Z.X2 - 3 : Z.X2); if (!goesOn) d += 'V' + (EY + 12);
        out.push('<path class="fg-end" d="' + d + '"/>');
        if (A.rp.endStart) out.push('<text class="fg-endn" x="' + (A.X1 + 7) + '" y="' + (EY + 11) + '">' + A.rp.endStart.join(', ') + '.</text>');
        ei = ej + 1;
      }
      off += pb - pa;
    });
    return out.join('');
  }
  /* the QR on page 1 (Trix): the app's address, drawn from src/qr.py at build time as vector squares */
  var QR = /*QR*/null;
  /* the QR on page 1 (Trix): a built-in piece's own (its Fingerings page, the piece chosen); an imported one, the app's */
  function fgQrCode() { var s0 = songs[+songSel.value], f = s0 && s0.demo && s0.demo.f; return QR && QR.tunes && f && QR.tunes[f] ? QR.tunes[f].c : null; }
  function fgQrPath() { var c = fgQrCode(), s0 = songs[+songSel.value]; return c ? QR.tunes[s0.demo.f].d : QR.d; }
  APP.fgQrCode = fgQrCode;   /* tests */
  /* a piece's QR opens #t=xx: that piece, chosen in the list (built-ins only; the start screen is skipped by the page) */
  function tuneFromHash() {
    var m = (location.hash || '').match(/(?:^|[#,&;])t=([a-z0-9]{2})(?=$|[,&;])/i);
    if (!m || !QR || !QR.tunes) return;
    var c = m[1].toLowerCase(), f = null;
    Object.keys(QR.tunes).forEach(function (k) { if (QR.tunes[k].c === c) f = k; });
    for (var i = 0; f && i < songs.length; i++) if (songs[i].demo && songs[i].demo.f === f) {
      if (+songSel.value !== i) { songSel.value = String(i); load(i); }
      if (fgSel) fgOptions();
      if (APP.show) APP.show('fingering');
      return;
    }
  }
  window.addEventListener('hashchange', function () { tuneFromHash(); });
  var KEY_MAJ = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
  var KEY_MIN = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];   /* capitals before 'minor' (Winter: 'F minor') */
  /* a piece whose key changes is not named by one key (Trix) */
  function keyChanges(sg) { return (sg.bars || []).some(function (b) { return b.ks !== null && b.ks !== undefined && (b.ks !== sg.sf || (b.km && (b.km === 'minor') !== !!sg.minor)); }); }
  function fgKey(sg, zh) {
    var i = Math.max(-7, Math.min(7, sg.sf)) + 7, k = sg.minor ? KEY_MIN[i] : KEY_MAJ[i];
    return zh ? k + (sg.minor ? ' 小调' : ' 大调') : k + (sg.minor ? ' minor' : ' major');
  }
  function fgRender() {
    if (!fgPages) return;
    fgDirty = false;
    if (!song) { fgPages.innerHTML = ''; fgPdf.disabled = true; fgMsg.hidden = false; fgMsg.textContent = msg.hidden ? 'Opening the score…' : msg.textContent; return; }
    fgMsg.hidden = true; fgPdf.disabled = false;
    var sg = song, r = fgLayout(sg), zh = window.I18N && I18N.lang === 'zh';
    /* page 1 opens with the title block (title, part, key and tempo; the QR on the right); later pages with a
       running header; no footer on any page, no watermark (Trix) */
    var MM = PG_W / 210, QS = 12 * MM, QZ = 2 * MM, QT = 14, TOP1 = PG_M + QT + QZ + QS + QZ + 14, TOPN = PG_M + 22;   /* QR 12 mm, 'Violin Toolkit' above it (Trix) */
    var pages = [], cur = null, y = 0, sysH = SYS_H * PG_K + 9, bottom = PG_H - PG_M;   /* room between systems for a raised position numeral and its line */
    r.sys.forEach(function (q, si) {
      if (!cur || y + sysH > bottom) { cur = []; pages.push(cur); y = pages.length === 1 ? TOP1 : TOPN; }
      cur.push([si, y, cur.length === 0]); y += sysH;
    });
    /* Minimum: the first note of each page carries its finger (Trix); the layout itself does not change */
    if (FG_LEVEL === 'minimum') {
      fgForce = pages.map(function (pg) { var P = r.sys[pg[0][0]], b0 = r.bars[P[0][0]].beat, n = sg.notes.filter(function (x) { return !x.grace && x.b >= b0 - 1e-6; })[0]; return n ? n.b : null; }).filter(function (b) { return b !== null; });
      r = fgLayout(sg); fgForce = null;
    }
    var o0 = songSel.options[songSel.selectedIndex], s0 = songs[+songSel.value];
    var title = s0 ? (s0.kept ? s0.title : (o0 ? o0.textContent : s0.title)) : '';
    var src = s0 && s0.demo && s0.demo.s ? s0.demo.s : '';
    if (s0 && s0.kept) {   /* an imported piece: its source is the user's own file, named in the footer (Trix) */
      var rec = kept.filter(function (f) { return f.id === s0.kept; })[0];
      var fnm = (rec && rec.fn) || s0.title;
      if (fnm.length > 60) {   /* clear of 'Page N of M': shortened before the extension, which stays (Trix) */
        var ext = (/\.[A-Za-z0-9]{1,8}$/.exec(fnm) || [''])[0];
        fnm = fnm.slice(0, 59 - ext.length) + '…' + ext;
      }
      src = fnm + (zh ? '（导入的文件）' : ' (imported file)');
    }
    var part = zh ? '小提琴' : 'Violin';
    var pageShift = [];
    var html = pages.map(function (pg, pi) {
      var o = ['<svg class="fg-page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + PG_W + ' ' + PG_H + '" width="' + PG_W + '" height="' + PG_H + '"><rect class="fg-paper" width="' + PG_W + '" height="' + PG_H + '"/>'];
      if (pi === 0) {
        /* centred (Trix); a title that would reach the QR's white square is set a little smaller, 8 units clear of it (Hermes F81) */
        var tSize = 22, tMax = 2 * (PG_W - PG_M - 2 * QZ - QS - 8 - PG_W / 2);
        try { var tcv = fgRender.cv || (fgRender.cv = document.createElement('canvas').getContext('2d')); tcv.font = '700 22px "Times New Roman", "Noto Serif", "Songti SC", serif'; var tw = tcv.measureText(title).width; if (tw > tMax) tSize = Math.max(14, +(22 * tMax / tw).toFixed(2)); } catch (e) {}
        o.push('<text class="fg-title" x="' + PG_W / 2 + '" y="' + (PG_M + 22) + '"' + (tSize < 22 ? ' style="font-size:' + tSize + 'px"' : '') + '>' + esc(title) + '</text>');
        /* line 2 the composer (when the score names one), line 3 instrument and key (Trix) */
        if (sg.composer) o.push('<text class="fg-sub" x="' + PG_W / 2 + '" y="' + (PG_M + 44) + '">' + esc(sg.composer) + '</text>');
        o.push('<text class="fg-sub" x="' + PG_W / 2 + '" y="' + (PG_M + (sg.composer ? 63 : 44)) + '">' + esc(sg.modeKnown && !keyChanges(sg) ? part + ' · ' + fgKey(sg, zh) : part) + '</text>');
        if (QR) {   /* 16 mm with a 2 mm quiet zone, inside the margins, over no staff */
          var qx = PG_W - PG_M - QZ - QS, qy = PG_M + QT + QZ, u = QS / QR.n;
          o.push('<text class="fg-cap" x="' + (PG_W - PG_M) + '" y="' + (PG_M + 9) + '">' + (zh ? '小提琴工具箱' : 'Violin Toolkit') + '</text>');   /* right-aligned: wider than the QR, kept out of the margin */
          o.push('<rect class="fg-paper" x="' + (qx - QZ).toFixed(2) + '" y="' + (PG_M + QT) + '" width="' + (QS + 2 * QZ).toFixed(2) + '" height="' + (QS + 2 * QZ).toFixed(2) + '"/>');
          o.push('<path class="fg-qr" transform="translate(' + qx.toFixed(2) + ' ' + qy.toFixed(2) + ') scale(' + u.toFixed(4) + ')" d="' + fgQrPath() + '"/>');
          if (QR.icon) {   /* the app icon in the middle (Trix): 7 modules on a white square 9 modules across; level Q corrects the cover */
            var im = 7 * u, ib = 9 * u, cx = qx + QS / 2, cy = qy + QS / 2;
            o.push('<rect class="fg-paper" x="' + (cx - ib / 2).toFixed(2) + '" y="' + (cy - ib / 2).toFixed(2) + '" width="' + ib.toFixed(2) + '" height="' + ib.toFixed(2) + '"/>');
            o.push('<svg x="' + (cx - im / 2).toFixed(2) + '" y="' + (cy - im / 2).toFixed(2) + '" width="' + im.toFixed(2) + '" height="' + im.toFixed(2) + '" viewBox="0 0 512 512">' + QR.icon + '</svg>');
          }
        }
      } else {
        o.push('<text class="fg-run" x="' + PG_M + '" y="' + (PG_M + 8) + '">' + esc(title) + '</text>');   /* the piece at top left, the app at top right (Trix) */
        o.push('<text class="fg-run fg-pg-n" x="' + (PG_W - PG_M) + '" y="' + (PG_M + 8) + '">' + (zh ? '小提琴工具箱' : 'Violin Toolkit') + '</text>');
      }
      /* the edition this part comes from, bottom left of every page (Trix; the CC licences ask for credit) */
      if (src) o.push('<text class="fg-run" x="' + PG_M + '" y="' + (PG_H - PG_M + 22) + '">' + esc((zh ? '来源：' : 'Source: ') + src) + '</text>');
      /* our part of the page, on every page and for imported files too (Trix): the fingerings are ours, released CC0 */
      o.push('<text class="fg-run" x="' + PG_M + '" y="' + (PG_H - PG_M + (src ? 37 : 22)) + '">' + (zh ? '指法：小提琴工具箱，2026（CC0）' : 'Fingerings by Violin Toolkit, 2026 (CC0)') + '</text>');
      /* page N of M at the bottom right of every page (Trix), in the margin below the music */
      o.push('<text class="fg-run fg-pg-n" x="' + (PG_W - PG_M) + '" y="' + (PG_H - PG_M + 22) + '">' + (zh ? '第 ' + (pi + 1) + ' 页，共 ' + pages.length + ' 页' : 'Page ' + (pi + 1) + ' of ' + pages.length) + '</text>');
      /* a raised numeral on a later page's first system must clear the running header (Hermes F36): the page's music
         moves down into the room left at the bottom; whatever still would not clear is left out */
      var shift = 0, ceil = pi > 0 ? -3 : undefined;   /* Hermes F41: the ceiling holds even when no counted passage is above it. Kept on the
         baseline, not the ink top: testing the ink top dropped 5 numerals (no room to move those pages down) to clear a
         0.57 px layout-box overlap with no ink touching */
      if (pi > 0) {
        var P0 = r.sys[pg[0][0]], xa0 = r.bars[P0[0][0]].x, xb0 = r.bars[P0[P0.length - 1][1]].x, minY = Infinity, CL = -3;   /* CL: a numeral's top at the header's descenders */
        r.passages.forEach(function (p) { if ((p.x0 > xa0 - 1 && p.x0 <= xb0 + 0.5) || (p.h > 0 && p.x0 < xa0 - 1 && p.x1 > xa0 + 14)) minY = Math.min(minY, p.y); });
        if (minY < CL) {
          shift = Math.max(0, Math.min((CL - minY) * PG_K, bottom - (pg[pg.length - 1][1] + sysH)));
          ceil = CL - shift / PG_K;
        }
      }
      pageShift[pi] = shift;
      pg.forEach(function (e, ei) { o.push('<g transform="translate(' + (PG_M + (e[0] === 0 ? FG_IND * PG_K : 0)).toFixed(2) + ' ' + (e[1] + shift).toFixed(1) + ') scale(' + PG_K + ')">' + fgSystem(sg, r, e[0], e[2], 'fgc' + pi + '_' + e[0], ei === 0 ? ceil : undefined) + '</g>'); });
      o.push('</svg>');
      return o.join('');
    }).join('');
    fgHtml = html; fgPages.innerHTML = html;
    /* the play line (Trix): where each system sits on its page, to follow the music; added after fgHtml, so never in the PDF */
    fgR = r; fgMap = [];
    var svgs = fgPages.querySelectorAll('svg.fg-page');
    pages.forEach(function (pg, pi) {
      var hl = document.createElementNS('http://www.w3.org/2000/svg', 'line'); hl.setAttribute('class', 'fg-head'); hl.style.display = 'none';
      svgs[pi].appendChild(hl);
      pg.forEach(function (e) {
        var si = e[0], P = r.sys[si], hw = si === 0 ? r.hw : r.hwK, off = 0;
        P.forEach(function (pc) {   /* one entry per piece of the line: its beats and where they sit */
          fgMap.push({ pi: pi, si: si, b0: r.bars[pc[0]].beat, b1: r.bars[pc[1]].beat, ox: PG_M + (si === 0 ? FG_IND * PG_K : 0), oy: e[1] + pageShift[pi], tx: hw + off - r.bars[pc[0]].x, line: hl, svg: svgs[pi] });
          off += r.bars[pc[1]].x - r.bars[pc[0]].x;
        });
      });
    });
    fgSys = -1; fgHead(true);
  }
  /* a beat in play order -> the same place in the printed bars (a repeat's second time: its first time on the page) */
  function writtenBeat(beat) {
    if (!song || !song.barAt) return beat;
    var bo = song.barAt(beat); if (!bo || bo.mi === undefined) return beat;
    for (var i = 0; i < song.bars.length; i++) if (song.bars[i].mi === bo.mi) return song.bars[i].beat + (beat - bo.beat);
    return beat;
  }
  var fgR = null, fgMap = [], fgSys = -1, bg = false;   /* bg: the player plays on while Fingerings shows */
  function fgHead(jump) {
    if (!fgMap.length || !song || !fgR) return;
    var on = playing || counting || pos > 0.01;
    fgMap.forEach(function (m) { m.line.style.display = 'none'; });
    if (!on) { fgSys = -1; return; }
    var beat = writtenBeat(counting ? Math.max(countBeat, 0) : song.toBeat(pos)), m = fgMap[0];
    for (var i = 0; i < fgMap.length; i++) { if (fgMap[i].b0 <= beat + 1e-6) m = fgMap[i]; else break; }
    var x = m.ox + (fgR.xAt(Math.min(beat, m.b1)) + m.tx) * PG_K, y0 = m.oy + (Y0 - 22) * PG_K, y1 = m.oy + (Y0 + 4 * S + 22) * PG_K;
    var L = m.line; L.setAttribute('x1', x.toFixed(1)); L.setAttribute('x2', x.toFixed(1)); L.setAttribute('y1', y0.toFixed(1)); L.setAttribute('y2', y1.toFixed(1)); L.style.display = '';
    if (fgPages.classList.contains('zoomed') && (playing || counting)) {   /* zoomed in: follow the line sideways too */
      var lr = L.getBoundingClientRect(), pr = fgPages.getBoundingClientRect();
      if (lr.left < pr.left + 20 || lr.right > pr.right - 20) fgPages.scrollLeft += lr.left - pr.left - pr.width * 0.25;
    }
    /* a new line of music: keep it on screen (Trix), about a quarter of the way down; only while the music moves, or on opening */
    if (m.si !== fgSys) {
      fgSys = m.si;
      if (playing || counting || jump) {
        var rc = L.getBoundingClientRect(), vh = window.innerHeight, top = rc.top - 30;
        if (top < 70 || rc.bottom > vh - 20) window.scrollTo({ top: Math.max(0, window.scrollY + top - vh * 0.25), behavior: jump ? 'auto' : 'smooth' });
      }
    }
  }
  if (fgSel) {
    fgSel.addEventListener('change', function () { songSel.value = fgSel.value; load(+songSel.value); });   /* one current tune for both tools */
    $('fgImport').addEventListener('click', function () { $('mpImport').click(); });   /* the same import, the same list */
    $('fgDel').addEventListener('click', function () { APP.askDelete(fgSel); });   /* the player's delete, after asking: the same list (Trix) */
    /* a click or tap on a note jumps there (Trix), as on the MIDI player's score: paused, it shows lit with its fingering;
       playing, the music goes on from it. The nearest note in the system clicked, within 28 score units sideways.
       Not after a drag (text selection, scrolling). */
    var fgDown = null;
    fgPages.addEventListener('pointerdown', function (e) { fgDown = [e.clientX, e.clientY]; });
    function fgNoteAt(e) {
      var svg = e.target.closest && e.target.closest('svg.fg-page'); if (!svg || !fgR || !song) return -1;
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse()), best = null, bd = Infinity;
      fgMap.forEach(function (m) {
        if (m.svg !== svg) return;
        var mid = m.oy + (Y0 + 2 * S) * PG_K, d = Math.abs(p.y - mid);
        if (d < bd && d < (2 * S + 50) * PG_K) { bd = d; best = m; }
      });
      if (!best) return -1;
      fgMap.forEach(function (m) {   /* the piece of that line under the tap */
        if (m.svg !== svg || m.oy !== best.oy) return;
        var xl = (p.x - m.ox) / PG_K - m.tx;
        if (xl >= fgR.xAt(m.b0) - 14 && xl <= fgR.xAt(m.b1) + 2) best = m;
      });
      var xi = (p.x - best.ox) / PG_K - best.tx, k = -1, dx = 28;
      song.notes.forEach(function (n, i) {
        if (n.b < best.b0 - 1e-6 || n.b >= best.b1 - 1e-6 || n.grace) return;
        var d = Math.abs(fgR.xAt(n.b) - xi); if (d < dx) { dx = d; k = i; }
      });
      return k;
    }
    fgPages.addEventListener('click', function (e) {
      if (!song || !fgDown || Math.abs(e.clientX - fgDown[0]) > 6 || Math.abs(e.clientY - fgDown[1]) > 6) return;
      if (window.getSelection && String(window.getSelection())) return;
      var k = fgNoteAt(e); if (k < 0) return;
      var t = song.notes[k].t;
      if (counting) { stopCount(); seekTo(Math.max(0, t - 0.001)); go(); return; }   /* during the count-in: straight on from the note */
      if (playing) { seekTo(Math.max(0, t - 0.001)); accStart(); return; }   /* playing: on from the note, the accompaniment with it */
      if (t < 0.01) { seekTo(0); showAt(true); }   /* the first note: at the top (the count-in still comes), shown */
      else seekTo(t + 0.001);   /* just inside the note, so it shows lit and resumes sounding */
    });
    /* Ctrl + mouse wheel zooms the pages (Trix), 50 % to 300 %, keeping the point under the pointer still; the PDF is not affected */
    var fgZoom = 1;
    function fgWide() {   /* past 100 %: the box spans the browser window, edge to edge (its column's own left offset undone) */
      var on = fgZoom > 1.001, bar = fgPages.parentNode.querySelector('.fg-fitbar'), host = fgPages.parentNode;
      fgPages.classList.remove('zoomed'); if (bar) bar.classList.remove('zoomed');
      if (on) {
        var left = fgPages.getBoundingClientRect().left + window.scrollX;
        host.style.setProperty('--fgml', -left + 'px');   /* on the parent: the pages and the button's strip both widen */
        host.style.setProperty('--fgvw', document.documentElement.clientWidth + 'px');
        fgPages.classList.add('zoomed'); if (bar) bar.classList.add('zoomed');
      }
    }
    window.addEventListener('resize', function () { if (fgZoom > 1.001) { var sl = fgPages.scrollLeft; fgWide(); fgPages.scrollLeft = sl; } if (fgShown && window.APP && APP.fgZoomUi) APP.fgZoomUi(); });
    function setZoom(z1, cx, cy) {   /* cx, cy: the screen point that stays still */
      var z0 = fgZoom; z1 = Math.max(0.5, Math.min(3, z1));
      if (Math.abs(z1 - z0) < 1e-3) return;
      var p0 = fgPages.querySelector('.fg-page'); if (!p0) return;
      var a = p0.getBoundingClientRect(), dx = cx - a.left, dy = cy - a.top, k = z1 / z0;
      if (!fgPages.classList.contains('zoomed')) fgPages.style.setProperty('--fgw', fgPages.clientWidth + 'px');   /* the column width = 100 % */
      fgZoom = z1;
      fgPages.style.setProperty('--fgz', z1.toFixed(3));
      fgWide();
      var b = p0.getBoundingClientRect();
      fgPages.scrollLeft += b.left + dx * k - cx;
      window.scrollBy(0, b.top + dy * k - cy);
      zoomUi();
    }
    fgPages.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(fgZoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002)), e.clientX, e.clientY);
    }, { passive: false });
    /* the button at the top right of the pages (Trix): straight to the browser's full width, and back to the normal size */
    var fgFit = $('fgFit');
    function zoomUi() {
      var big = Math.abs(fgZoom - 1) > 0.01;
      /* only where full width gains something (Trix): not on an upright phone; always while zoomed, to come back */
      var col = fgPages.classList.contains('zoomed') ? parseFloat(getComputedStyle(fgPages).getPropertyValue('--fgw')) || fgPages.clientWidth : fgPages.clientWidth;
      fgFit.hidden = !big && !(col > 0 && (document.documentElement.clientWidth - 32) / col > 1.1);
      fgFit.classList.toggle('back', big);
      fgFit.setAttribute('aria-label', big ? 'Back to normal size' : 'Full width');
      fgFit.title = big ? 'Back to normal size' : 'Full width';
    }
    fgFit.addEventListener('click', function (e) {
      e.stopPropagation();
      var cx = window.innerWidth / 2, cy = Math.min(window.innerHeight / 2, Math.max(0, fgPages.getBoundingClientRect().top + 40));
      if (Math.abs(fgZoom - 1) > 0.01) { setZoom(1, cx, cy); return; }
      var col = fgPages.clientWidth, full = document.documentElement.clientWidth - 32;   /* a 16 px margin each side */
      setZoom(Math.min(3, full / col), cx, cy);
      if (fgZoom <= 1.001) zoomUi();   /* a window no wider than the column: nothing to gain */
    });
    zoomUi(); APP.fgZoomUi = zoomUi;
    /* more controls (Trix): each one presses the MIDI player's own button; the Mixer and A–B panels move under the
       floating buttons while open from here, and back to the player's bar when opened there */
    var fgMore = $('fgMore'), fgx = $('fgx'), fgx2 = $('fgx2'), mpBarEl = $('mpBar'), fitBar = fgPages.parentNode.querySelector('.fg-fitbar');
    fgMore.addEventListener('click', function () { fgx.hidden = !fgx.hidden; fgx2.hidden = fgx.hidden; fgMore.setAttribute('aria-expanded', fgx.hidden ? 'false' : 'true'); if (fgx.hidden) { setMixOpen(false); setABOpen(false); } });   /* the player's order: back to start, −, play, +, mixer; then loop, A–B (Trix) */
    Array.prototype.forEach.call(fgPages.parentNode.querySelectorAll('.fg-fitbar [data-for]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = b.dataset.for, src = $(id);
        if (id === 'mpMix' || id === 'mpAB') {
          if (mixPop.parentNode !== fitBar) { fitBar.appendChild(mixPop); fitBar.appendChild(abPop); }
          if (id === 'mpMix') { setABOpen(false); setMixOpen(mixPop.hidden); } else setABOpen(abPop.hidden);
          return;
        }
        if (src && !src.disabled) src.click();
      });
    });
    [mixBtn, abBtn].forEach(function (b) {   /* opened in the player: the panels go home to its bar first */
      b.addEventListener('click', function () { if (mixPop.parentNode !== mpBarEl) { mpBarEl.insertBefore(abPop, mpBarEl.firstChild); mpBarEl.insertBefore(mixPop, abPop); } }, true);
    });
    APP.fgxSync = function () {
      Array.prototype.forEach.call(fgPages.parentNode.querySelectorAll('.fg-fitbar [data-for]'), function (b) {
        var src = $(b.dataset.for); if (!src) return;
        b.disabled = !!src.disabled;
        if (src.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', src.getAttribute('aria-pressed'));
        if (b.dataset.for === 'mpMix') b.setAttribute('aria-expanded', !mixPop.hidden && mixPop.parentNode === fitBar ? 'true' : 'false');
        if (b.dataset.for === 'mpAB') b.setAttribute('aria-expanded', !abPop.hidden && abPop.parentNode === fitBar ? 'true' : 'false');
      });
    };
    APP.fgxSync();
    $('fgPlay').addEventListener('click', function () {   /* play / pause the MIDI player from here, staying on the pages (Trix); its speed, loop and A–B */
      if (!song) return;
      if (playing || counting) { pause(); return; }
      bg = true; play();   /* inside the tap, so the sound may start (iPhone) */
    });
    $('mpFg').addEventListener('click', function (e) { e.stopPropagation(); APP.show('fingering'); window.scrollTo(0, 0); });
    $('mpFg').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    document.addEventListener('i18n', function () { fgOptions(); if (fgShown) fgRender(); else fgDirty = true; });
    /* the iPhone Home Screen web app (Trix): window.print() does nothing there, so the page makes the PDF itself.
       Each A4 page is drawn at 300 dpi (its SVG with the styles and fonts written in, onto a canvas), the JPEGs
       go into a small PDF written here, and the share sheet offers it (Save to Files, AirDrop, Print). Sharing needs
       a fresh tap, so the button turns into "Share PDF" once the file is ready */
    var fgReady = null;
    APP.fgReset = function () { if (fgReady) { fgReady = null; fgButton(false); fgSay(''); } };   /* another tune: the old file is gone */
    function homeScreenIos() {
      var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return window.VT_FORCE_RASTER || (ios && !window.VTiOSApp && (navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)));
    }
    function fgSay(t) { fgMsg.hidden = !t; fgMsg.textContent = t || ''; }
    function fgButton(ready) {
      var zh = window.I18N && I18N.lang === 'zh', t = fgPdf.lastChild;
      if (t && t.nodeType === 3) t.textContent = ready ? (zh ? '分享 PDF' : 'Share PDF') : (zh ? '导出' : 'Export');
    }
    var STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing'];
    function pageSvgText(svgEl, fontCss) {
      var clone = svgEl.cloneNode(true), src = svgEl.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      for (var i = 0; i < src.length; i++) {
        var cs = getComputedStyle(src[i]), st = [];
        STYLE_PROPS.forEach(function (pr) { var v = cs.getPropertyValue(pr); if (v) st.push(pr + ':' + v); });
        if (src[i].classList.contains('mp-pos')) st.push('transform:skewX(-14deg)', 'transform-box:fill-box', 'transform-origin:50% 100%');
        dst[i].setAttribute('style', st.join(';'));
        if (src[i].classList.contains('fg-head')) dst[i].setAttribute('data-drop', '1');   /* the play line: not in the PDF (Hermes F46) */
        dst[i].removeAttribute('class');
      }
      Array.prototype.forEach.call(clone.querySelectorAll('[data-drop]'), function (el) { el.remove(); });
      clone.setAttribute('width', '2480'); clone.setAttribute('height', '3508');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = fontCss;
      clone.insertBefore(style, clone.firstChild);
      return new XMLSerializer().serializeToString(clone);
    }
    function fontFaces() {   /* the app's own fonts (inlined as data URLs in the page), so fingerings look the same */
      var out = [];
      Array.prototype.forEach.call(document.styleSheets, function (sh) { try { Array.prototype.forEach.call(sh.cssRules, function (r) { if (r.type === 5) out.push(r.cssText); }); } catch (e) {} });
      return out.join('\n');
    }
    function pageJpeg(svgText) {
      return new Promise(function (ok, bad) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas'); c.width = 2480; c.height = 3508;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) { if (!b) { bad(new Error('jpeg')); return; } b.arrayBuffer().then(function (ab) { c.width = c.height = 1; ok(new Uint8Array(ab)); }, bad); }, 'image/jpeg', 0.9);
        };
        img.onerror = function () { bad(new Error('page image')); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      });
    }
    function pdfFromJpegs(jpegs, title) {   /* PDF 1.4: one A4 page per image (DCTDecode), no library */
      var enc = new TextEncoder(), parts = [], pos = 0, offs = [];
      function add(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; }
      function obj(n, body) { offs[n] = pos; add(n + ' 0 obj\n'); body(); add('\nendobj\n'); }
      var n = jpegs.length, W = 595.28, H = 841.89, kids = [];
      for (var i = 0; i < n; i++) kids.push((3 + 3 * i) + ' 0 R');
      add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
      obj(1, function () { add('<< /Type /Catalog /Pages 2 0 R >>'); });
      obj(2, function () { add('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
      jpegs.forEach(function (jp, i) {
        var pg = 3 + 3 * i, ct = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
        obj(pg, function () { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + (pg + 2) + ' 0 R >> >> /Contents ' + (pg + 1) + ' 0 R >>'); });
        obj(pg + 1, function () { add('<< /Length ' + ct.length + ' >>\nstream\n' + ct + '\nendstream'); });
        obj(pg + 2, function () { add('<< /Type /XObject /Subtype /Image /Width 2480 /Height 3508 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jp.length + ' >>\nstream\n'); add(jp); add('\nendstream'); });
      });
      var info = 3 + 3 * n, hex = 'FEFF';
      for (var c = 0; c < title.length; c++) hex += ('000' + title.charCodeAt(c).toString(16)).slice(-4).toUpperCase();
      obj(info, function () { add('<< /Title <' + hex + '> /Creator (Violin Toolkit) >>'); });
      var xref = pos, rows = ['0000000000 65535 f '];
      for (var k = 1; k <= info; k++) rows.push(('000000000' + offs[k]).slice(-10) + ' 00000 n ');
      add('xref\n0 ' + (info + 1) + '\n' + rows.join('\n') + '\ntrailer\n<< /Size ' + (info + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
      var out = new Uint8Array(pos), o = 0; parts.forEach(function (b) { out.set(b, o); o += b.length; });
      return out;
    }
    function rasterPdf() {
      var zh = window.I18N && I18N.lang === 'zh', pages = Array.prototype.slice.call(fgPages.querySelectorAll('.fg-page')), fonts = fontFaces(), jpegs = [], title = fgFileName();
      fgPdf.disabled = true; fgSay(zh ? '正在生成 PDF…' : 'Making the PDF…');
      var chain = Promise.resolve();
      pages.forEach(function (pg, i) { chain = chain.then(function () { fgSay((zh ? '正在生成 PDF… ' : 'Making the PDF… ') + (i + 1) + '/' + pages.length); return pageJpeg(pageSvgText(pg, fonts)); }).then(function (j) { jpegs.push(j); }); });
      chain.then(function () {
        var bytes = pdfFromJpegs(jpegs, title);
        window.__fgPdfBytes = bytes;   /* tests read it */
        fgReady = new File([bytes], title + '.pdf', { type: 'application/pdf' });
        fgPdf.disabled = false; fgButton(true); fgSay(zh ? 'PDF 已就绪，点“分享 PDF”保存或发送。' : 'The PDF is ready: tap Share PDF to save or send it.');
      }).catch(function (e) { console.error('Fingerings PDF', e); fgPdf.disabled = false; fgSay(zh ? '无法生成 PDF。' : 'The PDF could not be made.'); });
    }
    function sharePdf() {
      var f = fgReady; fgReady = null; fgButton(false); fgSay('');
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: f.name }).catch(function () {}); return; }
      var u = URL.createObjectURL(f); window.open(u, '_blank') || (location.href = u);   /* no share sheet: open it (Safari's own share / print) */
    }
    /* an imported piece (Trix): before every export, a reminder that its pages are for personal use unless the
       original score's licence allows more; Cancel or Export, every time (no "don't show again") */
    var warn = $('fgWarn'), warnGo = $('fgWarnGo'), warnCancel = $('fgWarnCancel'), warnOpener = null, warnThen = null;
    function closeWarn() { warn.hidden = true; window.removeEventListener('keydown', onWarnKey, true); try { warnOpener.focus(); } catch (e) {} }
    function onWarnKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeWarn(); }
      else if (e.key === 'Tab') { e.stopPropagation(); e.preventDefault(); (document.activeElement === warnGo ? warnCancel : warnGo).focus(); }
    }
    warnCancel.addEventListener('click', closeWarn);
    warn.addEventListener('click', function (e) { if (e.target === warn) closeWarn(); });
    warnGo.addEventListener('click', function () { var f = warnThen; closeWarn(); if (f) f(); });   /* still inside the tap: printing and sharing are allowed */
    fgPdf.addEventListener('click', function () {
      if (!song) return;
      if (playing || counting) pause();   /* Export pauses the music first (Trix): the print / share window would leave a note sounding */
      if (fgReady) { sharePdf(); return; }
      var s = songs[+songSel.value];
      if (s && s.kept) { warnThen = exportPdf; warnOpener = fgPdf; warn.hidden = false; window.addEventListener('keydown', onWarnKey, true); warnGo.focus(); return; }
      exportPdf();
    });
    function exportPdf() {
      if (!song) return;
      if (!window.VTiOSApp && homeScreenIos()) { rasterPdf(); return; }
      var ios = window.VTiOSApp && window.webkit && webkit.messageHandlers && webkit.messageHandlers.vt;
      if (ios) {   /* the iPhone app: only the A4 pages on screen (html.fg-shot), captured page by page into a PDF for the share sheet */
        document.documentElement.classList.add('fg-shot');
        webkit.messageHandlers.vt.postMessage({ print: fgFileName(), name: fgFileName(), pages: fgPages.querySelectorAll('.fg-page').length });
        return;
      }
      document.documentElement.classList.add('fg-printing');
      if (window.VTApp && VTApp.print) { VTApp.print(fgFileName()); return; }   /* the Android app: the system print screen (Save as PDF) */
      /* Save as PDF names the file after the page's title: the piece's name while the print screen is up, the
         app's own again afterwards (afterprint fires on save and on cancel; a timer in case a browser skips it) */
      var was = document.title, back = false, timer = 0;
      var restore = function () { if (back) return; back = true; document.title = was; window.removeEventListener('afterprint', restore); clearTimeout(timer); };
      document.title = fgFileName();
      window.addEventListener('afterprint', restore);
      timer = setTimeout(restore, 60000);
      setTimeout(function () { window.print(); }, 50);   /* the next tick, so the print preview reads the new title */
    }
    window.addEventListener('afterprint', function () { document.documentElement.classList.remove('fg-printing'); });
    APP.fgPrinted = function () { document.documentElement.classList.remove('fg-printing'); document.documentElement.classList.remove('fg-shot'); };   /* the apps call this when their print screen closes */
    APP.views.fingering = {
      show: function () { fgShown = true; fgOptions(); if (fgDirty) fgRender(); fgSys = -1; fgHead(true); if (APP.fgZoomUi) APP.fgZoomUi(); },
      hide: function () {
        fgShown = false;
        if (bg && APP.nextView !== 'midi') { bg = false; pause(); APP.board.player(false); }   /* playing on from the player: it stops when neither tool shows */
      }
    };
  }
  /* ---------- Play-along (跟音练习, Trix) ----------
     One take, two views of it: Pages (the Fingerings pages, turning with the take) and Live (the player's score strip and
     the fingerboard, with the note due and the note heard). The take is the player playing the tune from the top
     (with sound only after the player says they wear headphones) while the microphone is turned into numbers (assess.js
     framer: a pitch and a level every 512 samples; the audio itself is never kept). Stop ends a take for good; the
     analysis runs after it, in slices, and tints each bar. */
  var paBrowse = null, paDrag = null, paDragMoved = false;   /* Live, a result showing: the strip dragged by hand (Trix) */
  var paView = 'pages', paRes = null, paSaved = null, paRaf = 0, paShowMode = 'both', paShowEl = $('paShow');
  try { var psm = localStorage.getItem('violin-pa-show'); if (psm === 'pitch' || psm === 'time') paShowMode = psm; } catch (e) {}
  try { paView = localStorage.getItem('violin-pa-view') === 'live' ? 'live' : 'pages'; } catch (e) {}
  var paSeg = $('paSeg'), paRec = $('paRec'), paRecTxt = $('paRecTxt'), paTime = $('paTime'), paLvl = $('paLvl'), paMeter = $('paMeter');
  var paFill = $('paFill'), paTicks = $('paTicks'), paPage = $('paPage'), paBarNow = $('paBarNow'), paHp = $('paHp'), paWarn = $('paWarn');
  var paNeedle = $('paNeedle'), paNName = $('paNName'), paPin = $('paPin'), paNCents = $('paNCents'), paResEl = $('paRes'), paGate = $('paGate');
  var PA_CAP = 'class PaCap extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.n=0}' +
    'process(i){var x=i[0]&&i[0][0];if(!x)return true;for(var k=0;k<x.length;k++){this.b[this.n++]=x[k];if(this.n===1024){this.port.postMessage({f:currentFrame+k+1-1024,x:this.b},[this.b.buffer]);this.b=new Float32Array(1024);this.n=0}}return true}}' +
    'registerProcessor("pa-cap",PaCap);';
  APP.paShows = function (n) { return paView === 'live' ? n === 'midi' || n === 'board' : n === 'fingering'; };
  function paZh() { return window.I18N && I18N.lang === 'zh'; }
  function paLayout() {
    ['midi', 'board', 'fingering'].forEach(function (n) { var v = document.getElementById('view-' + n); if (v) v.hidden = !APP.paShows(n); });
    Array.prototype.forEach.call(paSeg.children, function (b) { b.setAttribute('aria-checked', b.dataset.v === paView ? 'true' : 'false'); });
    if (paView === 'live') { fgShown = false; shown = true; fit(); }
    else { shown = false; fgShown = true; fgOptions(); if (fgDirty) fgRender(); fgSys = -1; fgHead(true); }
    paRetint(); paUi();
  }
  paSeg.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.dataset.v === paView) return;
    paView = b.dataset.v;   /* a change of view only: the take goes on */
    try { localStorage.setItem('violin-pa-view', paView); } catch (err) {}
    if (paOn) paLayout();
  });
  paShowEl.addEventListener('click', function (e) {   /* what the result shows (Trix): pitch, timing, or both; remembered */
    var b = e.target.closest('button'); if (!b) return;
    paShowMode = b.dataset.s; try { localStorage.setItem('violin-pa-show', paShowMode); } catch (err) {}
    paUi();
  });
  paSeg.addEventListener('keydown', function (e) {   /* arrow keys between the two, as a radio group */
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); paSeg.querySelector('[data-v="' + (paView === 'pages' ? 'live' : 'pages') + '"]').click(); paSeg.querySelector('[aria-checked="true"]').focus();
  });
  /* the record control: Start (a dot), Stop (a square) while a take runs, Start again (a dot) after one; never resume */
  function paUi() {
    var rec = !!paTake, busy = paTake && paTake.state === 'analysing';
    paRec.classList.toggle('rec', rec && !busy);
    paRecTxt.textContent = busy ? 'Analysing…' : rec ? 'Stop' : paRes ? 'Start again' : 'Start';
    paRec.disabled = !!busy || !song;
    paRec.setAttribute('aria-label', paRecTxt.textContent);
    paHp.hidden = !rec || busy;
    var hpTxt = $('paHpTxt'); if (hpTxt && paTake) hpTxt.textContent = paTake.sound ? 'Headphones only: the microphone is on.' : 'No sound: the microphone is on.';
    paNeedle.hidden = !(rec && !busy && paView === 'live');
    paResEl.hidden = !paRes || rec;
    var sh = document.getElementById('shell'); if (sh) { sh.classList.toggle('pa-result', !!(paRes && !paRes.empty) && !rec); sh.classList.toggle('pa-sp', paShowMode !== 'time'); sh.classList.toggle('pa-st', paShowMode !== 'pitch'); }   /* fingerings hidden while a result shows; Pitch | Timing | Both */
    Array.prototype.forEach.call(paShowEl.children, function (b) { b.setAttribute('aria-checked', b.dataset.s === paShowMode ? 'true' : 'false'); });
    if (songSel) songSel.disabled = rec; if (fgSel) fgSel.disabled = rec;
    paClock();
  }
  function paClock() {
    if (!song) { paTime.textContent = ''; return; }
    var p = Math.min(pos, song.end);
    paTime.textContent = fmt(p) + ' / ' + fmt(song.end);
    paFill.style.width = (song.end ? 100 * p / song.end : 0).toFixed(2) + '%';
    var beat = counting ? Math.max(0, countBeat) : song.toBeat(p), bo = song.barAt ? song.barAt(Math.max(0, beat)) : null;
    paBarNow.textContent = bo && (paTake || pos > 0.01) ? 'Bar ' + bo.num : '';
    var pg = null; if (fgMap.length) { var wb = writtenBeat(beat); fgMap.forEach(function (m) { if (m.b0 <= wb + 1e-6) pg = m.pi; }); }
    var nPg = fgMap.length ? fgMap[fgMap.length - 1].pi + 1 : 0;
    paPage.textContent = nPg && pg !== null ? 'Page ' + (pg + 1) + ' of ' + nPg : '';
  }
  function paTickMarks() {   /* a tick where each page starts */
    paTicks.textContent = '';
    if (!song || !fgMap.length) return;
    var seen = {};
    fgMap.forEach(function (m) {
      if (!m.pi || seen[m.pi]) return; seen[m.pi] = 1;
      var i = document.createElement('i'); i.style.left = (100 * song.beatSec(m.b0) / song.end).toFixed(2) + '%'; paTicks.appendChild(i);
    });
  }
  /* the gate: before the microphone is even asked for (Cancel opens nothing), every take, never remembered */
  var paGateFrom = null;
  function paGateOpen() { paGateFrom = document.activeElement; paGate.hidden = false; $('paGo').focus(); }
  function paGateClose() { paGate.hidden = true; if (paGateFrom && paGateFrom.focus) paGateFrom.focus(); }
  paGate.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); paGateClose(); }
    else if (e.key === 'Tab') {   /* focus stays inside */
      var bs = Array.prototype.slice.call(paGate.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      e.preventDefault(); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus();
    }
  });
  $('paCancel').addEventListener('click', paGateClose);
  $('paGo').addEventListener('click', function () { paGateClose(); paBegin(true); });
  $('paMute').addEventListener('click', function () { paGateClose(); paBegin(false); });
  paRec.addEventListener('click', function () {
    if (paTake) { if (paTake.state !== 'analysing') paStop(); return; }
    if (!song) return;
    paGateOpen();
  });
  function paSay(text) { paWarn.textContent = text; paWarn.hidden = !text; }
  function paBegin(sound) {
    if (!APP.board.prime()) return;   /* inside the tap: the sound engine may start (iPhone) */
    var au = APP.board.audio(), ctx = au && au.ctx;
    if (!ctx || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { paSay('The microphone is not available.'); return; }
    var T = paTake = { state: 'starting', sound: sound, ctx: ctx, f0: -1, next: -1, fr: ASSESS.framer(ctx.sampleRate, window.yin), quietSince: 0, warned: false, ctxGo: 0, recEnd: 0 };
    paRes = null; paBrowse = null; paClearTints(); paSay(''); paCardClose(); paUi();
    APP.mic('pa', true);
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
      if (paTake !== T) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      T.stream = stream; T.src = ctx.createMediaStreamSource(stream);
      T.sink = ctx.createGain(); T.sink.gain.value = 0; T.sink.connect(ctx.destination);   /* pulls the capture node; silent */
      function feed(f, x) {
        if (paTake !== T || T.state === 'analysing') return;
        if (T.f0 < 0) { T.f0 = f; T.next = f; }
        if (f > T.next && f - T.next < ctx.sampleRate) T.fr.push(new Float32Array(f - T.next));   /* a dropped block: silence keeps the clock */
        T.fr.push(x); T.next = f + x.length;
      }
      var ready = ctx.audioWorklet && window.AudioWorkletNode
        ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PA_CAP], { type: 'application/javascript' }))).then(function () {
            var n = new AudioWorkletNode(ctx, 'pa-cap'); n.port.onmessage = function (e) { feed(e.data.f, e.data.x); }; return n;
          })
        : Promise.resolve().then(function () {   /* older browsers: a script processor */
            var n = ctx.createScriptProcessor(1024, 1, 1);
            n.onaudioprocess = function (e) { feed(Math.round(e.playbackTime * ctx.sampleRate), new Float32Array(e.inputBuffer.getChannelData(0))); };
            return n;
          });
      return ready.then(function (node) {
        if (paTake !== T) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        T.node = node; T.src.connect(node); node.connect(T.sink);
        paStartTake(T);
      });
    }).catch(function (err) {
      if (paTake !== T) return;
      APP.mic('pa', false); paTake = null;
      paSay(err && err.name === 'NotAllowedError' ? 'The microphone is blocked.' : 'The microphone is not available.');
      paUi();
    });
  }
  function paStartTake(T) {
    /* the take: from the top, at the score's tempo, no loop or A–B; without sound nothing is scheduled at all */
    paSaved = { speed: speed, loop: loop, ab: ab };
    pause(); speed = 1; loop = false; ab = null; abUi(); seekTo(0);
    if (paView === 'pages') fit();   /* the board plays the violin part, so it is in player mode even while the pages show */
    paMute = !T.sound;
    T.state = 'count';
    countIn(function () { T.ctxGo = T.ctx.currentTime; T.state = 'rec'; go(); });
    paUi(); paLoop();
  }
  function paLoop() {
    cancelAnimationFrame(paRaf);
    paRaf = requestAnimationFrame(function () {
      var T = paTake; if (!T || T.state === 'analysing') return;
      var fr = T.fr, k = fr.rms.length - 1, rms = k >= 0 ? fr.rms[k] : 0, f = k >= 0 ? fr.f[k] : 0;
      var db = rms > 0 ? 20 * Math.log(rms) / Math.LN10 : -90, lv = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
      paLvl.style.width = lv.toFixed(0) + '%'; paMeter.setAttribute('aria-valuenow', Math.round(lv));
      if (T.state === 'rec') {   /* 2 s below the gate during the take: said once */
        var nowT = performance.now();
        if (rms > ASSESS.GATE) T.quietSince = 0; else if (!T.quietSince) T.quietSince = nowT;
        if (!T.warned && T.quietSince && nowT - T.quietSince > 2000) { T.warned = true; paSay('The microphone can not hear the violin.'); }
        if (rms > ASSESS.GATE * 2 && T.warned && !paWarn.hidden) paSay('');
      }
      if (paView === 'live') paHeard(f, rms);
      paClock();
      paLoop();
    });
  }
  /* live: the note due (lit on the board by the player, on its string and finger) against the note heard (Pitch
     Check's disc on that string, and a needle over ±50 cents); a pitch with no note due: a disc alone */
  function paHeard(f, rms) {
    if (!f || rms <= ASSESS.GATE) { APP.board.heard(null); paNeedle.classList.add('quiet'); paNName.textContent = '\u00a0'; paNCents.textContent = '\u00a0'; paPin.style.left = '50%'; return; }
    paNeedle.classList.remove('quiet');
    var due = null, ns = song.notes;
    for (var k = Math.max(0, ni - 4); k < ns.length && ns[k].t <= pos + 0.02; k++) if (ns[k].e > pos - 0.05 && !ns[k].grace) due = ns[k];
    var m = 69 + 12 * Math.log(f / (APP.a4 || 440)) / Math.LN2;
    if (!due) { APP.board.heard({ m: m, cents: 99, si: -1 }); paNName.textContent = APP.board.name(Math.round(m)); paNCents.textContent = '—'; paPin.style.left = '50%'; return; }
    var c = 1200 * Math.log(f / APP.board.hz(due.m, due.si, due.fg === 0)) / Math.LN2;
    while (c > 600) c -= 1200; while (c < -600) c += 1200;
    APP.board.heard({ m: due.m + c / 100, cents: c, si: due.si });
    paNName.textContent = APP.board.name(due.m);
    paNCents.textContent = (c >= 0 ? '+' : '−') + Math.abs(Math.round(c)) + ' ¢';
    paPin.style.left = (50 + Math.max(-50, Math.min(50, c))).toFixed(1) + '%';
    paNeedle.classList.toggle('off', Math.abs(c) > 10);
  }
  /* Stop: the take is over for good (Start again begins a new one); what was captured is analysed */
  function paStop() {
    var T = paTake; if (!T || T.state === 'analysing') return;
    var started = T.state === 'rec';
    T.recEnd = Math.min(pos, song.end);
    T.state = 'analysing';
    if (T.stream) T.stream.getTracks().forEach(function (t) { t.stop(); });
    try { if (T.src) T.src.disconnect(); if (T.node) { T.node.disconnect(); if (T.node.port) T.node.port.onmessage = null; } if (T.sink) T.sink.disconnect(); } catch (e) {}
    APP.mic('pa', false);
    pause(); stopCount(); paMute = false;
    if (paSaved) { speed = paSaved.speed; loop = paSaved.loop; ab = paSaved.ab; abUi(); paSaved = null; }
    APP.board.heard(null); paSay(''); ui();
    paUi();
    if (!started || T.f0 < 0) { paTake = null; paRes = { empty: true, bars: [], partial: 'Nothing was recorded.' }; paShowResult(); return; }
    /* the score on the take's clock: a note at song time t was due at frame time t + shift */
    var shift = T.ctxGo - T.f0 / T.ctx.sampleRate, cut = T.recEnd + 0.05;
    var notes = song.notes.filter(function (n) { return n.t < cut; }).map(function (n) { return { t: n.t + shift, e: n.e + shift, m: n.m, b: n.b, grace: n.grace, si: n.si, fg: n.fg }; });
    var job = ASSESS.job(T.fr, { notes: notes }, { hz: function (n) { return APP.board.hz(n.m, n.si, n.fg === 0); } }), t0 = performance.now();
    (function slice() {
      if (paTake !== T) return;
      if (!job.step(30)) { setTimeout(slice, 0); return; }
      T.fr = null;   /* the numbers from the microphone go too: only the per-note results stay, for this session */
      paTake = null;
      paRes = paSummarise(job.result, T.recEnd); paRes.secs = (performance.now() - t0) / 1000;
      paShowResult();
    })();
  }
  APP.paAnalysisSecs = function () { return paRes && paRes.secs; };   /* tests */
  function paSummarise(an, recEnd) {
    var bars = song.bars || [], recBeat = song.toBeat(recEnd), recBars = bars.filter(function (b) { return b.beat < recBeat - 1e-6; });
    var sum = ASSESS.summarise(an, recBars.length ? recBars : bars.slice(0, 1));
    var total = bars.length ? bars[bars.length - 1].num : '', lastRec = recBars.length ? recBars[recBars.length - 1].num : '';
    if (recBars.length && recBars.length < bars.length) sum.partial = bars[0].num === lastRec ? 'Only bar ' + lastRec + ' of ' + total + ' was recorded.' : 'Only bars ' + bars[0].num + '–' + lastRec + ' of ' + total + ' were recorded.';   /* one bar: singular (Hermes F82) */
    sum.temper = APP.temper ? APP.temper.id : 'equal';
    sum.bars.forEach(function (b, i) { b.idx = i; });
    return sum;
  }
  function paShowResult() {
    var R = paRes; paUi();
    var part = $('paPartial'); part.textContent = R.partial || ''; part.hidden = !R.partial;
    var st = $('paStats'); st.textContent = '';
    if (!R.empty) {   /* a bar each for pitch and timing (Trix): how many notes fell in each band, the green share large */
      var all = [], P = { ok: 0, amber: 0, red: 0, miss: 0 }, T = { ok: 0, amber: 0, red: 0, miss: 0 };
      R.bars.forEach(function (b) { b.notes.forEach(function (r) { all.push(r); }); });
      all.forEach(function (r) {
        if (r.missed || r.chord || r.cents === undefined) { P.miss++; T.miss++; return; }
        var c = Math.abs(r.cents); P[c <= ASSESS.IN_TUNE ? 'ok' : c <= ASSESS.RED ? 'amber' : 'red']++;
        if (r.timing === null || r.timing === undefined) { T.miss++; return; }
        var t = Math.abs(r.timing); T[t <= ASSESS.IN_TIME ? 'ok' : t <= PA_TIME_RED ? 'amber' : 'red']++;
      });
      [['Pitch', 'in tune', P, ''], ['Timing', 'on time', T, ' time']].forEach(function (row) {
        var C = row[2], n = C.ok + C.amber + C.red + C.miss; if (!n) return;
        var box = document.createElement('div'); box.className = 'pa-sb';
        var h = document.createElement('div'); h.className = 'pa-sb-h';
        var b = document.createElement('b'); b.textContent = row[0]; h.appendChild(b);
        var big = document.createElement('span'); big.className = 'pa-sb-big'; big.setAttribute('translate', 'no'); big.textContent = Math.round(100 * C.ok / n) + '%'; h.appendChild(big);
        var sm = document.createElement('small'); sm.textContent = row[1]; h.appendChild(sm);
        box.appendChild(h);
        var bar = document.createElement('div'); bar.className = 'pa-sb-bar' + row[3]; bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', row[0] + ': ' + ['ok', 'amber', 'red', 'miss'].map(function (k) { return Math.round(100 * C[k] / n) + '%'; }).join(', '));
        ['ok', 'amber', 'red', 'miss'].forEach(function (k) {
          if (!C[k]) return;
          var seg = document.createElement('i'), pc = 100 * C[k] / n; seg.className = 's-' + k; seg.style.flex = '0 0 ' + pc.toFixed(2) + '%';
          seg.textContent = pc >= 12 ? Math.round(pc) + '%' : ''; seg.title = C[k] + ' / ' + n; seg.setAttribute('translate', 'no');
          bar.appendChild(seg);
        });
        box.appendChild(bar); st.appendChild(box);
      });
    }
    $('paTemper').textContent = R.empty ? '' : { equal: 'Measured against Equal temperament.', just: 'Measured against Just intonation.', pyth: 'Measured against Pythagorean tuning.' }[R.temper] || 'Measured against Equal temperament.';
    $('paLegend').hidden = !!R.empty;   /* no list of the worst bars (Trix): the tints show them, a tap opens one */
    paRetint();
  }
  /* a bar tapped (on the tints or in the list): A–B on that bar, and the player opens there */
  function paOpenBar(i) {
    if (!song || !song.bars[i]) return;
    ab = { a: i, b: i }; abUi(); pause(); seekTo(abRange().aT);
    APP.show('midi');
  }
  /* the marks (Trix): each notehead coloured by its pitch — green within 10 cents, amber 10-25, red more; grey if missed or
     not assessed (a chord) — and a see-through rectangle behind the note for its timing: green within 25 ms, amber 25-60,
     red more (hatched, so it does not rest on colour alone). On the pages a repeat is printed once: its marks show the
     worse of the times through. A tap on a note opens its bar in the player */
  var PA_TIME_RED = 60, PA_WRONG = 75;   /* 75 cents or more off: a different note (Trix: "only if it's deviated too much") */
  /* the note played, as a red head on its line or space (its accidental against the key, ledger lines) beside the written one */
  function paPlayedHead(m, cx, cy, beat) {
    var NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'), kn = song.keyAt ? song.keyAt(beat) : { sf: song.sf };
    var sharps = kn.sf >= 0, sp = (sharps ? SP_S : SP_F)[((m % 12) + 12) % 12], L = sp[0], acc = sp[1], oct = Math.floor(m / 12) - 1;
    var step = L + 7 * (oct - 4), y = yOf(step), wStep = 2 + (BOT - cy) / (S / 2), x = cx + (Math.abs(step - wStep) <= 1 ? 12 : 0);
    var keyAcc = {}; for (var i = 0; i < Math.abs(kn.sf); i++) keyAcc[(sharps ? SHARP_K : FLAT_K)[i]] = sharps ? 1 : -1;
    var html = '';
    for (var l = 0; l >= step; l -= 2) html += '<path class="ledger" d="M' + (x - 9) + ' ' + yOf(l) + 'h18"/>';
    for (l = 12; l <= step; l += 2) html += '<path class="ledger" d="M' + (x - 9) + ' ' + yOf(l) + 'h18"/>';
    if ((keyAcc[L] || 0) !== acc) html += '<g class="pa-wacc" transform="translate(' + x + ' ' + y + ') scale(.7) translate(' + (-x) + ' ' + (-y) + ')">' + APP.accSvg(acc > 0 ? '#' : acc < 0 ? 'b' : 'n', x - 12, y, S) + '</g>';
    html += '<ellipse class="pa-whead" cx="' + x + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + x + ' ' + y + ')"/>';
    g.setAttribute('class', 'pa-wrong'); g.innerHTML = html;
    return g;
  }
  function paClearTints() {
    Array.prototype.forEach.call(document.querySelectorAll('.pa-tint, .pa-nm, .pa-tr, .pa-wrong'), function (el) { el.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('.mp-n.pa-p'), function (g) { g.classList.remove('pa-p', 'pa-ok', 'pa-amber', 'pa-red', 'pa-miss'); g.removeAttribute('data-pabar'); });
  }
  var PA_RANK = { ok: 0, na: 1, miss: 2, amber: 3, red: 4 };
  var paResOf = {}, paBarOf = {}, paPrinted = {}, paCardBar = -1, paCardEl = $('paCard');
  /* a tapped note (Trix): how far its pitch was off, and how early or late it started and ended; each time through a repeat */
  function paCardOpen(key, from) {
    if (!key || !song) return;
    var k = +key.slice(1), list = key[0] === 'p' ? (paPrinted[k] || [k]) : [k], bars = song.bars || [], n0 = song.notes[k];
    paCardBar = paBarOf[list[0]];
    $('paCardN').textContent = APP.board.name(n0.m);
    $('paCardT').textContent = 'Bar ' + (bars[paCardBar] ? bars[paCardBar].num : '');
    var box = $('paCardB'); box.textContent = ''; box.classList.remove('has-fb');
    function line(t, cls) { var p0 = document.createElement('p'); p0.textContent = t; if (cls) p0.className = cls; box.appendChild(p0); }
    function ms(v, what) { return Math.abs(v) <= ASSESS.IN_TIME ? what + ': on time (' + (v >= 0 ? '+' : '−') + Math.abs(v) + ' ms)' : what + ': ' + Math.abs(v) + ' ms ' + (v > 0 ? 'late' : 'early'); }
    list.forEach(function (kk) {
      var r = paResOf[kk], b = bars[paBarOf[kk]];
      if (list.length > 1 && b) line(b.time + (['', 'st', 'nd', 'rd'][b.time] || 'th') + ' time', 'pa-pass');
      if (!r) { line('Not recorded.'); return; }
      if (r.missed) { line('Not heard.'); return; }
      if (r.chord) { line('Double stop: not assessed.'); return; }
      var c = Math.round(r.cents);
      if (Math.abs(c) >= PA_WRONG && Math.round(c / 100) !== 0) line('Played ' + APP.board.name(r.m + Math.round(c / 100)) + ' instead of ' + APP.board.name(r.m) + ' (' + (c >= 0 ? '+' : '−') + Math.abs(c) + ' ¢)');
      else line(Math.abs(c) <= ASSESS.IN_TUNE ? 'Pitch: in tune (' + (c >= 0 ? '+' : '−') + Math.abs(c) + ' ¢)' : 'Pitch: ' + Math.abs(c) + ' ¢ ' + (c > 0 ? 'high' : 'low'));
      if (r.spread) line('Vibrato range: ' + Math.round(r.spread) + ' ¢');
      if (r.timing !== null && r.timing !== undefined) line(ms(r.timing, 'Start'));
      if (r.exit !== undefined) line(ms(r.exit, 'End'));
    });
    var r1 = paResOf[list[0]];
    if (r1 && !r1.missed && !r1.chord && r1.cents !== undefined && n0.si >= 0) {
      if (n0.fg === 0) { if (Math.abs(r1.cents) > ASSESS.IN_TUNE) line('Open string: tune the ' + PA_SNAME[n0.si] + ' string ' + (r1.cents > 0 ? 'down' : 'up') + ' by ' + Math.abs(Math.round(r1.cents)) + ' ¢.', 'pa-fb-say'); }   /* no finger to move: the string's tuning */
      else if (paView === 'pages') {   /* Pages only: Live has the big fingerboard (Trix); the board on the right of the text */
        var fb = paFingerSvg(n0, r1, k), txt = document.createElement('div'); txt.className = 'pa-fb-txt';
        while (box.firstChild) txt.appendChild(box.firstChild);
        txt.appendChild(fb.say); box.appendChild(txt); box.appendChild(fb.svg); box.classList.add('has-fb');
      }
    }
    /* as the Symbols page does: in the half of the screen away from the note, so the note stays in sight */
    var rr = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null, up = rr ? rr.top + rr.height / 2 > window.innerHeight / 2 : false;
    paCardEl.classList.toggle('up', up);
    $('paCardC').style.maxHeight = rr ? Math.max(160, up ? rr.top - 30 : window.innerHeight - rr.bottom - 30) + 'px' : '';
    paCardEl.hidden = false;
    try { $('paCardC').focus({ preventScroll: true }); } catch (e) {}
    /* Live (Trix): the note on the fingerboard too, the one written (lit on its string and finger) and the one played
       (Pitch Check's disc, as far above or below it as it was off) */
    if (paView === 'live') {
      var r0 = paResOf[list[0]];
      APP.board.allOff(); APP.board.hand(n0.hand); APP.board.on(n0.m, 'pa-card', false, n0.si, n0.b, true);
      APP.board.heard(r0 && r0.cents !== undefined && !r0.missed ? { m: n0.m + r0.cents / 100, cents: r0.cents, si: Math.abs(r0.cents) >= PA_WRONG ? -1 : n0.si } : null);
    }
  }
  /* the card's picture (Trix): the note's string, from the scroll side to the bridge side, zoomed round the note; a ring where
     the finger should be (the written note, with its finger), a disc where it was (from the pitch played), and how far apart
     they are on a real violin (328 mm string) */
  var PA_OPEN = [55, 62, 69, 76], PA_SNAME = ['G', 'D', 'A', 'E'], PA_LEN = 328;
  function paFingerSvg(n, r, k) {
    /* drawn like the MIDI player's board (Trix): all four strings, every note place from the open string up, the key's notes
       tinted, the written note lit in its string colour with its finger, and a disc where the played pitch puts the finger */
    var si = n.si, open = PA_OPEN[si], ne = n.m - open, na = Math.max(-0.4, ne + r.cents / 100);
    function mm(x) { return PA_LEN * (1 - Math.pow(2, -x / 12)); }
    var top = Math.max(7, Math.ceil(Math.max(ne, na)) + 1), COL = ['#66AEE6', '#74C493', '#E3A24C', '#EE6A5E'];
    var W = 150, X0 = 22, DX = (W - 2 * X0) / 3, Y0 = 26, H = Math.max(210, 22 * top + 40), K = (H - Y0 - 14) / mm(top), R = Math.min(10, K * (mm(1) - mm(0)) / 2 - 1);
    function Y(x) { return Y0 + K * mm(x); }
    var kn = song.keyAt ? song.keyAt(n.b || 0) : { sf: song.sf || 0 }, root = ((kn.sf * 7) % 12 + 12) % 12, inKey = {};
    [0, 2, 4, 5, 7, 9, 11].forEach(function (i) { inKey[(root + i) % 12] = true; });
    var kind = Math.abs(r.cents) <= ASSESS.IN_TUNE ? '#23963a' : Math.abs(r.cents) <= ASSESS.RED ? '#d68a00' : '#d23b2f';
    var o = ['<svg class="pa-fb" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" role="img" aria-label="Fingerboard">'];
    o.push('<rect x="4" y="' + (Y0 - 8) + '" width="' + (W - 8) + '" height="' + (H - Y0 + 4) + '" rx="8" class="pa-fb-wood"/>');
    o.push('<rect x="4" y="' + (Y0 - 10) + '" width="' + (W - 8) + '" height="4" rx="2" class="pa-fb-nut"/>');
    for (var s4 = 0; s4 < 4; s4++) {
      var x = X0 + s4 * DX;
      o.push('<text x="' + x + '" y="12" class="pa-fb-lab" fill="' + COL[s4] + '">' + PA_SNAME[s4] + '</text>');
      o.push('<line x1="' + x + '" y1="' + (Y0 - 6) + '" x2="' + x + '" y2="' + (H - 6) + '" stroke="' + COL[s4] + '" class="pa-fb-str"/>');
      for (var j = 0; j <= top; j++) {
        var m = PA_OPEN[s4] + j, y = Y(j), lit = s4 === si && j === ne, key = inKey[m % 12];
        var nm = APP.board.name(m).replace(/-?\d+$/, '');
        o.push('<circle cx="' + x + '" cy="' + y.toFixed(1) + '" r="' + R.toFixed(1) + '" class="pa-fb-n' + (lit ? ' lit' : key ? ' key' : '') + '" style="--c:' + COL[s4] + '"/>');
        if (R >= 7) o.push('<text x="' + x + '" y="' + (y + 3).toFixed(1) + '" class="pa-fb-t' + (lit ? ' lit' : '') + '">' + (lit && n.fg > 0 ? n.fg : nm) + '</text>');
      }
    }
    o.push('<circle cx="' + (X0 + si * DX) + '" cy="' + Y(na).toFixed(1) + '" r="' + (R * 0.62).toFixed(1) + '" fill="' + kind + '" class="pa-fb-got"/>');
    o.push('</svg>');
    var w = document.createElement('div'); w.innerHTML = o.join('');
    var d = mm(na) - mm(ne), p0 = document.createElement('p'); p0.className = 'pa-fb-say';
    p0.textContent = Math.abs(r.cents) <= ASSESS.IN_TUNE ? 'Finger in place.' : 'Finger about ' + Math.max(0.1, Math.abs(d)).toFixed(1) + ' mm too close to the ' + (d > 0 ? 'bridge' : 'scroll') + '.';
    return { svg: w.firstChild, say: p0 };
  }
  function paCardClose() { if (paCardEl.hidden) return; paCardEl.hidden = true; APP.board.off('pa-card'); APP.board.heard(null); }
  $('paCardC').addEventListener('click', paCardClose);   /* a tap on the card closes it */
  document.addEventListener('pointerdown', function (e) { if (!paCardEl.hidden && !$('paCardC').contains(e.target)) paCardClose(); }, true);   /* and a tap anywhere else */
  paCardEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); paCardClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); $('paCardC').focus(); }   /* one stop, the card itself (Hermes F86) */
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !paCardEl.hidden) { e.stopPropagation(); paCardClose(); } }, true);   /* Esc closes it from anywhere */
  function paRetint() {
    paClearTints();
    if (!paOn || !paRes || paRes.empty || !song) return;   /* only while Play-along shows (Hermes: an analysis ending after the tool was left) */
    var bars = song.bars || [], ns = song.notes, st = {}, barOf = {};
    paResOf = {}; paBarOf = barOf; paPrinted = {};
    function tk(r) { if (r.timing === null || r.timing === undefined) return null; var a = Math.abs(r.timing); return a <= ASSESS.IN_TIME ? 'ok' : a <= PA_TIME_RED ? 'amber' : 'red'; }
    paRes.bars.forEach(function (b, bi) {
      b.notes.forEach(function (r) {
        var kind = r.missed ? 'miss' : r.chord || r.cents === undefined ? 'na' : Math.abs(r.cents) <= ASSESS.IN_TUNE ? 'ok' : Math.abs(r.cents) <= ASSESS.RED ? 'amber' : 'red';
        /* far off (Trix: C written, D played): the written note grey, the note played drawn in red where it sits */
        var played = kind === 'red' && Math.abs(r.cents) >= PA_WRONG ? r.m + Math.round(r.cents / 100) : null;
        if (played !== null && played === r.m) played = null;
        r.idx.forEach(function (k) { st[k] = { kind: kind, time: r.missed ? null : tk(r), played: played }; barOf[k] = bi; paResOf[k] = r; });
      });
    });
    function draw(root, merge) {
      if (!root) return;
      var NS = 'http://www.w3.org/2000/svg';
      Array.prototype.forEach.call(root.querySelectorAll('.mp-n[data-k]:not(.mp-grace)'), function (g) {
        var k = +g.getAttribute('data-k'), m = merge ? merge[k] || st[k] : st[k], head = g.querySelector('ellipse.head');
        if (!m || !head) return;
        var wrong = m.played !== null && m.played !== undefined;
        g.classList.add('pa-p', m.kind === 'na' || wrong ? 'pa-miss' : 'pa-' + m.kind);
        if (wrong) g.parentNode.insertBefore(paPlayedHead(m.played, +head.getAttribute('cx'), +head.getAttribute('cy'), song.notes[k].b), g.nextSibling);
        g.setAttribute('data-pabar', barOf[k]); g.setAttribute('data-pak', (merge ? 'p' : 's') + k);
        if (m.time) {
          var cx = +head.getAttribute('cx'), r = document.createElementNS(NS, 'rect');
          r.setAttribute('class', 'pa-tr ' + m.time);
          r.setAttribute('x', (cx - 10).toFixed(1)); r.setAttribute('y', Y0 - 10); r.setAttribute('width', 20); r.setAttribute('height', 4 * S + 20); r.setAttribute('rx', 4);
          r.setAttribute('data-pabar', barOf[k]); r.setAttribute('data-pak', (merge ? 'p' : 's') + k);
          g.parentNode.insertBefore(r, g);
        }
      });
    }
    /* the pages: each played note onto its printed note (the same bar of the score, the same place in it, the same pitch) */
    var first = {}, merged = {}, TR = { ok: 0, amber: 1, red: 2 };
    ns.forEach(function (n, k) {
      var bo = song.barAt ? song.barAt(n.b + 1e-6) : null, key = (bo && bo.mi !== undefined ? bo.mi : 'b') + ':' + (bo ? (n.b - bo.beat).toFixed(3) : n.b.toFixed(3)) + ':' + n.m;
      if (first[key] === undefined) first[key] = k;
      var w = first[key], s0 = st[k]; if (!s0) return;
      (paPrinted[w] = paPrinted[w] || []).push(k);
      if (barOf[w] === undefined) barOf[w] = barOf[k];
      var cur = merged[w];
      if (!cur) { merged[w] = { kind: s0.kind, time: s0.time, played: s0.played }; return; }
      if (PA_RANK[s0.kind] > PA_RANK[cur.kind]) cur.kind = s0.kind;
      if (s0.played !== null && s0.played !== undefined && (cur.played === null || cur.played === undefined)) cur.played = s0.played;
      if (s0.time && (!cur.time || TR[s0.time] > TR[cur.time])) cur.time = s0.time;
    });
    draw(fgPages, merged);
    draw(svg, null);
  }
  /* the pages and the strip redraw themselves (a resize, a new layout): the tints come back */
  var paFgRender0 = fgRender; fgRender = function () { paFgRender0(); if (paOn) { paRetint(); paTickMarks(); } };
  var paDraw0 = drawScore; drawScore = function () { paDraw0(); if (paOn) paRetint(); };
  /* while the tool shows, a tap on the pages or the strip does not move the player (the take drives it) */
  [fgPages, scoreEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener('click', function (e) {   /* a tap on a marked note (or its timing background) opens its bar; any other tap does nothing */
      if (!paOn) return;
      if (paDragMoved) { paDragMoved = false; e.stopImmediatePropagation(); e.preventDefault(); return; }   /* the end of a drag is not a tap */
      var t = e.target.closest && e.target.closest('[data-pabar]');
      if (!t && el === scoreEl && paRes) {   /* the strip's notes take no pointer: the marked note nearest the tap, within 24 px */
        var best = null, bd = 24;
        Array.prototype.forEach.call(svg.querySelectorAll('.mp-n.pa-p'), function (g) {
          var r = g.getBoundingClientRect(); if (!r.width) return;
          var d = Math.abs(e.clientX - (r.left + r.right) / 2); if (d < bd && e.clientY > r.top - 30 && e.clientY < r.bottom + 30) { bd = d; best = g; }
        });
        t = best;
      }
      e.stopImmediatePropagation(); e.preventDefault();
      if (t && !paTake) paCardOpen(t.getAttribute('data-pak'), t);   /* what happened on that note (Trix) */
    }, true);
  });
  /* Live with a result (Trix): drag the strip to go through the notes; a tap on one opens its card */
  function paBeatAtX(x) {   /* the beat drawn at x on the strip: xAt runs one way, so halve the range */
    var lo = -4, hi = song.beats + 4;
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (xAt(mid) < x) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function paCanBrowse() { return paOn && paRes && !paRes.empty && !paTake && paView === 'live' && song && xAt; }
  scoreEl.addEventListener('pointerdown', function (e) {
    if (!paCanBrowse()) return;
    paDrag = { x: e.clientX, beat: paBrowse != null ? paBrowse : song.toBeat(pos), id: e.pointerId }; paDragMoved = false;
    try { scoreEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  scoreEl.addEventListener('pointermove', function (e) {
    if (!paDrag || e.pointerId !== paDrag.id) return;
    var dx = e.clientX - paDrag.x, z = full ? (fsShort ? 0.8 : 1.4) : 1;
    if (!paDragMoved && Math.abs(dx) < 6) return;
    paDragMoved = true;
    paBrowse = Math.max(-1, Math.min(song.beats, paBeatAtX(xAt(paDrag.beat) - dx / z)));
    scroll();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { window.addEventListener(ev, function () { if (!paDrag) return; paDrag = null; if (paDragMoved) setTimeout(function () { paDragMoved = false; }, 0); }, true); });   /* released anywhere (off the strip too); only the click that ends this drag is swallowed */
  scoreEl.addEventListener('wheel', function (e) {   /* a trackpad or a mouse wheel: the same */
    if (!paCanBrowse() || Math.abs(e.deltaX) + Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    var b0 = paBrowse != null ? paBrowse : song.toBeat(pos);
    paBrowse = Math.max(-1, Math.min(song.beats, paBeatAtX(xAt(b0) + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY))));
    scroll();
  }, { passive: false });
  document.addEventListener('visibilitychange', function () { if (document.hidden && paTake) paStop(); });   /* the phone locks or another app opens: the take ends there */
  document.addEventListener('i18n', function () { if (paOn) { paUi(); if (paRes) paShowResult(); } });
  APP.views.playalong = {
    show: function () { paOn = true; bg = false; appCall('rotate', false); paLayout(); paTickMarks(); if (paRes) paShowResult(); },
    hide: function () {
      if (paTake) paStop();   /* leaving the tool ends the take (the analysis still runs) */
      paOn = false; paBrowse = null; cancelAnimationFrame(paRaf); APP.board.heard(null); paClearTints(); paCardClose();   /* the browsed place is let go: the player follows the music again (Hermes F87) */
        /* the take's marks belong to Play-along: not on the Fingerings pages or their PDF (Hermes F84); back when it shows again */
      shown = false; fgShown = false; setMixOpen(false); setABOpen(false);
      if (APP.nextView !== 'midi' && APP.nextView !== 'fingering') { pause(); APP.board.player(false); }
      ['midi', 'board', 'fingering'].forEach(function (n) { var v = document.getElementById('view-' + n); if (v && APP.nextView !== n && !(APP.nextView === 'midi' && n === 'board')) v.hidden = true; });
    }
  };
  APP.paState = function () { return { take: paTake ? paTake.state : null, view: paView, result: paRes, mute: paMute }; };   /* tests */
  /* swipe between the tools (Trix): MIDI player, Fingerings and Play-along side by side, in that order; a swipe left on the
     player opens Fingerings, a swipe right on Fingerings opens the player, sliding in like a page. From the fingerboard
     too (Trix; in the player it only shows notes, a press plays nothing). Not from a slider, a list, an open panel, full screen, zoomed pages that scroll
     sideways, or Play-along */
  (function () {
    var sx = 0, sy = 0, st = 0, ok = false;
    function from(t) {
      if ((paOn && paTake) || full || !(shown || fgShown || paOn)) return false;   /* not while a Play-along take runs: leaving would end it */
      if (!t.closest) return true;
      if (paOn && paRes && t.closest('#mpScore')) return false;   /* dragging the result's strip (Trix) */
      if (t.closest('input, select, textarea, .mp-mixpop, .mp-abpop, .mp-lvmenu, [role="dialog"], .sheet')) return false;
      if (fgShown && fgPages.classList.contains('zoomed') && fgPages.scrollWidth > fgPages.clientWidth + 2) return false;
      return true;
    }
    document.addEventListener('touchstart', function (e) {
      ok = e.touches.length === 1 && from(e.target);
      if (!ok) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = performance.now();
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!ok) return; ok = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (performance.now() - st > 700 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      /* the row (Trix): MIDI player, Fingerings, Play-along (where the build shows its tile) */
      var row = ['midi', 'fingering'].concat(document.querySelector('.launch-btn[data-view="playalong"]') ? ['playalong'] : []);
      var at = row.indexOf(paOn ? 'playalong' : shown ? 'midi' : 'fingering'), to = row[at + (dx < 0 ? 1 : -1)];
      if (!to || at < 0) return;
      APP.show(to);
      var sec = document.getElementById('view-' + to);
      if (sec && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        sec.classList.remove('slide-l', 'slide-r'); void sec.offsetWidth;
        sec.classList.add(dx < 0 ? 'slide-l' : 'slide-r');
        setTimeout(function () { sec.classList.remove('slide-l', 'slide-r'); }, 260);
      }
    }, { passive: true });
  })();
  APP.views.midi = {
    show: function () { bg = false; appCall('rotate', true); shown = true; fit(); if (phone() && innerWidth > innerHeight && !full) setFull(true, true); },   /* the phone apps turn only in the MIDI player (Trix) */   /* opened on a phone held sideways: full screen (Trix) */
    hide: function () {
      setFull(false); appCall('rotate', false); shown = false; setMixOpen(false); setABOpen(false);   /* A–B too (Hermes F47) */
      if (APP.nextView === 'fingering') { bg = true; return; }   /* the music goes on into Fingerings, playing or paused where it is (Trix) */
      pause(); APP.board.player(false);
    }
  };
  load(0);
  tuneFromHash();   /* opened from a piece's QR */
})();
