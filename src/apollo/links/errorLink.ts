import {onError} from '@apollo/client/link/error';
import {attemptTokenRefresh} from './refreshToken';

export const errorLink = onError(
  ({graphQLErrors, networkError, operation, forward}) => {
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
        // match either the standard UNAUTHENTICATED code
        // or look for "expired" in the message text
        if (
          code === 'UNAUTHENTICATED' ||
          msg.toLowerCase().includes('expired')
        ) {
          console.log(
            'Received unauthenticated/expired error, attempting token refresh…',
          );
          // must return so we swap to the refresh Observable
          return attemptTokenRefresh(operation, forward);
        }
      }
    }
    // 2) Handle other network errors (rate-limit, etc)
    if (networkError) {
      const errorAny = networkError as any;
      if (errorAny.statusCode === 429) {
        const headers = errorAny.response?.headers;
        if (headers) {
          const rateLimit = headers.get('X-RateLimit-Limit');
          const rateRemaining = headers.get('X-RateLimit-Remaining');
          const retryAfter = headers.get('Retry-After');
          console.log(
            `Rate limit exceeded. Headers: X-RateLimit-Limit=${rateLimit}, X-RateLimit-Remaining=${rateRemaining}, Retry-After=${retryAfter}`,
          );
        } else {
          console.log('Rate limit exceeded but no headers were returned.');
        }
      } else {
        console.log(`[Network error]: ${networkError}`);
      }
    }
  },
);
