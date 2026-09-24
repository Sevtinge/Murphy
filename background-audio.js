import { compose, synthesizeWav, TICKS_PER_BEAT } from './audio.js';
import { randomSeed, seededRandom } from './seed.js';

const BATCH_RATE = 16000;
const DEFAULT_TARGET_SECONDS = 90;
const DEFAULT_MAX_SEGMENTS = 16;

export function isIOSBrowser(client) {
  return /iPad|iPhone|iPod/i.test(client.userAgent || '') ||
    (client.platform === 'MacIntel' && client.maxTouchPoints > 1);
}

export function pieceDuration(piece) {
  return piece.bars.length * piece.barTicks * 60 / (piece.bpm * TICKS_PER_BEAT);
}

// WAV files share the same PCM format, so their data chunks can be joined as
// Blob slices without decoding or copying every sample on the main thread.
export function concatenateWav(blobs, sampleRate = BATCH_RATE) {
  const dataBytes = blobs.reduce((size, blob) => size + blob.size - 44, 0);
  if (dataBytes > 0xffffffff - 36) throw new RangeError('Background audio batch exceeds WAV size limit');
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, dataBytes, true);
  return new Blob([header, ...blobs.map((blob) => blob.slice(44))], { type: 'audio/wav' });
}

function assemble(pieces, instrument, activeIndex = 0) {
  const segments = [];
  let start = 0;
  for (const { piece, seed } of pieces) {
    const blob = synthesizeWav(piece, instrument, BATCH_RATE);
    const duration = (blob.size - 44) / (2 * BATCH_RATE);
    segments.push({ piece, seed, blob, start, duration, end: start + duration });
    start += duration;
  }
  return {
    segments,
    blob: segments.length === 1 ? segments[0].blob : concatenateWav(segments.map((segment) => segment.blob)),
    totalDuration: start,
    activeIndex,
    lastTime: 0,
  };
}

export function buildBackgroundBatch(firstPiece, firstSeed, barCount, instrument, {
  seedFactory = randomSeed,
  targetSeconds = DEFAULT_TARGET_SECONDS,
  maxSegments = DEFAULT_MAX_SEGMENTS,
} = {}) {
  const pieces = [{ piece: firstPiece, seed: firstSeed }];
  let duration = pieceDuration(firstPiece);
  for (let attempts = 0; duration < targetSeconds && pieces.length < maxSegments && attempts < maxSegments * 4; attempts++) {
    const seed = seedFactory();
    const piece = compose(barCount, seededRandom(seed, 'audio'));
    const candidate = pieceDuration(piece);
    if (candidate > 120) continue;
    pieces.push({ piece, seed });
    duration += candidate;
  }
  return assemble(pieces, instrument);
}

export function retimbreBackgroundBatch(batch, instrument) {
  return assemble(batch.segments, instrument, batch.activeIndex);
}

export function segmentAtTime(batch, time) {
  // A native looping audio element wraps to zero without JavaScript.
  if (!Number.isFinite(time) || batch.totalDuration <= 0) return 0;
  const wrapped = Math.max(0, time) % batch.totalDuration;
  const index = batch.segments.findIndex((segment) => wrapped < segment.end);
  return index >= 0 ? index : batch.segments.length - 1;
}
