import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { AdminController } from '../controllers/adminController.js';

const router = Router();

// Public: reading the news message on homepage
router.get('/news', AdminController.getNews);

// Admin-only routes
router.delete('/leaderboards', requireAdmin, AdminController.clearLeaderboards);
router.get('/users', requireAdmin, AdminController.searchUsers);
router.delete('/users/:userId/stats', requireAdmin, AdminController.clearUserStats);
router.delete('/users/:userId', requireAdmin, AdminController.deleteUser);
router.put('/news', requireAdmin, AdminController.setNews);

export default router;
