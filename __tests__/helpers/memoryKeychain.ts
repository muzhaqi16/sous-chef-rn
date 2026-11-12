import type { CredentialsRead } from '#native/storage/keychain';

/**
 * The device keychain as `#native/storage/keychain` presents it, held in
 * memory: one sign-in slot per account, the biometric hardware, the prompt's
 * answer and the last biometric email. Swapped in with
 * `jest.mock('#native/storage/keychain', () => memoryKeychainModule())`.
 */
const slots = new Map<string, string>();
let biometry: string | null = 'FaceID';
let prompt: CredentialsRead['status'] = 'read';
let lastBiometricEmail: string | null = null;
let failing: { save?: Error; clear?: Error } = {};
let invalidatedOnRead = false;

export const memoryKeychain = {
  reset: () => {
    slots.clear();
    biometry = 'FaceID';
    prompt = 'read';
    lastBiometricEmail = null;
    failing = {};
    invalidatedOnRead = false;
  },
  /** An account's stored sign-in, as a slot holds it. */
  hold: (email: string, secret: string) => {
    slots.set(email, secret);
  },
  slotOf: (email: string): string | undefined => slots.get(email),
  withoutBiometrics: () => {
    biometry = null;
  },
  /** The next save throws `error`, as a keystore that will not write does. */
  failNextSave: (error: Error) => {
    failing.save = error;
  },
  /** The next delete throws `error`, as a locked keychain does. */
  failNextClear: (error: Error) => {
    failing.clear = error;
  },
  /** A read finds the slot's key invalidated, and the keychain drops it. */
  invalidateOnRead: () => {
    invalidatedOnRead = true;
  },
  /** What the biometric prompt answers on the next reads. */
  promptAnswers: (status: CredentialsRead['status']) => {
    prompt = status;
  },
};

const stood = {
  saveCredentials: async (email: string, password: string): Promise<void> => {
    const { save } = failing;
    failing.save = undefined;
    if (save) throw save;
    slots.set(email, password);
  },
  loadCredentials: async (email: string): Promise<CredentialsRead> => {
    if (invalidatedOnRead) {
      slots.delete(email);
      return { status: 'unavailable' };
    }
    const password = slots.get(email);
    if (prompt === 'cancelled') return { status: 'cancelled' };
    if (prompt === 'unavailable' || password === undefined) {
      return { status: 'unavailable' };
    }
    return { status: 'read', username: email, password };
  },
  hasCredentials: async (email: string): Promise<boolean> => slots.has(email),
  clearCredentials: async (email: string): Promise<void> => {
    const { clear } = failing;
    failing.clear = undefined;
    if (clear) throw clear;
    slots.delete(email);
  },
  getBiometricCapability: async () => ({
    isAvailable: biometry !== null,
    biometryType: biometry,
  }),
  getLastBiometricEmail: async (): Promise<string | null> => lastBiometricEmail,
  saveLastBiometricEmail: async (email: string): Promise<void> => {
    lastBiometricEmail = email;
  },
  clearLastBiometricEmailFor: async (email: string): Promise<void> => {
    if (lastBiometricEmail === email) lastBiometricEmail = null;
  },
};

/** The module, its account-slot reads and writes held in memory. */
export const memoryKeychainModule = () => ({
  ...jest.requireActual<Record<string, unknown>>('#native/storage/keychain'),
  ...stood,
});
