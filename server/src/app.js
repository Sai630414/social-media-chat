import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clientOrigins, env } from './config/env.js';
import { requireAuth } from './middleware/requireAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import profileRoutes from './routes/profileRoutes.js';
import postRoutes from './routes/postRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
export const logger = pino({ level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] });
export const app = express();
app.disable('x-powered-by'); app.set('trust proxy', env.TRUST_PROXY_HOPS); app.use(helmet()); app.use(cors({ origin: clientOrigins, credentials: true })); app.use(express.json({ limit: '100kb' })); app.use(pinoHttp({ logger }));
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/v1', requireAuth);
app.use('/api/v1/profiles', profileRoutes); app.use('/api/v1/users', profileRoutes); app.use('/api/v1/posts', postRoutes); app.use('/api/v1/notifications', notificationRoutes); app.use('/api/v1/media', mediaRoutes); app.use('/api/v1/conversations', conversationRoutes); app.use('/api/v1/reports', reportRoutes);
const clientBuild = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (existsSync(clientBuild)) {
  app.use(express.static(clientBuild, { index: false, setHeaders: (res, filePath) => {
    if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(fileURLToPath(new URL('../../client/dist/index.html', import.meta.url)), (error) => { if (error) next(error); });
  });
}
app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } })); app.use(errorHandler);
