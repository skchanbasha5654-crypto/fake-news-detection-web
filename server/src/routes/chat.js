import { Router } from 'express';
import { createScan, history } from '../controllers/chatController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();
router.use(optionalAuth);
router.post('/message', createScan);
router.post('/verify', createScan);
router.get('/history', history);

export default router;
