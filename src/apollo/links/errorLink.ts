import { ErrorLink } from '@apollo/client/link/error';
import type { ApolloLink } from '@apollo/client/link';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from '@apollo/client/errors';
import type { DefinitionNode } from 'graphql';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { isNetworkError } from '#/utils/isNetworkError';
import {
  isRefreshableAuthCode,
  isDeadRefreshTokenCode,
} from '#/utils/authErrorCodes';
import {
  isRateLimitError,
  getRateLimitMessage,
} from '#/utils/errors/rateLimit';
import { CLIENT_VERSION } from '../clientIdentity';
import { announceClientUpgradeRequired } from '../clientUpgradeNotice';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh, getRefreshState } from './refreshToken';
import { logger } from '#/utils/environment';
import { useStore } from '#store';

// Which auth refusals a refresh can clear (and which it can't) lives in
// #/utils/authErrorCodes, so this link, the refresh path and the offline queue
// all classify from one list. Classification is by code only — the message
// substring matching this replaced was both too wide and too narrow, buying a
// pointless refresh for any refusal whose prose contained "unauthorized" while
// missing AUTH_TOKEN_INVALID entirely.

// FORBIDDEN means the user doesn't have access to the resource — not an auth
// issue, and refreshing a perfectly good token can't grant access the user
// doesn't have, so it is deliberately absent from the refreshable set. It is
// the single authorization code, emitted on both channels: as a mutation
// result-union member (errors-as-data) and as the top-level `extensions.code`
// on rejected reads.
const isResourceAccessError = (code: string) => code === ErrorCode.Forbidden;

// A suspended, banned or deleted account has valid credentials but may not
// transact, so it gets its own code rather than a resource-access denial.
// `AUTH_ACCOUNT_SUSPENDED` is the signal; the prose-`reason` branch covers an
// older API and can go once every environment serves the code.
const isAccountInactiveError = (code: string, reason: string) =>
  code === ErrorCode.AuthAccountSuspended ||
  /suspended or deleted/i.test(reason);

// The key is baked into the build, so every code here is a build fault, not a
// recoverable session state. Matched on the exact codes — never message text,
// which would let a differently-worded refusal fall through to the auth branch
// and trigger a pointless token refresh. API_KEY_RATE_LIMITED stays a literal:
// it has no emitter, so it is absent from the published enum.
const API_KEY_ERROR_CODES: string[] = [
  TopLevelErrorCode.ApiKeyMissing,
  TopLevelErrorCode.ApiKeyInvalid,
  TopLevelErrorCode.ApiKeyExpired,
  TopLevelErrorCode.ApiKeyRevoked,
  'API_KEY_RATE_LIMITED',
];

const isApiKeyError = (code: string) => API_KEY_ERROR_CODES.includes(code);

// Deliberately distinct from API_KEY_INVALID: the key is valid but was issued
// without the permission this operation needs, so the fix is re-provisioning
// the key, not re-authenticating. `requiredPermission` names what was missing
// and is never masked, so it stays readable in production.
const API_KEY_INSUFFICIENT_PERMISSIONS =
  TopLevelErrorCode.ApiKeyInsufficientPermissions;

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
      if (code === TopLevelErrorCode.ClientUpgradeRequired) {
        logger.error(
          `App version ${CLIENT_VERSION} is below the server minimum (${String(
            err.extensions?.minimumVersion ?? 'unknown',
          )}); ${operation.operationName} refused until the app is updated`,
        );
        // Every operation is refused from here on, so the user needs to be told
        // once rather than left watching screens fail silently. The notice
        // de-duplicates across the flood of refusals this produces.
        announceClientUpgradeRequired();
        return;
      }

      // Terminal for the same reason CLIENT_UPGRADE_REQUIRED is: the credential
      // is fixed for this build, so a retry sends the same key and a refresh
      // succeeds and then fails identically. Signing out would be worse — the
      // user's session is perfectly valid, and this is a provisioning fault.
      // Bail out of the whole handler so nothing downstream tries to recover.
      if (code === API_KEY_INSUFFICIENT_PERMISSIONS) {
        logger.error(
          `API key lacks ${String(
            err.extensions?.requiredPermission ?? 'a required permission',
          )} for ${
            operation.operationName
          }; the key needs re-provisioning — ${message}`,
        );
        return;
      }

      if (isApiKeyError(code)) {
        logger.error('API Key error:', message);
        continue;
      }

      // Before the resource-access branch: the prose fallback arrives as
      // FORBIDDEN and would otherwise `continue` past it. `endSession`, not
      // `clearAuth` — clearing tokens alone leaves this account's entities in
      // the persisted cache for whoever signs in next.
      if (isAccountInactiveError(code, String(err.extensions?.reason || ''))) {
        logger.error(
          `Account inactive (${operation.operationName}) — ending session`,
        );
        void useStore.getState().endSession('account_inactive');
        return;
      }

      // The refresh token is gone or rejected, so the refresh branch below has
      // nothing left to exchange. Ending the session here rather than letting it
      // try keeps a dead session from spending a doomed round trip per failing
      // operation, and lands the user on sign-in instead of stranding them on
      // cached data. Reached only when an ordinary operation carries the code —
      // the refresh mutation's own rejection is handled in refreshToken.ts.
      if (isDeadRefreshTokenCode(code)) {
        logger.error(
          `Refresh token rejected (${operation.operationName}) — ending session`,
        );
        void useStore.getState().endSession('refresh_token_dead');
        return;
      }

      if (isResourceAccessError(code)) {
        logger.warn(`Access denied for ${operation.operationName}: ${message}`);
        continue;
      }

      if (
        isRefreshableAuthCode(code) &&
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

    // Network errors are neither logged (networkStatusLink sits above retryLink
    // and logs once per operation; this sits below and would log every attempt)
    // nor re-forwarded (retryLink owns retry policy, so forwarding would double
    // query retries and RE-SEND mutations — a duplicate-write risk).
    if (isNetworkError(error)) {
      return;
    }

    // Only log non-network errors as these are unexpected
    logger.error(
      `Unexpected error [${operation.operationName}]:`,
      error.message,
    );
  }
});
