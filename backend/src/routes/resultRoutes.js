import { Router } from 'express';
import { ResultController } from '../controllers/resultController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticateToken, ResultController.submit);
router.get('/me', authenticateToken, ResultController.getMyResults);

export default router;
