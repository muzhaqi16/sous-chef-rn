'use no memo';
// Test infrastructure: the compiler outlines closures out of these hook-named
// fakes, losing the state they capture.
import { useEffect, useSyncExternalStore } from 'react';
import { installPlatform, requirePlatform } from '#platform/install';
import { streamedFileParts } from '#native/fileParts';
import type {
  AppLifecycle,
  AppLifecycleState,
  DeviceIdLoadResult,
  KeyValueStore,
  NavigationIntents,
  PendingRevocation,
  PlatformServices,
  ScreenHooks,
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

/** Intents that go nowhere. A test spies on the one it asserts, reached through
 * `requirePlatform('screen').useNavigationIntents()`. */
const memoryNavigationIntents: NavigationIntents = {
  goBack: () => {},
  toAuth: () => {},
  toVerifyEmail: () => {},
  toJoinHomeByCode: () => {},
  toJoinByShareCode: () => {},
  toRecipeDetail: () => {},
  toRecipeCreate: () => {},
};

/** Screen hooks a test drives: every screen focused until `setFocused`. */
export interface MemoryScreen extends ScreenHooks {
  setFocused(focused: boolean): void;
}

function createMemoryScreen(): MemoryScreen {
  let focused = true;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const useIsScreenFocused = () =>
    useSyncExternalStore(subscribe, () => focused);
  return {
    useNavigationIntents: () => memoryNavigationIntents,
    useIsScreenFocused,
    useScreenFocusEffect: effect => {
      const isFocused = useIsScreenFocused();
      useEffect(() => (isFocused ? effect() : undefined), [isFocused, effect]);
    },
    setFocused: next => {
      focused = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Every service in memory, with the values the native mocks report. */
export function createMemoryPlatform(): PlatformServices {
  return {
    environment: { NODE_ENV: 'test' },
    keyValueStore: createMemoryKeyValueStore(),
    secureStore: createMemorySecureStore(),
    platformInfo: { os: 'ios', appVersion: '1.0.0', isEmulator: false },
    appLifecycle: createMemoryAppLifecycle(),
    appearance: { applyTheme: () => {}, apply: () => {} },
    clock: { now: () => Date.now() },
    imagePrefetch: { prefetch: () => {} },
    fileParts: streamedFileParts,
    screen: createMemoryScreen(),
  };
}

export function installMemoryPlatform(): void {
  installPlatform(createMemoryPlatform());
}

/** The intents every memory screen navigates with, for a test to spy on. */
export const memoryIntents = (): NavigationIntents =>
  requirePlatform('screen').useNavigationIntents();

/** The installed app lifecycle, to move between foreground and background. */
export const memoryLifecycle = (): ReturnType<
  typeof createMemoryAppLifecycle
> =>
  requirePlatform('appLifecycle') as ReturnType<
    typeof createMemoryAppLifecycle
  >;

/** The installed screen hooks, to blur and refocus every screen. */
export const memoryScreen = (): MemoryScreen =>
  requirePlatform('screen') as MemoryScreen;
