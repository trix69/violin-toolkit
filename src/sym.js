(function () {
  /* Symbols: a page of violin notation (its own tool since Trix asked, 2026-11-06; it was a window on the
     metronome). Tap a symbol for its explanation; search by name, subtitle, printed sign, then explanation. */
  var $ = function (id) { return document.getElementById(id); };
  var symSheet = $('symbols');
  /* search: every word typed must appear in a symbol's name, subtitle or printed sign; only when nothing matches
     there, the explanations are searched too. Accents ignored (detache finds détaché) */
  var symQ = $('symQ');
  function fold(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function filterSym() {
    var words = fold(symQ.value).split(/\s+/).filter(Boolean), lis = symSheet.querySelectorAll('li[data-tip]');
    function match(deep) {
      return Array.prototype.filter.call(lis, function (li) {
        var text = fold(li.textContent + (deep ? ' ' + li.getAttribute('data-tip') : ''));
        return words.every(function (w) { return text.indexOf(w) >= 0; });
      });
    }
    var hits = match(false);
    if (!hits.length) hits = match(true);
    Array.prototype.forEach.call(lis, function (li) { li.hidden = hits.indexOf(li) < 0; });
    Array.prototype.forEach.call(symSheet.querySelectorAll('.sym-grid'), function (ul) {
      ul.hidden = !ul.querySelector('li[data-tip]:not([hidden])');
      ul.previousElementSibling.hidden = ul.hidden;   /* its heading */
    });
    $('symNone').hidden = hits.length > 0;
  }
  symQ.addEventListener('input', filterSym);
  symQ.addEventListener('input', filterSym);
  /* keys: Enter / Space on a symbol shows its explanation; while it shows, Esc, Enter, Space or Tab closes it */
  symSheet.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!tip.hidden) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') { e.preventDefault(); closeTip(); } return; }
    if ((e.key === 'Enter' || e.key === ' ') && t.hasAttribute && t.hasAttribute('data-tip')) { e.preventDefault(); openTip(t); }
  });
  /* a tap outside the page (app bar, tabs) also closes the explanation */
  document.addEventListener('pointerdown', function (e) { if (!tip.hidden && !symSheet.contains(e.target)) closeTip(); }, true);

  /* A tap on a symbol (or a hold, or Enter/Space) shows its explanation at once; it stays until a tap
     anywhere else, Esc, or a tap on the card. A tap on another symbol shows that one. */
  var tip = $('symTip'), tipCard = $('symTipCard'), tipFrom = null;
  var holdT = 0, holdLi = null, holdX = 0, holdY = 0, held = false, quietUntil = 0, downClosed = false;
  function openTip(li) {
    var head = $('symTipHead');
    head.textContent = '';
    Array.prototype.forEach.call(li.children, function (c) { head.appendChild(c.cloneNode(true)); });
    head.querySelector('b').id = 'symTipName';
    $('symTipText').textContent = li.getAttribute('data-tip');
    if (tipFrom) tipFrom.classList.remove('selected');
    tipFrom = li; li.classList.add('selected');
    /* in the half of the screen away from the symbol, so the symbol stays in sight (and can be held) */
    var r = li.getBoundingClientRect(), up = r.top + r.height / 2 > window.innerHeight / 2;
    tip.classList.toggle('up', up);
    /* on a short screen the card scrolls rather than reach over the symbol */
    var bottom = 20;
    tip.style.paddingBottom = bottom + 'px';
    tipCard.style.maxHeight = Math.max(120, up ? r.top - 30 : window.innerHeight - bottom - r.bottom - 10) + 'px';
    tip.hidden = false;
    try { tipCard.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeTip() {
    if (tip.hidden) return;
    tip.hidden = true;
    if (tipFrom) tipFrom.classList.remove('selected');
    if (tipFrom && (document.activeElement === tipCard || document.activeElement === document.body)) try { tipFrom.focus({ preventScroll: true }); } catch (e) {}
    tipFrom = null;
  }
  function endHold() { clearTimeout(holdT); if (holdLi) holdLi.classList.remove('pressing'); holdLi = null; }
  symSheet.addEventListener('pointerdown', function (e) {
    downClosed = false;
    if (!tip.hidden && !tipCard.contains(e.target)) { closeTip(); downClosed = true; }
    var li = e.target.closest && e.target.closest('li[data-tip]');
    if (!li || e.button > 0) return;
    endHold(); holdLi = li; holdX = e.clientX; holdY = e.clientY; li.classList.add('pressing');
    holdT = setTimeout(function () { var l = holdLi; endHold(); held = true; openTip(l); }, 450);
  });
  symSheet.addEventListener('pointermove', function (e) { if (holdLi && Math.abs(e.clientX - holdX) + Math.abs(e.clientY - holdY) > 10) endHold(); });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    symSheet.addEventListener(ev, function () {
      endHold();
      if (held) { held = false; quietUntil = Date.now() + 600; }
    });
  });
  /* the click that follows the release of a hold (it can come late after a touch) is not a tap */
  symSheet.addEventListener('click', function (e) { if (held || Date.now() < quietUntil) { quietUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
  symSheet.addEventListener('click', function (e) {
    var li = e.target.closest && e.target.closest('li[data-tip]');
    if (li) { downClosed = false; openTip(li); }
  });
  symSheet.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('li[data-tip]')) e.preventDefault(); });
  tipCard.addEventListener('click', closeTip);


  APP.views.symbols = {
    show: function () {},
    hide: function () { closeTip(); endHold(); }
  };
})();
