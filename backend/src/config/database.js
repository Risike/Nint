import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
}

// Support CLI migration execution
if (process.argv.includes('--migrate')) {
  console.log(`Migrating SQLite database at ${config.databasePath}...`);
  const db = getDatabase();
  console.log('Database migrated successfully!');
  db.close();
}
