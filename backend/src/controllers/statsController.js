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
      const stats = StatsService.getUserStats(userId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
}
