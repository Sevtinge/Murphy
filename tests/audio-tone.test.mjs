import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFrequencies, audioPreset, toneDurationTotal, tonePositionAt, totalToneFrames, frequencyAt, frequencyPath, renderToneChunk, wavHeader, TONE_SAMPLE_RATE } from '../audio-tone.js';

test('frequencies are deterministic and linearly cover 20–20000 Hz', () => {
  const a = generateFrequencies('fixed', 512);
  assert.deepEqual(a, generateFrequencies('fixed', 512));
  assert.notDeepEqual(a, generateFrequencies('other', 512));
  assert.ok(a.every((hz) => Number.isInteger(hz) && hz >= 20 && hz <= 20000));
  assert.ok(Math.min(...a) < 100 && Math.max(...a) > 19900);
});

test('smooth frequencies glide between notes; stepped frequencies do not', () => {
  const notes = [1000, 800, 750, 500, 200];
  assert.equal(frequencyAt(notes, .25, 0, true), 1000);
  assert.equal(frequencyAt(notes, .25, .125, true), 900);
  assert.equal(frequencyAt(notes, .25, .0625, true), 968.75); // curved, not linear 950
  assert.equal(frequencyAt(notes, .25, .25, true), 800);
  assert.equal(frequencyAt(notes, .25, .125, false), 1000);
  assert.equal(frequencyAt(notes, .25, .25, false), 800);
});

test('chunk rendering preserves phase and WAV format', () => {
  const frequencies = [1000, 800];
  const total = .2 * TONE_SAMPLE_RATE;
  const whole = renderToneChunk(frequencies, .1, true, 0, total);
  const first = renderToneChunk(frequencies, .1, true, 0, 3000);
  const second = renderToneChunk(frequencies, .1, true, 3000, total - 3000, first.phase);
  assert.deepEqual([...whole.pcm], [...first.pcm, ...second.pcm]);
  const stepped = renderToneChunk(frequencies, .1, false, 0, total);
  assert.notDeepEqual([...whole.pcm], [...stepped.pcm]);
  const view = new DataView(wavHeader(total));
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(40, true), total * 2);
  assert.equal(new DataView(wavHeader(512 * 5 * TONE_SAMPLE_RATE)).getUint32(40, true), 512 * 5 * TONE_SAMPLE_RATE * 2);
});


test('human-sensitive mode heavily favors the requested two bands', () => {
  const frequencies = generateFrequencies('sensitive', 10000, true);
  assert.deepEqual(frequencies, generateFrequencies('sensitive', 10000, true));
  assert.notDeepEqual(frequencies, generateFrequencies('sensitive', 10000, false));
  const primary = frequencies.filter((hz) => hz >= 250 && hz <= 3500).length / frequencies.length;
  const secondary = frequencies.filter((hz) => hz >= 3501 && hz <= 10000).length / frequencies.length;
  assert.ok(primary > .72 && primary < .78, `primary band: ${primary}`);
  assert.ok(secondary > .17 && secondary < .23, `secondary band: ${secondary}`);
  assert.ok(frequencies.some((hz) => hz < 250 || hz > 10000));
});


test('sevtinge is a three-note pair of tritones with chosen phrase lengths', () => {
  const preset = audioPreset('sevtinge');
  assert.equal(preset.kind, 'friendly');
  assert.deepEqual(preset.durations, [.4, .4, .8]);
  assert.deepEqual(preset.frequencies, [262, 370, 523]);
  assert.ok(preset.frequencies.every(Number.isInteger));
  assert.ok(Math.abs(preset.frequencies[1] / preset.frequencies[0] - Math.SQRT2) < .003);
  assert.ok(Math.abs(preset.frequencies[2] / preset.frequencies[1] - Math.SQRT2) < .003);
  assert.equal(toneDurationTotal(preset.frequencies, preset.durations), 1.6);
  assert.equal(totalToneFrames(preset.frequencies, preset.durations), 76800);
  assert.equal(audioPreset('ordinary'), null);
});

test('666 and 444 produce 66 separate 66 Hz tones of 0.66 seconds', () => {
  for (const [seed, language] of [['666', 'en'], ['444', 'zh'], ['6666', 'en'], ['4444', 'zh']]) {
    const preset = audioPreset(seed, language);
    assert.equal(preset.kind, 'dark');
    assert.equal(preset.frequencies.length, 66);
    assert.ok(preset.frequencies.every((hz) => hz === 66));
    assert.ok(preset.durations.every((seconds) => seconds === .66));
    assert.ok(Math.abs(toneDurationTotal(preset.frequencies, preset.durations) - 43.56) < 1e-10);
  }
  assert.equal(audioPreset('666', 'zh'), null);
  assert.equal(audioPreset('444', 'en'), null);
  assert.equal(audioPreset('66'), null);
  assert.equal(audioPreset('664'), null);
});

test('individual durations preserve smooth positions and chunked PCM', () => {
  const frequencies = [1000, 800, 750];
  const durations = [.4, .4, .8];
  assert.equal(frequencyAt(frequencies, durations, .2, true), 900);
  assert.equal(frequencyAt(frequencies, durations, .4, true), 800);
  assert.equal(frequencyAt(frequencies, durations, .6, true), 775);
  assert.equal(tonePositionAt(frequencies, durations, 1.2).index, 2);
  const total = totalToneFrames(frequencies, durations);
  const whole = renderToneChunk(frequencies, durations, false, 0, total);
  const first = renderToneChunk(frequencies, durations, false, 0, 20000);
  const second = renderToneChunk(frequencies, durations, false, 20000, total - 20000, first.phase);
  assert.deepEqual([...whole.pcm], [...first.pcm, ...second.pcm]);
});


test('smooth visual trajectory is cubic; unsmoothed trajectory is stepped', () => {
  const smooth = frequencyPath([1000, 800, 750], .25, true);
  const stepped = frequencyPath([1000, 800, 750], .25, false);
  assert.match(smooth, / C /);
  assert.doesNotMatch(stepped, / C /);
  assert.match(stepped, / H .* V /);
  assert.ok(smooth.endsWith('H 1000'));
});
