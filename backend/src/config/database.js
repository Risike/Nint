import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from './env.js';

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
  }
  return dbInstance;
}

export function initSchema(db = getDatabase()) {
  const schemaPath = path.resolve(__dirname, '../models/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Dynamic migrations for existing databases
  try {
    const matchHistoryCols = db.pragma('table_info(match_history)').map(c => c.name);
    if (!matchHistoryCols.includes('rating_change')) {
      db.exec('ALTER TABLE match_history ADD COLUMN rating_change INTEGER DEFAULT 0');
    }
    if (!matchHistoryCols.includes('new_rating')) {
      db.exec('ALTER TABLE match_history ADD COLUMN new_rating INTEGER');
    }
    if (!matchHistoryCols.includes('opponent_rating')) {
      db.exec('ALTER TABLE match_history ADD COLUMN opponent_rating INTEGER');
    }
  } catch (e) {
    // Ignore migration error if table does not exist yet (will be created by schemaSql)
  }

  try {
    const userCols = db.pragma('table_info(users)').map(c => c.name);
    if (!userCols.includes('is_admin')) {
      db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
    }

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
    console.error('Migration error for admin schema:', e);
  }
}

export function ensureAdminAccount(db = getDatabase()) {
  try {
    const existing = db.prepare("SELECT id FROM users WHERE email = 'admin@nint.nint'").get();
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('admin123', salt);
      const id = crypto.randomUUID();
      const now = Date.now();

      const createAdmin = db.transaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
        `).run(id, 'admin@nint.nint', passwordHash, 'Admin', now, now);

        db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(id, now);
        db.prepare('INSERT INTO user_statistics (user_id, updated_at) VALUES (?, ?)').run(id, now);
      });
      createAdmin();
      console.log('[ADMIN] Default admin account created: admin@nint.nint');
    } else {
      db.prepare("UPDATE users SET is_admin = 1 WHERE email = 'admin@nint.nint'").run();
    }
  } catch (e) {
    console.error('Failed to ensure admin account:', e);
  }
}

// Support CLI migration execution
if (process.argv.includes('--migrate')) {
  console.log(`Migrating SQLite database at ${config.databasePath}...`);
  const db = getDatabase();
  console.log('Database migrated successfully!');
  db.close();
}
