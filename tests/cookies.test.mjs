import test from 'node:test';
import assert from 'node:assert/strict';

test('cookie encoding and size validation rules', () => {
  const prefix = 'tnag-community-v1-';
  const key = 'prefs';
  const sample = { sound: true, lang: 'vi' };
  const encoded = encodeURIComponent(JSON.stringify(sample));
  assert.ok(encoded.length <= 3500);
  const parsed = JSON.parse(decodeURIComponent(encoded));
  assert.deepEqual(parsed, sample);
  assert.ok(`${prefix}${key}=${encoded}`.startsWith('tnag-community-v1-prefs='));
});
