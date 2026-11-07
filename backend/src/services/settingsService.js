import { getDatabase } from '../config/database.js';

export class SettingsService {
  static getSettings(userId) {
    const db = getDatabase();
    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    if (!settings) {
      db.prepare('INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)').run(userId, Date.now());
      settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    }
    if (settings && settings.keybindings && typeof settings.keybindings === 'string') {
      try {
        settings.keybindings = JSON.parse(settings.keybindings);
      } catch (e) {
        settings.keybindings = null;
      }
    }
    return settings;
  }

  static updateSettings(userId, newSettings) {
    const db = getDatabase();
    const current = this.getSettings(userId);

    const merged = {
      theme: newSettings.theme ?? current.theme,
      das: newSettings.das ?? current.das,
      arr: newSettings.arr ?? current.arr,
      soft_drop_factor: newSettings.soft_drop_factor ?? current.soft_drop_factor,
      lock_delay: newSettings.lock_delay ?? current.lock_delay,
      sound_volume: newSettings.sound_volume ?? current.sound_volume,
      music_volume: newSettings.music_volume ?? current.music_volume,
      keybindings: newSettings.keybindings ? JSON.stringify(newSettings.keybindings) : (typeof current.keybindings === 'object' ? JSON.stringify(current.keybindings) : current.keybindings),
      touch_controls_enabled: newSettings.touch_controls_enabled !== undefined ? (newSettings.touch_controls_enabled ? 1 : 0) : current.touch_controls_enabled,
      ghost_piece: newSettings.ghost_piece !== undefined ? (newSettings.ghost_piece ? 1 : 0) : current.ghost_piece,
      skin: newSettings.skin ?? current.skin,
      colorblind_mode: newSettings.colorblind_mode ?? current.colorblind_mode,
      reduced_motion: newSettings.reduced_motion !== undefined ? (newSettings.reduced_motion ? 1 : 0) : current.reduced_motion,
      updated_at: Date.now()
    };

    db.prepare(`
      UPDATE user_settings SET
        theme = ?, das = ?, arr = ?, soft_drop_factor = ?, lock_delay = ?,
        sound_volume = ?, music_volume = ?, keybindings = ?,
        touch_controls_enabled = ?, ghost_piece = ?, skin = ?,
        colorblind_mode = ?, reduced_motion = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      merged.theme, merged.das, merged.arr, merged.soft_drop_factor, merged.lock_delay,
      merged.sound_volume, merged.music_volume, merged.keybindings,
      merged.touch_controls_enabled, merged.ghost_piece, merged.skin,
      merged.colorblind_mode, merged.reduced_motion, merged.updated_at,
      userId
    );

    return this.getSettings(userId);
  }
}
