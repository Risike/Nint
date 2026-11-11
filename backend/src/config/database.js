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
    ensureColumn(db, 'users', 'credits', 'INTEGER NOT NULL DEFAULT 0');
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

    seedShopItems(db);
  } catch (e) {
    console.error('Migration error:', e);
  }
}

const TITLE_SEEDS = [
  ['title_block_baron', 'Block Baron', 45],
  ['title_grid_guardian', 'Grid Guardian', 50],
  ['title_drop_sage', 'Drop Sage', 55],
  ['title_neon_knight', 'Neon Knight', 60],
  ['title_pixel_prince', 'Pixel Prince', 65],
  ['title_clear_captain', 'Clear Captain', 70],
  ['title_spin_specialist', 'Spin Specialist', 75],
  ['title_perfect_clearer', 'Perfect Clearer', 80],
  ['title_b2b_boss', 'Back-to-Back Boss', 85],
  ['title_tspin_tactician', 'T-Spin Tactician', 90],
  ['title_quad_crusher', 'Quad Crusher', 95],
  ['title_combo_maestro', 'Combo Maestro', 100],
  ['title_speed_demon', 'Speed Demon', 105],
  ['title_endless_wanderer', 'Endless Wanderer', 110],
  ['title_marathoner', 'Marathoner', 115],
  ['title_sprint_striker', 'Sprint Striker', 120],
  ['title_ultra_survivor', 'Ultra Survivor', 125],
  ['title_casual_champion', 'Casual Champion', 130],
  ['title_ranked_rebel', 'Ranked Rebel', 135],
  ['title_arena_ace', 'Arena Ace', 140],
  ['title_lobby_legend', 'Lobby Legend', 145],
  ['title_rookie_rocket', 'Rookie Rocket', 150],
  ['title_veteran_vector', 'Veteran Vector', 155],
  ['title_elite_element', 'Elite Element', 160],
  ['title_master_mind', 'Master Mind', 165],
  ['title_grandmaster', 'Grandmaster', 170],
  ['title_apex_player', 'Apex Player', 175],
  ['title_top_talent', 'Top Talent', 180],
  ['title_star_seeker', 'Star Seeker', 185],
  ['title_moon_melter', 'Moon Melter', 190],
  ['title_solar_flare', 'Solar Flare', 195],
  ['title_cosmic_cubist', 'Cosmic Cubist', 200],
  ['title_gravity_guru', 'Gravity Guru', 205],
  ['title_stack_strategist', 'Stack Strategist', 210],
  ['title_well_warden', 'Well Warden', 215],
  ['title_line_launcher', 'Line Launcher', 220],
  ['title_block_artist', 'Block Artist', 225],
  ['title_piece_perfectionist', 'Piece Perfectionist', 230],
  ['title_hold_hero', 'Hold Hero', 235],
  ['title_next_navigator', 'Next Navigator', 240],
  ['title_ghost_whisperer', 'Ghost Whisperer', 245],
  ['title_hard_drop_hero', 'Hard Drop Hero', 250],
  ['title_soft_drop_scholar', 'Soft Drop Scholar', 255],
  ['title_level_leader', 'Level Leader', 260]
];

function seedShopItems(db) {
  const now = Date.now();
  const items = [
    ['piece_classic', 'piece_skin', 'Classic', 'classic', 0, 1, 1, 0],
    ['piece_neon', 'piece_skin', 'Neon', 'neon', 50, 0, 1, 10],
    ['piece_glass', 'piece_skin', 'Glass', 'glass', 80, 0, 1, 20],
    ['piece_pixel', 'piece_skin', 'Pixel', 'pixel', 60, 0, 1, 30],
    ['piece_candy', 'piece_skin', 'Candy', 'candy', 90, 0, 1, 40],
    ['piece_retro', 'piece_skin', 'Retro', 'retro', 70, 0, 1, 50],
    ['piece_metallic', 'piece_skin', 'Metallic', 'metallic', 120, 0, 1, 60],
    ['piece_holographic', 'piece_skin', 'Holographic', 'holographic', 180, 0, 1, 70],
    ['piece_mosaic', 'piece_skin', 'Mosaic', 'mosaic', 110, 0, 1, 80],
    ['piece_circuit', 'piece_skin', 'Circuit', 'circuit', 140, 0, 1, 90],
    ['piece_gradient', 'piece_skin', 'Gradient', 'gradient', 90, 0, 1, 100],
    ['piece_checker', 'piece_skin', 'Checker', 'checker', 80, 0, 1, 110],
    ['piece_striped', 'piece_skin', 'Striped', 'striped', 75, 0, 1, 120],
    ['piece_glossy', 'piece_skin', 'Glossy', 'glossy', 100, 0, 1, 130],
    ['piece_matte', 'piece_skin', 'Matte', 'matte', 65, 0, 1, 140],
    ['piece_gem', 'piece_skin', 'Gem', 'gem', 160, 0, 1, 150],
    ['piece_wood', 'piece_skin', 'Wood', 'wood', 85, 0, 1, 160],
    ['piece_marble', 'piece_skin', 'Marble', 'marble', 150, 0, 1, 170],
    ['piece_carbon', 'piece_skin', 'Carbon', 'carbon', 130, 0, 1, 180],
    ['piece_ice', 'piece_skin', 'Ice', 'ice', 105, 0, 1, 190],

    ['color_default', 'name_color', 'White', '#f8fafc', 0, 1, 1, 0],
    ['color_cyan', 'name_color', 'Cyan', '#22d3ee', 20, 0, 1, 10],
    ['color_pink', 'name_color', 'Pink', '#f472b6', 30, 0, 1, 20],
    ['color_gold', 'name_color', 'Gold', '#facc15', 50, 0, 1, 30],
    ['color_green', 'name_color', 'Green', '#4ade80', 25, 0, 1, 40],
    ['color_red', 'name_color', 'Red', '#f87171', 20, 0, 1, 50],
    ['color_orange', 'name_color', 'Orange', '#fb923c', 25, 0, 1, 60],
    ['color_yellow', 'name_color', 'Yellow', '#fde047', 25, 0, 1, 70],
    ['color_lime', 'name_color', 'Lime', '#a3e635', 30, 0, 1, 80],
    ['color_emerald', 'name_color', 'Emerald', '#34d399', 35, 0, 1, 90],
    ['color_teal', 'name_color', 'Teal', '#2dd4bf', 30, 0, 1, 100],
    ['color_sky', 'name_color', 'Sky', '#38bdf8', 35, 0, 1, 110],
    ['color_blue', 'name_color', 'Blue', '#60a5fa', 40, 0, 1, 120],
    ['color_indigo', 'name_color', 'Indigo', '#818cf8', 40, 0, 1, 130],
    ['color_violet', 'name_color', 'Violet', '#a78bfa', 45, 0, 1, 140],
    ['color_purple', 'name_color', 'Purple', '#c084fc', 45, 0, 1, 150],
    ['color_fuchsia', 'name_color', 'Fuchsia', '#e879f9', 50, 0, 1, 160],
    ['color_rose', 'name_color', 'Rose', '#fb7185', 45, 0, 1, 170],
    ['color_silver', 'name_color', 'Silver', '#cbd5e1', 35, 0, 1, 180],
    ['color_lava', 'name_color', 'Lava', '#ff6b35', 60, 0, 1, 190],

    ['decor_none', 'name_decoration', 'None', 'none', 0, 1, 1, 0],
    ['decor_glow', 'name_decoration', 'Glow', 'glow', 40, 0, 1, 10],
    ['decor_underline', 'name_decoration', 'Underline', 'underline', 30, 0, 1, 20],
    ['decor_brackets', 'name_decoration', 'Brackets', 'brackets', 45, 0, 1, 30],
    ['decor_sparkle', 'name_decoration', 'Sparkle', 'sparkle', 60, 0, 1, 40],
    ['decor_double_underline', 'name_decoration', 'Double Underline', 'double_underline', 35, 0, 1, 50],
    ['decor_overline', 'name_decoration', 'Overline', 'overline', 30, 0, 1, 60],
    ['decor_shadow', 'name_decoration', 'Shadow', 'shadow', 35, 0, 1, 70],
    ['decor_outline', 'name_decoration', 'Outline', 'outline', 40, 0, 1, 80],
    ['decor_pill', 'name_decoration', 'Pill', 'pill', 50, 0, 1, 90],
    ['decor_box', 'name_decoration', 'Box', 'box', 45, 0, 1, 100],
    ['decor_dots', 'name_decoration', 'Dotted', 'dots', 30, 0, 1, 110],
    ['decor_wave', 'name_decoration', 'Wave', 'wave', 35, 0, 1, 120],
    ['decor_angles', 'name_decoration', 'Angles', 'angles', 40, 0, 1, 130],
    ['decor_stars', 'name_decoration', 'Stars', 'stars', 50, 0, 1, 140],
    ['decor_diamonds', 'name_decoration', 'Diamonds', 'diamonds', 55, 0, 1, 150],
    ['decor_arrows', 'name_decoration', 'Arrows', 'arrows', 45, 0, 1, 160],
    ['decor_square_brackets', 'name_decoration', 'Square Brackets', 'brackets_square', 35, 0, 1, 170],
    ['decor_parentheses', 'name_decoration', 'Parentheses', 'parentheses', 30, 0, 1, 180],
    ['decor_highlight', 'name_decoration', 'Highlight', 'highlight', 60, 0, 1, 190],

    ['title_none', 'title', 'No Title', '', 0, 1, 1, 0],
    ['title_line_lord', 'title', 'Line Lord', 'Line Lord', 40, 0, 1, 10],
    ['title_zen_master', 'title', 'Zen Master', 'Zen Master', 60, 0, 1, 20],
    ['title_combo_king', 'title', 'Combo King', 'Combo King', 75, 0, 1, 30],
    ['title_tetris_titan', 'title', 'Tetris Titan', 'Tetris Titan', 100, 0, 1, 40],
    ['title_nint_legend', 'title', 'Nint Legend', 'Nint Legend', 250, 0, 1, 50],
    ...TITLE_SEEDS.map(([id, name, price], index) => [
      id, 'title', name, id, price, 0, 1, 60 + index * 10
    ])
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO shop_items (
      id, kind, name, description, value, price, is_default, active, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = db.transaction(() => {
    for (const item of items) {
      const [id, kind, name, value, price, isDefault, active, sortOrder] = item;
      insert.run(id, kind, name, '', value, price, isDefault, active, sortOrder, now, now);
    }
    // Shop items are labels only now; descriptions are intentionally unused.
    db.prepare("UPDATE shop_items SET description = ''").run();
  });
  seed();
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
 * Creates ready-to-use accounts when the API runs in development:
 * `test` and `test2` with 1,000,000 credits, plus an administrator `admin`.
 * All three use an empty password. Never runs in production.
 */
export function ensureDevAccounts(db = getDatabase()) {
  if (config.nodeEnv !== 'development') {
    return;
  }

  const accounts = [
    { username: 'test', email: 'test@nint.local', displayName: 'Test', credits: 1000000 },
    { username: 'test2', email: 'test2@nint.local', displayName: 'Test2', credits: 1000000 },
    { username: 'admin', email: 'admin@nint.local', displayName: 'Admin', isAdmin: true }
  ];

  try {
    for (const account of accounts) {
      // The dedicated seed email always identifies the development account.
      const byEmail = db
        .prepare('SELECT id, username, is_admin, credits FROM users WHERE email = ?')
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
        if (account.credits !== undefined || account.isAdmin) {
          db.prepare(`
            UPDATE users SET
              credits = COALESCE(?, credits),
              is_admin = CASE WHEN ? THEN 1 ELSE is_admin END,
              updated_at = ?
            WHERE id = ?
          `).run(account.credits ?? null, account.isAdmin ? 1 : 0, Date.now(), byEmail.id);
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
          INSERT INTO users (id, email, username, password_hash, display_name, is_admin, credits, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, account.email, account.username, passwordHash, account.displayName,
          account.isAdmin ? 1 : 0, account.credits ?? 0, now, now
        );

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
