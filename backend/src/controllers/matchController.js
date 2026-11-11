import { StatsService } from '../services/statsService.js';

export class MatchController {
  static recordMatch(req, res, next) {
    try {
      const result = StatsService.recordMatch(req.user.id, req.body || {});
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static settleForfeit(req, res, next) {
    try {
      const result = StatsService.settleForfeit(req.user.id, req.body || {});
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}
