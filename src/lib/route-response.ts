import { ServerTiming } from '@/lib/server-timing';
import { RequestContext } from '@/lib/request-logging';

export function finalizeApiResponse(
  response: Response,
  options: {
    ctx: RequestContext;
    timing?: ServerTiming;
    metricName?: string;
  }
) {
  if (options.timing) {
    options.timing.appendTo(response, options.metricName);
  }

  options.ctx.end(response.status);
  return response;
}
