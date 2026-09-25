import test from 'node:test';
import assert from 'node:assert/strict';
import { routeType, tabUrl, encodeSeed } from '../routes.js';

test('text, picture, music and audio have independent direct paths', () => {
  for (const [path, type] of [
    ['/text', 'text'], ['/picture', 'image'], ['/music', 'music'], ['/audio', 'audio'], ['/', 'text'],
  ]) assert.equal(routeType(path, '/'), type);
  assert.equal(routeType('/Murphy/music', '/Murphy/'), 'music');
});

test('per-tab links round-trip arbitrary valid seeds through the URL', () => {
  const base = new URL('https://example.test/Murphy/');
  const seed = 'A+b/#&=!*_Z';
  for (const [type, path] of [['text', 'text'], ['image', 'picture'], ['music', 'music'], ['audio', 'audio']]) {
    const href = tabUrl(type, base, seed);
    const url = new URL(href, base);
    assert.equal(url.pathname, `/Murphy/${path}`);
    assert.equal(url.searchParams.get('seed'), seed);
  }
  assert.equal(tabUrl('music', base), '/Murphy/music');
});


test('all seed punctuation is percent-encoded, not merely URL-unsafe characters', () => {
  const seed = 'Ab09!@#$%^&*_-+=/';
  assert.equal(encodeSeed(seed), 'Ab09%21%40%23%24%25%5E%26%2A%5F%2D%2B%3D%2F');
  const url = new URL(tabUrl('music', 'https://example.test/', seed), 'https://example.test/');
  assert.equal(url.search, '?seed=Ab09%21%40%23%24%25%5E%26%2A%5F%2D%2B%3D%2F');
  assert.equal(url.searchParams.get('seed'), seed);
});
