import { Router } from 'express';
import { MatchController } from '../controllers/matchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/record', authenticateToken, MatchController.recordMatch);
router.post('/', authenticateToken, MatchController.createMatch);
router.get('/:id', authenticateToken, MatchController.getMatch);
router.post('/:id/forfeit', authenticateToken, MatchController.forfeitMatch);
router.post('/:id/rematch', authenticateToken, MatchController.rematch);

export default router;
