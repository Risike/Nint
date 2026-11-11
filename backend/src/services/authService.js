import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { config } from '../config/env.js';
import { sendPasswordResetEmail } from './mailService.js';
import { USERNAME_PATTERN, normalizeUsername, deriveUsername, ensureUniqueUsername } from '../utils/username.js';
import { ensureUserShop, getUserCosmetics } from './shopService.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_AVATAR_URL_LENGTH = 2048;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw httpError(400, 'Invalid email address');
  }
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw httpError(400, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
}

function validateDisplayName(displayName) {
  const name = String(displayName || '').trim();
  if (name.length < 2 || name.length > MAX_DISPLAY_NAME_LENGTH) {
    throw httpError(400, `Display name must be between 2 and ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  return name;
}

function signToken(user) {
  return jwt.sign({ id: user.id, tv: user.token_version ?? 0 }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

export class AuthService {
  static register({ email, password, displayName, username }) {
    const normalizedEmail = normalizeEmail(email);
    validateEmail(normalizedEmail);
    validatePassword(password);
    const name = validateDisplayName(displayName);

    const providedUsername = username !== undefined && username !== null && String(username).trim() !== '';
    const requestedUsername = providedUsername
      ? normalizeUsername(username)
      : deriveUsername({ displayName: name, email: normalizedEmail });

    if (!USERNAME_PATTERN.test(requestedUsername)) {
      throw httpError(400, 'Username must be 3-32 characters using letters, numbers, dots, dashes or underscores');
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      throw httpError(409, 'Email is already registered');
    }

    if (providedUsername) {
      const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(requestedUsername);
      if (taken) {
        throw httpError(409, 'Username is already taken');
      }
    }

    const finalUsername = providedUsername
      ? requestedUsername
      : ensureUniqueUsername(db, requestedUsername);

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = crypto.randomUUID();
    const now = Date.now();

    const insertUser = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, username, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, normalizedEmail, finalUsername, passwordHash, name, now, now);

      db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(id, now);
      db.prepare('INSERT INTO user_statistics (user_id, updated_at) VALUES (?, ?)').run(id, now);
    });

    try {
      insertUser();
    } catch (err) {
      if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
        throw httpError(409, 'Email or username is already registered');
      }
      throw err;
    }

    ensureUserShop(db, id);
    const user = db.prepare('SELECT id, email, username, display_name, avatar_url, is_admin, token_version, credits FROM users WHERE id = ?').get(id);
    const token = signToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        rating: 1000,
        credits: user.credits ?? 0,
        cosmetics: getUserCosmetics(db, id),
        is_admin: false
      },
      token
    };
  }

  static login({ email, identifier, password }) {
    const loginId = normalizeUsername(identifier ?? email);
    if (!loginId || typeof password !== 'string') {
      throw httpError(400, 'Email/username and password are required');
    }

    // Empty passwords only exist for the development seed accounts. Never
    // accept them on a production deployment, even if the database was copied.
    if (password === '' && config.isProduction) {
      throw httpError(401, 'Invalid email/username or password');
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(loginId, loginId);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw httpError(401, 'Invalid email/username or password');
    }

    const token = signToken(user);
    const stats = db.prepare('SELECT rating FROM user_statistics WHERE user_id = ?').get(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        rating: stats?.rating ?? 1000,
        credits: user.credits ?? 0,
        cosmetics: getUserCosmetics(db, user.id),
        is_admin: user.is_admin === 1
      },
      token
    };
  }

  static logout(userId) {
    const db = getDatabase();
    db.prepare('UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?').run(Date.now(), userId);
    return { success: true, message: 'Logged out successfully' };
  }

  static getProfile(userId) {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.created_at, u.is_admin,
             COALESCE(u.credits, 0) as credits, COALESCE(s.rating, 1000) as rating
      FROM users u
      LEFT JOIN user_statistics s ON s.user_id = u.id
      WHERE u.id = ?
    `).get(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }
    return {
      ...user,
      cosmetics: getUserCosmetics(db, userId),
      is_admin: user.is_admin === 1
    };
  }

  static updateProfile(userId, { displayName, avatarUrl, newPassword, currentPassword }) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }

    let tokenVersion = user.token_version ?? 0;

    if (newPassword !== undefined && newPassword !== '') {
      validatePassword(newPassword);
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        throw httpError(400, 'Current password is incorrect');
      }
      const salt = bcrypt.genSaltSync(10);
      const newHash = bcrypt.hashSync(newPassword, salt);
      db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?')
        .run(newHash, Date.now(), userId);
      tokenVersion += 1;
    }

    if (displayName !== undefined || avatarUrl !== undefined) {
      const name = displayName !== undefined ? validateDisplayName(displayName) : user.display_name;
      let avatar = user.avatar_url;
      if (avatarUrl !== undefined) {
        if (avatarUrl === null) {
          avatar = null;
        } else {
          const candidate = String(avatarUrl).trim();
          if (candidate.length > MAX_AVATAR_URL_LENGTH) {
            throw httpError(400, 'Avatar URL is too long');
          }
          if (candidate && !/^https?:\/\//i.test(candidate)) {
            throw httpError(400, 'Avatar URL must be an http(s) URL');
          }
          avatar = candidate || null;
        }
      }
      db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
        .run(name, avatar, Date.now(), userId);
    }

    const profile = this.getProfile(userId);
    if (newPassword !== undefined && newPassword !== '') {
      return { ...profile, token: signToken({ id: userId, token_version: tokenVersion }) };
    }
    return profile;
  }

  static deleteAccount(userId, password) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }
    if (!password || !bcrypt.compareSync(password, user.password_hash)) {
      throw httpError(400, 'Incorrect password');
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return { success: true };
  }

  static async requestPasswordReset(email) {
    const db = getDatabase();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw httpError(400, 'Email is required');
    }

    const user = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      // Don't leak user existence
      return { message: 'If that email exists, a password reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour

    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used = 0').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

    // The reset link is only delivered by email. It is never written to logs.
    sendPasswordResetEmail(user.email, token, user.display_name).catch((err) => {
      console.error('[MAIL] Failed to send password reset email:', err.message);
    });

    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  static confirmPasswordReset({ token, newPassword }) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      throw httpError(400, 'Invalid or expired password reset token');
    }
    validatePassword(newPassword);

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?')
      .get(token, Date.now());
    if (!row) {
      throw httpError(400, 'Invalid or expired password reset token');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);
    const now = Date.now();

    const resetTx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?')
        .run(passwordHash, now, row.user_id);
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
    });
    resetTx();

    return { success: true, message: 'Password has been reset successfully. You can now login.' };
  }
}
