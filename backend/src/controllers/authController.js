import { config } from '../config/env.js';
import { AuthService } from '../services/authService.js';

export class AuthController {
  static getCaptchaConfig(req, res) {
    res.json({ siteKey: config.turnstileSiteKey, enabled: Boolean(config.turnstileSiteKey) });
  }

  static async register(req, res, next) {
    try {
      const { email, password, displayName, username, captchaToken } = req.body || {};
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Email, password, and display name are required' });
      }
      const result = await AuthService.register({
        email,
        password,
        displayName,
        username,
        captchaToken,
        captchaIp: req.ip
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async verifyEmail(req, res, next) {
    try {
      const { email, code } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ error: 'Email and verification code are required' });
      }
      res.json(AuthService.verifyEmail({ email, code }));
    } catch (err) {
      next(err);
    }
  }

  static async resendVerification(req, res, next) {
    try {
      const { email } = req.body || {};
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      res.json(await AuthService.resendVerification({ email }));
    } catch (err) {
      next(err);
    }
  }

  static login(req, res, next) {
    try {
      const { email, identifier, password } = req.body || {};
      const loginId = identifier ?? email;
      if (!loginId || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email/username and password are required' });
      }
      const result = AuthService.login({ identifier: loginId, password });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static logout(req, res, next) {
    try {
      const result = AuthService.logout(req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static me(req, res, next) {
    try {
      const profile = AuthService.getProfile(req.user.id);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  static updateMe(req, res, next) {
    try {
      const { displayName, avatarUrl, newPassword, currentPassword } = req.body || {};
      const updated = AuthService.updateProfile(req.user.id, { displayName, avatarUrl, newPassword, currentPassword });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static deleteMe(req, res, next) {
    try {
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ error: 'Password required to delete account' });
      }
      const result = AuthService.deleteAccount(req.user.id, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body || {};
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const result = AuthService.requestPasswordReset(email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static confirmPasswordReset(req, res, next) {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }
      const result = AuthService.confirmPasswordReset({ token, newPassword });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
