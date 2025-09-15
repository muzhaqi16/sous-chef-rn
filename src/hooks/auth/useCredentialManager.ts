// ============================================
// hooks/auth/useCredentialManager.ts
// Biometric authentication and credential storage
// ============================================

import {useState, useCallback} from 'react';
import {
  loadCredentials,
  saveCredentials,
  hasCredentials,
  clearCredentials,
} from '#/storage/keychain';

interface Credentials {
  email: string;
  password: string;
}

export const useCredentialManager = () => {
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const checkStoredCredentials = useCallback(async (): Promise<boolean> => {
    try {
      return await hasCredentials();
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  }, []);

  const loadStoredCredentials =
    useCallback(async (): Promise<Credentials | null> => {
      try {
        setIsLoadingCredentials(true);

        // First check if credentials exist
        const hasCreds = await hasCredentials();
        if (!hasCreds) {
          return null;
        }

        // Load with biometric authentication
        const credentials = await loadCredentials();
        if (credentials) {
          return {
            email: credentials.username,
            password: credentials.password,
          };
        }

        return null;
      } catch (error) {
        console.error('Error loading credentials:', error);
        return null;
      } finally {
        setIsLoadingCredentials(false);
      }
    }, []);

  const storeCredentials = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        setIsSavingCredentials(true);
        await saveCredentials(email, password);
        return true;
      } catch (error) {
        console.error('Error saving credentials:', error);
        return false;
      } finally {
        setIsSavingCredentials(false);
      }
    },
    [],
  );

  const removeCredentials = useCallback(async (): Promise<boolean> => {
    try {
      await clearCredentials();
      return true;
    } catch (error) {
      console.error('Error clearing credentials:', error);
      return false;
    }
  }, []);

  return {
    isLoadingCredentials,
    isSavingCredentials,
    checkStoredCredentials,
    loadStoredCredentials,
    storeCredentials,
    removeCredentials,
  };
};
