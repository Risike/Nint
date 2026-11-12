import assert from 'node:assert/strict';
import request from 'supertest';

export const TEST_PASSWORD = 'Str0ng!Pass';
export const TEST_CAPTCHA = 'test-captcha';
export const TEST_VERIFICATION_CODE = '123456';

export async function registerAndVerify(app, {
  email,
  password = TEST_PASSWORD,
  displayName,
  username
}) {
  const resolvedUsername = username
    || String(displayName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 32)
    || 'player';

  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password,
      displayName,
      username: resolvedUsername,
      captchaToken: TEST_CAPTCHA
    });

  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  assert.equal(registration.body.requiresVerification, true);

  const verification = await request(app)
    .post('/api/auth/verify-email')
    .send({ email, code: TEST_VERIFICATION_CODE });

  assert.equal(verification.status, 200, JSON.stringify(verification.body));
  return { token: verification.body.token, user: verification.body.user };
}
