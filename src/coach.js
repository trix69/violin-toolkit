/* First-use tips: the first time each tool opens, a short tour dims the page, spotlights one
   control at a time and explains it in a bubble. Finished or skipped tours are remembered in
   localStorage (violin-tips-seen; violin-tips-seen-test on the test site, renamed by make_pwa.py);
   Settings > Show tips again clears that.
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
      { sel: '#keyrows', title: 'Choose a key', text: 'Pick a major or minor key; swipe a row to see more. Notes in the key are coloured, the others are greyed out.' },
      { sel: '#posbar button:not([data-id="pc"])', title: 'Positions', text: '1st position: the hand sits near the scroll, and the 1st finger plays the note just above each open string. In 2nd position the hand moves up, so the 1st finger goes where the 2nd finger was; in 3rd, where the 3rd finger was. The board shows each note and the finger that plays it.' },
      { sel: '#posbar [data-id="pc"]', title: 'Pitch Check', text: 'Tap Pitch Check and play. A disc shows where your note lands: round the note when in tune, below it when sharp, above it when flat. Green means close.',
        pic: '<div class="coach-pic" aria-hidden="true"><p class="cp-cap">Example: F on the E string, in C major</p><div class="cp-row">' +
        ex('in', 50, 'In tune', '') + ex('sharp', 61, 'Too sharp', '+25¢') + ex('flat', 39, 'Too flat', '−25¢') + '</div></div>' }
    ],
    metronome: [
      { sel: '#mDial', title: 'Start and set the tempo', text: 'Tap the middle to start or stop. Drag around the dial to change the speed.' },
      { sel: '#view-metronome .sig', title: 'Time signature', text: 'Tap the top number to change the beats per bar, and the bottom number to change the note value.' },
      { sel: '#mBeats', title: 'Accents', text: 'Tap a beat to change how loudly it clicks: accent, medium, normal or muted.' },
      { sel: '#mTap', title: 'Tap tempo', text: 'Tap in time a few times to set the tempo from your own beat.' }
    ]
  };
  /* a small picture of the board for the Pitch Check tip: F on the E string in C major (low 1st finger),
     with the disc where it sits in tune, sharp and flat */
  function ex(kind, y, label, read) {
    return '<figure class="cp-' + kind + '"><svg viewBox="0 0 84 96"><rect width="84" height="96" rx="10" class="cp-board"/>' +
      '<line x1="42" y1="14" x2="42" y2="96" class="cp-string"/><line x1="0" y1="14" x2="84" y2="14" class="cp-nut"/>' +
      '<circle cx="42" cy="' + y + '" r="23" class="cp-disc"/><circle cx="42" cy="50" r="15" class="cp-note"/>' +
      '<text x="42" y="55.5" class="cp-name">F</text></svg><figcaption><b>' + label + '</b><span>' + (read || '&nbsp;') + '</span></figcaption></figure>';
  }
  var root = document.getElementById('coach'), hole = document.getElementById('coachHole'), tip = document.getElementById('coachTip');
  var arrow = document.getElementById('coachArrow'), stepEl = document.getElementById('coachStep');
  var titleEl = document.getElementById('coachTitle'), textEl = document.getElementById('coachText'), picEl = document.getElementById('coachPic');
  var skipBtn = document.getElementById('coachSkip'), nextBtn = document.getElementById('coachNext');
  var tour = null, view = '', idx = 0, target = null, targets = [], lastFocus = null, timer = 0, scrolled = false, inerted = [];

  /* names of the tools whose tour is done; "*" means all (the store-screenshot script sets that) */
  function seen() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function isSeen(v) { var s = seen(); return s.indexOf(v) >= 0 || s.indexOf('*') >= 0; }
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

  /* Put the bubble next to the spotlight without covering it: below, above, scrolled so it fits
     below, beside (wide screens), and only when none of those can work, over the lower part. */
  function place() {
    if (!tour || !target) return;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, g = 16, gap = 12, pad = 6;
    var w = Math.min(320, vw - 2 * g);
    tip.style.width = w + 'px';            /* width first, so the height read below is the wrapped height */
    var h = tip.offsetHeight;
    var r = targetRect();
    if (r.bottom <= 0 || r.top >= vh) {   /* scrolled away anyway (e.g. the browser bar resized): bring it back */
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      r = targetRect();
    }
    /* clamp both ends of each pair so they can't cross when the target is partly off screen */
    var top = Math.max(4, Math.min(vh - 4, r.top - pad)), bottom = Math.max(top, Math.min(vh - 4, r.bottom + pad));
    var left = Math.max(4, Math.min(vw - 4, r.left - pad)), right = Math.max(left, Math.min(vw - 4, r.right + pad));
    hole.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + Math.max(0, right - left) + 'px;height:' + Math.max(0, bottom - top) + 'px';
    var cx = (left + right) / 2, cy = (top + bottom) / 2, x, y, side = '';
    if (bottom + gap + h <= vh - g) { y = bottom + gap; side = 'below'; }
    else if (top - gap - h >= g) { y = top - gap - h; side = 'above'; }
    else if (!scrolled && (r.height + 2 * pad) + gap + h + 2 * g <= vh) {
      /* the page can make room: scroll once so the target sits near the top with the bubble under it */
      scrolled = true;
      window.scrollBy(0, r.top - pad - g);
      return place();
    }
    else if (vw - right - gap - g >= w) { x = right + gap; side = 'right'; }
    else if (left - gap - g >= w) { x = left - gap - w; side = 'left'; }
    if (!side) {
      /* a short, wide screen (a phone on its side): no side has room for the full width, so try a
         narrower bubble beside the target before covering it */
      var sw = Math.floor(Math.max(vw - right - gap - g, left - gap - g));
      if (sw >= 180) {
        tip.style.width = sw + 'px';
        if (tip.offsetHeight + 2 * g <= vh) {
          w = sw; h = tip.offsetHeight;
          side = vw - right - gap - g >= left - gap - g ? 'right' : 'left';
          x = side === 'right' ? right + gap : left - gap - w;
        } else tip.style.width = w + 'px';
      }
    }
    if (side === 'below' || side === 'above') x = Math.max(g, Math.min(vw - g - w, cx - w / 2));
    else if (side) y = Math.max(g, Math.min(vh - g - h, cy - h / 2));
    else {
      /* no room anywhere (a tall target on a short screen): sit at the top or bottom edge, whichever
         hides less of the spotlight, without an arrow */
      x = Math.max(g, Math.min(vw - g - w, cx - w / 2));
      var upY = g, downY = vh - g - h;
      var hid = function (y0) { return Math.max(0, Math.min(y0 + h, bottom) - Math.max(y0, top)); };
      y = hid(upY) < hid(downY) ? upY : downY;
      if (h <= vh) y = Math.max(0, Math.min(y, vh - h));   /* it fits the screen: keep all of it on screen */
    }
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    arrow.hidden = !side;
    arrow.className = 'coach-arrow ' + ({ below: 'up', above: 'down', right: 'lt', left: 'rt' }[side] || '');
    if (side === 'below' || side === 'above') { arrow.style.left = Math.max(14, Math.min(w - 14, cx - x)) + 'px'; arrow.style.top = ''; }
    else { arrow.style.top = Math.max(14, Math.min(h - 14, cy - y)) + 'px'; arrow.style.left = ''; }
  }
  /* a step can spotlight several elements (the 1st-3rd position buttons): the box round all of them */
  function targetRect() {
    var r = null;
    Array.prototype.forEach.call(targets, function (el) {
      var b = el.getBoundingClientRect();
      if (!b.width && !b.height) return;
      r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    });
    r = r || target.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, height: r.bottom - r.top };
  }
  /* after a rotation or resize, bring the target back into view before placing */
  function onResize() {
    if (!target) return;
    scrolled = false;
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    place();
  }

  function step(i) {
    idx = i;
    var s = tour[i];
    targets = document.querySelectorAll(s.sel);
    target = targets[0];
    if (!target || !target.getClientRects().length) { if (i + 1 < tour.length) step(i + 1); else close(); return; }
    scrolled = false;
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    stepEl.textContent = (i + 1) + ' / ' + tour.length;
    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    picEl.innerHTML = s.pic || '';
    picEl.hidden = !s.pic;
    nextBtn.textContent = i + 1 < tour.length ? 'Next' : 'Got it';
    /* place now as well as on the next frame: a browser that skips the frame (a hidden or covered
       window) must not leave the bubble unplaced at the top left */
    place();
    requestAnimationFrame(function () { place(); try { nextBtn.focus({ preventScroll: true }); } catch (e) {} });
  }
  function next() { if (idx + 1 < tour.length) step(idx + 1); else close(); }
  /* done = the person finished or skipped it (remembered); a tool switch only interrupts it */
  function close(done) {
    if (!tour) return;
    if (done !== false) remember(view);
    tour = null; target = null; targets = [];
    root.hidden = true;
    inerted.forEach(function (el) { el.inert = false; });
    inerted = [];
    document.removeEventListener('keydown', onKey, true);
    root.removeEventListener('wheel', noScroll);
    root.removeEventListener('touchmove', noScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', place, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* the page behind must not scroll under the tour: inert stops clicks and focus, not scrolling */
  var SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, ' ': 1 };
  /* one finger or a wheel would scroll the page; two fingers are a pinch-zoom, which stays allowed */
  function noScroll(e) { if (e.touches && e.touches.length > 1) return; e.preventDefault(); }
  function onKey(e) {
    if (SCROLL_KEYS[e.key] && !(e.key === ' ' && e.target.tagName === 'BUTTON')) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'Tab') {   /* keep focus on Skip and Next, in tab order both ways */
      if (e.shiftKey && document.activeElement !== nextBtn) { e.preventDefault(); nextBtn.focus(); }
      else if (!e.shiftKey && document.activeElement !== skipBtn) { e.preventDefault(); skipBtn.focus(); }
    }
  }
  function start(v) {
    if (tour || !TOURS[v] || busy()) return;
    tour = TOURS[v]; view = v; lastFocus = document.activeElement;
    root.hidden = false;
    /* the page behind is out of reach while the tour is up (screen readers and keyboard too) */
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== root && !el.inert && el.tagName !== 'SCRIPT') { el.inert = true; inerted.push(el); }
    });
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('wheel', noScroll, { passive: false });
    root.addEventListener('touchmove', noScroll, { passive: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', place, true);
    step(0);
  }

  nextBtn.addEventListener('click', next);
  skipBtn.addEventListener('click', function () { close(); });
  /* a tap anywhere outside the bubble moves on too, so the dimmed page never feels stuck */
  root.addEventListener('click', function (e) { if (!tip.contains(e.target)) next(); });

  APP.coach = {
    /* show this tool's tour once, after the page has settled and nothing else is open */
    maybe: function (v) {
      clearTimeout(timer);
      if (isSeen(v)) return;
      timer = setTimeout(function () {
        if (document.body.getAttribute('data-view') === v && !isSeen(v)) start(v);
      }, 500);
    },
    /* show() calls this first: a tour for the old tool closes without counting as seen */
    interrupt: function () { clearTimeout(timer); close(false); },
    /* Settings > Show tips again */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
    },
    start: start
  };
  /* a link like #tuner skips the start overlay and shows the tool before this script has loaded */
  APP.coach.maybe(document.body.getAttribute('data-view'));
})();
