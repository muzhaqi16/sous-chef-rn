import {
  hasCredentials,
  clearCredentials,
  getBiometricCapability,
} from '#/storage/keychain';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';

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

const getBiometricInfo = async () => {
  try {
    return await getBiometricCapability();
  } catch (error) {
    logger.error('Error getting biometric capability:', error);
    return { isAvailable: false, biometryType: null };
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

/** The keychain reads and the removal the profile's biometric row needs. */
export const useCredentialStorage = () => ({
  checkStoredCredentials,
  getBiometricInfo,
  removeCredentials,
});
