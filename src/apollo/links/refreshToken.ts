import {Observable, FetchResult} from '@apollo/client';
import {client} from '#/apollo/client';
import {storage} from '#/storage/mmkv';
import {useStore} from '#store';
import {RefreshTokenDocument, RefreshTokenMutation} from '#generated';

/**
 * Attempts to refresh the access token.
 * Returns an Observable<FetchResult> that resolves when the token is refreshed
 * and the failed operation is retried.
 */
export const attemptTokenRefresh = (
  operation: any,
  forward: any,
): Observable<FetchResult> => {
  const refreshToken = storage.getString('refreshToken');

  if (!refreshToken) {
    // If no refresh token is available, log out and return an observable that errors immediately.
    storage.delete('accessToken');
    storage.delete('refreshToken');
    useStore.getState().logout();
    return new Observable<FetchResult>(observer => {
      observer.error(new Error('No refresh token available'));
    });
  }

  return new Observable<FetchResult>(observer => {
    client
      .mutate<RefreshTokenMutation>({
        mutation: RefreshTokenDocument, // Use the generated document, not the hook
        variables: {token: refreshToken}, // Adjust variable name based on your schema
      })
      .then(response => {
        const data = response.data?.refresh; // Adjust based on your mutation response structure
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid refresh response');
        }

        const {accessToken: newToken, refreshToken: newRefreshToken} = data;

        // Update tokens in storage
        storage.set('accessToken', newToken);
        storage.set('refreshToken', newRefreshToken);

        // Update tokens in your store
        useStore.getState().setTokens({
          accessToken: newToken,
          refreshToken: newRefreshToken,
        });

        // Update the operation context with the new token
        const oldHeaders = operation.getContext().headers;
        operation.setContext({
          headers: {
            ...oldHeaders,
            authorization: `Bearer ${newToken}`,
          },
        });

        // Retry the failed request by subscribing to the forwarded operation
        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(refreshError => {
        console.log('Token refresh failed', refreshError);
        // Clear tokens and log out the user
        storage.delete('accessToken');
        storage.delete('refreshToken');
        useStore.getState().logout();
        observer.error(refreshError);
      });
  });
};
