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
    var tempos = [], sig = null, sf = null, tracks = [];
    for (var t = 0; t < ntr && p + 8 <= u8.length; t++) {
      var id = str(p, 4), end = Math.min(p + 8 + u32(p + 4), u8.length);
      p += 8;
      if (id !== 'MTrk') { p = end; continue; }
      var tick = 0, rs = 0, open = {}, notes = [], chans = {};
      while (p < end) {
        tick += vlq();
        var st = u8[p];
        if (st & 0x80) { p++; if (st < 0xf0) rs = st; } else st = rs;   /* running status: the last channel status carries on */
        if (st === 0xff) {
          var ty = u8[p++], l = vlq();
          if (ty === 0x51 && l >= 3) tempos.push({ tick: tick, us: (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2] });
          else if (ty === 0x58 && l >= 2 && !sig) sig = { num: u8[p], den: Math.pow(2, u8[p + 1]) };
          else if (ty === 0x59 && l >= 1 && sf === null) sf = (u8[p] << 24) >> 24;
          p += l;
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();
        } else if (st >= 0x80) {
          var hi = st & 0xf0, ch = st & 15, a = u8[p++], b = (hi === 0xc0 || hi === 0xd0) ? 0 : u8[p++], k = ch + ':' + a;
          if (hi === 0x90 && b > 0) (open[k] = open[k] || []).push(tick);
          else if (hi === 0x80 || hi === 0x90) {
            if (open[k] && open[k].length) { notes.push({ m: a, t0: open[k].shift(), t1: tick }); chans[ch] = 1; }
          }
        } else break;   /* a data byte with no status: the file is damaged, stop reading this track */
      }
      Object.keys(open).forEach(function (k) { open[k].forEach(function (t0) { notes.push({ m: +k.split(':')[1], t0: t0, t1: tick }); }); });
      if (notes.length) tracks.push({ notes: notes, chans: Object.keys(chans).length || 1 });
      p = end;
    }
    if (!tracks.length) throw fail('This file has no notes.');
    var parts = tracks.length > 1 ? tracks.length : tracks[0].chans;
    if (parts > 1) throw fail('This file has ' + parts + ' parts. The player plays one violin part: save just the violin part as its own MIDI file.');
    return build(tracks[0].notes, tpq, tempos, sig || { num: 4, den: 4 }, sf || 0);
  }

  /* ticks to seconds through the tempo changes, and back */
  function build(raw, tpq, tempos, sig, sf) {
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
      return { m: n.m, t: toSec(n.t0), e: toSec(Math.max(n.t1, n.t0 + 1)), b: n.t0 / tpq, own: (n.t1 - n.t0) / tpq };
    }).filter(function (n) { return n.m >= 55; });   /* below the G string: left out */
    if (!notes.length) throw fail('Every note in this file is below the violin’s G string.');
    /* how long each note looks on the score: until the next note starts (a short breath between notes is
       not a rest), else its own length; rounded to note values a beginner part uses */
    var VALS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
    notes.forEach(function (n, i) {
      var j = i + 1; while (j < notes.length && notes[j].b <= n.b + 1e-6) j++;
      var len = j < notes.length && notes[j].b - n.b <= n.own + 0.5 ? notes[j].b - n.b : n.own;
      n.len = VALS.reduce(function (best, v) { return Math.abs(v - len) < Math.abs(best - len) ? v : best; }, 4);
    });
    var lastN = notes[notes.length - 1];
    return {
      notes: notes, sig: sig, sf: Math.max(-7, Math.min(7, sf)), bpm: Math.round(60e6 / tempos[0].us),   /* crotchets a minute */
      end: Math.max.apply(null, notes.map(function (n) { return n.e; })), beats: lastN.b + lastN.len,
      toBeat: function (s) {   /* seconds to beats, for scrolling the score */
        var g = segs[0]; for (var i = 1; i < segs.length && segs[i].sec <= s; i++) g = segs[i];
        return (g.tick + (s - g.sec) / g.spt) / tpq;
      },
      low: low, high: high
    };
  }

  /* ---------- the score: one line that scrolls past the playhead ---------- */
  var S = 9, Y0 = 34, PX = 46;             /* staff space, top line, pixels per beat */
  var BOT = Y0 + 4 * S;                    /* bottom line, E4 */
  var LET = 'CDEFGAB', SHARP_K = [3, 0, 4, 1, 5, 2, 6], FLAT_K = [6, 2, 5, 1, 4, 0, 3];   /* F C G D A E B / B E A D G C F as letter numbers */
  var SHARP_P = [10, 7, 11, 8, 5, 9, 6], FLAT_P = [6, 9, 5, 8, 4, 7, 3];                 /* where they sit on the treble staff */
  var SP_S = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  var SP_F = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  var STR = [[76, '--e'], [69, '--a'], [62, '--d'], [55, '--g']];
  function yOf(step) { return BOT - (step - 2) * S / 2; }   /* step: letters above C4 (E4 = 2, on the bottom line) */
  function hueOf(m) { for (var i = 0; i < STR.length; i++) if (m >= STR[i][0] && m <= STR[i][0] + 12) return 'var(' + STR[i][1] + ')'; return 'var(--accent)'; }
  var CLEF = '<g transform="translate(2 ' + (Y0 - 36) + ') scale(0.9)"><path fill="currentColor" transform="translate(-5.000 80.125) scale(0.0750 -0.0750)" d="M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z"/></g>';
  var ACC = { '1': '♯', '-1': '♭', '0': '♮' };
  var noteEls = [], X0 = 0, W = 0;

  function drawScore() {
    var sg = song, sharps = sg.sf >= 0, sp = sharps ? SP_S : SP_F, n = Math.abs(sg.sf), keyAcc = {};
    for (var i = 0; i < n; i++) keyAcc[(sharps ? SHARP_K : FLAT_K)[i]] = sharps ? 1 : -1;
    var out = [], x = 40;
    for (i = 0; i < n; i++) out.push('<text class="acc" x="' + (x + i * 9) + '" y="' + (yOf((sharps ? SHARP_P : FLAT_P)[i]) + 4.5) + '">' + (sharps ? '♯' : '♭') + '</text>');
    x += n * 9 + 6;
    var head = n + 2;   /* key signature + the two time-signature numbers */
    out.push('<text class="ts" x="' + x + '" y="' + (Y0 + 2 * S - 1) + '">' + sg.sig.num + '</text><text class="ts" x="' + x + '" y="' + (Y0 + 4 * S - 1) + '">' + sg.sig.den + '</text>');
    X0 = x + 30;
    var barBeats = sg.sig.num * 4 / sg.sig.den;
    W = X0 + sg.beats * PX + 30;
    for (var b = barBeats; b < sg.beats - 1e-6; b += barBeats) out.push('<path class="bl" d="M' + (X0 + b * PX - PX * 0.35) + ' ' + Y0 + 'V' + BOT + '"/>');
    var endX = X0 + sg.beats * PX - PX * 0.35;
    out.push('<path class="bl" d="M' + (endX - 4) + ' ' + Y0 + 'V' + BOT + '"/><path class="bl end" d="M' + endX + ' ' + Y0 + 'V' + BOT + '"/>');
    /* accidentals hold to the end of the bar */
    var barNo = -1, inBar = {};
    sg.notes.forEach(function (nt, k) {
      var bn = Math.floor(nt.b / barBeats + 1e-6);
      if (bn !== barNo) { barNo = bn; inBar = {}; }
      var spl = sp[nt.m % 12], L = spl[0], acc = spl[1], oct = Math.floor(nt.m / 12) - 1;
      var step = L + 7 * (oct - 4), y = yOf(step), hx = X0 + nt.b * PX, id = L + '/' + oct;
      var want = acc, have = id in inBar ? inBar[id] : (keyAcc[L] || 0), g = [];
      if (want !== have) { g.push('<text class="acc" x="' + (hx - 15) + '" y="' + (y + 4.5) + '">' + ACC[String(want)] + '</text>'); inBar[id] = want; }
      for (var l = 0; l >= step; l -= 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      for (l = 12; l <= step; l += 2) g.push('<path class="ledger" d="M' + (hx - 9) + ' ' + yOf(l) + 'h18"/>');
      var len = nt.len, hollow = len >= 2, stem = len < 4, dotted = len === 3 || len === 1.5 || len === 0.75;
      var flags = len <= 0.25 ? 2 : len <= 0.75 && len < 1 ? 1 : 0, up = step < 6;
      g.push('<ellipse class="' + (hollow ? 'head hollow' : 'head') + '" cx="' + hx + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + hx + ' ' + y + ')"/>');
      if (stem) {
        var sx = up ? hx + 4.9 : hx - 4.9, sy = up ? y - 3.4 * S : y + 3.4 * S;
        g.push('<path class="stem" d="M' + sx + ' ' + (y + (up ? -1 : 1)) + 'V' + sy + '"/>');
        for (var f = 0; f < flags; f++) {
          var fy = sy + (up ? 1 : -1) * f * 7, d = up ? 1 : -1;
          g.push('<path class="flag" d="M' + sx + ' ' + fy + 'c1 ' + (5 * d) + ' 8 ' + (7 * d) + ' 6 ' + (15 * d) + 'c1 ' + (-6 * d) + ' -3 ' + (-9 * d) + ' -6 ' + (-10 * d) + 'z"/>');
        }
      }
      if (dotted) g.push('<circle class="dot" cx="' + (hx + 9) + '" cy="' + (step % 2 === 0 ? y - S / 2 : y) + '" r="1.7"/>');
      out.push('<g class="mp-n" data-k="' + k + '" style="--hue:' + hueOf(nt.m) + '">' + g.join('') + '</g>');
    });
    var lines = '';
    for (i = 0; i < 5; i++) lines += '<path class="sl" d="M0 ' + (Y0 + i * S) + 'H' + W + '"/>';
    svg.setAttribute('width', W); svg.setAttribute('height', BOT + 34);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (BOT + 34));
    svg.innerHTML = lines + out.slice(head).join('');
    /* the clef, key and time signature stay at the left while the notes scroll under them */
    var kw = X0 - 12, kl = '';
    for (i = 0; i < 5; i++) kl += '<path class="sl" d="M0 ' + (Y0 + i * S) + 'H' + kw + '"/>';
    keySvg.setAttribute('width', kw + 14); keySvg.setAttribute('height', BOT + 34);
    keySvg.setAttribute('viewBox', '0 0 ' + (kw + 14) + ' ' + (BOT + 34));
    keySvg.innerHTML = kl + CLEF + out.slice(0, head).join('');
    noteEls = Array.prototype.slice.call(svg.querySelectorAll('.mp-n'));
  }
  /* the playhead sits a third of the way across; the score slides under it */
  function scroll() {
    if (!song) return;
    var beat = song.toBeat(pos), w = scoreEl.clientWidth, x = X0 + beat * PX, hx = Math.max(w * 0.36, X0 + 50);
    headEl.style.left = hx + 'px';
    /* half a beat early, so a note glows while it passes through the playhead rather than after it */
    svg.style.transform = 'translateX(' + Math.round(Math.min(0, hx - x + PX / 2)) + 'px)';
  }

  /* ---------- playing ---------- */
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function ui() {
    var end = song ? song.end : 0;
    timeEl.textContent = fmt(pos / speed) + ' / ' + fmt(end / speed);
    if (document.activeElement !== seek) seek.value = end ? Math.round(pos / end * 1000) : 0;
    speedEl.textContent = Math.round(speed * 100) + '%';
    bpmEl.textContent = song ? '♩ = ' + Math.round(song.bpm * speed) : '';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playBtn.classList.toggle('on', playing);
    $('mpSlower').disabled = speed <= 0.5 + 1e-9;
    $('mpFaster').disabled = speed >= 1.5 - 1e-9;
  }
  function allOff() {
    active.forEach(function (k) { APP.board.off('n' + k); });
    active = [];
    noteEls.forEach(function (el) { el.classList.remove('on'); });
  }
  function seekTo(p) {
    allOff();
    pos = Math.max(0, Math.min(p, song ? song.end : 0));
    ni = 0;
    if (song) while (ni < song.notes.length && song.notes[ni].t < pos - 1e-6) ni++;
    noteEls.forEach(function (el, k) { el.classList.toggle('done', k < ni); });
    scroll(); ui();
  }
  function frame(now) {
    if (!playing) return;
    pos += (now - last) / 1000 * speed;
    last = now;
    var ns = song.notes;
    active = active.filter(function (k) {   /* notes ending first, so a repeated note sounds twice */
      if (ns[k].e > pos) return true;
      APP.board.off('n' + k); noteEls[k].classList.remove('on'); noteEls[k].classList.add('done');
      return false;
    });
    while (ni < ns.length && ns[ni].t <= pos) {
      APP.board.on(ns[ni].m, 'n' + ni);
      noteEls[ni].classList.add('on');
      active.push(ni); ni++;
    }
    scroll(); ui();
    if (pos >= song.end && !active.length) { pause(); seekTo(song.end); return; }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (!song || playing) return;
    if (!APP.board.prime()) return;   /* the sound engine starts inside the tap (iPhone) */
    if (pos >= song.end - 0.01) seekTo(0);
    playing = true; last = performance.now();
    raf = requestAnimationFrame(frame);
    ui();
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    allOff();
    ui();
  }

  /* ---------- tunes ---------- */
  function say(text) { msg.textContent = text || ''; msg.hidden = !text; }
  function load(i) {
    pause();
    song = songs[i].song;
    subEl.textContent = songs[i].title;
    drawScore();
    seekTo(0);
    var warn = [];
    if (song.low) warn.push(song.low + (song.low > 1 ? ' notes are' : ' note is') + ' below the violin’s G string and left out.');
    if (song.high) warn.push(song.high + (song.high > 1 ? ' notes are' : ' note is') + ' above the fingerboard shown: heard, not lit.');
    say(warn.join(' '));
    if (shown) fit();
  }
  function addSong(title, buf, imported) {
    var sg = parse(buf);
    songs.push({ title: title, song: sg, imported: imported });
    var o = document.createElement('option');
    o.value = songs.length - 1; o.textContent = title;
    if (imported) o.setAttribute('translate', 'no');   /* a file name stays as it is in 中文 */
    songSel.appendChild(o);
    return songs.length - 1;
  }
  DEMOS.forEach(function (d) {
    var bin = atob(d.b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    addSong(d.title, u8.buffer, false);
  });
  songSel.addEventListener('change', function () { load(+songSel.value); });
  $('mpImport').addEventListener('click', function () { fileIn.value = ''; fileIn.click(); });
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var i = addSong(f.name.replace(/\.(mid|midi|smf)$/i, ''), rd.result, true);
        songSel.value = i; load(i);
      } catch (e) { say(e.mine ? e.message : 'This MIDI file could not be read.'); }
    };
    rd.onerror = function () { say('This MIDI file could not be read.'); };
    rd.readAsArrayBuffer(f);
  });

  playBtn.addEventListener('click', function () { if (playing) pause(); else play(); });
  $('mpStart').addEventListener('click', function () { seekTo(0); });
  function setSpeed(d) { speed = Math.max(0.5, Math.min(1.5, Math.round((speed + d) * 10) / 10)); ui(); }
  $('mpSlower').addEventListener('click', function () { setSpeed(-0.1); });
  $('mpFaster').addEventListener('click', function () { setSpeed(0.1); });
  seek.addEventListener('input', function () { if (song) seekTo(seek.value / 1000 * song.end); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) pause(); });
  window.addEventListener('resize', scroll);
  if (APP.busy) APP.busy.push(function () { return playing; });   /* playing along counts as practice time */

  /* the board fits below the app bar, the score and the controls */
  function topH() { var a = document.querySelector('.appbar'); return (a ? a.offsetHeight + 10 : 0) + top.offsetHeight + 20 + Math.max(0, bar.offsetHeight - 64); }   /* + the board's own margin and padding */
  function reach() {   /* semitones above the open string, on the string the board plays each note on */
    var top = 7;
    if (song) song.notes.forEach(function (n) { for (var i = 0; i < STR.length; i++) if (n.m >= STR[i][0] && n.m <= STR[i][0] + 12) { top = Math.max(top, n.m - STR[i][0] + 1); break; } });
    return top;
  }
  function fit() { APP.board.player(true, topH, reach()); scroll(); }
  APP.views.midi = {
    show: function () { shown = true; fit(); },
    hide: function () { shown = false; pause(); APP.board.player(false); }
  };
  load(0);
})();
