// Install crypto.getRandomValues polyfill before any module that uses uuid.
// Must be the very first import — generateId() runs during app startup
// (deviceKey, deviceId) and uuid v4 reads globalThis.crypto.getRandomValues.
import 'react-native-get-random-values';

// Record JS entry timestamp before any imports for startup time measurement
global.__APP_START_TIMESTAMP = Date.now();

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
import { AppRegistry } from 'react-native';
import { enableScreens, enableFreeze } from 'react-native-screens';
import './src/theme/unistyles';
import { initializeSecureStorage } from './src/storage/mmkv';

// Activate native screen reuse and inactive-screen freezing.
// On the New Architecture this is the explicit opt-in for native screen
// containers + freeze-on-blur behavior.
enableScreens(true);
enableFreeze(true);

// Kick off encrypted MMKV initialization before any React code runs.
// Zustand persist hydration awaits this internally via zustandStorage, and
// the SplashScreen renders until isHydrated, so no sync `storage.X` access
// happens until the encrypted instance is ready.
initializeSecureStorage();

import App from './App';

import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
