import {useState, useCallback} from 'react';
import {loadCredentials} from '#storage/keychain';

export const useCredentialLoader = (rememberMe: boolean | undefined) => {
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [pwFromKeychain, setPwFromKeychain] = useState(false);

  const loadStoredCredentials = useCallback(async () => {
    setLoadingCreds(true);
    if (!rememberMe) {
      setLoadingCreds(false);
      return null;
    }

    try {
      const creds = await loadCredentials();
      if (creds) {
        setPwFromKeychain(true);
        return {email: creds.username, password: creds.password};
      }
    } catch (err) {
      console.warn('Keychain load failed:', err);
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
