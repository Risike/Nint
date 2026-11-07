import { Router } from 'express';
import authRoutes from './authRoutes.js';
import resultRoutes from './resultRoutes.js';
import leaderboardRoutes from './leaderboardRoutes.js';
import statsRoutes from './statsRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import matchRoutes from './matchRoutes.js';
import matchmakingRoutes from './matchmakingRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nint-api', timestamp: Date.now() });
});

router.use('/auth', authRoutes);
router.use('/results', resultRoutes);
router.use('/leaderboards', leaderboardRoutes);
router.use('/stats', statsRoutes);
router.use('/settings', settingsRoutes);
router.use('/matches', matchRoutes);
router.use('/matchmaking', matchmakingRoutes);

export default router;
