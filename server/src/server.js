import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import { createScan } from './controllers/chatController.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();
app.use(helmet());
const allowedOrigins = new Set([process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean));
app.use(cors({ origin: (origin, callback) => {
	const isLocalDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
	if (!origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin) return callback(null, true);
	return callback(new Error('Origin is not allowed by CORS'));
} }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'factx-ai' }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.post('/api/verify', optionalAuth, createScan);
app.use('/api/chat', chatRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
connectDatabase().then(() => app.listen(port, () => console.log(`API listening on ${port}`))).catch((error) => { console.error(error); process.exit(1); });
