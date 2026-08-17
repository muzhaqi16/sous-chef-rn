import { useState } from 'react';
import {
  loadCredentials,
  saveCredentials,
  hasCredentials,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability,
} from '#/storage/keychain';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';

export interface Credentials {
  email: string;
  password: string;
}

// Module-level functions — stable references, no hook state needed

const checkStoredCredentials = async (
  email?: string | null,
): Promise<boolean> => {
  // No account → no per-account credentials to check.
  if (!email) return false;
  try {
    return await hasCredentials(email);
  } catch (error) {
    errorService.reportError(error, { operation: 'checkCredentials' });
    return false;
  }
};

const getAvailableAccounts = async () => {
  try {
    return await getStoredAccounts();
  } catch (error) {
    logger.error('Error getting available accounts:', error);
    return [];
  }
};

const getBiometricInfo = async () => {
  try {
    return await getBiometricCapability();
  } catch (error) {
    logger.error('Error getting biometric capability:', error);
    return { isAvailable: false, biometryType: null };
  }
};

const storeCredentials = async (
  email: string,
  password: string,
): Promise<boolean> => {
  try {
    await saveCredentials(email, password);
    return true;
  } catch (error) {
    errorService.reportError(error, { operation: 'storeCredentials' });
    return false;
  }
};

const removeCredentials = async (email?: string): Promise<boolean> => {
  if (!email) return false;
  try {
    await clearCredentials(email);
    return true;
  } catch (error) {
    logger.error('Error removing credentials:', error);
    return false;
  }
};

/**
 * Hook for managing credential storage operations.
 * This hook handles all keychain/biometric credential operations.
 */
export const useCredentialStorage = () => {
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  const loadStoredCredentials = async (
    email?: string,
  ): Promise<Credentials | null> => {
    setIsLoadingCredentials(true);

    let credentials = null;
    if (email) {
      try {
        credentials = await loadCredentials(email);
      } catch (error) {
        // Leaving it null reports "no stored credentials", which is the safe
        // reading of a keychain we could not open.
        errorService.reportError(error, {
          operation: 'Error loading credentials',
        });
      }
    }

    setIsLoadingCredentials(false);

    return credentials
      ? {
          email: credentials.username,
          password: credentials.password,
        }
      : null;
  };

  return {
    isLoadingCredentials,
    checkStoredCredentials,
    loadStoredCredentials,
    getAvailableAccounts,
    getBiometricInfo,
    storeCredentials,
    removeCredentials,
  };
};
