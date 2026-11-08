import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { config } from '../config/env.js';
import { sendPasswordResetEmail } from './mailService.js';

export class AuthService {
  static register({ email, password, displayName }) {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      const err = new Error('Email is already registered');
      err.status = 409;
      throw err;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = crypto.randomUUID();
    const now = Date.now();

    const insertUser = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, email.toLowerCase().trim(), passwordHash, displayName.trim(), now, now);

      db.prepare(`
        INSERT INTO user_settings (user_id, updated_at)
        VALUES (?, ?)
      `).run(id, now);

      db.prepare(`
        INSERT INTO user_statistics (user_id, updated_at)
        VALUES (?, ?)
      `).run(id, now);
    });

    insertUser();

    const token = jwt.sign({ id, email: email.toLowerCase().trim(), displayName: displayName.trim() }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    return {
      user: { id, email: email.toLowerCase().trim(), displayName: displayName.trim(), rating: 1000 },
      token
    };
  }

  static login({ email, password }) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const token = jwt.sign({ id: user.id, email: user.email, displayName: user.display_name }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    const stats = db.prepare('SELECT rating FROM user_statistics WHERE user_id = ?').get(user.id);
    const rating = stats?.rating ?? 1000;

    return {
      user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, rating, is_admin: user.is_admin === 1 },
      token
    };
  }

  static getProfile(userId) {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT u.id, u.email, u.display_name, u.avatar_url, u.created_at, u.is_admin, COALESCE(s.rating, 1000) as rating
      FROM users u
      LEFT JOIN user_statistics s ON s.user_id = u.id
      WHERE u.id = ?
    `).get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    return {
      ...user,
      is_admin: user.is_admin === 1
    };
  }

  static updateProfile(userId, { displayName, avatarUrl, newPassword, currentPassword }) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    if (newPassword) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        const err = new Error('Current password is incorrect');
        err.status = 400;
        throw err;
      }
      const salt = bcrypt.genSaltSync(10);
      const newHash = bcrypt.hashSync(newPassword, salt);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, Date.now(), userId);
    }

    if (displayName !== undefined || avatarUrl !== undefined) {
      const name = displayName !== undefined ? displayName.trim() : user.display_name;
      const avatar = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
      db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?').run(name, avatar, Date.now(), userId);
    }

    return this.getProfile(userId);
  }

  static deleteAccount(userId, password) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      const err = new Error('Incorrect password');
      err.status = 400;
      throw err;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return { success: true };
  }

  static async requestPasswordReset(email) {
    const db = getDatabase();
    const user = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      // Don't leak user existence
      return { message: 'If that email exists, a password reset link has been sent.' };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour

    // Remove any existing unused tokens for this user
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used = 0').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

    // Development fallback link printed in terminal
    console.log(`\n🔗 [RESET PASSWORD LINK]: ${config.appBaseUrl}/reset-password?token=${token}\n`);

    // Send the reset email (async — don't await to block response)
    sendPasswordResetEmail(user.email, token, user.display_name).catch((err) => {
      console.error('[MAIL] Failed to send password reset email:', err.message);
    });

    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  static confirmPasswordReset({ token, newPassword }) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?').get(token, Date.now());
    if (!row) {
      const err = new Error('Invalid or expired password reset token');
      err.status = 400;
      throw err;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);
    const now = Date.now();

    const resetTx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, row.user_id);
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
    });
    resetTx();

    return { success: true, message: 'Password has been reset successfully. You can now login.' };
  }
}
