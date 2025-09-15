// src/apollo/links/refreshToken.ts
import {Observable, FetchResult, ApolloClient} from '@apollo/client';
import {useStore} from '#store';
import {RefreshTokenDocument, RefreshTokenMutation} from '#generated';
import {reconnectWebSocket} from './wsLink';

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
): Observable<FetchResult> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    state.logout();
    return new Observable<FetchResult>(observer => {
      observer.error(new Error('No refresh token available'));
    });
  }

  return new Observable<FetchResult>(observer => {
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

    // Get the client from the operation context
    const client = operation.getContext().client as ApolloClient<any>;

    if (!client) {
      console.error('Client not available in context');
      observer.error(new Error('Client not available'));
      isRefreshing = false;
      return;
    }

    client
      .mutate({
        mutation: RefreshTokenDocument,
        variables: {token: refreshToken},
        context: {
          skipErrorLink: true,
        },
      })
      .then(response => {
        const data = (response.data as RefreshTokenMutation)?.refresh;
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid refresh response');
        }

        const {accessToken: newToken, refreshToken: newRefreshToken} = data;

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
