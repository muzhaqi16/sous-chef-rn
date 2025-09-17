import { Observable, ApolloLink } from '@apollo/client';
import { useStore } from '#store';
import { RefreshTokenDocument, RefreshTokenMutation } from '#generated';
import { reconnectWebSocket, isWebSocketReconnecting } from './wsLink';
import { client } from '../client';
import { tokenRefreshStateManager } from '#storage/tokenRefreshStateManager';

let isRefreshing = false;
let refreshSubscribers: Array<(accessToken: string | null) => void> = [];

const subscribeTokenRefresh = (cb: (accessToken: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (accessToken: string | null) => {
  console.log(`🔄 Token refresh completed, notifying ${refreshSubscribers.length} waiting requests`);
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
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
    // If refresh is already in progress, queue this operation
    if (isRefreshing) {
      console.log(`⏳ Token refresh in progress, queuing ${operation.operationName}`);
      tokenRefreshStateManager.queueOperation(operation.operationName);

      subscribeTokenRefresh((accessToken: string | null) => {
        if (accessToken) {
          console.log(`🔄 Retrying queued operation ${operation.operationName} with new token`);
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
    tokenRefreshStateManager.startRefresh();
    console.log(`🔄 Starting token refresh for ${operation.operationName}`);

    performTokenRefresh()
      .then((newToken) => {
        const success = !!newToken;
        tokenRefreshStateManager.completeRefresh(success);
        onTokenRefreshed(newToken);

        if (newToken) {
          console.log(`✅ Token refresh successful, retrying ${operation.operationName}`);
          operation.setContext({
            headers: {
              ...operation.getContext().headers,
              authorization: `Bearer ${newToken}`,
            },
          });

          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: (retryError: any) => {
              console.log(`❌ Retry failed for ${operation.operationName}:`, retryError.message);
              observer.error(retryError);
            },
            complete: observer.complete.bind(observer),
          });
        } else {
          observer.error(new Error('Token refresh failed'));
        }

        return newToken;
      })
      .catch((error) => {
        console.log('❌ Token refresh failed:', error.message);
        tokenRefreshStateManager.completeRefresh(false);
        onTokenRefreshed(null);
        observer.error(error);
        return null;
      })
      .finally(() => {
        isRefreshing = false;
      });
  });
};
