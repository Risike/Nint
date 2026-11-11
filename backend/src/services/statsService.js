import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

const ALLOWED_RESULTS = new Set(['win', 'loss', 'draw']);
const ALLOWED_MODES = new Set(['versus_1v1', 'versus_online']);
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireInt(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback } = {}) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw httpError(400, `${name} is required`);
  }
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < min || num > max) {
    throw httpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return num;
}

function areComplementary(a, b) {
  if (a === 'draw' || b === 'draw') return a === 'draw' && b === 'draw';
  return (a === 'win' && b === 'loss') || (a === 'loss' && b === 'win');
}

export class StatsService {
  /**
   * Standard Chess ELO calculation (FIDE-style)
   * Expected score: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
   * New rating: R'_A = R_A + K * (S_A - E_A)
   * K-factor: 32 for < 30 matches, 24 thereafter
   * Min rating: 100
   */
  static calculateElo({ playerRating, opponentRating, result, gamesPlayed = 0 }) {
    const Ra = Number(playerRating) || 1000;
    const Rb = Number(opponentRating) || 1000;

    const exponent = (Rb - Ra) / 400;
    const expectedScore = 1 / (1 + Math.pow(10, exponent));

    let actualScore = 0.5; // draw
    if (result === 'win') actualScore = 1.0;
    else if (result === 'loss') actualScore = 0.0;

    const K = gamesPlayed < 30 ? 32 : 24;
    const delta = Math.round(K * (actualScore - expectedScore));
    const newRating = Math.max(100, Ra + delta);

    return {
      oldRating: Ra,
      newRating,
      delta: newRating - Ra,
      opponentRating: Rb,
      expectedScore,
      actualScore,
      kFactor: K
    };
  }

  static getUserStats(userId) {
    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }

    const stats = db.prepare('SELECT * FROM user_statistics WHERE user_id = ?').get(userId);
    const personalBests = db.prepare('SELECT mode, metric, value, achieved_at FROM personal_bests WHERE user_id = ?').all(userId);
    const recentMatches = db.prepare('SELECT * FROM match_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);

    const winRate = stats && (stats.wins + stats.losses) > 0
      ? ((stats.wins / Math.max(1, stats.wins + stats.losses)) * 100).toFixed(1)
      : '0.0';

    return {
      stats: stats || {},
      winRate: parseFloat(winRate),
      personalBests,
      recentMatches
    };
  }

  static normalizeReport(matchData = {}) {
    const opponentType = matchData.opponentType === 'human' ? 'human' : 'ai';
    const result = typeof matchData.result === 'string' ? matchData.result.toLowerCase() : '';
    if (!ALLOWED_RESULTS.has(result)) {
      throw httpError(400, 'Invalid match result');
    }

    const mode = matchData.mode || 'versus_1v1';
    if (!ALLOWED_MODES.has(mode)) {
      throw httpError(400, 'Invalid match mode');
    }

    // Only online matches explicitly flagged as ranked can affect ELO.
    const ranked = opponentType === 'human' && matchData.ranked === true ? 1 : 0;

    const duration = requireInt(matchData.duration, 'duration', { min: 0, max: MAX_DURATION_MS });
    const playerScore = requireInt(matchData.playerScore, 'playerScore', { fallback: 0, max: 10_000_000 });
    const playerLines = requireInt(matchData.playerLines, 'playerLines', { fallback: 0, max: 10_000 });
    const opponentScore = requireInt(matchData.opponentScore, 'opponentScore', { fallback: 0, max: 10_000_000 });
    const opponentLines = requireInt(matchData.opponentLines, 'opponentLines', { fallback: 0, max: 10_000 });
    const piecesPlaced = requireInt(matchData.piecesPlaced, 'piecesPlaced', { fallback: 0, max: 100_000 });
    const tetrises = requireInt(matchData.tetrises, 'tetrises', { fallback: 0, max: 100_000 });
    const tSpins = requireInt(matchData.tSpins, 'tSpins', { fallback: 0, max: 100_000 });
    const perfectClears = requireInt(matchData.perfectClears, 'perfectClears', { fallback: 0, max: 100_000 });
    const maxCombo = requireInt(matchData.maxCombo, 'maxCombo', { fallback: 0, max: 100_000 });
    const maxB2B = requireInt(matchData.maxB2B, 'maxB2B', { fallback: 0, max: 100_000 });
    const difficulty = matchData.difficulty === undefined || matchData.difficulty === null
      ? null
      : requireInt(matchData.difficulty, 'difficulty', { min: 1, max: 10 });

    if (piecesPlaced > 0 && playerLines > piecesPlaced * 4) {
      throw httpError(400, 'Implausible line count for pieces placed');
    }

    const opponentName = String(matchData.opponentName || (opponentType === 'ai' ? 'AI Opponent' : 'Online Opponent'))
      .trim()
      .slice(0, 32) || 'Opponent';

    let matchId = null;
    let opponentId = null;

    if (opponentType === 'human') {
      matchId = typeof matchData.matchId === 'string' ? matchData.matchId.trim() : '';
      if (!matchId || matchId.length < 6 || matchId.length > 100) {
        throw httpError(400, 'A valid matchId is required for online matches');
      }
      opponentId = typeof matchData.opponentId === 'string' ? matchData.opponentId.trim() : '';
      if (!opponentId || opponentId.length > 100) {
        throw httpError(400, 'A valid opponentId is required for online matches');
      }
    }

    return {
      opponentType,
      opponentName,
      opponentId,
      matchId,
      ranked,
      mode,
      result,
      duration,
      playerScore,
      playerLines,
      opponentScore,
      opponentLines,
      piecesPlaced,
      tetrises,
      tSpins,
      perfectClears,
      maxCombo,
      maxB2B,
      difficulty
    };
  }

  static incrementMatchStats(db, userId, report, newRating, now) {
    const isWin = report.result === 'win';
    const isLoss = report.result === 'loss';

    if (newRating === null || newRating === undefined) {
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
        report.playerLines,
        report.piecesPlaced,
        report.duration,
        report.tetrises,
        report.tSpins,
        report.perfectClears,
        report.maxCombo,
        report.maxB2B,
        now,
        userId
      );
      return;
    }

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
        rating = ?,
        updated_at = ?
      WHERE user_id = ?
    `).run(
      isWin ? 1 : 0,
      isLoss ? 1 : 0,
      report.playerLines,
      report.piecesPlaced,
      report.duration,
      report.tetrises,
      report.tSpins,
      report.perfectClears,
      report.maxCombo,
      report.maxB2B,
      newRating,
      now,
      userId
    );
  }

  static insertHistory(db, id, userId, report, now) {
    db.prepare(`
      INSERT INTO match_history (
        id, user_id, opponent_id, opponent_name, opponent_type, difficulty,
        mode, match_id, ranked, result, player_score, player_lines, opponent_score,
        opponent_lines, duration, pieces_placed, tetrises, t_spins,
        perfect_clears, max_combo, max_b2b, rating_applied, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id, userId, report.opponentId, report.opponentName, report.opponentType, report.difficulty,
      report.mode, report.matchId, report.ranked, report.result, report.playerScore, report.playerLines, report.opponentScore,
      report.opponentLines, report.duration, report.piecesPlaced, report.tetrises, report.tSpins,
      report.perfectClears, report.maxCombo, report.maxB2B, now
    );
  }

  static reportFromHistory(row) {
    return {
      result: row.result,
      playerScore: row.player_score,
      playerLines: row.player_lines,
      opponentScore: row.opponent_score,
      opponentLines: row.opponent_lines,
      duration: row.duration,
      piecesPlaced: row.pieces_placed,
      tetrises: row.tetrises,
      tSpins: row.t_spins,
      perfectClears: row.perfect_clears,
      maxCombo: row.max_combo,
      maxB2B: row.max_b2b
    };
  }

  static eloFromHistory(row) {
    if (!row || row.rating_applied !== 1 || row.new_rating === null || row.new_rating === undefined) {
      return null;
    }
    return {
      oldRating: row.new_rating - (row.rating_change || 0),
      newRating: row.new_rating,
      delta: row.rating_change || 0,
      opponentRating: row.opponent_rating ?? null
    };
  }

  /**
   * Settles a match after a disconnect or an explicit leave. Both players are
   * recorded, so a missing unload request can never leave a ranked result
   * pending forever. The operation is idempotent: the winner and the leaver
   * may both call it, but only one transaction applies ELO.
   */
  static settleForfeit(userId, matchData = {}) {
    const db = getDatabase();
    const result = typeof matchData.result === 'string' ? matchData.result.toLowerCase() : '';
    if (result !== 'loss') {
      throw httpError(400, 'Only the player who abandons the match can submit a forfeit');
    }

    const parsedDuration = Number(matchData.duration);
    const duration = Number.isFinite(parsedDuration) ? Math.max(0, Math.round(parsedDuration)) : 0;
    const report = this.normalizeReport({
      ...matchData,
      opponentType: 'human',
      mode: 'versus_online',
      result,
      duration
    });

    if (report.opponentId === userId) {
      throw httpError(400, 'You cannot record a match against yourself');
    }

    const caller = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(userId);
    if (!caller) {
      throw httpError(401, 'Account no longer exists');
    }
    const opponent = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(report.opponentId);
    if (!opponent) {
      throw httpError(400, 'Opponent account not found');
    }

    report.opponentName = String(opponent.display_name || report.opponentName || 'Online Opponent').slice(0, 32);

    const opponentReport = {
      ...report,
      opponentId: userId,
      opponentName: String(caller.display_name || 'Online Opponent').slice(0, 32),
      result: report.result === 'win' ? 'loss' : 'win',
      playerScore: report.opponentScore,
      playerLines: report.opponentLines,
      opponentScore: report.playerScore,
      opponentLines: report.playerLines,
      piecesPlaced: 0,
      tetrises: 0,
      tSpins: 0,
      perfectClears: 0,
      maxCombo: 0,
      maxB2B: 0
    };
    const now = Date.now();

    const settle = db.transaction(() => {
      const rows = db.prepare(`
        SELECT * FROM match_history
        WHERE match_id = ? AND user_id IN (?, ?)
      `).all(report.matchId, userId, report.opponentId);

      let myRow = rows.find((row) => row.user_id === userId);
      let oppRow = rows.find((row) => row.user_id === report.opponentId);

      if (myRow && myRow.opponent_id !== report.opponentId) {
        throw httpError(409, 'This match belongs to different opponents');
      }
      if (oppRow && oppRow.opponent_id !== userId) {
        throw httpError(409, 'This match belongs to different opponents');
      }
      if (myRow && myRow.result !== report.result) {
        throw httpError(409, 'This match has already been recorded with a different result');
      }
      if (oppRow && oppRow.result !== opponentReport.result) {
        throw httpError(409, 'The opponent report conflicts with this forfeit');
      }
      if (myRow && Boolean(myRow.ranked) !== Boolean(report.ranked)) {
        throw httpError(409, 'Both players must agree on ranked mode');
      }
      if (oppRow && Boolean(oppRow.ranked) !== Boolean(report.ranked)) {
        throw httpError(409, 'Both players must agree on ranked mode');
      }

      if (report.ranked) {
        if (myRow?.rating_applied === 1 || oppRow?.rating_applied === 1) {
          if (myRow?.rating_applied === 1 && oppRow?.rating_applied === 1) {
            return {
              id: myRow.id,
              success: true,
              elo: this.eloFromHistory(myRow),
              pending: false,
              ranked: true
            };
          }
          throw httpError(409, 'This match is already partially settled');
        }
      } else if (myRow && oppRow) {
        return { id: myRow.id, success: true, elo: null, pending: false, ranked: false };
      }

      const hadMyRow = Boolean(myRow);
      const hadOppRow = Boolean(oppRow);

      if (!myRow) {
        const id = crypto.randomUUID();
        this.insertHistory(db, id, userId, report, now);
        myRow = db.prepare('SELECT * FROM match_history WHERE id = ?').get(id);
      }

      if (!oppRow) {
        const id = crypto.randomUUID();
        this.insertHistory(db, id, report.opponentId, opponentReport, now);
        oppRow = db.prepare('SELECT * FROM match_history WHERE id = ?').get(id);
      }

      if (!report.ranked) {
        if (!hadMyRow) {
          this.incrementMatchStats(db, userId, report, null, now);
        }
        if (!hadOppRow) {
          this.incrementMatchStats(db, report.opponentId, opponentReport, null, now);
        }
        return { id: myRow.id, success: true, elo: null, pending: false, ranked: false };
      }

      const myStats = db.prepare('SELECT rating, games_played FROM user_statistics WHERE user_id = ?').get(userId)
        || { rating: 1000, games_played: 0 };
      const oppStats = db.prepare('SELECT rating, games_played FROM user_statistics WHERE user_id = ?').get(report.opponentId)
        || { rating: 1000, games_played: 0 };

      const myRankedGames = db.prepare(
        'SELECT COUNT(*) AS count FROM match_history WHERE user_id = ? AND ranked = 1 AND rating_applied = 1'
      ).get(userId).count;
      const myElo = this.calculateElo({
        playerRating: myStats.rating ?? 1000,
        opponentRating: oppStats.rating ?? 1000,
        result: report.result,
        gamesPlayed: myRankedGames
      });
      // A forfeit only penalizes the player who abandoned. The opponent
      // receives the win, but no rating gain.
      const oppElo = {
        oldRating: oppStats.rating ?? 1000,
        newRating: oppStats.rating ?? 1000,
        delta: 0,
        opponentRating: myStats.rating ?? 1000
      };

      db.prepare(`
        UPDATE match_history
        SET rating_change = ?, new_rating = ?, opponent_rating = ?, rating_applied = 1
        WHERE id = ?
      `).run(myElo.delta, myElo.newRating, myElo.opponentRating, myRow.id);

      db.prepare(`
        UPDATE match_history
        SET rating_change = ?, new_rating = ?, opponent_rating = ?, rating_applied = 1
        WHERE id = ?
      `).run(oppElo.delta, oppElo.newRating, oppElo.opponentRating, oppRow.id);

      this.incrementMatchStats(db, userId, report, myElo.newRating, now);
      this.incrementMatchStats(db, report.opponentId, opponentReport, oppElo.newRating, now);

      return { id: myRow.id, success: true, elo: myElo, pending: false, ranked: true };
    });

    return settle();
  }

  static recordMatch(userId, matchData) {
    const db = getDatabase();
    const report = this.normalizeReport(matchData);
    const id = crypto.randomUUID();
    const now = Date.now();

    // AI matches never affect ELO. They are recorded immediately.
    if (report.opponentType === 'ai') {
      const tx = db.transaction(() => {
        this.insertHistory(db, id, userId, report, now);
        this.incrementMatchStats(db, userId, report, null, now);
      });
      tx();
      return { id, success: true, elo: null, pending: false, ranked: false };
    }

    if (report.opponentId === userId) {
      throw httpError(400, 'You cannot record a match against yourself');
    }
    const opponent = db.prepare('SELECT id FROM users WHERE id = ?').get(report.opponentId);
    if (!opponent) {
      throw httpError(400, 'Opponent account not found');
    }

    // Look for the opponent's pending report for the same match before inserting.
    const counterpart = db.prepare(`
      SELECT * FROM match_history
      WHERE match_id = ? AND user_id = ? AND opponent_id = ? AND rating_applied = 0
    `).get(report.matchId, report.opponentId, userId);

    if (counterpart && Boolean(counterpart.ranked) !== Boolean(report.ranked)) {
      throw httpError(409, 'Both players must agree on ranked mode');
    }

    if (report.ranked && counterpart && !areComplementary(report.result, counterpart.result)) {
      throw httpError(409, 'Conflicting match reports for this match');
    }

    try {
      this.insertHistory(db, id, userId, report, now);
    } catch (err) {
      if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
        throw httpError(409, 'This match has already been recorded');
      }
      throw err;
    }

    // Casual matches are final immediately and never touch ratings.
    if (!report.ranked) {
      const casualTx = db.transaction(() => {
        this.incrementMatchStats(db, userId, report, null, now);
      });
      casualTx();
      return { id, success: true, elo: null, pending: false, ranked: false };
    }

    if (!counterpart) {
      return { id, success: true, elo: null, pending: true, ranked: true };
    }

    const tx = db.transaction(() => {
      const myStats = db.prepare('SELECT rating, games_played FROM user_statistics WHERE user_id = ?').get(userId)
        || { rating: 1000, games_played: 0 };
      const oppStats = db.prepare('SELECT rating, games_played FROM user_statistics WHERE user_id = ?').get(report.opponentId)
        || { rating: 1000, games_played: 0 };

      // K-factor only counts completed ranked matches, so casual games never
      // influence future ELO calculations.
      const myRankedGames = db.prepare(
        'SELECT COUNT(*) AS count FROM match_history WHERE user_id = ? AND ranked = 1 AND rating_applied = 1'
      ).get(userId).count;
      const oppRankedGames = db.prepare(
        'SELECT COUNT(*) AS count FROM match_history WHERE user_id = ? AND ranked = 1 AND rating_applied = 1'
      ).get(report.opponentId).count;

      const myElo = this.calculateElo({
        playerRating: myStats.rating ?? 1000,
        opponentRating: oppStats.rating ?? 1000,
        result: report.result,
        gamesPlayed: myRankedGames
      });
      const oppElo = this.calculateElo({
        playerRating: oppStats.rating ?? 1000,
        opponentRating: myStats.rating ?? 1000,
        result: counterpart.result,
        gamesPlayed: oppRankedGames
      });

      db.prepare(`
        UPDATE match_history
        SET rating_change = ?, new_rating = ?, opponent_rating = ?, rating_applied = 1
        WHERE id = ?
      `).run(myElo.delta, myElo.newRating, myElo.opponentRating, id);

      db.prepare(`
        UPDATE match_history
        SET rating_change = ?, new_rating = ?, opponent_rating = ?, rating_applied = 1
        WHERE id = ?
      `).run(oppElo.delta, oppElo.newRating, oppElo.opponentRating, counterpart.id);

      this.incrementMatchStats(db, userId, report, myElo.newRating, now);
      this.incrementMatchStats(db, report.opponentId, {
        result: counterpart.result,
        playerLines: counterpart.player_lines,
        piecesPlaced: counterpart.pieces_placed,
        duration: counterpart.duration,
        tetrises: counterpart.tetrises,
        tSpins: counterpart.t_spins,
        perfectClears: counterpart.perfect_clears,
        maxCombo: counterpart.max_combo,
        maxB2B: counterpart.max_b2b
      }, oppElo.newRating, now);

      return myElo;
    });

    const elo = tx();
    return { id, success: true, elo, pending: false, ranked: true };
  }
}
