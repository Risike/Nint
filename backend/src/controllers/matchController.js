import { StatsService } from '../services/statsService.js';
import { OnlineMatchService } from '../services/onlineMatchService.js';

export class MatchController {
  static createOnline(req, res, next) {
    try {
      res.status(201).json(OnlineMatchService.create(req.user.id, req.body || {}));
    } catch (err) {
      next(err);
    }
  }

  static getOnline(req, res, next) {
    try {
      res.json(OnlineMatchService.getDetails(req.user.id, req.params.matchId));
    } catch (err) {
      next(err);
    }
  }

  static getOnlineResult(req, res, next) {
    try {
      res.json(StatsService.getOnlineMatchResult(req.user.id, req.params.matchId));
    } catch (err) {
      next(err);
    }
  }

  static joinOnline(req, res, next) {
    try {
      res.json(OnlineMatchService.join(req.user.id, req.params.matchId));
    } catch (err) {
      next(err);
    }
  }

  static rematchOnline(req, res, next) {
    try {
      res.status(201).json(OnlineMatchService.rematch(req.user.id, req.params.matchId));
    } catch (err) {
      next(err);
    }
  }

  static awardCoopCredits(req, res, next) {
    try {
      const result = StatsService.awardCoopCredits(
        req.user.id,
        req.params.matchId,
        req.body || {}
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

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
