const themeManager = {
  current: 'auto',
  apply() {
    const theme = this.current === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : this.current;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1c1e' : '#f5f5f7');
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  },
  init() {
    try { this.current = localStorage.getItem('murphy_theme') || 'auto'; } catch { /* storage unavailable */ }
    this.apply();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (this.current === 'auto') this.apply(); });
  },
  toggle() {
    this.current = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('murphy_theme', this.current); } catch { /* storage unavailable */ }
    this.apply();
  },
};
import { compose, composeCelebration, composeDark, synthesizeWav, TICKS_PER_BEAT } from './music.js';
import { randomSeed, seededRandom, VALID_SEED, EASTER_SEED, isDarkSeed } from './seed.js';
import { EASTER_TEXT, EASTER_BITMAP, DARK_CROSS_TEXT, DARK_CROSS_BITMAP, DARK_RED } from './easter.js';
import { jianpuToken, scoreSlurMarks, scoreSlurPlan, jianpuFlatLineSegments } from './notation.js';
import { displayLineBreaks } from './text-format.js';
import { TAB_PATHS, routeType, tabUrl } from './routes.js';
import { exportFilename } from './export-name.js';
import { trackMetadata } from './media-info.js';
import { buildBackgroundBatch, retimbreBackgroundBatch, segmentAtTime, pieceDuration, isIOSBrowser } from './background-music.js';

const $ = (selector) => document.querySelector(selector);
const dictionaries = {
  en: {
    language: 'Language', eyebrow: 'Murphy\'s Law', heading: 'Anything that can go wrong will eventually go wrong.',
    intro: 'Random your wrong.',
    darkEyebrow: "No, it wasn't me. I don't know.", darkHeading: 'Why are you here?',
    darkIntro: 'I remember you.',
    textTab: 'Text', imageTab: 'Image', musicTab: 'Music', textEyebrow: '01', textTitle: 'Text',
    textDescription: 'Generate random Unicode characters.\nChoose a length from 20 to 4096.\nThey say the monkey at the typewriter eventually just peed on it.', length: 'Text length', lengthHint: '20–4096 characters', darkLengthHint: '1 character · fixed preset',
    livePreview: 'LIVE PREVIEW', imageEyebrow: '02', imageTitle: 'Image',
    imageDescription: 'Fill every pixel with a random color.\nYou might get a landscape, a classic masterpiece, your cat, or even the face of the person in front of the screen.\nMost of the time it just looks like meaningless colored pixels......or does it?', width: 'Width', widthHint: '16–1920 px',
    height: 'Height', heightHint: '8–1080 px', musicEyebrow: '03', musicTitle: 'Music',
    musicDescription: 'Random pitches, beats, BPM, and content.\nIt has the air of a modern-day Beethoven.\nOh, that damned score—even Liszt would be helpless.', bars: 'Measures', barsHint: '4–32 measures', darkBarsHint: '1 measure · fixed preset',
    timeSignature: 'TIME SIGNATURE', tempo: 'TEMPO', instrument: 'INSTRUMENT', piano: 'Piano', scorePreview: 'GENERATED CONTENT',
    pause: 'Pause generation', resume: 'Resume generation', live: 'Generating', paused: 'Paused',
    exportTxt: 'Export .txt', exportPng: 'Export .png', exportWav: 'Export .wav',
    privacyNote: 'All content is generated locally.', sourceCode: 'Source code', agreement: 'User agreement', privacy: 'Privacy policy',
    characters: 'characters', measures: 'measures', beat: 'BPM', theme: 'Toggle theme',
    generated: 'generated',
    seed: 'Seed', seedHint: 'A fixed value corresponding to each generated result', applySeed: 'Recreate', copySeed: 'Copy',
    notGenerated: 'Not generated', generateMusic: 'Generate & play', generateNext: 'Generate next & play',
    emptyScore: 'Generate music to see its notation.', seedPlaceholder: 'Enter a seed',
    electric: 'Electric piano', musicBox: 'Music box', pluck: 'Plucked strings', marimba: 'Marimba', organ: 'Organ',
    playCurrent: 'Play current', pauseCurrent: 'Pause', seek: 'Seek music',
    keysGroup: 'Keys', stringsGroup: 'Strings', windsGroup: 'Winds & brass', bellsGroup: 'Bells & synth',
    acousticGuitar: 'Acoustic guitar', harp: 'Harp', bass: 'Bass guitar', violin: 'Violin', cello: 'Cello',
    flute: 'Flute', clarinet: 'Clarinet', saxophone: 'Saxophone', trumpet: 'Trumpet', bell: 'Bell', synthLead: 'Synth lead',
    invalidSeed: 'Use only A–Z, a–z, 0–9 and ! @ # $ % ^ & * _ - = + / (no spaces).', emptySeed: 'Enter a seed first.', easterEgg: 'Easter egg',
    ageTitle: 'Confirm your age.', ageDescription: 'In accordance with relevant laws, we need to know your age in order to provide the corresponding services.\nAre you 18 years of age or older?',
    ageYes: 'Yes', ageNo: 'No', ageDenied: 'We are unable to provide service to you.',
  },
  zh: {
    language: '语言', eyebrow: '墨菲定律', heading: '凡是可能出错的事情，最终都会出错。',
    intro: '随机属于你的错误。',
    darkEyebrow: '不，不是我，我不知道。', darkHeading: '你为什么会在这里？',
    darkIntro: '我记住你了。',
    textTab: '文本', imageTab: '图片', musicTab: '音乐', textEyebrow: '01', textTitle: '文本',
    textDescription: '随机生成 Unicode 字符。\n可自定义长度在 20 至 4096 范围内。\n听说摆弄打字机的那只猴子，最终只是在打字机上尿了一泡。', length: '文本长度', lengthHint: '20–4096 个字符', darkLengthHint: '固定 1 个字符',
    livePreview: '实时预览', imageEyebrow: '02', imageTitle: '图片',
    imageDescription: '以随机的颜色填充每一个像素。\n可能会生成风景画、经典名作、你家的猫猫，甚至屏幕前那个人的脸。\n不过大多数时候看起来都是毫无意义的彩点......是吗？', width: '宽度', widthHint: '16–1920 像素',
    height: '高度', heightHint: '8–1080 像素', musicEyebrow: '03', musicTitle: '音乐',
    musicDescription: '随机音调、节拍、BPM、内容。\n颇有当代贝多芬的风范。\n哦这该死的谱子，李斯特看了也无能为力。', bars: '小节数', barsHint: '4–32 小节', darkBarsHint: '固定 1 小节',
    timeSignature: '拍号', tempo: '速度', instrument: '音色', piano: '钢琴', scorePreview: '生成内容',
    pause: '暂停生成', resume: '继续生成', live: '生成中', paused: '已暂停',
    exportTxt: '导出 .txt', exportPng: '导出 .png', exportWav: '导出 .wav',
    privacyNote: '所有内容均在本地生成。', sourceCode: '开源地址', agreement: '用户协议', privacy: '隐私政策',
    characters: '字符', measures: '小节', beat: 'BPM', theme: '切换主题',
    generated: '已生成',
    seed: '种子', seedHint: '每个随机内容对应的固定值', applySeed: '复现', copySeed: '复制',
    notGenerated: '未生成', generateMusic: '生成并播放', generateNext: '生成下一段并播放',
    emptyScore: '生成音频后显示简谱。', seedPlaceholder: '输入种子',
    electric: '电钢琴', musicBox: '八音盒', pluck: '拨弦', marimba: '马林巴', organ: '管风琴',
    playCurrent: '播放当前音频', pauseCurrent: '暂停播放', seek: '音频进度',
    keysGroup: '键盘', stringsGroup: '弦乐', windsGroup: '管乐与铜管', bellsGroup: '钟声与合成器',
    acousticGuitar: '木吉他', harp: '竖琴', bass: '贝斯', violin: '小提琴', cello: '大提琴',
    flute: '长笛', clarinet: '单簧管', saxophone: '萨克斯', trumpet: '小号', bell: '钟声', synthLead: '合成器主音',
    invalidSeed: '仅允许大小写字母、数字和 ! @ # $ % ^ & * _ - = + /，不能含空格。', emptySeed: '请先输入种子。', easterEgg: '彩蛋',
    ageTitle: '确认您的年龄。', ageDescription: '根据有关法律规定，我们需要了解您的年龄以提供对应服务。\n您年满 18 周岁了吗？',
    ageYes: '是', ageNo: '否', ageDenied: '很遗憾，我们暂时无法为您提供服务。',
  },
};
let language = /^zh(?:-|$)/i.test(navigator.languages?.[0] || navigator.language || '') ? 'zh' : 'en';
// Translation strings may contain \n to make visible line breaks.
const t = (key) => displayLineBreaks(dictionaries[language][key]);
const states = Object.fromEntries(['text', 'image', 'music'].map((type) => {
  let count = 0;
  try {
    const key = `murphy_count_${type}`;
    let saved = localStorage.getItem(key);
    if (type === 'music' && saved === null) {
      // One-time migration frees the old count key for a future distinct page.
      const legacyKey = 'murphy_count_audio';
      saved = localStorage.getItem(legacyKey);
      if (saved !== null) {
        localStorage.setItem(key, saved);
        localStorage.removeItem(legacyKey);
      }
    }
    count = Math.max(0, Number(saved) || 0);
  } catch { /* storage unavailable */ }
  return [type, { paused: false, count, seed: '', generated: false, easterEgg: false, eggKind: null, savedSetting: null }];
}));
let musicUrl = null;
let musicChain = false;
const IOS_MUSIC = isIOSBrowser(navigator);
const intervals = { text: 100, image: 100 };
let pausedLengthTimer = 0;
// Keep the root URL as the app base even after pushState changes the address.
const appBase = new URL('.', location.href);
const requestedTab = new URLSearchParams(location.search).get('tab');
if (Object.hasOwn(TAB_PATHS, requestedTab)) {
  // Static entry pages redirect through the root, retaining their seed.
  const params = new URLSearchParams(location.search);
  const seed = params.has('seed') ? params.get('seed') : null;
  history.replaceState(null, '', tabUrl(requestedTab, appBase, seed) + location.hash);
}
let activeType = 'text';
const imageCache = { width: 0, height: 0, ctx: null, data: null, words: null };
const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const unicodeRanges = [
  [0x21, 0x7e], [0xc0, 0x17f], [0x370, 0x3ff], [0x400, 0x4ff],
  [0x3041, 0x3096], [0x4e00, 0x9fa5], [0x1f600, 0x1f64f],
];
const unicodeWeights = [.30, .44, .53, .63, .74, .98, 1];
const textOutput = $('#text-output');

function updateHero() {
  const darkActive = Object.values(states).some((state) => state.eggKind === 'dark');
  document.body.classList.toggle('dark-egg-active', darkActive);
  for (const key of ['eyebrow', 'heading', 'intro']) {
    $(`.intro [data-i18n="${key}"]`).textContent = t(darkActive ? `dark${key[0].toUpperCase()}${key.slice(1)}` : key);
  }
}
function translate() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  updateHero();
  document.querySelectorAll('[data-i18n-label]').forEach((node) => { node.label = t(node.dataset.i18nLabel); });
  $('#theme-toggle').title = t('theme');
  $('#theme-toggle').setAttribute('aria-label', t('theme'));
  $('#tabs').setAttribute('aria-label', language === 'zh' ? '生成器' : 'Generators');
  $('#text-length-number').setAttribute('aria-label', t('length'));
  $('#music-bars-number').setAttribute('aria-label', t('bars'));
  $('#language-select').setAttribute('aria-label', t('language'));
  $('#music-instrument').setAttribute('aria-label', t('instrument'));
  $('#music-seek').setAttribute('aria-label', t('seek'));
  for (const type of Object.keys(states)) {
    $(`#${type}-count`).textContent = `${t('generated')}: ${states[type].count.toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}`;
    $(`#${type}-seed-input`).setAttribute('aria-label', `${t('seed')} · ${t('seedHint')}`);
    $(`#${type}-seed-input`).placeholder = t('seedPlaceholder');
    updateControls(type);
  }
  $('#text-meta').textContent = `${$('#text-length').value} ${t('characters')}`;
  if (states.text.eggKind === 'dark') $('#text-length-hint').textContent = t('darkLengthHint');
  if (states.music.eggKind === 'dark') $('#music-bars-hint').textContent = t('darkBarsHint');
  if (states.music.piece) {
    $('#music-meta').textContent = `${states.music.piece.bars.length} ${t('measures')}`;
    updateScoreHeading(states.music.piece);
  }
  for (const type of Object.keys(states)) validateSeedField(type, false);
  updatePlaybackControls();
  updateMediaMetadata();
}
function updateControls(type) {
  const state = states[type];
  const status = $(`#${type}-status`);
  status.replaceChildren();
  status.classList.toggle('is-easter', state.easterEgg);
  status.classList.toggle('is-dark-egg', state.eggKind === 'dark');
  if (type === 'music') $('#music-generate').disabled = state.easterEgg;
  if (type === 'music' && !state.generated) {
    status.textContent = t('notGenerated');
    status.classList.add('is-paused');
    $('#music-pause').disabled = true;
    $('#music-pause').textContent = `Ⅱ ${t('pause')}`;
    $('#music-export').disabled = true;
    $('#music-playback').hidden = true;
    $('#music-generate').textContent = t('generateMusic');
  } else {
    if (state.easterEgg) {
      status.textContent = t('easterEgg');
      status.classList.remove('is-paused');
    } else {
      const dot = document.createElement('span'); dot.className = 'status-dot';
      status.append(dot, state.paused ? t('paused') : t('live'));
      status.classList.toggle('is-paused', state.paused);
    }
    $(`#${type}-pause`).disabled = false;
    $(`#${type}-pause`).textContent = state.paused ? `▶ ${t('resume')}` : `Ⅱ ${t('pause')}`;
    if (type === 'music') {
      $('#music-export').disabled = false;
      $('#music-playback').hidden = false;
      $('#music-generate').textContent = t('generateNext');
    }
  }
  $(`#${type}-copy-seed`).disabled = !state.seed;
}
function showSeedError(type, message = '') {
  const error = $(`#${type}-seed-error`);
  if (error.textContent !== message) error.textContent = message;
  if (error.hidden !== !message) error.hidden = !message;
  const input = $(`#${type}-seed-input`);
  const invalid = String(Boolean(message));
  if (input.getAttribute('aria-invalid') !== invalid) input.setAttribute('aria-invalid', invalid);
}
function validateSeedField(type, requireValue = true) {
  const seed = $(`#${type}-seed-input`).value;
  const message = !seed ? (requireValue ? t('emptySeed') : '') : VALID_SEED.test(seed) ? '' : t('invalidSeed');
  showSeedError(type, message);
  return !message;
}
function paintCount(type) {
  const state = states[type];
  $(`#${type}-count`).textContent = `${t('generated')}: ${state.count.toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}`;
  state.lastCountPaint = performance.now();
}
function persistCount(type) {
  try { localStorage.setItem(`murphy_count_${type}`, String(states[type].count)); } catch { /* storage unavailable */ }
}
function updateRouteSeed(type, seed) {
  if (activeType !== type || $('#app').hasAttribute('inert')) return;
  const next = tabUrl(type, appBase, seed);
  if (location.pathname + location.search !== next) history.replaceState(null, '', next);
}
function recordGeneration(type, seed) {
  const state = states[type];
  const first = !state.generated;
  state.seed = seed;
  state.generated = true;
  updateRouteSeed(type, seed);
  state.count++;
  if (type === 'music' || state.count % 10 === 0) persistCount(type);
  $(`#${type}-seed-input`).value = seed;
  if (!$(`#${type}-seed-error`).hidden) showSeedError(type);
  if (type === 'music' || first || performance.now() - (state.lastCountPaint || 0) >= 400) paintCount(type);
  if (first || type === 'music') updateControls(type);
}
function schedule(type, callback) {
  clearInterval(states[type].timer);
  if (!states[type].paused && !states[type].easterEgg && activeType === type && !document.hidden) {
    states[type].timer = setInterval(callback, intervals[type]);
  }
}
function stopGeneration(type) {
  if (type === 'music' && IOS_MUSIC) $('#music-player').loop = false;
  if (type === 'text') { clearTimeout(pausedLengthTimer); pausedLengthTimer = 0; }
  states[type].paused = true;
  clearInterval(states[type].timer);
  paintCount(type); persistCount(type);
  updateControls(type);
}
function setEasterState(type, active, kind = 'friendly') {
  const state = states[type];
  if (state.easterEgg === active) return;
  if (active) {
    if (type === 'text') {
      state.savedSetting = $('#text-length').value;
      const length = [...displayLineBreaks(kind === 'dark' ? DARK_CROSS_TEXT : EASTER_TEXT)].length;
      const minimum = kind === 'dark' ? '1' : '20';
      $('#text-length').min = minimum;
      $('#text-length-number').min = minimum;
      $('#text-length-hint').textContent = kind === 'dark' ? t('darkLengthHint') : t('lengthHint');
      $('#text-length').value = String(length);
      $('#text-length-number').value = String(length);
    } else if (type === 'image') {
      state.savedSetting = [$('#image-width').value, $('#image-height').value];
      const rows = kind === 'dark' ? DARK_CROSS_BITMAP : EASTER_BITMAP;
      $('#image-width').value = String(rows[0].length + 2);
      $('#image-height').value = String(rows.length + 2);
    } else {
      state.savedSetting = $('#music-bars').value;
      const bars = kind === 'dark' ? '1' : '4';
      $('#music-bars').min = bars;
      $('#music-bars-number').min = bars;
      $('#music-bars-hint').textContent = kind === 'dark' ? t('darkBarsHint') : t('barsHint');
      $('#music-bars').value = bars;
      $('#music-bars-number').value = bars;
    }
  } else {
    if (type === 'text') {
      $('#text-length').min = '20';
      $('#text-length-number').min = '20';
      $('#text-length-hint').textContent = t('lengthHint');
      $('#text-length').value = state.savedSetting;
      $('#text-length-number').value = state.savedSetting;
      state.displayedLength = null;
    } else if (type === 'image') {
      [$('#image-width').value, $('#image-height').value] = state.savedSetting;
      imageCache.width = 0;
      imageCache.height = 0;
    } else {
      $('#music-bars').min = '4';
      $('#music-bars-number').min = '4';
      $('#music-bars-hint').textContent = t('barsHint');
      $('#music-bars').value = state.savedSetting;
      $('#music-bars-number').value = state.savedSetting;
    }
    state.savedSetting = null;
  }
  state.easterEgg = active;
  state.eggKind = active ? kind : null;
  updateHero();
  const controls = {
    text: ['text-length', 'text-length-number'],
    image: ['image-width', 'image-height'],
    music: ['music-bars', 'music-bars-number'],
  };
  for (const id of controls[type]) $(`#${id}`).disabled = active;
  if (type === 'text') $('#panel-text').classList.toggle('is-dark-text-egg', active && kind === 'dark');
  updateControls(type);
}
function renderPresetText(seed, value) {
  const output = displayLineBreaks(value);
  const length = [...output].length;
  states.text.value = output;
  textOutput.value = output;
  states.text.displayedLength = length;
  $('#text-meta').textContent = `${length} ${t('characters')}`;
  recordGeneration('text', seed);
}
function renderEasterText(seed) { renderPresetText(seed, EASTER_TEXT); }
function renderDarkText(seed) { renderPresetText(seed, DARK_CROSS_TEXT); }
function renderBitmapEgg(seed, rows, background, scale) {
  const width = rows[0].length + 2;
  const height = rows.length + 2;
  const canvas = $('#image-canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width * scale}px`;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(x + 1, y + 1, 1, 1);
  });
  imageCache.width = 0;
  imageCache.height = 0;
  $('#image-meta').textContent = `${width} × ${height} px`;
  recordGeneration('image', seed);
}
function renderEasterImage(seed) { renderBitmapEgg(seed, EASTER_BITMAP, '#ffffff', 16); }
function renderDarkImage(seed) { renderBitmapEgg(seed, DARK_CROSS_BITMAP, DARK_RED, 32); }
function generateText(seed = randomSeed()) {
  if (states.text.easterEgg) return;
  const count = Number($('#text-length').value);
  const rng = seededRandom(seed, 'text');
  const chars = new Array(count);
  // Printable Unicode blocks only: no controls, isolated surrogates or noncharacters.
  for (let i = 0; i < count; i++) {
    const pick = rng();
    let pool = 0;
    while (pick >= unicodeWeights[pool]) pool++;
    const [start, end] = unicodeRanges[pool];
    chars[i] = String.fromCodePoint(start + Math.floor(rng() * (end - start + 1)));
  }
  states.text.value = chars.join('');
  textOutput.value = states.text.value;
  if (states.text.displayedLength !== count) {
    states.text.displayedLength = count;
    if (document.activeElement !== textLengthNumber) textLengthNumber.value = String(count);
    $('#text-meta').textContent = `${count} ${t('characters')}`;
  }
  recordGeneration('text', seed);
}
function validDimension(element, min, max, fallback) {
  const value = Number(element.value);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
function generateImage(seed = randomSeed()) {
  if (states.image.easterEgg) return;
  const width = validDimension($('#image-width'), 16, 1920, imageCache.width || 640);
  const height = validDimension($('#image-height'), 8, 1080, imageCache.height || 400);
  const canvas = $('#image-canvas');
  if (width !== imageCache.width || height !== imageCache.height) {
    canvas.width = width; canvas.height = height;
    const scale = Math.min(16, Math.max(1, Math.floor(600 / width)), Math.max(1, Math.floor(400 / height)));
    canvas.style.width = scale > 1 ? `${width * scale}px` : '';
    imageCache.width = width; imageCache.height = height;
    imageCache.ctx = canvas.getContext('2d', { alpha: false });
    imageCache.data = imageCache.ctx.createImageData(width, height);
    imageCache.words = littleEndian ? new Uint32Array(imageCache.data.data.buffer) : null;
  }
  const rgba = imageCache.data.data;
  const words = imageCache.words;
  const rng = seededRandom(seed, 'image');
  // A seed-controlled bijection on 24-bit RGB: distinct colors for every pixel.
  const a = (Math.floor(rng() * 0x800000) * 2 + 1) >>> 0;
  const b = Math.floor(rng() * 0x1000000);
  const c = (Math.floor(rng() * 0x800000) * 2 + 1) >>> 0;
  for (let i = 0; i < width * height; i++) {
    let color = (Math.imul(i, a) + b) & 0xffffff;
    color ^= color >>> 13;
    color = Math.imul(color, c) & 0xffffff;
    color ^= color >>> 11;
    if (words) words[i] = 0xff000000 | ((color & 255) << 16) | (color & 0xff00) | (color >>> 16);
    else {
      const at = i * 4;
      rgba[at] = color >>> 16; rgba[at + 1] = (color >>> 8) & 255;
      rgba[at + 2] = color & 255; rgba[at + 3] = 255;
    }
  }
  imageCache.ctx.putImageData(imageCache.data, 0, 0);
  $('#image-meta').textContent = `${width} × ${height} px`;
  recordGeneration('image', seed);
}
let activeNote = null;
let highlightFrame = 0;
let lastProgressPaint = 0;
function clock(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
function updatePlaybackControls() {
  const player = $('#music-player');
  const state = states.music;
  const segment = state.batch?.segments[state.batch.activeIndex];
  const duration = segment?.duration ?? (Number.isFinite(player.duration) ? player.duration
    : state.piece ? pieceDuration(state.piece) : 0);
  const position = segment ? Math.max(0, Math.min(duration, player.currentTime - segment.start)) : player.currentTime;
  $('#music-play-toggle').textContent = player.paused ? `▶ ${t('playCurrent')}` : `Ⅱ ${t('pauseCurrent')}`;
  $('#music-seek').value = duration > 0 ? String(Math.round(position / duration * 1000)) : '0';
  $('#music-time').textContent = `${clock(position)} / ${clock(duration)}`;
}
function updateMediaMetadata() {
  const state = states.music;
  if (!state.piece || !state.seed || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const instrumentName = dictionaries[language][state.instrument] || state.instrument;
  // The two PNG sizes let the OS choose a suitable lock-screen artwork.
  try {
    navigator.mediaSession.metadata = new MediaMetadata(trackMetadata({
      measures: state.piece.bars.length,
      instrument: instrumentName,
      seed: state.seed,
      eggKind: state.eggKind,
      baseUrl: document.baseURI,
    }));
  } catch (error) {
    console.warn('Media Session metadata unavailable:', error);
  }
}
function clearPlaybackHighlight() {
  cancelAnimationFrame(highlightFrame);
  highlightFrame = 0;
  activeNote?.classList.remove('is-playing');
  activeNote = null;
}
function syncBackgroundSegment() {
  const state = states.music;
  const batch = state.batch;
  if (!batch) return false;
  const player = $('#music-player');
  const time = player.currentTime;
  const wrapped = !player.paused && batch.lastTime > batch.totalDuration - 1 && time < 1 && time < batch.lastTime - .5;
  batch.lastTime = time;
  if (wrapped && !document.hidden && !state.paused && musicChain) {
    generateMusic(randomSeed(), true); // replace a completed foreground cycle with fresh randomness
    return true;
  }
  const index = segmentAtTime(batch, time);
  if (index !== batch.activeIndex) {
    batch.activeIndex = index;
    const segment = batch.segments[index];
    state.piece = segment.piece;
    state.seed = segment.seed;
    updateRouteSeed('music', segment.seed);
    state.blob = segment.blob;
    $('#music-seed-input').value = segment.seed;
    $('#music-meta').textContent = `${segment.piece.bars.length} ${t('measures')}`;
    renderScore(segment.piece);
    updateMediaMetadata();
  }
  return false;
}
function updatePlaybackHighlight() {
  const player = $('#music-player');
  const state = states.music;
  if (document.hidden || player.paused || player.ended || !state.piece) return;
  if (syncBackgroundSegment()) return;
  const now = performance.now();
  if (now - lastProgressPaint >= 100) { updatePlaybackControls(); lastProgressPaint = now; }
  const timeline = state.noteTimeline || [];
  const segment = state.batch?.segments[state.batch.activeIndex];
  const tick = (player.currentTime - (segment?.start || 0)) * state.piece.bpm * TICKS_PER_BEAT / 60;
  let low = 0, high = timeline.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (timeline[middle].endTick <= tick) low = middle + 1;
    else high = middle;
  }
  const next = timeline[low]?.midi === null ? null : timeline[low]?.element || null;
  if (next !== activeNote) {
    activeNote?.classList.remove('is-playing');
    activeNote = next;
    activeNote?.classList.add('is-playing');
    if (activeNote) {
      const score = $('#music-score');
      const viewport = score.getBoundingClientRect();
      const note = activeNote.getBoundingClientRect();
      if (note.right > viewport.right - 18) score.scrollLeft += note.right - viewport.right + 32;
      if (note.left < viewport.left + 18) score.scrollLeft += note.left - viewport.left - 32;
      if (note.bottom > viewport.bottom - 15) score.scrollTop += note.bottom - viewport.bottom + 26;
      if (note.top < viewport.top + 15) score.scrollTop += note.top - viewport.top - 26;
    }
  }
  highlightFrame = requestAnimationFrame(updatePlaybackHighlight);
}
function updateScoreHeading(piece) {
  const heading = $('#music-score-heading');
  heading.textContent = `1=${piece.key.name}    ${piece.numerator}/${piece.denominator}    ♩=${piece.bpm}`;
  heading.hidden = false;
}
let flatBridgeObserver = null;
function renderFlatBridges(piece, rows, marks) {
  const flow = $('#music-score .score-flow');
  if (!flow || states.music.piece !== piece) return;
  flow.querySelectorAll('.jianpu-flat-bridge').forEach((bridge) => bridge.remove());
  const flowRect = flow.getBoundingClientRect();
  if (!flowRect.width || !flowRect.height) return;
  const fontSize = parseFloat(getComputedStyle(flow).fontSize);
  const unit = fontSize / 2; // jpfont-nds digits occupy half an em.
  const scaleX = flowRect.width / (flow.offsetWidth || flowRect.width);
  const scaleY = flowRect.height / (flow.offsetHeight || flowRect.height);
  const xOf = (x) => (x - flowRect.left) / scaleX;
  const yOf = (y) => (y - flowRect.top) / scaleY;
  function bridge(x1, x2, y, middle, barlineX = null) {
    if (x2 - x1 < 2) return;
    const outer = document.createElement('span');
    outer.className = 'jianpu-flat-bridge';
    outer.setAttribute('aria-hidden', 'true');
    outer.style.left = `${x1}px`;
    outer.style.top = `${y + fontSize * .23}px`;
    outer.style.width = `${x2 - x1}px`;
    const fragment = document.createDocumentFragment();
    const segments = jianpuFlatLineSegments(x2 - x1, unit, middle === 'I',
      barlineX === null ? null : barlineX - x1);
    for (const { offset, glyph } of segments) {
      const segment = document.createElement('span');
      segment.className = 'jianpu-flat-segment';
      segment.style.left = `${offset}px`;
      segment.textContent = ` ${glyph}`;
      fragment.append(segment);
    }
    outer.append(fragment);
    flow.append(outer);
  }
  for (const slur of piece.slurs || []) {
    if (scoreSlurPlan(piece, slur).kind === 'arc') continue;
    const first = rows[slur.startBar]?.notes[slur.start]?.getBoundingClientRect();
    const last = rows[slur.endBar]?.notes[slur.end]?.getBoundingClientRect();
    if (!first || !last) continue;
    const middle = marks.get(`${slur.startBar}:${slur.start}`) === 'U' ? 'I' : 'K';
    const left = xOf(first.left + first.width / 2) + unit * .24;
    const right = xOf(last.left + last.width / 2) - unit * .24;
    const firstY = yOf(first.top);
    const lastY = yOf(last.top);
    if (Math.abs(firstY - lastY) < fontSize / 2) {
      const barline = slur.startBar !== slur.endBar
        ? rows[slur.startBar].measure.querySelector('.score-barline')?.getBoundingClientRect() : null;
      bridge(left, right, firstY, middle,
        barline ? xOf(barline.left + barline.width / 2) : null);
    } else {
      // Measures wrap atomically. Continue the flat line at the two row edges.
      const firstEdge = xOf(rows[slur.startBar].measure.getBoundingClientRect().right);
      const lastEdge = xOf(rows[slur.endBar].measure.getBoundingClientRect().left);
      bridge(left, firstEdge - unit * .2, firstY, middle);
      bridge(lastEdge + unit * .2, right, lastY, middle);
    }
  }
}
function renderScore(piece) {
  clearPlaybackHighlight();
  const score = $('#music-score');
  score.scrollLeft = 0; score.scrollTop = 0;
  updateScoreHeading(piece);
  const flow = document.createElement('div'); flow.className = 'score-flow';
  const timeline = [];
  const slurMarks = scoreSlurMarks(piece);
  const rows = [];
  let elapsedTicks = 0;
  for (let b = 0; b < piece.bars.length; b++) {
    const measure = document.createElement('div'); measure.className = 'score-measure';
    const bar = piece.bars[b];
    const notesInMeasure = [];
    let at = 0;
    while (at < bar.length) {
      const first = bar[at];
      const group = document.createElement('span');
      group.className = first.tuplet ? 'jianpu-group is-tuplet' : 'jianpu-group';
      if (first.tuplet) {
        const label = document.createElement('span'); label.className = 'tuplet-label';
        label.textContent = `${first.tuplet}:${first.tupletBase}`;
        group.append(label);
      }
      const startIndex = at;
      const tile = [];
      do { tile.push(bar[at++]); } while (at < bar.length && bar[at].group === first.group);
      const run = document.createElement('span'); run.className = 'jianpu-run';
      tile.forEach((event, index) => {
        const previous = tile[index - 1];
        const noteIndex = at - tile.length + index;
        const compactSlur = piece.slurs?.some((slur) =>
          slur.startBar === b && slur.endBar === b &&
          slur.end === noteIndex && slur.start === noteIndex - 1 &&
          previous?.group === event.group);
        if (compactSlur) run.append(document.createTextNode(
          event.value === 'quarter' || previous.value === 'quarter' ? ' ' : 'l',
        ));
        if (index && !compactSlur && (event.value === 'quarter' || previous.value === 'quarter')) {
          run.append(document.createTextNode(' '));
        }
        const note = document.createElement('span'); note.className = 'jianpu-note';
        const token = jianpuToken(event, piece.key.semitones);
        const restExtension = event.midi === null && /^0{2,}$/.test(token);
        const count = restExtension ? token.length - 1 : token.match(/-+$/)?.[0].length || 0;
        note.append(document.createTextNode(count ? token.slice(0, -count) : token));
        for (let extensionIndex = 0; extensionIndex < count; extensionIndex++) {
          const extension = document.createElement('span');
          extension.className = 'jianpu-extension';
          extension.textContent = restExtension ? '0' : '-';
          note.append(extension);
        }
        const marks = slurMarks.get(`${b}:${noteIndex}`);
        if (marks) {
          const glyph = document.createElement('span');
          glyph.className = 'jianpu-slur';
          glyph.setAttribute('aria-hidden', 'true');
          glyph.textContent = marks;
          note.append(glyph);
        }
        run.append(note);
        notesInMeasure.push(note);
        elapsedTicks += event.ticks;
        timeline.push({ endTick: elapsedTicks, midi: event.midi, element: note });
      });
      group.append(run);
      if (first.tuplet) {
        // Z/C are the font's native square-ended connecting line. Clip their
        // long strokes to this rhythmic group rather than drawing a CSS border.
        const bracket = document.createElement('span');
        bracket.className = 'jianpu-tuplet-bracket';
        bracket.setAttribute('aria-hidden', 'true');
        for (const [side, glyph] of [['left', 'Z'], ['right', 'C']]) {
          const end = document.createElement('span');
          end.className = `bracket-${side}`;
          end.textContent = glyph;
          bracket.append(end);
        }
        group.append(bracket);
      }
      if (startIndex > 0) {
        // Use the font's exact quarter-space instead of a fractional CSS gap.
        const spacer = document.createElement('span');
        spacer.className = 'jianpu-group-space';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.textContent = 'l';
        measure.append(spacer);
      }
      measure.append(group);
    }
    const final = b === piece.bars.length - 1;
    const barline = document.createElement('span'); barline.className = 'score-barline';
    barline.textContent = final ? '+' : '|';
    barline.setAttribute('aria-label', final ? 'Final double barline' : 'Barline');
    measure.append(barline);
    flow.append(measure);
    rows.push({ measure, notes: notesInMeasure });
  }
  flatBridgeObserver?.disconnect();
  score.replaceChildren(flow);
  states.music.noteTimeline = timeline;
  const place = () => {
    if (states.music.piece !== piece) return;
    renderFlatBridges(piece, rows, slurMarks);
    if (typeof ResizeObserver !== 'undefined') {
      flatBridgeObserver = new ResizeObserver(() => renderFlatBridges(piece, rows, slurMarks));
      flatBridgeObserver.observe(flow);
    }
  };
  if (document.fonts) document.fonts.load('27px "Nuduseng Jianpu"').then(place).catch(place);
  else requestAnimationFrame(place);
}
function generateMusic(seed = randomSeed(), autoplay = false) {
  const player = $('#music-player');
  player.pause();
  const piece = seed === EASTER_SEED ? composeCelebration()
    : isDarkSeed(seed, language) ? composeDark()
      : compose(Number($('#music-bars').value), seededRandom(seed, 'music'));
  const instrument = $('#music-instrument').value;
  // iOS may suspend page JavaScript in the background. A native music element
  // can keep looping a bounded, pre-rendered WAV without an `ended` callback.
  const continuousIOS = IOS_MUSIC && autoplay && !states.music.easterEgg;
  const batch = continuousIOS && pieceDuration(piece) < 180
    ? buildBackgroundBatch(piece, seed, Number($('#music-bars').value), instrument) : null;
  const blob = batch ? batch.segments[0].blob : synthesizeWav(piece, instrument);
  if (musicUrl) URL.revokeObjectURL(musicUrl);
  musicUrl = URL.createObjectURL(batch?.blob || blob);
  player.loop = continuousIOS;
  player.src = musicUrl;
  states.music.batch = batch;
  states.music.piece = piece;
  states.music.blob = blob;
  states.music.instrument = instrument;
  $('#music-meta').textContent = `${piece.bars.length} ${t('measures')}`;
  renderScore(piece);
  recordGeneration('music', seed);
  if (batch && batch.segments.length > 1) {
    states.music.count += batch.segments.length - 1;
    paintCount('music'); persistCount('music');
  }
  updateMediaMetadata();
  updatePlaybackControls();
  if (autoplay) player.play().catch(() => { musicChain = false; updatePlaybackControls(); });
}
function clampInput(element) {
  const min = Number(element.min), max = Number(element.max);
  const value = Number(element.value);
  element.value = String(Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min);
}
function bindRange(type, rangeId, numberId, callback) {
  const range = $(`#${rangeId}`), number = $(`#${numberId}`);
  range.addEventListener('input', () => { number.value = range.value; callback(); });
  number.addEventListener('input', () => {
    const value = Number(number.value);
    if (Number.isInteger(value) && value >= Number(number.min) && value <= Number(number.max)) range.value = number.value;
  });
  number.addEventListener('change', () => { clampInput(number); range.value = number.value; callback(); });
}
function download(blob, type, extension, seed) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFilename(type, seed, extension);
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function selectTab(type, navigate = false, fromUrl = false) {
  if (!Object.hasOwn(TAB_PATHS, type)) return;
  if (navigate) {
    const next = tabUrl(type, appBase, states[type].generated ? states[type].seed : null);
    if (location.pathname + location.search !== next) history.pushState(null, '', next);
  }
  if (activeType === 'text') { clearTimeout(pausedLengthTimer); pausedLengthTimer = 0; }
  if (activeType !== 'music') { paintCount(activeType); persistCount(activeType); }
  activeType = type;
  clearInterval(states.text.timer);
  clearInterval(states.image.timer);
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === type;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(`#panel-${tab.dataset.tab}`).hidden = !active;
  });
  if (fromUrl) {
    const params = new URLSearchParams(location.search);
    if (params.has('seed')) {
      recreateSeed(type, params.get('seed'));
      return;
    }
  }
  if ((type === 'text' || type === 'image') && !states[type].paused && !document.hidden) {
    const callback = type === 'text' ? generateText : generateImage;
    callback(); schedule(type, callback);
  }
}

$('#current-year').textContent = new Date().getFullYear();
themeManager.init();
$('#theme-toggle').addEventListener('click', () => themeManager.toggle());
$('#language-select').value = language;
$('#language-select').addEventListener('change', (event) => { language = event.target.value; translate(); });
$('#tabs').addEventListener('click', (event) => { const tab = event.target.closest('.tab'); if (tab) selectTab(tab.dataset.tab, true); });
$('#tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('.tab')];
  const current = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next].focus(); selectTab(tabs[next].dataset.tab, true);
});
function recreateSeed(type, seed) {
  const input = $(`#${type}-seed-input`);
  input.value = seed;
  if (!validateSeedField(type)) { stopGeneration(type); return; }
  stopGeneration(type);
  if (type === 'music') musicChain = false;
  const eggKind = seed === EASTER_SEED ? 'friendly' : isDarkSeed(seed, language) ? 'dark' : null;
  if (states[type].easterEgg) setEasterState(type, false);
  if (eggKind) {
    setEasterState(type, true, eggKind);
    const renderers = eggKind === 'dark'
      ? { text: renderDarkText, image: renderDarkImage, music: generateMusic }
      : { text: renderEasterText, image: renderEasterImage, music: generateMusic };
    renderers[type](seed);
    if (eggKind === 'dark') {
      try { localStorage.setItem('666', 'true'); } catch { /* storage unavailable */ }
    }
  } else {
    ({ text: generateText, image: generateImage, music: generateMusic })[type](seed);
  }
}
for (const type of Object.keys(states)) {
  const input = $(`#${type}-seed-input`);
  input.addEventListener('focus', () => { if (type !== 'music' || states.music.generated) stopGeneration(type); });
  input.addEventListener('input', () => {
    if (type !== 'music' || states.music.generated) stopGeneration(type);
    validateSeedField(type, false);
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') $(`#${type}-apply-seed`).click(); });
  $(`#${type}-apply-seed`).addEventListener('click', () => recreateSeed(type, input.value));
  $(`#${type}-copy-seed`).addEventListener('click', () => {
    if (states[type].seed) navigator.clipboard?.writeText(states[type].seed).catch(() => {});
  });
  $(`#${type}-pause`).addEventListener('click', () => {
    const state = states[type];
    if (state.easterEgg) {
      // Resuming is an explicit exit from the preset; restore user settings.
      setEasterState(type, false);
      state.paused = false;
      updateControls(type);
      if (type === 'music') {
        musicChain = true;
        generateMusic(randomSeed(), true);
      } else {
        const callback = type === 'text' ? generateText : generateImage;
        callback();
        schedule(type, callback);
      }
      return;
    }
    if (state.paused && !validateSeedField(type, false)) return;
    state.paused = !state.paused;
    updateControls(type);
    if (state.paused) {
      if (type === 'music' && IOS_MUSIC) $('#music-player').loop = false;
      if (type === 'text') { clearTimeout(pausedLengthTimer); pausedLengthTimer = 0; }
      clearInterval(state.timer); paintCount(type); persistCount(type);
    }
    else if (type === 'music') {
      const player = $('#music-player');
      if (IOS_MUSIC) player.loop = musicChain;
      if (musicChain && player.ended) generateMusic(randomSeed(), true);
    } else {
      const callback = type === 'text' ? generateText : generateImage;
      callback(); schedule(type, callback);
    }
  });
}
const textLengthRange = $('#text-length');
const textLengthNumber = $('#text-length-number');
function queuePausedLengthUpdate() {
  if (states.text.easterEgg) return;
  // While paused there is no 100 ms generation tick. Sample the latest slider
  // value at most once per 100 ms instead of rendering on every input event.
  if (pausedLengthTimer) return;
  pausedLengthTimer = setTimeout(() => {
    pausedLengthTimer = 0;
    if (activeType !== 'text' || document.hidden) return;
    const seedInput = $('#text-seed-input');
    if (seedInput.value !== states.text.seed || !validateSeedField('text', false)) return;
    generateText(states.text.seed);
  }, 100);
}
textLengthRange.addEventListener('input', () => {
  if (states.text.paused) queuePausedLengthUpdate();
  // When running, the existing 100 ms generator tick samples the slider.
});
textLengthRange.addEventListener('change', () => {
  if (states.text.paused) queuePausedLengthUpdate();
});
textLengthNumber.addEventListener('change', () => {
  clampInput(textLengthNumber);
  textLengthRange.value = textLengthNumber.value;
  if (states.text.paused) queuePausedLengthUpdate();
});
bindRange('music', 'music-bars', 'music-bars-number', () => {
  if (!states.music.easterEgg && states.music.generated && $('#music-player').paused &&
      $('#music-seed-input').value === states.music.seed && validateSeedField('music', false)) generateMusic(states.music.seed);
});
$('#music-instrument').addEventListener('change', () => {
  const state = states.music;
  if (!state.piece) return;
  const player = $('#music-player');
  const wasPlaying = !player.paused;
  const position = player.currentTime;
  player.pause();
  const instrument = $('#music-instrument').value;
  const batch = state.batch ? retimbreBackgroundBatch(state.batch, instrument) : null;
  const blob = batch ? batch.segments[batch.activeIndex].blob : synthesizeWav(state.piece, instrument);
  if (batch) batch.lastTime = position;
  const oldUrl = musicUrl;
  musicUrl = URL.createObjectURL(batch?.blob || blob);
  state.batch = batch;
  state.blob = blob;
  state.instrument = instrument;
  updateMediaMetadata();
  player.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(player.duration) && position > 0) {
      player.currentTime = Math.min(position, Math.max(0, player.duration - .01));
    }
    updatePlaybackControls();
    if (wasPlaying) player.play().catch(updatePlaybackControls);
  }, { once: true });
  player.src = musicUrl;
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  updatePlaybackControls();
});
for (const id of ['image-width', 'image-height']) {
  $(`#${id}`).addEventListener('change', () => {
    clampInput($(`#${id}`));
    if (!states.image.easterEgg && $('#image-seed-input').value === states.image.seed && validateSeedField('image', false)) {
      generateImage(states.image.paused ? states.image.seed : randomSeed());
    }
  });
}
const player = $('#music-player');
player.addEventListener('play', () => {
  if (!states.music.paused) musicChain = true;
  updateMediaMetadata();
  cancelAnimationFrame(highlightFrame);
  updatePlaybackControls();
  if (!document.hidden) updatePlaybackHighlight();
});
player.addEventListener('pause', () => { clearPlaybackHighlight(); updatePlaybackControls(); });
player.addEventListener('seeked', () => {
  if (states.music.batch && !document.hidden) syncBackgroundSegment();
  if (!player.paused && !document.hidden) { cancelAnimationFrame(highlightFrame); updatePlaybackHighlight(); }
});
player.addEventListener('timeupdate', () => {
  if (states.music.batch && !document.hidden && !syncBackgroundSegment()) updatePlaybackControls();
});
player.addEventListener('ended', () => {
  clearPlaybackHighlight();
  updatePlaybackControls();
  if (!states.music.paused && musicChain) generateMusic(randomSeed(), true);
});
player.addEventListener('loadedmetadata', updatePlaybackControls);
$('#music-play-toggle').addEventListener('click', () => {
  if (!states.music.generated) return;
  if (player.paused) player.play().catch(updatePlaybackControls);
  else player.pause();
});
$('#music-seek').addEventListener('change', (event) => {
  const segment = states.music.batch?.segments[states.music.batch.activeIndex];
  const duration = segment?.duration ?? player.duration;
  if (Number.isFinite(duration)) player.currentTime = (segment?.start || 0) + duration * Number(event.target.value) / 1000;
  updatePlaybackControls();
});
$('#music-generate').addEventListener('click', () => {
  if (states.music.easterEgg || !validateSeedField('music', false)) return;
  states.music.paused = false;
  musicChain = true;
  generateMusic(randomSeed(), true);
});
$('#text-export').addEventListener('click', () => download(new Blob([states.text.value || ''], { type: 'text/plain;charset=utf-8' }), 'text', 'txt', states.text.seed));
$('#image-export').addEventListener('click', () => $('#image-canvas').toBlob((blob) => { if (blob) download(blob, 'image', 'png', states.image.seed); }, 'image/png'));
$('#music-export').addEventListener('click', () => { if (states.music.blob) download(states.music.blob, 'music', 'wav', states.music.seed); });
function restoreMusicUI() {
  // The native media clock, not a background timer or wall-clock estimate, is
  // authoritative after iOS has suspended page scripts. Never pause the media.
  cancelAnimationFrame(highlightFrame);
  highlightFrame = 0;
  if (states.music.batch && syncBackgroundSegment()) return; // a fresh batch starts its own loop
  updatePlaybackControls();
  if (!player.paused) updatePlaybackHighlight();
  else clearPlaybackHighlight();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(pausedLengthTimer); pausedLengthTimer = 0;
    clearPlaybackHighlight();
  }
  clearInterval(states.text.timer); clearInterval(states.image.timer);
  if (document.hidden && activeType !== 'music') { paintCount(activeType); persistCount(activeType); }
  if (!document.hidden) {
    restoreMusicUI();
    if (activeType !== 'music' && !states[activeType].paused) {
      const callback = activeType === 'text' ? generateText : generateImage;
      callback(); schedule(activeType, callback);
    }
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && !document.hidden) restoreMusicUI();
});
window.addEventListener('pagehide', () => { for (const type of Object.keys(states)) persistCount(type); });
// The site remains inert until an explicit adult confirmation. A refusal is
// intentionally not persisted, so the question reappears on the next visit.
function enterSite() {
  $('#age-gate').hidden = true;
  $('#app').removeAttribute('inert');
  document.body.classList.remove('age-locked');
  selectTab(routeType(location.pathname, appBase.pathname), false, true);
}
window.addEventListener('popstate', () => {
  if (!$('#app').hasAttribute('inert')) selectTab(routeType(location.pathname, appBase.pathname), false, true);
});
$('#age-yes').addEventListener('click', () => {
  try { localStorage.setItem('murphy_age_confirmed', 'true'); } catch { /* ask again next visit */ }
  enterSite();
});
$('#age-no').addEventListener('click', () => {
  $('#age-actions').hidden = true;
  $('#age-denied').hidden = false;
  $('#age-denied').focus();
});
translate();
let previouslyConfirmed = false;
try { previouslyConfirmed = localStorage.getItem('murphy_age_confirmed') === 'true'; } catch { /* storage unavailable */ }
if (previouslyConfirmed) enterSite();






