import {useEffect, useState, useRef} from 'react';
import {useStore} from '#store';
import {useLoginMutation, type LoginInput} from '#generated';
import {useTokenRefresh} from './useTokenRefresh';
import {hasCredentials, loadCredentials} from '#/storage/keychain';

interface AutoLoginStatus {
  isAttempting: boolean;
  completed: boolean;
  error: string | null;
}

export const useAutoLogin = () => {
  const {
    user,
    accessToken,
    refreshToken,
    isHydrated,
    completeAuthentication,
    setTokens,
    logout,
  } = useStore();
  
  // Use the login mutation hook
  const [loginMutation, {loading: isLoggingIn}] = useLoginMutation();
  
  // Use token refresh functionality
  const {refreshAccessToken, isTokenExpiringSoon, isRefreshing} = useTokenRefresh();
  
  const [autoLoginStatus, setAutoLoginStatus] = useState<AutoLoginStatus>({
    isAttempting: false,
    completed: false,
    error: null,
  });
  
  const hasAttemptedRef = useRef(false);
  const isPostLogoutRef = useRef(false);
  const isInitialLoadRef = useRef(true);


  // Attempt auto-login with stored credentials
  const attemptCredentialLogin = async (): Promise<boolean> => {
    try {
      console.log('AutoLogin: Attempting credential-based login...');
      
      // Check if credentials exist
      const hasCreds = await hasCredentials();
      if (!hasCreds) {
        console.log('AutoLogin: No stored credentials found');
        return false;
      }

      // Load credentials (this may trigger biometric prompt)
      const credentials = await loadCredentials();
      if (!credentials) {
        console.log('AutoLogin: Failed to load credentials');
        return false;
      }

      // Attempt login using the hook
      const response = await loginMutation({
        variables: {
          input: {
            email: credentials.username,
            password: credentials.password,
          } as LoginInput
        },
        errorPolicy: 'all',
      });

      if (response.data?.login) {
        const loginData = response.data.login;
        await completeAuthentication(loginData, true);
        console.log('AutoLogin: Credential-based login successful');
        return true;
      }
    } catch (error) {
      console.log('AutoLogin: Credential-based login failed:', error);
    }

    return false;
  };

  // Attempt auto-login only for token-based authentication (no biometric prompts)
  const attemptTokenBasedAutoLogin = async () => {
    if (hasAttemptedRef.current || user || !isHydrated || isPostLogoutRef.current) {
      return;
    }

    // Don't attempt auto-login if we have no tokens at all (likely after logout)
    if (!accessToken && !refreshToken) {
      console.log('AutoLogin: No tokens available, skipping auto-login attempt');
      hasAttemptedRef.current = true;
      setAutoLoginStatus({
        isAttempting: false,
        completed: true,
        error: null,
      });
      return;
    }

    hasAttemptedRef.current = true;
    setAutoLoginStatus({
      isAttempting: true,
      completed: false,
      error: null,
    });

    try {
      console.log('AutoLogin: Starting token-based auto-login...');

      // Strategy 1: Check if we have valid access token
      if (accessToken && !isTokenExpiringSoon(accessToken)) {
        console.log('AutoLogin: Valid access token found, no login needed');
        setAutoLoginStatus({
          isAttempting: false,
          completed: true,
          error: null,
        });
        return;
      }

      // Strategy 2: Try token refresh if we have tokens that might be refreshable
      if (refreshToken && await refreshAccessToken()) {
        console.log('AutoLogin: Token refresh successful');
        setAutoLoginStatus({
          isAttempting: false,
          completed: true,
          error: null,
        });
        return;
      }

      // No automatic credential login - let user manually trigger biometric auth
      console.log('AutoLogin: No valid tokens, user will need to authenticate manually');
      setAutoLoginStatus({
        isAttempting: false,
        completed: true,
        error: null,
      });

    } catch (error) {
      console.error('AutoLogin: Unexpected error during token-based auto-login:', error);
      setAutoLoginStatus({
        isAttempting: false,
        completed: true,
        error: 'Auto-login failed unexpectedly',
      });
      
      // Clear potentially corrupted tokens
      await logout();
    }
  };

  // Manual credential-based login (triggered after biometric verification)
  const attemptCredentialAutoLogin = async (): Promise<boolean> => {
    console.log('AutoLogin: Attempting post-verification credential login...');
    return await attemptCredentialLogin();
  };

  // Trigger token-based auto-login when appropriate
  useEffect(() => {
    attemptTokenBasedAutoLogin();
  }, [isHydrated, user]); // Remove token dependencies to prevent logout loops

  // Track logout state and reset when user logs out
  useEffect(() => {
    if (!user && isHydrated) {
      if (isInitialLoadRef.current) {
        // This is the initial app load with no user - allow auto-login
        isInitialLoadRef.current = false;
        isPostLogoutRef.current = false;
      } else {
        // User just logged out, set post-logout flag to prevent auto-login
        isPostLogoutRef.current = true;
        setAutoLoginStatus({
          isAttempting: false,
          completed: true, // Keep completed true to prevent retries
          error: null,
        });
      }
    } else if (user && isHydrated) {
      // User is logged in, clear flags
      isInitialLoadRef.current = false;
      isPostLogoutRef.current = false;
    }
  }, [user, isHydrated]);

  const isAttempting = autoLoginStatus.isAttempting || isLoggingIn || isRefreshing;

  return {
    autoLoginStatus,
    isAutoLoginAttempting: isAttempting,
    autoLoginCompleted: autoLoginStatus.completed,
    autoLoginError: autoLoginStatus.error,
    attemptCredentialAutoLogin, // Export this for manual use after biometric verification
  };
};