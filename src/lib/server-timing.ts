export interface ServerTiming {
  appendTo: (response: Response, metricName?: string) => void;
}

export function createServerTiming(startTime?: number): ServerTiming {
  const start = startTime ?? Date.now();

  return {
    appendTo: (response: Response, metricName = 'app') => {
      const durationMs = Date.now() - start;
      const existing = response.headers.get('Server-Timing');
      const value = `${metricName};dur=${durationMs}`;
      response.headers.set('Server-Timing', existing ? `${existing}, ${value}` : value);
    }
  };
}
