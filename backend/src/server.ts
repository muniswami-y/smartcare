import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { initBackgroundJobs } from './jobs';
import { getDatabaseClient } from '@caresmart/database';

const app = createApp();
const prisma = getDatabaseClient();

const server = app.listen(config.PORT, () => {
  logger.info(`CareSmart Server running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
  initBackgroundJobs();
});

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully terminating CareSmart server...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database client disconnected. Process exit.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
