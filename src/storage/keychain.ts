import * as Keychain from 'react-native-keychain';

const DEFAULT_SERVICE = 'dev.souschef.app.credentials';
const CREDENTIALS_INDICATOR_SERVICE = 'dev.souschef.app.credentials.indicator';

export interface SaveOptions {
  /** namespace of this item */
  service?: string;
  /** require current biometrics (or device passcode) to read */
  accessControl?: Keychain.ACCESS_CONTROL;
  /** on Android, force hardware-backed keystore */
  securityLevel?: Keychain.SECURITY_LEVEL;
}

// Simple queue to prevent concurrent keychain access on Android
let isOperationInProgress = false;
const operationQueue: Array<() => Promise<any>> = [];

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
    } catch (error) {
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
    await Keychain.resetGenericPassword({ service });
    await Keychain.resetGenericPassword({
      service: CREDENTIALS_INDICATOR_SERVICE,
    });

    // Now save with a policy that forces a prompt on load
    const success = await Keychain.setGenericPassword(username, password, {
      service,
      // Allow either FaceID/TouchID (iOS) or any enrolled biometric (Android)
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      // On Android, insist on a hardware-backed keystore
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      // Only accessible when device is unlocked
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (!success) {
      throw new Error("Keychain couldn't save credentials");
    }

    // Save an unprotected indicator that credentials exist
    // This allows us to check if credentials exist without triggering biometric authentication
    const indicatorSuccess = await Keychain.setGenericPassword(
      'credentials_exist',
      Date.now().toString(),
      {
        service: CREDENTIALS_INDICATOR_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        // No access control - this can be read without biometric authentication
      },
    );

    if (!indicatorSuccess) {
      // If we can't save the indicator, clean up the credentials we just saved
      await Keychain.resetGenericPassword({ service });
      throw new Error("Keychain couldn't save credentials indicator");
    }
  });
}

export interface LoadOptions {
  service?: string;
  /** custom title & cancel button for the biometric prompt */
  authenticationPrompt?: Keychain.AuthenticationPrompt;
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
    const creds = await Keychain.getGenericPassword({
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
  } catch (err) {
    // could also inspect err.code here if you want, but treating
    // any error as "no creds" is simplest:
    return null;
  }
}

/**
 * Check if credentials exist without triggering biometric authentication.
 * This checks the unprotected indicator, not the actual credentials.
 */
export async function hasCredentials(): Promise<boolean> {
  return queueOperation(async () => {
    try {
      // Check the unprotected indicator instead of the protected credentials
      const indicator = await Keychain.getGenericPassword({
        service: CREDENTIALS_INDICATOR_SERVICE,
      });
      const result = !!indicator;
      return result;
    } catch (err: any) {
      // Handle Android DataStore concurrency issue
      if (err?.message?.includes('multiple DataStores active')) {
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const indicator = await Keychain.getGenericPassword({
            service: CREDENTIALS_INDICATOR_SERVICE,
          });
          const result = !!indicator;
          return result;
        } catch (retryErr) {
          return false;
        }
      }
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
    await Keychain.resetGenericPassword({ service });
    await Keychain.resetGenericPassword({
      service: CREDENTIALS_INDICATOR_SERVICE,
    });
  } catch (err) {
    console.error('Failed to clear credentials:', err);
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
    const biometryType = await Keychain.getSupportedBiometryType();
    return {
      isAvailable: biometryType !== null,
      biometryType: biometryType,
    };
  } catch (error) {
    console.error('Failed to get biometric capability:', error);
    return { isAvailable: false, biometryType: null };
  }
}

export async function saveEmailOnly(email: string): Promise<void> {
  try {
    await Keychain.setInternetCredentials('souschefrn-email', email, email, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    console.error('Failed to save email:', error);
  }
}

export async function getEmailOnly(): Promise<string | null> {
  try {
    const result = await Keychain.getInternetCredentials('souschefrn-email');
    return result ? result.username : null;
  } catch (error) {
    console.error('Failed to get email:', error);
    return null;
  }
}

// Legacy support functions for the existing codebase
export async function hasCredentialsForAccount(
  _email: string,
): Promise<boolean> {
  // For the new simplified implementation, we just check if any credentials exist
  return hasCredentials();
}

export async function loadCredentialsForAccount(
  _email: string,
): Promise<{ username: string; password: string } | null> {
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
