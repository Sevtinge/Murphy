import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage } from '../language.js';

test('preferred browser language wins, while saved choice stays explicit', () => {
  assert.equal(resolveLanguage({ primary: 'en-US', preferred: ['zh-CN', 'en-US'] }), 'zh');
  assert.equal(resolveLanguage({ primary: 'zh-CN', preferred: ['en-US', 'zh-CN'] }), 'en');
  assert.equal(resolveLanguage({ primary: 'en-US', preferred: ['zh-CN'], saved: 'en' }), 'en');
  assert.equal(resolveLanguage({ primary: 'en-US', preferred: ['en-US'], saved: 'zh' }), 'zh');
  assert.equal(resolveLanguage({}), 'en');
});
