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

interface GraphQLErrorLike {
  extensions?: { code?: string; retryAfter?: number };
  message?: string;
}

interface ApolloErrorLike {
  graphQLErrors?: GraphQLErrorLike[];
  extensions?: { code?: string; retryAfter?: number };
  message?: string;
}

function toErrorObject(error: unknown): ApolloErrorLike | null {
  if (error == null || typeof error !== 'object') return null;
  return error as ApolloErrorLike;
}

export function isRateLimitError(error: unknown): boolean {
  const err = toErrorObject(error);
  if (!err) return false;

  if (err.graphQLErrors) {
    return err.graphQLErrors.some(gqlErr =>
      RATE_LIMIT_CODES.includes(gqlErr.extensions?.code ?? ''),
    );
  }

  if (err.extensions) {
    return RATE_LIMIT_CODES.includes(err.extensions.code ?? '');
  }

  return false;
}

export function getRateLimitDetails(error: unknown): RateLimitDetails | null {
  const err = toErrorObject(error);
  if (!err) return null;

  let rateLimitError: GraphQLErrorLike | undefined;

  if (err.graphQLErrors) {
    rateLimitError = err.graphQLErrors.find(gqlErr =>
      RATE_LIMIT_CODES.includes(gqlErr.extensions?.code ?? ''),
    );
  } else if (RATE_LIMIT_CODES.includes(err.extensions?.code ?? '')) {
    rateLimitError = err;
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

export function getRateLimitMessage(error: unknown): string {
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
