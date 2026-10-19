import { installPlatform } from '#platform/install';
import type {
  AppLifecycle,
  AppLifecycleState,
  DeviceIdLoadResult,
  KeyValueStore,
  PendingRevocation,
  PlatformServices,
  SecureStore,
  SessionTokens,
} from '#platform/ports';

/** A key-value store over a Map, open from the start. */
export function createMemoryKeyValueStore(): KeyValueStore {
  const values = new Map<string, string | number | boolean>();
  const read = <T>(key: string, type: string): T | undefined => {
    const value = values.get(key);
    return typeof value === type ? (value as T) : undefined;
  };
  return {
    set: (key, value) => {
      values.set(key, value);
    },
    getString: key => read<string>(key, 'string'),
    getNumber: key => read<number>(key, 'number'),
    getBoolean: key => read<boolean>(key, 'boolean'),
    contains: key => values.has(key),
    remove: key => values.delete(key),
    getAllKeys: () => [...values.keys()],
    clearAll: () => values.clear(),
    ready: () => Promise.resolve(),
    isReady: () => true,
    isRecovery: () => false,
    openedWithEmptyStore: () => false,
  };
}

export function createMemorySecureStore(): SecureStore {
  let tokens: SessionTokens | null = null;
  let deviceId: string | null = null;
  let revocations: PendingRevocation[] = [];
  return {
    saveSessionTokens: async next => {
      tokens = { ...next };
      return true;
    },
    loadSessionTokens: async () =>
      tokens ? { status: 'ok', tokens: { ...tokens } } : { status: 'absent' },
    clearSessionTokens: async () => {
      tokens = null;
      return true;
    },
    saveDeviceId: async next => {
      deviceId = next;
      return true;
    },
    loadDeviceId: async (): Promise<DeviceIdLoadResult> =>
      deviceId ? { status: 'ok', deviceId } : { status: 'absent' },
    addPendingRevocation: async revocation => {
      revocations = [
        ...revocations.filter(
          entry => entry.refreshToken !== revocation.refreshToken,
        ),
        revocation,
      ];
      return true;
    },
    loadPendingRevocations: async () => [...revocations],
    removePendingRevocation: async refreshToken => {
      revocations = revocations.filter(
        entry => entry.refreshToken !== refreshToken,
      );
    },
  };
}

/** An app lifecycle a test moves with `moveTo`. */
export function createMemoryAppLifecycle(): AppLifecycle & {
  moveTo: (state: AppLifecycleState) => void;
} {
  let state: AppLifecycleState = 'active';
  const listeners = new Set<(next: AppLifecycleState) => void>();
  return {
    current: () => state,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    moveTo: next => {
      state = next;
      for (const listener of [...listeners]) listener(next);
    },
  };
}

/** Every service in memory, with the values the native mocks report. */
export function createMemoryPlatform(): PlatformServices {
  return {
    environment: {},
    keyValueStore: createMemoryKeyValueStore(),
    secureStore: createMemorySecureStore(),
    platformInfo: { os: 'ios', appVersion: '1.0.0', isEmulator: false },
    appLifecycle: createMemoryAppLifecycle(),
    appearance: { applyTheme: () => {}, apply: () => {} },
    clock: { now: () => Date.now() },
    imagePrefetch: () => {},
  };
}

export function installMemoryPlatform(): void {
  installPlatform(createMemoryPlatform());
}
