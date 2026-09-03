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
  resetInternetCredentials,
  type SetOptions,
} from 'react-native-keychain';
import { jwtDecode } from 'jwt-decode';
import { logger } from '#/utils/environment';
import { t } from '#/i18n';
import { appConfig } from '#/config/appConfig';

// Derived from `appConfig.identity.keychainNamespace` so a fork sets it once,
// in one file. The values must stay byte-identical for THIS app: the OS keychain
// is keyed by service name, so a changed string makes every stored credential
// unreachable and signs everyone out. `__tests__/keychainServiceNames.test.ts`
// pins them.
const NAMESPACE = appConfig.identity.keychainNamespace;
export const DEFAULT_SERVICE = `${NAMESPACE}.credentials`;
export const CREDENTIALS_INDICATOR_SERVICE = `${NAMESPACE}.credentials.indicator`;
export const TEMP_REGISTRATION_SERVICE = `${NAMESPACE}.temp.registration`;
export const SESSION_TOKENS_SERVICE = `${NAMESPACE}.session.tokens`;
export const LAST_BIOMETRIC_EMAIL_KEY =
  appConfig.identity.lastBiometricEmailKey;

// Simple queue to prevent concurrent keychain access on Android
let isOperationInProgress = false;
const operationQueue: Array<() => Promise<void>> = [];

// PERFORMANCE: Per-account cache for hasCredentials() to avoid repeated native
// calls. Keyed by the normalized account so one user's lookup never answers
// for another.
const credentialsExistCache = new Map<string, boolean>();

/**
 * Normalize an account identifier so the same email always maps to the same
 * keychain slot regardless of how it was cased/spaced at the call site.
 */
const normalizeAccount = (email: string): string => email.trim().toLowerCase();

/** Per-account credential service — each user's credentials live in their own slot. */
const credentialsServiceFor = (email: string): string =>
  `${DEFAULT_SERVICE}.${normalizeAccount(email)}`;

/** Per-account indicator service — readable without a biometric prompt. */
const indicatorServiceFor = (email: string): string =>
  `${CREDENTIALS_INDICATOR_SERVICE}.${normalizeAccount(email)}`;

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
 * A device with no hardware-backed keystore THROWS on a SECURE_HARDWARE request
 * rather than degrading, so retry once software-backed. Only where the key
 * material is generated changes; biometric gating is unaffected.
 */
async function setGenericPasswordWithSecurityFallback(
  username: string,
  password: string,
  options: SetOptions,
): ReturnType<typeof setGenericPassword> {
  try {
    return await setGenericPassword(username, password, options);
  } catch (error) {
    if (options.securityLevel !== SECURITY_LEVEL.SECURE_HARDWARE) {
      throw error;
    }
    logger.warn(
      'Hardware-backed keystore unavailable, retrying with software-backed keys:',
      error,
    );
    return setGenericPassword(username, password, {
      ...options,
      securityLevel: SECURITY_LEVEL.SECURE_SOFTWARE,
    });
  }
}

/**
 * Store an account's email & password in the native keystore/keychain under a
 * per-account policy that requires biometry to retrieve. Each account gets its
 * own slot, so enabling biometrics for one user never overwrites or exposes
 * another user's credentials.
 */
export async function saveCredentials(
  email: string,
  password: string,
): Promise<void> {
  const service = credentialsServiceFor(email);
  const indicatorService = indicatorServiceFor(email);
  return queueOperation(async () => {
    // First, clear any old creds for THIS account:
    await resetGenericPassword({ service });
    await resetGenericPassword({ service: indicatorService });

    // Now save with a policy that forces a prompt on load
    const success = await setGenericPasswordWithSecurityFallback(
      email,
      password,
      {
        service,
        // CURRENT_SET, not ANY: the entry is invalidated when a face or finger
        // is enrolled, so someone who learns the passcode cannot add their own
        // biometric and unlock the stored credential.
        accessControl: ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        // On Android, prefer a hardware-backed keystore; falls back to
        // software-backed when the device has no secure element.
        securityLevel: SECURITY_LEVEL.SECURE_HARDWARE,
        // Only accessible when device is unlocked
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );

    if (!success) {
      throw new Error("Keychain couldn't save credentials");
    }

    // Save an unprotected per-account indicator that credentials exist so we
    // can check without triggering biometric authentication.
    const indicatorSuccess = await setGenericPassword(
      'credentials_exist',
      Date.now().toString(),
      {
        service: indicatorService,
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
    credentialsExistCache.set(normalizeAccount(email), true);

    // Record the most-recently-enrolled account so the login screen (which has
    // no logged-in user yet) knows which account to offer biometric login for.
    await saveLastBiometricEmail(email);
  });
}

/**
 * Android reports a `BIOMETRY_CURRENT_SET` entry whose enrolment changed as a
 * permanently invalidated key. iOS removes the item instead, which surfaces as
 * a resolved-but-empty read. Both mean the same thing: this slot can never be
 * unlocked again and must be re-enrolled.
 */
function isPermanentlyInvalidated(error: unknown): boolean {
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /KeyPermanentlyInvalidated|E_CRYPTO_FAILED|BiometryCurrentSet/i.test(
    text,
  );
}

/**
 * Retrieve a specific account's stored credentials, prompting for biometrics.
 * A slot invalidated by a biometric enrolment change is cleared rather than
 * left behind, so the login screen stops offering a prompt that cannot succeed.
 */
export async function loadCredentials(
  email: string,
): Promise<{ username: string; password: string } | null> {
  try {
    const creds = await getGenericPassword({
      service: credentialsServiceFor(email),
      authenticationPrompt: {
        title: t('biometricPrompt.keychainTitle'),
        cancel: t('biometricPrompt.useManualLogin'),
      },
    });
    if (!creds) {
      // A resolved-but-empty read means the entry is gone while its
      // unprotected indicator may remain. Cancellation rejects instead.
      await discardInvalidatedCredentials(email);
      return null;
    }
    return { username: creds.username, password: creds.password };
  } catch (error) {
    if (isPermanentlyInvalidated(error)) {
      await discardInvalidatedCredentials(email);
    }
    // Cancellation and transient failures keep the slot: the person can retry.
    return null;
  }
}

/** Drop a slot the device refuses to unlock. Never throws — the caller is
 * already on a failure path and falls back to password sign-in. */
async function discardInvalidatedCredentials(email: string): Promise<void> {
  try {
    await clearCredentials(email);
    logger.info(
      'Biometric credentials were invalidated; re-enrolment is required.',
    );
  } catch {
    credentialsExistCache.delete(normalizeAccount(email));
  }
}

/**
 * Whether an account has credentials, WITHOUT prompting for biometrics — reads
 * that account's unprotected indicator, not the protected entry. Cached per
 * account; the cache clears when its credentials are saved or removed.
 */
export async function hasCredentials(email: string): Promise<boolean> {
  const account = normalizeAccount(email);

  // PERFORMANCE: Return cached result if available
  const cached = credentialsExistCache.get(account);
  if (cached !== undefined) {
    return cached;
  }

  const indicatorService = indicatorServiceFor(email);
  return queueOperation(async () => {
    try {
      // Check the unprotected indicator instead of the protected credentials
      const indicator = await getGenericPassword({ service: indicatorService });
      const result = !!indicator;

      // PERFORMANCE: Cache the result
      credentialsExistCache.set(account, result);

      return result;
    } catch (err) {
      // Handle Android DataStore concurrency issue
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('multiple DataStores active')) {
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const indicator = await getGenericPassword({
            service: indicatorService,
          });
          const result = !!indicator;

          // PERFORMANCE: Cache the result
          credentialsExistCache.set(account, result);

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
 * Clear a specific account's protected credentials and unprotected indicator.
 */
export async function clearCredentials(email: string): Promise<void> {
  const account = normalizeAccount(email);
  try {
    await resetGenericPassword({ service: credentialsServiceFor(email) });
    await resetGenericPassword({ service: indicatorServiceFor(email) });

    // The identity hint the login screen reads; it must be cleared alongside
    // the per-account services or a deleted account's address stays on the
    // device. Cleared ONLY when it names this account — another may have
    // enrolled since, and taking its hint would disable a working login.
    await clearLastBiometricEmailFor(email);

    // PERFORMANCE: Invalidate cache after clearing credentials
    credentialsExistCache.set(account, false);
  } catch (err) {
    logger.error('Failed to clear credentials:', err);
    // PERFORMANCE: Invalidate cache even on error to be safe
    credentialsExistCache.delete(account);
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

/**
 * Remember which account most recently enrolled biometric login. The login
 * screen has no logged-in user, so it reads this to decide which account's
 * credentials the biometric button should unlock.
 */
export async function saveLastBiometricEmail(email: string): Promise<void> {
  try {
    await setInternetCredentials(LAST_BIOMETRIC_EMAIL_KEY, email, email, {
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    logger.error('Failed to save email:', error);
  }
}

/**
 * Forget the identity hint, but only when it names `email`. Never throws — the
 * hint is a convenience, and the slots it points at are already gone, so the
 * worst case is a button that resolves to nothing.
 */
export async function clearLastBiometricEmailFor(email: string): Promise<void> {
  try {
    const stored = await getInternetCredentials(LAST_BIOMETRIC_EMAIL_KEY);
    if (!stored) return;
    if (normalizeAccount(stored.username) !== normalizeAccount(email)) return;
    await resetInternetCredentials({ server: LAST_BIOMETRIC_EMAIL_KEY });
  } catch (error) {
    logger.error('Failed to clear the stored biometric email:', error);
  }
}

export async function getLastBiometricEmail(): Promise<string | null> {
  try {
    const result = await getInternetCredentials(LAST_BIOMETRIC_EMAIL_KEY);
    return result ? result.username : null;
  } catch (error) {
    logger.error('Failed to get email:', error);
    return null;
  }
}

/**
 * How long a registration password may sit in the keychain waiting for the
 * biometric step. Abandoned onboarding otherwise leaves a plaintext-readable
 * password there indefinitely, and a keychain item survives app deletion.
 */
export const TEMP_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

/** The stored envelope. The timestamp rides with the value because the
 * username slot already carries the email for ownership checks. */
interface TempRegistrationEntry {
  password: string;
  savedAt: number;
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
  const entry: TempRegistrationEntry = { password, savedAt: Date.now() };
  return queueOperation(async () => {
    await setGenericPassword(email, JSON.stringify(entry), {
      service: TEMP_REGISTRATION_SERVICE,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });
}

/** Parse the stored envelope. An unreadable value is treated as expired: the
 * flow can ask for the password again, which a stale secret cannot. */
function readTempEntry(value: string): TempRegistrationEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as TempRegistrationEntry).password === 'string' &&
    typeof (parsed as TempRegistrationEntry).savedAt === 'number'
  ) {
    return parsed as TempRegistrationEntry;
  }
  return null;
}

/**
 * Load the temp registration password from the keychain.
 * Returns the password only if the stored username matches the provided email.
 * If there's a mismatch (different user), returns null and clears the stale entry.
 */
export async function loadTempRegistrationPassword(
  email: string,
): Promise<string | null> {
  let creds: Awaited<ReturnType<typeof getGenericPassword>>;
  try {
    creds = await getGenericPassword({ service: TEMP_REGISTRATION_SERVICE });
  } catch {
    return null;
  }
  if (!creds) return null;

  if (creds.username !== email) {
    // Stale entry from a different user — clear it
    await clearTempRegistrationPassword();
    return null;
  }

  const entry = readTempEntry(creds.password);
  if (!entry || Date.now() - entry.savedAt > TEMP_REGISTRATION_TTL_MS) {
    await clearTempRegistrationPassword();
    return null;
  }

  return entry.password;
}

/**
 * Drop an abandoned registration password. Run at startup: onboarding that is
 * never finished has no other moment that would clear it.
 */
export async function sweepExpiredTempRegistrationPassword(): Promise<void> {
  try {
    const creds = await getGenericPassword({
      service: TEMP_REGISTRATION_SERVICE,
    });
    if (!creds) return;
    const entry = readTempEntry(creds.password);
    if (!entry || Date.now() - entry.savedAt > TEMP_REGISTRATION_TTL_MS) {
      await clearTempRegistrationPassword();
    }
  } catch {
    // The sweep is best-effort; the TTL check on load is the backstop.
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

// Session tokens live here, NOT in MMKV, so persisted Zustand state holds
// nothing sensitive. No biometric gate — they must be readable on every cold
// start without a prompt — and AFTER_FIRST_UNLOCK (not WHEN_UNLOCKED) lets
// background work read them while the device is locked.

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type SessionTokenLoadResult =
  | { status: 'ok'; tokens: SessionTokens }
  | { status: 'absent' }
  | { status: 'error' };

/** Issue time (`iat`, seconds) of a refresh-token JWT; 0 when undecodable. */
const refreshTokenIssuedAt = (refreshToken: string): number => {
  try {
    const { iat } = jwtDecode<{ iat?: number }>(refreshToken);
    return typeof iat === 'number' ? iat : 0;
  } catch {
    return 0;
  }
};

/**
 * The fresher of two token pairs, by refresh-token issue time. A failed keychain
 * write can strand an already-rotated pair there while MMKV holds the newer one,
 * and restoring the stale pair 401s into a logout. Ties favour `primary`.
 */
export const pickFresherSessionTokens = (
  primary: SessionTokens,
  fallback: SessionTokens | null,
): SessionTokens => {
  if (!fallback) return primary;
  return refreshTokenIssuedAt(fallback.refreshToken) >
    refreshTokenIssuedAt(primary.refreshToken)
    ? fallback
    : primary;
};

// Serialized pair confirmed to be in the keychain. Lets saveSessionTokens
// skip re-writing identical data — setGenericPassword is the slowest
// keychain op, and the hydration path re-saves the pair it just loaded.
let confirmedSessionPair: string | null = null;

// Keychain reads can fail transiently at early boot (device restore,
// keystore races — the same class DeviceKeyManager retries for). Retry
// before reporting an error so a hiccup doesn't bounce the user to login.
const SESSION_LOAD_ATTEMPTS = 3;
const SESSION_LOAD_RETRY_BASE_MS = 200;

/**
 * Persist the token pair. Returns true when the keychain holds the pair
 * (written now or already identical), false on failure — callers keep the
 * MMKV fallback copy alive while this is false.
 */
export async function saveSessionTokens(
  tokens: SessionTokens,
): Promise<boolean> {
  return queueOperation(async () => {
    const serialized = JSON.stringify(tokens);
    if (serialized === confirmedSessionPair) return true;
    try {
      const success = await setGenericPassword('session', serialized, {
        service: SESSION_TOKENS_SERVICE,
        accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      if (!success) {
        logger.warn('Keychain rejected the session token write');
        return false;
      }
      confirmedSessionPair = serialized;
      return true;
    } catch (error) {
      logger.warn('Failed to persist session tokens to keychain:', error);
      return false;
    }
  });
}

/**
 * Load the session tokens, distinguishing a confirmed absence ('absent' —
 * the user must log in) from a keychain read failure ('error' — retried
 * with backoff first; callers should fall back to any MMKV copy rather
 * than treating the session as gone).
 */
export async function loadSessionTokens(): Promise<SessionTokenLoadResult> {
  return queueOperation<SessionTokenLoadResult>(
    async (): Promise<SessionTokenLoadResult> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= SESSION_LOAD_ATTEMPTS; attempt++) {
        try {
          const creds = await getGenericPassword({
            service: SESSION_TOKENS_SERVICE,
          });
          if (!creds) return { status: 'absent' };
          let parsed: Partial<SessionTokens>;
          try {
            parsed = JSON.parse(creds.password) as Partial<SessionTokens>;
          } catch {
            // Corrupted entry — retrying can't fix it; treat as no session.
            logger.error(
              'Stored session tokens are unparseable; ignoring them',
            );
            return { status: 'absent' };
          }
          if (!parsed.accessToken || !parsed.refreshToken) {
            return { status: 'absent' };
          }
          const tokens = {
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken,
          };
          confirmedSessionPair = JSON.stringify(tokens);
          return { status: 'ok', tokens };
        } catch (error) {
          lastError = error;
          if (attempt < SESSION_LOAD_ATTEMPTS) {
            await new Promise(resolve =>
              setTimeout(resolve, SESSION_LOAD_RETRY_BASE_MS * attempt),
            );
          }
        }
      }
      logger.error('Session token read failed after retries:', lastError);
      return { status: 'error' };
    },
  );
}

/**
 * Delete the token pair. Returns false when the delete may not have taken
 * effect — the tokens could still be readable on the next launch, so logout
 * flows should surface the failure rather than assume a clean device.
 */
export async function clearSessionTokens(): Promise<boolean> {
  return queueOperation(async () => {
    confirmedSessionPair = null;
    try {
      await resetGenericPassword({ service: SESSION_TOKENS_SERVICE });
      return true;
    } catch (error) {
      logger.error(
        'Failed to clear session tokens — they may remain in the keychain:',
        error,
      );
      return false;
    }
  });
}

// Account-scoped aliases kept for the existing call sites.
export async function hasCredentialsForAccount(
  email: string,
): Promise<boolean> {
  return hasCredentials(email);
}

export async function loadCredentialsForAccount(email: string): Promise<{
  username: string;
  password: string;
} | null> {
  return loadCredentials(email);
}

export async function getStoredAccounts(): Promise<
  Array<{ email: string; lastUsed: number; biometricMethod: string }>
> {
  // For the new simplified implementation, return empty array
  // This can be enhanced later if multi-account support is needed
  return [];
}
