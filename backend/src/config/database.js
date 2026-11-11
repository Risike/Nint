import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from './env.js';
import { deriveUsername, ensureUniqueUsername } from '../utils/username.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure database directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database(config.databasePath);
    // WAL mode for superior concurrent read/write performance
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
    ensureAdminAccount(dbInstance);
    ensureDevAccounts(dbInstance);
  }
  return dbInstance;
}

function ensureColumn(db, table, column, definition) {
  const columns = db.pragma(`table_info(${table})`).map((c) => c.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }
  return false;
}

export function initSchema(db = getDatabase()) {
  const schemaPath = path.resolve(__dirname, '../models/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Dynamic migrations for databases created by older versions
  try {
    ensureColumn(db, 'user_settings', 'language', "TEXT DEFAULT 'en'");
    ensureColumn(db, 'users', 'is_admin', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'users', 'token_version', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'users', 'username', 'TEXT');

    // Give existing accounts an identifier before enforcing uniqueness.
    const usersWithoutUsername = db
      .prepare("SELECT id, email, display_name FROM users WHERE username IS NULL OR username = ''")
      .all();
    const setUsername = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    for (const user of usersWithoutUsername) {
      setUsername.run(ensureUniqueUsername(db, deriveUsername(user), user.id), user.id);
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
        ON users(username) WHERE username IS NOT NULL
    `);

    ensureColumn(db, 'match_history', 'rating_change', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'new_rating', 'INTEGER');
    ensureColumn(db, 'match_history', 'opponent_rating', 'INTEGER');
    ensureColumn(db, 'match_history', 'opponent_id', 'TEXT');
    ensureColumn(db, 'match_history', 'match_id', 'TEXT');
    const rankedColumnAdded = ensureColumn(db, 'match_history', 'ranked', 'INTEGER DEFAULT 0');
    if (rankedColumnAdded) {
      // Before ranked mode existed, every online PvP match was ranked.
      // Keep that history on the ELO leaderboard after the upgrade.
      db.exec("UPDATE match_history SET ranked = 1 WHERE opponent_type = 'human' AND match_id IS NOT NULL");
    }
    ensureColumn(db, 'match_history', 'rating_applied', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'pieces_placed', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'tetrises', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 't_spins', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'perfect_clears', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'max_combo', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'match_history', 'max_b2b', 'INTEGER DEFAULT 0');

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_match_history_user_match
        ON match_history(match_id, user_id) WHERE match_id IS NOT NULL
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS site_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    const existingNews = db.prepare("SELECT key FROM site_config WHERE key = 'news_message'").get();
    if (!existingNews) {
      db.prepare("INSERT INTO site_config (key, value, updated_at) VALUES ('news_message', '', ?)").run(Date.now());
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
}

/**
 * Creates (or promotes) the administrator account.
 * Credentials must be provided explicitly through ADMIN_EMAIL / ADMIN_PASSWORD.
 * There is no hard-coded default account.
 */
export function ensureAdminAccount(db = getDatabase()) {
  if (!config.adminEmail) {
    return;
  }

  try {
    const existing = db.prepare('SELECT id, is_admin, username FROM users WHERE email = ?').get(config.adminEmail);

    if (existing) {
      if (!existing.username) {
        db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
          .run(ensureUniqueUsername(db, deriveUsername({ displayName: 'Admin', email: config.adminEmail }), existing.id), Date.now(), existing.id);
      }
      if (existing.is_admin !== 1) {
        db.prepare('UPDATE users SET is_admin = 1, updated_at = ? WHERE id = ?').run(Date.now(), existing.id);
        console.log(`[ADMIN] Promoted configured account: ${config.adminEmail}`);
      }
      return;
    }

    if (!config.adminPassword) {
      console.warn('[ADMIN] ADMIN_EMAIL is set but ADMIN_PASSWORD is missing; no admin account was created.');
      return;
    }

    if (config.adminPassword.length < 12) {
      console.warn('[ADMIN] ADMIN_PASSWORD should be at least 12 characters long.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(config.adminPassword, salt);
    const id = crypto.randomUUID();
    const now = Date.now();
    const username = ensureUniqueUsername(db, deriveUsername({ displayName: 'Admin', email: config.adminEmail }));

    const createAdmin = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, username, password_hash, display_name, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, config.adminEmail, username, passwordHash, 'Admin', now, now);

      db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(id, now);
      db.prepare('INSERT INTO user_statistics (user_id, updated_at) VALUES (?, ?)').run(id, now);
    });
    createAdmin();
    console.log(`[ADMIN] Admin account created: ${config.adminEmail}`);
  } catch (e) {
    console.error('Failed to ensure admin account:', e);
  }
}

/**
 * Creates two ready-to-use accounts when the API runs in development:
 * `test` and `test2`, both with an empty password. Never runs in production.
 */
export function ensureDevAccounts(db = getDatabase()) {
  if (config.nodeEnv !== 'development') {
    return;
  }

  const accounts = [
    { username: 'test', email: 'test@nint.local', displayName: 'Test' },
    { username: 'test2', email: 'test2@nint.local', displayName: 'Test2' }
  ];

  try {
    for (const account of accounts) {
      // The dedicated seed email always identifies the development account.
      const byEmail = db
        .prepare('SELECT id, username FROM users WHERE email = ?')
        .get(account.email);
      if (byEmail) {
        if (byEmail.username !== account.username) {
          const conflict = db
            .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
            .get(account.username, byEmail.id);
          if (!conflict) {
            db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
              .run(account.username, Date.now(), byEmail.id);
          }
        }
        continue;
      }

      // Never overwrite a real account's password: if its identifier collides,
      // move that account to a derived identifier and free the dev username.
      const byUsername = db
        .prepare('SELECT id, email FROM users WHERE username = ?')
        .get(account.username);
      if (byUsername) {
        const fallback = ensureUniqueUsername(db, `${account.username}-account`, byUsername.id);
        db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
          .run(fallback, Date.now(), byUsername.id);
        console.log(`[DEV] Username "${account.username}" was already used by ${byUsername.email}; renamed that account to "${fallback}"`);
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('', salt);
      const id = crypto.randomUUID();
      const now = Date.now();

      const createAccount = db.transaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, username, password_hash, display_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, account.email, account.username, passwordHash, account.displayName, now, now);

        db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(id, now);
        db.prepare('INSERT INTO user_statistics (user_id, updated_at) VALUES (?, ?)').run(id, now);
      });
      createAccount();
      console.log(`[DEV] Created account "${account.username}" with an empty password`);
    }
  } catch (e) {
    console.error('Failed to create development accounts:', e);
  }
}

// Support CLI migration execution
if (process.argv.includes('--migrate')) {
  console.log(`Migrating SQLite database at ${config.databasePath}...`);
  const db = getDatabase();
  console.log('Database migrated successfully!');
  db.close();
}
