import { Router } from 'express';
import { MatchController } from '../controllers/matchController.js';
import { authenticateToken, authenticateTokenOrBody } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/record', writeLimiter, authenticateToken, MatchController.recordMatch);
router.post('/forfeit', writeLimiter, authenticateTokenOrBody, MatchController.settleForfeit);

export default router;
