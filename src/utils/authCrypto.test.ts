import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  parseCookieHeader,
} from './authCrypto.ts';

test('hashPassword and verifyPassword validate matching passwords and reject wrong ones', () => {
  const hash = hashPassword('student123');
  assert.equal(verifyPassword('student123', hash), true);
  assert.equal(verifyPassword('wrongpass', hash), false);
  assert.equal(verifyPassword('student123', ''), false);
});

test('signSessionToken and verifySessionToken enforce signature and expiry', () => {
  const secret = 'test-secret-key';
  const user = {
    role: 'student' as const,
    id: '2024AAPS0225H',
    name: 'Kartikey Gaur',
    email: 'kartikey.gaur@campus.edu',
    student_id: '2024AAPS0225H',
  };

  const token = signSessionToken(user, secret, 60_000);
  const verified = verifySessionToken(token, secret);
  assert.deepEqual(verified, user);

  // Tampered token must fail
  const tampered = token.slice(0, -3) + 'xyz';
  assert.equal(verifySessionToken(tampered, secret), null);

  // Wrong secret must fail
  assert.equal(verifySessionToken(token, 'other-secret'), null);

  // Expired token must fail
  const expired = signSessionToken(user, secret, -1000);
  assert.equal(verifySessionToken(expired, secret), null);
});

test('parseCookieHeader extracts named cookies cleanly', () => {
  const parsed = parseCookieHeader('foo=bar; campus_session=abc.123%3D; empty=');
  assert.equal(parsed.foo, 'bar');
  assert.equal(parsed.campus_session, 'abc.123=');
  assert.equal(parsed.empty, '');
});
