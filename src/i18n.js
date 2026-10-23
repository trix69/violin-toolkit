(function () {
  var P = { '1st': '一把位', '2nd': '二把位', '3rd': '三把位' };
  var DICT = {
    /* chrome */
    'Tools': '工具', 'Settings': '设置', 'Done': '完成',
    'Fingerboard': '指板', 'Tuner': '调音器', 'Metronome': '节拍器',
    'Violin Toolkit': '小提琴工具箱',
    'What would you like to start with?': '想从哪个工具开始？',
    'Tune G · D · A · E with your microphone': '用麦克风为 G · D · A · E 调音',
    'Find and play notes in each position': '查找并弹奏各把位的音',
    'Keep steady time at any tempo': '以任意速度保持稳定节拍',
    'Language': '语言', 'Appearance': '外观', 'Light': '浅色', 'Dark': '深色', 'Automatic': '自动', 'Colour': '颜色',
    'Calm teal': '静谧青', 'Sage green': '鼠尾草绿', 'Slate blue': '石板蓝', 'Soft violet': '柔紫', 'Classic': '经典',
    /* fingerboard */
    'Violin fingerboard': '小提琴指板', 'Position': '把位',
    'Auto vibrato': '自动揉弦', 'On': '开', 'Off': '关', 'Major': '大调', 'Pitch Check': '音准检测',
    '1st position': '一把位', '2nd position': '二把位', '3rd position': '三把位',
    'starting microphone…': '正在启动麦克风…', 'microphone not available here': '此处无法使用麦克风',
    'audio not supported': '不支持音频', 'listening…': '聆听中…', 'microphone blocked': '麦克风已被禁用',
    'in tune': '音准正确', 'off the board': '超出指板',
    'no sharps or flats': '无升降号', 'no ♯ or ♭': '无升降号',
    /* metronome */
    'Tap': '点拍', 'Slower': '减慢', 'Faster': '加快', 'Time signature': '拍号', 'Beats per bar': '每小节拍数',
    'Note value': '音符时值', 'Clicks per beat': '每拍点击数', 'Tempo': '速度', 'Start': '开始', 'Stop': '停止',
    'Beats. Tap a beat to change its accent.': '节拍。点按某一拍可更改其重音。',
    'Largo': '广板', 'Larghetto': '小广板', 'Adagio': '柔板', 'Andante': '行板', 'Moderato': '中板',
    'Allegro': '快板', 'Vivace': '活泼的快板', 'Presto': '急板', 'Prestissimo': '最急板',
    /* tuner */
    'Violin tuner': '小提琴调音器', 'Tuner settings': '调音器设置', 'Mode': '模式',
    'Violin': '小提琴', 'Chromatic': '半音阶', 'Start tuning': '开始调音',
    'Heard': '检测', 'Target': '目标', 'Offset': '偏差',
    'Pitch gauge from minus 50 to plus 50 cents': '音准表盘，从 −50 到 +50 音分',
    'Press Start tuning, then bow an open string and hold it.': '点“开始调音”，然后拉一根空弦并保持。',
    'Reference tones': '参考音',
    'Tap a string to hear its pitch. Tap again to stop. Match it by ear, or tune against the gauge.': '点击琴弦听其音高，再点一次停止。可凭耳朵对音，也可对照表盘调音。',
    'Tuning notes': '调音要点',
    'Go A, D, G, E': '按 A、D、G、E 的顺序',
    'Set the A first from the reference tone or a fork, then work through D, G and E. Each step leaves the earlier strings closer to where they were.': '先用参考音或音叉定好 A 弦，再依次调 D、G、E 弦。每一步都会让先前的琴弦更接近原来的位置。',
    'Fine tuners or pegs': '微调器还是弦轴',
    'Fine tuners handle moves of a few cents. Pegs do the big changes, and they should turn slowly.': '微调器用于调整几个音分的小幅偏差；大幅调整要用弦轴，并且要慢慢转动。',
    'Pluck, then bow': '先拨弦，再拉弓',
    'A plucked string gives a cleaner first reading. Bow it once you are close to check that the pitch holds.': '拨弦能让第一次读数更清晰。接近目标音高后再拉弓，检查音高是否稳定。',
    'Mind the room': '留意环境',
    'Temperature moves pitch. Re-check after bringing the violin in from the cold. New strings keep stretching, so retune a few times.': '温度会影响音高。把琴从寒冷环境带进室内后请重新检查。新弦会持续拉伸，需要多调几次。',
    'Requesting microphone…': '正在请求麦克风权限…',
    'Microphone was not enabled. Press Start tuning to try again, or allow it in your browser site settings.': '麦克风未启用。请点“开始调音”重试，或在浏览器的网站设置中允许使用麦克风。',
    'Microphone access was blocked. Allow it in your browser site settings and try again, or tune by ear with the reference tones below.': '麦克风访问被阻止。请在浏览器的网站设置中允许后重试，或使用下方参考音凭听觉调音。',
    'Mac / PC': 'Mac / PC',
    'Open this page in Chrome or Edge.': '用 Chrome 或 Edge 打开此页面。',
    'Click the install icon at the right end of the address bar.': '点击地址栏右端的安装图标。',
    'Click Install to confirm.': '点击“安装”确认。',
    'Open it from its new icon once while you have internet.': '在有网络时，从新图标打开一次。',
    'No install icon? Open the browser menu and choose Install Violin Toolkit. In Safari on a Mac, use File, then Add to Dock. Firefox cannot install apps, but the page still opens offline in a browser tab after one visit.': '没有安装图标？打开浏览器菜单，选择“安装小提琴工具箱”。在 Mac 的 Safari 中，请使用“文件”→“添加到 Dock”。Firefox 无法安装应用，但访问一次后，页面仍可在浏览器标签页中离线打开。',
    'Save Violin Toolkit for offline use.': '保存小提琴工具箱，离线也能用。', 'Show me how': '查看方法', 'Dismiss': '关闭', 'Offline use': '离线使用',
    'Offline': '离线使用', 'Use offline on your phone': '在手机上离线使用', 'Use offline': '离线使用',
    'Save Violin Toolkit so it opens like an app, even without internet.': '保存小提琴工具箱，像应用一样打开，没有网络也能用。',
    'iPhone / iPad': 'iPhone / iPad', 'Android': 'Android',
    'Open this page in Safari.': '用 Safari 打开此页面。',
    'Tap the Share button.': '点按“分享”按钮。',
    'Scroll down and tap Add to Home Screen.': '向下滑动，点按“添加到主屏幕”。',
    'Keep Open as Web App switched on, then tap Add.': '保持“作为网页 App 打开”开启，然后点按“添加”。',
    'Open it from the new Home Screen icon once while you have internet.': '在有网络时，从主屏幕新图标打开一次。',
    'Open this page in Chrome.': '用 Chrome 打开此页面。',
    'Tap the menu button.': '点按菜单按钮。',
    'Tap Install app, or Add to Home screen.': '点按“安装应用”或“添加到主屏幕”。',
    'Tap Install to confirm.': '点按“安装”确认。',
    'Open it from the new icon once while you have internet.': '在有网络时，从新图标打开一次。',
    'Use the app at least once with internet. After that, it also works offline.': '请至少在有网络时使用一次，之后也可离线使用。',
    'Support': '支持', 'Note names': '音符名称', 'Pitch names': '音名', 'Solfège': '唱名',
    'Buy me a coffee': '请我喝杯咖啡',
    'Like this app?': '喜欢这个应用？', 'Star on GitHub': '在 GitHub 上点个星',
    'QR code for buymeacoffee.com/trinks': 'buymeacoffee.com/trinks 二维码',
    'Listening… bow an open string and hold it.': '聆听中……请拉一根空弦并保持。',
    'Listening. Pluck or bow one string at a time.': '聆听中。请一次只拨或拉一根弦。',
    'Microphone ready. Tap anywhere on the page to start listening.': '麦克风已就绪。点按页面任意位置开始聆听。',
    'The microphone started but audio could not be processed.': '麦克风已启动，但无法处理音频。',
    'Microphone paused while a reference tone plays.': '播放参考音时麦克风已暂停。',
    'In tune.': '音准正确。'
  };
  /* the same English word means different things in different places */
  var CTX = [
    ['#posbar', P],
    ['#labels', { '1st': '一', '2nd': '二', '3rd': '三', '4th': '四', 'finger': '指', '1st finger': '一指', '2nd finger': '二指', '3rd finger': '三指', '4th finger': '四指',
                  'open': '空弦', 'above': '高于', 'below': '低于', 'harm.': '泛音', 'octave': '八度' }]
  ];
  var SW = { sharp: '升号', sharps: '升号', flat: '降号', flats: '降号' };
  function words(w) {
    if (DICT[w]) return DICT[w];
    var m = /^(\d) (sharps?|flats?)$/.exec(w);
    return m ? m[1] + '个' + SW[m[2]] : null;
  }
  function pcPart(s) {
    if (DICT[s]) return DICT[s];
    var m = /^(\d+)¢ (sharp|flat)$/.exec(s);
    return m ? (m[2] === 'sharp' ? '偏高 ' : '偏低 ') + m[1] + '¢' : s;
  }
  var RX = [
    [/^(.+) major · (1st|2nd|3rd) position$/, function (m, k, p) { return k + '大调 · ' + P[p]; }],
    [/^(.+) major · Pitch Check(?: · (.+))?$/, function (m, k, s) { return k + '大调 · 音准检测' + (s ? ' · ' + s.split(' · ').map(pcPart).join(' · ') : ''); }],
    [/^(.+) major · (no ♯ or ♭|\d sharps?|\d flats?)$/, function (m, k, w) { return k + '大调 · ' + words(w); }],
    [/^(.+) major: (.+)$/, function (m, k, w) { return k + '大调：' + (words(w) || w); }],
    [/^(\S+) major$/, function (m, k) { return k + '大调'; }],
    [/^Beat (\d+), (muted|normal|medium|accent)\. Tap to change\.$/, function (m, n, l) { return '第' + n + '拍，' + { muted: '静音', normal: '普通', medium: '中强', accent: '重音' }[l] + '。点按切换。'; }],
    [/^([GDAE]) string, (.+?)( natural harmonic)?, ([\d.]+) hertz\. Hold to play\.$/, function (m, s, n, h, f) { return s + '弦，' + n + (h ? '（自然泛音）' : '') + '，' + f + ' 赫兹。按住发声。'; }],
    [/^([GDAE]) string, ([\d.]+ Hz)(, playing)?$/, function (m, s, f, p) { return s + '弦，' + f + (p ? '，正在播放' : ''); }],
    [/^([GDAE]) string · (\d)(?:st|nd|rd|th)$/, function (m, s, n) { return s + '弦 · 第' + n + '弦'; }],
    [/^(Flat|Sharp) by ([\d.]+) cents\. (Raise|Lower) the pitch( with the fine tuner)?\.$/, function (m, d, a, r, f) { return (d === 'Flat' ? '偏低' : '偏高') + ' ' + a + ' 音分。请' + (r === 'Raise' ? '升高' : '降低') + '音高' + (f ? '（可用微调器）' : '') + '。'; }],
    [/^Open strings at A4 = (\d+) Hz: (.+) Hz\. 100 cents make a semitone; within 3 cents counts as in tune\.$/, function (m, a, b) { return '空弦音高（A4 = ' + a + ' Hz）：' + b + ' Hz。100 音分为一个半音；误差在 3 音分以内视为音准正确。'; }]
  ];

  var lang = 'en';
  try { var sv = localStorage.getItem('violin-lang'); if (sv === 'zh' || sv === 'en') lang = sv; } catch (e) {}
  if (window.HASH_LANG) { lang = window.HASH_LANG; try { localStorage.setItem('violin-lang', lang); } catch (e) {} }

  var names = 'letter';
  try { var sn = localStorage.getItem('violin-names'); if (sn === 'solfege' || sn === 'letter') names = sn; } catch (e) {}
  if (window.HASH_NAMES) { names = window.HASH_NAMES; try { localStorage.setItem('violin-names', names); } catch (e) {} }
  var SOL = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  var ART = /^(major|minor|string|strings|first|and|or|then|natural|to|from|is|at|with|on|off)$/;
  function sol(s) {
    return s.replace(/(^|[^A-Za-z0-9])([A-G])([\u266f\u266d]?)(\d{0,2})(?![A-Za-z0-9])(?=([ \u00a0]+[a-z]+)?)/g, function (m, pre, L, acc, oct, tail, off, whole) {
      if (L === 'A' && !acc && !oct) {
        var w = /^[ \u00a0]+([a-z]+)/.exec(whole.slice(off + m.length));
        if (w && !ART.test(w[1])) return m;
      }
      return pre + SOL[L] + acc + oct;
    });
  }
  function lookup(core, el) {
    var i, c;
    if (el && el.closest) {
      for (i = 0; i < CTX.length; i++) {
        c = CTX[i];
        if (Object.prototype.hasOwnProperty.call(c[1], core) && el.closest(c[0])) return c[1][core];
      }
    }
    if (Object.prototype.hasOwnProperty.call(DICT, core)) return DICT[core];
    for (i = 0; i < RX.length; i++) {
      var m = RX[i][0].exec(core);
      if (m) return RX[i][1].apply(null, m);
    }
    return null;
  }
  /* English ordinals: raise and shrink the suffix (1st, 2nd, 3rd, 4th) with superscript letters */
  var SUP = { s: '\u02e2', t: '\u1d57', n: '\u207f', d: '\u1d48', r: '\u02b3', h: '\u02b0' };
  function ord(s) {
    return s.replace(/(\d)(st|nd|rd|th)\b/g, function (m, d, x) { return d + x.replace(/./g, function (c) { return SUP[c]; }); });
  }
  function tr(s, el, isAttr) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2]) return null;
    var out = lang === 'zh' ? lookup(m[2], el) : null;
    if (out == null) out = m[2];
    if (names === 'solfege') out = sol(out);
    if (lang === 'en' && !isAttr) out = ord(out);
    return out === m[2] ? null : m[1] + out + m[3];
  }
  function active() { return true; }

  var textRec = new WeakMap(), attrRec = new WeakMap();
  function doText(n) {
    var rec = textRec.get(n), v = n.nodeValue;
    if (active()) {
      var base = (rec && v === rec.t) ? rec.o : v;
      var t = tr(base, n.parentNode);
      if (t != null) { textRec.set(n, { o: base, t: t }); if (t !== v) n.nodeValue = t; }
      else { if (rec && base !== v) n.nodeValue = base; textRec.delete(n); }
    } else if (rec) {
      if (v === rec.t) n.nodeValue = rec.o;
      textRec.delete(n);
    }
  }
  var ATTRS = ['aria-label', 'title', 'data-label'];
  function doAttr(el, a) {
    var recs = attrRec.get(el) || {}, rec = recs[a], v = el.getAttribute(a);
    if (v == null) { if (rec) { delete recs[a]; } return; }
    if (active()) {
      var base = (rec && v === rec.t) ? rec.o : v;
      var t = tr(base, el, true);
      if (t != null) { recs[a] = { o: base, t: t }; attrRec.set(el, recs); if (t !== v) el.setAttribute(a, t); }
      else { if (rec && base !== v) el.setAttribute(a, base); delete recs[a]; }
    } else if (rec) {
      if (v === rec.t) el.setAttribute(a, rec.o);
      delete recs[a];
    }
  }
  function doEl(el) { ATTRS.forEach(function (a) { if (el.hasAttribute && el.hasAttribute(a)) doAttr(el, a); }); }

  function process(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doEl(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }

  var busy = false;
  var obs = new MutationObserver(function (list) {
    if (busy) return;
    busy = true;
    list.forEach(function (m) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(process);
    });
    busy = false;
    obs.takeRecords();
  });

  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = lang === 'zh' ? '小提琴工具箱' : 'Violin Toolkit';
    busy = true; process(document.body); busy = false; obs.takeRecords();
  }
  window.I18N = {
    get lang() { return lang; },
    get names() { return names; },
    setNames: function (n) {
      if (n !== 'letter' && n !== 'solfege') return;
      names = n;
      try { localStorage.setItem('violin-names', n); } catch (e) {}
      apply();
    },
    set: function (l) {
      if (l !== 'zh' && l !== 'en') return;
      lang = l;
      try { localStorage.setItem('violin-lang', l); } catch (e) {}
      apply();
    }
  };
  apply();
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
