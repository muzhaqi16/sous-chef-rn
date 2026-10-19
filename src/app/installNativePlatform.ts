import { AppState, Platform, type AppStateStatus } from 'react-native';
import performance from 'react-native-performance';
import { getVersion, isEmulatorSync } from 'react-native-device-info';
import { installPlatform } from '#platform/install';
import type { AppLifecycleState } from '#platform/ports';
import { generatedEnv } from '#native/generatedEnv';
import { mmkvKeyValueStore } from '#native/storage/keyValueStore';
import { keychainSecureStore } from '#native/storage/secureStore';
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
  keyValueStore: mmkvKeyValueStore,
  secureStore: keychainSecureStore,
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
