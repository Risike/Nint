import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

export class ResultService {
  static validateSubmission({ mode, score, lines, duration, piecesPlaced, pps }) {
    // Basic type & positive checks
    if (typeof score !== 'number' || score < 0) return { valid: false, reason: 'Invalid score' };
    if (typeof lines !== 'number' || lines < 0) return { valid: false, reason: 'Invalid lines' };
    if (typeof duration !== 'number' || duration <= 0) return { valid: false, reason: 'Invalid duration' };
    if (typeof piecesPlaced !== 'number' || piecesPlaced < 0) return { valid: false, reason: 'Invalid pieces placed' };

    // Human limit sanity checks (anti-cheat)
    const durationSec = duration / 1000;
    const computedPPS = durationSec > 0 ? piecesPlaced / durationSec : 0;
    
    // World record PPS is ~5.0 - 6.0 PPS. 12 PPS is hard impossible limit for non-bot
    if (computedPPS > 12) {
      return { valid: false, reason: 'Unrealistic pieces per second' };
    }

    // Sprint 40 lines check: 40 lines cleared in < 10 seconds is physically impossible
    if (mode.startsWith('sprint_40') && (duration < 10000 || lines < 40)) {
      return { valid: false, reason: 'Invalid sprint parameters' };
    }

    // Maximum theoretical score in Ultra 3m: ~250,000 points
    if (mode.startsWith('ultra_3m') && score > 350000) {
      return { valid: false, reason: 'Score exceeds physical ultra limit' };
    }

    return { valid: true };
  }

  static submitResult(userId, data) {
    const db = getDatabase();
    const {
      mode,
      score = 0,
      lines = 0,
      level = 1,
      duration = 0,
      piecesPlaced = 0,
      pps = 0,
      apm = 0,
      tetrises = 0,
      tSpins = 0,
      perfectClears = 0,
      maxCombo = 0,
      maxB2B = 0
    } = data;

    const validation = this.validateSubmission({ mode, score, lines, duration, piecesPlaced, pps });
    const verified = validation.valid ? 1 : 0;

    const id = crypto.randomUUID();
    const now = Date.now();

    const tx = db.transaction(() => {
      // 1. Insert result record
      db.prepare(`
        INSERT INTO game_results (
          id, user_id, mode, score, lines, level, duration,
          pieces_placed, pps, apm, tetrises, t_spins, perfect_clears,
          max_combo, max_b2b, verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, userId, mode, score, lines, level, duration,
        piecesPlaced, pps, apm, tetrises, tSpins, perfectClears,
        maxCombo, maxB2B, verified, now
      );

      // 2. Update Personal Bests only if verified
      if (verified) {
        if (mode.startsWith('sprint')) {
          // Lowest time is better
          const existingBest = db.prepare(`
            SELECT value FROM personal_bests WHERE user_id = ? AND mode = ? AND metric = 'time_ms'
          `).get(userId, mode);

          if (!existingBest || duration < existingBest.value) {
            db.prepare(`
              INSERT INTO personal_bests (id, user_id, mode, metric, value, achieved_at, result_id)
              VALUES (?, ?, ?, 'time_ms', ?, ?, ?)
              ON CONFLICT(user_id, mode, metric) DO UPDATE SET
                value = excluded.value,
                achieved_at = excluded.achieved_at,
                result_id = excluded.result_id
            `).run(crypto.randomUUID(), userId, mode, duration, now, id);
          }
        } else {
          // Highest score is better
          const existingBest = db.prepare(`
            SELECT value FROM personal_bests WHERE user_id = ? AND mode = ? AND metric = 'score'
          `).get(userId, mode);

          if (!existingBest || score > existingBest.value) {
            db.prepare(`
              INSERT INTO personal_bests (id, user_id, mode, metric, value, achieved_at, result_id)
              VALUES (?, ?, ?, 'score', ?, ?, ?)
              ON CONFLICT(user_id, mode, metric) DO UPDATE SET
                value = excluded.value,
                achieved_at = excluded.achieved_at,
                result_id = excluded.result_id
            `).run(crypto.randomUUID(), userId, mode, score, now, id);
          }
        }
      }

      // 3. Update aggregated statistics
      db.prepare(`
        UPDATE user_statistics SET
          games_played = games_played + 1,
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
        lines, piecesPlaced, duration, tetrises, tSpins,
        perfectClears, maxCombo, maxB2B, now, userId
      );
    });

    tx();

    return {
      id,
      verified: Boolean(verified),
      validationReason: validation.reason
    };
  }

  static getUserResults(userId, mode, limit = 20) {
    const db = getDatabase();
    if (mode) {
      return db.prepare(`
        SELECT * FROM game_results WHERE user_id = ? AND mode = ? ORDER BY created_at DESC LIMIT ?
      `).all(userId, mode, limit);
    }
    return db.prepare(`
      SELECT * FROM game_results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit);
  }
}
