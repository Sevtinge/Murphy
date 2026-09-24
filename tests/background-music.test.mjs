import test from 'node:test';
import assert from 'node:assert/strict';
import { compose, synthesizeWav } from '../music.js';
import { seededRandom } from '../seed.js';
import { jianpuToken, jianpuSlurGlyph, scoreSlurMarks, scoreSlurPlan, jianpuFlatLineSegments } from '../notation.js';
import {
  buildBackgroundBatch, concatenateWav, isIOSBrowser,
  retimbreBackgroundBatch, segmentAtTime,
} from '../background-music.js';

test('iPhone and iPad are detected without treating desktop Macs as iOS', () => {
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }), true);
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIOSBrowser({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

test('prepared music is one valid, looping WAV with exact segment boundaries', async () => {
  const first = compose(8, seededRandom('first', 'music'));
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
  const piece = compose(4, seededRandom('solo', 'music'));
  const wav = synthesizeWav(piece, 'piano', 16000);
  const joined = concatenateWav([wav, wav], 16000);
  assert.equal(joined.size, 44 + 2 * (wav.size - 44));
});

test('32 measures compose and encode as a WAV', async () => {
  const piece = compose(32, seededRandom('test32', 'music'));
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
    const piece = compose(16, seededRandom(`density${i}`, 'music'));
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


test('slurs are stable with measure count, can cross bars, and end on plain sounding digits', () => {
  let slurCount = 0, crossingCount = 0;
  for (let i = 0; i < 100; i++) {
    const seed = `slurs${i}`;
    const short = compose(4, seededRandom(seed, 'music'));
    const piece = compose(16, seededRandom(seed, 'music'));
    assert.deepEqual(piece.bars.slice(0, 4), short.bars);
    assert.deepEqual(piece.slurs.filter((slur) => slur.endBar < 4), short.slurs);
    const flat = piece.bars.flat();
    const offsets = piece.bars.map((_, at) => piece.bars.slice(0, at).reduce((sum, bar) => sum + bar.length, 0));
    for (const { startBar, start, endBar, end } of piece.slurs) {
      assert.ok(startBar >= 0 && endBar >= startBar && endBar < piece.bars.length);
      const first = offsets[startBar] + start, last = offsets[endBar] + end;
      assert.ok(last > first);
      for (const note of flat.slice(first, last + 1)) {
        assert.notEqual(note.midi, null);
        assert.ok(!['half', 'whole'].includes(note.value));
        assert.ok(!note.value.startsWith('dotted'));
        assert.equal(note.tuplet, null);
      }
      if (endBar !== startBar) crossingCount++;
      slurCount++;
    }
  }
  assert.ok(slurCount > 0 && crossingCount > 0);
  assert.equal(jianpuSlurGlyph(1.5), 'A');
  assert.equal(jianpuSlurGlyph(2), 'S');
  assert.equal(jianpuSlurGlyph(6, true), 'Y');
});

test('a notated cross-bar slur is audible in the PCM transition', async () => {
  const B = 55440;
  const bars = [60, 62].map((base) => Array.from({ length: 4 }, (_, index) => ({
    midi: base + index, value: 'quarter', ticks: B,
  })));
  const piece = {
    bars, bpm: 120, barTicks: 4 * B,
    slurs: [{ startBar: 0, start: 3, endBar: 1, end: 0 }],
  };
  const sampleRate = 16000;
  const slurred = new DataView(await synthesizeWav(piece, 'organ', sampleRate).arrayBuffer());
  const detached = new DataView(await synthesizeWav({ ...piece, slurs: [] }, 'organ', sampleRate).arrayBuffer());
  const boundary = Math.round(4 * B * sampleRate * 60 / (piece.bpm * B));
  let difference = 0;
  for (let i = boundary; i < boundary + sampleRate * 0.07; i++) {
    difference += Math.abs(slurred.getInt16(44 + i * 2, true) - detached.getInt16(44 + i * 2, true));
  }
  assert.ok(difference > 100000, 'legato overlap should change the audible boundary');
});


test('integer spans of 2–6 digit widths use font arcs; fractional or longer spans use KL', () => {
  const note = (midi, group) => ({ midi, value: 'eighth', group });
  const bars = [[note(60, 1), note(62, 1), note(64, 1), note(65, 2)], [note(67, 1)]];
  const piece = { bars, key: { semitones: 0 }, slurs: [] };
  const span = (start, end, startBar = 0, endBar = 0) => ({ startBar, start, endBar, end });
  const arc = span(0, 2);
  assert.deepEqual(scoreSlurPlan(piece, arc), { kind: 'arc', high: false, glyph: 'S' });
  piece.slurs = [arc];
  assert.equal(scoreSlurMarks(piece).get('0:0'), 'S');
  assert.equal(scoreSlurMarks(piece).size, 1);
  const fractional = span(0, 3);
  assert.equal(scoreSlurPlan(piece, fractional).kind, 'flat');
  piece.slurs = [span(2, 3)];
  assert.equal(scoreSlurPlan(piece, piece.slurs[0]).glyph, 'A'); // .28em group gap
  piece.slurs = [arc];
  piece.bars[0][1].value = 'dottedEighth';
  assert.equal(scoreSlurPlan(piece, arc).kind, 'flat'); // juxtaposed dot breaks exact widths
  piece.bars[0][1].value = 'eighth';
  const adjacent = span(0, 1); // A/Q is expressly drawn for 1.5 widths
  assert.equal(scoreSlurPlan(piece, adjacent).glyph, 'A');
  piece.bars[0][0].value = 'quarter';
  assert.equal(scoreSlurPlan(piece, adjacent).glyph, 'S'); // full space: 2 widths
  piece.bars[0][0].value = 'eighth';
  const crossing = span(3, 0, 0, 1);
  assert.equal(scoreSlurPlan(piece, crossing).kind, 'flat');
  piece.slurs = [crossing];
  assert.equal(scoreSlurMarks(piece).get('0:3'), 'J');
  assert.equal(scoreSlurMarks(piece).get('1:0'), ':');
  piece.bars = [Array.from({ length: 8 }, (_, i) => note(60 + i, 1))];
  assert.equal(scoreSlurPlan(piece, span(0, 6)).glyph, 'H');
  assert.equal(scoreSlurPlan(piece, span(0, 7)).kind, 'flat');
});

test('flat line uses paired font KL/IO two-cell segments, aligned at a barline', () => {
  assert.deepEqual(jianpuFlatLineSegments(34, 10), [
    { offset: 0, glyph: 'KL' }, { offset: 20, glyph: 'KL' },
  ]);
  assert.deepEqual(jianpuFlatLineSegments(34, 10, false, 15), [
    { offset: -15, glyph: 'KL' }, { offset: 5, glyph: 'KL' },
    { offset: 25, glyph: 'KL' },
  ]);
  assert.deepEqual(jianpuFlatLineSegments(20, 10, true), [{ offset: 0, glyph: 'IO' }]);
});

test('long rests repeat zero instead of sustaining a dash', () => {
  assert.equal(jianpuToken({ midi: null, value: 'half' }), '00');
  assert.equal(jianpuToken({ midi: null, value: 'dottedHalf' }), '000');
  assert.equal(jianpuToken({ midi: null, value: 'whole' }), '0000');
  assert.equal(jianpuToken({ midi: 60, value: 'half' }), '1-');
});


test('a dotted rest followed by two high notes uses the font Q arc', () => {
  const piece = {
    key: { semitones: 0 },
    bars: [[
      { midi: null, value: 'dottedEighth', group: 1 },
      { midi: 72, value: 'eighth', group: 2 },
      { midi: 83, value: 'sixteenth', group: 2 },
    ]],
    slurs: [{ startBar: 0, start: 1, endBar: 0, end: 2 }],
  };
  assert.deepEqual(scoreSlurPlan(piece, piece.slurs[0]), { kind: 'arc', high: true, glyph: 'Q' });
  assert.equal(scoreSlurMarks(piece).get('0:1'), 'Q');
  assert.equal(scoreSlurMarks(piece).size, 1);
  piece.bars[0][2].group = 3;
  assert.equal(scoreSlurPlan(piece, piece.slurs[0]).glyph, 'Q'); // neighboring rhythmic groups
});


test('separate quarter-note groups use font quarter-spaces and a three-width arc', () => {
  const piece = {
    key: { semitones: 0 },
    bars: [[
      { midi: 74, value: 'quarter', group: 1 }, // 2′
      { midi: 53, value: 'quarter', group: 2 }, // low 4
      { midi: 48, value: 'quarter', group: 3 }, // low 1
      { midi: 55, value: 'half', group: 4 },
    ]],
    slurs: [{ startBar: 0, start: 0, endBar: 0, end: 2 }],
  };
  assert.deepEqual(scoreSlurPlan(piece, piece.slurs[0]), { kind: 'arc', high: true, glyph: 'E' });
  assert.equal(scoreSlurMarks(piece).get('0:0'), 'E');
  assert.equal(scoreSlurMarks(piece).size, 1);
});


test('existing music seeds keep their original deterministic stream', () => {
  const rng = seededRandom('StableSeed', 'music');
  assert.deepEqual(Array.from({ length: 4 }, () => rng()), [
    0.7280638713855296, 0.2595076553989202,
    0.34409772139042616, 0.20462653902359307,
  ]);
});
