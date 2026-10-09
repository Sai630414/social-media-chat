import 'dotenv/config';
import { createServer } from 'node:http';
import { app, logger } from './app.js';
import { connectDatabase } from './config/database.js';
import { clientOrigins, env } from './config/env.js';
import { attachSockets } from './sockets/index.js';
import { setNotificationSocket } from './services/notificationService.js';
const server = createServer(app);
try {
  await connectDatabase(env.MONGODB_URI);
  const io = attachSockets(server, clientOrigins);
  setNotificationSocket(io);
  await new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(env.PORT, '0.0.0.0');
  });
  logger.info({ port: env.PORT }, 'server listening');

  let shutdownPromise;
  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;
    logger.info({ signal }, 'shutting down');
    const forceShutdown = setTimeout(() => {
      logger.error('graceful shutdown timed out');
      process.exit(1);
    }, 15_000);
    forceShutdown.unref();
    shutdownPromise = (async () => {
      const mongoose = await import('mongoose');
      await new Promise((resolve) => io.close(resolve));
      await mongoose.default.disconnect();
      clearTimeout(forceShutdown);
    })().catch((error) => {
      logger.error({ err: error }, 'graceful shutdown failed');
      process.exitCode = 1;
    });
    return shutdownPromise;
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  const message = String(error?.message || 'Startup failed').replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[redacted MongoDB URI]');
  logger.fatal({ name: error?.name, code: error?.code, message }, 'server startup failed');
  process.exit(1);
}
