import {useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useStore} from '#store';
import {client} from '#/apollo/client';
import {RefreshTokenDocument, RefreshTokenMutation} from '#generated';
import {jwtDecode} from 'jwt-decode';

interface DecodedToken {
  exp: number;
  iat: number;
}

export const useTokenRefresh = () => {
  const {accessToken, refreshToken, setTokens, logout} = useStore();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to check if token is expired or about to expire
  const isTokenExpiringSoon = (token: string | null): boolean => {
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
  };

  // Function to refresh token
  const refreshAccessToken = async (): Promise<boolean> => {
    if (!refreshToken) {
      console.log('TokenRefresh: No refresh token available');
      return false;
    }

    if (isRefreshing) {
      console.log('TokenRefresh: Already refreshing, skipping');
      return false;
    }

    setIsRefreshing(true);

    try {
      console.log('TokenRefresh: Attempting to refresh access token...');
      const response = await client.mutate<RefreshTokenMutation>({
        mutation: RefreshTokenDocument,
        variables: {token: refreshToken},
        context: {
          skipErrorLink: true, // Skip error link to avoid loops
        },
      });

      const data = response.data?.refresh;
      if (data?.accessToken && data?.refreshToken) {
        console.log('TokenRefresh: Token refresh successful');
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        // Schedule next refresh
        scheduleTokenRefresh(data.accessToken);
        return true;
      } else {
        console.log('TokenRefresh: Invalid refresh response');
        return false;
      }
    } catch (error: any) {
      console.error('TokenRefresh: Failed to refresh token:', error);
      
      // Check if this is a refresh token expiry vs other errors
      if (error?.networkError?.statusCode === 401 || 
          error?.graphQLErrors?.some((e: any) => e.extensions?.code === 'UNAUTHENTICATED')) {
        console.log('TokenRefresh: Refresh token appears to be expired');
        // Don't immediately logout - let auto-login handle this gracefully
        return false;
      }
      
      // For other types of errors (network, etc.), also don't logout immediately
      console.log('TokenRefresh: Network or other error, will retry later');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to schedule token refresh
  const scheduleTokenRefresh = (token: string | null) => {
    // Clear existing timeout
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
          refreshAccessToken().catch(error => {
            console.error('Scheduled token refresh failed:', error);
          });
        }, refreshIn);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }
  };

  // Check token on mount and when app becomes active
  useEffect(() => {
    // Check if token needs refresh on mount
    if (isTokenExpiringSoon(accessToken)) {
      refreshAccessToken().catch(error => {
        console.error('Initial token refresh failed:', error);
      });
    } else {
      scheduleTokenRefresh(accessToken);
    }

    // Listen for app state changes
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          // Check token when app becomes active
          if (isTokenExpiringSoon(accessToken)) {
            refreshAccessToken().catch(error => {
              console.error('App state token refresh failed:', error);
            });
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
  }, [accessToken, refreshToken]);

  return {
    refreshAccessToken,
    isRefreshing,
    isTokenExpiringSoon,
  };
};
