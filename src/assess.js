/* Assessment (Trix): line a performance up against the score and measure it, note by note. Nothing here works out
   what was played; every note's pitch, time and bar comes from the score (song.notes), and the take is only measured
   against it.
   Two halves:
   - framer(sr, yin): fed the microphone's samples as they come (an AudioWorklet's 128-sample blocks), it keeps per
     frame only numbers: every 512 samples the loudness and yin pitch of the last 2048 (Pitch Check's detector and gate
     level), and a fine loudness trace (every 128 samples) for onsets. The audio itself is never stored.
   - analyse(fr, song, opts): onsets from the loudness trace (and from a change of pitch, for slurred notes), a banded
     dynamic-programming alignment of onsets to the score's notes, then per note: pitch (median of the note's middle,
     attack and release dropped), its 5th-95th percentile spread (vibrato), timing against the locally warped score
     time, missed and extra notes; then per bar and for the piece.
   Loaded by the page (window.ASSESS) and by the Node checks (module.exports). */
(function (root) {
  var WIN = 2048, HOP = 512, BLK = 128, EW = 512, GATE = 0.01;
  var IN_TUNE = 10, IN_TIME = 25, AMBER = 10, RED = 25;   /* cents, ms: the definitions, kept fixed between builds */

  function framer(sr, yin) {
    var ring = new Float32Array(WIN), filled = 0, pos = 0, since = 0, n = 0;
    var fr = { sr: sr, hop: HOP, win: WIN, t: [], rms: [], f: [], et: [], e: [] };
    var buf = new Float32Array(WIN);
    fr.push = function (x) {   /* x: Float32Array of any length, in order */
      for (var i = 0; i < x.length; i++) {
        ring[pos] = x[i]; pos = (pos + 1) % WIN; if (filled < WIN) filled++;
        n++; since++;
        if (n % BLK === 0 && filled >= EW) {   /* fine loudness: the last 512 samples (a cycle of the lowest note fits), every 128 */
          var s = 0, k, j;
          for (k = 0; k < EW; k++) { j = (pos - 1 - k + WIN) % WIN; s += ring[j] * ring[j]; }
          fr.et.push((n - EW / 2) / sr); fr.e.push(Math.sqrt(s / EW));
        }
        if (since >= HOP && filled === WIN) {
          since = 0;
          var e2 = 0;
          for (k = 0; k < WIN; k++) { buf[k] = ring[(pos + k) % WIN]; e2 += buf[k] * buf[k]; }
          var rms = Math.sqrt(e2 / WIN);
          fr.t.push((n - WIN / 2) / sr); fr.rms.push(rms);
          fr.f.push(rms > GATE ? yin(buf, sr, 150, 3000) : 0);
        }
      }
    };
    return fr;
  }

  function median(a) { if (!a.length) return NaN; var s = a.slice().sort(function (x, y) { return x - y; }), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function pct(a, p) { if (!a.length) return NaN; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; }
  function midiOf(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }

  /* onsets: the fine loudness rising through the gate, or jumping (x1.8 over its minimum in the last 130 ms, as the
     tuner's gate tests an attack); and, for slurred notes with no new attack, a settled change of pitch */
  function onsetJob(fr) {
    var gate = GATE, out = [], e = fr.e, et = fr.et, N = e.length, i = 1, phase = 0, si = 0, lastT = -1;
    var sm = new Float64Array(N), look = Math.round(0.13 * fr.sr / BLK);
    var lastPeak = -1, dq = new Int32Array(N + 1), qh = 0, qt = 0;
    var f = fr.f, t = fr.t, seg = [], gapN = 0, segT = [], pi = 0, pcs = [], lvT = null;
    function push(k) { while (qt > qh && sm[dq[qt - 1]] >= sm[k]) qt--; dq[qt++] = k; }
    return {
      done: false, out: out,
      step: function (n) {   /* about n blocks or frames of work */
        var stop = 0;
        if (phase === 0) {   /* ~13 ms smoothing */
          for (; si < N && stop < n; si++, stop++) { var s0 = 0, c0 = 0; for (var j = Math.max(0, si - 2); j <= Math.min(N - 1, si + 2); j++) { s0 += e[j]; c0++; } sm[si] = s0 / c0; }
          if (si >= N) phase = 1;
          return;
        }
        if (phase === 1) {
          for (; i < N && stop < n; i++, stop++) {
            /* the window: the last 130 ms, but not back past the last attack's peak (a held note is not a new jump) */
            push(i - 1);
            var from = Math.max(0, i - look, lastPeak + 1);
            while (qh < qt && dq[qh] < from) qh++;
            if (sm[i] < gate) continue;
            var lo = qh < qt ? sm[dq[qh]] : Infinity;
            var rise = sm[i - 1] < gate || sm[i] > Math.max(lo, gate * 0.3) * 1.8;
            if (!rise || et[i] - lastT < 0.06) continue;
            /* the onset: where the rise starts, back to the first block above a fifth of the level it reaches */
            var peakI = i; while (peakI + 1 < N && sm[peakI + 1] > sm[peakI] && et[peakI + 1] - et[i] < 0.08) peakI++;
            var k2 = i; while (k2 > 0 && sm[k2 - 1] > sm[peakI] * 0.2 && sm[k2 - 1] < sm[k2] && et[i] - et[k2 - 1] < 0.08) k2--;
            out.push({ t: et[k2], how: 'level' }); lastT = et[i];
            while (i + 1 < N && sm[i + 1] >= sm[i]) { i++; push(i - 1); }   /* past this rise */
            lastPeak = i;
          }
          if (i >= N) phase = 2;
          return;
        }
        if (phase === 2) {
          /* pitch changes (a slur: no new attack): three frames agreeing with each other (within 30 cents) and more than
             half a semitone from the settled pitch of the note before. The onset is midway between the last frame still
             on the old pitch and the first on the new one (the frames between straddle both) */
          for (; pi < f.length && stop < n; pi++, stop++) {
            if (!f[pi]) { gapN++; if (fr.rms[pi] <= GATE || gapN > 4) { seg = []; segT = []; } continue; }
            gapN = 0;
            seg.push(midiOf(f[pi])); segT.push(t[pi]);
            if (seg.length < 6) continue;
            if (seg.length > 64) { seg = seg.slice(-32); segT = segT.slice(-32); }
            var n3 = seg.slice(-3), lo3 = Math.min(n3[0], n3[1], n3[2]), hi3 = Math.max(n3[0], n3[1], n3[2]);
            if (hi3 - lo3 > 0.3) continue;
            var base = median(seg.slice(Math.max(0, seg.length - 23), -3)), nw = median(n3);
            if (Math.abs(nw - base) <= 0.5) continue;
            var k = seg.length - 4;
            while (k > 0 && Math.abs(seg[k] - base) > 0.25) k--;   /* the last frame still on the old pitch */
            var k3 = k + 1; while (k3 < seg.length - 3 && Math.abs(seg[k3] - nw) > 0.25) k3++;   /* the first on the new */
            var tc = (segT[k] + segT[k3]) / 2, near = false;
            if (!lvT) lvT = out.map(function (o) { return o.t; });   /* the level onsets, in time order */
            var lb = lowerBound(lvT, tc);
            near = (lb < lvT.length && Math.abs(lvT[lb] - tc) < 0.07) || (lb > 0 && Math.abs(lvT[lb - 1] - tc) < 0.07);
            for (var q = pcs.length - 1; q >= 0 && q >= pcs.length - 4; q--) if (Math.abs(pcs[q].t - tc) < 0.07) near = true;
            if (!near) pcs.push({ t: tc, how: 'pitch' });
            seg = seg.slice(k3); segT = segT.slice(k3);
          }
          if (pi >= f.length) { pcs.forEach(function (o) { out.push(o); }); out.sort(function (a, b) { return a.t - b.t; }); this.done = true; }
        }
      }
    };
  }
  /* onsets: the fine loudness rising through the gate, or jumping (x1.8 over its minimum in the last 130 ms, as the
     tuner's gate tests an attack); and, for slurred notes with no new attack, a settled change of pitch */
  function onsets(fr) { var j = onsetJob(fr); while (!j.done) j.step(1e9); return j.out; }

  function lowerBound(a, x) { var lo = 0, hi = a.length; while (lo < hi) { var m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
  /* the frames between two times whose window lies inside them, as cents from a frequency (octave slips folded) */
  function centsIn(fr, a, b, hz) {
    var half = fr.win / 2 / fr.sr, out = [], i, i0 = lowerBound(fr.t, a - 0.06), i1 = lowerBound(fr.t, b + 0.06);
    function c(i) { var v = 1200 * Math.log(fr.f[i] / hz) / Math.LN2; while (v > 600) v -= 1200; while (v < -600) v += 1200; return v; }   /* an octave slip of the detector, not of the player */
    for (i = i0; i < i1; i++) if (!(fr.t[i] - half < a - 0.005 || fr.t[i] + half > b + 0.005) && fr.f[i] && fr.rms[i] > GATE) out.push(c(i));
    if (!out.length) for (i = i0; i < i1; i++) if (fr.t[i] >= a && fr.t[i] <= b && fr.f[i] && fr.rms[i] > GATE) out.push(c(i));   /* a short note: frames centred inside it */
    return out;
  }

  /* the score's events: each onset of the solo (a chord's notes share one), graces left out */
  function events(song) {
    var ev = [];
    song.notes.forEach(function (n, k) {
      if (n.grace) return;
      var last = ev[ev.length - 1];
      if (last && Math.abs(last.t - n.t) < 1e-4) { last.idx.push(k); last.chord = true; last.e = Math.max(last.e, n.e); return; }
      ev.push({ t: n.t, e: n.e, m: n.m, idx: [k], chord: false, b: n.b });
    });
    return ev;
  }

  /* alignment: onsets (time, pitch) to events (time, pitch), keeping their order. Matching costs the change of lag
     from the last match (allowed only within 35 % of the expected gap, plus 40 ms) and the pitch distance; an
     unmatched onset is an extra, an unmatched event a missed note. Built row by row (aligner.rows), so the page can
     do it in slices */
  function aligner(P, E) {
    var n = P.length, m = E.length, W = m + 1, INF = 1e18, X = 1.2, M = 1.5, row = 0;
    var cost = new Float64Array((n + 1) * W).fill(INF), lag = new Float64Array((n + 1) * W), lastE = new Float64Array((n + 1) * W), from = new Int8Array((n + 1) * W), has = new Uint8Array((n + 1) * W);
    cost[0] = 0;
    function cell(i, j) {
      var c = i * W + j; if (i === 0 && j === 0) return;
      var best = INF, bf = 0, bl = 0, be = 0, bh = 0, k;
      if (i > 0) { k = (i - 1) * W + j; if (cost[k] + X < best) { best = cost[k] + X; bf = 1; bl = lag[k]; be = lastE[k]; bh = has[k]; } }
      if (j > 0) { k = i * W + j - 1; if (cost[k] + M < best) { best = cost[k] + M; bf = 2; bl = lag[k]; be = lastE[k]; bh = has[k]; } }
      if (i > 0 && j > 0) {
        k = (i - 1) * W + j - 1;
        if (cost[k] < INF) {
          var p = P[i - 1], e = E[j - 1], L = p.t - e.t, step;
          if (has[k]) {
            var gap = Math.max(0.05, e.t - lastE[k]), dl = L - lag[k];
            step = Math.abs(dl) <= 0.35 * gap + 0.04 ? Math.pow(dl / (0.35 * gap + 0.04), 2) : INF;
          } else step = Math.abs(L) < 2.5 ? Math.abs(L) * 0.4 : INF;   /* the first note: near where the count-in put it */
          if (step < INF) {
            var pc = 0;
            if (!e.chord && p.m !== null) { var d = Math.abs(p.m - e.m); d = Math.min(d, Math.abs(d - 12), Math.abs(d - 24)) + (d > 6 ? 0.5 : 0); pc = d < 0.5 ? 0 : Math.min(d, 4) * 0.6; }
            else if (!e.chord) pc = 0.5;
            if (cost[k] + step + pc < best) { best = cost[k] + step + pc; bf = 3; bl = L; be = e.t; bh = 1; }
          }
        }
      }
      cost[c] = best; from[c] = bf; lag[c] = bl; lastE[c] = be; has[c] = bh;
    }
    return {
      done: function () { return row > n; },
      rows: function (k) { for (var end = Math.min(n, row + k - 1); row <= end; row++) for (var j = 0; j <= m; j++) cell(row, j); },
      result: function () {
        var pairs = [], extra = [], ii = n, jj = m;
        while (ii > 0 || jj > 0) {
          var f2 = from[ii * W + jj];
          if (f2 === 3) { pairs.push([ii - 1, jj - 1]); ii--; jj--; } else if (f2 === 1) { extra.push(ii - 1); ii--; } else { jj--; }
        }
        pairs.reverse(); extra.reverse();
        return { pairs: pairs, extra: extra };
      }
    };
  }
  function align(P, E) { var a = aligner(P, E); while (!a.done()) a.rows(64); return a.result(); }

  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  /* the whole analysis as a job done in slices: job.step(ms) works for about that long and says when it is finished
     (the page runs it between frames after Stop; the Node checks run it in one go) */
  function job(fr, song, opts) {
    opts = opts || {};
    var hzOf = opts.hz || function (n) { return 440 * Math.pow(2, (n.m - 69) / 12); };
    var J = { done: false, stage: 0, result: null }, E, O, OJ, A, AL, oi = 0, byE, lags, G, res = [], ej = 0, WN = opts.warpN || 16;
    function warpAt(j) {   /* opts.local: a line through the 33 notes around (no reference playing); else the take's clock */
      var q0 = Math.max(0, Math.min(j - WN, E.length - 1 - 2 * WN)), q1 = Math.min(E.length - 1, q0 + 2 * WN), pts = [];
      for (var q = q0; q <= q1; q++) if (lags[q] !== null) pts.push([E[q].t - E[j].t, lags[q]]);
      if (pts.length < 4) return pts.length ? median(pts.map(function (p) { return p[1]; })) : 0;
      var a = 0, b = 0, use = pts;
      for (var it = 0; it < 3; it++) {
        var n = use.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
        use.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
        var den = n * sxx - sx * sx; b = den > 1e-9 ? (n * sxy - sx * sy) / den : 0; a = (sy - b * sx) / n;
        var rr = pts.map(function (p) { return Math.abs(p[1] - (a + b * p[0])); }), mad = median(rr);
        var keep = pts.filter(function (p, k) { return rr[k] <= Math.max(0.02, 2.5 * mad); });
        if (keep.length < 4) break;
        use = keep;
      }
      return a;
    }
    /* the take's clock (play-along: the player follows the app's reference, so on time means the score's clock):
       one tempo ratio for the whole take, the median of the slopes between pairs of matched notes at least a second
       apart, and one offset (latency, a late start) at the most common lag, so the notes played on time set it and
       the early and late ones do not pull it */
    function clock() {
      var pts = []; lags.forEach(function (L, j) { if (L !== null) pts.push([E[j].t, L]); });
      if (pts.length < 2) return { a: pts.length ? pts[0][1] : 0, b: 0 };
      var sl = [], step = Math.max(1, Math.floor(pts.length * pts.length / 40000));
      for (var i = 0, c = 0; i < pts.length; i++) for (var k = i + 1; k < pts.length; k++) if (pts[k][0] - pts[i][0] >= 1 && (c++ % step) === 0) sl.push((pts[k][1] - pts[i][1]) / (pts[k][0] - pts[i][0]));
      var b = sl.length ? median(sl) : 0;
      var r = pts.map(function (p) { return p[1] - b * p[0]; }).sort(function (x, y) { return x - y; }), best = -1, at = 0, lo = 0, hi = 0;
      for (i = 0; i < r.length; i++) {   /* the densest lag: an 8 ms triangle kernel over the sorted lags */
        while (r[i] - r[lo] >= 0.008) lo++;
        while (hi < r.length && r[hi] - r[i] < 0.008) hi++;
        var w = 0; for (k = lo; k < hi; k++) w += 1 - Math.abs(r[k] - r[i]) / 0.008;
        if (w > best) { best = w; at = r[i]; }
      }
      var near = r.filter(function (x) { return Math.abs(x - at) <= 0.01; });
      return { a: near.reduce(function (s2, x) { return s2 + x; }, 0) / near.length, b: b };
    }
    function note(e, j) {
      var r = { t: e.t, b: e.b, m: e.m, idx: e.idx, chord: e.chord };
      r.warp = opts.local ? warpAt(j) : G.a + G.b * e.t;
      if (byE[j] === undefined) { r.missed = true; return r; }
      var o = O[byE[j]], nextT = byE[j] + 1 < O.length ? O[byE[j] + 1].t : Infinity;
      r.onset = o.t; r.timing = Math.round((o.t - (e.t + r.warp)) * 1000);
      if (e.chord) { r.skip = 'chord'; return r; }
      /* the window: from the onset to the next onset (an open string ringing on is not measured past it), and no
         longer than the note's own length allows; attack 80 ms and release 120 ms left out (less for short notes) */
      var dur = (e.e - e.t), end = Math.min(nextT, o.t + dur * 1.25 + 0.1), L = end - o.t;
      var a = o.t + Math.min(0.08, 0.2 * L), b = end - Math.min(0.12, 0.2 * L);
      var hz = hzOf(song.notes[e.idx[0]]), cs = centsIn(fr, a, b, hz);
      if (!cs.length) { r.missed = true; r.timing = null; return r; }
      r.cents = Math.round(median(cs) * 10) / 10;
      r.hz = hz;
      if (cs.length >= 8) r.spread = Math.round((pct(cs, 0.95) - pct(cs, 0.05)) * 10) / 10;   /* vibrato: the 5th-95th percentile, beside the median */
      return r;
    }
    J.step = function (ms) {
      var t0 = now();
      while (!J.done && now() - t0 < ms) {
        if (J.stage === 0) { if (!OJ) { E = events(song); OJ = onsetJob(fr); } OJ.step(4000); if (OJ.done) { O = OJ.out; J.stage = 1; } }
        else if (J.stage === 1) {   /* each onset's pitch: the median of its frames until the next onset (for the alignment only) */
          for (var c = 0; c < 64 && oi < O.length; c++, oi++) {
            var o = O[oi], end = oi + 1 < O.length ? O[oi + 1].t : o.t + 2, fs = [], i0 = lowerBound(fr.t, o.t + 0.03), i1 = lowerBound(fr.t, end - 0.02);
            for (var i = i0; i < i1; i++) if (fr.f[i]) fs.push(midiOf(fr.f[i]));
            o.m = fs.length ? median(fs) : null;
          }
          if (oi >= O.length) { AL = aligner(O, E); J.stage = 2; }
        }
        else if (J.stage === 2) { AL.rows(Math.max(1, Math.floor(40000 / (E.length + 1)))); if (AL.done()) { A = AL.result(); byE = {}; A.pairs.forEach(function (pr) { byE[pr[1]] = pr[0]; }); lags = E.map(function (e, j) { return byE[j] !== undefined ? O[byE[j]].t - e.t : null; }); J.stage = 3; } }
        else if (J.stage === 3) { G = clock(); J.stage = 4; }
        else if (J.stage === 4) { for (var k = 0; k < 32 && ej < E.length; k++, ej++) res.push(note(E[ej], ej)); if (ej >= E.length) J.stage = 5; }
        else { J.result = { notes: res, extra: A.extra.map(function (k2) { return { t: O[k2].t, m: O[k2].m }; }), onsets: O.length, clock: G }; J.done = true; }
      }
      return J.done;
    };
    return J;
  }
  function analyse(fr, song, opts) { var j = job(fr, song, opts); j.step(Infinity); return j.result; }

  /* per bar and for the piece, by the definitions (Trix's spec): in tune |cents| <= 10, in time |ms| <= 25; a bar
     with a chord is not assessed (v1 does not guess which string is which) */
  function summarise(an, bars) {
    var B = bars.map(function (b, k) { return { num: b.num, beat: b.beat, next: k + 1 < bars.length ? bars[k + 1].beat : Infinity, notes: [] }; });
    an.notes.forEach(function (r) { for (var k = 0; k < B.length; k++) if (r.b >= B[k].beat - 1e-6 && r.b < B[k].next - 1e-6) { B[k].notes.push(r); break; } });
    B.forEach(function (b) {
      if (b.notes.some(function (r) { return r.chord; })) { b.state = 'na'; return; }
      var ok = b.notes.filter(function (r) { return r.cents !== undefined; });
      b.missed = b.notes.filter(function (r) { return r.missed; }).length;
      if (!ok.length) { b.state = b.notes.length ? 'na' : 'empty'; return; }
      b.cents = ok.reduce(function (s, r) { return s + Math.abs(r.cents); }, 0) / ok.length;
      b.worst = ok.reduce(function (w, r) { return Math.abs(r.cents) > Math.abs(w.cents) ? r : w; });
      var tm = ok.filter(function (r) { return r.timing !== null && r.timing !== undefined; });
      b.timing = tm.length ? tm.reduce(function (s, r) { return s + r.timing; }, 0) / tm.length : 0;
      b.absTiming = tm.length ? tm.reduce(function (s, r) { return s + Math.abs(r.timing); }, 0) / tm.length : 0;
      b.state = b.cents > RED ? 'red' : b.cents > AMBER ? 'amber' : 'ok';
      b.clean = b.state === 'ok' && b.absTiming <= IN_TIME && !b.missed;
    });
    var all = an.notes.filter(function (r) { return r.cents !== undefined; });
    var timed = all.filter(function (r) { return r.timing !== null && r.timing !== undefined; });
    var assessed = B.filter(function (b) { return b.cents !== undefined; });
    var run = 0, longest = 0, from = null, best = null;
    B.forEach(function (b) { if (b.clean) { if (!run) from = b; run++; if (run > longest) { longest = run; best = [from.num, b.num]; } } else if (b.state !== 'empty') run = 0; });
    return {
      bars: B,
      inTune: all.length ? Math.round(100 * all.filter(function (r) { return Math.abs(r.cents) <= IN_TUNE; }).length / all.length) : null,
      inTime: timed.length ? Math.round(100 * timed.filter(function (r) { return Math.abs(r.timing) <= IN_TIME; }).length / timed.length) : null,
      worst: assessed.slice().sort(function (a, b) { return b.cents - a.cents; }).slice(0, 5),
      cleanRun: { bars: longest, from: best && best[0], to: best && best[1] },
      notes: all.length, missed: an.notes.filter(function (r) { return r.missed; }).length, extra: an.extra.length
    };
  }

  root.ASSESS = { framer: framer, onsets: onsets, events: events, align: align, analyse: analyse, job: job, summarise: summarise, median: median,
    WIN: WIN, HOP: HOP, GATE: GATE, IN_TUNE: IN_TUNE, IN_TIME: IN_TIME, AMBER: AMBER, RED: RED };
})(typeof window !== 'undefined' ? window : module.exports);
