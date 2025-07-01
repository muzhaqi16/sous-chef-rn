import * as Keychain from 'react-native-keychain';

const DEFAULT_SERVICE = 'com.souschefrn.credentials';

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
  // First, clear any old, unprotected creds:
  await Keychain.resetGenericPassword({service});

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
    throw new Error('Keychain couldn’t save credentials');
  }
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
): Promise<{username: string; password: string} | null> {
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
      // user hit “cancel” or failed the check
      return null;
    }
    return {username: creds.username, password: creds.password};
  } catch (err) {
    // could also inspect err.code here if you want, but treating
    // any error as “no creds” is simplest:
    return null;
  }
}

export async function hasCredentials(
  service: string = DEFAULT_SERVICE,
): Promise<boolean> {
  try {
    const creds = await Keychain.getGenericPassword({service});
    return !!creds;
  } catch (err) {
    console.error('hasCredentials error:', err);
    throw err;
  }
}
