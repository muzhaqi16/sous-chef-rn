import {onError} from '@apollo/client/link/error';
import {fromPromise} from '@apollo/client';
import {attemptTokenRefresh} from './refreshToken';

export const errorLink = onError(
  ({graphQLErrors, networkError, operation, forward}) => {
    // Skip error handling for refresh token mutation
    if (operation.getContext().skipErrorLink) {
      return;
    }

    console.log('Error link triggered:', {
      graphQLErrors,
      networkError,
      operationName: operation.operationName,
    });

    // 1) Handle GraphQL errors
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        const code = err.extensions?.code;
        const msg = err.message || '';

        // Check for various authentication error patterns
        const isAuthError =
          code === 'UNAUTHENTICATED' ||
          code === 'FORBIDDEN' ||
          msg.toLowerCase().includes('expired') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('invalid token') ||
          msg.toLowerCase().includes('jwt');

        if (isAuthError && operation.operationName !== 'RefreshToken') {
          console.log(
            'Received authentication error, attempting token refresh…',
          );
          // Return the refresh observable
          return fromPromise(
            new Promise<any>((resolve, reject) => {
              attemptTokenRefresh(operation, forward).subscribe({
                next: resolve,
                error: reject,
              });
            }),
          );
        }
      }
    }

    // 2) Handle network errors
    if (networkError) {
      const errorAny = networkError as any;

      // Check for 401 Unauthorized
      if (
        errorAny.statusCode === 401 &&
        operation.operationName !== 'RefreshToken'
      ) {
        console.log('Received 401, attempting token refresh…');
        return fromPromise(
          new Promise<any>((resolve, reject) => {
            attemptTokenRefresh(operation, forward).subscribe({
              next: resolve,
              error: reject,
            });
          }),
        );
      }

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
      } else {
        console.log(`[Network error]: ${networkError}`);
      }
    }
  },
);
