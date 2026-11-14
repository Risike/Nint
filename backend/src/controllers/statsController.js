import { StatsService } from '../services/statsService.js';

export class StatsController {
  static getMyStats(req, res, next) {
    try {
      const stats = StatsService.getUserStats(req.user.id, { includeCredits: true });
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }

  static getUserStats(req, res, next) {
    try {
      const { userId } = req.params;
      // Public profiles expose aggregates only: recent match rows contain the
      // opponent ids and match ids of someone else's games.
      const stats = StatsService.getUserStats(userId, { includeRecentMatches: false });
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
}
