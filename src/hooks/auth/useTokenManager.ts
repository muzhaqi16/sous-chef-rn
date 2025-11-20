/**
 * @deprecated This hook is deprecated and should not be used.
 *
 * Token refresh is now handled automatically by:
 * - tokenScheduler.ts: Proactive refresh 5-10 minutes before expiration
 * - authSlice.ts: Schedules refresh when tokens are set
 * - refreshToken.ts: Reactive refresh on auth errors
 *
 * This duplicate implementation created race conditions and conflicting refresh schedules.
 * The hook scheduled refreshes with only a 1-minute buffer (line 107) while checking for
 * expiration at 5 minutes (line 29), causing timing issues.
 *
 * DO NOT USE THIS HOOK. It will be removed in a future version.
 */

import {useEffect, useRef, useCallback, useState} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAppStore} from '#store/useAppStore';
import {client} from '#/apollo/client';
import {RefreshTokenDocument, RefreshTokenMutation} from '#generated';
import {jwtDecode} from 'jwt-decode';

interface DecodedToken {
  exp: number;
  iat: number;
}

/**
 * @deprecated Use the built-in token refresh system instead
 */
export const useTokenManager = () => {
  const accessToken = useAppStore(state => state.accessToken);
  const refreshToken = useAppStore(state => state.refreshToken);
  const setTokens = useAppStore(state => state.setTokens);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isTokenExpiringSoon = useCallback((token: string | null): boolean => {
    if (!token) return true;

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const now = Date.now() / 1000;
      const timeUntilExpiry = decoded.exp - now;
      // Refresh if token expires in less than 5 minutes
      return timeUntilExpiry < 300;
    } catch {
      return true;
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    // If already refreshing, return the existing promise
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (!refreshToken) {
      console.log('TokenManager: No refresh token available');
      return false;
    }

    // Create refresh promise
    refreshPromiseRef.current = (async () => {
      setIsRefreshing(true);

      try {
        console.log('TokenManager: Refreshing access token...');
        const response = await client.mutate<RefreshTokenMutation>({
          mutation: RefreshTokenDocument,
          variables: {token: refreshToken},
          context: {skipErrorLink: true},
        });

        const data = response.data?.refresh;
        if (data?.accessToken && data?.refreshToken) {
          console.log('TokenManager: Token refresh successful');
          setTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return true;
        }

        return false;
      } catch (error: any) {
        console.error('TokenManager: Failed to refresh token:', error);

        // Check if refresh token is expired
        const isAuthError =
          error?.networkError?.statusCode === 401 ||
          error?.graphQLErrors?.some(
            (e: any) => e.extensions?.code === 'UNAUTHENTICATED',
          );

        if (isAuthError) {
          console.log('TokenManager: Refresh token expired');
        }

        return false;
      } finally {
        setIsRefreshing(false);
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [refreshToken, setTokens]);

  const scheduleTokenRefresh = useCallback(
    (token: string | null) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (!token) return;

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        const now = Date.now() / 1000;
        const timeUntilExpiry = decoded.exp - now;

        // Schedule refresh 1 minute before expiry
        const refreshIn = Math.max(0, (timeUntilExpiry - 60) * 1000);

        if (refreshIn > 0) {
          refreshTimeoutRef.current = setTimeout(() => {
            refreshAccessToken();
          }, refreshIn);
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    },
    [refreshAccessToken],
  );

  // Setup automatic token refresh
  useEffect(() => {
    if (accessToken) {
      if (isTokenExpiringSoon(accessToken)) {
        refreshAccessToken();
      } else {
        scheduleTokenRefresh(accessToken);
      }
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && accessToken) {
          if (isTokenExpiringSoon(accessToken)) {
            refreshAccessToken();
          }
        }
      },
    );

    return () => {
      subscription.remove();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [
    accessToken,
    isTokenExpiringSoon,
    refreshAccessToken,
    scheduleTokenRefresh,
  ]);

  return {
    isRefreshing,
    isTokenExpiringSoon,
    refreshAccessToken,
  };
};
