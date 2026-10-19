import { AppState, Platform, type AppStateStatus } from 'react-native';
import performance from 'react-native-performance';
import { getVersion, isEmulatorSync } from 'react-native-device-info';
import { installPlatform } from '#platform/install';
import type { AppLifecycleState } from '#platform/ports';
import { generatedEnv } from '#native/generatedEnv';
import {
  initializeSecureStorage,
  isRecoveryStorage,
  isStorageReady,
  openedWithEmptyStore,
  storage,
} from '#/storage/mmkv';
import {
  addPendingRevocation,
  clearSessionTokens,
  loadDeviceId,
  loadPendingRevocations,
  loadSessionTokens,
  removePendingRevocation,
  saveDeviceId,
  saveSessionTokens,
} from '#/storage/keychain';
import { applyThemePreferenceToRuntime } from '#store/slices/preferencesSlice';
import { applyAppearanceToRuntime } from '#/theme/applyAppearance';
import { preloadImages } from '#components/atoms/CachedImage';

const lifecycleState = (status: AppStateStatus): AppLifecycleState =>
  status === 'extension' ? 'unknown' : status;

// Every adapter delegates through an arrow or a getter: Metro's inline requires
// then load each native module at its first use, not during this install,
// which runs before the rest of the app has started.
installPlatform({
  environment: generatedEnv,
  keyValueStore: {
    set: (key, value) => storage.set(key, value),
    getString: key => storage.getString(key),
    getNumber: key => storage.getNumber(key),
    getBoolean: key => storage.getBoolean(key),
    contains: key => storage.contains(key),
    remove: key => storage.remove(key),
    getAllKeys: () => storage.getAllKeys(),
    clearAll: () => storage.clearAll(),
    ready: async () => {
      await initializeSecureStorage();
    },
    isReady: () => isStorageReady(),
    isRecovery: () => isRecoveryStorage(),
    openedWithEmptyStore: () => openedWithEmptyStore(),
  },
  secureStore: {
    saveSessionTokens: tokens => saveSessionTokens(tokens),
    loadSessionTokens: () => loadSessionTokens(),
    clearSessionTokens: () => clearSessionTokens(),
    saveDeviceId: deviceId => saveDeviceId(deviceId),
    loadDeviceId: () => loadDeviceId(),
    addPendingRevocation: revocation => addPendingRevocation(revocation),
    loadPendingRevocations: () => loadPendingRevocations(),
    removePendingRevocation: refreshToken =>
      removePendingRevocation(refreshToken),
  },
  platformInfo: {
    get os() {
      return Platform.OS === 'ios' ? 'ios' : 'android';
    },
    get appVersion() {
      return getVersion();
    },
    get isEmulator() {
      return isEmulatorSync();
    },
  },
  appLifecycle: {
    current: () => lifecycleState(AppState.currentState),
    subscribe: listener => {
      const subscription = AppState.addEventListener('change', status =>
        listener(lifecycleState(status)),
      );
      return () => subscription.remove();
    },
  },
  appearance: {
    applyTheme: theme => applyThemePreferenceToRuntime(theme),
    apply: settings => applyAppearanceToRuntime(settings),
  },
  clock: { now: () => performance.now() },
  imagePrefetch: uris => preloadImages(uris),
});
