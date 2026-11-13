import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from './env.js';
import { deriveUsername, ensureUniqueUsername } from '../utils/username.js';
import { PROFILE_ICONS } from './profileIcons.js';
import { FIXED_COLORS, GRADIENT_COLORS } from './nameColors.js';
import { DEFAULT_THEME, SHOP_THEMES } from './shopThemes.js';
import { DEFAULT_THEME_PALETTE, THEME_PALETTES } from './themePalettes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOP_LOCALIZED_NAMES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'shopLocalizedNames.json'), 'utf8')
);

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
    ensureColumn(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn(db, 'shop_items', 'name_fr', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'shop_items', 'name_de', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'shop_items', 'name_es', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'shop_items', 'name_it', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'shop_items', 'mode', "TEXT NOT NULL DEFAULT 'dark'");
    ensureColumn(db, 'shop_items', 'palette', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'shop_items', 'html', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'user_cosmetics', 'profile_icon', "TEXT NOT NULL DEFAULT 'user'");
    ensureColumn(db, 'user_cosmetics', 'theme', "TEXT NOT NULL DEFAULT 'dark-01'");

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
    ensureColumn(db, 'online_matches', 'mode', "TEXT NOT NULL DEFAULT 'versus'");

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_match_history_match
        ON match_history(match_id)
    `);

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
    applyNameDecorationReplacements(db);
    applyShopPriceTiers(db);
    backfillShopLocalizedNames(db);
    fixShopLocalizedNameTranslations(db);
    applyShopColorPaletteV2(db);
    applyNameColorPaletteV3(db);
    applyShopGoldFrameDecoration(db);
    applyShopThemes(db);
    applyShopThemePalettes(db);
  } catch (e) {
    console.error('Migration error:', e);
  }
}

const SHOP_COLOR_PALETTE_V2 = [
  ['color_mint', 'Mint', '#86efac'],
  ['color_jade', 'Jade', '#15803d'],
  ['color_turquoise', 'Turquoise', '#115e59'],
  ['color_aqua', 'Aqua', '#a5f3fc'],
  ['color_azure', 'Azure', '#93c5fd'],
  ['color_cobalt', 'Cobalt', '#1e40af'],
  ['color_navy', 'Navy', '#075985'],
  ['color_periwinkle', 'Frost', '#7dd3fc'],
  ['color_lavender', 'Lavender', '#c4b5fd'],
  ['color_orchid', 'Orchid', '#f0abfc'],
  ['color_magenta', 'Magenta', '#a21caf'],
  ['color_hot_pink', 'Wine', '#9d174d'],
  ['color_watermelon', 'Watermelon', '#be123c'],
  ['color_salmon', 'Salmon', '#fca5a5'],
  ['color_peach', 'Peach', '#fdba74'],
  ['color_apricot', 'Blush', '#f9a8d4'],
  ['color_amber', 'Chestnut', '#92400e'],
  ['color_bronze', 'Bronze', '#b45309'],
  ['color_sand', 'Sand', '#a16207'],
  ['color_copper', 'Rust', '#c2410c'],
  ['color_honey', 'Grape', '#6b21a8'],
  ['color_ivory', 'Chartreuse', '#bef264'],
  ['color_cream', 'Olive', '#4d7c0f'],
  ['color_slate', 'Slate', '#334155'],
  ['color_steel', 'Pine', '#065f46'],
  ['color_graphite', 'Graphite', '#6b7280'],
  ['color_snow', 'Plum', '#86198f'],
  ['color_cherry', 'Cherry', '#b91c1c'],
  ['color_coral', 'Ruby', '#991b1b'],
  ['color_ocean', 'Ocean', '#0e7490']
];

const SHOP_LEGACY_COLOR_VALUES_V2 = [
  ['color_red', '#dc2626'],
  ['color_yellow', '#fde68a'],
  ['color_indigo', '#4f46e5'],
  ['color_purple', '#9333ea']
];

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

function backfillShopLocalizedNames(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_localized_names_v5'")
    .get();
  if (marker) return;

  const update = db.prepare(`
    UPDATE shop_items SET
      name_fr = CASE WHEN TRIM(COALESCE(name_fr, '')) = '' THEN ? ELSE name_fr END,
      name_de = CASE WHEN TRIM(COALESCE(name_de, '')) = '' THEN ? ELSE name_de END,
      name_es = CASE WHEN TRIM(COALESCE(name_es, '')) = '' THEN ? ELSE name_es END,
      name_it = CASE WHEN TRIM(COALESCE(name_it, '')) = '' THEN ? ELSE name_it END
    WHERE id = ?
      AND TRIM(COALESCE(name_fr, '')) = ''
      AND TRIM(COALESCE(name_de, '')) = ''
      AND TRIM(COALESCE(name_es, '')) = ''
      AND TRIM(COALESCE(name_it, '')) = ''
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('shop_localized_names_v5', '1', ?)
  `);

  const backfill = db.transaction(() => {
    for (const [id, names] of Object.entries(SHOP_LOCALIZED_NAMES)) {
      update.run(names.fr || '', names.de || '', names.es || '', names.it || '', id);
    }
    markDone.run(Date.now());
  });
  backfill();
}

function fixShopLocalizedNameTranslations(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_localized_names_fix_v1'")
    .get();
  if (marker) return;

  // Existing databases had already completed the v5 backfill, so correcting
  // the source JSON alone would leave this default label stale.
  const names = SHOP_LOCALIZED_NAMES.decor_equals;
  if (names) {
    db.prepare(`
      UPDATE shop_items
      SET name_fr = ?, updated_at = ?
      WHERE id = 'decor_equals' AND name_fr = 'Égales'
    `).run(names.fr || '', Date.now());
  }
  db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_localized_names_fix_v1', '1', ?)
  `).run(Date.now());
}

function applyShopPriceTiers(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_price_tiers_v1'")
    .get();
  if (marker) return;

  const prices = [
    ['piece_skin', 1000],
    ['title', 500],
    ['name_color', 400],
    ['name_decoration', 800],
    ['profile_icon', 200],
    ['theme', 1200]
  ];
  const update = db.prepare('UPDATE shop_items SET price = ?, updated_at = ? WHERE kind = ?');
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_price_tiers_v1', '1', ?)
  `);
  const apply = db.transaction(() => {
    const now = Date.now();
    for (const [kind, price] of prices) {
      update.run(price, now, kind);
    }
    markDone.run(now);
  });
  apply();
}

function applyShopColorPaletteV2(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_color_palette_v2'")
    .get();
  if (marker) return;

  const findItem = db.prepare('SELECT value FROM shop_items WHERE id = ?');
  const updateItem = db.prepare(`
    UPDATE shop_items SET
      name = ?, value = ?, name_fr = ?, name_de = ?, name_es = ?, name_it = ?, updated_at = ?
    WHERE id = ?
  `);
  const updateLegacyValue = db.prepare('UPDATE shop_items SET value = ?, updated_at = ? WHERE id = ?');
  const updateCosmetics = db.prepare(
    'UPDATE user_cosmetics SET name_color = ?, updated_at = ? WHERE name_color = ?'
  );
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_color_palette_v2', '1', ?)
  `);

  const apply = db.transaction(() => {
    const now = Date.now();
    for (const [id, name, value] of SHOP_COLOR_PALETTE_V2) {
      const existing = findItem.get(id);
      if (!existing) continue;
      const localized = SHOP_LOCALIZED_NAMES[id] || {};
      updateItem.run(
        name,
        value,
        localized.fr || '',
        localized.de || '',
        localized.es || '',
        localized.it || '',
        now,
        id
      );
      if (existing.value.toLowerCase() !== value.toLowerCase()) {
        updateCosmetics.run(value, now, existing.value);
      }
    }
    for (const [id, value] of SHOP_LEGACY_COLOR_VALUES_V2) {
      const existing = findItem.get(id);
      if (!existing) continue;
      updateLegacyValue.run(value, now, id);
      if (existing.value.toLowerCase() !== value.toLowerCase()) {
        updateCosmetics.run(value, now, existing.value);
      }
    }
    markDone.run(now);
  });
  apply();
}

function applyNameColorPaletteV3(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_color_palette_v3'")
    .get();
  if (marker) return;

  const insert = db.prepare(`
    INSERT INTO shop_items (
      id, kind, name, name_fr, name_de, name_es, name_it, description, value, price,
      is_default, active, sort_order, created_at, updated_at
    ) VALUES (?, 'name_color', ?, ?, ?, ?, ?, '', ?, ?, ?, 1, ?, ?, ?)
  `);
  const removeColors = db.prepare("DELETE FROM shop_items WHERE kind = 'name_color'");
  const resetCosmetics = db.prepare(
    "UPDATE user_cosmetics SET name_color = '#f8fafc', updated_at = ?"
  );
  const grantDefault = db.prepare(`
    INSERT OR IGNORE INTO user_shop_items (user_id, item_id, purchased_at)
    SELECT id, 'color_default', ? FROM users
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_color_palette_v3', '1', ?)
  `);

  const apply = db.transaction(() => {
    const now = Date.now();
    removeColors.run();
    FIXED_COLORS.forEach((color, index) => {
      const isDefault = index === 0 ? 1 : 0;
      insert.run(
        color.id, color.name, color.labels.fr, color.labels.de, color.labels.es, color.labels.it,
        color.value, isDefault ? 0 : 400, isDefault, index * 10, now, now
      );
    });
    GRADIENT_COLORS.forEach((color, index) => {
      insert.run(
        color.id, color.name, color.labels.fr, color.labels.de, color.labels.es, color.labels.it,
        color.value, 400, 0, 200 + index * 10, now, now
      );
    });
    resetCosmetics.run(now);
    grantDefault.run(now);
    markDone.run(now);
  });
  apply();
}

function applyShopThemes(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_themes_v1'")
    .get();
  if (marker) return;

  const insert = db.prepare(`
    INSERT INTO shop_items (
      id, kind, name, name_fr, name_de, name_es, name_it, description, value, mode, palette, price,
      is_default, active, sort_order, created_at, updated_at
    ) VALUES (?, 'theme', ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);
  const removeThemes = db.prepare("DELETE FROM shop_items WHERE kind = 'theme'");
  const resetSettings = db.prepare('UPDATE user_settings SET theme = ?, updated_at = ?');
  const resetCosmetics = db.prepare('UPDATE user_cosmetics SET theme = ?, updated_at = ?');
  const grantDefault = db.prepare(`
    INSERT OR IGNORE INTO user_shop_items (user_id, item_id, purchased_at)
    SELECT id, ?, ? FROM users
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_themes_v1', '1', ?)
  `);
  const defaultTheme = SHOP_THEMES.find((theme) => theme.value === DEFAULT_THEME) || SHOP_THEMES[0];

  const apply = db.transaction(() => {
    const now = Date.now();
    removeThemes.run();
    SHOP_THEMES.forEach((theme, index) => {
      const isDefault = theme.id === defaultTheme.id ? 1 : 0;
      insert.run(
        theme.id, theme.name, theme.labels.fr, theme.labels.de, theme.labels.es, theme.labels.it,
        theme.value, theme.mode, JSON.stringify(THEME_PALETTES[theme.value] || DEFAULT_THEME_PALETTE),
        isDefault ? 0 : 1200, isDefault, index * 10, now, now
      );
    });
    resetSettings.run(DEFAULT_THEME, now);
    resetCosmetics.run(DEFAULT_THEME, now);
    if (defaultTheme) grantDefault.run(defaultTheme.id, now);
    markDone.run(now);
  });
  apply();
}

function applyShopThemePalettes(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_theme_palettes_v1'")
    .get();
  if (marker) return;

  const update = db.prepare(`
    UPDATE shop_items SET mode = ?, palette = ?, updated_at = ?
    WHERE kind = 'theme' AND value = ?
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_theme_palettes_v1', '1', ?)
  `);
  const apply = db.transaction(() => {
    const now = Date.now();
    for (const theme of SHOP_THEMES) {
      update.run(
        theme.mode,
        JSON.stringify(THEME_PALETTES[theme.value] || DEFAULT_THEME_PALETTE),
        now,
        theme.value
      );
    }
    markDone.run(now);
  });
  apply();
}

function applyNameDecorationReplacements(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'name_decorations_v2'")
    .get();
  if (marker) return;

  const replacements = [
    {
      oldId: 'decor_neon_glow', oldValue: 'neon_glow',
      newId: 'decor_ribbon', newValue: 'ribbon', name: 'Ribbon',
      labels: { fr: 'Ruban', de: 'Schleife', es: 'Cinta', it: 'Nastro' }, sortOrder: 430
    },
    {
      oldId: 'decor_strike', oldValue: 'strike',
      newId: 'decor_orbit', newValue: 'orbit', name: 'Orbit',
      labels: { fr: 'Orbite', de: 'Orbit', es: 'Órbita', it: 'Orbita' }, sortOrder: 480
    }
  ];
  const findOld = db.prepare('SELECT id FROM shop_items WHERE id = ?');
  const insertNew = db.prepare(`
    INSERT OR IGNORE INTO shop_items (
      id, kind, name, name_fr, name_de, name_es, name_it, description, value, html,
      price, is_default, active, sort_order, created_at, updated_at
    ) VALUES (?, 'name_decoration', ?, ?, ?, ?, ?, '', ?, '', 800, 0, 1, ?, ?, ?)
  `);
  const updateNew = db.prepare(`
    UPDATE shop_items SET
      name = ?, name_fr = ?, name_de = ?, name_es = ?, name_it = ?, value = ?, updated_at = ?
    WHERE id = ?
  `);
  const transferPurchases = db.prepare(`
    INSERT OR IGNORE INTO user_shop_items (user_id, item_id, purchased_at)
    SELECT user_id, ?, purchased_at FROM user_shop_items WHERE item_id = ?
  `);
  const deleteOldPurchases = db.prepare('DELETE FROM user_shop_items WHERE item_id = ?');
  const deleteOld = db.prepare('DELETE FROM shop_items WHERE id = ?');
  const updateCosmetics = db.prepare(`
    UPDATE user_cosmetics SET name_decoration = ?, updated_at = ? WHERE name_decoration = ?
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('name_decorations_v2', '1', ?)
  `);

  const apply = db.transaction(() => {
    const now = Date.now();
    for (const replacement of replacements) {
      const oldItem = findOld.get(replacement.oldId);
      insertNew.run(
        replacement.newId, replacement.name,
        replacement.labels.fr, replacement.labels.de, replacement.labels.es, replacement.labels.it,
        replacement.newValue, replacement.sortOrder, now, now
      );
      updateNew.run(
        replacement.name,
        replacement.labels.fr, replacement.labels.de, replacement.labels.es, replacement.labels.it,
        replacement.newValue, now, replacement.newId
      );

      updateCosmetics.run(replacement.newValue, now, replacement.oldValue);
      if (oldItem) {
        transferPurchases.run(replacement.newId, replacement.oldId);
        deleteOldPurchases.run(replacement.oldId);
        deleteOld.run(replacement.oldId);
      }
    }
    markDone.run(now);
  });
  apply();
}

function applyShopGoldFrameDecoration(db) {
  const marker = db
    .prepare("SELECT value FROM site_config WHERE key = 'shop_gold_frame_decoration_v1'")
    .get();
  if (marker) return;

  const localized = SHOP_LOCALIZED_NAMES.decor_gradient_fill || {};
  const updateItem = db.prepare(`
    UPDATE shop_items SET
      name = 'Gold Frame', value = 'gold_frame',
      name_fr = ?, name_de = ?, name_es = ?, name_it = ?, updated_at = ?
    WHERE id = 'decor_gradient_fill'
  `);
  const updateCosmetics = db.prepare(`
    UPDATE user_cosmetics SET name_decoration = 'gold_frame', updated_at = ?
    WHERE name_decoration = 'gradient_fill'
  `);
  const markDone = db.prepare(`
    INSERT OR REPLACE INTO site_config (key, value, updated_at)
    VALUES ('shop_gold_frame_decoration_v1', '1', ?)
  `);

  const apply = db.transaction(() => {
    const now = Date.now();
    updateItem.run(localized.fr || '', localized.de || '', localized.es || '', localized.it || '', now);
    updateCosmetics.run(now);
    markDone.run(now);
  });
  apply();
}

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
    ['piece_round_classic', 'piece_skin', 'Round Classic', 'round_classic', 55, 0, 1, 200],
    ['piece_round_neon', 'piece_skin', 'Neon Orb', 'round_neon', 75, 0, 1, 210],
    ['piece_round_glass', 'piece_skin', 'Glass Bubble', 'round_glass', 95, 0, 1, 220],
    ['piece_round_candy', 'piece_skin', 'Candy Drop', 'round_candy', 85, 0, 1, 230],
    ['piece_round_metallic', 'piece_skin', 'Metal Sphere', 'round_metallic', 130, 0, 1, 240],
    ['piece_round_gem', 'piece_skin', 'Gemstone', 'round_gem', 170, 0, 1, 250],
    ['piece_round_glow', 'piece_skin', 'Glow Ball', 'round_glow', 115, 0, 1, 260],
    ['piece_round_marble', 'piece_skin', 'Marble Orb', 'round_marble', 160, 0, 1, 270],
    ['piece_round_ice', 'piece_skin', 'Ice Sphere', 'round_ice', 120, 0, 1, 280],
    ['piece_round_wood', 'piece_skin', 'Wooden Ball', 'round_wood', 100, 0, 1, 290],
    ['piece_round_holographic', 'piece_skin', 'Holo Orb', 'round_holographic', 190, 0, 1, 300],
    ['piece_round_striped', 'piece_skin', 'Striped Sphere', 'round_striped', 90, 0, 1, 310],
    ['piece_round_checker', 'piece_skin', 'Checker Ball', 'round_checker', 95, 0, 1, 320],
    ['piece_round_mosaic', 'piece_skin', 'Mosaic Orb', 'round_mosaic', 135, 0, 1, 330],
    ['piece_round_carbon', 'piece_skin', 'Carbon Sphere', 'round_carbon', 145, 0, 1, 340],
    ['piece_round_gradient', 'piece_skin', 'Gradient Orb', 'round_gradient', 105, 0, 1, 350],
    ['piece_round_glossy', 'piece_skin', 'Glossy Ball', 'round_glossy', 120, 0, 1, 360],
    ['piece_round_matte', 'piece_skin', 'Matte Sphere', 'round_matte', 80, 0, 1, 370],
    ['piece_round_pearl', 'piece_skin', 'Pearl', 'round_pearl', 220, 0, 1, 380],
    ['piece_round_planet', 'piece_skin', 'Planet', 'round_planet', 240, 0, 1, 390],

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
    ['decor_quotes', 'name_decoration', 'Quotes', 'quotes', 800, 0, 1, 200],
    ['decor_guillemets', 'name_decoration', 'Guillemets', 'guillemets', 800, 0, 1, 210],
    ['decor_corner', 'name_decoration', 'Corners', 'corner', 800, 0, 1, 220],
    ['decor_corner_double', 'name_decoration', 'Double Corners', 'corner_double', 800, 0, 1, 230],
    ['decor_braces', 'name_decoration', 'Braces', 'braces', 800, 0, 1, 240],
    ['decor_chevrons_double', 'name_decoration', 'Double Chevrons', 'chevrons_double', 800, 0, 1, 250],
    ['decor_tildes', 'name_decoration', 'Tildes', 'tildes', 800, 0, 1, 260],
    ['decor_pipes', 'name_decoration', 'Pipes', 'pipes', 800, 0, 1, 270],
    ['decor_slashes', 'name_decoration', 'Slashes', 'slashes', 800, 0, 1, 280],
    ['decor_plus_signs', 'name_decoration', 'Plus Signs', 'plus_signs', 800, 0, 1, 290],
    ['decor_equals', 'name_decoration', 'Equals', 'equals', 800, 0, 1, 300],
    ['decor_hashes', 'name_decoration', 'Hashes', 'hashes', 800, 0, 1, 310],
    ['decor_at_sign', 'name_decoration', 'At Signs', 'at_sign', 800, 0, 1, 320],
    ['decor_music', 'name_decoration', 'Music', 'music', 800, 0, 1, 330],
    ['decor_hearts', 'name_decoration', 'Hearts', 'hearts', 800, 0, 1, 340],
    ['decor_lightning', 'name_decoration', 'Lightning', 'lightning', 800, 0, 1, 350],
    ['decor_flames', 'name_decoration', 'Flames', 'flames', 800, 0, 1, 360],
    ['decor_flowers', 'name_decoration', 'Flowers', 'flowers', 800, 0, 1, 370],
    ['decor_moons', 'name_decoration', 'Moons', 'moons', 800, 0, 1, 380],
    ['decor_crystals', 'name_decoration', 'Crystals', 'crystals', 800, 0, 1, 390],
    ['decor_target', 'name_decoration', 'Targets', 'target', 800, 0, 1, 400],
    ['decor_crowns', 'name_decoration', 'Crowns', 'crowns', 800, 0, 1, 410],
    ['decor_wings', 'name_decoration', 'Wings', 'wings', 800, 0, 1, 420],
    ['decor_ribbon', 'name_decoration', 'Ribbon', 'ribbon', 800, 0, 1, 430],
    ['decor_gradient_fill', 'name_decoration', 'Gold Frame', 'gold_frame', 800, 0, 1, 440],
    ['decor_emboss', 'name_decoration', 'Emboss', 'emboss', 800, 0, 1, 450],
    ['decor_glitch', 'name_decoration', 'Glitch', 'glitch', 800, 0, 1, 460],
    ['decor_dashed_line', 'name_decoration', 'Dashed Line', 'dashed_line', 800, 0, 1, 470],
    ['decor_orbit', 'name_decoration', 'Orbit', 'orbit', 800, 0, 1, 480],
    ['decor_terminal', 'name_decoration', 'Terminal', 'terminal', 800, 0, 1, 490],

    ...PROFILE_ICONS.map((icon, index) => [
      `icon_${icon.key}`,
      'profile_icon',
      icon.en,
      icon.key,
      icon.price,
      icon.key === 'user' ? 1 : 0,
      1,
      500 + index * 10
    ]),

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

const DEMO_LAST_INDEX = 100;
const DEMO_CREDITS = 1_000_000;
const DEMO_SOLO_MODES = ['marathon_150', 'sprint_40', 'ultra_3m'];

function demoRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function demoPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function ensureDemoAccount(db, index, now) {
  const username = `demo${index}`;
  const email = `demo${index}@nint.local`;
  const displayName = `Demo ${index}`;
  const byEmail = db
    .prepare('SELECT id, username, display_name FROM users WHERE email = ?')
    .get(email);

  if (byEmail) {
    if (byEmail.username !== username) {
      const conflict = db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .get(username, byEmail.id);
      if (!conflict) {
        db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
          .run(username, now, byEmail.id);
      }
    }
    db.prepare('UPDATE users SET credits = ?, updated_at = ? WHERE id = ?')
      .run(DEMO_CREDITS, now, byEmail.id);
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id, updated_at) VALUES (?, ?)')
      .run(byEmail.id, now);
    db.prepare('INSERT OR IGNORE INTO user_statistics (user_id, updated_at) VALUES (?, ?)')
      .run(byEmail.id, now);
    return { id: byEmail.id, index, username, displayName: byEmail.display_name, created: false };
  }

  const byUsername = db
    .prepare('SELECT id, email FROM users WHERE username = ?')
    .get(username);
  if (byUsername) {
    const fallback = ensureUniqueUsername(db, `${username}-account`, byUsername.id);
    db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
      .run(fallback, now, byUsername.id);
    console.log(`[DEV] Username "${username}" was already used by ${byUsername.email}; renamed that account to "${fallback}"`);
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync('', bcrypt.genSaltSync(10));
  const createAccount = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, display_name, credits, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, username, passwordHash, displayName, DEMO_CREDITS, now, now);
    db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(id, now);
    db.prepare('INSERT INTO user_statistics (user_id, updated_at) VALUES (?, ?)').run(id, now);
  });
  createAccount();
  return { id, index, username, displayName, created: true };
}

function buildDemoSoloResult(rng, mode, index, runIndex, now) {
  const createdAt = now - demoInt(rng, 0, 120) * 86400000 - demoInt(rng, 0, 43200000);
  let lines;
  let duration;
  let level;
  let pieces;
  let score;

  if (mode === 'sprint_40') {
    lines = 40;
    duration = demoInt(rng, 45000, 165000);
    level = demoInt(rng, 4, 15);
    pieces = Math.round(lines * (2.1 + rng() * 0.8));
    score = demoInt(rng, 15000, 75000);
  } else if (mode === 'marathon_150') {
    lines = demoInt(rng, 30, 150);
    duration = Math.max(20000, Math.round(lines * (900 + rng() * 1800)));
    level = demoInt(rng, 1, 20);
    pieces = Math.round(lines * (2.2 + rng() * 0.8));
    score = demoInt(rng, 20000, 450000);
  } else {
    lines = demoInt(rng, 30, 180);
    duration = demoInt(rng, 150000, 180000);
    level = demoInt(rng, 5, 20);
    pieces = Math.round((duration / 1000) * (1.3 + rng() * 1.8));
    score = demoInt(rng, 35000, 300000);
  }

  const durationSec = duration / 1000;
  const tetrises = demoInt(rng, 0, Math.floor(lines / 4));
  const tSpins = demoInt(rng, 0, Math.max(0, Math.floor(lines / 8)));
  const perfectClears = demoInt(rng, 0, Math.min(3, Math.floor(lines / 20)));
  const maxCombo = demoInt(rng, 2, Math.max(3, Math.floor(lines / 4)));
  const maxB2B = demoInt(rng, 0, Math.max(0, Math.floor(tetrises / 2)));

  return {
    id: `demo-${index}-${mode}-${runIndex}`,
    mode,
    score,
    lines,
    level,
    duration,
    pieces,
    pps: Number((pieces / durationSec).toFixed(2)),
    apm: Number(((lines * 60) / durationSec).toFixed(1)),
    tetrises,
    tSpins,
    perfectClears,
    maxCombo,
    maxB2B,
    createdAt
  };
}

function buildDemoMatches(rng, demo, opponent, rating, now) {
  const matches = [];
  const aiCount = demoInt(rng, 2, 6);

  for (let index = 0; index < aiCount; index++) {
    const playerLines = demoInt(rng, 0, 50);
    const playerPieces = Math.round(playerLines * (2 + rng() * 1.5));
    const tetrises = demoInt(rng, 0, Math.floor(playerLines / 4));
    matches.push({
      id: `demo-${demo.index}-ai-${index}`,
      opponentId: null,
      opponentName: `CPU ${demoInt(rng, 1, 20)}`,
      opponentType: 'ai',
      difficulty: demoInt(rng, 2, 10),
      mode: 'versus_1v1',
      matchId: null,
      ranked: 0,
      result: rng() < 0.55 ? 'win' : 'loss',
      playerScore: demoInt(rng, 0, 120000),
      playerLines,
      opponentScore: demoInt(rng, 0, 120000),
      opponentLines: demoInt(rng, 0, 50),
      duration: demoInt(rng, 60000, 360000),
      piecesPlaced: playerPieces,
      tetrises,
      tSpins: demoInt(rng, 0, Math.max(0, Math.floor(playerLines / 8))),
      perfectClears: demoInt(rng, 0, Math.min(2, Math.floor(playerLines / 20))),
      maxCombo: demoInt(rng, 2, Math.max(3, Math.floor(playerLines / 4))),
      maxB2B: demoInt(rng, 0, Math.max(0, Math.floor(tetrises / 2))),
      ratingChange: 0,
      newRating: null,
      opponentRating: null,
      ratingApplied: 0,
      createdAt: now - demoInt(rng, 0, 90) * 86400000 - demoInt(rng, 0, 43200000)
    });
  }

  const rankedResult = rng() < 0.5 ? 'win' : 'loss';
  const rankedLines = demoInt(rng, 10, 80);
  const rankedTetrises = demoInt(rng, 0, Math.floor(rankedLines / 4));
  matches.push({
    id: `demo-${demo.index}-ranked`,
    opponentId: opponent.id,
    opponentName: opponent.displayName,
    opponentType: 'human',
    difficulty: null,
    mode: 'versus_online',
    matchId: `demo-match-${demo.index}`,
    ranked: 1,
    result: rankedResult,
    playerScore: demoInt(rng, 10000, 160000),
    playerLines: rankedLines,
    opponentScore: demoInt(rng, 10000, 160000),
    opponentLines: demoInt(rng, 10, 80),
    duration: demoInt(rng, 90000, 420000),
    piecesPlaced: Math.round(rankedLines * (2 + rng() * 1.5)),
    tetrises: rankedTetrises,
    tSpins: demoInt(rng, 0, Math.max(0, Math.floor(rankedLines / 8))),
    perfectClears: demoInt(rng, 0, Math.min(2, Math.floor(rankedLines / 20))),
    maxCombo: demoInt(rng, 2, Math.max(3, Math.floor(rankedLines / 4))),
    maxB2B: demoInt(rng, 0, Math.max(0, Math.floor(rankedTetrises / 2))),
    ratingChange: rankedResult === 'win' ? demoInt(rng, 4, 28) : -demoInt(rng, 4, 28),
    newRating: rating,
    opponentRating: demoInt(rng, 700, 2200),
    ratingApplied: 1,
    createdAt: now - demoInt(rng, 0, 60) * 86400000 - demoInt(rng, 0, 43200000)
  });

  return matches;
}

function seedDemoAccountData(db, demo, opponent, now) {
  const rng = demoRandom(0x9e3779b9 ^ Math.imul(demo.index + 1, 0x85ebca6b));
  const existing = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM game_results WHERE user_id = ?) AS results,
      (SELECT COUNT(*) FROM match_history WHERE user_id = ?) AS matches
  `).get(demo.id, demo.id);
  const shouldSeedStats = !existing || (existing.results === 0 && existing.matches === 0);

  const allItems = db.prepare(`
    SELECT id, kind, value, is_default FROM shop_items WHERE active = 1
  `).all();
  const cosmeticDefaults = {
    piece_skin: 'classic',
    name_color: '#f8fafc',
    name_decoration: 'none',
    profile_icon: 'user',
    title: ''
  };
  const cosmetics = { ...cosmeticDefaults };
  for (const kind of Object.keys(cosmeticDefaults)) {
    const group = allItems.filter((item) => item.kind === kind);
    const purchased = group.filter((item) => !item.is_default);
    const pool = purchased.length > 0 ? purchased : group;
    if (pool.length > 0) {
      cosmetics[kind] = demoPick(rng, pool).value;
    }
  }

  const seed = db.transaction(() => {
    if (shouldSeedStats) {
      const soloResults = [];
      for (const mode of DEMO_SOLO_MODES) {
        const count = demoInt(rng, 2, 4);
        for (let runIndex = 0; runIndex < count; runIndex++) {
          soloResults.push(buildDemoSoloResult(rng, mode, demo.index, runIndex, now));
        }
      }

      const zenPlaytime = Array.from(
        { length: demoInt(rng, 1, 5) },
        () => demoInt(rng, 120000, 900000)
      ).reduce((total, value) => total + value, 0);
      const rating = demoInt(rng, 700, 2200);
      const matches = buildDemoMatches(rng, demo, opponent, rating, now);

      let totalLines = 0;
      let totalPieces = 0;
      let totalPlaytime = zenPlaytime;
      let totalTetrises = 0;
      let totalTSpins = 0;
      let totalPerfectClears = 0;
      let highestCombo = 0;
      let highestB2B = 0;

      for (const result of soloResults) {
        totalLines += result.lines;
        totalPieces += result.pieces;
        totalPlaytime += result.duration;
        totalTetrises += result.tetrises;
        totalTSpins += result.tSpins;
        totalPerfectClears += result.perfectClears;
        highestCombo = Math.max(highestCombo, result.maxCombo);
        highestB2B = Math.max(highestB2B, result.maxB2B);
      }
      for (const match of matches) {
        totalLines += match.playerLines;
        totalPieces += match.piecesPlaced;
        totalPlaytime += match.duration;
        totalTetrises += match.tetrises;
        totalTSpins += match.tSpins;
        totalPerfectClears += match.perfectClears;
        highestCombo = Math.max(highestCombo, match.maxCombo);
        highestB2B = Math.max(highestB2B, match.maxB2B);
      }

      const wins = matches.filter((match) => match.result === 'win').length;
      const losses = matches.filter((match) => match.result === 'loss').length;

      const insertResult = db.prepare(`
        INSERT INTO game_results (
          id, user_id, mode, score, lines, level, duration,
          pieces_placed, pps, apm, tetrises, t_spins, perfect_clears,
          max_combo, max_b2b, verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);
      for (const result of soloResults) {
        insertResult.run(
          result.id, demo.id, result.mode, result.score, result.lines, result.level,
          result.duration, result.pieces, result.pps, result.apm, result.tetrises,
          result.tSpins, result.perfectClears, result.maxCombo, result.maxB2B, result.createdAt
        );
      }

      const insertMatch = db.prepare(`
        INSERT INTO match_history (
          id, user_id, opponent_id, opponent_name, opponent_type, difficulty,
          mode, match_id, ranked, result, player_score, player_lines,
          opponent_score, opponent_lines, duration, pieces_placed, tetrises,
          t_spins, perfect_clears, max_combo, max_b2b, rating_change,
          new_rating, opponent_rating, rating_applied, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const match of matches) {
        insertMatch.run(
          match.id, demo.id, match.opponentId, match.opponentName, match.opponentType,
          match.difficulty, match.mode, match.matchId, match.ranked, match.result,
          match.playerScore, match.playerLines, match.opponentScore, match.opponentLines,
          match.duration, match.piecesPlaced, match.tetrises, match.tSpins,
          match.perfectClears, match.maxCombo, match.maxB2B, match.ratingChange,
          match.newRating, match.opponentRating, match.ratingApplied, match.createdAt
        );
      }

      const bestByMode = new Map();
      for (const result of soloResults) {
        const current = bestByMode.get(result.mode);
        const better = !current || (result.mode === 'sprint_40'
          ? result.duration < current.duration
          : result.score > current.score);
        if (better) bestByMode.set(result.mode, result);
      }

      const insertBest = db.prepare(`
        INSERT INTO personal_bests (id, user_id, mode, metric, value, achieved_at, result_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, mode, metric) DO UPDATE SET
          value = excluded.value,
          achieved_at = excluded.achieved_at,
          result_id = excluded.result_id
      `);
      for (const [mode, result] of bestByMode.entries()) {
        const metric = mode === 'sprint_40' ? 'time_ms' : 'score';
        const value = metric === 'time_ms' ? result.duration : result.score;
        insertBest.run(
          `demo-${demo.index}-pb-${mode}`, demo.id, mode, metric, value,
          result.createdAt, result.id
        );
      }

      db.prepare(`
        INSERT INTO user_statistics (
          user_id, games_played, wins, losses, total_lines, total_pieces,
          total_playtime_ms, total_tetrises, total_tspins, total_perfect_clears,
          highest_combo, highest_b2b, rating, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          games_played = excluded.games_played,
          wins = excluded.wins,
          losses = excluded.losses,
          total_lines = excluded.total_lines,
          total_pieces = excluded.total_pieces,
          total_playtime_ms = excluded.total_playtime_ms,
          total_tetrises = excluded.total_tetrises,
          total_tspins = excluded.total_tspins,
          total_perfect_clears = excluded.total_perfect_clears,
          highest_combo = excluded.highest_combo,
          highest_b2b = excluded.highest_b2b,
          rating = excluded.rating,
          updated_at = excluded.updated_at
      `).run(
        demo.id, soloResults.length + matches.length, wins, losses,
        totalLines, totalPieces, totalPlaytime, totalTetrises, totalTSpins,
        totalPerfectClears, highestCombo, highestB2B, rating, now
      );
    }

    const purchase = db.prepare(`
      INSERT OR IGNORE INTO user_shop_items (user_id, item_id, purchased_at)
      VALUES (?, ?, ?)
    `);
    for (const item of allItems) {
      purchase.run(demo.id, item.id, now);
    }

    db.prepare(`
      INSERT INTO user_cosmetics (
        user_id, piece_skin, name_color, name_decoration, profile_icon, title, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        piece_skin = excluded.piece_skin,
        name_color = excluded.name_color,
        name_decoration = excluded.name_decoration,
        profile_icon = excluded.profile_icon,
        title = excluded.title,
        updated_at = excluded.updated_at
    `).run(
      demo.id, cosmetics.piece_skin, cosmetics.name_color, cosmetics.name_decoration,
      cosmetics.profile_icon, cosmetics.title, now
    );
  });

  seed();
  return shouldSeedStats;
}

function seedDemoAccounts(db) {
  const now = Date.now();
  const demos = [];
  let created = 0;

  for (let index = 0; index <= DEMO_LAST_INDEX; index++) {
    const demo = ensureDemoAccount(db, index, now);
    if (demo.created) created++;
    demos.push(demo);
  }

  let seeded = 0;
  for (const demo of demos) {
    try {
      const opponent = demos[(demo.index + 1) % demos.length];
      if (seedDemoAccountData(db, demo, opponent, now)) seeded++;
    } catch (e) {
      console.error(`[DEV] Failed to seed demo account ${demo.username}:`, e);
    }
  }

  if (created > 0 || seeded > 0) {
    console.log(`[DEV] Demo accounts ready: demo0-demo${DEMO_LAST_INDEX} (${created} created, ${seeded} seeded)`);
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

    seedDemoAccounts(db);
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
