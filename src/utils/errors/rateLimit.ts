import { getI18n } from '#/i18n/config';
import { TopLevelErrorCode } from '#/utils/errors/topLevelErrorCodes';

// Match on the exact code — never on a `RATE_` prefix. OPERATION_RATE_LIMITED
// deliberately doesn't carry it (docs/api/errors.md), so a prefix test would
// silently drop every per-operation limit.
// Only RATE_LIMIT_EXCEEDED and OPERATION_RATE_LIMITED are declared in the
// published TopLevelErrorCode enum, which admits a code only once something
// emits it. The rest live in the API's internal registry without an emitter, so
// they stay literals — kept defensively rather than promoted.
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
