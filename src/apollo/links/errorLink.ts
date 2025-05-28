import {onError} from '@apollo/client/link/error';
import {attemptTokenRefresh} from './refreshToken';

export const errorLink = onError(
  ({graphQLErrors, networkError, operation, forward}) => {
    console.log('Error link triggered:', {
      graphQLErrors,
      networkError,
      operationName: operation.operationName,
    });

    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        if (err.message === 'Expired token') {
          console.log('Unauthorized error received, attempting token refresh.');
          return attemptTokenRefresh(operation, forward);
        }
      }
    }

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
