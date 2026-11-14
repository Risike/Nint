import { AdminService } from '../services/adminService.js';

export class AdminController {
  static getOldFirebaseMatches(req, res, next) {
    try {
      const limit = Number.parseInt(req.query.limit, 10);
      res.json(AdminService.listOldOnlineMatches({ limit }));
    } catch (err) {
      next(err);
    }
  }

  static clearLeaderboards(req, res, next) {
    try {
      const result = AdminService.clearLeaderboards();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static searchUsers(req, res, next) {
    try {
      const query = req.query.q || '';
      const users = AdminService.searchUsers(query);
      res.json(users);
    } catch (err) {
      next(err);
    }
  }

  static clearUserStats(req, res, next) {
    try {
      const result = AdminService.clearUserStats(req.params.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static deleteUser(req, res, next) {
    try {
      const result = AdminService.deleteUser(req.params.userId, req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static getNews(req, res, next) {
    try {
      const result = AdminService.getNews();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static setNews(req, res, next) {
    try {
      const { message } = req.body;
      if (message === undefined || message === null) {
        return res.status(400).json({ error: 'Message field is required' });
      }
      if (String(message).length > 2000) {
        return res.status(400).json({ error: 'Message must be at most 2000 characters' });
      }
      const result = AdminService.setNews(String(message));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
