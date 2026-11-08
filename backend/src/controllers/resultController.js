import { ResultService } from '../services/resultService.js';

export class ResultController {
  static submit(req, res, next) {
    try {
      // Reject guests – they have no JWT
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required to submit scores' });
    }
    const userId = req.user.id;
      const result = ResultService.submitResult(userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static getMyResults(req, res, next) {
    try {
      // Reject guests – they have no JWT
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required to submit scores' });
    }
    const userId = req.user.id;
      const { mode, limit } = req.query;
      const results = ResultService.getUserResults(userId, mode, limit ? parseInt(limit, 10) : 20);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
}
