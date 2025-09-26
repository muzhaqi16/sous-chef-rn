import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/errors';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh } from './refreshToken';

// Utility functions for error detection
const isAuthError = (code: string, msg: string) =>
  ['UNAUTHENTICATED', 'FORBIDDEN'].includes(code) ||
  ['expired', 'unauthorized', 'invalid token', 'jwt'].some(term => msg.toLowerCase().includes(term));

const isApiKeyError = (code: string, msg: string) =>
  ['API_KEY_REQUIRED', 'INVALID_API_KEY', 'API_KEY_EXPIRED'].includes(code) ||
  msg.toLowerCase().includes('api key');

const isSubscription = (op: any) =>
  op.query.definitions.some((def: any) => def.kind === 'OperationDefinition' && def.operation === 'subscription');

export const errorLink = new ErrorLink(({ error, operation, forward }) => {
  if (operation.getContext().skipErrorLink || LogoutCleanup.isInLogoutProcess()) return;

  if (CombinedGraphQLErrors.is(error)) {
    for (const err of error.errors) {
      const code = String(err.extensions?.code || '');
      const message = String(err.message || '');

      if (isApiKeyError(code, message)) {
        console.error('API Key error:', message);
        continue;
      }

      if (isAuthError(code, message) && operation.operationName !== 'RefreshToken') {
        return attemptTokenRefresh(operation, forward);
      }
    }
  } else if (!CombinedProtocolErrors.is(error)) {
    if (isSubscription(operation) && error.message?.includes('Socket closed with event 4500')) {
      return attemptTokenRefresh(operation, forward);
    }

    if (isSubscription(operation) && isKnownServerError({ message: error.message })) {
      console.warn(`Known server error for ${operation.operationName}:`, error.message);
      return;
    }

    // Minimal logging for network errors (Apollo handles retries + cache fallback)
    const message = error.message?.toLowerCase() || '';
    const isNetworkIssue = [
      'network request failed',
      'network error',
      'connection refused',
      'timeout',
      'enotfound',
      'econnrefused',
      'econnreset',
      'ehostunreach'
    ].some(issue => message.includes(issue));

    // Only log non-network errors as these are unexpected
    if (!isNetworkIssue) {
      console.error(`Unexpected network error [${operation.operationName}]:`, error.message);
    }
  }
});