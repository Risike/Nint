import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

export class StatsService {
  static getUserStats(userId) {
    const db = getDatabase();
    const stats = db.prepare('SELECT * FROM user_statistics WHERE user_id = ?').get(userId);
    const personalBests = db.prepare('SELECT mode, metric, value, achieved_at FROM personal_bests WHERE user_id = ?').all(userId);
    const recentMatches = db.prepare('SELECT * FROM match_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);

    const winRate = stats && stats.games_played > 0
      ? ((stats.wins / Math.max(1, stats.wins + stats.losses)) * 100).toFixed(1)
      : '0.0';

    return {
      stats: stats || {},
      winRate: parseFloat(winRate),
      personalBests,
      recentMatches
    };
  }

  static recordMatch(userId, matchData) {
    const db = getDatabase();
    const {
      opponentName,
      opponentType = 'ai',
      difficulty = null,
      mode = 'versus_1v1',
      result, // 'win' | 'loss' | 'draw'
      playerScore = 0,
      playerLines = 0,
      opponentScore = 0,
      opponentLines = 0,
      duration = 0,
      garbageSent = 0,
      garbageReceived = 0,
      piecesPlaced = 0,
      tetrises = 0,
      tSpins = 0,
      perfectClears = 0,
      maxCombo = 0,
      maxB2B = 0
    } = matchData;

    const id = crypto.randomUUID();
    const now = Date.now();

    const isWin = result === 'win';
    const isLoss = result === 'loss';

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO match_history (
          id, user_id, opponent_name, opponent_type, difficulty,
          mode, result, player_score, player_lines, opponent_score,
          opponent_lines, duration, garbage_sent, garbage_received, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, userId, opponentName, opponentType, difficulty,
        mode, result, playerScore, playerLines, opponentScore,
        opponentLines, duration, garbageSent, garbageReceived, now
      );

      db.prepare(`
        UPDATE user_statistics SET
          games_played = games_played + 1,
          wins = wins + ?,
          losses = losses + ?,
          total_lines = total_lines + ?,
          total_pieces = total_pieces + ?,
          total_playtime_ms = total_playtime_ms + ?,
          total_tetrises = total_tetrises + ?,
          total_tspins = total_tspins + ?,
          total_perfect_clears = total_perfect_clears + ?,
          highest_combo = MAX(highest_combo, ?),
          highest_b2b = MAX(highest_b2b, ?),
          updated_at = ?
        WHERE user_id = ?
      `).run(
        isWin ? 1 : 0,
        isLoss ? 1 : 0,
        playerLines,
        piecesPlaced,
        duration,
        tetrises,
        tSpins,
        perfectClears,
        maxCombo,
        maxB2B,
        now,
        userId
      );
    });

    tx();

    return { id, success: true };
  }
}
