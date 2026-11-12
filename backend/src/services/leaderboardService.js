import { getDatabase } from '../config/database.js';

const SCORE_MODES = new Set(['marathon_150', 'ultra_3m']);
const TIME_MODES = new Set(['sprint_40']);
const ELO_MODES = new Set(['elo', 'pvp_elo']);
const TIMEFRAMES = {
  all: null,
  daily: 86400000,
  weekly: 7 * 86400000,
  monthly: 30 * 86400000
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export class LeaderboardService {
  static getLeaderboard(mode, { limit = 50, offset = 0, timeframe = 'all' } = {}) {
    const db = getDatabase();

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const safeTimeframe = Object.prototype.hasOwnProperty.call(TIMEFRAMES, timeframe) ? timeframe : 'all';

    if (ELO_MODES.has(mode)) {
      const sql = `
        SELECT
          s.user_id as id,
          s.user_id,
          u.display_name,
          u.avatar_url,
          COALESCE(c.name_color, '#f8fafc') as name_color,
          COALESCE(c.name_decoration, 'none') as name_decoration,
          COALESCE(c.profile_icon, 'user') as profile_icon,
          COALESCE(c.title, '') as title,
          s.rating as score,
          s.rating,
          s.wins,
          s.losses,
          s.games_played,
          s.updated_at as created_at
        FROM user_statistics s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN user_cosmetics c ON c.user_id = s.user_id
        WHERE EXISTS (
          SELECT 1 FROM match_history m
          WHERE m.user_id = s.user_id AND m.ranked = 1 AND m.rating_applied = 1
        )
        ORDER BY s.rating DESC, s.wins DESC
        LIMIT ? OFFSET ?
      `;
      const entries = db.prepare(sql).all(safeLimit, safeOffset);

      const countRow = db.prepare(`
        SELECT COUNT(*) as total
        FROM user_statistics s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN user_cosmetics c ON c.user_id = s.user_id
        WHERE EXISTS (
          SELECT 1 FROM match_history m
          WHERE m.user_id = s.user_id AND m.ranked = 1 AND m.rating_applied = 1
        )
      `).get();

      return {
        mode,
        timeframe: safeTimeframe,
        total: countRow ? countRow.total : 0,
        limit: safeLimit,
        offset: safeOffset,
        entries: entries.map((entry, index) => ({
          rank: safeOffset + index + 1,
          ...entry
        }))
      };
    }

    if (!SCORE_MODES.has(mode) && !TIME_MODES.has(mode)) {
      throw httpError(400, 'Unsupported leaderboard mode');
    }

    const isSprint = TIME_MODES.has(mode);
    const orderDirection = isSprint ? 'ASC' : 'DESC';
    const primaryCol = isSprint ? 'r.duration' : 'r.score';
    const cutoffMs = TIMEFRAMES[safeTimeframe];

    const params = [mode];
    let timeFilter = '';
    if (cutoffMs !== null) {
      timeFilter = 'AND r.created_at >= ?';
      params.push(Date.now() - cutoffMs);
    }

    const sql = `
      SELECT
        r.id,
        r.user_id,
        u.display_name,
        u.avatar_url,
        COALESCE(c.name_color, '#f8fafc') as name_color,
        COALESCE(c.name_decoration, 'none') as name_decoration,
        COALESCE(c.profile_icon, 'user') as profile_icon,
        COALESCE(c.title, '') as title,
        r.mode,
        r.score,
        r.lines,
        r.level,
        r.duration,
        r.pieces_placed,
        r.pps,
        r.apm,
        r.tetrises,
        r.t_spins,
        r.created_at
      FROM game_results r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN user_cosmetics c ON c.user_id = r.user_id
      WHERE r.mode = ? AND r.verified = 1 ${timeFilter}
      ORDER BY ${primaryCol} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const entries = db.prepare(sql).all(...params, safeLimit, safeOffset);

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM game_results r
      WHERE r.mode = ? AND r.verified = 1 ${timeFilter}
    `).get(...params);

    return {
      mode,
      timeframe: safeTimeframe,
      total: countRow.total,
      limit: safeLimit,
      offset: safeOffset,
      entries: entries.map((entry, index) => ({
        rank: safeOffset + index + 1,
        ...entry
      }))
    };
  }
}
