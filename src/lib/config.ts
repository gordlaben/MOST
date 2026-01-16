import { z } from 'zod';
import { logger } from './logger';

const envSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  TRAKT_CLIENT_ID: z.string().optional(),
  TRAKT_CLIENT_SECRET: z.string().optional(),
  ENABLE_REGISTRATION: z.string().optional()
});

export function getAppConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.warn('Invalid environment configuration detected', parsed.error.flatten());
  }

  const data = parsed.success ? parsed.data : process.env;

  return {
    nextPublicBaseUrl: data.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    appUrl: data.APP_URL || undefined,
    traktClientId: data.TRAKT_CLIENT_ID || undefined,
    traktClientSecret: data.TRAKT_CLIENT_SECRET || undefined,
    enableRegistration: data.ENABLE_REGISTRATION !== 'false'
  };
}
