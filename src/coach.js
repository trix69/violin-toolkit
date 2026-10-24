/* First-use tips: the first time each tool opens, a short tour dims the page, spotlights one
   control at a time and explains it in a bubble. Finished or skipped tours are remembered in
   localStorage (violin-tips-seen); Settings > Show tips again clears that.
   nav_js calls APP.coach.maybe(view) after showing a tool and after the start overlay closes. */
(function () {
  var KEY = 'violin-tips-seen';
  var TOURS = {
    tuner: [
      { sel: '#go', title: 'Start tuning', text: 'Tap here, then bow or pluck an open string. The tuner listens through the microphone.' },
      { sel: '#gauge', title: 'Read the needle', text: 'In the middle and green means in tune. Left of centre is flat, right is sharp.' },
      { sel: '#strings', title: 'Hear a string', text: 'Tap a string name on the scroll to play its pitch. Tap it again to stop.' },
      { sel: '#view-tuner .seg', title: 'Violin or Chromatic', text: 'Violin finds the nearest open string. Chromatic shows any note you play.' }
    ],
    board: [
      { sel: '#board .note:not(.off)', title: 'Press and hold a note', text: 'Touch any coloured note to hear its pitch for as long as you hold it.' },
      { sel: '#keys', title: 'Choose a key', text: 'Notes in the key are coloured; the others are greyed out.' },
      { sel: '#posbar', title: 'Positions and Pitch Check', text: 'Switch between 1st, 2nd and 3rd position. Pitch Check listens while you play and marks each note you hit.' }
    ],
    metronome: [
      { sel: '#mDial', title: 'Start and set the tempo', text: 'Tap the middle to start or stop. Drag around the dial to change the speed.' },
      { sel: '#view-metronome .sig', title: 'Time signature', text: 'Tap the top number to change the beats per bar, and the bottom number to change the note value.' },
      { sel: '#mBeats', title: 'Accents', text: 'Tap a beat to change how loudly it clicks: strong, medium, normal or silent.' },
      { sel: '#mTap', title: 'Tap tempo', text: 'Tap in time a few times to set the tempo from your own beat.' }
    ]
  };
  var root = document.getElementById('coach'), hole = document.getElementById('coachHole'), tip = document.getElementById('coachTip');
  var arrow = document.getElementById('coachArrow'), stepEl = document.getElementById('coachStep');
  var titleEl = document.getElementById('coachTitle'), textEl = document.getElementById('coachText');
  var skipBtn = document.getElementById('coachSkip'), nextBtn = document.getElementById('coachNext');
  var tour = null, view = '', idx = 0, target = null, lastFocus = null, timer = 0;

  function seen() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function remember(v) {
    var s = seen();
    if (s.indexOf(v) < 0) s.push(v);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  /* wait while anything else is on top: the start overlay, Settings, Use offline, Symbols */
  function busy() {
    var l = document.getElementById('launch');
    if (l && !l.hidden) return true;
    return Array.prototype.some.call(document.querySelectorAll('.sheet'), function (s) { return !s.hidden; });
  }

  function place() {
    if (!tour || !target) return;
    var r = target.getBoundingClientRect(), pad = 6;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, g = 16;
    var top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
    var bottom = Math.min(vh - 4, r.bottom + pad), right = Math.min(vw - 4, r.right + pad);
    hole.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + (right - left) + 'px;height:' + (bottom - top) + 'px';
    /* bubble below the spotlight if it fits, else above, else over the lower part of the screen */
    var w = Math.min(320, vw - 2 * g), h = tip.offsetHeight, y, below = true;
    tip.style.width = w + 'px';
    if (bottom + 12 + h <= vh - g) y = bottom + 12;
    else if (top - 12 - h >= g) { y = top - 12 - h; below = false; }
    else { y = vh - g - h; below = false; }
    var cx = (left + right) / 2, x = Math.max(g, Math.min(vw - g - w, cx - w / 2));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    var spotOff = y >= bottom || y + h <= top;   /* the arrow only makes sense when the bubble sits clear of the spotlight */
    arrow.hidden = !spotOff;
    arrow.className = 'coach-arrow ' + (below ? 'up' : 'down');
    arrow.style.left = Math.max(14, Math.min(w - 14, cx - x)) + 'px';
  }

  function step(i) {
    idx = i;
    var s = tour[i];
    target = document.querySelector(s.sel);
    if (!target || !target.getClientRects().length) { if (i + 1 < tour.length) step(i + 1); else close(); return; }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    stepEl.textContent = (i + 1) + ' / ' + tour.length;
    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    nextBtn.textContent = i + 1 < tour.length ? 'Next' : 'Got it';
    requestAnimationFrame(function () { place(); try { nextBtn.focus({ preventScroll: true }); } catch (e) {} });
  }
  function next() { if (idx + 1 < tour.length) step(idx + 1); else close(); }
  function close() {
    if (!tour) return;
    remember(view);
    tour = null; target = null;
    root.hidden = true;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'Tab') {   /* keep focus on the two buttons */
      e.preventDefault();
      (document.activeElement === nextBtn ? skipBtn : nextBtn).focus();
    }
  }
  function start(v) {
    if (tour || !TOURS[v] || busy()) return;
    tour = TOURS[v]; view = v; lastFocus = document.activeElement;
    root.hidden = false;
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    step(0);
  }

  nextBtn.addEventListener('click', next);
  skipBtn.addEventListener('click', close);
  /* a tap anywhere outside the bubble moves on too, so the dimmed page never feels stuck */
  root.addEventListener('click', function (e) { if (!tip.contains(e.target)) next(); });

  APP.coach = {
    /* show this tool's tour once, after the page has settled and nothing else is open */
    maybe: function (v) {
      clearTimeout(timer);
      if (seen().indexOf(v) >= 0) return;
      timer = setTimeout(function () {
        if (document.body.getAttribute('data-view') === v && seen().indexOf(v) < 0) start(v);
      }, 500);
    },
    /* Settings > Show tips again */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    },
    start: start
  };
  /* a link like #tuner skips the start overlay and shows the tool before this script has loaded */
  APP.coach.maybe(document.body.getAttribute('data-view'));
})();
