import * as Keychain from 'react-native-keychain';

const DEFAULT_SERVICE = 'com.souschefrn.credentials';
const CREDENTIALS_INDICATOR_SERVICE = 'com.souschefrn.credentials.indicator';

export interface SaveOptions {
  /** namespace of this item */
  service?: string;
  /** require current biometrics (or device passcode) to read */
  accessControl?: Keychain.ACCESS_CONTROL;
  /** on Android, force hardware-backed keystore */
  securityLevel?: Keychain.SECURITY_LEVEL;
}

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
    // Clear any old credentials first
    await Keychain.resetGenericPassword({ service });
    await Keychain.resetGenericPassword({
      service: CREDENTIALS_INDICATOR_SERVICE,
    });

    // Save credentials with biometric access control - triggers biometric prompt ONLY on retrieval
    const result = await Keychain.setGenericPassword(username, password, {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
      storage: Keychain.STORAGE_TYPE.RSA, // Required for Android biometric support
    });

    if (!result) {
      throw new Error('Failed to save credentials to keychain');
    }

    console.log('Credentials saved to keychain with biometric access control');

    // Save an unprotected indicator that credentials exist
    // This allows us to check if credentials exist without triggering biometric authentication
    const indicatorSuccess = await Keychain.setGenericPassword(
      'credentials_exist',
      JSON.stringify({
        timestamp: Date.now(),
        method: 'keychain_unlocked',
      }),
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
    // Load credentials with biometric authentication prompt
    const result = await Keychain.getGenericPassword({
      service,
      authenticationPrompt: {
        title: 'Authenticate to access your saved credentials',
        subtitle: 'Use biometric authentication or device passcode',
        description: 'This allows the app to access your saved login information',
        cancel: 'Cancel',
      },
    });

    if (result && result.username && result.password) {
      console.log('Credentials loaded with biometric authentication');
      return {
        username: result.username,
        password: result.password,
      };
    }

    return null;
  } catch (err: any) {
    console.error('Error loading credentials:', err);
    return null;
  }
}

/**
 * Check if credentials exist without triggering biometric authentication.
 * This checks the unprotected indicator, not the actual credentials.
 */
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

export async function hasCredentials(): Promise<boolean> {
  return queueOperation(async () => {
    try {
      // Check the unprotected indicator instead of the protected credentials
      const indicator = await Keychain.getGenericPassword({
        service: CREDENTIALS_INDICATOR_SERVICE,
      });
      return !!indicator;
    } catch (err: any) {
      // Handle Android DataStore concurrency issue
      if (err?.message?.includes('multiple DataStores active')) {
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const indicator = await Keychain.getGenericPassword({
            service: CREDENTIALS_INDICATOR_SERVICE,
          });
          return !!indicator;
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
    console.error('clearCredentials error:', err);
    throw err;
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
