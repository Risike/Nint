import { getDatabase } from '../config/database.js';

export class LeaderboardService {
  static getLeaderboard(mode, { limit = 50, offset = 0, timeframe = 'all' } = {}) {
    const db = getDatabase();

    if (mode === 'elo' || mode === 'pvp_elo') {
      const sql = `
        SELECT 
          s.user_id as id,
          s.user_id,
          u.display_name,
          u.avatar_url,
          s.rating as score,
          s.rating,
          s.wins,
          s.losses,
          s.games_played,
          s.updated_at as created_at
        FROM user_statistics s
        JOIN users u ON u.id = s.user_id
        WHERE s.games_played > 0
        ORDER BY s.rating DESC, s.wins DESC
        LIMIT ? OFFSET ?
      `;
      const entries = db.prepare(sql).all(limit, offset);

      const countSql = `
        SELECT COUNT(*) as total
        FROM user_statistics s
        JOIN users u ON u.id = s.user_id
        WHERE s.games_played > 0
      `;
      const countRow = db.prepare(countSql).get();

      return {
        mode,
        timeframe,
        total: countRow ? countRow.total : 0,
        limit,
        offset,
        entries: entries.map((entry, index) => ({
          rank: offset + index + 1,
          ...entry
        }))
      };
    }

    const isSprint = mode.startsWith('sprint');

    let timeFilter = '';
    const now = Date.now();
    if (timeframe === 'daily') {
      timeFilter = `AND r.created_at >= ${now - 86400000}`;
    } else if (timeframe === 'weekly') {
      timeFilter = `AND r.created_at >= ${now - 7 * 86400000}`;
    } else if (timeframe === 'monthly') {
      timeFilter = `AND r.created_at >= ${now - 30 * 86400000}`;
    }

    // Sort order: Sprint is lowest time ASC, Marathon/Ultra is score DESC
    const orderDirection = isSprint ? 'ASC' : 'DESC';
    const primaryCol = isSprint ? 'r.duration' : 'r.score';

    const sql = `
      SELECT 
        r.id,
        r.user_id,
        u.display_name,
        u.avatar_url,
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
      WHERE r.mode = ? AND r.verified = 1 ${timeFilter}
      ORDER BY ${primaryCol} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const entries = db.prepare(sql).all(mode, limit, offset);

    const countSql = `
      SELECT COUNT(*) as total
      FROM game_results r
      WHERE r.mode = ? AND r.verified = 1 ${timeFilter}
    `;
    const countRow = db.prepare(countSql).get(mode);

    return {
      mode,
      timeframe,
      total: countRow.total,
      limit,
      offset,
      entries: entries.map((entry, index) => ({
        rank: offset + index + 1,
        ...entry
      }))
    };
  }
}
