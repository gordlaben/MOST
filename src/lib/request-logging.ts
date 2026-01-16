import { randomUUID } from 'crypto';
import { logger } from './logger';

export interface RequestLogger {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
}

export interface RequestContext {
  requestId: string;
  startTime: number;
  log: RequestLogger;
  end: (status?: number) => void;
}

export function createRequestContext(request: Request, scope: string): RequestContext {
  const requestId = randomUUID();
  const startTime = Date.now();
  const url = new URL(request.url);
  const prefix = `[${requestId}] ${scope}`;

  const log: RequestLogger = {
    info: (message, data) => logger.info(`${prefix} ${message}`, data),
    warn: (message, data) => logger.warn(`${prefix} ${message}`, data),
    error: (message, error) => logger.error(`${prefix} ${message}`, error),
    debug: (message, data) => logger.debug(`${prefix} ${message}`, data)
  };

  const end = (status?: number) => {
    const durationMs = Date.now() - startTime;
    log.info('Completed', {
      status,
      durationMs,
      method: request.method,
      path: url.pathname
    });
  };

  return { requestId, startTime, log, end };
}
