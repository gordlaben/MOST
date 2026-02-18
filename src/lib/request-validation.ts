import { ZodType } from 'zod';
import { jsonError } from '@/lib/http-response';

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  errorResponse: ReturnType<typeof jsonError>;
};

export async function parseAndValidateJson<T>(
  request: Request,
  schema: ZodType<T>,
  invalidMessage = 'Invalid request body'
): Promise<ValidationSuccess<T> | ValidationFailure> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      errorResponse: jsonError(invalidMessage, 400),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      errorResponse: jsonError(invalidMessage, 400),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

export function validateQuery<T>(
  schema: ZodType<T>,
  query: unknown,
  invalidMessage = 'Invalid query parameters'
): ValidationSuccess<T> | ValidationFailure {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    return {
      success: false,
      errorResponse: jsonError(invalidMessage, 400),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
