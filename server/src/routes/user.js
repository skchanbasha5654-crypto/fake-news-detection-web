import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.get('/profile', requireAuth, async (req, res) => res.json({ user: await User.findById(req.userId).select('name email createdAt') }));
export default router;
