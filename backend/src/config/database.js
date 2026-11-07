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
}

// Support CLI migration execution
if (process.argv.includes('--migrate')) {
  console.log(`Migrating SQLite database at ${config.databasePath}...`);
  const db = getDatabase();
  console.log('Database migrated successfully!');
  db.close();
}
