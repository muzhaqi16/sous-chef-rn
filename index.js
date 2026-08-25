// Install crypto.getRandomValues polyfill before any module that uses uuid.
// Must be the very first import — generateId() runs during app startup
// (deviceKey, deviceId) and uuid v4 reads globalThis.crypto.getRandomValues.
import 'react-native-get-random-values';

// Record JS entry timestamp before any imports for startup time measurement
global.__APP_START_TIMESTAMP = Date.now();

// Side-effect import, and it MUST stay eager and near the top.
//
// `react-native-performance` attaches its native `mark` listener at module
// evaluation (its `index.ts:27`). Android's PerformanceModule buffers every
// startup ReactMarker and flushes the whole buffer once, at CONTENT_APPEARED
// — if nothing is listening at that instant the marks are gone, and the JS
// entry store stays empty, so a later observer's `buffered: true` has nothing
// to replay. Metro runs with `inlineRequires: true` (metro.config.js:49), so
// every `import performance from 'react-native-performance'` elsewhere is
// deferred to first USE, and the earliest real use is
// `NativePerformanceService.initialize()` inside a `requestIdleCallback` —
// well after CONTENT_APPEARED. That is why app_native_launch_ms and
// app_js_bundle_load_ms silently returned no data. A bare side-effect import
// has no binding for Metro to inline, so this one stays put.
import 'react-native-performance';

/**
 * Configure Reanimated logger BEFORE any Reanimated code runs
 * This prevents "Cannot read property 'level' of undefined" errors
 * Must be called before any imports that use Reanimated animations
 */
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

/**
 * Initialize i18next BEFORE any component or service that calls `t()`.
 * Module-scope `t()` calls (e.g. mutation onError handlers) read from the
 * configured i18next instance, so it must be ready before App.tsx loads.
 */
import './src/i18n/config';

/**
 * Configure Apollo Client memory management
 * Per Apollo docs: Set before loading @apollo/client
 * This must be imported before App.tsx (which imports apollo/client)
 */
import './src/apollo/config';

/**
 * Setup notification handlers for Notifee
 * Must be registered early to handle background notification events
 */
import { setupNotificationHandlers } from './src/utils/notifications/localNotificationHelper';
setupNotificationHandlers();

/**
 * Keep the OS app-icon badge in sync with the unread notification count, so it
 * clears when the user reads notifications in-app (the server can only set the
 * badge on push delivery).
 */
import { setupBadgeSync } from './src/utils/notifications/badgeSync';
setupBadgeSync();

/**
 * Register the FCM background/quit-state message handler.
 * Must run synchronously at the JS entry point — the headless task that wakes
 * the app to deliver a push invokes this handler outside the React tree.
 */
import { registerFcmBackgroundHandler } from './src/services/push/nativePushMessaging';
registerFcmBackgroundHandler();

/**
 * @format
 */
import { AppRegistry, TurboModuleRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import './src/theme/unistyles';
import { initializeSecureStorage } from './src/storage/mmkv';

// Create the gesture-handler native module before any GestureHandlerRootView
// mounts. Creating it is what installs the JSI bindings that define
// `globalThis._RNGH_MODULE_ID` and registers the native gesture registry under
// that id. GestureHandlerRootView reads that global, but nothing in its own
// import chain touches the native module — and `experimentalImportSupport` in
// metro.config.js lets Metro inline default imports, so the module can still be
// unloaded when the root view mounts. `moduleId` then arrives undefined, the
// Android view keeps its -1 default, and RNGestureHandlerRootHelper throws
// "Tried to access a non-existent registry" on the main thread at launch.
TurboModuleRegistry.get('RNGestureHandlerModule');

if (__DEV__ && global._RNGH_MODULE_ID === undefined) {
  console.error(
    '[startup] RNGestureHandlerModule did not install _RNGH_MODULE_ID. ' +
      'The native module name above is likely stale — Android will crash on ' +
      'launch with "Tried to access a non-existent registry".',
  );
}

// Activate native screen reuse. Native-stack's own `inactiveBehavior`
// (default 'pause') is driven by React's Activity/Offscreen primitive and
// does NOT require `enableFreeze` — that's a separate, additional layer
// (react-native-screens' integration with react-freeze, a Suspense-based
// subtree freezer), left disabled. Open upstream bug
// (react-native-screens#3169) reproduces with exactly this app's shape
// (heavy FlashList screens + tab navigation): on iOS 26 + RNS 4.17.0+, a
// screen frozen via `enableFreeze` never goes through `viewDidAppear:` on
// resume, so touch input stays disabled and the app appears frozen — no
// upstream fix released yet. Re-check `gh issue view 3169 --repo
// software-mansion/react-native-screens` before ever re-enabling.
enableScreens(true);
// enableFreeze(true); // see comment above — deliberately disabled

// Kick off encrypted MMKV initialization before any React code runs.
// Zustand persist hydration awaits this internally via zustandStorage, and
// the SplashScreen renders until isHydrated, so no sync `storage.X` access
// happens until the encrypted instance is ready.
initializeSecureStorage();

import App from './App';

import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
