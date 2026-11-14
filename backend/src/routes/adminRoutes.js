import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { AdminController } from '../controllers/adminController.js';
import { ShopController } from '../controllers/shopController.js';

const router = Router();

// Public: reading the news message on homepage
router.get('/news', AdminController.getNews);

// Admin-only routes
router.delete('/leaderboards', requireAdmin, AdminController.clearLeaderboards);
router.get('/users', requireAdmin, AdminController.searchUsers);
router.get('/firebase/matches', requireAdmin, AdminController.getOldFirebaseMatches);
router.delete('/users/:userId/stats', requireAdmin, AdminController.clearUserStats);
router.delete('/users/:userId', requireAdmin, AdminController.deleteUser);
router.put('/news', requireAdmin, AdminController.setNews);
router.get('/shop', requireAdmin, ShopController.adminList);
router.post('/shop', requireAdmin, ShopController.adminCreate);
router.put('/shop/:itemId', requireAdmin, ShopController.adminUpdate);
router.delete('/shop/:itemId', requireAdmin, ShopController.adminDelete);

export default router;
