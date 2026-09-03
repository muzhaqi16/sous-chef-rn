import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

// Exact codes, never a `RATE_` prefix: OPERATION_RATE_LIMITED does not carry it,
// so a prefix test drops every per-operation limit. Only two are declared in the
// published enum (which admits a code once something emits it); the rest are
// registry-only and stay literals.
const RATE_LIMIT_CODES: string[] = [
  'RATE_LIMITED',
  // The global budget. Carries `resetAt` rather than `retryAfter`, so the
  // message below falls back to the server's text for it.
  TopLevelErrorCode.RateLimitExceeded,
  'RATE_LIMIT_IP_BLOCKED',
  'RATE_LIMIT_USER_BLOCKED',
  'RATE_LIMIT_API_KEY_BLOCKED',
  // Two more rate-limit conditions that live outside the RATE_ family — one in
  // the API_ family, one in EXTERNAL_. Without them a throttled request skips
  // rate-limit classification entirely and loses its `retryAfter`.
  'API_KEY_RATE_LIMITED',
  'EXTERNAL_API_RATE_LIMITED',
  // A single operation's own budget, stricter than and separate from the global
  // one — ~30 operations have one (createItemSuggestion: 10/hour), so this fires
  // while well under RATE_LIMIT_EXCEEDED. Both must be handled.
  TopLevelErrorCode.OperationRateLimited,
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
      t('errors.rateLimitGeneric', {
        defaultValue: 'Too many requests. Please try again later.',
      }),
  };
}

export function getRateLimitMessage(error: unknown): string {
  const details = getRateLimitDetails(error);
  if (!details) {
    return t('errors.rateLimitGeneric', {
      defaultValue: 'Too many requests. Please try again later.',
    });
  }

  if (details.retryAfter && details.retryAfter > 0) {
    if (details.retryAfter >= 60) {
      const minutes = Math.ceil(details.retryAfter / 60);
      return t('errors.rateLimitMinutes', {
        count: minutes,
        defaultValue:
          'Too many requests. Please try again in {{count}} minute(s).',
      });
    }
    return t('errors.rateLimitSeconds', {
      count: details.retryAfter,
      defaultValue:
        'Too many requests. Please try again in {{count}} second(s).',
    });
  }

  return details.message;
}
