import {
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  getSupportedBiometryType,
  setInternetCredentials,
  getInternetCredentials,
  resetInternetCredentials,
  SECURITY_LEVEL,
  getAllGenericPasswordServices,
} from 'react-native-keychain';
import {
  saveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials,
  getBiometricCapability,
  saveLastBiometricEmail,
  getLastBiometricEmail,
  claimBiometricSlot,
  DEFAULT_SERVICE,
  CREDENTIALS_INDICATOR_SERVICE,
  clearTempRegistrationPassword,
  saveSessionTokens,
  loadSessionTokens,
  clearSessionTokens,
  hasCredentialsForAccount,
  loadCredentialsForAccount,
  getStoredAccounts,
  pickFresherSessionTokens,
} from '../keychain';
import { logger } from '#/utils/environment';

// Cast to jest.Mock for type safety
const mockSetGenericPassword = setGenericPassword as jest.Mock;
const mockGetGenericPassword = getGenericPassword as jest.Mock;
const mockResetGenericPassword = resetGenericPassword as jest.Mock;
const mockGetSupportedBiometryType = getSupportedBiometryType as jest.Mock;
const mockSetInternetCredentials = setInternetCredentials as jest.Mock;
const mockGetInternetCredentials = getInternetCredentials as jest.Mock;
const mockResetInternetCredentials = resetInternetCredentials as jest.Mock;
const mockGetAllServices = getAllGenericPasswordServices as jest.Mock;

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

      // First call should save actual credentials under the per-account service
      expect(mockSetGenericPassword).toHaveBeenCalledWith(
        'user@test.com',
        'password123',
        expect.objectContaining({
          service: 'dev.souschef.app.credentials.user@test.com',
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

    it('falls back to a software-backed key when hardware-backed key generation fails', async () => {
      mockResetGenericPassword.mockResolvedValue(true);
      mockSetGenericPassword
        // Hardware-backed attempt for the protected credentials throws
        .mockRejectedValueOnce(
          new Error(
            'com.oblador.keychain.exceptions.CryptoFailedException: Cannot generate keys with required security guarantees',
          ),
        )
        // Software-backed retry succeeds
        .mockResolvedValueOnce(true)
        // Indicator save succeeds
        .mockResolvedValueOnce(true);

      await saveCredentials('user@test.com', 'password123');

      expect(mockSetGenericPassword).toHaveBeenCalledTimes(3);
      expect(mockSetGenericPassword).toHaveBeenNthCalledWith(
        1,
        'user@test.com',
        'password123',
        expect.objectContaining({
          securityLevel: SECURITY_LEVEL.SECURE_HARDWARE,
        }),
      );
      expect(mockSetGenericPassword).toHaveBeenNthCalledWith(
        2,
        'user@test.com',
        'password123',
        expect.objectContaining({
          securityLevel: SECURITY_LEVEL.SECURE_SOFTWARE,
        }),
      );
    });

    it('throws when both the hardware-backed and software-backed attempts fail', async () => {
      mockResetGenericPassword.mockResolvedValue(true);
      mockSetGenericPassword
        .mockRejectedValueOnce(new Error('CryptoFailedException'))
        .mockRejectedValueOnce(new Error('still failing'));

      await expect(
        saveCredentials('user@test.com', 'password123'),
      ).rejects.toThrow('still failing');

      expect(mockSetGenericPassword).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadCredentials', () => {
    it('returns credentials when available', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'user@test.com',
        password: 'password123',
      });

      const result = await loadCredentials('user@test.com');
      expect(result).toEqual({
        username: 'user@test.com',
        password: 'password123',
      });
    });

    it('returns null when no credentials exist', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      const result = await loadCredentials('user@test.com');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetGenericPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await loadCredentials('user@test.com');
      expect(result).toBeNull();
    });

    it('reads the per-account service for the given email', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      await loadCredentials('user@test.com');
      expect(mockGetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.credentials.user@test.com',
        }),
      );
    });

    it('passes authentication prompt', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      await loadCredentials('user@test.com');
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
    // Distinct emails per spec so the module-level per-account cache (which
    // persists across tests in this suite) can't answer for a prior spec.
    it('returns true when indicator exists', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'credentials_exist',
        password: '12345',
      });

      const result = await hasCredentials('has-true@test.com');
      expect(result).toBe(true);
      expect(mockGetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.credentials.indicator.has-true@test.com',
        }),
      );
    });

    it('returns false when indicator does not exist', async () => {
      mockGetGenericPassword.mockResolvedValue(false);

      const result = await hasCredentials('has-false@test.com');
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetGenericPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await hasCredentials('has-error@test.com');
      expect(result).toBe(false);
    });
  });

  describe('clearCredentials', () => {
    it('clears both credentials and indicator', async () => {
      mockResetGenericPassword.mockResolvedValue(true);

      await clearCredentials('user@test.com');
      expect(mockResetGenericPassword).toHaveBeenCalledTimes(2);
    });

    it('forgets the stored identity hint when it names this account', async () => {
      // The login screen has no logged-in user: it reads this hint to decide
      // WHICH account the biometric button unlocks, and the hint carries no
      // access control at all. Clearing only the two per-account services left
      // it naming an account whose credentials were gone — so the button still
      // appeared for the previous user, and a deleted account's address stayed
      // on the device forever.
      mockResetGenericPassword.mockResolvedValue(true);
      mockGetInternetCredentials.mockResolvedValue({
        username: 'user@test.com',
        password: 'user@test.com',
      });

      await clearCredentials('user@test.com');

      expect(mockResetInternetCredentials).toHaveBeenCalled();
    });

    it('leaves another account’s identity hint alone', async () => {
      // A different account may have enrolled since. Taking its hint away
      // would silently disable a biometric login that still works.
      mockResetGenericPassword.mockResolvedValue(true);
      mockGetInternetCredentials.mockResolvedValue({
        username: 'someone-else@test.com',
        password: 'someone-else@test.com',
      });

      await clearCredentials('user@test.com');

      expect(mockResetInternetCredentials).not.toHaveBeenCalled();
    });

    it('still clears the credentials when the hint cannot be read', async () => {
      mockResetGenericPassword.mockResolvedValue(true);
      mockGetInternetCredentials.mockRejectedValue(new Error('locked'));

      await expect(clearCredentials('user@test.com')).resolves.toBeUndefined();
      expect(mockResetGenericPassword).toHaveBeenCalledTimes(2);
    });

    it('throws on error but still invalidates cache', async () => {
      mockResetGenericPassword.mockRejectedValue(new Error('Clear failed'));

      await expect(clearCredentials('user@test.com')).rejects.toThrow(
        'Clear failed',
      );
      expect(logger.error).toHaveBeenCalledWith(
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
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get biometric capability:'),
        expect.any(Error),
      );
    });
  });

  describe('claimBiometricSlot', () => {
    it('clears EVERY other enrolled account, including ones no hint names', () => {
      // The account enrolled before the hint was being written is invisible to
      // the hint, so the keychain itself is what has to be read.
      mockGetAllServices.mockResolvedValue([
        `${DEFAULT_SERVICE}.old@test.com`,
        `${CREDENTIALS_INDICATOR_SERVICE}.old@test.com`,
        `${DEFAULT_SERVICE}.forgotten@test.com`,
        `${DEFAULT_SERVICE}.new@test.com`,
        'souschefrn.session.tokens',
      ]);
      mockGetInternetCredentials.mockResolvedValue(false);
      mockResetGenericPassword.mockResolvedValue(true);
      mockSetInternetCredentials.mockResolvedValue(true);

      return claimBiometricSlot('new@test.com').then(() => {
        expect(mockResetGenericPassword).toHaveBeenCalledWith({
          service: `${DEFAULT_SERVICE}.old@test.com`,
        });
        expect(mockResetGenericPassword).toHaveBeenCalledWith({
          service: `${DEFAULT_SERVICE}.forgotten@test.com`,
        });
        // The account being claimed keeps its slots.
        expect(mockResetGenericPassword).not.toHaveBeenCalledWith({
          service: `${DEFAULT_SERVICE}.new@test.com`,
        });
      });
    });

    it('does not read an indicator service as an account of its own', async () => {
      // `credentials.` also prefixes `credentials.indicator.`, so a naive
      // filter yields an account called `indicator.<email>`.
      mockGetAllServices.mockResolvedValue([
        `${CREDENTIALS_INDICATOR_SERVICE}.only@test.com`,
      ]);
      mockGetInternetCredentials.mockResolvedValue(false);
      mockSetInternetCredentials.mockResolvedValue(true);

      await claimBiometricSlot('someone@test.com');

      expect(mockResetGenericPassword).not.toHaveBeenCalled();
    });

    it('still clears the hinted account when the keychain cannot be listed', async () => {
      mockGetAllServices.mockRejectedValue(new Error('unsupported'));
      mockGetInternetCredentials.mockResolvedValue({
        username: 'old@test.com',
      });
      mockResetGenericPassword.mockResolvedValue(true);
      mockResetInternetCredentials.mockResolvedValue(true);
      mockSetInternetCredentials.mockResolvedValue(true);

      await claimBiometricSlot('new@test.com');

      expect(mockResetGenericPassword).toHaveBeenCalledWith({
        service: `${DEFAULT_SERVICE}.old@test.com`,
      });
    });

    it('clears the previously enrolled account and points at the new one', async () => {
      mockGetInternetCredentials.mockResolvedValue({
        username: 'old@test.com',
      });
      mockResetGenericPassword.mockResolvedValue(true);
      mockResetInternetCredentials.mockResolvedValue(true);
      mockSetInternetCredentials.mockResolvedValue(true);

      await claimBiometricSlot('new@test.com');

      // The login screen can only offer one account, so the old slots are
      // unreachable data — both of its services go.
      expect(mockResetGenericPassword).toHaveBeenCalledWith({
        service: `${DEFAULT_SERVICE}.old@test.com`,
      });
      expect(mockResetGenericPassword).toHaveBeenCalledWith({
        service: `${CREDENTIALS_INDICATOR_SERVICE}.old@test.com`,
      });
      expect(mockSetInternetCredentials).toHaveBeenCalledWith(
        'souschefrn-email',
        'new@test.com',
        'new@test.com',
        expect.any(Object),
      );
    });

    it('keeps the slots when the same account re-enrols, however it is cased', async () => {
      mockGetInternetCredentials.mockResolvedValue({
        username: 'User@Test.com',
      });
      mockResetGenericPassword.mockResolvedValue(true);
      mockSetInternetCredentials.mockResolvedValue(true);

      await claimBiometricSlot('  user@test.com ');

      expect(mockResetGenericPassword).not.toHaveBeenCalled();
      expect(mockSetInternetCredentials).toHaveBeenCalled();
    });

    it('just claims the pointer when nothing was enrolled', async () => {
      mockGetInternetCredentials.mockResolvedValue(false);
      mockSetInternetCredentials.mockResolvedValue(true);

      await claimBiometricSlot('first@test.com');

      expect(mockResetGenericPassword).not.toHaveBeenCalled();
      expect(mockSetInternetCredentials).toHaveBeenCalled();
    });
  });

  describe('saveLastBiometricEmail', () => {
    it('saves email using internet credentials', async () => {
      mockSetInternetCredentials.mockResolvedValue(true);

      await saveLastBiometricEmail('user@test.com');
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
      await expect(
        saveLastBiometricEmail('user@test.com'),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save email:'),
        expect.any(Error),
      );
    });
  });

  describe('getLastBiometricEmail', () => {
    it('returns email when stored', async () => {
      mockGetInternetCredentials.mockResolvedValue({
        username: 'user@test.com',
        password: 'user@test.com',
      });

      const result = await getLastBiometricEmail();
      expect(result).toBe('user@test.com');
    });

    it('returns null when no email stored', async () => {
      mockGetInternetCredentials.mockResolvedValue(false);

      const result = await getLastBiometricEmail();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetInternetCredentials.mockRejectedValue(new Error('Error'));

      const result = await getLastBiometricEmail();
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get email:'),
        expect.any(Error),
      );
    });
  });

  describe('loadCredentials after a biometric enrolment change', () => {
    /**
     * What the Android bridge actually delivers. `KeychainModule` rejects with
     * `promise.reject(Errors.E_CRYPTO_FAILED, throwable)`, and RN's
     * `PromiseImpl` puts the code on `code`, the Java class name on `name`, and
     * `CryptoFailedException`'s "Wrapped error: …" prose on `message`. The
     * class name never reaches `message`, so a matcher reading only
     * `name`+`message` finds none of its own patterns.
     */
    const androidInvalidation = () =>
      Object.assign(
        new Error(
          'Wrapped error: User changed or deleted their auth credentials',
        ),
        {
          code: 'E_CRYPTO_FAILED',
          name: 'com.oblador.keychain.exceptions.CryptoFailedException',
        },
      );

    it('clears the slot on the shape Android actually rejects with', async () => {
      mockGetGenericPassword.mockRejectedValue(androidInvalidation());
      mockResetGenericPassword.mockResolvedValue(true);

      const result = await loadCredentials('user@test.com');

      expect(result).toBeNull();
      expect(mockResetGenericPassword).toHaveBeenCalled();
    });

    it('clears the slot when iOS names the accessibility constant', async () => {
      mockGetGenericPassword.mockRejectedValue(
        Object.assign(
          new Error('The user name or passphrase you entered is not correct.'),
          {
            message: 'BiometryCurrentSet entry could not be decrypted',
          },
        ),
      );
      mockResetGenericPassword.mockResolvedValue(true);

      await loadCredentials('user@test.com');

      expect(mockResetGenericPassword).toHaveBeenCalled();
    });

    it('keeps the slot when the keystore is merely unreachable', async () => {
      mockGetGenericPassword.mockRejectedValue(
        Object.assign(
          new Error('Wrapped error: keystore is temporarily busy'),
          {
            code: 'E_KEYSTORE_ACCESS_ERROR',
            name: 'com.oblador.keychain.exceptions.KeyStoreAccessException',
          },
        ),
      );

      const result = await loadCredentials('user@test.com');

      expect(result).toBeNull();
      expect(mockResetGenericPassword).not.toHaveBeenCalled();
    });

    it('clears the slot when the entry has been removed by the OS', async () => {
      mockGetGenericPassword.mockResolvedValue(false);
      mockResetGenericPassword.mockResolvedValue(true);

      const result = await loadCredentials('user@test.com');

      expect(result).toBeNull();
      expect(mockResetGenericPassword).toHaveBeenCalled();
    });

    it('keeps the slot when the person cancels the prompt', async () => {
      mockGetGenericPassword.mockRejectedValue(
        new Error('User canceled the operation.'),
      );

      const result = await loadCredentials('user@test.com');

      expect(result).toBeNull();
      expect(mockResetGenericPassword).not.toHaveBeenCalled();
    });

    /**
     * The shape a cancel actually produces. Captured on an SM-S908U1 by tapping
     * the prompt's "Use manual login":
     *   { code: 'E_CRYPTO_FAILED',
     *     name: 'com.oblador.keychain.exceptions.CryptoFailedException',
     *     message: 'code: 13, msg: Use manual login' }
     * `E_CRYPTO_FAILED` is also what an unusable key rejects with, so the
     * prompt's own `code: <n>` marker is the only thing telling them apart.
     */
    const androidPromptOutcome = (errorCode: number, msg: string) =>
      Object.assign(new Error(`code: ${errorCode}, msg: ${msg}`), {
        code: 'E_CRYPTO_FAILED',
        name: 'com.oblador.keychain.exceptions.CryptoFailedException',
      });

    it.each([
      [10, 'Authentication canceled by user'],
      [13, 'Use manual login'],
      [5, 'Authentication canceled'],
      [3, 'Authentication timed out'],
      [7, 'Too many attempts. Try again later.'],
      [9, 'Too many attempts. Biometric authentication disabled.'],
    ])(
      'keeps the slot when the Android prompt ends with code %i',
      async (errorCode, msg) => {
        mockGetGenericPassword.mockRejectedValue(
          androidPromptOutcome(errorCode, msg),
        );

        const result = await loadCredentials('user@test.com');

        expect(result).toBeNull();
        expect(mockResetGenericPassword).not.toHaveBeenCalled();
      },
    );

    it('clears the slot when the platform names the invalidated key', async () => {
      mockGetGenericPassword.mockRejectedValue(
        Object.assign(new Error('Wrapped error: Key permanently invalidated'), {
          code: 'E_CRYPTO_FAILED',
          name: 'com.oblador.keychain.exceptions.CryptoFailedException',
        }),
      );
      mockResetGenericPassword.mockResolvedValue(true);

      await loadCredentials('user@test.com');

      expect(mockResetGenericPassword).toHaveBeenCalled();
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

  describe('session tokens', () => {
    const tokens = { accessToken: 'access-jwt', refreshToken: 'refresh-jwt' };

    beforeEach(async () => {
      // Drop the module-level confirmed-pair cache so each spec starts with
      // an unconfirmed keychain state.
      mockResetGenericPassword.mockResolvedValue(true);
      await clearSessionTokens();
      jest.clearAllMocks();
    });

    it('saveSessionTokens stores both tokens under the session service and reports success', async () => {
      mockSetGenericPassword.mockResolvedValue(true);

      await expect(saveSessionTokens(tokens)).resolves.toBe(true);

      expect(mockSetGenericPassword).toHaveBeenCalledWith(
        'session',
        JSON.stringify(tokens),
        expect.objectContaining({
          service: 'dev.souschef.app.session.tokens',
        }),
      );
    });

    it('saveSessionTokens skips re-writing an identical confirmed pair', async () => {
      mockSetGenericPassword.mockResolvedValue(true);

      await expect(saveSessionTokens(tokens)).resolves.toBe(true);
      await expect(saveSessionTokens(tokens)).resolves.toBe(true);

      expect(mockSetGenericPassword).toHaveBeenCalledTimes(1);
    });

    it('saveSessionTokens returns false when the keychain write fails, and retries on the next call', async () => {
      mockSetGenericPassword.mockResolvedValueOnce(false);
      await expect(saveSessionTokens(tokens)).resolves.toBe(false);

      mockSetGenericPassword.mockRejectedValueOnce(new Error('keystore down'));
      await expect(saveSessionTokens(tokens)).resolves.toBe(false);

      mockSetGenericPassword.mockResolvedValueOnce(true);
      await expect(saveSessionTokens(tokens)).resolves.toBe(true);
      expect(mockSetGenericPassword).toHaveBeenCalledTimes(3);
    });

    it('loadSessionTokens returns the stored pair and confirms it for the save skip-cache', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'session',
        password: JSON.stringify(tokens),
      });

      await expect(loadSessionTokens()).resolves.toEqual({
        status: 'ok',
        tokens,
      });
      expect(mockGetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.session.tokens',
        }),
      );

      // The loaded pair counts as confirmed — write-through of the same pair
      // is a no-op.
      await expect(saveSessionTokens(tokens)).resolves.toBe(true);
      expect(mockSetGenericPassword).not.toHaveBeenCalled();
    });

    it('loadSessionTokens returns absent when no entry exists', async () => {
      mockGetGenericPassword.mockResolvedValue(false);
      await expect(loadSessionTokens()).resolves.toEqual({ status: 'absent' });
      expect(mockGetGenericPassword).toHaveBeenCalledTimes(1);
    });

    it('loadSessionTokens retries transient keychain errors before reporting error status', async () => {
      jest.useFakeTimers();
      mockGetGenericPassword.mockRejectedValue(new Error('keychain dead'));

      const resultPromise = loadSessionTokens();
      await jest.runAllTimersAsync();
      await expect(resultPromise).resolves.toEqual({ status: 'error' });
      expect(mockGetGenericPassword).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });

    it('loadSessionTokens recovers when a retry succeeds', async () => {
      jest.useFakeTimers();
      mockGetGenericPassword
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({
          username: 'session',
          password: JSON.stringify(tokens),
        });

      const resultPromise = loadSessionTokens();
      await jest.runAllTimersAsync();
      await expect(resultPromise).resolves.toEqual({
        status: 'ok',
        tokens,
      });
      expect(mockGetGenericPassword).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('loadSessionTokens treats unparseable or partial payloads as absent without retrying', async () => {
      mockGetGenericPassword.mockResolvedValue({
        username: 'session',
        password: 'not-json',
      });
      await expect(loadSessionTokens()).resolves.toEqual({ status: 'absent' });

      mockGetGenericPassword.mockResolvedValue({
        username: 'session',
        password: JSON.stringify({ accessToken: 'only-access' }),
      });
      await expect(loadSessionTokens()).resolves.toEqual({ status: 'absent' });
    });

    it('clearSessionTokens resets the session service, reports failures, and drops the skip-cache', async () => {
      mockSetGenericPassword.mockResolvedValue(true);
      await saveSessionTokens(tokens);

      mockResetGenericPassword.mockResolvedValue(true);
      await expect(clearSessionTokens()).resolves.toBe(true);
      expect(mockResetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'dev.souschef.app.session.tokens',
        }),
      );

      // The cleared pair is unconfirmed — saving it again writes.
      await expect(saveSessionTokens(tokens)).resolves.toBe(true);
      expect(mockSetGenericPassword).toHaveBeenCalledTimes(2);

      mockResetGenericPassword.mockRejectedValue(new Error('Error'));
      await expect(clearSessionTokens()).resolves.toBe(false);
    });
  });

  describe('account-scoped aliases', () => {
    it('hasCredentialsForAccount delegates to hasCredentials', async () => {
      const result = await hasCredentialsForAccount('alias-has@test.com');
      expect(typeof result).toBe('boolean');
    });

    it('loadCredentialsForAccount delegates to loadCredentials', async () => {
      mockGetGenericPassword.mockResolvedValue(false);
      const result = await loadCredentialsForAccount('alias-load@test.com');
      expect(result).toBeNull();
    });

    it('getStoredAccounts returns empty array', async () => {
      const result = await getStoredAccounts();
      expect(result).toEqual([]);
    });
  });

  describe('pickFresherSessionTokens', () => {
    // Minimal unsigned JWT carrying just the `iat` claim jwt-decode reads.
    const tokenWithIat = (iat: number): string => {
      const payload = Buffer.from(JSON.stringify({ iat })).toString(
        'base64url',
      );
      return `header.${payload}.signature`;
    };
    const pair = (iat: number) => ({
      accessToken: `access-${iat}`,
      refreshToken: tokenWithIat(iat),
    });

    it('returns primary when there is no fallback', () => {
      const primary = pair(100);
      expect(pickFresherSessionTokens(primary, null)).toBe(primary);
    });

    it('returns the fallback when its refresh token is newer', () => {
      const primary = pair(100);
      const fallback = pair(200);
      expect(pickFresherSessionTokens(primary, fallback)).toBe(fallback);
    });

    it('returns primary when the fallback refresh token is older', () => {
      const primary = pair(200);
      const fallback = pair(100);
      expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
    });

    it('favors primary on an equal issue time', () => {
      const primary = pair(100);
      const fallback = pair(100);
      expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
    });

    it('favors primary when the fallback token is undecodable', () => {
      const primary = pair(100);
      const fallback = {
        accessToken: 'access-bad',
        refreshToken: 'not-a-jwt',
      };
      expect(pickFresherSessionTokens(primary, fallback)).toBe(primary);
    });
  });
});
