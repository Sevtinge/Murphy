import { seededRandom, EASTER_SEED, isDarkSeed } from './seed.js';

export const MIN_HZ = 20;
export const MAX_HZ = 20000;
export const TONE_SAMPLE_RATE = 48000;
const TAU = Math.PI * 2;

export function generateFrequencies(seed, count, humanSensitive = false) {
  const rng = seededRandom(seed, 'audio');
  if (!humanSensitive) return Array.from({ length: count }, () =>
    MIN_HZ + Math.floor(rng() * (MAX_HZ - MIN_HZ + 1)));
  // User-selectable weighting: 75% in 250–3500 Hz, 20% in 3501–10000 Hz,
  // and 5% across the rest of the full 20–20000 Hz range.
  return Array.from({ length: count }, () => {
    const band = rng();
    const position = rng();
    if (band < .75) return 250 + Math.floor(position * 3251);
    if (band < .95) return 3501 + Math.floor(position * 6500);
    const offset = Math.floor(position * (230 + 10000));
    return offset < 230 ? 20 + offset : 10001 + offset - 230;
  });
}

export function audioPreset(seed, language = 'en') {
  if (seed === EASTER_SEED) {
    // Integer-Hz approximations of C4, F♯4 and C5 (two successive tritones).
    return { kind: 'friendly', frequencies: [262, 370, 523], durations: [.4, .4, .8] };
  }
  if (isDarkSeed(seed, language)) {
    return { kind: 'dark', frequencies: Array(66).fill(66), durations: Array(66).fill(.66) };
  }
  return null;
}

export function toneDurationTotal(frequencies, duration) {
  return Array.isArray(duration)
    ? duration.reduce((sum, seconds) => sum + seconds, 0)
    : frequencies.length * duration;
}

export function tonePositionAt(frequencies, duration, time) {
  if (!frequencies.length) return { index: 0, fraction: 0 };
  if (!Array.isArray(duration)) {
    const index = Math.min(frequencies.length - 1, Math.max(0, Math.floor(time / duration)));
    return { index, fraction: Math.max(0, Math.min(1, (time - index * duration) / duration)) };
  }
  let start = 0;
  for (let index = 0; index < frequencies.length; index++) {
    const length = duration[index];
    if (time < start + length || index === frequencies.length - 1) {
      return { index, fraction: Math.max(0, Math.min(1, (time - start) / length)) };
    }
    start += length;
  }
  return { index: frequencies.length - 1, fraction: 1 };
}

export function smoothFraction(fraction) {
  // Cubic smoothstep: value and slope are continuous at every note boundary.
  return fraction * fraction * (3 - 2 * fraction);
}

export function frequencyAt(frequencies, duration, time, smooth) {
  if (!frequencies.length) return MIN_HZ;
  const { index, fraction } = tonePositionAt(frequencies, duration, time);
  if (!smooth || index === frequencies.length - 1) return frequencies[index];
  return frequencies[index] + (frequencies[index + 1] - frequencies[index]) * smoothFraction(fraction);
}

export function totalToneFrames(frequencies, duration) {
  return Array.isArray(duration)
    ? duration.reduce((sum, seconds) => sum + Math.round(seconds * TONE_SAMPLE_RATE), 0)
    : frequencies.length * Math.round(duration * TONE_SAMPLE_RATE);
}

export function wavHeader(frameCount) {
  const dataBytes = frameCount * 2;
  if (dataBytes > 0xffffffff - 36) throw new RangeError('WAV exceeds 4 GiB');
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const ascii = (at, word) => { for (let i = 0; i < word.length; i++) view.setUint8(at + i, word.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, dataBytes + 36, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TONE_SAMPLE_RATE, true); view.setUint32(28, TONE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, dataBytes, true);
  return buffer;
}

export function renderToneChunk(frequencies, duration, smooth, startFrame, frameCount, initialPhase = 0) {
  const frames = Array.isArray(duration)
    ? duration.map((seconds) => Math.round(seconds * TONE_SAMPLE_RATE))
    : Array(frequencies.length).fill(Math.round(duration * TONE_SAMPLE_RATE));
  const starts = [0];
  for (const length of frames) starts.push(starts[starts.length - 1] + length);
  const totalFrames = starts[starts.length - 1];
  const pcm = new Int16Array(frameCount);
  let phase = initialPhase;
  let index = 0;
  while (index + 1 < frequencies.length && startFrame >= starts[index + 1]) index++;
  for (let i = 0; i < frameCount; i++) {
    const frame = startFrame + i;
    while (index + 1 < frequencies.length && frame >= starts[index + 1]) index++;
    const position = frame - starts[index];
    const length = frames[index];
    const fraction = position / length;
    const frequency = smooth && index + 1 < frequencies.length
      ? frequencies[index] + (frequencies[index + 1] - frequencies[index]) * smoothFraction(fraction)
      : frequencies[index];
    const fade = Math.min(480, Math.max(1, Math.floor(length * .15)));
    const envelope = smooth
      ? Math.min(1, frame / fade, (totalFrames - frame) / fade)
      : Math.min(1, position / fade, (length - position) / fade);
    pcm[i] = Math.round(Math.sin(phase) * Math.max(0, envelope) * 0.16 * 32767);
    phase += TAU * frequency / TONE_SAMPLE_RATE;
    if (phase >= TAU) phase %= TAU;
  }
  return { pcm, phase };
}


export function frequencyPath(frequencies, duration, smooth, width = 1000, height = 120) {
  if (!frequencies.length) return '';
  const total = toneDurationTotal(frequencies, duration);
  const lengths = Array.isArray(duration) ? duration : Array(frequencies.length).fill(duration);
  const padding = 8; // keep boundary frequencies clear of the progress strip
  const y = (hz) => (padding + (MAX_HZ - hz) / (MAX_HZ - MIN_HZ) * (height - 2 * padding)).toFixed(2);
  let path = `M 0 ${y(frequencies[0])}`;
  let elapsed = 0;
  for (let i = 0; i < frequencies.length - 1; i++) {
    const x0 = elapsed / total * width;
    elapsed += lengths[i];
    const x1 = elapsed / total * width;
    if (smooth) {
      const third = (x1 - x0) / 3;
      path += ` C ${(x0 + third).toFixed(2)} ${y(frequencies[i])}`
        + ` ${(x1 - third).toFixed(2)} ${y(frequencies[i + 1])}`
        + ` ${x1.toFixed(2)} ${y(frequencies[i + 1])}`;
    } else {
      path += ` H ${x1.toFixed(2)} V ${y(frequencies[i + 1])}`;
    }
  }
  return `${path} H ${width}`;
}
