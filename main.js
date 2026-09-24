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
import { compose, composeCelebration, composeDark, synthesizeWav, TICKS_PER_BEAT } from './audio.js';
import { randomSeed, seededRandom, VALID_SEED, EASTER_SEED, isDarkSeed } from './seed.js';
import { EASTER_TEXT, EASTER_BITMAP, DARK_CROSS_TEXT, DARK_CROSS_BITMAP, DARK_RED } from './easter.js';
import { jianpuToken } from './notation.js';
import { displayLineBreaks } from './text-format.js';
import { trackMetadata } from './media-info.js';
import { buildBackgroundBatch, retimbreBackgroundBatch, segmentAtTime, pieceDuration, isIOSBrowser } from './background-audio.js';

const $ = (selector) => document.querySelector(selector);
const dictionaries = {
  en: {
    language: 'Language', eyebrow: 'Murphy\'s Law', heading: 'Anything that can go wrong will eventually go wrong.',
    intro: 'Random your wrong.',
    darkEyebrow: "No, it wasn't me. I don't know.", darkHeading: 'Why are you here?',
    darkIntro: 'I remember you.',
    textTab: 'Text', imageTab: 'Image', audioTab: 'Audio', textEyebrow: '01', textTitle: 'Text',
    textDescription: 'Generate random Unicode characters.\nChoose a length from 20 to 4096.\nThey say the monkey at the typewriter eventually just peed on it.', length: 'Text length', lengthHint: '20–4096 characters', darkLengthHint: '1 character · fixed preset',
    livePreview: 'LIVE PREVIEW', imageEyebrow: '02', imageTitle: 'Image',
    imageDescription: 'Fill every pixel with a random color.\nYou might get a landscape, a classic masterpiece, your cat, or even the face of the person in front of the screen.\nMost of the time it just looks like meaningless colored pixels......or does it?', width: 'Width', widthHint: '16–1920 px',
    height: 'Height', heightHint: '8–1080 px', audioEyebrow: '03', audioTitle: 'Audio',
    audioDescription: 'Random pitches, beats, BPM, and content.\nIt has the air of a modern-day Beethoven.\nOh, that damned score—even Liszt would be helpless.', bars: 'Measures', barsHint: '4–32 measures', darkBarsHint: '1 measure · fixed preset',
    timeSignature: 'TIME SIGNATURE', tempo: 'TEMPO', instrument: 'INSTRUMENT', piano: 'Piano', scorePreview: 'GENERATED CONTENT',
    pause: 'Pause generation', resume: 'Resume generation', live: 'Generating', paused: 'Paused',
    exportTxt: 'Export .txt', exportPng: 'Export .png', exportWav: 'Export .wav',
    privacyNote: 'All content is generated locally.', sourceCode: 'Source code', agreement: 'User agreement', privacy: 'Privacy policy',
    characters: 'characters', measures: 'measures', beat: 'BPM', theme: 'Toggle theme',
    generated: 'generated',
    seed: 'Seed', seedHint: 'A fixed value corresponding to each generated result', applySeed: 'Recreate', copySeed: 'Copy',
    notGenerated: 'Not generated', generateAudio: 'Generate & play', generateNext: 'Generate next & play',
    emptyScore: 'Generate audio to see its notation.', seedPlaceholder: 'Enter a seed',
    electric: 'Electric piano', musicBox: 'Music box', pluck: 'Plucked strings', marimba: 'Marimba', organ: 'Organ',
    playCurrent: 'Play current', pauseCurrent: 'Pause', seek: 'Seek audio',
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
    textTab: '文本', imageTab: '图片', audioTab: '音频', textEyebrow: '01', textTitle: '文本',
    textDescription: '随机生成 Unicode 字符。\n可自定义长度在 20 至 4096 范围内。\n听说摆弄打字机的那只猴子，最终只是在打字机上尿了一泡。', length: '文本长度', lengthHint: '20–4096 个字符', darkLengthHint: '固定 1 个字符',
    livePreview: '实时预览', imageEyebrow: '02', imageTitle: '图片',
    imageDescription: '以随机的颜色填充每一个像素。\n可能会生成风景画、经典名作、你家的猫猫，甚至屏幕前那个人的脸。\n不过大多数时候看起来都是毫无意义的彩点......是吗？', width: '宽度', widthHint: '16–1920 像素',
    height: '高度', heightHint: '8–1080 像素', audioEyebrow: '03', audioTitle: '音频',
    audioDescription: '随机音调、节拍、BPM、内容。\n颇有当代贝多芬的风范。\n哦这该死的谱子，李斯特看了也无能为力。', bars: '小节数', barsHint: '4–32 小节', darkBarsHint: '固定 1 小节',
    timeSignature: '拍号', tempo: '速度', instrument: '音色', piano: '钢琴', scorePreview: '生成内容',
    pause: '暂停生成', resume: '继续生成', live: '生成中', paused: '已暂停',
    exportTxt: '导出 .txt', exportPng: '导出 .png', exportWav: '导出 .wav',
    privacyNote: '所有内容均在本地生成。', sourceCode: '开源地址', agreement: '用户协议', privacy: '隐私政策',
    characters: '字符', measures: '小节', beat: 'BPM', theme: '切换主题',
    generated: '已生成',
    seed: '种子', seedHint: '每个随机内容对应的固定值', applySeed: '复现', copySeed: '复制',
    notGenerated: '未生成', generateAudio: '生成并播放', generateNext: '生成下一段并播放',
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
const states = Object.fromEntries(['text', 'image', 'audio'].map((type) => {
  let count = 0;
  try { count = Math.max(0, Number(localStorage.getItem(`murphy_count_${type}`)) || 0); } catch { /* storage unavailable */ }
  return [type, { paused: false, count, seed: '', generated: false, easterEgg: false, eggKind: null, savedSetting: null }];
}));
let audioUrl = null;
let audioChain = false;
const IOS_AUDIO = isIOSBrowser(navigator);
const intervals = { text: 100, image: 100 };
let pausedLengthTimer = 0;
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
  $('#audio-bars-number').setAttribute('aria-label', t('bars'));
  $('#language-select').setAttribute('aria-label', t('language'));
  $('#audio-instrument').setAttribute('aria-label', t('instrument'));
  $('#audio-seek').setAttribute('aria-label', t('seek'));
  for (const type of Object.keys(states)) {
    $(`#${type}-count`).textContent = `${t('generated')}: ${states[type].count.toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}`;
    $(`#${type}-seed-input`).setAttribute('aria-label', `${t('seed')} · ${t('seedHint')}`);
    $(`#${type}-seed-input`).placeholder = t('seedPlaceholder');
    updateControls(type);
  }
  $('#text-meta').textContent = `${$('#text-length').value} ${t('characters')}`;
  if (states.text.eggKind === 'dark') $('#text-length-hint').textContent = t('darkLengthHint');
  if (states.audio.eggKind === 'dark') $('#audio-bars-hint').textContent = t('darkBarsHint');
  if (states.audio.piece) {
    $('#audio-meta').textContent = `${states.audio.piece.bars.length} ${t('measures')}`;
    updateScoreHeading(states.audio.piece);
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
  if (type === 'audio') $('#audio-generate').disabled = state.easterEgg;
  if (type === 'audio' && !state.generated) {
    status.textContent = t('notGenerated');
    status.classList.add('is-paused');
    $('#audio-pause').disabled = true;
    $('#audio-pause').textContent = `Ⅱ ${t('pause')}`;
    $('#audio-export').disabled = true;
    $('#audio-playback').hidden = true;
    $('#audio-generate').textContent = t('generateAudio');
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
    if (type === 'audio') {
      $('#audio-export').disabled = false;
      $('#audio-playback').hidden = false;
      $('#audio-generate').textContent = t('generateNext');
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
function recordGeneration(type, seed) {
  const state = states[type];
  const first = !state.generated;
  state.seed = seed;
  state.generated = true;
  state.count++;
  if (type === 'audio' || state.count % 10 === 0) persistCount(type);
  $(`#${type}-seed-input`).value = seed;
  if (!$(`#${type}-seed-error`).hidden) showSeedError(type);
  if (type === 'audio' || first || performance.now() - (state.lastCountPaint || 0) >= 400) paintCount(type);
  if (first || type === 'audio') updateControls(type);
}
function schedule(type, callback) {
  clearInterval(states[type].timer);
  if (!states[type].paused && !states[type].easterEgg && activeType === type && !document.hidden) {
    states[type].timer = setInterval(callback, intervals[type]);
  }
}
function stopGeneration(type) {
  if (type === 'audio' && IOS_AUDIO) $('#audio-player').loop = false;
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
      state.savedSetting = $('#audio-bars').value;
      const bars = kind === 'dark' ? '1' : '4';
      $('#audio-bars').min = bars;
      $('#audio-bars-number').min = bars;
      $('#audio-bars-hint').textContent = kind === 'dark' ? t('darkBarsHint') : t('barsHint');
      $('#audio-bars').value = bars;
      $('#audio-bars-number').value = bars;
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
      $('#audio-bars').min = '4';
      $('#audio-bars-number').min = '4';
      $('#audio-bars-hint').textContent = t('barsHint');
      $('#audio-bars').value = state.savedSetting;
      $('#audio-bars-number').value = state.savedSetting;
    }
    state.savedSetting = null;
  }
  state.easterEgg = active;
  state.eggKind = active ? kind : null;
  updateHero();
  const controls = {
    text: ['text-length', 'text-length-number'],
    image: ['image-width', 'image-height'],
    audio: ['audio-bars', 'audio-bars-number'],
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
  const player = $('#audio-player');
  const state = states.audio;
  const segment = state.batch?.segments[state.batch.activeIndex];
  const duration = segment?.duration ?? (Number.isFinite(player.duration) ? player.duration
    : state.piece ? pieceDuration(state.piece) : 0);
  const position = segment ? Math.max(0, Math.min(duration, player.currentTime - segment.start)) : player.currentTime;
  $('#audio-play-toggle').textContent = player.paused ? `▶ ${t('playCurrent')}` : `Ⅱ ${t('pauseCurrent')}`;
  $('#audio-seek').value = duration > 0 ? String(Math.round(position / duration * 1000)) : '0';
  $('#audio-time').textContent = `${clock(position)} / ${clock(duration)}`;
}
function updateMediaMetadata() {
  const state = states.audio;
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
  const state = states.audio;
  const batch = state.batch;
  if (!batch) return false;
  const player = $('#audio-player');
  const time = player.currentTime;
  const wrapped = !player.paused && batch.lastTime > batch.totalDuration - 1 && time < 1 && time < batch.lastTime - .5;
  batch.lastTime = time;
  if (wrapped && !document.hidden && !state.paused && audioChain) {
    generateAudio(randomSeed(), true); // replace a completed foreground cycle with fresh randomness
    return true;
  }
  const index = segmentAtTime(batch, time);
  if (index !== batch.activeIndex) {
    batch.activeIndex = index;
    const segment = batch.segments[index];
    state.piece = segment.piece;
    state.seed = segment.seed;
    state.blob = segment.blob;
    $('#audio-seed-input').value = segment.seed;
    $('#audio-meta').textContent = `${segment.piece.bars.length} ${t('measures')}`;
    renderScore(segment.piece);
    updateMediaMetadata();
  }
  return false;
}
function updatePlaybackHighlight() {
  const player = $('#audio-player');
  const state = states.audio;
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
      const score = $('#audio-score');
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
  const heading = $('#audio-score-heading');
  heading.textContent = `1=${piece.key.name}    ${piece.numerator}/${piece.denominator}    ♩=${piece.bpm}`;
  heading.hidden = false;
}
function drawSlurArcs(piece, rows) {
  for (const { measure } of rows) measure.querySelector('.score-slur-layer')?.remove();
  for (const slur of piece.slurs || []) {
    const row = rows[slur.bar];
    if (!row) continue;
    const first = row.notes[slur.start]?.getBoundingClientRect();
    const last = row.notes[slur.end]?.getBoundingClientRect();
    if (!first || !last) continue;
    const measure = row.measure;
    const rect = measure.getBoundingClientRect();
    const x1 = first.left + first.width / 2 - rect.left;
    const x2 = last.left + last.width / 2 - rect.left;
    const arch = Math.max(9, Math.min(20, (x2 - x1) * 0.13));
    const base = Math.max(arch + 3, Math.min(first.top, last.top) - rect.top - 10);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('score-slur-layer');
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${base} C ${x1 + (x2 - x1) * .23} ${base - arch}, ${x2 - (x2 - x1) * .23} ${base - arch}, ${x2} ${base}`);
    path.classList.add('score-slur-path');
    svg.append(path);
    measure.append(svg);
  }
}
function renderScore(piece) {
  clearPlaybackHighlight();
  const score = $('#audio-score');
  score.scrollLeft = 0; score.scrollTop = 0;
  updateScoreHeading(piece);
  const flow = document.createElement('div'); flow.className = 'score-flow';
  const timeline = [];
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
      const tile = [];
      do { tile.push(bar[at++]); } while (at < bar.length && bar[at].group === first.group);
      const run = document.createElement('span'); run.className = 'jianpu-run';
      tile.forEach((event, index) => {
        const previous = tile[index - 1];
        if (index && (event.value === 'quarter' || previous.value === 'quarter')) {
          run.append(document.createTextNode(' '));
        }
        const note = document.createElement('span'); note.className = 'jianpu-note';
        note.textContent = jianpuToken(event, piece.key.semitones);
        run.append(note);
        notesInMeasure.push(note);
        elapsedTicks += event.ticks;
        timeline.push({ endTick: elapsedTicks, midi: event.midi, element: note });
      });
      group.append(run);
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
  score.replaceChildren(flow);
  states.audio.noteTimeline = timeline;
  states.audio.scoreRows = rows;
  requestAnimationFrame(() => { if (states.audio.piece === piece) drawSlurArcs(piece, rows); });
  document.fonts?.load('27px "Nuduseng Jianpu"').then(() => {
    if (states.audio.piece === piece) drawSlurArcs(piece, rows);
  }).catch(() => {});
}
function generateAudio(seed = randomSeed(), autoplay = false) {
  const player = $('#audio-player');
  player.pause();
  const piece = seed === EASTER_SEED ? composeCelebration()
    : isDarkSeed(seed, language) ? composeDark()
      : compose(Number($('#audio-bars').value), seededRandom(seed, 'audio'));
  const instrument = $('#audio-instrument').value;
  // iOS may suspend page JavaScript in the background. A native audio element
  // can keep looping a bounded, pre-rendered WAV without an `ended` callback.
  const continuousIOS = IOS_AUDIO && autoplay && !states.audio.easterEgg;
  const batch = continuousIOS && pieceDuration(piece) < 180
    ? buildBackgroundBatch(piece, seed, Number($('#audio-bars').value), instrument) : null;
  const blob = batch ? batch.segments[0].blob : synthesizeWav(piece, instrument);
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(batch?.blob || blob);
  player.loop = continuousIOS;
  player.src = audioUrl;
  states.audio.batch = batch;
  states.audio.piece = piece;
  states.audio.blob = blob;
  states.audio.instrument = instrument;
  $('#audio-meta').textContent = `${piece.bars.length} ${t('measures')}`;
  renderScore(piece);
  recordGeneration('audio', seed);
  if (batch && batch.segments.length > 1) {
    states.audio.count += batch.segments.length - 1;
    paintCount('audio'); persistCount('audio');
  }
  updateMediaMetadata();
  updatePlaybackControls();
  if (autoplay) player.play().catch(() => { audioChain = false; updatePlaybackControls(); });
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
function download(blob, extension, seed) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Murphy-${extension}-${seed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}.${extension}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function selectTab(type) {
  if (activeType === 'text') { clearTimeout(pausedLengthTimer); pausedLengthTimer = 0; }
  if (activeType !== 'audio') { paintCount(activeType); persistCount(activeType); }
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
$('#tabs').addEventListener('click', (event) => { const tab = event.target.closest('.tab'); if (tab) selectTab(tab.dataset.tab); });
$('#tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('.tab')];
  const current = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next].focus(); selectTab(tabs[next].dataset.tab);
});
for (const type of Object.keys(states)) {
  const input = $(`#${type}-seed-input`);
  input.addEventListener('focus', () => { if (type !== 'audio' || states.audio.generated) stopGeneration(type); });
  input.addEventListener('input', () => {
    if (type !== 'audio' || states.audio.generated) stopGeneration(type);
    validateSeedField(type, false);
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') $(`#${type}-apply-seed`).click(); });
  $(`#${type}-apply-seed`).addEventListener('click', () => {
    if (!validateSeedField(type)) return;
    const seed = input.value;
    stopGeneration(type);
    if (type === 'audio') audioChain = false;
    const eggKind = seed === EASTER_SEED ? 'friendly' : isDarkSeed(seed, language) ? 'dark' : null;
    if (states[type].easterEgg) setEasterState(type, false);
    if (eggKind) {
      setEasterState(type, true, eggKind);
      const renderers = eggKind === 'dark'
        ? { text: renderDarkText, image: renderDarkImage, audio: generateAudio }
        : { text: renderEasterText, image: renderEasterImage, audio: generateAudio };
      renderers[type](seed);
      if (eggKind === 'dark') {
        try { localStorage.setItem('666', 'true'); } catch { /* storage unavailable */ }
      }
    } else {
      ({ text: generateText, image: generateImage, audio: generateAudio })[type](seed);
    }
  });
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
      if (type === 'audio') {
        audioChain = true;
        generateAudio(randomSeed(), true);
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
      if (type === 'audio' && IOS_AUDIO) $('#audio-player').loop = false;
      if (type === 'text') { clearTimeout(pausedLengthTimer); pausedLengthTimer = 0; }
      clearInterval(state.timer); paintCount(type); persistCount(type);
    }
    else if (type === 'audio') {
      const player = $('#audio-player');
      if (IOS_AUDIO) player.loop = audioChain;
      if (audioChain && player.ended) generateAudio(randomSeed(), true);
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
bindRange('audio', 'audio-bars', 'audio-bars-number', () => {
  if (!states.audio.easterEgg && states.audio.generated && $('#audio-player').paused &&
      $('#audio-seed-input').value === states.audio.seed && validateSeedField('audio', false)) generateAudio(states.audio.seed);
});
$('#audio-instrument').addEventListener('change', () => {
  const state = states.audio;
  if (!state.piece) return;
  const player = $('#audio-player');
  const wasPlaying = !player.paused;
  const position = player.currentTime;
  player.pause();
  const instrument = $('#audio-instrument').value;
  const batch = state.batch ? retimbreBackgroundBatch(state.batch, instrument) : null;
  const blob = batch ? batch.segments[batch.activeIndex].blob : synthesizeWav(state.piece, instrument);
  if (batch) batch.lastTime = position;
  const oldUrl = audioUrl;
  audioUrl = URL.createObjectURL(batch?.blob || blob);
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
  player.src = audioUrl;
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
const player = $('#audio-player');
player.addEventListener('play', () => {
  if (!states.audio.paused) audioChain = true;
  updateMediaMetadata();
  cancelAnimationFrame(highlightFrame);
  updatePlaybackControls();
  if (!document.hidden) updatePlaybackHighlight();
});
player.addEventListener('pause', () => { clearPlaybackHighlight(); updatePlaybackControls(); });
player.addEventListener('seeked', () => {
  if (states.audio.batch && !document.hidden) syncBackgroundSegment();
  if (!player.paused && !document.hidden) { cancelAnimationFrame(highlightFrame); updatePlaybackHighlight(); }
});
player.addEventListener('timeupdate', () => {
  if (states.audio.batch && !document.hidden && !syncBackgroundSegment()) updatePlaybackControls();
});
player.addEventListener('ended', () => {
  clearPlaybackHighlight();
  updatePlaybackControls();
  if (!states.audio.paused && audioChain) generateAudio(randomSeed(), true);
});
player.addEventListener('loadedmetadata', updatePlaybackControls);
$('#audio-play-toggle').addEventListener('click', () => {
  if (!states.audio.generated) return;
  if (player.paused) player.play().catch(updatePlaybackControls);
  else player.pause();
});
$('#audio-seek').addEventListener('change', (event) => {
  const segment = states.audio.batch?.segments[states.audio.batch.activeIndex];
  const duration = segment?.duration ?? player.duration;
  if (Number.isFinite(duration)) player.currentTime = (segment?.start || 0) + duration * Number(event.target.value) / 1000;
  updatePlaybackControls();
});
$('#audio-generate').addEventListener('click', () => {
  if (states.audio.easterEgg || !validateSeedField('audio', false)) return;
  states.audio.paused = false;
  audioChain = true;
  generateAudio(randomSeed(), true);
});
$('#text-export').addEventListener('click', () => download(new Blob([states.text.value || ''], { type: 'text/plain;charset=utf-8' }), 'txt', states.text.seed));
$('#image-export').addEventListener('click', () => $('#image-canvas').toBlob((blob) => { if (blob) download(blob, 'png', states.image.seed); }, 'image/png'));
$('#audio-export').addEventListener('click', () => { if (states.audio.blob) download(states.audio.blob, 'wav', states.audio.seed); });
function restoreAudioUI() {
  // The native media clock, not a background timer or wall-clock estimate, is
  // authoritative after iOS has suspended page scripts. Never pause the media.
  cancelAnimationFrame(highlightFrame);
  highlightFrame = 0;
  if (states.audio.batch && syncBackgroundSegment()) return; // a fresh batch starts its own loop
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
  if (document.hidden && activeType !== 'audio') { paintCount(activeType); persistCount(activeType); }
  if (!document.hidden) {
    restoreAudioUI();
    if (activeType !== 'audio' && !states[activeType].paused) {
      const callback = activeType === 'text' ? generateText : generateImage;
      callback(); schedule(activeType, callback);
    }
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && !document.hidden) restoreAudioUI();
});
window.addEventListener('resize', () => {
  if (states.audio.piece && states.audio.scoreRows) drawSlurArcs(states.audio.piece, states.audio.scoreRows);
});
window.addEventListener('pagehide', () => { for (const type of Object.keys(states)) persistCount(type); });
// The site remains inert until an explicit adult confirmation. A refusal is
// intentionally not persisted, so the question reappears on the next visit.
function enterSite() {
  $('#age-gate').hidden = true;
  $('#app').removeAttribute('inert');
  document.body.classList.remove('age-locked');
  generateText();
  schedule('text', generateText);
}
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






