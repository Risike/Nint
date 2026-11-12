import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

const WAITING = 'waiting';
const ACTIVE = 'active';
const COMPLETED = 'completed';
const CANCELLED = 'cancelled';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

/**
 * Online matches are created by the server, not by a client. This prevents a
 * player from inventing a match id, choosing their opponent, or mixing reports
 * from two unrelated games.
 */
export class OnlineMatchService {
  static getMatch(matchId) {
    if (typeof matchId !== 'string' || !matchId.trim()) {
      throw httpError(400, 'A server-issued matchId is required');
    }
    const db = getDatabase();
    const match = db.prepare('SELECT * FROM online_matches WHERE id = ?').get(matchId.trim());
    if (!match) {
      throw httpError(404, 'Online match not found');
    }
    return match;
  }

  static getParticipantMatch(userId, matchId) {
    const match = this.getMatch(matchId);
    if (match.host_user_id !== userId && match.guest_user_id !== userId) {
      throw httpError(403, 'You are not a participant in this match');
    }
    return match;
  }

  static getDetails(userId, matchId) {
    const db = getDatabase();
    const match = this.getParticipantMatch(userId, matchId);
    const ratingFor = (id) => {
      if (!id) return null;
      const stats = db.prepare('SELECT rating FROM user_statistics WHERE user_id = ?').get(id);
      return stats?.rating ?? 1000;
    };

    return {
      matchId: match.id,
      seed: match.seed,
      ranked: match.ranked === 1,
      status: match.status,
      winnerUserId: match.winner_user_id,
      players: {
        host: { userId: match.host_user_id, rating: ratingFor(match.host_user_id) },
        guest: match.guest_user_id
          ? { userId: match.guest_user_id, rating: ratingFor(match.guest_user_id) }
          : null
      }
    };
  }

  static create(userId, { ranked = false } = {}) {
    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw httpError(401, 'Account no longer exists');
    }

    const id = crypto.randomUUID();
    const seed = crypto.randomInt(1, 1_000_001);
    const now = Date.now();

    db.prepare(`
      INSERT INTO online_matches (id, seed, ranked, host_user_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, seed, ranked === true ? 1 : 0, userId, WAITING, now);

    return { matchId: id, seed, ranked: ranked === true, status: WAITING };
  }

  static join(userId, matchId) {
    const db = getDatabase();
    const match = this.getMatch(matchId);

    if (match.host_user_id === userId) {
      throw httpError(400, 'You cannot join your own online match');
    }
    if (match.guest_user_id === userId) {
      return {
        matchId: match.id,
        seed: match.seed,
        ranked: match.ranked === 1,
        status: match.status
      };
    }
    if (match.status !== WAITING) {
      throw httpError(409, 'This online match is no longer accepting players');
    }
    if (match.guest_user_id) {
      throw httpError(409, 'This online match is already full');
    }

    const now = Date.now();
    const joined = db.prepare(`
      UPDATE online_matches
      SET guest_user_id = ?, status = ?, started_at = ?
      WHERE id = ? AND status = ? AND guest_user_id IS NULL
    `).run(userId, ACTIVE, now, match.id, WAITING);
    if (joined.changes === 0) {
      throw httpError(409, 'This online match is already full');
    }

    return { matchId: match.id, seed: match.seed, ranked: match.ranked === 1, status: ACTIVE };
  }

  static rematch(userId, matchId) {
    const db = getDatabase();
    const match = this.getParticipantMatch(userId, matchId);

    if (match.status !== COMPLETED) {
      throw httpError(409, 'A rematch can only be created after the previous match ends');
    }
    if (!match.guest_user_id) {
      throw httpError(409, 'The previous match has no opponent to rematch');
    }

    const id = crypto.randomUUID();
    const seed = crypto.randomInt(1, 1_000_001);
    const now = Date.now();

    db.prepare(`
      INSERT INTO online_matches (id, seed, ranked, host_user_id, guest_user_id, status, created_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, seed, match.ranked, match.host_user_id, match.guest_user_id, ACTIVE, now, now);

    return { matchId: id, seed, ranked: match.ranked === 1, status: ACTIVE };
  }

  static cancel(userId, matchId) {
    const db = getDatabase();
    const match = this.getParticipantMatch(userId, matchId);

    if (match.status === CANCELLED) {
      return { success: true, cancelled: true, matchId: match.id };
    }
    if (match.status !== WAITING) {
      throw httpError(409, 'Only a waiting online match can be cancelled');
    }

    db.prepare('UPDATE online_matches SET status = ?, completed_at = ? WHERE id = ?')
      .run(CANCELLED, Date.now(), match.id);
    return { success: true, cancelled: true, matchId: match.id };
  }

  static markCompleted(db, matchId, winnerUserId, now = Date.now()) {
    db.prepare(`
      UPDATE online_matches
      SET status = ?, completed_at = ?, winner_user_id = ?
      WHERE id = ? AND status != ?
    `).run(COMPLETED, now, winnerUserId, matchId, COMPLETED);
  }

  static opponentId(match, userId) {
    return match.host_user_id === userId ? match.guest_user_id : match.host_user_id;
  }
}
