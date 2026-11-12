import { config } from '../config/env.js';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function captchaError(message, code = 'CAPTCHA_FAILED') {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

/**
 * Validate a Cloudflare Turnstile token server-side.
 * The official test secret is intentionally accepted without a network call so
 * local development and automated tests remain deterministic. Production uses
 * a real secret and always hits Cloudflare's Siteverify endpoint.
 */
export async function verifyCaptcha(token, remoteIp) {
  if (typeof token !== 'string' || !token.trim()) {
    throw captchaError('Captcha verification is required', 'CAPTCHA_REQUIRED');
  }

  if (config.isTest) {
    if (token.trim() === 'test-captcha') return;
    throw captchaError('Captcha verification failed');
  }

  if (!config.turnstileSecretKey) {
    const err = new Error('Captcha is not configured');
    err.status = 503;
    err.code = 'CAPTCHA_NOT_CONFIGURED';
    throw err;
  }

  // The official test secret always passes, so it must never be usable in
  // production even if it was copied there by mistake.
  if (config.turnstileSecretKey === config.turnstileTestSecretKey) {
    if (config.isProduction) {
      const err = new Error('Captcha is not configured with production keys');
      err.status = 503;
      err.code = 'CAPTCHA_NOT_CONFIGURED';
      throw err;
    }
    return;
  }

  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: config.turnstileSecretKey,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {})
      })
    });
  } catch (err) {
    const verificationError = new Error('Captcha verification service is unavailable');
    verificationError.status = 502;
    verificationError.code = 'CAPTCHA_UNAVAILABLE';
    throw verificationError;
  }

  if (!response.ok) {
    const verificationError = new Error('Captcha verification service is unavailable');
    verificationError.status = 502;
    verificationError.code = 'CAPTCHA_UNAVAILABLE';
    throw verificationError;
  }

  const result = await response.json().catch(() => null);
  if (!result?.success) {
    throw captchaError('Captcha verification failed');
  }
}
