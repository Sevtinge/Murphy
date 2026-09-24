// All composition, synthesis and WAV encoding take place locally in the browser.
// 55,440 is divisible by every supported tuplet size (2-12).
export const TICKS_PER_BEAT = 55440;
const METERS = [[3, 4], [4, 4], [5, 4], [6, 8], [7, 8]];
const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const SCALE = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
const TUPLET_SIZES = [3, 5, 6, 7, 9, 10, 11, 12];
const THREE_BEAT_TUPLETS = [2, 4, 8];
const choose = (rng, values) => values[Math.floor(rng() * values.length)];
const B = TICKS_PER_BEAT;
const HALF_BEAT = [
  [[B / 2, 'eighth']],
  [[B / 4, 'sixteenth'], [B / 4, 'sixteenth']],
];
const WHOLE_BEAT = [
  [[B, 'quarter']], [[B, 'quarter']], [[B, 'quarter']],
  [[B / 2, 'eighth'], [B / 2, 'eighth']],
  [[B / 2, 'eighth'], [B / 2, 'eighth']],
  Array.from({ length: 4 }, () => [B / 4, 'sixteenth']),
  [[B * 3 / 4, 'dottedEighth'], [B / 4, 'sixteenth']],
  [[B / 4, 'sixteenth'], [B * 3 / 4, 'dottedEighth']],
  [[B / 2, 'eighth'], [B / 4, 'sixteenth'], [B / 4, 'sixteenth']],
];
const TWO_BEATS = [
  [[2 * B, 'half']], [[2 * B, 'half']],
  [[B * 3 / 2, 'dottedQuarter'], [B / 2, 'eighth']],
  [[B, 'quarter'], [B, 'quarter']],
];
const THREE_BEATS = [[[3 * B, 'dottedHalf']]];
const FOUR_BEATS = [[[4 * B, 'whole']]];

// A narrow triangular peak at 60 plus a small, linearly fading right tail
// keeps the historical 1-2000 BPM range without making extreme tempi common.
function triangular(rng, min, max, mode) {
  const u = rng();
  const c = (mode - min) / (max - min);
  return u < c
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}
export function sampleBpm(rng) {
  return Math.max(1, Math.min(2000, Math.round(rng() < 0.38
    ? triangular(rng, 1, 119, 60)
    : triangular(rng, 60, 2000, 60))));
}

function tupletPattern(rng, beats) {
  const count = choose(rng, beats === 3 ? THREE_BEAT_TUPLETS : TUPLET_SIZES);
  if (beats === 3) {
    const base = count === 8 ? 'eighth' : 'quarter';
    return Array.from({ length: count }, () => [3 * B / count, base, count, count === 8 ? 6 : 3]);
  }
  const base = beats === 1
    ? count === 3 ? 'eighth' : count <= 7 ? 'sixteenth' : 'thirtysecond'
    : count === 3 ? 'quarter' : count <= 7 ? 'eighth' : 'sixteenth';
  const normalCount = count === 3 ? 2 : count <= 7 ? 4 : 8;
  return Array.from({ length: count }, () => [beats * B / count, base, count, normalCount]);
}

export function compose(barCount, rng) {
  const [numerator, denominator] = choose(rng, METERS);
  const keySemitones = Math.floor(rng() * KEYS.length);
  const key = { name: KEYS[keySemitones], semitones: keySemitones };
  const bpm = sampleBpm(rng);
  const barTicks = numerator * B * 4 / denominator;
  const bars = [];
  for (let b = 0; b < barCount; b++) {
    let remaining = barTicks;
    const events = [];
    let group = 0;
    while (remaining > 0) {
      let pattern;
      if (remaining >= 4 * B && rng() < 0.11) pattern = FOUR_BEATS;
      else if (remaining >= 3 * B && rng() < 0.13) pattern = rng() < 0.50 ? [tupletPattern(rng, 3)] : THREE_BEATS;
      else if (remaining >= 2 * B && rng() < 0.23) pattern = rng() < 0.40 ? [tupletPattern(rng, 2)] : TWO_BEATS;
      else if (remaining >= B) pattern = rng() < 0.38 ? [tupletPattern(rng, 1)] : WHOLE_BEAT;
      else pattern = HALF_BEAT;
      const tile = choose(rng, pattern);
      group++;
      for (const [ticks, value, tuplet = null, tupletBase = null] of tile) {
        const midi = rng() < 0.07 ? null : choose(rng, SCALE) + keySemitones;
        events.push({ ticks, value, midi, tuplet, tupletBase, group });
      }
      remaining -= tile.reduce((sum, [ticks]) => sum + ticks, 0);
    }
    bars.push(events);
  }
  // Curved legato slurs are separate from the numbered tuplet brackets.
  const slurs = [];
  for (let barIndex = 0; barIndex < bars.length; barIndex++) {
    const bar = bars[barIndex];
    const starts = [];
    for (let i = 0; i < bar.length - 1; i++) {
      if (bar[i].midi !== null && bar[i + 1].midi !== null) starts.push(i);
    }
    if (!starts.length || (barIndex !== 0 && rng() >= 0.7)) continue;
    const start = choose(rng, starts);
    let end = start + 1;
    while (end + 1 < bar.length && bar[end + 1].midi !== null && end - start < 4 && rng() < 0.62) end++;
    slurs.push({ bar: barIndex, start, end });
  }
  if (!slurs.length) {
    for (let b = 0; b < bars.length && !slurs.length; b++) {
      const i = bars[b].findIndex((note, at) => at + 1 < bars[b].length && note.midi !== null && bars[b][at + 1].midi !== null);
      if (i >= 0) slurs.push({ bar: b, start: i, end: i + 1 });
    }
  }
  return { bars, bpm, numerator, denominator, barTicks, key, slurs };
}

// An original, fixed four-measure celebration phrase for the hidden seed.
export function composeCelebration() {
  const beats = { eighth: TICKS_PER_BEAT / 2, quarter: TICKS_PER_BEAT, half: TICKS_PER_BEAT * 2 };
  const melody = [
    [[72, 'eighth'], [76, 'eighth'], [79, 'quarter'], [79, 'quarter'], [84, 'quarter']],
    [[83, 'eighth'], [81, 'eighth'], [79, 'quarter'], [76, 'quarter'], [72, 'quarter']],
    [[77, 'eighth'], [81, 'eighth'], [84, 'quarter'], [83, 'quarter'], [81, 'quarter']],
    [[79, 'eighth'], [81, 'eighth'], [84, 'quarter'], [84, 'half']],
  ];
  const bars = melody.map((bar) => bar.map(([midi, value], index) => ({
    midi, value, ticks: beats[value], group: index < 2 ? 1 : index,
    tuplet: null, tupletBase: null,
  })));
  return {
    bars, bpm: 120, numerator: 4, denominator: 4,
    barTicks: 4 * TICKS_PER_BEAT, key: { name: 'C', semitones: 0 },
    slurs: [{ bar: 0, start: 0, end: 1 }, { bar: 2, start: 0, end: 1 }, { bar: 3, start: 0, end: 1 }],
  };
}

// A single sustained double-low la: 1=A♭, 4/4, ♩=1 (240 seconds).
export function composeDark() {
  return {
    bars: [[{
      midi: 53, value: 'whole', ticks: 4 * TICKS_PER_BEAT,
      group: 1, tuplet: null, tupletBase: null,
    }]],
    bpm: 1, numerator: 4, denominator: 4,
    barTicks: 4 * TICKS_PER_BEAT,
    key: { name: 'A♭', semitones: 8 },
    slurs: [], sustainAll: true,
  };
}

const TIMBRES = {
  piano: { partials: [[1, 1], [2, .27], [3, .11]], decay: 2.7, attack: .008, volume: .43 },
  electric: { partials: [[1, 1], [2.01, .34], [4.02, .15]], decay: 1.8, attack: .006, volume: .38 },
  musicBox: { partials: [[1, 1], [3, .38], [5.02, .18]], decay: 4.7, attack: .002, volume: .37 },
  pluck: { partials: [[1, 1], [2, .44], [3, .22], [4, .12]], decay: 4.1, attack: .003, volume: .35 },
  marimba: { partials: [[1, 1], [2.01, .32], [3.9, .17]], decay: 3.8, attack: .004, volume: .39 },
  organ: { partials: [[1, 1], [2, .34], [3, .19], [4, .1]], decay: 0, attack: .025, volume: .30 },
  acousticGuitar: { partials: [[1, 1], [2, .49], [3, .28], [4, .16], [5, .07]], decay: 3.2, attack: .003, volume: .32 },
  harp: { partials: [[1, 1], [2, .25], [3, .09], [5, .04]], decay: 2.1, attack: .004, volume: .40 },
  bass: { partials: [[1, 1], [2, .52], [3, .23], [4, .1]], decay: 2.0, attack: .007, volume: .35, transpose: -12 },
  violin: { partials: [[1, 1], [2, .78], [3, .52], [4, .32], [5, .2]], decay: .38, attack: .075, volume: .24, vibrato: .0025 },
  cello: { partials: [[1, 1], [2, .64], [3, .33], [4, .12]], decay: .32, attack: .085, volume: .27, transpose: -12, vibrato: .002 },
  flute: { partials: [[1, 1], [2, .09], [3, .025]], decay: .16, attack: .045, volume: .46, vibrato: .0018 },
  clarinet: { partials: [[1, 1], [3, .49], [5, .22], [7, .075]], decay: .25, attack: .035, volume: .34, vibrato: .0012 },
  saxophone: { partials: [[1, 1], [2, .56], [3, .37], [4, .2], [5, .13]], decay: .48, attack: .035, volume: .27, vibrato: .002 },
  trumpet: { partials: [[1, 1], [2, .69], [3, .44], [4, .3], [5, .15]], decay: .28, attack: .04, volume: .26, vibrato: .001 },
  bell: { partials: [[1, 1], [2.72, .37], [5.43, .19], [8.11, .07]], decay: 3.2, attack: .002, volume: .37 },
  synthLead: { partials: [[1, 1], [2, .7], [3, .46], [4, .28], [5, .17]], decay: .18, attack: .01, volume: .28, vibrato: .003 },
};
export function synthesizeWav(piece, instrument = 'piano', sampleRateOverride = 0) {
  const preset = TIMBRES[instrument] || TIMBRES.piano;
  const sampleRate = sampleRateOverride || (piece.bpm < 60 ? 8000 : piece.bpm < 120 ? 16000 : 22050);
  const samplesPerTick = sampleRate * 60 / (piece.bpm * TICKS_PER_BEAT);
  const sampleCount = Math.ceil(piece.bars.length * piece.barTicks * samplesPerTick);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  let elapsedTicks = 0;
  for (let barIndex = 0; barIndex < piece.bars.length; barIndex++) {
    const bar = piece.bars[barIndex];
    const slur = piece.slurs?.find((item) => item.bar === barIndex);
    for (let noteIndex = 0; noteIndex < bar.length; noteIndex++) {
      const note = bar[noteIndex];
      const start = Math.round(elapsedTicks * samplesPerTick);
      elapsedTicks += note.ticks;
      const end = Math.min(sampleCount, Math.round(elapsedTicks * samplesPerTick));
      if (note.midi === null) continue;
      // The fixed low-la easter egg keeps the notated pitch in every timbre.
      const semitoneShift = piece.sustainAll ? 0 : (preset.transpose || 0);
      const frequency = 440 * 2 ** ((note.midi + semitoneShift - 69) / 12);
      const delta = 2 * Math.PI * frequency / sampleRate;
      const duration = (end - start) / sampleRate;
      const sounding = piece.sustainAll ? duration : Math.min(duration, preset.decay < .5 ? 6 : 4);
      const connected = slur && noteIndex >= slur.start && noteIndex < slur.end;
      const overlap = connected ? Math.min(Math.round(sampleRate * 0.025), Math.round((end - start) * 0.12)) : 0;
      const soundEnd = Math.min(sampleCount, end + overlap, start + Math.ceil(sounding * sampleRate) + overlap);
      const renderedSamples = soundEnd - start;
      const attackSamples = Math.max(1, Math.round(Math.min(preset.attack, duration * 0.2) * sampleRate));
      const releaseSamples = Math.max(1, Math.round(Math.min(0.045, renderedSamples / sampleRate * 0.25) * sampleRate));
      const decayStep = piece.sustainAll ? 1 : Math.exp(-preset.decay / (sampleRate * Math.max(0.35, sounding)));
      const incoming = slur && noteIndex > slur.start && noteIndex <= slur.end;
      const readUntil = start + Math.round(sampleRate * 0.025);
      let decay = 1, phase = 0;
      let vibratoPhase = 0;
      const vibratoStep = 2 * Math.PI * 5.2 / sampleRate;
      for (let i = start; i < soundEnd; i++) {
        const local = i - start;
        const envelope = Math.min(1, local / attackSamples) * Math.min(1, (soundEnd - i) / releaseSamples) * decay;
        let wave = 0;
        for (const [harmonic, level] of preset.partials) wave += level * Math.sin(phase * harmonic);
        const at = 44 + i * 2;
        const prior = incoming && i < readUntil ? view.getInt16(at, true) / 32767 : 0;
        const combined = preset.volume * envelope * wave + prior;
        view.setInt16(at, Math.round(Math.max(-1, Math.min(1, combined)) * 32767), true);
        phase += delta * (preset.vibrato ? 1 + preset.vibrato * Math.sin(vibratoPhase) : 1);
        vibratoPhase += vibratoStep;
        decay *= decayStep;
      }
    }
  }
  const ascii = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, sampleCount * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}




