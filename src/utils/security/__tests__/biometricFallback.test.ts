'use no memo';

// Override global keychain mock to include BIOMETRY_TYPE and BIOMETRY_ANY_OR_DEVICE_PASSCODE
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  getSupportedBiometryType: jest.fn(() => Promise.resolve('FaceID')),
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    USER_PRESENCE: 'UserPresence',
    BIOMETRY_ANY: 'BiometryAny',
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    DEVICE_PASSCODE: 'DevicePasscode',
  },
  SECURITY_LEVEL: {
    SECURE_SOFTWARE: 'SecureSoftware',
    SECURE_HARDWARE: 'SecureHardware',
    ANY: 'Any',
  },
  BIOMETRY_TYPE: {
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
    FINGERPRINT: 'Fingerprint',
    FACE: 'Face',
    IRIS: 'Iris',
  },
}));

import { Platform } from 'react-native';
import {
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  ACCESSIBLE,
  ACCESS_CONTROL,
  SECURITY_LEVEL,
  BIOMETRY_TYPE,
  STORAGE_TYPE,
} from 'react-native-keychain';

import { BiometricManager } from '../biometricFallback';

// The global keychain mock from jest.setup.js doesn't include BIOMETRY_TYPE or
// BIOMETRY_ANY_OR_DEVICE_PASSCODE, so we add them via the module reference
// (the mock is already set up globally).

const mockedGetSupportedBiometryType =
  getSupportedBiometryType as jest.MockedFunction<
    typeof getSupportedBiometryType
  >;
const mockedSetGenericPassword = setGenericPassword as jest.MockedFunction<
  typeof setGenericPassword
>;
const mockedGetGenericPassword = getGenericPassword as jest.MockedFunction<
  typeof getGenericPassword
>;

describe('BiometricManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BiometricManager.clearCapabilityCache();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  // ==========================================================================
  // getBiometricCapability
  // ==========================================================================
  describe('getBiometricCapability', () => {
    it('returns available=true when biometry is supported', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      const result = await BiometricManager.getBiometricCapability();
      expect(result.isAvailable).toBe(true);
      expect(result.biometryType).toBe('FaceID');
      expect(result.error).toBeUndefined();
    });

    it('returns available=false when biometry is not supported', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getBiometricCapability();
      expect(result.isAvailable).toBe(false);
      expect(result.biometryType).toBeNull();
    });

    it('caches the result on subsequent calls', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      await BiometricManager.getBiometricCapability();
      await BiometricManager.getBiometricCapability();
      expect(mockedGetSupportedBiometryType).toHaveBeenCalledTimes(1);
    });

    it('returns cached result without querying again', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.TOUCH_ID);
      const first = await BiometricManager.getBiometricCapability();
      mockedGetSupportedBiometryType.mockResolvedValue(null); // wouldn't matter since cached
      const second = await BiometricManager.getBiometricCapability();
      expect(second).toBe(first);
    });

    it('handles error from getSupportedBiometryType', async () => {
      mockedGetSupportedBiometryType.mockRejectedValue(
        new Error('Keychain error'),
      );
      const result = await BiometricManager.getBiometricCapability();
      expect(result.isAvailable).toBe(false);
      expect(result.biometryType).toBeNull();
      expect(result.error).toBe('Keychain error');
    });

    it('handles error without message', async () => {
      mockedGetSupportedBiometryType.mockRejectedValue({});
      const result = await BiometricManager.getBiometricCapability();
      expect(result.error).toBe('Unknown biometric error');
    });
  });

  // ==========================================================================
  // clearCapabilityCache
  // ==========================================================================
  describe('clearCapabilityCache', () => {
    it('clears cached capability so next call queries again', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      await BiometricManager.getBiometricCapability();
      BiometricManager.clearCapabilityCache();
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getBiometricCapability();
      expect(result.isAvailable).toBe(false);
      expect(mockedGetSupportedBiometryType).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // getAccessControl
  // ==========================================================================
  describe('getAccessControl', () => {
    it('returns BIOMETRY_ANY_OR_DEVICE_PASSCODE when biometric available and allowDevicePasscode', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      const result = await BiometricManager.getAccessControl({
        allowDevicePasscode: true,
      });
      expect(result).toBe(ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE);
    });

    it('returns BIOMETRY_ANY when biometric available but no passcode fallback', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      const result = await BiometricManager.getAccessControl({
        allowDevicePasscode: false,
      });
      expect(result).toBe(ACCESS_CONTROL.BIOMETRY_ANY);
    });

    it('returns undefined when biometric required but not available', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getAccessControl({
        requireBiometric: true,
      });
      expect(result).toBeUndefined();
    });

    it('returns DEVICE_PASSCODE when biometric not available but passcode allowed', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getAccessControl({
        allowDevicePasscode: true,
      });
      expect(result).toBe(ACCESS_CONTROL.DEVICE_PASSCODE);
    });

    it('returns undefined when biometric not available, passcode not allowed, fallback to password', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getAccessControl({
        allowDevicePasscode: false,
        fallbackToPassword: true,
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when no suitable access control found', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const result = await BiometricManager.getAccessControl({
        allowDevicePasscode: false,
        fallbackToPassword: false,
      });
      expect(result).toBeUndefined();
    });

    it('uses default options when none provided', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      const result = await BiometricManager.getAccessControl();
      expect(result).toBe(ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE);
    });
  });

  // ==========================================================================
  // getSecurityLevel
  // ==========================================================================
  describe('getSecurityLevel', () => {
    it('returns undefined on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
      const result = await BiometricManager.getSecurityLevel();
      expect(result).toBeUndefined();
    });

    it('returns SECURE_HARDWARE on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const result = await BiometricManager.getSecurityLevel();
      expect(result).toBe(SECURITY_LEVEL.SECURE_HARDWARE);
    });
  });

  // ==========================================================================
  // createKeychainOptions
  // ==========================================================================
  describe('createKeychainOptions', () => {
    it('creates options with access control when available', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      const options = await BiometricManager.createKeychainOptions(
        'test-service',
      );
      expect(options.service).toBe('test-service');
      expect(options.accessible).toBe(
        ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      );
      expect(options.accessControl).toBeDefined();
    });

    it('includes security level on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const options = await BiometricManager.createKeychainOptions(
        'test-service',
      );
      expect(options.securityLevel).toBe(SECURITY_LEVEL.SECURE_HARDWARE);
    });

    it('omits access control when not available', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      const options = await BiometricManager.createKeychainOptions(
        'test-service',
        {
          requireBiometric: true,
        },
      );
      expect(options.accessControl).toBeUndefined();
    });
  });

  // ==========================================================================
  // saveCredentialsWithFallback
  // ==========================================================================
  describe('saveCredentialsWithFallback', () => {
    it('saves with biometric when available and fallbackToPassword is false', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      mockedSetGenericPassword.mockResolvedValue({
        service: 'test',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        { fallbackToPassword: false },
      );
      expect(result.success).toBe(true);
      expect(result.method).toBe('biometric');
    });

    it('falls back to passcode when biometric save fails', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      mockedSetGenericPassword
        .mockRejectedValueOnce(new Error('Biometric failed'))
        .mockResolvedValueOnce({
          service: 'test',
          storage: 'keychain' as STORAGE_TYPE,
        });
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        { fallbackToPassword: false },
      );
      expect(result.success).toBe(true);
      expect(result.method).toBe('passcode');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Biometric save failed, trying fallback:'),
        expect.any(Error),
      );
    });

    it('falls back to basic when passcode also fails', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      mockedSetGenericPassword
        .mockRejectedValueOnce(new Error('Biometric failed'))
        .mockRejectedValueOnce(new Error('Passcode failed'))
        .mockResolvedValueOnce({
          service: 'test',
          storage: 'keychain' as STORAGE_TYPE,
        });
      // fallbackToPassword defaults to true, so strategy 3 is tried
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        { fallbackToPassword: undefined },
      );
      expect(result.success).toBe(true);
      expect(result.method).toBe('basic');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Biometric save failed'),
        expect.any(Error),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Passcode save failed'),
        expect.any(Error),
      );
    });

    it('returns error when all strategies fail', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      mockedSetGenericPassword.mockRejectedValue(new Error('All failed'));
      // fallbackToPassword defaults to true, so all 3 strategies are tried and all fail
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
      expect(result.error).toBeTruthy();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Biometric save failed'),
        expect.any(Error),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Passcode save failed'),
        expect.any(Error),
      );
    });

    it('skips biometric when biometric not available', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedSetGenericPassword.mockResolvedValue({
        service: 'test',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        {},
      );
      expect(result.success).toBe(true);
      expect(result.method).toBe('passcode');
    });

    it('skips passcode when allowDevicePasscode is false', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedSetGenericPassword.mockResolvedValue({
        service: 'test',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        { allowDevicePasscode: false },
      );
      expect(result.success).toBe(true);
      expect(result.method).toBe('basic');
    });

    it('returns no-method when fallbackToPassword is false and biometric unavailable', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedSetGenericPassword.mockResolvedValue({
        service: 'test',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.saveCredentialsWithFallback(
        'svc',
        'user',
        'pass',
        { allowDevicePasscode: false, fallbackToPassword: false },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('No suitable save method available');
    });
  });

  // ==========================================================================
  // loadCredentialsWithFallback
  // ==========================================================================
  describe('loadCredentialsWithFallback', () => {
    it('loads credentials with biometric prompt', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      mockedGetGenericPassword.mockResolvedValue({
        username: 'user',
        password: 'pass',
        service: 'svc',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(true);
      expect(result.credentials).toEqual({
        username: 'user',
        password: 'pass',
      });
      expect(result.method).toBe('biometric');
    });

    it('loads credentials with passcode when biometric not available', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockResolvedValue({
        username: 'user',
        password: 'pass',
        service: 'svc',
        storage: 'keychain' as STORAGE_TYPE,
      });
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(true);
      expect(result.method).toBe('passcode');
    });

    it('returns error when no credentials found', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockResolvedValue(false);
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No credentials found');
    });

    it('handles UserCancel error', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue(new Error('UserCancel'));
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled by user');
    });

    it('handles UserFallback error', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue(new Error('UserFallback'));
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled by user');
    });

    it('handles BiometryNotAvailable error', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue(
        new Error('BiometryNotAvailable'),
      );
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('handles BiometryLockout error', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue(new Error('BiometryLockout'));
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    it('handles generic error', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue(
        new Error('Something went wrong'),
      );
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('handles error without message', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      mockedGetGenericPassword.mockRejectedValue({});
      const result = await BiometricManager.loadCredentialsWithFallback('svc');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  // ==========================================================================
  // hasCredentials
  // ==========================================================================
  describe('hasCredentials', () => {
    it('returns true when credentials exist', async () => {
      mockedGetGenericPassword.mockResolvedValue({
        username: 'user',
        password: 'pass',
        service: 'svc',
        storage: 'keychain' as STORAGE_TYPE,
      });
      expect(await BiometricManager.hasCredentials('svc')).toBe(true);
    });

    it('returns false when no credentials exist', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      expect(await BiometricManager.hasCredentials('svc')).toBe(false);
    });

    it('returns false on error', async () => {
      mockedGetGenericPassword.mockRejectedValue(new Error('fail'));
      expect(await BiometricManager.hasCredentials('svc')).toBe(false);
    });
  });

  // ==========================================================================
  // getBiometricTypeName
  // ==========================================================================
  describe('getBiometricTypeName', () => {
    it('returns Touch ID', () => {
      expect(
        BiometricManager.getBiometricTypeName(BIOMETRY_TYPE.TOUCH_ID),
      ).toBe('Touch ID');
    });

    it('returns Face ID', () => {
      expect(BiometricManager.getBiometricTypeName(BIOMETRY_TYPE.FACE_ID)).toBe(
        'Face ID',
      );
    });

    it('returns Fingerprint', () => {
      expect(
        BiometricManager.getBiometricTypeName(BIOMETRY_TYPE.FINGERPRINT),
      ).toBe('Fingerprint');
    });

    it('returns Face Recognition', () => {
      expect(BiometricManager.getBiometricTypeName(BIOMETRY_TYPE.FACE)).toBe(
        'Face Recognition',
      );
    });

    it('returns Iris Recognition', () => {
      expect(BiometricManager.getBiometricTypeName(BIOMETRY_TYPE.IRIS)).toBe(
        'Iris Recognition',
      );
    });

    it('returns default for null', () => {
      expect(BiometricManager.getBiometricTypeName(null)).toBe(
        'Biometric Authentication',
      );
    });

    it('returns default for unknown type', () => {
      expect(
        BiometricManager.getBiometricTypeName('Unknown' as BIOMETRY_TYPE),
      ).toBe('Biometric Authentication');
    });
  });
});
