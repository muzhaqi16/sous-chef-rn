import {useEffect, useRef} from 'react';
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
  const refreshAccessToken = async () => {
    if (!refreshToken) {
      return;
    }

    console.log('useTokenRefresh: Sending refresh token mutation with token:', {
      tokenPreview: refreshToken.substring(0, 20) + '...',
      tokenLength: refreshToken.length,
      isAccessToken: refreshToken === accessToken,
    });

    try {
      const response = await client.mutate<RefreshTokenMutation>({
        mutation: RefreshTokenDocument,
        variables: {token: refreshToken},
        context: {
          skipErrorLink: true, // Skip error link to avoid loops
        },
      });

      const data = response.data?.refresh;
      if (data?.accessToken && data?.refreshToken) {
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        // Schedule next refresh
        scheduleTokenRefresh(data.accessToken);
      } else {
        throw new Error('Invalid refresh response');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
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
        console.log(`Scheduling token refresh in ${refreshIn / 1000} seconds`);
        // console log refreshing time in hours, minutes, seconds
        const hours = Math.floor(refreshIn / 3600000);
        const minutes = Math.floor((refreshIn % 3600000) / 60000);
        const seconds = Math.floor((refreshIn % 60000) / 1000);
        console.log(
          `Token will be refreshed in ${hours}h ${minutes}m ${seconds}s`,
        );
        refreshTimeoutRef.current = setTimeout(refreshAccessToken, refreshIn);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }
  };

  // Check token on mount and when app becomes active
  useEffect(() => {
    // Check if token needs refresh on mount
    if (isTokenExpiringSoon(accessToken)) {
      refreshAccessToken();
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
  }, [accessToken, refreshToken]);
};
