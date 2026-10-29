(function () {
  var P = { '1st': '一把位', '2nd': '二把位', '3rd': '三把位' };
  var DICT = {
    /* chrome */
    'Skip to content': '跳到内容',
    'Tools': '工具', 'Settings': '设置', 'Done': '完成', 'Check for updates': '检查更新', 'Checking…': '正在检查…', 'Up to date': '已是最新版本', 'Can’t check while offline': '离线时无法检查',
    'Fingerboard': '指板', 'Tuner': '调音器', 'Metronome': '节拍器',
    'Violin Toolkit': '小提琴工具箱',
    'What would you like to start with?': '想从哪个工具开始？',
    'Tune G · D · A · E with your microphone': '用麦克风为 G · D · A · E 调音',
    'Find and play notes in each position': '查找并弹奏各把位的音',
    'Keep steady time at any tempo': '以任意速度保持稳定节拍',
    'Language': '语言', 'Beat flash': '节拍闪屏', 'Appearance': '外观', 'Light': '浅色', 'Dark': '深色', 'Automatic': '自动', 'Colour': '颜色',
    'Calm teal': '静谧青', 'Sage green': '鼠尾草绿', 'Slate blue': '石板蓝', 'Soft violet': '柔紫', 'Classic': '经典',
    /* fingerboard */
    'Violin fingerboard': '小提琴指板', 'Position': '把位',
    'Auto vibrato': '自动揉弦', 'On': '开', 'Off': '关', 'Major': '大调', 'Minor': '小调', 'Pitch Check': '音准检测',
    '1st position': '一把位', '2nd position': '二把位', '3rd position': '三把位',
    'starting microphone…': '正在启动麦克风…', 'microphone not available here': '此处无法使用麦克风',
    'audio not supported': '不支持音频', 'listening…': '聆听中…', 'microphone blocked': '麦克风已被禁用',
    'in tune': '音准正确', 'off the board': '超出指板',
    'no sharps or flats': '无升降号', 'no ♯ or ♭': '无升降号',
    /* metronome */
    'Symbols': '符号', 'Notes': '音符', 'Bowing': '弓法', 'Accidentals': '变音记号',
    'Quaver (eighth note)': '八分音符', 'Crotchet (quarter note)': '四分音符', 'Minim (half note)': '二分音符', 'Semibreve (whole note)': '全音符',
    '½ beat in 4/4': '4/4 拍中占半拍', '1 beat in 4/4': '4/4 拍中占 1 拍', '2 beats in 4/4': '4/4 拍中占 2 拍', '4 beats in 4/4': '4/4 拍中占 4 拍',
    'Up bow': '上弓', 'Push, tip to frog': '推弓：弓尖到弓根', 'Down bow': '下弓', 'Pull, frog to tip': '拉弓：弓根到弓尖',
    'Flat': '降号', 'Semitone lower': '降低半音', 'Natural': '还原号', 'Cancels ♯ or ♭': '取消 ♯ 或 ♭', 'Sharp': '升号', 'Semitone higher': '升高半音',
    /* symbols */
    'Rests': '休止符', 'Articulation': '演奏法', 'Left hand': '左手', 'Dynamics': '力度', 'Expression': '表情', 'Ornaments': '装饰音', 'Repeats and jumps': '反复与跳转',
    'Clef and time': '谱号与拍号', 'Other': '其他', 'Semiquaver (16th note)': '十六分音符', '¼ beat in 4/4': '4/4 拍中占 1/4 拍', 'Dotted crotchet': '附点四分音符',
    '1½ beats in 4/4': '4/4 拍中占 1 拍半', 'Dotted minim': '附点二分音符', '3 beats in 4/4': '4/4 拍中占 3 拍', 'Two quavers': '二八节奏', 'Slur': '连弓',
    'Several notes in one bow': '一弓拉几个音', 'Tie': '连音线', 'Hold as one longer note': '两个音连成一个', 'Slurred staccato': '连弓断奏',
    'Stop between notes, one bow': '同一弓中音音分开', 'Portato (louré)': '连弓保持音', 'Gently pulse each note, one bow': '同一弓中每音轻轻分开', 'Tremolo': '震音',
    'Fast short bows near the tip': '弓尖快速来回', 'Pizzicato': '拨弦', 'Pluck with a finger': '用手指拨弦', 'Arco': '用弓', 'Back to the bow': '恢复用弓拉',
    'Left-hand pizzicato': '左手拨弦', 'Pluck with the left hand': '用左手手指拨', 'Col legno': '弓杆奏', 'Play with the stick': '用弓杆击弦', 'Sul ponticello': '近码奏',
    'Near the bridge, glassy': '靠近琴码，声音发虚', 'Sul tasto': '指板上奏', 'Over the fingerboard, soft': '在指板上方，声音柔和', 'Separate bows': '分弓',
    'Smooth, one note a bow': '一弓一音，连贯', 'Martelé': '顿弓', 'Bite, then release': '先压弦再快速放开', 'Spiccato': '跳弓', 'Bow bounces off the string': '弓离弦弹跳',
    'Whole bow': '全弓', 'Upper half': '上半弓', 'Lower half': '下半弓', 'At the frog': '弓根', 'At the tip': '弓尖', 'Double sharp': '重升号',
    'Two semitones higher': '升高两个半音', 'Double flat': '重降号', 'Two semitones lower': '降低两个半音', 'Semibreve rest': '全休止符',
    'A whole bar of silence': '整小节休止', 'Minim rest': '二分休止符', 'Crotchet rest': '四分休止符', 'Quaver rest': '八分休止符', 'Semiquaver rest': '十六分休止符',
    'Staccato': '断奏', 'Short and separated': '短而分开', 'Staccatissimo': '顿音', 'Very short': '非常短促', 'Tenuto': '保持音',
    'Full length, leaned on': '时值拉满，稍加重', 'Accent': '重音', 'Stronger start': '这个音加重', 'Marcato': '强重音', 'Strong accent': '比重音更强', 'Fermata': '延长记号',
    'Hold it longer': '拉长停留', 'Breath mark': '换气记号', 'Short lift': '稍作停顿、提弓', 'Caesura': '中止记号', 'Full stop, then go on': '完全停顿后继续',
    'Fingering': '指法', '0 open, 1–4 index to little': '0 空弦，1–4 食指到小指', 'Strings': '弦号',
    'I = E, II = A, III = D, IV = G': 'I 为 E 弦，II 为 A 弦，III 为 D 弦，IV 为 G 弦', 'On the G string': '在 G 弦上拉', 'Stay on one string': '保持在同一根弦',
    'Harmonic': '自然泛音', 'Touch the string lightly': '手指轻触弦', 'Artificial harmonic': '人工泛音', 'Press low, touch the diamond': '下指按弦，上指轻触',
    'Glissando': '滑音', 'Slide between the notes': '在两音间滑动', 'Vibrato': '揉弦', 'Without vibrato': '不揉弦', 'Softest': '极弱', 'Very soft': '很弱',
    'Soft': '弱', 'Fairly soft': '中弱', 'Fairly loud': '中强', 'Loud': '强', 'Very loud': '很强', 'Loudest': '极强', 'Sudden accent': '突强',
    'Also sf, fz': '也写作 sf、fz', 'Loud, then soft': '强后弱', 'Accent, then soft': '突强后弱', 'Suddenly soft': '突然变弱', 'Get louder': '渐强',
    'Get softer': '渐弱', 'dim. or decresc.': 'dim. 或 decresc.', 'Dying away': '渐消失', 'Metronome mark': '速度记号', '120 beats a minute': '每分钟 120 拍',
    'Broad, very slow': '广板', 'Fairly broad': '小广板', 'Slow': '柔板', 'Walking pace': '行板', 'Moderate': '中板', 'Fast and lively': '快板',
    'Lively': '活泼的快板', 'Very fast': '急板', 'As fast as possible': '最急板', '200 BPM and up': '200 BPM 以上', 'Gradually slower': '渐慢',
    'Slowing down': '渐慢（更平缓）', 'Smoother than rit.': '比 rit. 更平缓', 'Gradually faster': '渐快', 'Back to the tempo': '回原速',
    'Back to the first tempo': '回到最初速度', 'Flexible tempo': '自由速度', 'Sweetly': '柔和地', 'Singing': '如歌地', 'Expressively': '有表情地', 'Smoothly': '连贯地',
    'Lightly': '轻巧地', 'Marked': '着重地', 'Majestically': '庄严地', 'With spirit': '有活力地', 'Sustained': '持续地', 'Calmly': '安静地', 'Agitated': '激动地',
    'Gracefully': '优雅地', 'Very': '很', 'A little': '稍', 'Little by little': '逐渐地', 'More': '更', 'Less': '较少', 'Always': '始终', 'Trill': '颤音',
    'Alternate fast with the note above': '与上方音快速交替', 'Mordent': '上波音', 'Note, note above, note': '主音、上方音、主音', 'Lower mordent': '下波音',
    'Note, note below, note': '主音、下方音、主音', 'Turn': '回音', 'Above, note, below, note': '上方音、主音、下方音、主音', 'Inverted turn': '逆回音',
    'Below, note, above, note': '下方音、主音、上方音、主音', 'Appoggiatura': '倚音', 'Leaning note, takes time': '占用主音的时值', 'Acciaccatura': '短倚音',
    'Crushed in, very quick': '极快地带过', 'Start repeat': '反复开始', 'End repeat': '反复结束', 'Go back and play again': '返回再拉一遍',
    '1st and 2nd endings': '第一、第二结尾', 'Skip ending 1 the second time': '第二遍跳过第一结尾', 'Da capo': '从头反复', 'Back to the beginning': '回到开头',
    'Dal segno': '从记号处反复', 'Back to the sign': '回到记号处', 'The end': '结束', 'Where the music ends after a jump back': '跳回后在此结束', 'Segno (sign)': '记号',
    'Where dal segno jumps back to': '从记号处反复时跳回这里', 'Coda': '尾声', 'Jump to the ending': '跳到结尾段', 'Bar repeat': '小节反复', 'Play the last bar again': '重复上一小节',
    'Treble clef': '高音谱号', 'The violin clef': '小提琴用的谱号', 'Common time': '四四拍', 'Same as 4/4': '相当于 4/4', 'Cut time': '二二拍', 'Same as 2/2': '相当于 2/2',
    'Octave higher': '高八度', 'Octave lower': '低八度', 'Back to written pitch': '回到原音高', 'With mute': '加弱音器', 'Without mute': '去掉弱音器', 'Divided': '分奏',
    'Split the part': '声部分开拉', 'Together again': '齐奏', 'One player': '独奏', 'Everyone': '全体', 'Carry on the same way': '同前', 'Go straight on': '紧接',
    'No break': '不停顿', 'Turn quickly': '快翻页',
    'Tap': '点拍', 'Slower': '减慢', 'Faster': '加快', 'Time signature': '拍号', 'Beats per bar': '每小节拍数',
    'Note value': '音符时值', 'Tempo': '速度', 'Start': '开始', 'Stop': '停止',
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
    'After the first visit, it also works offline.': '第一次访问后，离线也能使用。',
    'Help': '帮助', 'Show tips again': '再次显示提示', 'Skip': '跳过', 'Next': '下一步', 'Got it': '知道了',
    'Tap here, then bow or pluck an open string. The tuner listens through the microphone.': '点这里，然后拉奏或拨一根空弦。调音器会通过麦克风听音。',
    'Read the needle': '看指针', 'In the middle and green means in tune. Left of centre is flat, right is sharp.': '指针在中间并变绿表示音准。偏左是偏低，偏右是偏高。',
    'Hear a string': '听空弦音', 'Tap a string name on the scroll to play its pitch. Tap it again to stop.': '点琴头上的弦名播放它的音高，再点一次停止。',
    'Violin or Chromatic': '小提琴或半音阶', 'Violin finds the nearest open string. Chromatic shows any note you play.': '小提琴模式找最接近的空弦；半音阶模式显示你拉的任何音。',
    'Press and hold a note': '按住一个音', 'Touch any coloured note to hear its pitch for as long as you hold it.': '按住任何彩色的音，按多久就响多久。',
    'Choose a key': '选择调', 'Pick a major or minor key; swipe a row to see more. Notes in the key are coloured, the others are greyed out.': '选择大调或小调，左右滑动可看到更多调。调内的音是彩色的，其他的是灰色。',
    'Positions': '把位', '1st position: the hand sits near the scroll, and the 1st finger plays the note just above each open string. In 2nd position the hand moves up, so the 1st finger goes where the 2nd finger was; in 3rd, where the 3rd finger was. The board shows each note and the finger that plays it.': '一把位：手靠近琴头，一指按每根空弦上方紧挨的那个音。二把位手往上移，一指放到原来二指的位置；三把位放到原来三指的位置。指板上标出每个音和按它的手指。',
    'Tap Pitch Check and play. A disc shows where your note lands: round the note when in tune, below it when sharp, above it when flat. Green means close.': '点“音准检测”后开始拉。圆盘显示你拉的音落在哪里：音准时圈住这个音，偏高时在它下方，偏低时在它上方。越绿越接近。',
    'Example: F on the E string, in C major': '例子：C 大调里 E 弦上的 F',
    'In tune': '音准正确', 'Too sharp': '偏高', 'Too flat': '偏低',
    'Start and set the tempo': '开始并设置速度', 'Tap the middle to start or stop. Drag around the dial to change the speed.': '点中间开始或停止，沿着转盘拖动改变速度。',
    'Tap the top number to change the beats per bar, and the bottom number to change the note value.': '点上面的数字改变每小节拍数，点下面的数字改变音符时值。',
    'Accents': '重音', 'Tap a beat to change how loudly it clicks: accent, medium, normal or muted.': '点一个拍子改变它的音量：重音、中、普通或静音。',
    'Tap tempo': '点拍定速', 'Tap in time a few times to set the tempo from your own beat.': '按你的节奏点几下，就能按你的拍子设定速度。',
    'Support': '支持', 'Note names': '音符名称', 'Tuning pitch (A4)': '标准音高 (A4)', 'Tuning pitch': '标准音高', 'Pitch names': '音名', 'Solfège': '唱名',
    'Buy me a coffee': '请我喝杯咖啡',
    'Like this app?': '喜欢这个应用？', 'Star on GitHub': '在 GitHub 上点个星',
    'QR code for buymeacoffee.com/trinks': 'buymeacoffee.com/trinks 二维码',
    'Listening… bow an open string and hold it.': '聆听中……请拉一根空弦并保持。',
    'Listening. Pluck or bow one string at a time.': '聆听中。请一次只拨或拉一根弦。',
    'Microphone ready. Tap anywhere on the page to start listening.': '麦克风已就绪。点按页面任意位置开始聆听。',
    'The microphone started but audio could not be processed.': '麦克风已启动，但无法处理音频。',
    'Microphone paused while a reference tone plays.': '播放参考音时麦克风已暂停。',
    'In tune.': '音准正确。',
    'Flat. Raise the pitch.': '偏低。请升高音高。',
    'Sharp. Lower the pitch.': '偏高。请降低音高。'
  };
  /* the same English word means different things in different places */
  var CTX = [
    ['#posbar', P],
    ['#labels', { '1st': '一', '2nd': '二', '3rd': '三', '4th': '四', 'finger': '指', '1st finger': '一指', '2nd finger': '二指', '3rd finger': '三指', '4th finger': '四指',
                  'open': '空弦', 'above': '高于', 'below': '低于', 'harm.': '泛音', 'octave': '八度' }]
  ];
  var Q = { major: '大调', minor: '小调' };
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
    [/^Version ([\d.]+(?:-test)?)$/, function (m, v) { return '版本 ' + v; }],
    [/^Updating to ([\d.]+)…$/, function (m, v) { return '正在更新到 ' + v + '…'; }],
    [/^(.+) (major|minor) · (1st|2nd|3rd) position$/, function (m, k, q, p) { return k + Q[q] + ' · ' + P[p]; }],
    [/^(.+) (major|minor) · Pitch Check(?: · (.+))?$/, function (m, k, q, s) { return k + Q[q] + ' · 音准检测' + (s ? ' · ' + s.split(' · ').map(pcPart).join(' · ') : ''); }],
    [/^(.+) (major|minor) · (no ♯ or ♭|\d sharps?|\d flats?)$/, function (m, k, q, w) { return k + Q[q] + ' · ' + words(w); }],
    [/^(.+) (major|minor): (.+)$/, function (m, k, q, w) { return k + Q[q] + '：' + (words(w) || w); }],
    [/^(\S+) (major|minor)$/, function (m, k, q) { return k + Q[q]; }],
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
    }).replace(/(^|[^A-Za-z0-9])([a-g])([\u266f\u266d]?)(?=$|[ \u00a0]+minor\b|小调)/g, function (m, pre, l, acc) {
      /* a minor key in lower case (e, f♯, "e minor", e小调): lower-case solfège */
      return pre + SOL[l.toUpperCase()].toLowerCase() + acc;
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
    if (n.parentNode && n.parentNode.closest && n.parentNode.closest('[translate="no"]')) return;
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
        if (n.nodeType === 1 && n.getAttribute('translate') === 'no') return NodeFilter.FILTER_REJECT;   /* Symbols: pizz., f, D.C. stay as printed */
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
