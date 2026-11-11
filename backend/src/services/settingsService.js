import { getDatabase } from '../config/database.js';

const THEMES = new Set([
  'dark-01', 'dark-02', 'dark-03', 'dark-04', 'dark-05',
  'light-01', 'light-02', 'light-03', 'light-04', 'light-05'
]);
const COLORBLIND_MODES = new Set(['none', 'protanopia', 'deuteranopia', 'tritanopia']);

function clampNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

function safeJson(value) {
  if (value === undefined || value === null) return null;
  try {
    // Accept both an object from the API and a JSON string from the database.
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const serialized = JSON.stringify(parsed);
    return serialized.length > 20000 ? null : serialized;
  } catch {
    return null;
  }
}

export class SettingsService {
  static getSettings(userId) {
    const db = getDatabase();
    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    if (!settings) {
      db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(userId, Date.now());
      settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    }

    for (const key of ['keybindings', 'gamepad_bindings']) {
      if (settings && typeof settings[key] === 'string' && settings[key]) {
        try {
          settings[key] = JSON.parse(settings[key]);
        } catch {
          settings[key] = null;
        }
      }
    }

    return settings;
  }

  static updateSettings(userId, newSettings = {}) {
    const db = getDatabase();
    const current = this.getSettings(userId);

    const requestedTheme = newSettings.theme ?? current.theme;
    const theme = THEMES.has(requestedTheme) ? requestedTheme : current.theme;

    const requestedColorblind = newSettings.colorblind_mode ?? current.colorblind_mode;
    const colorblindMode = COLORBLIND_MODES.has(requestedColorblind) ? requestedColorblind : current.colorblind_mode;

    const merged = {
      theme,
      das: Math.round(clampNumber(newSettings.das, current.das, 0, 500)),
      arr: Math.round(clampNumber(newSettings.arr, current.arr, 0, 200)),
      soft_drop_factor: Math.round(clampNumber(newSettings.soft_drop_factor, current.soft_drop_factor, 1, 60)),
      lock_delay: Math.round(clampNumber(newSettings.lock_delay, current.lock_delay, 0, 5000)),
      sound_volume: clampNumber(newSettings.sound_volume, current.sound_volume, 0, 1),
      music_volume: clampNumber(newSettings.music_volume, current.music_volume, 0, 1),
      keybindings: safeJson(newSettings.keybindings === undefined ? current.keybindings : newSettings.keybindings),
      gamepad_bindings: safeJson(newSettings.gamepad_bindings === undefined ? current.gamepad_bindings : newSettings.gamepad_bindings),
      touch_controls_enabled: newSettings.touch_controls_enabled !== undefined
        ? (newSettings.touch_controls_enabled ? 1 : 0)
        : current.touch_controls_enabled,
      ghost_piece: newSettings.ghost_piece !== undefined
        ? (newSettings.ghost_piece ? 1 : 0)
        : current.ghost_piece,
      skin: typeof newSettings.skin === 'string' ? newSettings.skin.slice(0, 32) : current.skin,
      colorblind_mode: colorblindMode,
      reduced_motion: newSettings.reduced_motion !== undefined
        ? (newSettings.reduced_motion ? 1 : 0)
        : current.reduced_motion,
      updated_at: Date.now()
    };

    db.prepare(`
      UPDATE user_settings SET
        theme = ?, das = ?, arr = ?, soft_drop_factor = ?, lock_delay = ?,
        sound_volume = ?, music_volume = ?, keybindings = ?, gamepad_bindings = ?,
        touch_controls_enabled = ?, ghost_piece = ?, skin = ?,
        colorblind_mode = ?, reduced_motion = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      merged.theme, merged.das, merged.arr, merged.soft_drop_factor, merged.lock_delay,
      merged.sound_volume, merged.music_volume, merged.keybindings, merged.gamepad_bindings,
      merged.touch_controls_enabled, merged.ghost_piece, merged.skin,
      merged.colorblind_mode, merged.reduced_motion, merged.updated_at,
      userId
    );

    return this.getSettings(userId);
  }
}
