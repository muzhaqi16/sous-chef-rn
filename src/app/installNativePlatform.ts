import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { getVersion, isEmulatorSync, isTablet } from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { installPlatform } from '#platform/install';
import type { AppLifecycleState } from '#platform/ports';
import { generatedEnv } from '#native/generatedEnv';
import { mmkvKeyValueStore } from '#native/storage/keyValueStore';
import { keychainSecureStore } from '#native/storage/secureStore';
import {
  applyAppearanceToRuntime,
  applyThemeToRuntime,
} from '#theme/applyAppearance';
import { preloadImages } from '#components/atoms/CachedImage';
import { alertService } from '#services/alertService';
import { presentNativeAlert } from '#native/nativeAlert';
import { reactNavigationScreenHooks } from '#hooks/navigation/screenHooks';
import { streamedFileParts } from '#native/fileParts';
import { HapticService } from '#services/haptic/HapticService';
import { ReviewPrompt } from '#native/ReviewPrompt';
import { ApproximateLocation } from '#native/ApproximateLocation';

// `currentState` is typed as any string, and Android reports none until its
// first change: a state the port does not name is 'unknown'.
const lifecycleState = (status: string | null | undefined): AppLifecycleState =>
  status === 'active' || status === 'inactive' || status === 'background'
    ? status
    : 'unknown';

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
    get isTablet() {
      return isTablet();
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
  connectivity: {
    subscribe: listener =>
      NetInfo.addEventListener(state =>
        listener({
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
        }),
      ),
  },
  appearance: {
    applyTheme: theme => applyThemeToRuntime(theme),
    apply: settings => applyAppearanceToRuntime(settings),
  },
  imagePrefetch: { prefetch: uris => preloadImages(uris) },
  haptics: {
    selection: () => HapticService.selection(),
    success: () => HapticService.success(),
    warning: () => HapticService.warning(),
  },
  screenReader: {
    announce: message => AccessibilityInfo.announceForAccessibility(message),
  },
  reviewPrompt: { request: () => ReviewPrompt.request() },
  approximateLocation: ApproximateLocation,
  fileParts: streamedFileParts,
  screen: reactNavigationScreenHooks,
});

// Until AlertProvider mounts and takes over, an alert is the OS's own.
alertService.init(presentNativeAlert);
