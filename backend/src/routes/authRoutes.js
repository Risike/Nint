import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/password-reset', authLimiter, AuthController.requestPasswordReset);
router.post('/password-reset/confirm', authLimiter, AuthController.confirmPasswordReset);

router.get('/me', authenticateToken, AuthController.me);
router.patch('/me', authenticateToken, AuthController.updateMe);
router.delete('/me', authenticateToken, AuthController.deleteMe);

export default router;
