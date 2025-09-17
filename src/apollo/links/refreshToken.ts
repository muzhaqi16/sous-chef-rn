import { Observable, ApolloLink } from '@apollo/client';
import { useStore } from '#store';
import { RefreshTokenDocument, RefreshTokenMutation } from '#generated';
import { reconnectWebSocket, isWebSocketReconnecting } from './wsLink';
import { client } from '../client';

let isRefreshing = false;
let refreshSubscribers: Array<(accessToken: string | null) => void> = [];
let refreshPromise: Promise<string | null> | null = null;

const subscribeTokenRefresh = (cb: (accessToken: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (accessToken: string | null) => {
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
  refreshPromise = null;
};

const performTokenRefresh = async (): Promise<string | null> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    state.logout();
    throw new Error('No refresh token available');
  }


  try {
    const response = await client.mutate({
      mutation: RefreshTokenDocument,
      variables: { token: refreshToken },
      context: {
        skipErrorLink: true,
      },
    });

    const data = (response.data as RefreshTokenMutation)?.refresh;
    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error('Invalid refresh response');
    }

    const { accessToken: newToken, refreshToken: newRefreshToken } = data;

    useStore.getState().setTokens({
      accessToken: newToken,
      refreshToken: newRefreshToken,
    });


    // Only reconnect WebSocket if it's not already reconnecting
    if (!isWebSocketReconnecting()) {
      reconnectWebSocket();
    } else {
      console.log('WebSocket reconnection already in progress, skipping...');
    }

    return newToken;
  } catch (refreshError) {
    useStore.getState().logout();
    throw refreshError;
  }
};

export const attemptTokenRefresh = (
  operation: any,
  forward: any,
): Observable<ApolloLink.Result> => {
  return new Observable<ApolloLink.Result>(observer => {
    // If refresh is already in progress, wait for it
    if (isRefreshing && refreshPromise) {
      subscribeTokenRefresh((accessToken: string | null) => {
        if (accessToken) {
          operation.setContext({
            headers: {
              ...operation.getContext().headers,
              authorization: `Bearer ${accessToken}`,
            },
          });

          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
        } else {
          observer.error(new Error('Token refresh failed'));
        }
      });
      return;
    }

    // Start new refresh
    isRefreshing = true;

    refreshPromise = performTokenRefresh()
      .then((newToken) => {
        onTokenRefreshed(newToken);

        if (newToken) {
          operation.setContext({
            headers: {
              ...operation.getContext().headers,
              authorization: `Bearer ${newToken}`,
            },
          });

          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
        }

        return newToken;
      })
      .catch((error) => {
        onTokenRefreshed(null);
        observer.error(error);
        return null;
      })
      .finally(() => {
        isRefreshing = false;
      });
  });
};
