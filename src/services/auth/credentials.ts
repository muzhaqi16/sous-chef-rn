import { useStore } from '#store';
import { logger } from '#/utils/environment';
import {
  loadCredentials,
  saveCredentials,
  hasCredentials,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability,
} from '#/storage/keychain';

/**
 * What the biometric slot holds: a device-bound credential issued by
 * `issueDeviceCredential`, never the account password. It is useless on another
 * device and the server can revoke it on its own.
 */
export interface StoredDeviceCredential {
  email: string;
  credential: string;
}

/**
 * Marks a slot as holding a device credential. An enrolment made before this
 * existed holds a PASSWORD, and the two are indistinguishable by inspection —
 * so the prefix is what stops the old one being sent anywhere. An unprefixed
 * slot is cleared and the person re-enrols, which costs one password entry.
 */
const DEVICE_CREDENTIAL_PREFIX = 'dc1:';

export const markDeviceCredential = (credential: string): string =>
  `${DEVICE_CREDENTIAL_PREFIX}${credential}`;

/** The credential a slot holds, or null when it predates the prefix. */
export const readDeviceCredential = (stored: string): string | null =>
  stored.startsWith(DEVICE_CREDENTIAL_PREFIX)
    ? stored.slice(DEVICE_CREDENTIAL_PREFIX.length)
    : null;

/**
 * The stored-login tier: keychain credentials and what biometrics the device
 * offers. Pure async — no React, no store — so the sign-in screen and the
 * settings screen can both ask without either owning it.
 */
export async function checkStoredCredentials(
  email?: string | null,
): Promise<boolean> {
  if (!email) return false;
  try {
    return await hasCredentials(email);
  } catch (error) {
    logger.error('Error checking credentials:', error);
    return false;
  }
}

export async function getAvailableAccounts() {
  try {
    return await getStoredAccounts();
  } catch (error) {
    logger.error('Error getting available accounts:', error);
    return [];
  }
}

export async function getBiometricInfo(): Promise<{
  isAvailable: boolean;
  biometryType: string | null;
}> {
  try {
    return await getBiometricCapability();
  } catch (error) {
    logger.error('Error getting biometric capability:', error);
    return { isAvailable: false, biometryType: null };
  }
}

export async function storeCredentials(
  email: string,
  credential: string,
): Promise<boolean> {
  try {
    await saveCredentials(email, credential);
    return true;
  } catch (error) {
    logger.error('Error storing credentials:', error);
    return false;
  }
}

export async function removeCredentials(email?: string): Promise<boolean> {
  if (!email) return false;
  try {
    await clearCredentials(email);
    return true;
  } catch (error) {
    logger.error('Error removing credentials:', error);
    return false;
  }
}

export async function loadStoredCredentials(
  email?: string,
): Promise<StoredDeviceCredential | null> {
  if (!email) return null;
  const store = useStore.getState();
  store.setAuthIsLoadingCredentials(true);

  try {
    const credentials = await loadCredentials(email);

    store.setAuthIsLoadingCredentials(false);

    return credentials
      ? { email: credentials.username, credential: credentials.password }
      : null;
  } catch (error) {
    logger.error('Error loading credentials:', error);
    store.setAuthIsLoadingCredentials(false);
    return null;
  }
}
