import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/me', authenticateToken, StatsController.getMyStats);
router.get('/:userId', StatsController.getUserStats);

export default router;
