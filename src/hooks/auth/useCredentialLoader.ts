import {useState, useCallback} from 'react';
import {loadCredentials, hasCredentials} from '#/storage/keychain';

export const useCredentialLoader = (rememberMe?: boolean) => {
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [pwFromKeychain, setPwFromKeychain] = useState(false);

  const loadStoredCredentials = useCallback(async () => {
    if (rememberMe === false) {
      return null;
    }

    try {
      setLoadingCreds(true);

      // First check if credentials exist without triggering biometric prompt
      const hasCreds = await hasCredentials();
      if (!hasCreds) {
        return null;
      }

      // Now trigger biometric prompt to load actual credentials
      const credentials = await loadCredentials();
      if (credentials) {
        setPwFromKeychain(true);
        return {
          email: credentials.username,
          password: credentials.password,
        };
      }
    } catch (error) {
      console.log('Error loading credentials:', error);
    } finally {
      setLoadingCreds(false);
    }

    return null;
  }, [rememberMe]);

  return {
    loadingCreds,
    pwFromKeychain,
    loadStoredCredentials,
  };
};
