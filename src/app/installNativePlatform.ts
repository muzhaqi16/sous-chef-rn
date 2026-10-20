import { AppState, Platform, type AppStateStatus } from 'react-native';
import { getVersion, isEmulatorSync } from 'react-native-device-info';
import { installPlatform } from '#platform/install';
import type { AppLifecycleState } from '#platform/ports';
import { generatedEnv } from '#native/generatedEnv';
import { mmkvKeyValueStore } from '#native/storage/keyValueStore';
import { keychainSecureStore } from '#native/storage/secureStore';
import {
  applyAppearanceToRuntime,
  applyThemeToRuntime,
} from '#/theme/applyAppearance';
import { preloadImages } from '#components/atoms/CachedImage';
import { alertService } from '#/services/alertService';
import { presentNativeAlert } from '#native/nativeAlert';
import { reactNavigationScreenHooks } from '#hooks/navigation/screenHooks';
import { streamedFileParts } from '#native/fileParts';
import { logger } from '#/utils/environment';

// `null` is untyped but real: Android reports no state until its first change.
const lifecycleState = (status: AppStateStatus | null): AppLifecycleState =>
  status === null || status === 'extension' ? 'unknown' : status;

// Imported at the first haptic, not statically: HapticService reads the store,
// which reads this install as it loads.
const haptic = (kind: 'selection' | 'warning') => (): void => {
  import('#services/haptic/HapticService')
    .then(({ HapticService }) => HapticService[kind]())
    .catch((error: unknown) => logger.warn('Haptic feedback failed', error));
};

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
    applyTheme: theme => applyThemeToRuntime(theme),
    apply: settings => applyAppearanceToRuntime(settings),
  },
  imagePrefetch: { prefetch: uris => preloadImages(uris) },
  haptics: { selection: haptic('selection'), warning: haptic('warning') },
  fileParts: streamedFileParts,
  screen: reactNavigationScreenHooks,
});

// Until AlertProvider mounts and takes over, an alert is the OS's own.
alertService.init(presentNativeAlert);
