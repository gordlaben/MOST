import { logger } from '@/lib/logger';

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable-context]';
  }
}

export function logRouteError(
  route: string,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  if (context && Object.keys(context).length > 0) {
    logger.error(`${route}: ${message} | context=${safeStringify(context)}`, error);
    return;
  }

  logger.error(`${route}: ${message}`, error);
}
