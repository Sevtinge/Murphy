import test from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename } from '../export-name.js';

test('exports use Murphy_tab_seed_unixMilliseconds.extension', () => {
  const at = 1760000000000;
  assert.equal(exportFilename('text', 'Ab12', 'txt', at), 'Murphy_text_Ab12_1760000000000.txt');
  assert.equal(exportFilename('image', 'A+b/#', 'png', at), 'Murphy_picture_A%2Bb%2F%23_1760000000000.png');
  assert.equal(exportFilename('music', 'sevtinge', 'wav', at), 'Murphy_music_sevtinge_1760000000000.wav');
});

test('all random-length seeds fit intact; very long manual seeds remain distinguishable', () => {
  const randomMax = '!'.repeat(64);
  assert.equal(exportFilename('image', randomMax, 'png', 1760000000000).split('_1760000000000')[0],
    `Murphy_picture_${'%21'.repeat(64)}`);
  const longA = exportFilename('music', '!'.repeat(1000) + 'A', 'wav', 1760000000000);
  const longB = exportFilename('music', '!'.repeat(1000) + 'B', 'wav', 1760000000000);
  assert.ok(longA.length <= 240);
  assert.ok(longB.length <= 240);
  assert.notEqual(longA, longB);
  assert.match(longA, /^Murphy_music_(?:%21)+~[0-9a-f]{8}_1760000000000\.wav$/);
  assert.throws(() => exportFilename('audio', 'x', 'wav', 1), RangeError);
});
