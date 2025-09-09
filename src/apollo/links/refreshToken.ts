import {Observable, FetchResult} from '@apollo/client';
import {client} from '#/apollo/client';
import {useStore} from '#store';
import {RefreshTokenDocument, RefreshTokenMutation} from '#generated';

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers: Array<(accessToken: string) => void> = [];

// Function to add subscribers that will be resolved when the token is refreshed
const subscribeTokenRefresh = (cb: (accessToken: string) => void) => {
  refreshSubscribers.push(cb);
};

// Function to resolve all subscribers with the new token
const onTokenRefreshed = (accessToken: string) => {
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
};

/**
 * Attempts to refresh the access token.
 * Returns an Observable<FetchResult> that resolves when the token is refreshed
 * and the failed operation is retried.
 */
export const attemptTokenRefresh = (
  operation: any,
  forward: any,
): Observable<FetchResult> => {
  // Get tokens from the store instead of directly from storage
  const state = useStore.getState();
  const refreshToken = state.refreshToken;
  const accessToken = state.accessToken;

  console.log('Token refresh debug:', {
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken,
    refreshTokenLength: refreshToken?.length,
    accessTokenLength: accessToken?.length,
    refreshTokenPreview: refreshToken
      ? refreshToken.substring(0, 20) + '...'
      : null,
    accessTokenPreview: accessToken
      ? accessToken.substring(0, 20) + '...'
      : null,
  });

  if (!refreshToken) {
    // If no refresh token is available, log out
    state.logout();
    return new Observable<FetchResult>(observer => {
      observer.error(new Error('No refresh token available'));
    });
  }

  return new Observable<FetchResult>(observer => {
    // If already refreshing, wait for the refresh to complete
    if (isRefreshing) {
      subscribeTokenRefresh((accessToken: string) => {
        // Update the operation context with the new token
        operation.setContext({
          headers: {
            ...operation.getContext().headers,
            authorization: `Bearer ${accessToken}`,
          },
        });

        // Retry the failed request
        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      });
      return;
    }

    isRefreshing = true;

    console.log('Sending refresh token mutation with token:', {
      tokenPreview: refreshToken.substring(0, 20) + '...',
      tokenLength: refreshToken.length,
      isAccessToken: refreshToken === accessToken,
    });

    client
      .mutate<RefreshTokenMutation>({
        mutation: RefreshTokenDocument,
        variables: {token: refreshToken},
        // Don't use the error link for this mutation to avoid infinite loop
        context: {
          skipErrorLink: true,
        },
      })
      .then(response => {
        const data = response.data?.refresh; // Adjust based on your mutation response structure
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid refresh response');
        }

        const {accessToken: newToken, refreshToken: newRefreshToken} = data;

        // Update tokens in store (which will persist via middleware)
        useStore.getState().setTokens({
          accessToken: newToken,
          refreshToken: newRefreshToken,
        });

        // Notify all subscribers
        onTokenRefreshed(newToken);

        // Update the operation context with the new token
        operation.setContext({
          headers: {
            ...operation.getContext().headers,
            authorization: `Bearer ${newToken}`,
          },
        });

        // Retry the failed request
        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(refreshError => {
        console.log('Token refresh failed:', refreshError);
        // Clear tokens and log out the user
        useStore.getState().logout();
        observer.error(refreshError);
      })
      .finally(() => {
        isRefreshing = false;
      });
  });
};
