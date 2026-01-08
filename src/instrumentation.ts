import { logger } from './lib/logger';

export async function register() {
  logger.info('Most application starting up...');
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Base URL: ${process.env.NEXT_PUBLIC_BASE_URL}`);
}
