import { ResultService } from '../services/resultService.js';

export class ResultController {
  static submit(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required to submit scores' });
      }
      const result = ResultService.submitResult(req.user.id, req.body || {});
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static getMyResults(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required to read scores' });
      }
      const { mode, limit } = req.query;
      const parsedLimit = Number.parseInt(limit, 10);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 20;
      const results = ResultService.getUserResults(req.user.id, mode, safeLimit);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
}
