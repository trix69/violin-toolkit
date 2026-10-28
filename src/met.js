(function () {
  var MIN = 40, MAX = 250, SWEEP = 120;   /* dial runs from -120 to +120 degrees around the top */
  var CX = 150, CY = 150, R = 118;
  var $ = function (id) { return document.getElementById(id); };
  var beatsEl = $('mBeats'), bpmEl = $('mBpm'), nameEl = $('mName'), dial = $('mDial');
  var prog = $('mProg'), knob = $('mKnob'), playEl = $('mPlay'), glyph = $('mGlyph');
  var state = { bpm: 80, num: 4, den: 4, levels: [3, 1, 1, 1] };
  try {
    var s = JSON.parse(localStorage.getItem('violin-metronome-v2') || '{}');
    if (s.bpm >= MIN && s.bpm <= MAX) state.bpm = Math.round(s.bpm);
    if (s.num >= 1 && s.num <= 8) state.num = s.num;
    if ([2, 4, 8].indexOf(s.den) >= 0) state.den = s.den;
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
     stem up 3.5 spaces. The time signature's lower number picks the note: 2 half, 4 crotchet, 8 quaver. */
  function ellipse(cx, cy, rx, ry, deg) {        /* an ellipse as a path, so a hollow head can be one even-odd shape */
    var t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    var x1 = (cx - rx * c).toFixed(2), y1 = (cy - rx * s).toFixed(2), x2 = (cx + rx * c).toFixed(2), y2 = (cy + rx * s).toFixed(2);
    return 'M' + x1 + ' ' + y1 + 'A' + rx + ' ' + ry + ' ' + deg + ' 1 0 ' + x2 + ' ' + y2 + 'A' + rx + ' ' + ry + ' ' + deg + ' 1 0 ' + x1 + ' ' + y1 + 'Z';
  }
  function noteSvg(den, vb) {
    var head = den === 2
      ? '<path fill-rule="evenodd" d="' + ellipse(6.5, 5, 6, 4.3, -20) + ellipse(6.5, 5, 4.4, 2.1, -35) + '"/>'
      : '<path d="' + ellipse(6.5, 5, 6, 4.3, -20) + '"/>';
    var body = head + '<rect x="10.9" y="-30" width="1.3" height="34"/>';
    if (den === 8) body += '<path d="M10.9 -30H12.2C12.8 -24.5 20.6 -21.5 18.6 -10.5C19.4 -17.5 15.4 -20.6 12.2 -21.8H10.9Z"/>';   /* flag */
    return '<svg viewBox="0 ' + vb + ' ' + (den === 8 ? 20 : 14) + ' ' + (vb === -50 ? 100 : 42) + '">' + body + '</svg>';
  }
  function drawSig() {
    $('mNumTxt').textContent = state.num; $('mDenTxt').textContent = state.den;
    $('mNoteG').innerHTML = noteSvg(state.den, -32);
  }
  drawSig();

  /* one note per beat between the repeat signs, faded when the beat is muted */
  var notesEl = $('mNotes'), scoreEl = $('mScore');
  function drawNotes() {
    var svg = noteSvg(state.den, -50), html = '';
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
  $('mDen').addEventListener('click', function () { state.den = { 2: 4, 4: 8, 8: 2 }[state.den] || 4; drawTempo(); drawSig(); drawNotes(); persist(); });


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

  /* ---------- symbols overlay ---------- */
  var symSheet = $('symbols'), symBtn = $('mSym');
  function closeSym() { symSheet.hidden = true; document.removeEventListener('keydown', onSymKey); try { symBtn.focus(); } catch (e) {} }
  function onSymKey(e) { if (e.key === 'Escape') closeSym(); else if (e.key === 'Tab') { e.preventDefault(); $('symDone').focus(); } }
  symBtn.addEventListener('click', function () { symSheet.hidden = false; document.addEventListener('keydown', onSymKey); $('symCard').focus(); });
  $('symDone').addEventListener('click', closeSym);
  symSheet.addEventListener('click', function (e) { if (e.target === symSheet) closeSym(); });

  /* ---------- audio ---------- */
  var ctx = null, timer = 0, nextT = 0, beatIdx = 0, queue = [], raf = 0, lastNow = -1;
  function click(t, level) {
    if (level === 0) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = level === 3 ? 1760 : level === 2 ? 1320 : 990;
    var peak = level === 3 ? 0.9 : level === 2 ? 0.6 : 0.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.09);
  }
  function tick() {
    while (nextT < ctx.currentTime + 0.12) {
      var i = beatIdx % state.num;
      click(nextT, state.levels[i]);
      queue.push({ t: nextT, i: i });
      nextT += 60 / state.bpm;
      beatIdx = (beatIdx + 1) % state.num;
    }
  }
  function paintNow(i) {
    if (i === lastNow) return;
    lastNow = i;
    Array.prototype.forEach.call(beatsEl.children, function (b, k) { b.classList.toggle('now', k === i); });
    Array.prototype.forEach.call(notesEl.children, function (n, k) { n.classList.toggle('now', k === i); });
  }
  /* Beat flash (Settings > Beat flash): wash the screen in the accent colour on every sounding beat,
     brighter on accents (muted beats don't flash). It runs from this loop, so it carries on while the
     fingerboard is open. Above 168 BPM (2.8 beats a second, a margin under the 3-a-second limit for strong
     flashes in WCAG 2.3.1, since flashes land on whole frames) the wash is kept soft: its strength is worked out from the page and
     accent colours so the brightness change stays under 8 % (a flash counts from 10 %). */
  var flashEl = null, flashAnim = null, softKey = '', softMax = 0.1;
  function rgbOf(c) { return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); }
  function lum(c) { return c.reduce(function (s, v, i) { v /= 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function softPeak() {
    var bg = rgbOf(getComputedStyle(document.body).backgroundColor), ac = rgbOf(getComputedStyle(flashEl).backgroundColor);
    var key = bg + '|' + ac;
    if (key === softKey) return softMax;
    var L0 = lum(bg), lo = 0, hi = 0.5;
    for (var n = 0; n < 16; n++) {
      var a = (lo + hi) / 2, mix = bg.map(function (v, i) { return v * (1 - a) + ac[i] * a; });
      if (Math.abs(lum(mix) - L0) < 0.08) lo = a; else hi = a;
    }
    softKey = key; softMax = lo;
    return lo;
  }
  /* the metronome tab also pulses on each beat: a small area, so it can stay strong at any tempo and
     still shows the beat where the soft wash is hard to see (the dark fingerboard above 168 BPM) */
  var metTab = null, tabAnim = null;
  function pulseTab(level) {
    metTab = metTab || document.querySelector('.tab[data-view="metronome"]');
    if (!metTab || !metTab.animate) return;
    var cs = getComputedStyle(document.documentElement), ac = cs.getPropertyValue('--accent').trim(), on = cs.getPropertyValue('--on-accent').trim();
    if (tabAnim) tabAnim.cancel();
    metTab.classList.add('pulsing');   /* keeps the "playing" dot visible on the accent fill */
    tabAnim = metTab.animate([
      { backgroundColor: ac, color: on, borderColor: ac, boxShadow: '0 0 0 ' + (level === 3 ? 5 : 3) + 'px ' + ac },
      { boxShadow: '0 0 0 0 ' + ac }
    ], { duration: Math.min(380, 0.6 * 60000 / state.bpm), easing: 'ease-out' });
    var t = tabAnim;
    t.onfinish = t.oncancel = function () { if (t === tabAnim) metTab.classList.remove('pulsing'); };
  }
  function flash(level) {
    if (!window.APP || !APP.flash || !level) return;
    pulseTab(level);
    flashEl = flashEl || document.getElementById('beatFlash');
    if (!flashEl || !flashEl.animate) return;
    if (flashAnim) flashAnim.cancel();
    /* cover the visible part of the page only while flashing, then leave the page as it was */
    flashEl.style.top = window.scrollY + 'px';
    flashEl.style.height = window.innerHeight + 'px';
    flashEl.style.display = 'block';
    var strong = level === 3 ? 0.62 : level === 2 ? 0.45 : 0.32;
    var peak = state.bpm > 168 ? Math.min(strong, softPeak() * (level === 3 ? 1 : level === 2 ? 0.8 : 0.6)) : strong;
    flashAnim = flashEl.animate([{ opacity: peak }, { opacity: 0 }], { duration: Math.min(380, 0.6 * 60000 / state.bpm), easing: 'ease-out' });
    var a = flashAnim;
    a.onfinish = a.oncancel = function () { if (a === flashAnim && flashEl) flashEl.style.display = 'none'; };
  }
  function frame() {
    if (!playing) return;
    while (queue.length && queue[0].t <= ctx.currentTime) { var q = queue.shift(); flash(state.levels[q.i]); paintNow(q.i); }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (playing) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    playing = true; beatIdx = 0; queue = []; lastNow = -1;
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
    if (flashAnim) { flashAnim.cancel(); flashAnim = null; }
    if (tabAnim) { tabAnim.cancel(); tabAnim = null; }
    if (metTab) metTab.classList.remove('pulsing');
    if (flashEl) flashEl.style.display = 'none';
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
