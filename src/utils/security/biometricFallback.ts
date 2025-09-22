import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

export interface BiometricCapability {
  isAvailable: boolean;
  biometryType: Keychain.BIOMETRY_TYPE | null;
  error?: string;
}

export interface BiometricOptions {
  requireBiometric?: boolean;
  allowDevicePasscode?: boolean;
  fallbackToPassword?: boolean;
}

/**
 * Enhanced biometric authentication manager with fallback strategies
 */
export class BiometricManager {
  private static cachedCapability: BiometricCapability | null = null;

  /**
   * Check what biometric authentication is available
   */
  static async getBiometricCapability(): Promise<BiometricCapability> {
    // Return cached result if available
    if (BiometricManager.cachedCapability) {
      return BiometricManager.cachedCapability;
    }

    try {
      const biometryType = await Keychain.getSupportedBiometryType();

      const capability: BiometricCapability = {
        isAvailable: biometryType !== null,
        biometryType,
      };

      // Cache the result
      BiometricManager.cachedCapability = capability;
      return capability;
    } catch (error: any) {
      const capability: BiometricCapability = {
        isAvailable: false,
        biometryType: null,
        error: error.message || 'Unknown biometric error',
      };

      BiometricManager.cachedCapability = capability;
      return capability;
    }
  }

  /**
   * Get appropriate access control based on device capabilities
   */
  static async getAccessControl(options: BiometricOptions = {}): Promise<Keychain.ACCESS_CONTROL | undefined> {
    const {
      requireBiometric = false,
      allowDevicePasscode = true,
      fallbackToPassword = true,
    } = options;

    const capability = await BiometricManager.getBiometricCapability();

    // If biometric is required but not available, return undefined
    if (requireBiometric && !capability.isAvailable) {
      return undefined;
    }

    // If biometric is available, prefer it
    if (capability.isAvailable) {
      if (allowDevicePasscode) {
        return Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
      } else {
        return Keychain.ACCESS_CONTROL.BIOMETRY_ANY;
      }
    }

    // Fallback strategies when biometric is not available
    if (allowDevicePasscode) {
      return Keychain.ACCESS_CONTROL.DEVICE_PASSCODE;
    }

    if (fallbackToPassword) {
      // No access control - will use app-level authentication
      return undefined;
    }

    // No suitable access control found
    return undefined;
  }

  /**
   * Get appropriate security level for Android
   */
  static async getSecurityLevel(): Promise<Keychain.SECURITY_LEVEL | undefined> {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    try {
      // Try secure hardware first
      return Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
    } catch (error) {
      console.warn('Secure hardware not available, falling back to software:', error);
      return Keychain.SECURITY_LEVEL.SECURE_SOFTWARE;
    }
  }

  /**
   * Create optimal keychain options based on device capabilities
   */
  static async createKeychainOptions(
    service: string,
    options: BiometricOptions = {}
  ) {
    const accessControl = await BiometricManager.getAccessControl(options);
    const securityLevel = await BiometricManager.getSecurityLevel();

    const keychainOptions: any = {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };

    if (accessControl) {
      keychainOptions.accessControl = accessControl;
    }

    if (securityLevel) {
      keychainOptions.securityLevel = securityLevel;
    }

    return keychainOptions;
  }

  /**
   * Save credentials with appropriate fallback strategy
   */
  static async saveCredentialsWithFallback(
    service: string,
    username: string,
    password: string,
    options: BiometricOptions = {}
  ): Promise<{ success: boolean; method: string; error?: string }> {
    const capability = await BiometricManager.getBiometricCapability();

    // Strategy 1: Try with biometric protection
    if (capability.isAvailable && !options.fallbackToPassword) {
      try {
        const biometricOptions = await BiometricManager.createKeychainOptions(service, {
          requireBiometric: true,
          allowDevicePasscode: options.allowDevicePasscode,
        });

        const success = await Keychain.setGenericPassword(username, password, biometricOptions);
        if (success) {
          return { success: true, method: 'biometric' };
        }
      } catch (error: any) {
        console.warn('Biometric save failed, trying fallback:', error);
      }
    }

    // Strategy 2: Try with device passcode
    if (options.allowDevicePasscode !== false) {
      try {
        const passcodeOptions = await BiometricManager.createKeychainOptions(service, {
          requireBiometric: false,
          allowDevicePasscode: true,
        });

        const success = await Keychain.setGenericPassword(username, password, passcodeOptions);
        if (success) {
          return { success: true, method: 'passcode' };
        }
      } catch (error: any) {
        console.warn('Passcode save failed, trying basic:', error);
      }
    }

    // Strategy 3: Try with minimal security (no access control)
    if (options.fallbackToPassword !== false) {
      try {
        const basicOptions = {
          service,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        };

        const success = await Keychain.setGenericPassword(username, password, basicOptions);
        if (success) {
          return { success: true, method: 'basic' };
        }
      } catch (error: any) {
        return {
          success: false,
          method: 'none',
          error: error.message || 'All save strategies failed'
        };
      }
    }

    return { success: false, method: 'none', error: 'No suitable save method available' };
  }

  /**
   * Load credentials with appropriate authentication prompt
   */
  static async loadCredentialsWithFallback(
    service: string,
    _options: BiometricOptions = {}
  ): Promise<{ success: boolean; credentials?: { username: string; password: string }; method?: string; error?: string }> {
    const capability = await BiometricManager.getBiometricCapability();

    // Determine authentication prompt based on available methods
    let authPrompt: Keychain.AuthenticationPrompt;
    if (capability.isAvailable) {
      authPrompt = {
        title: 'Unlock your saved credentials',
        subtitle: 'Use your biometric or device passcode',
        description: 'Authenticate to access your saved login information',
        cancel: 'Cancel',
      };
    } else {
      authPrompt = {
        title: 'Unlock your saved credentials',
        subtitle: 'Enter your device passcode',
        description: 'Authenticate to access your saved login information',
        cancel: 'Cancel',
      };
    }

    try {
      const result = await Keychain.getGenericPassword({
        service,
        authenticationPrompt: authPrompt,
      });

      if (result && result.username && result.password) {
        return {
          success: true,
          credentials: {
            username: result.username,
            password: result.password,
          },
          method: capability.isAvailable ? 'biometric' : 'passcode',
        };
      }

      return { success: false, error: 'No credentials found or authentication cancelled' };
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes('UserCancel') || error.message?.includes('UserFallback')) {
        return { success: false, error: 'Authentication cancelled by user' };
      }

      if (error.message?.includes('BiometryNotAvailable')) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      if (error.message?.includes('BiometryLockout')) {
        return { success: false, error: 'Biometric authentication locked. Please use device passcode.' };
      }

      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  /**
   * Check if credentials exist for a service
   */
  static async hasCredentials(service: string): Promise<boolean> {
    try {
      // Try to check without triggering authentication
      const result = await Keychain.getGenericPassword({
        service,
        authenticationPrompt: {
          title: 'Check credentials',
          cancel: 'Cancel',
        },
      });
      return !!result;
    } catch (error) {
      // If any error occurs, assume no credentials
      return false;
    }
  }

  /**
   * Get user-friendly biometric type name
   */
  static getBiometricTypeName(biometryType: Keychain.BIOMETRY_TYPE | null): string {
    switch (biometryType) {
      case Keychain.BIOMETRY_TYPE.TOUCH_ID:
        return 'Touch ID';
      case Keychain.BIOMETRY_TYPE.FACE_ID:
        return 'Face ID';
      case Keychain.BIOMETRY_TYPE.FINGERPRINT:
        return 'Fingerprint';
      case Keychain.BIOMETRY_TYPE.FACE:
        return 'Face Recognition';
      case Keychain.BIOMETRY_TYPE.IRIS:
        return 'Iris Recognition';
      default:
        return 'Biometric Authentication';
    }
  }

  /**
   * Clear cached capability (useful after app resume or settings change)
   */
  static clearCapabilityCache(): void {
    BiometricManager.cachedCapability = null;
  }
}