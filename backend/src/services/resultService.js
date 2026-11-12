import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { awardLineCredits } from '../utils/credits.js';

const ALLOWED_MODES = new Set(['marathon_150', 'sprint_40', 'ultra_3m', 'zen']);
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_MS = 6 * 60 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireInt(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback, round = false } = {}) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw httpError(400, `${name} is required`);
  }
  const raw = Number(value);
  const num = round && Number.isFinite(raw) ? Math.round(raw) : raw;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < min || num > max) {
    throw httpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return num;
}

export class ResultService {
  /**
   * Returns { valid, reason } for plausibility checks. Unknown modes and
   * malformed payloads are rejected with a 400 before reaching this method.
   */
  static validateSubmission({ mode, score, lines, duration, piecesPlaced, level, tetrises, perfectClears }) {
    const durationSec = duration / 1000;
    const computedPPS = durationSec > 0 ? piecesPlaced / durationSec : 0;

    if (computedPPS > 12) {
      return { valid: false, reason: 'Unrealistic pieces per second' };
    }
    if (lines > piecesPlaced * 2) {
      return { valid: false, reason: 'Implausible line count for pieces placed' };
    }
    if (tetrises * 4 > lines) {
      return { valid: false, reason: 'Implausible Tetris count' };
    }
    if (perfectClears > lines) {
      return { valid: false, reason: 'Implausible perfect clear count' };
    }
    if (score > 5_000_000) {
      return { valid: false, reason: 'Score exceeds the supported maximum' };
    }
    if (level > 30) {
      return { valid: false, reason: 'Implausible level' };
    }

    if (mode === 'zen') {
      if (duration > MAX_SESSION_MS) {
        return { valid: false, reason: 'Zen session is too long to be recorded' };
      }
      return { valid: true };
    }

    if (mode === 'marathon_150') {
      if (lines > 150) {
        return { valid: false, reason: 'Marathon cannot exceed 150 lines' };
      }
      if (lines >= 150 && duration < 60000) {
        return { valid: false, reason: 'Marathon completion time is physically impossible' };
      }
      if (score > 3_000_000) {
        return { valid: false, reason: 'Score exceeds the marathon maximum' };
      }
      return { valid: true };
    }

    if (mode === 'sprint_40') {
      if (lines !== 40) {
        return { valid: false, reason: 'Sprint requires exactly 40 lines' };
      }
      if (duration < 10000) {
        return { valid: false, reason: 'Sprint completion under 10 seconds is impossible' };
      }
      if (score > 500_000) {
        return { valid: false, reason: 'Score exceeds the sprint maximum' };
      }
      return { valid: true };
    }

    if (mode === 'ultra_3m') {
      if (duration > 190000) {
        return { valid: false, reason: 'Ultra runs are limited to 3 minutes' };
      }
      if (lines > 500) {
        return { valid: false, reason: 'Implausible line count for Ultra' };
      }
      if (score > 350000) {
        return { valid: false, reason: 'Score exceeds the ultra maximum' };
      }
      return { valid: true };
    }

    return { valid: false, reason: 'Unsupported game mode' };
  }

  static submitResult(userId, data = {}) {
    const mode = data.mode;
    if (typeof mode !== 'string' || !ALLOWED_MODES.has(mode)) {
      throw httpError(400, 'Unsupported game mode');
    }

    const duration = requireInt(data.duration, 'duration', { min: 1, max: MAX_DURATION_MS, round: true });
    const score = requireInt(data.score, 'score', { fallback: 0 });
    const lines = requireInt(data.lines, 'lines', { fallback: 0 });
    const level = requireInt(data.level, 'level', { fallback: 1, min: 1 });
    const piecesPlaced = requireInt(data.piecesPlaced, 'piecesPlaced', { fallback: 0 });
    const tetrises = requireInt(data.tetrises, 'tetrises', { fallback: 0 });
    const tSpins = requireInt(data.tSpins, 'tSpins', { fallback: 0 });
    const perfectClears = requireInt(data.perfectClears, 'perfectClears', { fallback: 0 });
    const maxCombo = requireInt(data.maxCombo, 'maxCombo', { fallback: 0 });
    const maxB2B = requireInt(data.maxB2B, 'maxB2B', { fallback: 0 });

    const validation = this.validateSubmission({
      mode, score, lines, duration, piecesPlaced, level, tetrises, perfectClears
    });
    const verified = validation.valid ? 1 : 0;

    const db = getDatabase();

    // Zen mode: only playtime is recorded, no leaderboard, statistics or credits.
    if (mode === 'zen') {
      if (!verified) {
        return { id: null, verified: false, validationReason: validation.reason, creditsAwarded: 0 };
      }
      const now = Date.now();
      db.prepare(`
        UPDATE user_statistics SET
          total_playtime_ms = total_playtime_ms + ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(duration, now, userId);

      return { id: crypto.randomUUID(), verified: true, zen: true, creditsAwarded: 0 };
    }

    const durationSec = duration / 1000;
    const pps = parseFloat((piecesPlaced / durationSec).toFixed(2));
    const apm = parseFloat(((lines * 60) / durationSec).toFixed(1));

    const id = crypto.randomUUID();
    const now = Date.now();
    let creditsAwarded = 0;

    const tx = db.transaction(() => {
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

      if (verified) {
        if (mode === 'sprint_40') {
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

      if (verified) {
        creditsAwarded = awardLineCredits(db, userId, lines, now);
      }
    });

    tx();

    return {
      id,
      verified: Boolean(verified),
      validationReason: validation.reason,
      creditsAwarded
    };
  }

  static getUserResults(userId, mode, limit = 20) {
    const db = getDatabase();
    if (mode !== undefined && mode !== null && mode !== '') {
      if (typeof mode !== 'string' || !ALLOWED_MODES.has(mode)) {
        throw httpError(400, 'Unsupported game mode');
      }
      return db.prepare(`
        SELECT * FROM game_results WHERE user_id = ? AND mode = ? ORDER BY created_at DESC LIMIT ?
      `).all(userId, mode, limit);
    }
    return db.prepare(`
      SELECT * FROM game_results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit);
  }
}
