import { StatsService } from '../services/statsService.js';

export class MatchController {
  static recordMatch(req, res, next) {
    try {
      const userId = req.user.id;
      const result = StatsService.recordMatch(userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Future-proof endpoints for room & matchmaking metadata
  static createMatch(req, res) {
    const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    res.status(201).json({ matchId, status: 'created' });
  }

  static getMatch(req, res) {
    const { id } = req.params;
    res.json({ matchId: id, status: 'active' });
  }

  static forfeitMatch(req, res) {
    const { id } = req.params;
    res.json({ matchId: id, status: 'forfeited', winner: 'opponent' });
  }

  static rematch(req, res) {
    const { id } = req.params;
    res.json({ matchId: id, status: 'rematch_requested' });
  }

  static getQueue(req, res) {
    res.json({ queueLength: 0, estimatedWaitSeconds: 5 });
  }

  static joinQueue(req, res) {
    res.json({ status: 'queued', userId: req.user.id });
  }

  static leaveQueue(req, res) {
    res.json({ status: 'left' });
  }
}
