import { SettingsService } from '../services/settingsService.js';

export class SettingsController {
  static getSettings(req, res, next) {
    try {
      const settings = SettingsService.getSettings(req.user.id);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  static updateSettings(req, res, next) {
    try {
      const updated = SettingsService.updateSettings(req.user.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}
