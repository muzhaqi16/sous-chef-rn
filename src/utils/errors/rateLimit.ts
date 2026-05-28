import { getI18n } from '#/i18n/config';

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
  // Apollo Client 4 surfaces top-level GraphQL errors as `CombinedGraphQLErrors.errors`.
  errors?: GraphQLErrorLike[];
  extensions?: { code?: string; retryAfter?: number };
  message?: string;
}

function graphQLErrorsOf(err: ApolloErrorLike): GraphQLErrorLike[] | undefined {
  return err.graphQLErrors ?? err.errors;
}

function toErrorObject(error: unknown): ApolloErrorLike | null {
  if (error == null || typeof error !== 'object') return null;
  return error as ApolloErrorLike;
}

export function isRateLimitError(error: unknown): boolean {
  const err = toErrorObject(error);
  if (!err) return false;

  const graphQLErrors = graphQLErrorsOf(err);
  if (graphQLErrors) {
    return graphQLErrors.some(gqlErr =>
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

  const graphQLErrors = graphQLErrorsOf(err);
  if (graphQLErrors) {
    rateLimitError = graphQLErrors.find(gqlErr =>
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
      rateLimitError.message ||
      getI18n().t('errors.rateLimitGeneric', {
        defaultValue: 'Too many requests. Please try again later.',
      }),
  };
}

export function getRateLimitMessage(error: unknown): string {
  const i18n = getI18n();
  const details = getRateLimitDetails(error);
  if (!details) {
    return i18n.t('errors.rateLimitGeneric', {
      defaultValue: 'Too many requests. Please try again later.',
    });
  }

  if (details.retryAfter && details.retryAfter > 0) {
    if (details.retryAfter >= 60) {
      const minutes = Math.ceil(details.retryAfter / 60);
      return i18n.t('errors.rateLimitMinutes', {
        count: minutes,
        defaultValue:
          'Too many requests. Please try again in {{count}} minute(s).',
      });
    }
    return i18n.t('errors.rateLimitSeconds', {
      count: details.retryAfter,
      defaultValue:
        'Too many requests. Please try again in {{count}} second(s).',
    });
  }

  return details.message;
}
