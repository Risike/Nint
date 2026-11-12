import { Router } from 'express';
import { MatchController } from '../controllers/matchController.js';
import { authenticateToken, authenticateTokenOrBody } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/online', writeLimiter, authenticateToken, MatchController.createOnline);
router.post('/online/:matchId/join', writeLimiter, authenticateToken, MatchController.joinOnline);
router.post('/online/:matchId/rematch', writeLimiter, authenticateToken, MatchController.rematchOnline);
router.post('/record', writeLimiter, authenticateToken, MatchController.recordMatch);
router.post('/forfeit', writeLimiter, authenticateTokenOrBody, MatchController.settleForfeit);

export default router;
