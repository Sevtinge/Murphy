import test from 'node:test';
import assert from 'node:assert/strict';
import { compose, synthesizeWav } from '../audio.js';
import { seededRandom } from '../seed.js';
import {
  buildBackgroundBatch, concatenateWav, isIOSBrowser,
  retimbreBackgroundBatch, segmentAtTime,
} from '../background-audio.js';

test('iPhone and iPad are detected without treating desktop Macs as iOS', () => {
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }), true);
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

test('prepared audio is one valid, looping WAV with exact segment boundaries', async () => {
  const first = compose(8, seededRandom('first', 'audio'));
  let counter = 0;
  const batch = buildBackgroundBatch(first, 'first', 8, 'piano', {
    targetSeconds: 45,
    maxSegments: 8,
    seedFactory: () => `queued${++counter}`,
  });
  assert.ok(batch.segments.length > 1);
  assert.ok(batch.segments.length <= 8);
  const combined = new DataView(await batch.blob.arrayBuffer());
  const pcmBytes = batch.segments.reduce((size, item) => size + item.blob.size - 44, 0);
  assert.equal(batch.blob.size, pcmBytes + 44);
  assert.equal(combined.getUint32(0, false), 0x52494646); // RIFF
  assert.equal(combined.getUint32(8, false), 0x57415645); // WAVE
  assert.equal(combined.getUint32(24, true), 16000);
  assert.equal(combined.getUint32(40, true), pcmBytes);
  assert.equal(batch.totalDuration, pcmBytes / (16000 * 2));
  for (const [index, segment] of batch.segments.entries()) {
    assert.equal(segmentAtTime(batch, segment.start + segment.duration / 2), index);
  }
  assert.equal(segmentAtTime(batch, batch.totalDuration + 0.1), 0);
  assert.equal(segmentAtTime(batch, Number.NaN), 0);

  // The PCM at the second segment's boundary is byte-for-byte from its own WAV.
  const second = batch.segments[1];
  const source = new Uint8Array(await second.blob.arrayBuffer()).slice(44, 108);
  const at = 44 + Math.round(second.start * 16000 * 2);
  assert.deepEqual(new Uint8Array(combined.buffer).slice(at, at + source.length), source);

  const other = retimbreBackgroundBatch(batch, 'flute');
  assert.equal(other.totalDuration, batch.totalDuration);
  assert.deepEqual(other.segments.map(({ seed }) => seed), batch.segments.map(({ seed }) => seed));
  assert.notDeepEqual(
    new Uint8Array(await other.blob.arrayBuffer()).slice(44, 256),
    new Uint8Array(combined.buffer).slice(44, 256),
  );
});

test('fixed-rate synthesis and concatenation do not change standalone WAV encoding', () => {
  const piece = compose(4, seededRandom('solo', 'audio'));
  const wav = synthesizeWav(piece, 'piano', 16000);
  const joined = concatenateWav([wav, wav], 16000);
  assert.equal(joined.size, 44 + 2 * (wav.size - 44));
});

test('32 measures compose and encode as a WAV', async () => {
  const piece = compose(32, seededRandom('test32', 'audio'));
  assert.equal(piece.bars.length, 32);
  assert.ok(piece.bars.every((bar) => bar.reduce((sum, note) => sum + note.ticks, 0) === piece.barTicks));
  const wav = synthesizeWav(piece);
  const header = new DataView(await wav.arrayBuffer());
  assert.equal(header.getUint32(40, true), wav.size - 44);
});


test('random scores favor longer notes and use tuplets sparingly', () => {
  let notes = 0, tuplets = 0, shortNotes = 0;
  const values = new Set();
  for (let i = 0; i < 100; i++) {
    const piece = compose(16, seededRandom(`density${i}`, 'audio'));
    for (const bar of piece.bars) {
      assert.equal(bar.reduce((sum, note) => sum + note.ticks, 0), piece.barTicks);
      assert.ok(new Set(bar.filter((note) => note.tuplet).map((note) => note.group)).size <= 1);
      for (const note of bar) {
        notes++;
        if (note.tuplet) tuplets++;
        if (['eighth', 'sixteenth', 'thirtysecond', 'dottedEighth'].includes(note.value)) shortNotes++;
        values.add(note.value);
      }
    }
  }
  assert.ok(tuplets / notes < 0.25, 'tuplet notation should not dominate the score');
  assert.ok(shortNotes / notes < 0.48, 'underlined notes should be accents, not the default');
  assert.ok(values.has('thirtysecond') && values.has('sixteenth') && values.has('half'));
});
