import { Router } from 'express';
import { MatchController } from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/queue', MatchController.getQueue);
router.post('/join', authenticateToken, MatchController.joinQueue);
router.post('/leave', authenticateToken, MatchController.leaveQueue);

export default router;
