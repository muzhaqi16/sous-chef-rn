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
 * @format
 */
import { AppRegistry } from 'react-native';
import './src/theme/unistyles';

import App from './App';

import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
