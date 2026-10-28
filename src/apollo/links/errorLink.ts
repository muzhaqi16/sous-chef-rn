import { ErrorLink } from '@apollo/client/link/error';
import type { ApolloLink } from '@apollo/client/link';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from '@apollo/client/errors';
import { Kind, OperationTypeNode, type DefinitionNode } from 'graphql';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isNonIterableSubscriptionResolver } from '#utils/errors/libraryErrorMessages';
import { isNetworkError } from '#/utils/isNetworkError';
import {
  isRefreshableAuthCode,
  isDeadRefreshTokenCode,
} from '#/utils/authErrorCodes';
import {
  isRateLimitError,
  getRateLimitMessage,
} from '#/utils/errors/rateLimit';
import { clientVersion } from '../clientIdentity';
import { LogoutCleanup } from '../logoutCleanup';
import { isOfflineRejectedError } from '../offlineQueue/OfflineRejectedError';
import { operationNameOf } from '../utils/documentOperation';
import { RefreshTokenDocument } from '#operations/auth/auth.generated';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { attemptTokenRefresh, getRefreshState } from './refreshToken';
import { logger } from '#/utils/environment';
import { useStore } from '#store';

// What a refresh can clear is #/utils/authErrorCodes: this link, the refresh
// path and the offline queue classify from that one list, by code only.

// FORBIDDEN is a missing permission, not an auth fault: no refresh can grant
// it, so it stays out of the refreshable set.
// Codes compared below are widened to `string`: `extensions.code` arrives untyped.
const FORBIDDEN: string = ErrorCode.Forbidden;
const ACCOUNT_SUSPENDED: string = ErrorCode.AuthAccountSuspended;
const CLIENT_UPGRADE_REQUIRED: string = TopLevelErrorCode.ClientUpgradeRequired;
const FEATURE_DISABLED: string = TopLevelErrorCode.FeatureDisabled;
const PREMIUM_REQUIRED: string = TopLevelErrorCode.PremiumRequired;

const isResourceAccessError = (code: string) => code === FORBIDDEN;

// A suspended, banned or deleted account has valid credentials but may not
// transact. Matched on the code alone: prose that reads as a suspension must
// not end a live session, nor a reworded refusal fall to the auth branch.
const isAccountInactiveError = (code: string) => code === ACCOUNT_SUSPENDED;

// An extension value is unvalidated JSON; only a scalar reads as text.
const extensionText = (value: unknown, fallback: string): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;

// The key is baked into the build, so each code here is a build fault, not a
// recoverable session state. Matched on exact codes: message text would let a
// reworded refusal fall through to a pointless token refresh.
const API_KEY_ERROR_CODES: string[] = [
  TopLevelErrorCode.ApiKeyMissing,
  TopLevelErrorCode.ApiKeyInvalid,
  TopLevelErrorCode.ApiKeyExpired,
  TopLevelErrorCode.ApiKeyRevoked,
];

const isApiKeyError = (code: string) => API_KEY_ERROR_CODES.includes(code);

// Not API_KEY_INVALID: the key is valid but lacks this operation's permission,
// so the fix is re-provisioning it, not re-authenticating. `requiredPermission`
// is never masked, so it stays readable in production.
const API_KEY_INSUFFICIENT_PERMISSIONS: string =
  TopLevelErrorCode.ApiKeyInsufficientPermissions;

const isSubscription = (op: Pick<ApolloLink.Operation, 'query'>) =>
  op.query.definitions.some(
    (def: DefinitionNode) =>
      def.kind === Kind.OPERATION_DEFINITION &&
      def.operation === OperationTypeNode.SUBSCRIPTION,
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
      const code = extensionText(err.extensions?.code, '');
      const message = String(err.message || '');

      // The feature is off for this user, or needs a plan they do not hold: no
      // retry or refresh changes that, and it is never a sign-out. The flags
      // are asked again, so every screen that offers the feature stops.
      if (code === FEATURE_DISABLED || code === PREMIUM_REQUIRED) {
        void operation.client.refetchQueries({
          include: [MyFeatureFlagsDocument],
        });
        return;
      }

      // Terminal: a retry sends the same version and a refresh succeeds then
      // fails identically, so bail out before anything downstream recovers.
      if (code === CLIENT_UPGRADE_REQUIRED) {
        // Every operation is refused from here on: the first refusal logs, and
        // the latch raises the host's update dialog.
        const store = useStore.getState();
        if (!store.clientUpgradeRequired) {
          logger.error(
            `App version ${clientVersion()} is below the server minimum (${extensionText(
              err.extensions?.minimumVersion,
              'unknown',
            )}); ${operation.operationName} refused until the app is updated`,
          );
        }
        store.markClientUpgradeRequired();
        return;
      }

      // Terminal like CLIENT_UPGRADE_REQUIRED, as the key is fixed for this
      // build. Never sign out: the session is valid; the key is misprovisioned.
      if (code === API_KEY_INSUFFICIENT_PERMISSIONS) {
        logger.error(
          `API key lacks ${extensionText(
            err.extensions?.requiredPermission,
            'a required permission',
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

      // `endSession`, not `clearAuth` — clearing tokens alone leaves this
      // account's entities in the persisted cache for whoever signs in next.
      if (isAccountInactiveError(code)) {
        logger.error(
          `Account inactive (${operation.operationName}) — ending session`,
        );
        void useStore.getState().endSession('account_inactive');
        return;
      }

      // The refresh token is gone or rejected, so a refresh has nothing to
      // exchange: ending here spares a doomed round trip per failing operation.
      // The refresh mutation's own rejection is handled in refreshToken.ts.
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
        operation.operationName !== operationNameOf(RefreshTokenDocument)
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
    if (isSubscription(operation) && isNonIterableSubscriptionResolver(error)) {
      logger.warn(
        `Known server error for ${operation.operationName}:`,
        error.message,
      );
      return;
    }

    // networkStatusLink, above retryLink, logs network errors once per
    // operation, and retryLink owns retries: forwarding would RE-SEND mutations.
    // An offline rejection never left the device; its hook surfaces it.
    if (isNetworkError(error) || isOfflineRejectedError(error)) {
      return;
    }

    // Only log non-network errors as these are unexpected
    logger.error(
      `Unexpected error [${operation.operationName}]:`,
      error.message,
    );
  }
});
