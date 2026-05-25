const RATE_LIMIT_CODES = [
  'RATE_LIMITED',
  'RATE_LIMIT_EXCEEDED',
  'RATE_LIMIT_IP_BLOCKED',
  'RATE_LIMIT_USER_BLOCKED',
  'RATE_LIMIT_API_KEY_BLOCKED',
];

export interface RateLimitDetails {
  retryAfter: number | null;
  message: string;
}

export function isRateLimitError(error: any): boolean {
  if ('graphQLErrors' in error && error.graphQLErrors) {
    return error.graphQLErrors.some((err: any) =>
      RATE_LIMIT_CODES.includes(err.extensions?.code),
    );
  }

  if ('extensions' in error && error.extensions) {
    return RATE_LIMIT_CODES.includes(error.extensions.code);
  }

  return false;
}

export function getRateLimitDetails(error: any): RateLimitDetails | null {
  let rateLimitError: any | undefined;

  if ('graphQLErrors' in error && error.graphQLErrors) {
    rateLimitError = error.graphQLErrors.find((err: any) =>
      RATE_LIMIT_CODES.includes(err.extensions?.code),
    );
  } else if (
    'extensions' in error &&
    RATE_LIMIT_CODES.includes(error.extensions?.code)
  ) {
    rateLimitError = error;
  }

  if (!rateLimitError) return null;

  return {
    retryAfter:
      typeof rateLimitError.extensions?.retryAfter === 'number'
        ? rateLimitError.extensions.retryAfter
        : null,
    message:
      rateLimitError.message || 'Too many requests. Please try again later.',
  };
}

export function getRateLimitMessage(error: any): string {
  const details = getRateLimitDetails(error);
  if (!details) return 'Too many requests. Please try again later.';

  if (details.retryAfter && details.retryAfter > 0) {
    if (details.retryAfter >= 60) {
      const minutes = Math.ceil(details.retryAfter / 60);
      return `Too many requests. Please try again in ${minutes} minute${
        minutes > 1 ? 's' : ''
      }.`;
    }
    return `Too many requests. Please try again in ${
      details.retryAfter
    } second${details.retryAfter > 1 ? 's' : ''}.`;
  }

  return details.message;
}
