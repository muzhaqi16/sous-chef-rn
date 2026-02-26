import { useState } from 'react';
import {
  loadCredentials,
  loadCredentialsForAccount,
  saveCredentials,
  hasCredentials,
  hasCredentialsForAccount,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability } from '#/storage/keychain';
import { logger } from '#/utils/environment';

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Hook for managing credential storage operations.
 * This hook handles all keychain/biometric credential operations.
 */
export const useCredentialStorage = () => {
  // Local state for credential operations
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  const checkStoredCredentials = async (email?: string): Promise<boolean> => {
      try {
        let result;
        if (email) {
          result = await hasCredentialsForAccount(email);
        } else {
          result = await hasCredentials();
        }
        return result;
      } catch (error) {
        console.error('Error checking credentials:', error);
        logger.error('Error checking credentials:', error);
        return false;
      }
    };

  const loadStoredCredentials = async (email?: string): Promise<Credentials | null> => {
      try {
        setIsLoadingCredentials(true);

        let credentials;
        if (email) {
          credentials = await loadCredentialsForAccount(email);
        } else {
          credentials = await loadCredentials();
        }

        const result = credentials
          ? {
              email: credentials.username,
              password: credentials.password }
          : null;

        return result;
      } catch (error) {
        console.error('Error loading credentials:', error);
        logger.error('Error loading credentials:', error);
        return null;
      } finally {
        setIsLoadingCredentials(false);
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

  const storeCredentials = async (email: string, password: string): Promise<boolean> => {
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

  return {
    // State
    isLoadingCredentials,

    // Credential operations
    checkStoredCredentials,
    loadStoredCredentials,
    getAvailableAccounts,
    getBiometricInfo,
    storeCredentials,
    removeCredentials };
};