import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/errors';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { LogoutCleanup } from '../logoutCleanup';
import { attemptTokenRefresh } from './refreshToken';


export const errorLink = new ErrorLink(({ error, operation, forward }) => {
  // Skip error handling for refresh token mutation
  if (operation.getContext().skipErrorLink) {
    return;
  }

  // Handle logout-related errors gracefully
  if (LogoutCleanup.isInLogoutProcess()) {
    console.log(`🔇 Suppressing error during logout: ${operation.operationName}`);
    return; // Skip all error handling during logout
  }

  // Check if this is a known server subscription error
  const isSubscription = operation.query.definitions.some(
    (def: any) =>
      def.kind === 'OperationDefinition' && def.operation === 'subscription',
  );

  // Handle GraphQL errors using v4 API
  if (CombinedGraphQLErrors.is(error)) {
    console.log('GraphQL Error link triggered:', {
      uri: operation.getContext().uri,
      operationName: operation.operationName,
      isSubscription,
    });

    // Also handle errors with our utility
    const firstError = error.errors[0];
    if (LogoutCleanup.handleLogoutError({ message: firstError?.message }, operation.operationName)) {
      return; // Error was suppressed during logout
    }

    for (const err of error.errors) {
      const code = err.extensions?.code;
      const msg = err.message || '';

      console.log(`[GraphQL error]: Message: ${msg}, Location: ${err.locations}, Path: ${err.path}`);

      // Check for API key related errors
      const isApiKeyError =
        code === 'API_KEY_REQUIRED' ||
        code === 'INVALID_API_KEY' ||
        code === 'API_KEY_EXPIRED' ||
        msg.toLowerCase().includes('api key') ||
        msg.toLowerCase().includes('invalid key');

      if (isApiKeyError) {
        console.error('API Key error:', err.message);
        continue;
      }

      // Check for various authentication error patterns
      const isAuthError =
        code === 'UNAUTHENTICATED' ||
        code === 'FORBIDDEN' ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('invalid token') ||
        msg.toLowerCase().includes('jwt');

      if (isAuthError && operation.operationName !== 'RefreshToken') {
        // Skip token refresh if we're in logout process
        if (LogoutCleanup.isInLogoutProcess()) {
          console.log('Skipping token refresh during logout process');
          return;
        }

        console.log('Received authentication error, attempting token refresh…');

        // Use the dedicated refresh token link
        return attemptTokenRefresh(operation, forward);
      }
    }
  }
  // Handle Protocol errors using v4 API
  else if (CombinedProtocolErrors.is(error)) {
    console.log('Protocol Error link triggered:', {
      uri: operation.getContext().uri,
      operationName: operation.operationName,
      isSubscription,
    });

    error.errors.forEach(({ message, extensions }) => {
      console.log(`[Protocol error]: Message: ${message}, Extensions: ${JSON.stringify(extensions)}`);
    });
  }
  // Handle Network errors
  else {
    console.log('Network Error link triggered:', {
      uri: operation.getContext().uri,
      operationName: operation.operationName,
      isSubscription,
    });

    // Also handle errors with our utility
    if (LogoutCleanup.handleLogoutError({ message: error.message }, operation.operationName)) {
      return; // Error was suppressed during logout
    }

    // Check if this is a known server subscription error
    if (isSubscription && isKnownServerError({ message: error.message })) {
      console.warn(
        `Known server subscription error for ${operation.operationName}:`,
        error.message,
      );
      return;
    }

    console.error(`[Network error]: ${error}`);

    // Enhanced network error debugging
    const errorAny = error as any;
    if (errorAny.statusCode) {
      console.error('[Network Error Details]', {
        message: error.message,
        statusCode: errorAny.statusCode,
        // Log additional network error properties
        ...errorAny,
      });

      // Handle rate limiting
      if (errorAny.statusCode === 429) {
        const headers = errorAny.response?.headers;
        if (headers) {
          const rateLimit = headers.get('X-RateLimit-Limit');
          const rateRemaining = headers.get('X-RateLimit-Remaining');
          const retryAfter = headers.get('Retry-After');
          console.log(
            `Rate limit exceeded. Headers: X-RateLimit-Limit=${rateLimit}, X-RateLimit-Remaining=${rateRemaining}, Retry-After=${retryAfter}`,
          );
        }
      }
    }
  }
});