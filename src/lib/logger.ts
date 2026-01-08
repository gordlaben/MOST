export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, data?: unknown) => {
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    console.log(`[INFO] ${getTimestamp()} : ${message}${dataStr}`);
  },
  
  warn: (message: string, data?: unknown) => {
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    console.warn(`[WARN] ${getTimestamp()} : ${message}${dataStr}`);
  },
  
  error: (message: string, error?: unknown) => {
    let errorStr = '';
    if (error instanceof Error) {
        errorStr = ` | Error: ${error.message}\n${error.stack}`;
    } else if (error) {
        errorStr = ` | Error: ${JSON.stringify(error)}`;
    }
    console.error(`[ERROR] ${getTimestamp()} : ${message}${errorStr}`);
  },

  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
      console.debug(`[DEBUG] ${getTimestamp()} : ${message}${dataStr}`);
    }
  }
};

