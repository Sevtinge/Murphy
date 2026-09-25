import test from 'node:test';
import assert from 'node:assert/strict';
import { beepMetadata, trackMetadata } from '../media-info.js';

const baseUrl = 'https://example.test/Murphy/';

test('audio Media Session uses the gold cover and BEEP seed title', () => {
  const info = beepMetadata({ seed: 'A+b', eggKind: null, baseUrl });
  assert.equal(info.title, '(BEEP) A+b');
  assert.equal(info.artist, 'Murphy');
  assert.match(info.artwork[0].src, /murphy-icon-192\.png$/);
  assert.match(info.artwork[1].src, /murphy-icon-512\.png$/);
});

test('sevtinge and language-specific dark eggs have their own title or art', () => {
  const friendly = beepMetadata({ seed: 'sevtinge', eggKind: 'friendly', baseUrl });
  assert.equal(friendly.title, 'Tritone');
  assert.equal(friendly.artist, 'Murphy');
  const dark = beepMetadata({ seed: '666', eggKind: 'dark', baseUrl });
  assert.equal(dark.title, '(BEEP) 666');
  assert.equal(dark.artist, 'Not Murphy');
  assert.match(dark.artwork[0].src, /murphy-dark-cover-192\.png\?v=black$/);
  assert.match(dark.artwork[1].src, /murphy-dark-cover-512\.png\?v=black$/);
  const chinese = beepMetadata({ seed: '444', eggKind: 'dark', baseUrl });
  assert.equal(chinese.artist, 'Not Murphy');
});

test('existing music metadata stays unchanged', () => {
  const music = trackMetadata({ measures: 12, instrument: 'Piano', seed: 'song', eggKind: null, baseUrl });
  assert.equal(music.title, '(12, Piano) song');
  assert.equal(music.artist, 'Murphy');
});
