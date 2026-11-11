import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { getDatabase } from '../config/database.js';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * Verifies the bearer token, then confirms that the account still exists and
 * that the token has not been revoked (password change, logout, reset).
 */
export function authenticateRequest(req) {
  const token = extractToken(req);
  if (!token) throw httpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw httpError(403, 'Invalid or expired token');
  }

  if (!payload || typeof payload !== 'object' || !payload.id) {
    throw httpError(403, 'Invalid token payload');
  }

  const db = getDatabase();
  const row = db.prepare('SELECT id, token_version, is_admin FROM users WHERE id = ?').get(payload.id);
  if (!row) throw httpError(401, 'Account no longer exists');

  const tokenVersion = payload.tv ?? 0;
  if (tokenVersion !== (row.token_version ?? 0)) {
    throw httpError(401, 'Session has been revoked, please sign in again');
  }

  return { id: row.id, isAdmin: row.is_admin === 1 };
}

export function authenticateToken(req, res, next) {
  try {
    req.user = authenticateRequest(req);
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
}

/**
 * `navigator.sendBeacon` cannot set an Authorization header. The unload-only
 * forfeit route therefore accepts the same short-lived JWT from the JSON body.
 * This fallback is deliberately not enabled on the other API routes.
 */
export function authenticateTokenOrBody(req, res, next) {
  if (!req.headers.authorization && typeof req.body?.token === 'string') {
    req.headers.authorization = `Bearer ${req.body.token}`;
  }
  authenticateToken(req, res, next);
}

export function optionalAuth(req, res, next) {
  try {
    req.user = authenticateRequest(req);
  } catch {
    req.user = null;
  }
  next();
}

export function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}
