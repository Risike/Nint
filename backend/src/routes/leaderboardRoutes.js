import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboardController.js';

const router = Router();

router.get('/:mode', LeaderboardController.getLeaderboard);

export default router;
