import { getDatabase } from '../config/database.js';

export class AdminService {
  static clearLeaderboards() {
    const db = getDatabase();
    const tx = db.transaction(() => {
      db.exec('DELETE FROM personal_bests');
      db.exec('DELETE FROM game_results');
      db.exec('DELETE FROM match_history');

      // Lifetime solo aggregates come from game_results, so they must be reset
      // alongside the scores they were derived from.
      db.exec(`
        UPDATE user_statistics SET
          games_played = 0,
          wins = 0,
          losses = 0,
          total_lines = 0,
          total_pieces = 0,
          total_playtime_ms = 0,
          total_tetrises = 0,
          total_tspins = 0,
          total_perfect_clears = 0,
          highest_combo = 0,
          highest_b2b = 0,
          rating = 1000,
          updated_at = ${Date.now()}
      `);
    });
    tx();
    return { success: true, message: 'All leaderboards have been cleared.' };
  }

  static searchUsers(query = '') {
    const db = getDatabase();
    const escaped = String(query).trim().replace(/[\\%_]/g, '\\$&');
    const pattern = `%${escaped}%`;
    return db.prepare(`
      SELECT u.id, u.email, u.display_name, u.avatar_url, u.is_admin, u.created_at,
             COALESCE(s.rating, 1000) as rating,
             COALESCE(s.games_played, 0) as games_played,
             COALESCE(s.wins, 0) as wins,
             COALESCE(s.losses, 0) as losses
      FROM users u
      LEFT JOIN user_statistics s ON s.user_id = u.id
      WHERE u.display_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\'
      ORDER BY u.created_at DESC
      LIMIT 50
    `).all(pattern, pattern);
  }

  static clearUserStats(userId) {
    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM personal_bests WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM match_history WHERE user_id = ?').run(userId);
      db.prepare(`
        UPDATE user_statistics SET
          games_played = 0, wins = 0, losses = 0,
          total_lines = 0, total_pieces = 0, total_playtime_ms = 0,
          total_tetrises = 0, total_tspins = 0, total_perfect_clears = 0,
          highest_combo = 0, highest_b2b = 0, rating = 1000,
          updated_at = ?
        WHERE user_id = ?
      `).run(Date.now(), userId);
    });
    tx();
    return { success: true, message: 'User stats have been cleared.' };
  }

  static deleteUser(userId, adminUserId) {
    const db = getDatabase();
    if (userId === adminUserId) {
      const err = new Error('Cannot delete your own admin account');
      err.status = 400;
      throw err;
    }
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return { success: true, message: `Account ${user.email} has been deleted.` };
  }

  static getNews() {
    const db = getDatabase();
    const row = db.prepare("SELECT value, updated_at FROM site_config WHERE key = 'news_message'").get();
    return { message: row?.value || '', updatedAt: row?.updated_at || null };
  }

  static setNews(message) {
    const db = getDatabase();
    const safeMessage = String(message).slice(0, 2000);
    db.prepare(`
      INSERT INTO site_config (key, value, updated_at) VALUES ('news_message', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(safeMessage, Date.now());
    return { success: true, message: 'News message updated.' };
  }
}
