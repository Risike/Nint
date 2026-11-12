import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { isProfileIconValue } from '../config/profileIcons.js';
import { DEFAULT_THEME } from '../config/shopThemes.js';
import { DEFAULT_THEME_PALETTE, THEME_PALETTES } from '../config/themePalettes.js';

export const SHOP_KINDS = new Set(['piece_skin', 'name_color', 'name_decoration', 'profile_icon', 'title', 'theme']);
export const PIECE_SKIN_VALUES = [
  'classic', 'neon', 'glass', 'pixel', 'candy',
  'retro', 'metallic', 'holographic', 'mosaic', 'circuit',
  'gradient', 'checker', 'striped', 'glossy', 'matte',
  'gem', 'wood', 'marble', 'carbon', 'ice',
  'round_classic', 'round_neon', 'round_glass', 'round_candy', 'round_metallic',
  'round_gem', 'round_glow', 'round_marble', 'round_ice', 'round_wood',
  'round_holographic', 'round_striped', 'round_checker', 'round_mosaic', 'round_carbon',
  'round_gradient', 'round_glossy', 'round_matte', 'round_pearl', 'round_planet'
];
export const NON_CREATABLE_SHOP_KINDS = new Set(['piece_skin']);
export const NAME_DECORATION_VALUES = [
  'none', 'glow', 'underline', 'brackets', 'sparkle',
  'double_underline', 'overline', 'shadow', 'outline', 'pill', 'box',
  'dots', 'wave', 'angles', 'stars', 'diamonds', 'arrows',
  'brackets_square', 'parentheses', 'highlight',
  'quotes', 'guillemets', 'corner', 'corner_double', 'braces', 'chevrons_double',
  'tildes', 'pipes', 'slashes', 'plus_signs', 'equals', 'hashes', 'at_sign',
  'music', 'hearts', 'lightning', 'flames', 'flowers', 'moons', 'crystals',
  'target', 'crowns', 'wings', 'ribbon', 'gold_frame', 'emboss',
  'glitch', 'dashed_line', 'orbit', 'terminal'
];
const NAME_DECORATION_VALUE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
export const GRADIENT_COLOR_PATTERN = /^gradient:(?:[0-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9]):#[0-9a-f]{6}(?:,#[0-9a-f]{6}){1,5}$/i;
const THEME_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{2,47}$/;
const THEME_MODES = new Set(['dark', 'light']);
const THEME_COLOR_FIELDS = [
  'bgPrimary', 'bgSecondary', 'bgTertiary', 'bgCard', 'borderColor', 'borderFocus',
  'textPrimary', 'textSecondary', 'textMuted', 'accentCyan', 'accentBlue',
  'accentPurple', 'accentPink', 'accentGreen', 'accentOrange', 'accentRed', 'accentYellow'
];
const CSS_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

function parseThemePalette(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeThemePalette(value, fallback = DEFAULT_THEME_PALETTE) {
  const source = parseThemePalette(value) || {};
  const palette = {};
  for (const field of THEME_COLOR_FIELDS) {
    const color = String(source[field] ?? fallback[field] ?? '').trim();
    if (!CSS_COLOR_PATTERN.test(color)) {
      throw httpError(400, `Invalid theme color: ${field}`);
    }
    palette[field] = color.toLowerCase();
  }
  const shadow = String(source.shadow ?? fallback.shadow ?? '').trim();
  if (!shadow || shadow.length > 300 || /[;{}<>]/i.test(shadow)) {
    throw httpError(400, 'Invalid theme shadow');
  }
  palette.shadow = shadow;
  return palette;
}

function isActiveThemeValue(db, value) {
  return typeof value === 'string' && Boolean(db.prepare(
    "SELECT 1 FROM shop_items WHERE kind = 'theme' AND value = ? AND active = 1"
  ).get(value));
}

function isActiveNameDecoration(db, value) {
  return typeof value === 'string' && Boolean(db.prepare(
    "SELECT 1 FROM shop_items WHERE kind = 'name_decoration' AND value = ? AND active = 1"
  ).get(value));
}

export function normalizeNameColor(value) {
  const color = String(value || '').trim().toLowerCase();
  return HEX_COLOR_PATTERN.test(color) || GRADIENT_COLOR_PATTERN.test(color) ? color : null;
}

export const DEFAULT_COSMETICS = {
  piece_skin: 'classic',
  name_color: '#f8fafc',
  name_decoration: 'none',
  profile_icon: 'user',
  title: '',
  theme: DEFAULT_THEME
};

const COSMETIC_COLUMNS = {
  piece_skin: 'piece_skin',
  name_color: 'name_color',
  name_decoration: 'name_decoration',
  profile_icon: 'profile_icon',
  title: 'title',
  theme: 'theme'
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeCosmetics(row, db) {
  return {
    piece_skin: PIECE_SKIN_VALUES.includes(row?.piece_skin) ? row.piece_skin : DEFAULT_COSMETICS.piece_skin,
    name_color: normalizeNameColor(row?.name_color) || DEFAULT_COSMETICS.name_color,
    name_decoration: isActiveNameDecoration(db, row?.name_decoration)
      ? row.name_decoration
      : DEFAULT_COSMETICS.name_decoration,
    profile_icon: isProfileIconValue(row?.profile_icon)
      ? row.profile_icon
      : DEFAULT_COSMETICS.profile_icon,
    title: typeof row?.title === 'string' ? row.title.slice(0, 40) : DEFAULT_COSMETICS.title,
    theme: isActiveThemeValue(db, row?.theme) ? row.theme : DEFAULT_COSMETICS.theme
  };
}

export function getUserCosmetics(db, userId) {
  const row = db.prepare(`
    SELECT piece_skin, name_color, name_decoration, profile_icon, title, theme
    FROM user_cosmetics WHERE user_id = ?
  `).get(userId);
  return normalizeCosmetics(row, db);
}

export function ensureUserShop(db, userId) {
  const now = Date.now();
  db.prepare(`
    INSERT OR IGNORE INTO user_cosmetics (user_id, updated_at) VALUES (?, ?)
  `).run(userId, now);
  db.prepare(`
    INSERT OR IGNORE INTO user_shop_items (user_id, item_id, purchased_at)
    SELECT ?, id, ? FROM shop_items WHERE is_default = 1 AND active = 1
  `).run(userId, now);
}

function normalizeItemInput(data = {}, existing = null) {
  const kind = data.kind !== undefined ? data.kind : existing?.kind;
  if (typeof kind !== 'string' || !SHOP_KINDS.has(kind)) {
    throw httpError(400, 'Invalid shop item type');
  }

  let name = String(data.name !== undefined ? data.name : existing?.name || '').trim();

  const localizedNames = {};
  for (const field of ['name_fr', 'name_de', 'name_es', 'name_it']) {
    const source = data[field] !== undefined ? data[field] : existing?.[field] ?? '';
    const localizedName = String(source ?? '').trim();
    if (localizedName.length > 48) {
      throw httpError(400, 'Localized item name must be at most 48 characters');
    }
    localizedNames[field] = localizedName;
  }

  const description = '';

  let value = String(data.value !== undefined ? data.value : existing?.value || '').trim();
  if (kind === 'piece_skin') {
    if (!PIECE_SKIN_VALUES.includes(value)) {
      throw httpError(400, 'Invalid piece skin value');
    }
  } else if (kind === 'name_color') {
    const normalizedColor = normalizeNameColor(value);
    if (!normalizedColor) {
      throw httpError(400, 'Name color must be a six-digit hex color or a gradient');
    }
    value = normalizedColor;
  } else if (kind === 'name_decoration') {
    if (existing && value && value !== existing.value) {
      throw httpError(400, 'Name decoration value cannot be changed');
    }
    if (!value) {
      value = `custom_${crypto.randomUUID().slice(0, 8)}`;
    }
    if (!NAME_DECORATION_VALUE_PATTERN.test(value)) {
      throw httpError(400, 'Name decoration value must use lowercase letters, numbers, dashes and underscores');
    }
  } else if (kind === 'profile_icon') {
    if (!isProfileIconValue(value)) {
      throw httpError(400, 'Invalid profile icon value');
    }
    if (!name) name = value;
  } else if (kind === 'title') {
    if (value.length < 1 || value.length > 40) {
      throw httpError(400, 'Title must be between 1 and 40 characters');
    }
  } else if (kind === 'theme') {
    if (existing && value && value !== existing.value) {
      throw httpError(400, 'Theme value cannot be changed');
    }
    if (!value) {
      value = `custom-${crypto.randomUUID().slice(0, 8)}`;
    }
    if (!THEME_VALUE_PATTERN.test(value)) {
      throw httpError(400, 'Theme value must use lowercase letters, numbers and dashes');
    }
  }

  if (kind !== 'profile_icon' && (name.length < 2 || name.length > 48)) {
    throw httpError(400, 'Item name must be between 2 and 48 characters');
  }

  const price = Number(data.price !== undefined ? data.price : existing?.price ?? 0);
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
    throw httpError(400, 'Price must be a non-negative integer');
  }

  const rawSortOrder = data.sort_order !== undefined
    ? data.sort_order
    : data.sortOrder !== undefined
      ? data.sortOrder
      : existing?.sort_order ?? 0;
  const sortOrder = Number(rawSortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < -10_000 || sortOrder > 10_000) {
    throw httpError(400, 'Sort order must be an integer between -10000 and 10000');
  }

  const active = data.active !== undefined
    ? (data.active ? 1 : 0)
    : (existing?.active ?? 1);

  let html = kind === 'name_decoration'
    ? String(data.html !== undefined ? data.html : existing?.html || '').trim()
    : '';
  if (html.length > 2000) {
    throw httpError(400, 'Name decoration HTML must be at most 2000 characters');
  }
  if (kind === 'name_decoration' && html && !html.includes('{name}')) {
    throw httpError(400, 'Name decoration HTML must include {name}');
  }
  if (kind === 'name_decoration' && !html && !existing) {
    html = '{name}';
  }

  const mode = kind === 'theme'
    ? String(data.mode !== undefined ? data.mode : existing?.mode ?? 'dark').trim()
    : (existing?.mode ?? 'dark');
  if (kind === 'theme' && !THEME_MODES.has(mode)) {
    throw httpError(400, 'Invalid theme mode');
  }
  const paletteFallback = parseThemePalette(existing?.palette) || DEFAULT_THEME_PALETTE;
  const palette = kind === 'theme'
    ? normalizeThemePalette(
      data.palette !== undefined ? data.palette : paletteFallback,
      paletteFallback
    )
    : null;

  return { kind, name, ...localizedNames, description, value, mode, palette, html, price, active, sort_order: sortOrder };
}

export class ShopService {
  static getShop(userId) {
    const db = getDatabase();
    ensureUserShop(db, userId);

    const user = db.prepare('SELECT COALESCE(credits, 0) AS credits FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }

    const cosmetics = getUserCosmetics(db, userId);
    const owned = new Set(
      db.prepare('SELECT item_id FROM user_shop_items WHERE user_id = ?').all(userId).map((row) => row.item_id)
    );
    const items = db.prepare(`
      SELECT id, kind, name, name_fr, name_de, name_es, name_it, description, value, mode, palette, html, price, is_default, active, sort_order
      FROM shop_items
      WHERE active = 1
      ORDER BY sort_order ASC, name ASC
    `).all().map((item) => {
      const { palette, ...rest } = item;
      return {
        ...rest,
        palette: item.kind === 'theme'
          ? parseThemePalette(palette) || THEME_PALETTES[item.value] || null
          : null,
        owned: owned.has(item.id),
        equipped: this.isEquipped(item, cosmetics)
      };
    });

    return { credits: user.credits, cosmetics, items };
  }

  static getThemes() {
    const db = getDatabase();
    return db.prepare(`
      SELECT value, mode, name, name_fr, name_de, name_es, name_it, palette
      FROM shop_items
      WHERE kind = 'theme' AND active = 1
      ORDER BY sort_order ASC, name ASC
    `).all().map((row) => ({
      value: row.value,
      mode: row.mode === 'light' ? 'light' : 'dark',
      labels: {
        en: row.name,
        fr: row.name_fr || row.name,
        de: row.name_de || row.name,
        es: row.name_es || row.name,
        it: row.name_it || row.name
      },
      preview: parseThemePalette(row.palette) || THEME_PALETTES[row.value] || DEFAULT_THEME_PALETTE
    }));
  }

  static getDecorations() {
    const db = getDatabase();
    return db.prepare(`
      SELECT value, name, name_fr, name_de, name_es, name_it, html
      FROM shop_items
      WHERE kind = 'name_decoration' AND active = 1
      ORDER BY sort_order ASC, name ASC
    `).all().map((row) => ({
      value: row.value,
      labels: {
        en: row.name,
        fr: row.name_fr || row.name,
        de: row.name_de || row.name,
        es: row.name_es || row.name,
        it: row.name_it || row.name
      },
      html: typeof row.html === 'string' ? row.html : ''
    }));
  }

  static isEquipped(item, cosmetics) {
    if (item.kind === 'piece_skin') return cosmetics.piece_skin === item.value;
    if (item.kind === 'name_color') return cosmetics.name_color === item.value;
    if (item.kind === 'name_decoration') return cosmetics.name_decoration === item.value;
    if (item.kind === 'profile_icon') return cosmetics.profile_icon === item.value;
    if (item.kind === 'title') return cosmetics.title === item.value;
    if (item.kind === 'theme') return cosmetics.theme === item.value;
    return false;
  }

  static purchase(userId, itemId) {
    const db = getDatabase();
    ensureUserShop(db, userId);

    if (typeof itemId !== 'string' || itemId.length === 0) {
      throw httpError(400, 'itemId is required');
    }

    const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
    if (!item) {
      throw httpError(404, 'Shop item not found');
    }
    if (!item.active) {
      throw httpError(400, 'This shop item is not available');
    }
    if (item.is_default) {
      throw httpError(400, 'This item is already owned');
    }
    if (db.prepare('SELECT 1 FROM user_shop_items WHERE user_id = ? AND item_id = ?').get(userId, itemId)) {
      throw httpError(409, 'This item is already owned');
    }

    const purchase = db.transaction(() => {
      const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw httpError(401, 'Account no longer exists');
      }
      if ((user.credits ?? 0) < item.price) {
        throw httpError(400, 'Not enough credits');
      }

      const now = Date.now();
      const charged = db.prepare(`
        UPDATE users SET credits = credits - ?, updated_at = ?
        WHERE id = ? AND credits >= ?
      `).run(item.price, now, userId, item.price);
      if (charged.changes === 0) {
        throw httpError(400, 'Not enough credits');
      }

      try {
        db.prepare(`
          INSERT INTO user_shop_items (user_id, item_id, purchased_at) VALUES (?, ?, ?)
        `).run(userId, itemId, now);
      } catch (err) {
        if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
          throw httpError(409, 'This item is already owned');
        }
        throw err;
      }

      return db.prepare('SELECT credits FROM users WHERE id = ?').get(userId).credits;
    });

    const credits = purchase();
    return {
      success: true,
      credits,
      item: { ...item, owned: true, equipped: false }
    };
  }

  static equip(userId, itemId) {
    const db = getDatabase();
    ensureUserShop(db, userId);

    if (typeof itemId !== 'string' || itemId.length === 0) {
      throw httpError(400, 'itemId is required');
    }

    const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
    if (!item || !item.active) {
      throw httpError(404, 'Shop item not found');
    }
    if (!db.prepare('SELECT 1 FROM user_shop_items WHERE user_id = ? AND item_id = ?').get(userId, itemId)) {
      throw httpError(403, 'You do not own this item');
    }

    const column = COSMETIC_COLUMNS[item.kind];
    if (!column) {
      throw httpError(400, 'Invalid shop item type');
    }

    const now = Date.now();
    db.prepare(`
      UPDATE user_cosmetics SET ${column} = ?, updated_at = ? WHERE user_id = ?
    `).run(item.value, now, userId);
    if (item.kind === 'theme') {
      db.prepare('UPDATE user_settings SET theme = ?, updated_at = ? WHERE user_id = ?')
        .run(item.value, now, userId);
    }

    return { success: true, cosmetics: getUserCosmetics(db, userId) };
  }

  static listAdminItems() {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, kind, name, name_fr, name_de, name_es, name_it, description, value, mode, palette, html, price, is_default, active, sort_order, created_at, updated_at
      FROM shop_items
      ORDER BY kind ASC, sort_order ASC, name ASC
    `).all().map((item) => ({
      ...item,
      palette: item.kind === 'theme'
        ? parseThemePalette(item.palette) || THEME_PALETTES[item.value] || DEFAULT_THEME_PALETTE
        : null
    }));
  }

  static createItem(data) {
    const db = getDatabase();
    const item = normalizeItemInput(data);
    if (NON_CREATABLE_SHOP_KINDS.has(item.kind)) {
      throw httpError(400, 'New items cannot be added to this category');
    }
    if (item.kind === 'profile_icon' && db.prepare(
      'SELECT 1 FROM shop_items WHERE kind = ? AND value = ?'
    ).get('profile_icon', item.value)) {
      throw httpError(409, 'This profile icon already exists');
    }
    if (item.kind === 'theme' && db.prepare(
      'SELECT 1 FROM shop_items WHERE kind = ? AND value = ?'
    ).get('theme', item.value)) {
      throw httpError(409, 'This theme value already exists');
    }
    if (item.kind === 'name_decoration' && db.prepare(
      'SELECT 1 FROM shop_items WHERE kind = ? AND value = ?'
    ).get('name_decoration', item.value)) {
      throw httpError(409, 'This name decoration value already exists');
    }
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO shop_items (
        id, kind, name, name_fr, name_de, name_es, name_it, description, value, mode, palette, html, price, is_default, active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      id, item.kind, item.name, item.name_fr, item.name_de, item.name_es, item.name_it,
      item.description, item.value, item.mode, item.palette ? JSON.stringify(item.palette) : '', item.html,
      item.price, item.active, item.sort_order, now, now
    );

    return db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
  }

  static updateItem(itemId, data) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
    if (!existing) {
      throw httpError(404, 'Shop item not found');
    }
    if (existing.is_default && existing.kind !== 'theme' && existing.kind !== 'name_decoration') {
      throw httpError(400, 'Default shop items cannot be modified');
    }
    if (existing.kind === 'profile_icon') {
      const changedFields = Object.keys(data || {});
      if (changedFields.some((field) => field !== 'price')) {
        throw httpError(400, 'Only the price of a profile icon can be modified');
      }
      const price = Number(data?.price);
      if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
        throw httpError(400, 'Price must be a non-negative integer');
      }
      db.prepare('UPDATE shop_items SET price = ?, updated_at = ? WHERE id = ?')
        .run(price, Date.now(), itemId);
      return db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
    }

    const item = normalizeItemInput(data, existing);
    db.prepare(`
      UPDATE shop_items SET
        kind = ?, name = ?, name_fr = ?, name_de = ?, name_es = ?, name_it = ?,
        description = ?, value = ?, mode = ?, palette = ?, html = ?, price = ?, active = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      item.kind, item.name, item.name_fr, item.name_de, item.name_es, item.name_it,
      item.description, item.value, item.mode, item.palette ? JSON.stringify(item.palette) : '', item.html,
      item.price, item.active, item.sort_order, Date.now(), itemId
    );

    return db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
  }

  static deleteItem(itemId) {
    const db = getDatabase();
    const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
    if (!item) {
      throw httpError(404, 'Shop item not found');
    }
    if (item.is_default) {
      throw httpError(400, 'Default shop items cannot be deleted');
    }

    const remove = db.transaction(() => {
      const column = COSMETIC_COLUMNS[item.kind];
      if (column) {
        const fallback = DEFAULT_COSMETICS[column];
        const now = Date.now();
        db.prepare(`
          UPDATE user_cosmetics SET ${column} = ?, updated_at = ? WHERE ${column} = ?
        `).run(fallback, now, item.value);
        if (column === 'theme') {
          db.prepare('UPDATE user_settings SET theme = ?, updated_at = ? WHERE theme = ?')
            .run(fallback, now, item.value);
        }
      }
      db.prepare('DELETE FROM user_shop_items WHERE item_id = ?').run(itemId);
      db.prepare('DELETE FROM shop_items WHERE id = ?').run(itemId);
    });
    remove();

    return { success: true };
  }
}
