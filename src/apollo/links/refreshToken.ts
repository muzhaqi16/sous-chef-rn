import { Observable, ApolloLink } from '@apollo/client';
import { useStore } from '#store';
import { RefreshTokenDocument, RefreshTokenMutation } from '#generated';
import { reconnectWebSocket } from './wsLink';
import { client } from '../client';

let isRefreshing = false;
let refreshSubscribers: Array<(accessToken: string) => void> = [];

const subscribeTokenRefresh = (cb: (accessToken: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (accessToken: string) => {
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
};

export const attemptTokenRefresh = (
  operation: any,
  forward: any,
): Observable<ApolloLink.Result> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  console.log('RefreshToken debug:', {
    hasRefreshToken: !!refreshToken,
    refreshTokenLength: refreshToken?.length,
    refreshTokenPreview: refreshToken?.substring(0, 20) + '...',
  });

  if (!refreshToken) {
    console.log('No refresh token available in state');
    state.logout();
    return new Observable<ApolloLink.Result>(observer => {
      observer.error(new Error('No refresh token available'));
    });
  }

  return new Observable<ApolloLink.Result>(observer => {
    if (isRefreshing) {
      subscribeTokenRefresh((accessToken: string) => {
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
      });
      return;
    }

    isRefreshing = true;

    console.log('Attempting refresh with token:', refreshToken?.substring(0, 10) + '...');

    client
      .mutate({
        mutation: RefreshTokenDocument,
        variables: { token: refreshToken },
        context: {
          skipErrorLink: true,
        },
      })
      .then((response: any) => {
        const data = (response.data as RefreshTokenMutation)?.refresh;
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid refresh response');
        }

        const { accessToken: newToken, refreshToken: newRefreshToken } = data;

        useStore.getState().setTokens({
          accessToken: newToken,
          refreshToken: newRefreshToken,
        });

        reconnectWebSocket();
        onTokenRefreshed(newToken);

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
      })
      .catch((refreshError: Error) => {
        console.log('Token refresh failed:', refreshError);
        useStore.getState().logout();
        observer.error(refreshError);
      })
      .finally(() => {
        isRefreshing = false;
      });
  });
};
