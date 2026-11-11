import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

export const SHOP_KINDS = new Set(['piece_skin', 'name_color', 'name_decoration', 'title']);
export const PIECE_SKIN_VALUES = [
  'classic', 'neon', 'glass', 'pixel', 'candy',
  'retro', 'metallic', 'holographic', 'mosaic', 'circuit',
  'gradient', 'checker', 'striped', 'glossy', 'matte',
  'gem', 'wood', 'marble', 'carbon', 'ice'
];
export const NAME_DECORATION_VALUES = [
  'none', 'glow', 'underline', 'brackets', 'sparkle',
  'double_underline', 'overline', 'shadow', 'outline', 'pill', 'box',
  'dots', 'wave', 'angles', 'stars', 'diamonds', 'arrows',
  'brackets_square', 'parentheses', 'highlight'
];

export const DEFAULT_COSMETICS = {
  piece_skin: 'classic',
  name_color: '#f8fafc',
  name_decoration: 'none',
  title: ''
};

const COSMETIC_COLUMNS = {
  piece_skin: 'piece_skin',
  name_color: 'name_color',
  name_decoration: 'name_decoration',
  title: 'title'
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeCosmetics(row) {
  return {
    piece_skin: PIECE_SKIN_VALUES.includes(row?.piece_skin) ? row.piece_skin : DEFAULT_COSMETICS.piece_skin,
    name_color: /^#[0-9a-f]{6}$/i.test(row?.name_color || '')
      ? row.name_color.toLowerCase()
      : DEFAULT_COSMETICS.name_color,
    name_decoration: NAME_DECORATION_VALUES.includes(row?.name_decoration)
      ? row.name_decoration
      : DEFAULT_COSMETICS.name_decoration,
    title: typeof row?.title === 'string' ? row.title.slice(0, 40) : DEFAULT_COSMETICS.title
  };
}

export function getUserCosmetics(db, userId) {
  const row = db.prepare(`
    SELECT piece_skin, name_color, name_decoration, title
    FROM user_cosmetics WHERE user_id = ?
  `).get(userId);
  return normalizeCosmetics(row);
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

  const name = String(data.name !== undefined ? data.name : existing?.name || '').trim();
  if (name.length < 2 || name.length > 48) {
    throw httpError(400, 'Item name must be between 2 and 48 characters');
  }

  const description = '';

  let value = String(data.value !== undefined ? data.value : existing?.value || '').trim();
  if (kind === 'piece_skin') {
    if (!PIECE_SKIN_VALUES.includes(value)) {
      throw httpError(400, 'Invalid piece skin value');
    }
  } else if (kind === 'name_color') {
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      throw httpError(400, 'Name color must be a six-digit hex color');
    }
    value = value.toLowerCase();
  } else if (kind === 'name_decoration') {
    if (!NAME_DECORATION_VALUES.includes(value)) {
      throw httpError(400, 'Invalid name decoration value');
    }
  } else if (kind === 'title') {
    if (value.length < 1 || value.length > 40) {
      throw httpError(400, 'Title must be between 1 and 40 characters');
    }
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

  return { kind, name, description, value, price, active, sort_order: sortOrder };
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
      SELECT id, kind, name, description, value, price, is_default, active, sort_order
      FROM shop_items
      WHERE active = 1
      ORDER BY sort_order ASC, name ASC
    `).all().map((item) => ({
      ...item,
      owned: owned.has(item.id),
      equipped: this.isEquipped(item, cosmetics)
    }));

    return { credits: user.credits, cosmetics, items };
  }

  static isEquipped(item, cosmetics) {
    if (item.kind === 'piece_skin') return cosmetics.piece_skin === item.value;
    if (item.kind === 'name_color') return cosmetics.name_color === item.value;
    if (item.kind === 'name_decoration') return cosmetics.name_decoration === item.value;
    if (item.kind === 'title') return cosmetics.title === item.value;
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

    db.prepare(`
      UPDATE user_cosmetics SET ${column} = ?, updated_at = ? WHERE user_id = ?
    `).run(item.value, Date.now(), userId);

    return { success: true, cosmetics: getUserCosmetics(db, userId) };
  }

  static listAdminItems() {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, kind, name, description, value, price, is_default, active, sort_order, created_at, updated_at
      FROM shop_items
      ORDER BY kind ASC, sort_order ASC, name ASC
    `).all();
  }

  static createItem(data) {
    const db = getDatabase();
    const item = normalizeItemInput(data);
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO shop_items (
        id, kind, name, description, value, price, is_default, active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      id, item.kind, item.name, item.description, item.value,
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
    if (existing.is_default) {
      throw httpError(400, 'Default shop items cannot be modified');
    }

    const item = normalizeItemInput(data, existing);
    db.prepare(`
      UPDATE shop_items SET
        kind = ?, name = ?, description = ?, value = ?, price = ?,
        active = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      item.kind, item.name, item.description, item.value, item.price,
      item.active, item.sort_order, Date.now(), itemId
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
        db.prepare(`
          UPDATE user_cosmetics SET ${column} = ?, updated_at = ? WHERE ${column} = ?
        `).run(fallback, Date.now(), item.value);
      }
      db.prepare('DELETE FROM user_shop_items WHERE item_id = ?').run(itemId);
      db.prepare('DELETE FROM shop_items WHERE id = ?').run(itemId);
    });
    remove();

    return { success: true };
  }
}
