import { Router } from 'express';
import { ResultController } from '../controllers/resultController.js';
import { authenticateToken } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', writeLimiter, authenticateToken, ResultController.submit);
router.get('/me', authenticateToken, ResultController.getMyResults);

export default router;
