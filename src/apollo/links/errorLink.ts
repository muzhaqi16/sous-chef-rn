import { onError } from '@apollo/client/link/error';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/errors';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh, getRefreshState } from './refreshToken';

// Utility functions for error detection
// Note: FORBIDDEN is intentionally NOT included here - it's a resource access error, not an auth error
// Treating FORBIDDEN as auth error causes unnecessary token refresh cycles
const isAuthError = (code: string, msg: string) =>
  code === 'UNAUTHENTICATED' ||
  ['expired', 'unauthorized', 'invalid token', 'jwt'].some(term => msg.toLowerCase().includes(term));

// FORBIDDEN means user doesn't have access to the resource - not an auth issue
const isResourceAccessError = (code: string) => code === 'FORBIDDEN';

const isApiKeyError = (code: string, msg: string) =>
  ['API_KEY_REQUIRED', 'INVALID_API_KEY', 'API_KEY_EXPIRED'].includes(code) ||
  msg.toLowerCase().includes('api key');

const isSubscription = (op: any) =>
  op.query.definitions.some((def: any) => def.kind === 'OperationDefinition' && def.operation === 'subscription');

export const errorLink = onError(({ error, operation, forward }) => {
  if (operation.getContext().skipErrorLink || LogoutCleanup.isInLogoutProcess()) return;

  // Check if token refresh is in progress to suppress cascade of auth errors
  const { isRefreshing } = getRefreshState();

  if (CombinedGraphQLErrors.is(error)) {
    for (const err of error.errors) {
      const code = String(err.extensions?.code || '');
      const message = String(err.message || '');

      if (isApiKeyError(code, message)) {
        console.error('API Key error:', message);
        continue;
      }

      // Handle FORBIDDEN separately - it's a resource access issue, not an auth problem
      // This prevents unnecessary token refresh cycles when accessing deleted/unauthorized resources
      if (isResourceAccessError(code)) {
        console.warn(`Access denied for ${operation.operationName}: ${message}`);
        continue;
      }

      if (isAuthError(code, message) && operation.operationName !== 'RefreshToken') {
        // Suppress logging if refresh already in progress to avoid cascade
        if (!isRefreshing) {
          console.warn(`Auth error detected for ${operation.operationName}, initiating token refresh`);
        }
        return attemptTokenRefresh(operation, forward);
      }
    }
  } else if (!CombinedProtocolErrors.is(error)) {
    // Check for known server errors first
    if (isSubscription(operation) && isKnownServerError({ message: error.message })) {
      console.warn(`Known server error for ${operation.operationName}:`, error.message);
      return;
    }

    // Enhanced network error detection - includes WebSocket errors
    const message = error.message?.toLowerCase() || '';
    const isNetworkIssue = [
      'network request failed',
      'network error',
      'connection refused',
      'timeout',
      'enotfound',
      'econnrefused',
      'econnreset',
      'ehostunreach',
      'socket closed',  // WebSocket connection failures
      'websocket',      // Generic WebSocket errors
    ].some(issue => message.includes(issue));

    // For network errors, just log and let Apollo's errorPolicy handle it
    // With cache-first + errorPolicy: 'ignore', Apollo will use cached data automatically
    if (isNetworkIssue) {
      console.warn(
        `Network error for ${operation.operationName}:`,
        error.message
      );
      return; // Let Apollo's errorPolicy handle it
    }

    // Only log non-network errors as these are unexpected
    console.error(`Unexpected error [${operation.operationName}]:`, error.message);
  }
});