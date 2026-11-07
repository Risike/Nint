import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, SettingsController.getSettings);
router.put('/', authenticateToken, SettingsController.updateSettings);

export default router;
