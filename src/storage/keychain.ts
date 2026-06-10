import {
  ACCESS_CONTROL,
  SECURITY_LEVEL,
  ACCESSIBLE,
  resetGenericPassword,
  setGenericPassword,
  getGenericPassword,
  getSupportedBiometryType,
  setInternetCredentials,
  getInternetCredentials,
  type AuthenticationPrompt,
} from 'react-native-keychain';
import { logger } from '#/utils/environment';

const DEFAULT_SERVICE = 'dev.souschef.app.credentials';
const CREDENTIALS_INDICATOR_SERVICE = 'dev.souschef.app.credentials.indicator';
const TEMP_REGISTRATION_SERVICE = 'dev.souschef.app.temp.registration';
const SESSION_TOKENS_SERVICE = 'dev.souschef.app.session.tokens';

export interface SaveOptions {
  /** namespace of this item */
  service?: string;
  /** require current biometrics (or device passcode) to read */
  accessControl?: ACCESS_CONTROL;
  /** on Android, force hardware-backed keystore */
  securityLevel?: SECURITY_LEVEL;
}

// Simple queue to prevent concurrent keychain access on Android
let isOperationInProgress = false;
const operationQueue: Array<() => Promise<void>> = [];

// PERFORMANCE: Cache for hasCredentials() to avoid repeated native calls
let credentialsExistCache: boolean | null = null;

const queueOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const wrappedOperation = async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    operationQueue.push(wrappedOperation);
    processQueue();
  });
};

const processQueue = async () => {
  if (isOperationInProgress || operationQueue.length === 0) {
    return;
  }

  isOperationInProgress = true;
  const operation = operationQueue.shift();

  if (operation) {
    try {
      await operation();
    } catch {
      // Operation will handle its own error via reject
    }
  }

  isOperationInProgress = false;

  // Process next operation if any
  if (operationQueue.length > 0) {
    setImmediate(processQueue);
  }
};

/**
 * Store username & password in the native keystore/keychain
 * under a policy that requires biometry to retrieve.
 */
export async function saveCredentials(
  username: string,
  password: string,
  service: string = DEFAULT_SERVICE,
): Promise<void> {
  return queueOperation(async () => {
    // First, clear any old, unprotected creds:
    await resetGenericPassword({ service });
    await resetGenericPassword({
      service: CREDENTIALS_INDICATOR_SERVICE,
    });

    // Now save with a policy that forces a prompt on load
    const success = await setGenericPassword(username, password, {
      service,
      // Allow either FaceID/TouchID (iOS) or any enrolled biometric (Android)
      accessControl: ACCESS_CONTROL.BIOMETRY_ANY,
      // On Android, insist on a hardware-backed keystore
      securityLevel: SECURITY_LEVEL.SECURE_HARDWARE,
      // Only accessible when device is unlocked
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (!success) {
      throw new Error("Keychain couldn't save credentials");
    }

    // Save an unprotected indicator that credentials exist
    // This allows us to check if credentials exist without triggering biometric authentication
    const indicatorSuccess = await setGenericPassword(
      'credentials_exist',
      Date.now().toString(),
      {
        service: CREDENTIALS_INDICATOR_SERVICE,
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        // No access control - this can be read without biometric authentication
      },
    );

    if (!indicatorSuccess) {
      // If we can't save the indicator, clean up the credentials we just saved
      await resetGenericPassword({ service });
      throw new Error("Keychain couldn't save credentials indicator");
    }

    // PERFORMANCE: Invalidate cache after saving credentials
    credentialsExistCache = true;
  });
}

export interface LoadOptions {
  service?: string;
  /** custom title & cancel button for the biometric prompt */
  authenticationPrompt?: AuthenticationPrompt;
}

/**
 * Retrieve stored credentials, prompting the user
 * to authenticate with biometrics / passcode.
 */
export async function loadCredentials(
  service: string = DEFAULT_SERVICE,
): Promise<{ username: string; password: string } | null> {
  try {
    // This call will now *always* trigger FaceID/TouchID (or device passcode)
    const creds = await getGenericPassword({
      service,
      authenticationPrompt: {
        title: 'Unlock saved credentials',
        cancel: 'Use manual login',
      },
    });
    if (!creds) {
      // user hit "cancel" or failed the check
      return null;
    }
    const result = { username: creds.username, password: creds.password };
    return result;
  } catch {
    // could also inspect err.code here if you want, but treating
    // any error as "no creds" is simplest:
    return null;
  }
}

/**
 * Check if credentials exist without triggering biometric authentication.
 * This checks the unprotected indicator, not the actual credentials.
 *
 * PERFORMANCE: Results are cached to avoid repeated native Keychain calls.
 * Cache is invalidated when credentials are saved or cleared.
 */
export async function hasCredentials(): Promise<boolean> {
  // PERFORMANCE: Return cached result if available
  if (credentialsExistCache !== null) {
    return credentialsExistCache;
  }

  return queueOperation(async () => {
    try {
      // Check the unprotected indicator instead of the protected credentials
      const indicator = await getGenericPassword({
        service: CREDENTIALS_INDICATOR_SERVICE,
      });
      const result = !!indicator;

      // PERFORMANCE: Cache the result
      credentialsExistCache = result;

      return result;
    } catch (err) {
      // Handle Android DataStore concurrency issue
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('multiple DataStores active')) {
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const indicator = await getGenericPassword({
            service: CREDENTIALS_INDICATOR_SERVICE,
          });
          const result = !!indicator;

          // PERFORMANCE: Cache the result
          credentialsExistCache = result;

          return result;
        } catch {
          // Don't cache errors
          return false;
        }
      }
      // Don't cache errors
      return false;
    }
  });
}

/**
 * Clear both the protected credentials and the unprotected indicator.
 */
export async function clearCredentials(
  service: string = DEFAULT_SERVICE,
): Promise<void> {
  try {
    await resetGenericPassword({ service });
    await resetGenericPassword({
      service: CREDENTIALS_INDICATOR_SERVICE,
    });

    // PERFORMANCE: Invalidate cache after clearing credentials
    credentialsExistCache = false;
  } catch (err) {
    logger.error('Failed to clear credentials:', err);
    // PERFORMANCE: Invalidate cache even on error to be safe
    credentialsExistCache = null;
    throw err;
  }
}

/**
 * Get available biometric authentication capabilities
 */
export async function getBiometricCapability(): Promise<{
  isAvailable: boolean;
  biometryType: string | null;
}> {
  try {
    const biometryType = await getSupportedBiometryType();
    return {
      isAvailable: biometryType !== null,
      biometryType: biometryType,
    };
  } catch (error) {
    logger.error('Failed to get biometric capability:', error);
    return { isAvailable: false, biometryType: null };
  }
}

export async function saveEmailOnly(email: string): Promise<void> {
  try {
    await setInternetCredentials('souschefrn-email', email, email, {
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    logger.error('Failed to save email:', error);
  }
}

export async function getEmailOnly(): Promise<string | null> {
  try {
    const result = await getInternetCredentials('souschefrn-email');
    return result ? result.username : null;
  } catch (error) {
    logger.error('Failed to get email:', error);
    return null;
  }
}

/**
 * Store the registration password temporarily in the keychain during onboarding.
 * No biometric gate — uses WHEN_UNLOCKED_THIS_DEVICE_ONLY for basic protection.
 * The email is stored as the username so we can validate ownership on load.
 */
export async function saveTempRegistrationPassword(
  email: string,
  password: string,
): Promise<void> {
  return queueOperation(async () => {
    await setGenericPassword(email, password, {
      service: TEMP_REGISTRATION_SERVICE,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });
}

/**
 * Load the temp registration password from the keychain.
 * Returns the password only if the stored username matches the provided email.
 * If there's a mismatch (different user), returns null and clears the stale entry.
 */
export async function loadTempRegistrationPassword(
  email: string,
): Promise<string | null> {
  try {
    const creds = await getGenericPassword({
      service: TEMP_REGISTRATION_SERVICE,
    });
    if (!creds) return null;

    if (creds.username !== email) {
      // Stale entry from a different user — clear it
      await clearTempRegistrationPassword();
      return null;
    }

    return creds.password;
  } catch {
    return null;
  }
}

/**
 * Clear the temp registration password from the keychain.
 */
export async function clearTempRegistrationPassword(): Promise<void> {
  try {
    await resetGenericPassword({ service: TEMP_REGISTRATION_SERVICE });
  } catch {
    // Non-fatal — entry may not exist
  }
}

// ============================================================================
// Session tokens (access + refresh JWT)
//
// Tokens are persisted here — NOT in MMKV — so the persisted Zustand state
// holds nothing sensitive and MMKV encryption can stay best-effort. No
// biometric gate: tokens must be readable on every cold start without a
// prompt. AFTER_FIRST_UNLOCK (vs WHEN_UNLOCKED) lets background work
// (WebSocket reconnects, notification handlers) read them while the device
// is locked, as long as it has been unlocked once since boot.
// ============================================================================

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveSessionTokens(tokens: SessionTokens): Promise<void> {
  return queueOperation(async () => {
    const success = await setGenericPassword(
      'session',
      JSON.stringify(tokens),
      {
        service: SESSION_TOKENS_SERVICE,
        accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
    if (!success) {
      throw new Error("Keychain couldn't save session tokens");
    }
  });
}

/**
 * Load the session tokens. Returns null on absence, parse failure, or
 * keychain error — callers treat null as "no session" and fall back to login.
 */
export async function loadSessionTokens(): Promise<SessionTokens | null> {
  return queueOperation(async () => {
    try {
      const creds = await getGenericPassword({
        service: SESSION_TOKENS_SERVICE,
      });
      if (!creds) return null;
      const parsed = JSON.parse(creds.password) as Partial<SessionTokens>;
      if (!parsed.accessToken || !parsed.refreshToken) return null;
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    } catch {
      return null;
    }
  });
}

export async function clearSessionTokens(): Promise<void> {
  return queueOperation(async () => {
    try {
      await resetGenericPassword({ service: SESSION_TOKENS_SERVICE });
    } catch {
      // Non-fatal — entry may not exist
    }
  });
}

// Legacy support functions for the existing codebase
export async function hasCredentialsForAccount(): Promise<boolean> {
  // For the new simplified implementation, we just check if any credentials exist
  return hasCredentials();
}

export async function loadCredentialsForAccount(): Promise<{
  username: string;
  password: string;
} | null> {
  // For the new simplified implementation, we just load the default credentials
  return loadCredentials();
}

export async function getStoredAccounts(): Promise<
  Array<{ email: string; lastUsed: number; biometricMethod: string }>
> {
  // For the new simplified implementation, return empty array
  // This can be enhanced later if multi-account support is needed
  return [];
}
