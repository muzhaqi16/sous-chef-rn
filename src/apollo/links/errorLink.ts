import { ErrorLink } from '@apollo/client/link/error';
import type { ApolloLink } from '@apollo/client/link';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from '@apollo/client/errors';
import type { DefinitionNode } from 'graphql';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { isNetworkError } from '#/utils/isNetworkError';
import {
  isRateLimitError,
  getRateLimitMessage,
} from '#/utils/errors/rateLimit';
import { CLIENT_VERSION } from '../clientIdentity';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh, getRefreshState } from './refreshToken';
import { logger } from '#/utils/environment';
import { useStore } from '#store';

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
// — not an auth issue (no token refresh). Both codes are current, on different
// channels: FORBIDDEN is what the mutation result-union member (errors-as-data)
// and the @auth directive emit; AUTHZ_FORBIDDEN is the top-level
// `extensions.code` on rejected reads. Both branches are load-bearing.
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

      // The build is below the server's minimum version. Terminal by
      // definition — a retry sends the same version, and a token refresh
      // succeeds and then fails identically — so bail out of the whole handler
      // before anything downstream tries to recover from it.
      if (code === 'CLIENT_UPGRADE_REQUIRED') {
        logger.error(
          `App version ${CLIENT_VERSION} is below the server minimum (${String(
            err.extensions?.minimumVersion ?? 'unknown',
          )}); ${operation.operationName} refused until the app is updated`,
        );
        return;
      }

      if (isApiKeyError(code, message)) {
        logger.error('API Key error:', message);
        continue;
      }

      if (isResourceAccessError(code)) {
        // The @auth directive rejects EVERY field for a suspended/deleted
        // account with FORBIDDEN + this reason. Staying "logged in" would
        // strand the user on cached data with all requests failing — end the
        // session so they land on sign-in. Defensive substring match on the
        // server's reason string (a dedicated code is requested upstream);
        // ordinary resource-level FORBIDDEN stays non-fatal below.
        const reason = String(err.extensions?.reason || '');
        if (/suspended or deleted/i.test(reason)) {
          logger.error(
            `Account inactive (${operation.operationName}) — ending session`,
          );
          useStore.getState().clearAuth();
          return;
        }
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
      // Network-error logging lives in networkStatusLink, which sits ABOVE
      // retryLink and so emits one warning per operation — this link sits
      // BELOW retryLink and would log every retry attempt (a wall of identical
      // warnings on an offline cold start). Just let the error propagate:
      // retryLink owns query-retry policy (backoff/jitter, skips mutations),
      // and errorPolicy + the cache-and-network fetch policy keep cached data
      // visible. Re-forwarding here would double query retries AND re-send
      // mutations (a duplicate-write risk for non-idempotent ones).
      return;
    }

    // Only log non-network errors as these are unexpected
    logger.error(
      `Unexpected error [${operation.operationName}]:`,
      error.message,
    );
  }
});
