import { useState } from 'react';
import {
  loadCredentials,
  loadCredentialsForAccount,
  saveCredentials,
  hasCredentials,
  hasCredentialsForAccount,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability,
} from '#/storage/keychain';
import { executeQuery } from '#/utils/compilerSafeWrappers';
import { logger } from '#/utils/environment';

export interface Credentials {
  email: string;
  password: string;
}

// Module-level functions — stable references, no hook state needed

const checkStoredCredentials = async (email?: string): Promise<boolean> => {
  try {
    if (email) {
      return await hasCredentialsForAccount();
    }
    return await hasCredentials();
  } catch (error) {
    console.error('Error checking credentials:', error);
    logger.error('Error checking credentials:', error);
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
    console.error('Failed to store credentials:', error);
    logger.error('Error storing credentials:', error);
    return false;
  }
};

const removeCredentials = async (email?: string): Promise<boolean> => {
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

    const credentials = await executeQuery(async () => {
      if (email) {
        return loadCredentialsForAccount();
      }
      return loadCredentials();
    }, 'Error loading credentials');

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
