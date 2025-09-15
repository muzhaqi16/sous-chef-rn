import {useEffect, useState, useRef, useCallback} from 'react';
import {useStore} from '#store';
import {useLoginMutation, LoginInput} from '#generated';
import {useTokenManager} from './useTokenManager';
import {useCredentialManager} from './useCredentialManager';

export interface AutoLoginState {
  status: 'idle' | 'checking' | 'authenticating' | 'success' | 'failed';
  error: string | null;
}

export const useAutoLogin = (enabled: boolean = true) => {
  const {user, isHydrated, setAuth, accessToken, refreshToken} = useStore();
  const [loginMutation] = useLoginMutation();
  const {refreshAccessToken} = useTokenManager();
  const {checkStoredCredentials, loadStoredCredentials} =
    useCredentialManager();

  const [autoLoginState, setAutoLoginState] = useState<AutoLoginState>({
    status: 'idle',
    error: null,
  });

  const hasAttemptedRef = useRef(false);

  // Silent token refresh (no biometric prompt)
  const attemptSilentLogin = useCallback(async (): Promise<boolean> => {
    try {
      // Only try if we have tokens
      if (!accessToken && !refreshToken) {
        return false;
      }

      // Try to refresh existing token
      const refreshed = await refreshAccessToken();
      return refreshed;
    } catch (error) {
      console.error('Silent login failed:', error);
      return false;
    }
  }, [accessToken, refreshToken, refreshAccessToken]);

  // Biometric login (requires user interaction)
  const attemptBiometricLogin = useCallback(async (): Promise<boolean> => {
    try {
      setAutoLoginState({status: 'authenticating', error: null});

      // Load credentials with biometric prompt
      const credentials = await loadStoredCredentials();
      if (!credentials) {
        setAutoLoginState({status: 'failed', error: 'No credentials found'});
        return false;
      }

      // Attempt login
      const response = await loginMutation({
        variables: {
          input: {
            email: credentials.email,
            password: credentials.password,
          } as LoginInput,
        },
      });

      if (response.data?.login) {
        const {user, accessToken, refreshToken} = response.data.login;
        setAuth(user, accessToken, refreshToken);
        setAutoLoginState({status: 'success', error: null});
        return true;
      }

      setAutoLoginState({status: 'failed', error: 'Login failed'});
      return false;
    } catch (error: any) {
      setAutoLoginState({
        status: 'failed',
        error: error?.message || 'Authentication failed',
      });
      return false;
    }
  }, [loadStoredCredentials, loginMutation, setAuth]);

  // Check for auto-login opportunity on mount
  useEffect(() => {
    if (!enabled || !isHydrated || user || hasAttemptedRef.current) {
      return;
    }

    hasAttemptedRef.current = true;

    const checkAutoLogin = async () => {
      setAutoLoginState({status: 'checking', error: null});

      // First try silent token refresh
      const silentSuccess = await attemptSilentLogin();
      if (silentSuccess) {
        setAutoLoginState({status: 'success', error: null});
        return;
      }

      // Check if we have stored credentials (but don't load them yet)
      const hasStoredCreds = await checkStoredCredentials();
      setAutoLoginState({status: 'idle', error: null});
    };

    checkAutoLogin();
  }, [enabled, isHydrated, user, attemptSilentLogin, checkStoredCredentials]);

  return {
    autoLoginState,
    attemptBiometricLogin,
    isAutoLoginPossible: autoLoginState.status === 'idle',
  };
};
