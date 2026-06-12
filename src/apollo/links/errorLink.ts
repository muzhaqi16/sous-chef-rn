import { ErrorLink } from '@apollo/client/link/error';
import type { ApolloLink } from '@apollo/client/link';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from '@apollo/client/errors';
import type { DefinitionNode } from 'graphql';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { isNetworkError } from '#/utils/isNetworkError';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import {
  isRateLimitError,
  getRateLimitMessage,
} from '#/utils/errors/rateLimit';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh, getRefreshState } from './refreshToken';
import { logger } from '#/utils/environment';

// Utility functions for error detection
// Note: FORBIDDEN is intentionally NOT included here - it's a resource access error, not an auth error
// Treating FORBIDDEN as auth error causes unnecessary token refresh cycles
const isAuthError = (code: string, msg: string) =>
  code === 'UNAUTHENTICATED' ||
  code === 'AUTH_TOKEN_EXPIRED' ||
  ['expired', 'unauthorized', 'invalid token', 'jwt'].some(term =>
    msg.toLowerCase().includes(term),
  );

// FORBIDDEN / AUTHZ_FORBIDDEN mean the user doesn't have access to the resource
// — not an auth issue (no token refresh). AUTHZ_FORBIDDEN is the API's current
// code; FORBIDDEN is the legacy alias still emitted by some resolvers.
const isResourceAccessError = (code: string) =>
  code === 'FORBIDDEN' || code === 'AUTHZ_FORBIDDEN';

const isApiKeyError = (code: string, msg: string) =>
  ['API_KEY_REQUIRED', 'INVALID_API_KEY', 'API_KEY_EXPIRED'].includes(code) ||
  msg.toLowerCase().includes('api key');

const isSubscription = (op: Pick<ApolloLink.Operation, 'query'>) =>
  op.query.definitions.some(
    (def: DefinitionNode) =>
      def.kind === 'OperationDefinition' && def.operation === 'subscription',
  );

export const errorLink = new ErrorLink(({ error, operation, forward }) => {
  if (operation.getContext().skipErrorLink || LogoutCleanup.isInLogoutProcess())
    return;

  // Check if token refresh is in progress to suppress cascade of auth errors
  const { isRefreshing } = getRefreshState();

  if (CombinedGraphQLErrors.is(error)) {
    if (isRateLimitError(error)) {
      logger.warn(
        `Rate limited [${operation.operationName}]: ${getRateLimitMessage(
          error,
        )}`,
      );
      return;
    }

    for (const err of error.errors) {
      const code = String(err.extensions?.code || '');
      const message = String(err.message || '');

      if (isApiKeyError(code, message)) {
        logger.error('API Key error:', message);
        continue;
      }

      if (isResourceAccessError(code)) {
        logger.warn(`Access denied for ${operation.operationName}: ${message}`);
        continue;
      }

      if (
        isAuthError(code, message) &&
        operation.operationName !== 'RefreshToken'
      ) {
        // Suppress logging if refresh already in progress to avoid cascade
        if (!isRefreshing) {
          logger.warn(
            `Auth error detected for ${operation.operationName}, initiating token refresh`,
          );
        }
        return attemptTokenRefresh(operation, forward);
      }
    }
  } else if (!CombinedProtocolErrors.is(error)) {
    // Check for known server errors first
    if (
      isSubscription(operation) &&
      isKnownServerError({ message: error.message })
    ) {
      logger.warn(
        `Known server error for ${operation.operationName}:`,
        error.message,
      );
      return;
    }

    // For network errors, log and let the error propagate. retryLink (above this
    // link) owns query-retry policy with backoff/jitter and deliberately skips
    // mutations — re-forwarding here would double query retries AND re-send
    // mutations (a duplicate-write risk for non-idempotent ones). Returning void
    // makes Apollo emit the networkError to the observer, where errorPolicy plus
    // the cache-and-network fetch policy keep cached data visible.
    if (isNetworkError(error)) {
      // Expected-noise suppression. This link sits BELOW retryLink, so it sees
      // every retry attempt, and one WS drop errors every active subscription
      // at once — an offline cold start used to produce a wall of identical
      // warnings. Log only the surprising case: a network error while the
      // store still believes the API is reachable. Once offline / circuit
      // open, the breaker's one-line verdict and networkStatusLink's
      // per-operation failure counter are the signal. Subscription transport
      // errors are SubscriptionService's to report.
      const state = useStore.getState();
      if (
        !isSubscription(operation) &&
        !state.offlineModeEnabled &&
        !isApiUnavailable(state)
      ) {
        logger.warn(
          `Network error for ${operation.operationName}:`,
          error.message,
        );
      }
      return;
    }

    // Only log non-network errors as these are unexpected
    logger.error(
      `Unexpected error [${operation.operationName}]:`,
      error.message,
    );
  }
});
