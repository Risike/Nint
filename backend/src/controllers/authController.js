import { AuthService } from '../services/authService.js';

export class AuthController {
  static register(req, res, next) {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Email, password, and display name are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const result = AuthService.register({ email, password, displayName });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const result = AuthService.login({ email, password });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static logout(req, res) {
    res.json({ success: true, message: 'Logged out successfully' });
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
      const { displayName, avatarUrl, newPassword, currentPassword } = req.body;
      const updated = AuthService.updateProfile(req.user.id, { displayName, avatarUrl, newPassword, currentPassword });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static deleteMe(req, res, next) {
    try {
      const { password } = req.body;
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
      const { email } = req.body;
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
      const { token, newPassword } = req.body;
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
