(function () {
  var MIN = 40, MAX = 250, SWEEP = 120;   /* dial runs from -120 to +120 degrees around the top */
  var CX = 150, CY = 150, R = 118;
  var $ = function (id) { return document.getElementById(id); };
  var beatsEl = $('mBeats'), bpmEl = $('mBpm'), nameEl = $('mName'), dial = $('mDial');
  var prog = $('mProg'), knob = $('mKnob'), playEl = $('mPlay'), glyph = $('mGlyph');
  var state = { bpm: 80, num: 4, den: 4, sub: 1, levels: [3, 1, 1, 1] };
  try {
    var s = JSON.parse(localStorage.getItem('violin-metronome-v2') || '{}');
    if (s.bpm >= MIN && s.bpm <= MAX) state.bpm = Math.round(s.bpm);
    if (s.num >= 1 && s.num <= 8) state.num = s.num;
    if ([2, 4, 8].indexOf(s.den) >= 0) state.den = s.den;
    if (s.sub === 1 || s.sub === 2) state.sub = s.sub;
    if (Array.isArray(s.levels)) state.levels = s.levels.slice(0, 8);
  } catch (e) {}
  function fixLevels() {
    var l = state.levels;
    while (l.length < state.num) l.push(1);
    l.length = state.num;
    l = l.map(function (v) { return v >= 0 && v <= 3 ? v : 1; });
    state.levels = l;
  }
  function persist() { try { localStorage.setItem('violin-metronome-v2', JSON.stringify(state)); } catch (e) {} }

  /* ---------- geometry ---------- */
  function pt(deg, r) {
    var a = deg * Math.PI / 180;
    return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
  }
  function arc(a0, a1) {
    var p0 = pt(a0, R), p1 = pt(a1, R);
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + R + ' ' + R + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function angOf(b) { return -SWEEP + (b - MIN) / (MAX - MIN) * SWEEP * 2; }
  $('mTrack').setAttribute('d', arc(-SWEEP, SWEEP));
  var lab = '';
  [50, 100, 150, 200, 250].forEach(function (v) {
    var p = pt(angOf(v), R - 30);
    lab += '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + v + '</text>';
  });
  $('mLabels').innerHTML = lab;

  var NAMES = [[40, 'Largo'], [60, 'Larghetto'], [66, 'Adagio'], [76, 'Andante'], [108, 'Moderato'], [120, 'Allegro'], [156, 'Vivace'], [176, 'Presto'], [200, 'Prestissimo']];
  function tempoName(b) {
    var n = NAMES[0][1];
    NAMES.forEach(function (x) { if (b >= x[0]) n = x[1]; });
    return n;
  }

  /* ---------- drawing ---------- */
  var playing = false;
  function drawBeats() {
    beatsEl.innerHTML = '';
    beatsEl.dataset.sub = state.sub;
    state.levels.forEach(function (lv, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'beat'; b.dataset.l = lv; b.dataset.i = i;
      b.innerHTML = '<i></i><i></i><i></i>';
      setBeatLabel(b, i, lv);
      beatsEl.appendChild(b);
    });
    drawNotes();
  }
  var LV = ['muted', 'normal', 'medium', 'accent'];
  function setBeatLabel(b, i, lv) { b.setAttribute('aria-label', 'Beat ' + (i + 1) + ', ' + LV[lv] + '. Tap to change.'); }
  beatsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.beat'); if (!b) return;
    var i = +b.dataset.i;
    state.levels[i] = (state.levels[i] + 1) % 4;
    b.dataset.l = state.levels[i]; setBeatLabel(b, i, state.levels[i]);
    drawNotes(); persist();
  });

  function drawTempo() {
    bpmEl.textContent = state.bpm;
    nameEl.textContent = tempoName(state.bpm);
    var a = angOf(state.bpm), p = pt(a, R);
    prog.setAttribute('d', arc(-SWEEP, Math.max(a, -SWEEP + 0.01)));
    knob.setAttribute('cx', p[0].toFixed(2)); knob.setAttribute('cy', p[1].toFixed(2));
    dial.setAttribute('aria-valuenow', state.bpm);
    var sub = $('ttl-metronome-sub');
    if (sub) sub.textContent = state.bpm + ' BPM · ' + state.num + '/' + state.den;
  }
  function drawPlay() {
    var tab = document.querySelector('.tab[data-view="metronome"]');
    if (tab) tab.classList.toggle('live', playing);
    glyph.setAttribute('d', playing
      ? 'M132 132h36v36h-36z'
      : 'M138 128L174 150L138 172Z');
    playEl.setAttribute('aria-label', playing ? 'Stop' : 'Start');
  }
  function setBpm(v) {
    v = Math.max(MIN, Math.min(MAX, Math.round(v)));
    if (v === state.bpm) return;
    state.bpm = v; drawTempo(); persist();
  }

  /* ---------- controls ---------- */
  /* engraved notes, in staff spaces of 10 units with the middle line at y = 0: head in the space below it (A),
     stem up 3.5 spaces; two clicks per beat are a pair of quavers joined by a beam */
  var HEAD = '<ellipse rx="6" ry="4.3" transform="translate(@ 5) rotate(-20)"/>';
  var STEM = '<rect x="@" y="-30" width="1.3" height="34"/>';
  function head(x) { return HEAD.replace('@', x); }
  function stem(x) { return STEM.replace('@', x - 1.3); }
  function noteSvg(sub, vb) {
    var body = sub === 2
      ? head(6.5) + head(22.5) + stem(12.2) + stem(28.2) + '<polygon points="10.9,-30 28.2,-30 28.2,-25 10.9,-25"/>'
      : head(6.5) + stem(12.2);
    return '<svg viewBox="0 ' + vb + ' ' + (sub === 2 ? 30 : 14) + ' ' + (vb === -50 ? 100 : 42) + '">' + body + '</svg>';
  }
  function drawSig() {
    $('mNumTxt').textContent = state.num; $('mDenTxt').textContent = state.den;
    $('mSubTxt').textContent = state.sub; $('mNoteG').innerHTML = noteSvg(state.sub, -32);
  }
  drawSig();

  /* one note per beat between the repeat signs, faded when the beat is muted */
  var notesEl = $('mNotes'), scoreEl = $('mScore');
  function drawNotes() {
    var svg = noteSvg(state.sub, -50), html = '';
    state.levels.forEach(function (lv, k) { html += '<span class="' + (lv === 0 ? 'muted' : '') + (k === lastNow && playing ? ' now' : '') + '">' + svg + '</span>'; });
    notesEl.innerHTML = html;
    layoutScore();
  }
  /* line the score up with the row above: start repeat under the right end of the tempo number,
     each note under the middle of its beat (never wider than the beat) */
  function layoutScore() {
    var s0 = scoreEl.getBoundingClientRect();
    if (!s0.width) return;                               /* hidden view: done again when shown */
    scoreEl.style.setProperty('--lead', Math.max(0, bpmEl.getBoundingClientRect().right - s0.left) + 'px');
    Array.prototype.forEach.call(beatsEl.children, function (b, k) {
      var r = b.getBoundingClientRect(), n = notesEl.children[k];
      if (!n) return;
      n.style.left = (r.left + r.width / 2 - s0.left) + 'px';
      n.style.width = Math.max(0, r.width - 4) + 'px';
    });
  }
  if (window.ResizeObserver) { var ro = new ResizeObserver(layoutScore); ro.observe(scoreEl); ro.observe(beatsEl); ro.observe(bpmEl); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutScore);
  drawSig();
  /* tap the top number: 1 more beat per bar, after 8 back to 1. Tap the bottom one: 4, 8, 2, 4 ... */
  $('mNum').addEventListener('click', function () { state.num = state.num % 8 + 1; fixLevels(); beatIdx = 0; drawBeats(); drawTempo(); drawSig(); persist(); });
  $('mNote').addEventListener('click', function () { state.sub = state.sub === 2 ? 1 : 2; beatsEl.dataset.sub = state.sub; drawSig(); drawNotes(); persist(); });
  $('mDen').addEventListener('click', function () { state.den = { 2: 4, 4: 8, 8: 2 }[state.den] || 4; drawTempo(); drawSig(); persist(); });


  /* drag on the dial */
  var dragging = false;
  function fromPointer(e) {
    var r = dial.getBoundingClientRect(), k = 300 / r.width;
    var dx = (e.clientX - r.left) * k - CX, dy = (e.clientY - r.top) * k - CY;
    var deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    var cur = angOf(state.bpm);
    if (Math.abs(deg) > SWEEP) deg = cur < 0 ? -SWEEP : SWEEP;   /* in the gap at the bottom: stay at the end we were nearer to */
    setBpm(MIN + (deg + SWEEP) / (SWEEP * 2) * (MAX - MIN));
  }
  dial.addEventListener('pointerdown', function (e) {
    if (e.target === playEl) return;
    var r = dial.getBoundingClientRect(), k = 300 / r.width;
    var dx = (e.clientX - r.left) * k - CX, dy = (e.clientY - r.top) * k - CY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 70) return;               /* inside the play button area */
    dragging = true;
    try { dial.setPointerCapture(e.pointerId); } catch (x) {}
    fromPointer(e);
  });
  dial.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
  ['pointerup', 'pointercancel'].forEach(function (ev) { dial.addEventListener(ev, function () { dragging = false; }); });
  dial.addEventListener('keydown', function (e) {
    if (e.target !== dial) return;
    var d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d) { e.preventDefault(); setBpm(state.bpm + d); }
  });

  /* tap tempo */
  var taps = [];
  $('mTap').addEventListener('click', function () {
    var now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now); if (taps.length > 6) taps.shift();
    if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
  });

  /* ---------- audio ---------- */
  var ctx = null, timer = 0, nextT = 0, beatIdx = 0, subIdx = 0, queue = [], raf = 0, lastNow = -1;
  function click(t, level) {
    if (level === 0) return;
    var off = level === 'sub';
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = off ? 760 : level === 3 ? 1760 : level === 2 ? 1320 : 990;
    var peak = off ? 0.22 : level === 3 ? 0.9 : level === 2 ? 0.6 : 0.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.09);
  }
  function tick() {
    while (nextT < ctx.currentTime + 0.12) {
      var i = beatIdx % state.num;
      if (subIdx === 0) {
        click(nextT, state.levels[i]);
        queue.push({ t: nextT, i: i });
      } else if (state.levels[i] !== 0) {
        click(nextT, 'sub');
      }
      nextT += 60 / state.bpm / state.sub;
      subIdx++;
      if (subIdx >= state.sub) { subIdx = 0; beatIdx = (beatIdx + 1) % state.num; }
    }
  }
  function paintNow(i) {
    if (i === lastNow) return;
    lastNow = i;
    Array.prototype.forEach.call(beatsEl.children, function (b, k) { b.classList.toggle('now', k === i); });
    Array.prototype.forEach.call(notesEl.children, function (n, k) { n.classList.toggle('now', k === i); });
  }
  function frame() {
    if (!playing) return;
    while (queue.length && queue[0].t <= ctx.currentTime) paintNow(queue.shift().i);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (playing) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    playing = true; beatIdx = 0; subIdx = 0; queue = []; lastNow = -1;
    nextT = ctx.currentTime + 0.06;
    tick(); timer = setInterval(tick, 25);
    raf = requestAnimationFrame(frame);
    drawPlay();
  }
  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer); cancelAnimationFrame(raf);
    queue = []; paintNow(-1);
    drawPlay();
  }
  function toggle() { playing ? stop() : start(); }
  playEl.addEventListener('click', toggle);
  playEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !$('view-metronome').hidden && !/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target !== playEl && !e.target.closest('button')) {
      e.preventDefault(); toggle();
    }
  });

  fixLevels(); drawBeats(); drawTempo(); drawPlay();
  /* keeps playing when you switch to another tool; the tab shows a dot while it runs */
  APP.views.metronome = { show: function () { drawTempo(); }, hide: function () {}, stop: stop };
})();
