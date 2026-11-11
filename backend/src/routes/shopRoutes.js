import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { ShopController } from '../controllers/shopController.js';

const router = Router();

router.get('/', authenticateToken, ShopController.getShop);
router.post('/purchase', writeLimiter, authenticateToken, ShopController.purchase);
router.post('/equip', writeLimiter, authenticateToken, ShopController.equip);

export default router;
