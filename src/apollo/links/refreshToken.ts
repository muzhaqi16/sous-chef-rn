import { Observable } from '@apollo/client';
import { useStore } from '#store';
import { RefreshTokenDocument, RefreshTokenMutation } from '#generated';
import { reconnectWebSocket, isWebSocketReconnecting } from './wsLink';
import { client } from '../client';

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null) => {
  refreshQueue.forEach(callback => callback(token));
  refreshQueue = [];
};

const performTokenRefresh = async (): Promise<string | null> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    state.tokenRefreshFailed();
    throw new Error('No refresh token available');
  }

  try {
    const response = await client.mutate({
      mutation: RefreshTokenDocument,
      variables: { token: refreshToken },
      context: { skipErrorLink: true },
    });

    const data = (response.data as RefreshTokenMutation)?.refresh;
    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error('Invalid refresh response');
    }

    const { accessToken: newToken, refreshToken: newRefreshToken } = data;
    state.setTokens({ accessToken: newToken, refreshToken: newRefreshToken });

    if (!isWebSocketReconnecting()) {
      reconnectWebSocket();
    }

    return newToken;
  } catch (error) {
    state.tokenRefreshFailed();
    throw error;
  }
};

export const attemptTokenRefresh = (operation: any, forward: any): Observable<any> => {
  return new Observable(observer => {
    if (isRefreshing) {
      refreshQueue.push((token: string | null) => {
        if (token) {
          operation.setContext({
            headers: { ...operation.getContext().headers, authorization: `Bearer ${token}` },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh failed'));
        }
      });
      return;
    }

    isRefreshing = true;
    performTokenRefresh()
      .then(newToken => {
        processQueue(newToken);
        if (newToken) {
          operation.setContext({
            headers: { ...operation.getContext().headers, authorization: `Bearer ${newToken}` },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh failed'));
        }
      })
      .catch(error => {
        processQueue(null);
        observer.error(error);
      })
      .finally(() => {
        isRefreshing = false;
      });
  });
};