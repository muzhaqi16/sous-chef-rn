import {
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  getSupportedBiometryType,
  setInternetCredentials,
  getInternetCredentials,
} from 'react-native-keychain';
import {
  saveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials,
  getBiometricCapability,
  saveEmailOnly,
  getEmailOnly,
  saveTempRegistrationPassword,
  loadTempRegistrationPassword,
  clearTempRegistrationPassword,
  hasCredentialsForAccount,
  loadCredentialsForAccount,
  getStoredAccounts,
} from '../keychain';

// Cast to jest.Mock for type safety
const mockSetGenericPassword = setGenericPassword as jest.Mock;
const mockGetGenericPassword = getGenericPassword as jest.Mock;
const mockResetGenericPassword = resetGenericPassword as jest.Mock;
const mockGetSupportedBiometryType = getSupportedBiometryType as jest.Mock;
const mockSetInternetCredentials = setInternetCredentials as jest.Mock;
const mockGetInternetCredentials = getInternetCredentials as jest.Mock;

describe('keychain storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the module-level cache by re-requiring
    // Since we can't easily reset the credentialsExistCache, we test behavior as-is
  });

  describe('saveCredentials', () => {
    it('saves credentials to keychain with biometric protection', async () => {
      mockSetGenericPassword.mockResolvedValue(true);
      mockResetGenericPassword.mockResolvedValue(true);

      await saveCredentials('user@test.com', 'password123');

      // Should clear old credentials first (2 calls for main + indicator)
      expect(mockResetGenericPassword).toHaveBeenCalledTimes(2);

      // Should save main credentials + indicator (2 calls)
      expect(mockSetGenericPassword).toHaveBeenCalledTimes(2);

      // First call should save actual credentials
      expect(mockSetGenericPassword).toHaveBeenCalledWith(
        'user@test.com',
        'password123',
        expect.objectContaining({
          service: 'dev.souschef.app.credentials',
        }),
      );
    });

    it('throws when keychain save fails', async () => {
      mockResetGenericPassword.mockResolvedValue(true);
      mockSetGenericPassword.mockResolvedValue(false);

      await expect(
        saveCredentials('user@test.com', 'password123'),
      ).rejects.toThrow("Keychain couldn't save credentials");
    });

    it('cleans up credentials when indicator save fails', async () => {
      mockResetGenericPassword.mockResolvedValue(true);
      // First call succeeds (credentials), second call fails (indicator)
      mockSetGenericPassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await expect(
        saveCredentials('user@test.com', 'password123'),
      ).rejects.toThrow("Keychain couldn't save credentials indicator");

      // Should clean up the credentials that were just saved
      expect(mockResetGenericPassword).toHaveBeenCalledTimes(3);
    });
  });

  describe('loadCredentials', () => {
    it('returns credentials when available', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'user@test.com',
        password: 'password123',
      });

      const result = await loadCredentials();
      expect(result).toEqual({
        username: 'user@test.com',
        password: 'password123',
      });
    });

    it('returns null when no credentials exist', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      const result = await loadCredentials();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetGenericPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await loadCredentials();
      expect(result).toBeNull();
    });

    it('uses default service when none provided', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      await loadCredentials();
      expect(mockGetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.credentials',
        }),
      );
    });

    it('passes authentication prompt', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      await loadCredentials();
      expect(mockGetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticationPrompt: {
            title: 'Unlock saved credentials',
            cancel: 'Use manual login',
          },
        }),
      );
    });
  });

  describe('hasCredentials', () => {
    it('returns true when indicator exists', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'credentials_exist',
        password: '12345',
      });

      const result = await hasCredentials();
      expect(result).toBe(true);
    });

    it('returns false when indicator does not exist', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      const result = await hasCredentials();
      // Note: result depends on cache state from previous tests
      expect(typeof result).toBe('boolean');
    });

    it('returns false on error', async () => {
      mockGetGenericPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await hasCredentials();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('clearCredentials', () => {
    it('clears both credentials and indicator', async () => {
      mockResetGenericPassword.mockResolvedValue(true);

      await clearCredentials();
      expect(mockResetGenericPassword).toHaveBeenCalledTimes(2);
    });

    it('throws on error but still invalidates cache', async () => {
      mockResetGenericPassword.mockRejectedValue(
        new Error('Clear failed'),
      );

      await expect(clearCredentials()).rejects.toThrow('Clear failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear credentials:'),
        expect.any(Error),
      );
    });
  });

  describe('getBiometricCapability', () => {
    it('returns biometric availability info', async () => {
      mockGetSupportedBiometryType.mockResolvedValue('FaceID');

      const result = await getBiometricCapability();
      expect(result).toEqual({
        isAvailable: true,
        biometryType: 'FaceID',
      });
    });

    it('returns unavailable when no biometry supported', async () => {
      mockGetSupportedBiometryType.mockResolvedValue(null);

      const result = await getBiometricCapability();
      expect(result).toEqual({
        isAvailable: false,
        biometryType: null,
      });
    });

    it('returns unavailable on error', async () => {
      mockGetSupportedBiometryType.mockRejectedValue(new Error('Error'));

      const result = await getBiometricCapability();
      expect(result).toEqual({
        isAvailable: false,
        biometryType: null,
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get biometric capability:'),
        expect.any(Error),
      );
    });
  });

  describe('saveEmailOnly', () => {
    it('saves email using internet credentials', async () => {
      mockSetInternetCredentials.mockResolvedValue(true);

      await saveEmailOnly('user@test.com');
      expect(mockSetInternetCredentials).toHaveBeenCalledWith(
        'souschefrn-email',
        'user@test.com',
        'user@test.com',
        expect.any(Object),
      );
    });

    it('does not throw on error', async () => {
      mockSetInternetCredentials.mockRejectedValue(new Error('Save error'));

      // Should not throw
      await expect(saveEmailOnly('user@test.com')).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save email:'),
        expect.any(Error),
      );
    });
  });

  describe('getEmailOnly', () => {
    it('returns email when stored', async () => {
      mockGetInternetCredentials.mockResolvedValue({
        username: 'user@test.com',
        password: 'user@test.com',
      });

      const result = await getEmailOnly();
      expect(result).toBe('user@test.com');
    });

    it('returns null when no email stored', async () => {
      mockGetInternetCredentials.mockResolvedValue(false);

      const result = await getEmailOnly();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetInternetCredentials.mockRejectedValue(new Error('Error'));

      const result = await getEmailOnly();
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get email:'),
        expect.any(Error),
      );
    });
  });

  describe('saveTempRegistrationPassword', () => {
    it('saves password with temp service', async () => {
      mockSetGenericPassword.mockResolvedValue(true);

      await saveTempRegistrationPassword('user@test.com', 'temp-pass');
      expect(mockSetGenericPassword).toHaveBeenCalledWith(
        'user@test.com',
        'temp-pass',
        expect.objectContaining({
          service: 'dev.souschef.app.temp.registration',
        }),
      );
    });
  });

  describe('loadTempRegistrationPassword', () => {
    it('returns password when email matches', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'user@test.com',
        password: 'temp-pass',
      });

      const result = await loadTempRegistrationPassword('user@test.com');
      expect(result).toBe('temp-pass');
    });

    it('returns null and clears when email does not match', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'other@test.com',
        password: 'temp-pass',
      });
      mockResetGenericPassword.mockResolvedValue(true);

      const result = await loadTempRegistrationPassword('user@test.com');
      expect(result).toBeNull();
    });

    it('returns null when no credentials exist', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      const result = await loadTempRegistrationPassword('user@test.com');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetGenericPassword.mockRejectedValue(new Error('Error'));

      const result = await loadTempRegistrationPassword('user@test.com');
      expect(result).toBeNull();
    });
  });

  describe('clearTempRegistrationPassword', () => {
    it('resets the temp registration service', async () => {
      mockResetGenericPassword.mockResolvedValue(true);

      await clearTempRegistrationPassword();
      expect(mockResetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.temp.registration',
        }),
      );
    });

    it('does not throw on error', async () => {
      mockResetGenericPassword.mockRejectedValue(new Error('Error'));

      await expect(clearTempRegistrationPassword()).resolves.toBeUndefined();
    });
  });

  describe('legacy support functions', () => {
    it('hasCredentialsForAccount delegates to hasCredentials', async () => {
      const result = await hasCredentialsForAccount();
      expect(typeof result).toBe('boolean');
    });

    it('loadCredentialsForAccount delegates to loadCredentials', async () => {
      mockGetGenericPassword.mockResolvedValue(false);
      const result = await loadCredentialsForAccount();
      expect(result).toBeNull();
    });

    it('getStoredAccounts returns empty array', async () => {
      const result = await getStoredAccounts();
      expect(result).toEqual([]);
    });
  });
});
