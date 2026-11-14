import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

// Cloudflare Turnstile is free and has dedicated always-pass keys for local
// development and automated tests. Production must provide real keys.
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

const EXAMPLE_JWT_SECRET = 'dev-only-change-this-secret';

function resolveJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret) {
    if (isProduction && secret === EXAMPLE_JWT_SECRET) {
      throw new Error('JWT_SECRET still uses the example value from .env.example');
    }
    return secret;
  }
  if (isProduction) {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  // A fixed development secret would let anyone forge a token for any account,
  // so development uses a random key kept outside version control. Persisting
  // it keeps sessions alive across the API's watch restarts.
  if (nodeEnv === 'test') return crypto.randomBytes(32).toString('hex');
  const secretFile = path.resolve(__dirname, '../../data/.dev-jwt-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // No secret yet: create one below.
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  } catch {
    // A read-only checkout still works, it just needs a fresh login per restart.
  }
  return generated;
}

function resolveTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return false;
  if (raw === 'true') return 1;
  if (raw === 'false') return false;
  const hops = Number(raw);
  return Number.isFinite(hops) && hops > 0 ? hops : false;
}

function resolvePort() {
  const parsed = Number.parseInt(process.env.PORT ?? '', 10);
  // PORT=0 means "pick a random port" to Node, which silently breaks the
  // frontend proxy; only accept a real, explicit port.
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 3001;
}

export const config = {
  port: resolvePort(),
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databasePath: process.env.NODE_ENV === 'test'
    ? ':memory:'
    : (process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
        ? process.env.DATABASE_PATH
        : path.resolve(__dirname, '../../data/nint.db')),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  corsOrigin: process.env.CORS_ORIGIN || appBaseUrl,
  trustProxy: resolveTrustProxy(),
  appBaseUrl,
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || (isProduction ? '' : TURNSTILE_TEST_SITE_KEY),
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || (isProduction ? '' : TURNSTILE_TEST_SECRET_KEY),
  turnstileTestSiteKey: TURNSTILE_TEST_SITE_KEY,
  turnstileTestSecretKey: TURNSTILE_TEST_SECRET_KEY,
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'Nint Game <noreply@nint.app>'
};
