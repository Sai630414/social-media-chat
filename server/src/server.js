import 'dotenv/config';
import { createServer } from 'node:http';
import { app, logger } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { attachSockets } from './sockets/index.js';
import { setNotificationSocket } from './services/notificationService.js';
const server = createServer(app);
try { await connectDatabase(process.env.MONGODB_URI); const io = attachSockets(server, env.CLIENT_URL.split(',').map((s) => s.trim())); setNotificationSocket(io); server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'server listening')); const shutdown = async (signal) => { logger.info({ signal }, 'shutting down'); io.close(); server.close(); const mongoose = await import('mongoose'); await mongoose.default.disconnect(); process.exit(0); }; process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown); } catch (error) { logger.fatal({ err: error }, 'server startup failed'); process.exit(1); }
