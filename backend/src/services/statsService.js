import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

export class StatsService {
  /**
   * Standard Chess ELO calculation (FIDE-style)
   * Expected score: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
   * New rating: R'_A = R_A + K * (S_A - E_A)
   * K-factor: 32 for <= 30 matches, 24 thereafter
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

    // ELO is strictly reserved for online human player vs player matches
    const isOnlinePvp = (opponentType === 'human' || mode === 'versus_online') && opponentType !== 'ai';

    let eloResult = null;
    const currentUserStats = db.prepare('SELECT rating, games_played FROM user_statistics WHERE user_id = ?').get(userId);
    const currentRating = currentUserStats?.rating ?? 1000;
    const gamesPlayed = currentUserStats?.games_played ?? 0;

    if (isOnlinePvp) {
      let oppRating = matchData.opponentRating;
      if (!oppRating && matchData.opponentId) {
        const oppStats = db.prepare('SELECT rating FROM user_statistics WHERE user_id = ?').get(matchData.opponentId);
        if (oppStats && oppStats.rating) {
          oppRating = oppStats.rating;
        }
      }
      if (!oppRating) {
        oppRating = 1000;
      }

      eloResult = this.calculateElo({
        playerRating: currentRating,
        opponentRating: oppRating,
        result,
        gamesPlayed
      });
    }

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO match_history (
          id, user_id, opponent_name, opponent_type, difficulty,
          mode, result, player_score, player_lines, opponent_score,
          opponent_lines, duration, garbage_sent, garbage_received,
          rating_change, new_rating, opponent_rating, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, userId, opponentName, opponentType, difficulty,
        mode, result, playerScore, playerLines, opponentScore,
        opponentLines, duration, garbageSent, garbageReceived,
        eloResult ? eloResult.delta : 0,
        eloResult ? eloResult.newRating : null,
        eloResult ? eloResult.opponentRating : null,
        now
      );

      if (eloResult) {
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
          playerLines,
          piecesPlaced,
          duration,
          tetrises,
          tSpins,
          perfectClears,
          maxCombo,
          maxB2B,
          eloResult.newRating,
          now,
          userId
        );
      } else {
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
      }
    });

    tx();

    return {
      id,
      success: true,
      elo: eloResult
    };
  }
}
