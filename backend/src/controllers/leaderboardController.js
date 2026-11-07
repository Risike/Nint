import { LeaderboardService } from '../services/leaderboardService.js';

export class LeaderboardController {
  static getLeaderboard(req, res, next) {
    try {
      const { mode } = req.params;
      const { limit = 50, offset = 0, timeframe = 'all' } = req.query;
      const result = LeaderboardService.getLeaderboard(mode, {
        limit: Math.min(parseInt(limit, 10) || 50, 100),
        offset: parseInt(offset, 10) || 0,
        timeframe
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
